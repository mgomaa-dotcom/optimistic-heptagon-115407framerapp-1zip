"""Durable idempotency state for CRM writes.

Production uses Replit-managed PostgreSQL. Tests may explicitly pass a temporary
SQLite path; the runtime never falls back to a local file.
"""

from contextlib import contextmanager
import os
from pathlib import Path
import sqlite3
import time

import psycopg

from .providers import ProviderError

TABLE = "booking_submissions"
ENTITIES = ("company", "contact", "lead")


class BookingStateStore:
    def __init__(self, sqlite_path=None, *, database_url=None):
        self.sqlite_path = Path(sqlite_path) if sqlite_path is not None else None
        self.database_url = database_url or os.environ.get("DATABASE_URL")
        if self.sqlite_path is not None:
            self.sqlite_path.parent.mkdir(parents=True, exist_ok=True)
            with self.transaction() as db:
                db.execute("""CREATE TABLE IF NOT EXISTS submissions (
                    key TEXT PRIMARY KEY, digest TEXT NOT NULL,
                    company_id INTEGER, contact_id INTEGER, lead_id INTEGER,
                    pending_stage TEXT, created_at REAL NOT NULL
                )""")
        else:
            if not self.database_url:
                raise ProviderError("booking_state", code="database_not_configured")
            self._verify_schema()

    @property
    def is_sqlite(self):
        return self.sqlite_path is not None

    @property
    def placeholder(self):
        return "?" if self.is_sqlite else "%s"

    def connect(self):
        if self.is_sqlite:
            return sqlite3.connect(self.sqlite_path, timeout=30)
        return psycopg.connect(self.database_url, connect_timeout=10)

    @contextmanager
    def transaction(self):
        db = self.connect()
        try:
            with db:
                yield db
        finally:
            db.close()

    def _verify_schema(self):
        try:
            with self.transaction() as db:
                exists = db.execute(
                    "SELECT to_regclass('public.booking_submissions')"
                ).fetchone()[0]
        except psycopg.Error:
            raise ProviderError("booking_state", code="database_unavailable") from None
        if exists is None:
            raise ProviderError("booking_state", code="schema_not_ready")

    def claim_next_stage(self, key, digest):
        """Atomically reserve the next CRM write across all app instances."""
        marker = self.placeholder
        try:
            with self.transaction() as db:
                if self.is_sqlite:
                    # SQLite test backend: serialize the read/claim transaction.
                    db.execute("BEGIN IMMEDIATE")
                db.execute(
                    f"INSERT INTO {'submissions' if self.is_sqlite else TABLE} "
                    f"({('key' if self.is_sqlite else 'idempotency_key')},"
                    f" {('digest' if self.is_sqlite else 'payload_digest')}, created_at) "
                    f"VALUES ({marker}, {marker}, {marker}) ON CONFLICT DO NOTHING",
                    (key, digest, time.time()),
                )
                select = (
                    "SELECT digest, company_id, contact_id, lead_id, pending_stage "
                    "FROM submissions WHERE key = ?"
                    if self.is_sqlite else
                    "SELECT payload_digest, company_id, contact_id, lead_id, pending_stage "
                    "FROM booking_submissions WHERE idempotency_key = %s FOR UPDATE"
                )
                row = db.execute(select, (key,)).fetchone()
                if not row:
                    raise ProviderError("booking_state", code="row_missing")
                if row[0] != digest:
                    raise SubmissionConflictError()
                if row[4]:
                    raise DeliveryUncertainError()
                ids = dict(zip(ENTITIES, row[1:4]))
                if ids["lead"]:
                    return None, ids
                stage = next(entity for entity in ENTITIES if not ids[entity])
                db.execute(
                    f"UPDATE {'submissions' if self.is_sqlite else TABLE} "
                    f"SET pending_stage = {marker} "
                    f"WHERE {('key' if self.is_sqlite else 'idempotency_key')} = {marker}",
                    (stage, key),
                )
                return stage, ids
        except (SubmissionConflictError, DeliveryUncertainError):
            raise
        except psycopg.Error:
            raise ProviderError("booking_state", code="database_unavailable") from None

    def complete_stage(self, key, stage, record_id):
        marker = self.placeholder
        table = "submissions" if self.is_sqlite else TABLE
        key_column = "key" if self.is_sqlite else "idempotency_key"
        try:
            with self.transaction() as db:
                cursor = db.execute(
                    f"UPDATE {table} SET {stage}_id = {marker}, pending_stage = NULL "
                    f"WHERE {key_column} = {marker} AND pending_stage = {marker}",
                    (record_id, key, stage),
                )
                if cursor.rowcount != 1:
                    raise DeliveryUncertainError()
        except DeliveryUncertainError:
            raise
        except psycopg.Error:
            raise ProviderError("booking_state", code="database_unavailable") from None

    def clear_pending(self, key, stage):
        marker = self.placeholder
        table = "submissions" if self.is_sqlite else TABLE
        key_column = "key" if self.is_sqlite else "idempotency_key"
        try:
            with self.transaction() as db:
                db.execute(
                    f"UPDATE {table} SET pending_stage = NULL "
                    f"WHERE {key_column} = {marker} AND pending_stage = {marker}",
                    (key, stage),
                )
        except psycopg.Error:
            # Leave a possibly active reservation intact; retries then fail closed.
            raise ProviderError("booking_state", code="database_unavailable") from None


class SubmissionConflictError(Exception):
    pass


class DeliveryUncertainError(Exception):
    pass
