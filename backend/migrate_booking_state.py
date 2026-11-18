"""Copy retry metadata from the legacy SQLite ledger into Replit PostgreSQL.

Repeatable and non-destructive: SQLite is read-only, existing PostgreSQL rows
are never overwritten, and a key collision with differing metadata aborts.
Run with: python3 -m backend.migrate_booking_state
"""

import os
from pathlib import Path
import sqlite3
import sys
import uuid

import psycopg

from .booking_state import TABLE

SOURCE = Path(".local/booking-state.sqlite3")
COLUMNS = (
    "key", "digest", "company_id", "contact_id", "lead_id",
    "pending_stage", "created_at",
)


def read_legacy_rows(path=SOURCE):
    if not path.exists():
        return []
    uri = f"file:{path.resolve()}?mode=ro"
    with sqlite3.connect(uri, uri=True) as source:
        source.row_factory = sqlite3.Row
        names = {row["name"] for row in source.execute("PRAGMA table_info(submissions)")}
        if not names:
            return []
        if names != set(COLUMNS):
            raise RuntimeError("Legacy booking ledger has an unexpected schema.")
        rows = [tuple(row[column] for column in COLUMNS)
                for row in source.execute(
                    "SELECT key,digest,company_id,contact_id,lead_id,pending_stage,created_at "
                    "FROM submissions"
                )]
    for key, digest, company_id, contact_id, lead_id, stage, created_at in rows:
        try:
            if str(uuid.UUID(key)) != key:
                raise ValueError()
        except (ValueError, TypeError, AttributeError):
            raise RuntimeError("Legacy ledger contains an invalid request key.") from None
        if (not isinstance(digest, str) or len(digest) != 64
                or any(char not in "0123456789abcdef" for char in digest)):
            raise RuntimeError("Legacy ledger contains an invalid request digest.")
        if stage not in (None, "company", "contact", "lead"):
            raise RuntimeError("Legacy ledger contains an invalid delivery stage.")
        if any(value is not None and (isinstance(value, bool) or int(value) < 1)
               for value in (company_id, contact_id, lead_id)):
            raise RuntimeError("Legacy ledger contains an invalid CRM record ID.")
        if isinstance(created_at, bool) or not isinstance(created_at, (int, float)):
            raise RuntimeError("Legacy ledger contains an invalid timestamp.")
    return rows


def migrate(path=SOURCE):
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required; no fallback database is used.")
    rows = read_legacy_rows(path)
    with psycopg.connect(database_url, connect_timeout=10) as db:
        for row in rows:
            db.execute(
                f"INSERT INTO {TABLE} "
                "(idempotency_key,payload_digest,company_id,contact_id,lead_id,"
                "pending_stage,created_at) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s) "
                "ON CONFLICT (idempotency_key) DO NOTHING",
                row,
            )
            existing = db.execute(
                f"SELECT idempotency_key,payload_digest,company_id,contact_id,lead_id,"
                f"pending_stage,created_at FROM {TABLE} WHERE idempotency_key=%s",
                (row[0],),
            ).fetchone()
            if existing != row:
                raise RuntimeError(
                    "A request key already exists with different metadata; no rows were overwritten."
                )
    return len(rows)


if __name__ == "__main__":
    try:
        count = migrate()
    except RuntimeError as error:
        print(f"Booking-state migration failed: {error}", file=sys.stderr)
        raise SystemExit(1) from None
    except Exception:
        # Database driver errors may contain connection details; never print them.
        print("Booking-state migration failed; check the database and source file.", file=sys.stderr)
        raise SystemExit(1) from None
    print(f"Verified {count} booking-state metadata rows. The SQLite source was left unchanged.")
