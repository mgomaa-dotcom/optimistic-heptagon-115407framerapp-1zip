"""Exercise booking throttling over HTTP without any external CRM calls."""

import json
import threading
import unittest
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from types import SimpleNamespace
from unittest.mock import Mock, patch

import server


class BookingRateLimitTests(unittest.TestCase):
    def setUp(self):
        self.patches = ExitStack()
        self.addCleanup(self.patches.close)
        self.now = 1000.0
        self.attempts = defaultdict(deque)
        self.booking = Mock()
        self.booking.submit.return_value = {"ok": True}
        self.patches.enter_context(patch.object(server, "booking", self.booking))
        self.patches.enter_context(patch.object(server, "attempts", self.attempts))
        self.patches.enter_context(patch.object(
            server, "time", SimpleNamespace(monotonic=lambda: self.now),
        ))
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        self.thread = threading.Thread(
            target=self.httpd.serve_forever, kwargs={"poll_interval": 0.01},
            daemon=True,
        )
        self.thread.start()
        self.addCleanup(self.stop_server)

    def stop_server(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join()

    def post(self, extra_headers=None, body="{}"):
        connection = HTTPConnection(*self.httpd.server_address, timeout=5)
        try:
            connection.request("POST", "/api/booking", body=body, headers={
                "Content-Type": "application/json",
                **(extra_headers or {}),
            })
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), json.loads(response.read())
        finally:
            connection.close()

    def assert_throttled(self, result):
        status, headers, body = result
        self.assertEqual(status, 429)
        self.assertEqual(headers["Retry-After"], "600")
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertIn("error", body)

    def test_rotating_forwarding_headers_cannot_create_fresh_buckets(self):
        for index in range(10):
            self.assertEqual(self.post({
                "X-Forwarded-For": f"198.51.100.{index + 1}",
                "X-Real-IP": f"203.0.113.{index + 1}",
                "Forwarded": f"for=192.0.2.{index + 1}",
                "Idempotency-Key": f"unique-request-{index}",
            })[0], 200)
        for headers in [
            {"X-Forwarded-For": "198.51.100.200"},
            {"X-Forwarded-For": "198.51.100.201, 203.0.113.200"},
            {"X-Forwarded-For": ""},
            {"X-Forwarded-For": "not-an-address"},
            {},
        ]:
            with self.subTest(headers=headers):
                self.assert_throttled(self.post(headers))
        self.assertEqual(set(self.attempts), {"127.0.0.1"})
        self.assertEqual(self.booking.submit.call_count, 10)

    def test_requests_without_forwarding_headers_are_limited(self):
        for _ in range(10):
            self.assertEqual(self.post()[0], 200)
        self.assert_throttled(self.post())
        self.assertEqual(self.booking.submit.call_count, 10)

    def test_requests_resume_after_window_expires(self):
        for _ in range(10):
            self.assertEqual(self.post()[0], 200)
        self.now += 599
        self.assert_throttled(self.post())
        self.now += 2
        self.assertEqual(self.post()[0], 200)
        self.assertEqual(self.booking.submit.call_count, 11)
        self.assertEqual(len(self.attempts["127.0.0.1"]), 1)

    def test_other_socket_peer_has_an_independent_bucket(self):
        self.attempts["192.0.2.100"].extend([self.now] * 10)
        self.assertEqual(self.post({"X-Forwarded-For": "192.0.2.100"})[0], 200)
        self.assertEqual(len(self.attempts["192.0.2.100"]), 10)
        self.assertEqual(len(self.attempts["127.0.0.1"]), 1)

    def test_concurrent_requests_cannot_exceed_limit(self):
        with ThreadPoolExecutor(max_workers=5) as pool:
            results = list(pool.map(
                lambda index: self.post({"X-Forwarded-For": f"198.51.100.{index + 1}"}),
                range(20),
            ))
        self.assertEqual(sum(result[0] == 200 for result in results), 10)
        self.assertEqual(sum(result[0] == 429 for result in results), 10)
        self.assertEqual(self.booking.submit.call_count, 10)

    def test_invalid_json_also_consumes_attempts(self):
        for _ in range(10):
            self.assertEqual(self.post(body="{")[0], 400)
        self.assert_throttled(self.post())
        self.booking.submit.assert_not_called()


if __name__ == "__main__":
    unittest.main()
