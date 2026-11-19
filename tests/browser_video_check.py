"""Check real storage-backed playback without submitting the consultation form.

Start Chromium on debug port 9222, then run this script from the project root.
"""

import json
import os
import time

from browser_form_check import CDP


browser = CDP()
browser.call("Runtime.enable")
browser.call("Page.enable")
browser.call("Network.enable")
browser.call("Network.setCacheDisabled", {"cacheDisabled": True})
browser.call("Page.bringToFront")
browser.call("Page.navigate", {
    "url": os.environ.get("VIDEO_TEST_BASE_URL", f"https://{os.environ['REPLIT_DEV_DOMAIN']}") + "/",
})
time.sleep(7)
result = browser.evaluate("""(async () => {
  const video = document.querySelector('video.academy-video');
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  assert(video && document.querySelectorAll('video.academy-video').length === 1,
    'One player must survive hydration');
  assert(video.controls && video.playsInline && video.muted, 'Muted inline playback controls');
  assert(video.preload === 'none' && video.readyState === 0, 'No eager video download');
  assert(video.parentElement.parentElement.nextElementSibling.id === 'numbers',
    'Video should precede statistics');
  const poster = new Image();
  poster.src = video.poster;
  await poster.decode();
  assert(poster.naturalWidth > 0, 'Poster must load');
  assert(getComputedStyle(video.parentElement).boxShadow !== 'none', 'Border glow');
  video.scrollIntoView({block: 'center'});
  for (let attempt = 0; attempt < 60 && (video.paused || video.currentTime === 0); attempt++) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert(video.videoWidth > 0 && video.currentTime > 0 && !video.paused,
    'Automatic playback when entering section');
  window.scrollTo(0, 0);
  await new Promise(resolve => setTimeout(resolve, 600));
  assert(video.paused, 'Pause when leaving section');
  video.scrollIntoView({block: 'center'});
  await new Promise(resolve => setTimeout(resolve, 1000));
  assert(!video.paused, 'Resume on return');
  const duration = video.duration;
  video.currentTime = Math.min(20, duration / 2);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Seeking timed out')), 20000);
    video.addEventListener('seeked', () => { clearTimeout(timer); resolve(); }, {once:true});
  });
  assert(video.currentTime >= Math.min(19, duration / 2), 'Range seeking');
  video.pause();
  await new Promise(resolve => setTimeout(resolve, 200));
  window.scrollTo(0, 0);
  await new Promise(resolve => setTimeout(resolve, 400));
  video.scrollIntoView({block: 'center'});
  await new Promise(resolve => setTimeout(resolve, 600));
  assert(video.paused, 'Respect manual pause after reentry');
  assert(!video.error, 'No media error');
  return {onePlayerAfterHydration:true, controls:true, viewportAutoplay:true,
    offscreenPause:true, resumeOnReturn:true, manualPauseRespected:true, borderGlow:true,
    lazyLoading:true, poster:true, actualPlayback:true, seeking:true,
    duration, videoWidth:video.videoWidth, videoHeight:video.videoHeight};
})()""")
print(json.dumps(result))
for width in [390, 768, 1440]:
    browser.call("Emulation.setDeviceMetricsOverride", {
        "width": width, "height": 900, "deviceScaleFactor": 1, "mobile": width == 390,
    })
    time.sleep(.3)
    layout = browser.evaluate("""(() => {
      const box = document.querySelector('.academy-video').getBoundingClientRect();
      return {width:innerWidth, left:box.left, right:box.right,
        ratio:box.width/box.height};
    })()""")
    assert layout["left"] >= 0 and layout["right"] <= width + 1, layout
    assert abs(layout["ratio"] - 16 / 9) < .03, layout
    print("Responsive video:", json.dumps(layout))
errors = [event for event in browser.events if event.get("method") == "Runtime.exceptionThrown"]
assert not errors, errors
responses = [
    event["params"]["response"] for event in browser.events
    if event.get("method") == "Network.responseReceived"
    and "/media/academy-introduction.mp4" in event["params"]["response"]["url"]
]
assert responses, "No media responses recorded"
for response in responses:
    headers = {key.lower(): value for key, value in response["headers"].items()}
    assert response["status"] == 206, response
    assert int(headers["content-length"]) <= 8 * 1024 * 1024, headers
print("Playback/seek responses:", len(responses), "all partial and at most 8 MiB")
browser.socket.close()
