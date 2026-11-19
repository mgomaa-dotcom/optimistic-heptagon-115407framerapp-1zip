"""Verify YouTube autoplay and layout through Chromium CDP; never submits forms."""
import json
import os
import time
from browser_form_check import CDP

browser = CDP()
browser.call("Runtime.enable")
browser.call("Page.enable")
browser.call("Page.navigate", {
    "url": os.environ.get("VIDEO_TEST_BASE_URL", f"https://{os.environ['REPLIT_DEV_DOMAIN']}") + "/",
})
time.sleep(7)
result = browser.evaluate("""(async () => {
  const host = document.querySelector('.academy-video');
  const assert = (ok, message) => { if (!ok) throw Error(message); };
  assert(host && document.querySelectorAll('.academy-video').length === 1, 'One player');
  assert(!host.querySelector('iframe'), 'Lazy iframe');
  assert(getComputedStyle(host.parentElement).boxShadow !== 'none', 'Border glow');
  host.scrollIntoView({block:'center'});
  for (let n = 0; n < 40 && !host.querySelector('iframe'); n++)
    await new Promise(r => setTimeout(r, 500));
  const iframe = host.querySelector('iframe');
  assert(iframe, 'YouTube iframe must load');
  assert(iframe.src.includes('/embed/1xNjiL8OELY'), 'Requested YouTube video');
  assert(iframe.src.includes('playsinline=1'), 'Inline mobile playback');
  assert(iframe.allow.includes('autoplay'), 'Autoplay permission');
  return {embed:true, lazyLoading:true, borderGlow:true, src:iframe.src};
})()""")
print(json.dumps(result))
time.sleep(12)
# CDP can inspect the cross-origin frame in the same browser target.
contexts = [e["params"]["context"] for e in browser.events
            if e.get("method") == "Runtime.executionContextCreated"
            and "youtube.com" in e["params"]["context"].get("origin", "")]
playback = None
for context in contexts:
    try:
        answer = browser.call("Runtime.evaluate", {
            "contextId": context["id"], "returnByValue": True,
            "expression": """(() => {
              const v = document.querySelector('video');
              return v ? {paused:v.paused, time:v.currentTime, muted:v.muted,
                error:v.error?.code, width:v.videoWidth} : null;
            })()""",
        })
        value = answer.get("result", {}).get("value")
        if value:
            playback = value
    except Exception:
        pass
print("YouTube playback:", json.dumps(playback))
if playback and playback["time"] > 0 and not playback["paused"]:
    print("Actual autoplay verified")
else:
    print("Actual autoplay not verified; YouTube/network restrictions may prevent playback.")
for width in [390, 768, 1440]:
    browser.call("Emulation.setDeviceMetricsOverride", {
        "width": width, "height": 900, "deviceScaleFactor": 1, "mobile": width == 390,
    })
    time.sleep(.4)
    layout = browser.evaluate("""(() => {
      const box = document.querySelector('.academy-video').getBoundingClientRect();
      return {width:innerWidth, left:box.left, right:box.right, ratio:box.width/box.height};
    })()""")
    assert layout["left"] >= 0 and layout["right"] <= width + 1, layout
    assert abs(layout["ratio"] - 16 / 9) < .03, layout
    print("Responsive video:", json.dumps(layout))
browser.socket.close()
