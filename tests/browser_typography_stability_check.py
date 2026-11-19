"""Sample real painted frames through hydration; never write to CRM.

Requires the app workflow and Chromium debug port 9222, as other browser checks.
"""
import json
import os
import time

from browser_form_check import CDP


browser = CDP()
browser.call("Page.enable")
browser.call("Runtime.enable")
browser.call("Network.enable")
browser.call("Network.setCacheDisabled", {"cacheDisabled": True})
browser.call("Page.addScriptToEvaluateOnNewDocument", {"source": """
window.__maPaintSamples = [];
const started = performance.now();
let seenHeading = false;
function sample() {
  const hero = document.querySelector('.framer-9nhah2');
  const heading = hero?.querySelector('h1');
  const numbers = document.querySelector('#numbers');
  const tracks = document.querySelector('#tracks');
  const ready = tracks?.querySelector('.ma-service-tile') &&
    numbers?.querySelector('.ma-number-stage');
  if (!heading && seenHeading) window.__maPaintSamples.push({missingHeading: true});
  if (heading) {
    seenHeading = true;
    const rect = heading.getBoundingClientRect();
    const style = getComputedStyle(heading);
    const sample = {
      text: heading.textContent,
      font: style.fontFamily,
      headingHeight: rect.height,
      headingY: rect.y + scrollY,
      heroHeight: hero.getBoundingClientRect().height,
      ready: Boolean(ready),
    };
    if (ready) {
      sample.numbersHeight = numbers.getBoundingClientRect().height;
      sample.tracksHeight = tracks.getBoundingClientRect().height;
      sample.visibleNumberHeadings = [...numbers.querySelectorAll('h2')]
        .filter(node => node.getBoundingClientRect().height > 0).length;
      sample.metrics = numbers.querySelectorAll('.ma-number-value').length;
    }
    window.__maPaintSamples.push(sample);
  }
  if (performance.now() - started < 6500) requestAnimationFrame(sample);
}
requestAnimationFrame(sample);
"""})

for width in [320, 390, 768, 1440]:
    browser.call("Emulation.setEmulatedMedia", {"features": []})
    browser.call("Emulation.setDeviceMetricsOverride", {
        "width": width, "height": 1000, "deviceScaleFactor": 1, "mobile": width < 810,
    })
    browser.call("Page.navigate", {"url": "https://" + os.environ["REPLIT_DEV_DOMAIN"] + "/"})
    time.sleep(8)
    samples = browser.evaluate("window.__maPaintSamples")
    assert samples and len(samples) > 10, (width, "No painted frames")
    assert not any(s.get("missingHeading") for s in samples), (width, "Heading disappeared during hydration")
    expected = "من استراتيجيات الإقناع والتفاوض الي اغلاق الصفقات و كسب ولاء العملاء"
    assert all(s["text"] == expected for s in samples), (width, "Reverted hero text")
    assert all("Mastery Arabic" in s["font"] for s in samples), (width, "Font changed")
    enhanced = [s for s in samples if s["ready"]]
    assert enhanced, (width, "Enhancements missing")
    spreads = {}
    for field in ["headingHeight", "headingY", "heroHeight", "numbersHeight", "tracksHeight"]:
        values = [s[field] for s in enhanced]
        spreads[field] = round(max(values) - min(values), 2)
        assert spreads[field] < 2, (width, field, spreads[field], enhanced[0], enhanced[-1])
    assert all(s["visibleNumberHeadings"] == 1 for s in enhanced), (
        width, "Statistics heading disappeared or duplicated")
    assert all(s["metrics"] == 3 for s in enhanced), (width, "Metric disappeared during hydration")
    result = browser.evaluate("""(async () => {
      const assert = (ok, message) => { if (!ok) throw Error(message); };
      const wait = ms => new Promise(r => setTimeout(r, ms));
      assert(document.fonts.check('400 20px "Mastery Arabic"', 'ماستري'), 'Arabic regular face');
      assert(document.fonts.check('600 20px "Mastery Arabic"', 'ماستري'), 'Arabic semibold face');
      const form = document.querySelector('mastery-booking-form') ||
        [...document.querySelectorAll('*')].find(el => el.shadowRoot?.querySelector('.consultation-form'));
      if (form) assert(getComputedStyle(form.shadowRoot.querySelector('input')).fontFamily.includes('Mastery Arabic'),
        'Booking typography');
      const section = document.querySelector('#tracks');
      const service = section.querySelector('.ma-service-tile');
      const diagram = service.parentElement;
      const peers = [...diagram.children].filter(el => el !== service &&
        el.tagName === 'DIV' && Math.abs(parseFloat(getComputedStyle(el).width) - 104) < 1 &&
        Math.abs(parseFloat(getComputedStyle(el).height) - 104) < 1);
      assert(peers.length === 3, 'Three existing icon tiles');
      const actual = getComputedStyle(service);
      // The original paths rotate their active highlight. Compare an inactive
      // tile, not whichever tile happens to be mid-transition at this instant.
      const inactive = peers.find(el => getComputedStyle(el).borderTopColor === actual.borderTopColor);
      assert(inactive, 'Matching inactive tile');
      const original = getComputedStyle(inactive);
      for (const key of ['width','height','borderRadius','borderTopColor','borderTopWidth','backgroundColor','padding'])
        assert(actual[key] === original[key], 'Tile style mismatch: '+key+' '+actual[key]+' vs '+original[key]);
      assert(section.querySelectorAll('.ma-service-branch-path').length === 1, 'Single connector');
      assert(section.querySelector('.ma-service-branch-path').getAttribute('d') ===
        'M314 212 L314 436 L240 436', 'Orthogonal Mastery connector');
      const icon = service.querySelector('.ma-service-icon');
      const toggle = section.querySelector('[data-ma-track-motion-button]');
      section.scrollIntoView({block:'center',behavior:'instant'});
      await wait(400);
      assert(getComputedStyle(icon).animationPlayState === 'running', 'Visible icon should animate');
      const first = getComputedStyle(icon).transform;
      await wait(450);
      assert(getComputedStyle(icon).transform !== first, 'Icon must visibly move');
      toggle.click();
      await wait(100);
      assert(getComputedStyle(icon).animationPlayState === 'paused', 'Pause icon');
      const paused = getComputedStyle(icon).transform;
      await wait(300);
      assert(getComputedStyle(icon).transform === paused, 'Paused icon must stay still');
      toggle.click();
      window.scrollTo({top:0,behavior:'instant'});
      await wait(300);
      assert(getComputedStyle(icon).animationPlayState === 'paused', 'Offscreen icon pauses');
      assert(document.documentElement.scrollWidth <= innerWidth + 1, 'No horizontal overflow');
      return {matchingTiles: true, stableCopy: true, iconMotion: true, pause: true};
    })()""")
    browser.call("Emulation.setEmulatedMedia", {
        "features": [{"name": "prefers-reduced-motion", "value": "reduce"}],
    })
    time.sleep(.1)
    assert browser.evaluate(
        "getComputedStyle(document.querySelector('.ma-service-icon')).animationName === 'none'"
    ), (width, "Reduced motion")
    print(json.dumps({"width": width, "frames": len(samples), "sizeChanges": spreads, **result}))
