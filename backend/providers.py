"""External API clients. Credentials are read only by the server."""

import json
import os
import re
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen


class ProviderError(Exception):
    def __init__(self, service, *, uncertain=False, code="unavailable"):
        super().__init__(f"{service}: {code}")
        self.service = service
        self.uncertain = uncertain
        self.code = code


def request_json(url, *, headers=None, payload=None, service, mutation=False):
    data = json.dumps(payload).encode() if payload is not None else None
    request = Request(url, data=data, headers={
        "Accept": "application/json", "User-Agent": "MasteryAcademy/1.0",
        **({"Content-Type": "application/json"} if data else {}),
        **(headers or {}),
    })
    try:
        with urlopen(request, timeout=20) as response:
            result = json.loads(response.read(4_000_000))
    except HTTPError as error:
        # Never include the request URL, credentials, or provider response in errors/logs.
        code = f"http_{error.code}"
        if service == "countries":
            try:
                body = json.loads(error.read(32000))
                errors = body.get("errors", [])
                candidate = errors[0].get("code", "") if errors else ""
                if re.fullmatch(r"[A-Za-z_.]{1,60}", str(candidate)):
                    code += "_" + candidate
            except (ValueError, AttributeError, TypeError, IndexError):
                pass
        raise ProviderError(service, uncertain=mutation and error.code >= 500,
                            code=code) from None
    except (URLError, TimeoutError, OSError, ValueError):
        raise ProviderError(service, uncertain=mutation) from None
    if not isinstance(result, dict):
        raise ProviderError(service, uncertain=mutation, code="invalid_response")
    return result


class Countries:
    def __init__(self):
        self._countries = []
        self._expires = 0
        self._lock = threading.Lock()

    def all(self):
        with self._lock:
            if self._countries and time.monotonic() < self._expires:
                return self._countries
            token = os.environ.get("REST_COUNTRY_TOKEN", "")
            if not token:
                raise ProviderError("countries", code="not_configured")
            countries = {}
            for offset in range(0, 1000, 100):
                query = urlencode({
                    "limit": 100, "offset": offset,
                    "response_fields": "names.common,codes.alpha_2,flag.emoji,flag.url_svg",
                })
                result = request_json(
                    "https://api.restcountries.com/countries/v5?" + query,
                    headers={"Authorization": "Bearer " + token}, service="countries",
                )
                data = result.get("data", {})
                objects = data.get("objects") if isinstance(data, dict) else None
                if not isinstance(objects, list) or result.get("errors"):
                    raise ProviderError("countries", code="invalid_response")
                for item in objects:
                    code = item.get("codes", {}).get("alpha_2", "")
                    name = item.get("names", {}).get("common", "")
                    if not isinstance(name, str) or not name or (
                        code and not re.fullmatch(r"[A-Z]{2}", code)
                    ):
                        raise ProviderError("countries", code="invalid_response")
                    flag = item.get("flag", {})
                    identifier = code or "country:" + name
                    countries[identifier] = {
                        "code": identifier, "isoCode": code,
                        "name": name, "flag": flag.get("emoji", ""),
                    }
                if not data.get("meta", {}).get("more", False):
                    break
            else:
                raise ProviderError("countries", code="pagination_limit")
            if not countries:
                raise ProviderError("countries", code="empty_response")
            self._countries = sorted(countries.values(), key=lambda item: item["name"])
            self._expires = time.monotonic() + 86400
            return self._countries


class Bitrix:
    def __init__(self):
        self._metadata = {}
        self._lock = threading.Lock()

    def call(self, method, payload=None):
        value = os.environ.get("BITRIX24_WEBHOOK_URL", "")
        parts = urlsplit(value)
        if parts.scheme != "https" or not parts.hostname or parts.username or parts.password:
            raise ProviderError("bitrix", code="not_configured")
        # Accept either a webhook base URL or the full crm.lead.add.json URL.
        path = parts.path.rstrip("/")
        if path.endswith(".json") or re.search(r"/crm\.[^/]+$", path):
            path = path.rsplit("/", 1)[0]
        url = urlunsplit((parts.scheme, parts.netloc, path + "/" + method + ".json", "", ""))
        mutation = method.endswith(".add")
        result = request_json(url, payload=payload or {}, service="bitrix", mutation=mutation)
        if result.get("error"):
            code = str(result["error"])
            if not re.fullmatch(r"[A-Za-z0-9_]{1,80}", code):
                code = "rejected"
            raise ProviderError("bitrix", code=code)
        if "result" not in result:
            raise ProviderError("bitrix", uncertain=mutation, code="invalid_response")
        return result["result"]

    def fields(self, entity):
        with self._lock:
            cached = self._metadata.get(entity)
            if cached and cached[0] > time.monotonic():
                return cached[1]
            fields = self.call(f"crm.{entity}.fields")
            if not isinstance(fields, dict):
                raise ProviderError("bitrix", code="invalid_metadata")
            self._metadata[entity] = (time.monotonic() + 3600, fields)
            return fields

    def sales_field(self):
        fields = self.fields("lead")
        matches = []
        for name, field in fields.items():
            labels = [name, *(field.get(key, "") for key in (
                "title", "formLabel", "listLabel", "filterLabel",
            ))]
            normalized = [re.sub(r"[^a-z0-9]", "", str(label).lower()) for label in labels]
            if name.startswith("UF_") and any(
                label in ("noofemployees", "numberofsalespeople", "salespeople", "salesteamsize")
                for label in normalized
            ):
                matches.append(name)
        if len(matches) != 1:
            raise ProviderError("bitrix", code="sales_field_mapping_required")
        return matches[0]
