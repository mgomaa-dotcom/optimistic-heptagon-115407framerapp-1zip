"""Serve the imported site and keep CRM/country API credentials server-side."""

import json
import mimetypes
import threading
import time
from collections import defaultdict, deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

from backend.booking import Booking, DeliveryUncertain, SubmissionConflict, ValidationError
from backend.providers import ProviderError

ROOT = Path(__file__).resolve().parent
STATIC_FILES = {"index.html", "styles.css", "hero-image.css", "booking-form.js", "booking-form.css"}
booking = Booking(ROOT / ".local/booking-state.sqlite3")
attempts = defaultdict(deque)
attempt_lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    server_version = "MasteryWeb"

    def log_message(self, message, *args):
        # Do not log submitted personal data, external URLs, or credentials.
        pass

    def send_json(self, status, data, **headers):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        for key, value in headers.items():
            self.send_header(key.replace("_", "-"), str(value))
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/booking/options":
            try:
                self.send_json(200, booking.options())
            except ProviderError as error:
                print(f"Options unavailable: {error.service}/{error.code}", flush=True)
                self.send_json(503, {"error": "تعذّر تحميل خيارات النموذج. يرجى المحاولة مجدداً."})
            return
        if path.startswith("/api/"):
            self.send_json(404, {"error": "Not found"})
            return
        relative = unquote(path).lstrip("/") or "index.html"
        target = (ROOT / relative).resolve()
        public = relative in STATIC_FILES or relative.startswith("assets/")
        if (not public or not target.is_relative_to(ROOT) or not target.is_file()
                or any(part.startswith(".") for part in Path(relative).parts)):
            self.send_json(404, {"error": "Not found"})
            return
        content = target.read_bytes()
        content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        if target.suffix == ".mjs":
            content_type = "text/javascript"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self):
        if self.path != "/api/booking":
            self.send_json(404, {"error": "Not found"})
            return
        # Same-origin JSON only; do not expose a cross-origin webhook proxy.
        origin = self.headers.get("Origin")
        host = self.headers.get("Host", "").lower()
        if origin and urlsplit(origin).netloc.lower() != host:
            self.send_json(403, {"error": "طلب غير مسموح."})
            return
        if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
            self.send_json(415, {"error": "نوع الطلب غير مدعوم."})
            return
        ip = self.headers.get("X-Forwarded-For", self.client_address[0]).split(",")[0].strip()
        now = time.monotonic()
        with attempt_lock:
            if len(attempts) > 10000:
                for address in list(attempts):
                    if not attempts[address] or now - attempts[address][-1] > 600:
                        del attempts[address]
            bucket = attempts[ip]
            while bucket and now - bucket[0] > 600:
                bucket.popleft()
            if len(bucket) >= 10:
                self.send_json(429, {"error": "طلبات كثيرة. يرجى المحاولة بعد عشر دقائق."},
                               Retry_After=600)
                return
            bucket.append(now)
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 16000:
                self.send_json(413, {"error": "حجم الطلب غير صالح."})
                return
            data = json.loads(self.rfile.read(length))
        except (ValueError, UnicodeDecodeError):
            self.send_json(400, {"error": "بيانات الطلب غير صالحة."})
            return
        try:
            result = booking.submit(data, self.headers.get("Idempotency-Key", ""))
            self.send_json(200, result)
        except ValidationError as error:
            self.send_json(422, {"error": "يرجى مراجعة الحقول المطلوبة.", "fields": error.fields})
        except SubmissionConflict:
            self.send_json(409, {"error": "تغيرت بيانات طلب سابق. يرجى تحديث الصفحة وإرسال طلب جديد."})
        except DeliveryUncertain:
            self.send_json(409, {
                "error": "قد يكون طلبك قد وصل بالفعل. يرجى التواصل معنا قبل إعادة الإرسال.",
                "uncertain": True,
            })
        except ProviderError as error:
            print(f"Submission unavailable: {error.service}/{error.code}", flush=True)
            message = ("لم نتمكن من تأكيد استلام الطلب. يرجى التواصل معنا قبل إعادة الإرسال."
                       if error.uncertain else "تعذّر إرسال الطلب. احتفظنا ببياناتك في النموذج، يرجى المحاولة مجدداً.")
            self.send_json(502, {"error": message, "uncertain": error.uncertain})
        except Exception:
            # Do not leak exception details or claim success on unexpected failures.
            print("Unexpected booking error; inspect server implementation.", flush=True)
            self.send_json(500, {"error": "حدث خطأ غير متوقع. يرجى المحاولة لاحقاً."})


if __name__ == "__main__":
    mimetypes.add_type("image/avif", ".avif")
    print("Mastery website listening on port 5000", flush=True)
    ThreadingHTTPServer(("0.0.0.0", 5000), Handler).serve_forever()
