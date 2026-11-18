"""Validation, field mapping, and restart-safe submission tracking."""

import hashlib
import json
import re
import sqlite3
import threading
import time
import uuid
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from .providers import Bitrix, Countries, ProviderError


class ValidationError(Exception):
    def __init__(self, fields):
        super().__init__("Invalid consultation request")
        self.fields = fields


class SubmissionConflict(Exception):
    pass


class DeliveryUncertain(Exception):
    pass


def validate(data, countries, employee_options):
    if not isinstance(data, dict):
        raise ValidationError({"form": "بيانات الطلب غير صالحة."})
    clean, errors = {}, {}
    limits = {
        "company": 200, "firstName": 80, "lastName": 100, "email": 254,
        "phone": 30, "employees": 60, "salespeople": 8, "country": 200,
        "website": 2048,
    }
    for field, limit in limits.items():
        value = data.get(field, "")
        if not isinstance(value, str):
            errors[field] = "يرجى إدخال قيمة صحيحة."
            continue
        value = value.strip()
        if len(value) > limit or any(ord(char) < 32 for char in value):
            errors[field] = "القيمة طويلة جداً أو تحتوي على محارف غير صالحة."
        elif field != "website" and not value:
            errors[field] = "هذا الحقل مطلوب."
        clean[field] = value
    if errors:
        raise ValidationError(errors)
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", clean["email"]):
        errors["email"] = "يرجى إدخال بريد إلكتروني صحيح."
    phone = re.sub(r"[\s().-]", "", clean["phone"])
    if not re.fullmatch(r"\+[1-9][0-9]{7,14}", phone):
        errors["phone"] = "أدخل رقم الهاتف مع رمز الدولة، مثل ‎+966501234567."
    clean["phone"] = phone
    options = {item["value"]: item for item in employee_options}
    if clean["employees"] not in options:
        errors["employees"] = "يرجى اختيار عدد الموظفين."
    if not re.fullmatch(r"[0-9]{1,7}", clean["salespeople"]):
        errors["salespeople"] = "أدخل عدداً صحيحاً يساوي صفراً أو أكثر."
    elif clean["employees"] in options:
        maximum = options[clean["employees"]].get("maximum")
        if maximum and int(clean["salespeople"]) > maximum:
            errors["salespeople"] = "عدد موظفي المبيعات لا يمكن أن يتجاوز إجمالي الموظفين."
    country = next((item for item in countries if item["code"] == clean["country"]), None)
    if not country:
        errors["country"] = "يرجى اختيار الدولة من القائمة."
    else:
        clean["countryName"] = country["name"]
        clean["countryCode"] = country["isoCode"]
    if clean["website"]:
        website = clean["website"]
        if "://" not in website:
            website = "https://" + website
        try:
            url = urlsplit(website)
            port = url.port
            if (url.scheme not in ("https", "http") or not url.hostname
                    or "." not in url.hostname or url.username or url.password
                    or re.search(r"\s", website) or (port and port > 65535)):
                raise ValueError()
            clean["website"] = urlunsplit(url)
        except ValueError:
            errors["website"] = "يرجى إدخال رابط موقع صحيح، أو اترك الحقل فارغاً."
    if errors:
        raise ValidationError(errors)
    clean["employeesLabel"] = options[clean["employees"]]["label"]
    return clean


def country_fields(metadata, name, code):
    values = {"ADDRESS_COUNTRY": name, "ADDRESS_COUNTRY_CODE": code}
    # Some portals also expose a limited custom Country enumeration.
    for key, field in metadata.items():
        if key.startswith("UF_") and str(field.get("formLabel") or "").lower() == "country":
            for item in field.get("items", []):
                if item.get("VALUE", "").casefold() == name.casefold():
                    values[key] = str(item["ID"])
                    break
    return values


def build_records(data, sales_field, company_metadata, lead_metadata):
    comments = (
        f"Employees: {data['employeesLabel']}\n"
        f"Salespeople: {data['salespeople']}\n"
        f"Country: {data['countryName']}\n"
        f"Website: {data['website'] or 'Not provided'}"
    )
    contact = {
        "NAME": data["firstName"], "LAST_NAME": data["lastName"],
        "PHONE": [{"VALUE": data["phone"], "VALUE_TYPE": "WORK"}],
        "EMAIL": [{"VALUE": data["email"], "VALUE_TYPE": "WORK"}],
        "SOURCE_ID": "WEB",
    }
    company = {
        "TITLE": data["company"], "EMPLOYEES": data["employees"],
        "COMMENTS": comments,
        **country_fields(company_metadata, data["countryName"], data["countryCode"]),
    }
    lead = {
        **contact, "TITLE": (
            f"Website Form: {data['firstName']} {data['lastName']} - {data['company']}"
        ),
        "COMPANY_TITLE": data["company"], "COMMENTS": comments,
        sales_field: data["salespeople"],
        **country_fields(lead_metadata, data["countryName"], data["countryCode"]),
    }
    if data["website"]:
        web = [{"VALUE": data["website"], "VALUE_TYPE": "WORK"}]
        company["WEB"] = web
        lead["WEB"] = web
    return company, contact, lead


