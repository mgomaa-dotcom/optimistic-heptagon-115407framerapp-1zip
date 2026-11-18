"""Video range and streaming regressions; never touches CRM or live storage."""

import io
import unittest
from unittest.mock import patch

from backend.media import byte_range, serve_video


class FakeHandler:
    def __init__(self, range_header=None):
        self.headers = {"Range": range_header} if range_header else {}
        self.response_headers = {}
        self.wfile = io.BytesIO()

    def send_response(self, status):
        self.status = status

    def send_header(self, key, value):
        self.response_headers[key] = value

    def end_headers(self):
        pass

    def send_json(self, status, data):
        self.status = status
        self.json = data


class FakeBlob:
    data = b"0123456789"
    size = len(data)

    def open(self, *args, **kwargs):
        return io.BytesIO(self.data)


class MediaTests(unittest.TestCase):
    def test_ranges(self):
        for header, expected in [
            (None, (0, 9)), ("bytes=0-2", (0, 2)), ("bytes=7-", (7, 9)),
            ("bytes=-3", (7, 9)), ("bytes=8-100", (8, 9)), ("bytes=-20", (0, 9)),
        ]:
            with self.subTest(header=header):
                self.assertEqual(byte_range(header, 10), expected)

    def test_invalid_ranges(self):
        for header in ["bytes=10-", "bytes=4-2", "bytes=-0", "bytes=-",
                       "bytes=0-2,5-6", "other=0-3", "bytes=foo"]:
            with self.subTest(header=header), self.assertRaises(ValueError):
                byte_range(header, 10)

    @patch("backend.media.video_blob", return_value=FakeBlob())
    def test_stream_whole_file(self, _):
        handler = FakeHandler()
        serve_video(handler)
        self.assertEqual(handler.status, 200)
        self.assertEqual(handler.wfile.getvalue(), FakeBlob.data)
        self.assertEqual(handler.response_headers["Content-Length"], "10")
        self.assertEqual(handler.response_headers["Accept-Ranges"], "bytes")

    @patch("backend.media.video_blob", return_value=FakeBlob())
    def test_partial_file(self, _):
        handler = FakeHandler("bytes=3-5")
        serve_video(handler)
        self.assertEqual(handler.status, 206)
        self.assertEqual(handler.wfile.getvalue(), b"345")
        self.assertEqual(handler.response_headers["Content-Range"], "bytes 3-5/10")

    @patch("backend.media.video_blob", return_value=FakeBlob())
    def test_head(self, _):
        handler = FakeHandler("bytes=3-5")
        serve_video(handler, head=True)
        self.assertEqual(handler.status, 200)
        self.assertEqual(handler.wfile.getvalue(), b"")
        self.assertEqual(handler.response_headers["Content-Length"], "10")

    @patch("backend.media.video_blob", return_value=FakeBlob())
    def test_unsatisfiable(self, _):
        handler = FakeHandler("bytes=10-")
        serve_video(handler)
        self.assertEqual(handler.status, 416)
        self.assertEqual(handler.response_headers["Content-Range"], "bytes */10")

    @patch("backend.media.video_blob", side_effect=RuntimeError("private detail"))
    def test_unavailable(self, _):
        handler = FakeHandler()
        serve_video(handler)
        self.assertEqual(handler.status, 503)
        self.assertNotIn("private detail", str(handler.json))


if __name__ == "__main__":
    unittest.main()
