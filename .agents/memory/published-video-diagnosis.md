---
name: Published video diagnosis
description: Why small storage probes can falsely suggest that production video playback works.
---

Compare the browser's actual Range request with any successful diagnostic probes before attributing published video failures to intermittent storage errors.

**Why:** Production returned HTTP 200 for HEAD and 206 for tiny ranges, but Chromium failed to load the same video. Reproducing its open-ended `Range: bytes=0-` request returned an empty HTTP 500 from the hosting frontend, while preview playback worked. Streaming in bounded memory did not prevent the origin's HTTP response from being oversized.

**How to apply:** Test response headers and actual browser playback/seek behavior, not just storage metadata or a single-byte fetch. Bound diagnostic downloads so investigating a large video does not transfer the whole object. Do not assume a codec or identity problem when only large responses fail.