class Booking:
    def __init__(self, state_path=None, *, bitrix=None, countries=None):
        self.bitrix = bitrix or Bitrix()
        self.countries = countries or Countries()
        self.state_path = Path(state_path or ".local/booking-state.sqlite3")
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._options = None
        self._options_expiry = 0
        with self.connect() as db:
            db.execute("""CREATE TABLE IF NOT EXISTS submissions (
                key TEXT PRIMARY KEY, digest TEXT NOT NULL,
                company_id INTEGER, contact_id INTEGER, lead_id INTEGER,
                pending_stage TEXT, created_at REAL NOT NULL
            )""")

    def connect(self):
        return sqlite3.connect(self.state_path, timeout=30)

    def employee_options(self):
        if self._options is not None and self._options_expiry > time.monotonic():
            return self._options
        statuses = self.bitrix.call("crm.status.list", {"filter": {"ENTITY_ID": "EMPLOYEES"}})
        if not isinstance(statuses, list) or not statuses:
            raise ProviderError("bitrix", code="employee_options_missing")
        result = []
        for status in statuses:
            label = status["NAME"]
            numbers = [int(value) for value in re.findall(r"\d+", label)]
            maximum = numbers[-1] if len(numbers) >= 2 else None
            result.append({"value": status["STATUS_ID"], "label": label, "maximum": maximum})
        self._options = result
        self._options_expiry = time.monotonic() + 3600
        return result

    def options(self):
        return {"countries": self.countries.all(), "employees": self.employee_options()}

    def submit(self, raw, key):
        try:
            if str(uuid.UUID(key)) != key:
                raise ValueError()
        except (ValueError, TypeError, AttributeError):
            raise ValidationError({"form": "معرّف الطلب غير صالح. يرجى تحديث الصفحة."})
        data = validate(raw, self.countries.all(), self.employee_options())
        # Check every mapping before creating any remote record.
        sales_field = self.bitrix.sales_field()
        records = build_records(
            data, sales_field, self.bitrix.fields("company"), self.bitrix.fields("lead"),
        )
        digest = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
        with self._lock, self.connect() as db:
            row = db.execute(
                "SELECT digest, company_id, contact_id, lead_id, pending_stage "
                "FROM submissions WHERE key = ?", (key,),
            ).fetchone()
            if row:
                if row[0] != digest:
                    raise SubmissionConflict()
                if row[4]:
                    # A timed-out or interrupted write may already exist in the CRM.
                    raise DeliveryUncertain()
                if row[3]:
                    return {"ok": True}
            else:
                db.execute("INSERT INTO submissions(key,digest,created_at) VALUES(?,?,?)",
                           (key, digest, time.time()))
                db.commit()
                row = (digest, None, None, None, None)
            ids = {"company": row[1], "contact": row[2], "lead": row[3]}
            for entity, fields in zip(("company", "contact", "lead"), records):
                if ids[entity]:
                    continue
                if entity in ("contact", "lead"):
                    fields["COMPANY_ID"] = ids["company"]
                if entity == "lead":
                    fields["CONTACT_ID"] = ids["contact"]
                db.execute("UPDATE submissions SET pending_stage=? WHERE key=?", (entity, key))
                db.commit()
                try:
                    record_id = self.bitrix.call(
                        f"crm.{entity}.add",
                        {"fields": fields, "params": {"REGISTER_SONET_EVENT": "Y"}},
                    )
                    if isinstance(record_id, bool) or not str(record_id).isdigit() or int(record_id) < 1:
                        raise ProviderError("bitrix", uncertain=True, code="invalid_record_id")
                except ProviderError as error:
                    if not error.uncertain:
                        db.execute("UPDATE submissions SET pending_stage=NULL WHERE key=?", (key,))
                        db.commit()
                    raise
                ids[entity] = int(record_id)
                # Column name comes from the fixed tuple above, never from user input.
                db.execute(f"UPDATE submissions SET {entity}_id=?, pending_stage=NULL WHERE key=?",
                           (ids[entity], key))
                db.commit()
            return {"ok": True}
