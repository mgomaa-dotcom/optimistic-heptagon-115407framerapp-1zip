"""Video range and streaming regressions; never touches CRM or live storage."""

import io
import unittest
from unittest.mock import patch

from google.api_core.exceptions import Forbidden, ServiceUnavailable

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

    @patch("backend.media.MAX_RANGE_SIZE", 4)
    @patch("backend.media.video_blob", return_value=FakeBlob())
    def test_open_ended_range_is_segmented(self, _):
        output = b""
        for start, expected in [(0, b"0123"), (4, b"4567"), (8, b"89")]:
            handler = FakeHandler(f"bytes={start}-")
            serve_video(handler)
            self.assertEqual(handler.status, 206)
            self.assertEqual(handler.wfile.getvalue(), expected)
            self.assertEqual(handler.response_headers["Content-Length"], str(len(expected)))
            self.assertEqual(
                handler.response_headers["Content-Range"],
                f"bytes {start}-{start + len(expected) - 1}/10",
            )
            output += handler.wfile.getvalue()
        self.assertEqual(output, FakeBlob.data)

    @patch("backend.media.MAX_RANGE_SIZE", 4)
    @patch("backend.media.video_blob", return_value=FakeBlob())
    def test_large_explicit_range_is_segmented(self, _):
        handler = FakeHandler("bytes=2-9")
        serve_video(handler)
        self.assertEqual(handler.wfile.getvalue(), b"2345")
        self.assertEqual(handler.response_headers["Content-Range"], "bytes 2-5/10")

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

    @patch("backend.media.time.sleep")
    @patch("backend.media.video_blob",
           side_effect=[ServiceUnavailable("private detail"), FakeBlob(), FakeBlob()])
    def test_temporary_metadata_failure_recovers(self, blob, sleep):
        handler = FakeHandler("bytes=3-5")
        with patch("builtins.print") as log:
            serve_video(handler)
        self.assertEqual(handler.status, 206)
        self.assertEqual(handler.wfile.getvalue(), b"345")
        sleep.assert_called_once_with(0.2)
        self.assertNotIn("private detail", str(log.call_args_list))
        self.assertIn("metadata lookup", str(log.call_args_list))
        self.assertIn("503", str(log.call_args_list))

    @patch("backend.media.time.sleep")
    @patch("backend.media.video_blob", side_effect=Forbidden("private detail"))
    def test_permission_failure_is_not_retried(self, blob, sleep):
        handler = FakeHandler()
        with patch("builtins.print") as log:
            serve_video(handler)
        self.assertEqual(handler.status, 503)
        blob.assert_called_once()
        sleep.assert_not_called()
        self.assertNotIn("private detail", str(log.call_args_list))

    @patch("backend.media.time.sleep")
    def test_initial_read_failure_retries_before_headers(self, sleep):
        blob = FakeBlob()
        with patch.object(blob, "open", side_effect=[
            ServiceUnavailable("private detail"), io.BytesIO(blob.data)
        ]), patch("backend.media.video_blob", return_value=blob), patch("builtins.print"):
            handler = FakeHandler("bytes=3-5")
            serve_video(handler)
        self.assertEqual(handler.status, 206)
        self.assertEqual(handler.wfile.getvalue(), b"345")
        sleep.assert_called_once_with(0.2)

    @patch("backend.media.time.sleep")
    @patch("backend.media.video_blob", side_effect=ServiceUnavailable("private detail"))
    def test_persistent_temporary_failure_stops_after_two_attempts(self, blob, sleep):
        handler = FakeHandler()
        with patch("builtins.print"):
            serve_video(handler)
        self.assertEqual(handler.status, 503)
        self.assertEqual(blob.call_count, 2)
        sleep.assert_called_once()


if __name__ == "__main__":
    unittest.main()
