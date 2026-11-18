"""Serve only the approved homepage video from private App Storage."""

import re
import threading
import time

from google.auth import identity_pool
from google.cloud import storage
from replit.object_storage._config import REPLIT_ADC

BUCKET_ID = "replit-objstore-144e4ed6-28af-4673-a84b-9e265e957a44"
VIDEO_OBJECT = "اعلان أكاديمية المبيعات - Main + SFX (2026-11-18 v2) - FINAL.mp4"
CHUNK_SIZE = 1024 * 1024
_metadata = None
_expires = 0
_lock = threading.Lock()


def video_blob():
    """Reuse the SDK's automatic Replit identity; never expose bucket credentials.

    The underlying GCS client supports bounded reads and seeking, unlike the
    Replit SDK's whole-object download API. Keep this adapter isolated.
    """
    global _metadata, _expires
    with _lock:
        if _metadata is None or time.monotonic() >= _expires:
            client = storage.Client(
                credentials=identity_pool.Credentials(**REPLIT_ADC), project=""
            )
            blob = client.bucket(BUCKET_ID).blob(VIDEO_OBJECT)
            blob.reload(timeout=20)
            _metadata = blob
            _expires = time.monotonic() + 60
        return _metadata


def byte_range(header, size):
    """Return inclusive bounds, rejecting malformed or unsatisfiable ranges."""
    if not header:
        return 0, size - 1
    match = re.fullmatch(r"bytes=(\d*)-(\d*)", header.strip())
    if not match or not any(match.groups()):
        raise ValueError("Invalid range")
    first, last = match.groups()
    if not first:
        suffix = int(last)
        if suffix <= 0:
            raise ValueError("Invalid suffix")
        return max(0, size - suffix), size - 1
    start = int(first)
    end = min(int(last), size - 1) if last else size - 1
    if start >= size or end < start:
        raise ValueError("Unsatisfiable range")
    return start, end


def serve_video(handler, head=False):
    """Stream bounded chunks, with HTTP Range for browser seeking/mobile playback."""
    try:
        blob = video_blob()
    except Exception:
        handler.send_json(503, {"error": "الفيديو غير متاح مؤقتاً. يرجى المحاولة مجدداً."})
        return
    size = blob.size
    # RFC 9110: Range is applied to GET, not HEAD.
    range_header = None if head else handler.headers.get("Range")
    try:
        start, end = byte_range(range_header, size)
    except ValueError:
        handler.send_response(416)
        handler.send_header("Content-Range", f"bytes */{size}")
        handler.send_header("Content-Length", "0")
        handler.end_headers()
        return
    reader = None
    try:
        first_chunk = b""
        remaining = end - start + 1
        if not head:
            reader = blob.open("rb", chunk_size=CHUNK_SIZE, timeout=30)
            reader.seek(start)
            first_chunk = reader.read(min(CHUNK_SIZE, remaining))
            if not first_chunk:
                raise OSError("Empty video")
    except Exception:
        if reader:
            reader.close()
        handler.send_json(503, {"error": "تعذّر تحميل الفيديو. يرجى المحاولة مجدداً."})
        return
    try:
        handler.send_response(206 if range_header else 200)
        handler.send_header("Content-Type", "video/mp4")
        handler.send_header("Content-Length", str(remaining))
        handler.send_header("Accept-Ranges", "bytes")
        handler.send_header("Cache-Control", "public, max-age=3600")
        handler.send_header("X-Content-Type-Options", "nosniff")
        if range_header:
            handler.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        handler.end_headers()
        if not head:
            chunk = first_chunk
            while chunk:
                handler.wfile.write(chunk)
                remaining -= len(chunk)
                if not remaining:
                    break
                chunk = reader.read(min(CHUNK_SIZE, remaining))
    except (BrokenPipeError, ConnectionResetError):
        pass  # Normal when a viewer seeks or leaves the page.
    except Exception:
        # Headers have already been sent: terminate, never append JSON to MP4.
        handler.close_connection = True
        print("Video stream interrupted.", flush=True)
    finally:
        if reader:
            reader.close()
