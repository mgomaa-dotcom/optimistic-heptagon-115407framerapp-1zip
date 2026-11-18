import tempfile
import unittest
import uuid
from pathlib import Path

from backend.booking import (
    Booking, DeliveryUncertain, SubmissionConflict, ValidationError,
    build_records, validate,
)
from backend.providers import ProviderError


COUNTRIES = [{"code": "SA", "isoCode": "SA", "name": "Saudi Arabia", "flag": "🇸🇦"}]
OPTIONS = [{"value": "EMPLOYEES_4", "label": "21 – 50 employees", "maximum": 50}]
VALID = {
    "company": "Integration Fixture", "fullName": "Test Person",
    "email": "fixture@example.invalid", "phone": "+966501234567",
    "employees": "EMPLOYEES_4", "salespeople": "8", "country": "SA", "website": "",
}
METADATA = {
    "UF_COUNTRY": {"formLabel": "Country", "items": [{"ID": "846", "VALUE": "Saudi Arabia"}]},
}


class FakeCountries:
    def all(self):
        return COUNTRIES


class FakeBitrix:
    def __init__(self):
        self.writes = []
        self.fail_entity = None
        self.uncertain = False

    def sales_field(self):
        return "UF_SALES"

    def fields(self, entity):
        return METADATA

    def call(self, method, payload):
        if method == "crm.status.list":
            return [{"STATUS_ID": "EMPLOYEES_4", "NAME": "21 – 50 employees"}]
        if self.fail_entity and method == f"crm.{self.fail_entity}.add":
            raise ProviderError("bitrix", uncertain=self.uncertain)
        self.writes.append((method, payload))
        return 100 + len(self.writes)


class ValidationTests(unittest.TestCase):
    def test_website_is_optional(self):
        self.assertEqual(validate(VALID, COUNTRIES, OPTIONS)["website"], "")

    def test_all_other_fields_are_required(self):
        for field in VALID:
            if field == "website":
                continue
            with self.subTest(field=field), self.assertRaises(ValidationError) as raised:
                validate({**VALID, field: ""}, COUNTRIES, OPTIONS)
            self.assertIn(field, raised.exception.fields)

    def test_invalid_inputs(self):
        for field, value in [
            ("email", "invalid"), ("phone", "50123"), ("country", "XX"),
            ("employees", "unrecognized"), ("salespeople", "-1"),
            ("salespeople", "1.5"), ("salespeople", "51"),
            ("website", "javascript:alert(1)"), ("website", "https://user:pass@example.com"),
            ("fullName", ["not", "text"]), ("company", "\n"),
        ]:
            with self.subTest(field=field, value=value), self.assertRaises(ValidationError):
                validate({**VALID, field: value}, COUNTRIES, OPTIONS)

    def test_website_and_phone_normalization(self):
        data = validate({**VALID, "website": "example.com", "phone": "+966 50 123 4567"},
                        COUNTRIES, OPTIONS)
        self.assertEqual(data["website"], "https://example.com")
        self.assertEqual(data["phone"], "+966501234567")

    def test_full_name_requires_two_real_name_parts(self):
        for name in ["John", " John ", "   ", "John 123", "123 456", "John_ Doe"]:
            with self.subTest(name=name), self.assertRaises(ValidationError) as raised:
                validate({**VALID, "fullName": name}, COUNTRIES, OPTIONS)
            self.assertIn("fullName", raised.exception.fields)

    def test_full_name_preserves_all_family_name_parts(self):
        for name, first, last in [
            ("  John   van  Smith  ", "John", "van Smith"),
            ("محمد عبد الله", "محمد", "عبد الله"),
            ("Anne-Marie O’Neill", "Anne-Marie", "O’Neill"),
        ]:
            with self.subTest(name=name):
                clean = validate({**VALID, "fullName": name}, COUNTRIES, OPTIONS)
                self.assertEqual((clean["firstName"], clean["lastName"]), (first, last))
                _, contact, lead = build_records(clean, "UF_SALES", METADATA, METADATA)
                self.assertEqual(contact["NAME"], first)
                self.assertEqual(contact["LAST_NAME"], last)
                self.assertEqual(lead["LAST_NAME"], last)

    def test_old_open_forms_still_map_to_same_names(self):
        old = {key: value for key, value in VALID.items() if key != "fullName"}
        old.update(firstName="Test", lastName="Person")
        self.assertEqual(validate(old, COUNTRIES, OPTIONS), validate(VALID, COUNTRIES, OPTIONS))

    def test_arabic_and_persian_digits_become_english(self):
        for phone, count in [("+٩٦٦٥٠١٢٣٤٥٦٧", "٨"), ("+۹۶۶۵۰۱۲۳۴۵۶۷", "۸")]:
            with self.subTest(phone=phone):
                clean = validate({**VALID, "phone": phone, "salespeople": count}, COUNTRIES, OPTIONS)
                self.assertEqual(clean["phone"], "+966501234567")
                self.assertEqual(clean["salespeople"], "8")

    def test_separate_employee_and_sales_fields(self):
        data = validate(VALID, COUNTRIES, OPTIONS)
        company, contact, lead = build_records(data, "UF_SALES", METADATA, METADATA)
        self.assertEqual(company["EMPLOYEES"], "EMPLOYEES_4")
        self.assertEqual(company["UF_COUNTRY"], "846")
        self.assertEqual(company["ADDRESS_COUNTRY"], "Saudi Arabia")
        self.assertEqual(lead["UF_SALES"], "8")
        self.assertIn("Employees: 21 – 50 employees", lead["COMMENTS"])
        self.assertIn("Salespeople: 8", lead["COMMENTS"])
        self.assertNotIn("WEB", company)
        self.assertEqual(contact["PHONE"][0]["VALUE_TYPE"], "WORK")

    def test_all_countries_saved_even_when_custom_enum_has_no_option(self):
        data = {**validate(VALID, COUNTRIES, OPTIONS), "countryName": "France", "countryCode": "FR"}
        company, _, lead = build_records(data, "UF_SALES", METADATA, METADATA)
        self.assertEqual(company["ADDRESS_COUNTRY"], "France")
        self.assertNotIn("UF_COUNTRY", company)
        self.assertEqual(lead["ADDRESS_COUNTRY_CODE"], "FR")

    def test_optional_website_maps_to_company_and_lead(self):
        data = validate({**VALID, "website": "https://example.com"}, COUNTRIES, OPTIONS)
        company, _, lead = build_records(data, "UF_SALES", METADATA, METADATA)
        self.assertEqual(company["WEB"], lead["WEB"])
        self.assertEqual(company["WEB"][0]["VALUE"], "https://example.com")


class SubmissionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "state.sqlite3"
        self.bitrix = FakeBitrix()
        self.service = Booking(self.path, bitrix=self.bitrix, countries=FakeCountries())
        self.key = str(uuid.uuid4())

    def tearDown(self):
        self.temp.cleanup()

    def test_creates_three_correctly_linked_records(self):
        self.assertEqual(self.service.submit(VALID, self.key), {"ok": True})
        company, contact, lead = self.bitrix.writes
        self.assertEqual(company[0], "crm.company.add")
        self.assertEqual(contact[0], "crm.contact.add")
        self.assertEqual(lead[0], "crm.lead.add")
        self.assertEqual(contact[1]["fields"]["COMPANY_ID"], 101)
        self.assertEqual(lead[1]["fields"]["COMPANY_ID"], 101)
        self.assertEqual(lead[1]["fields"]["CONTACT_ID"], 102)
        self.assertEqual(lead[1]["params"], {"REGISTER_SONET_EVENT": "Y"})

    def test_duplicate_submission_after_restart_does_not_create_more_records(self):
        self.service.submit(VALID, self.key)
        restarted = Booking(self.path, bitrix=self.bitrix, countries=FakeCountries())
        restarted.submit(VALID, self.key)
        self.assertEqual(len(self.bitrix.writes), 3)

    def test_modified_payload_rejects_reused_key(self):
        self.service.submit(VALID, self.key)
        with self.assertRaises(SubmissionConflict):
            self.service.submit({**VALID, "company": "Changed Company"}, self.key)

    def test_invalid_data_never_creates_records(self):
        with self.assertRaises(ValidationError):
            self.service.submit({**VALID, "email": ""}, self.key)
        self.assertEqual(self.bitrix.writes, [])

    def test_retry_continues_after_definitive_provider_rejection(self):
        self.bitrix.fail_entity = "contact"
        with self.assertRaises(ProviderError):
            self.service.submit(VALID, self.key)
        self.bitrix.fail_entity = None
        self.service.submit(VALID, self.key)
        self.assertEqual([name for name, _ in self.bitrix.writes],
                         ["crm.company.add", "crm.contact.add", "crm.lead.add"])

    def test_uncertain_delivery_is_not_automatically_duplicated(self):
        self.bitrix.fail_entity = "contact"
        self.bitrix.uncertain = True
        with self.assertRaises(ProviderError):
            self.service.submit(VALID, self.key)
        self.bitrix.fail_entity = None
        with self.assertRaises(DeliveryUncertain):
            self.service.submit(VALID, self.key)
        self.assertEqual(len(self.bitrix.writes), 1)


if __name__ == "__main__":
    unittest.main()
