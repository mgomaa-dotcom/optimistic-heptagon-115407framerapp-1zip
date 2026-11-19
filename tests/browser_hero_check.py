"""Sample the hero from first paint through hydration and reload on small screens.

Run with Chromium's CDP endpoint on port 9222. No form/CRM writes.
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
window.heroSamples = [];
function sampleHero() {
  const hero = document.querySelector('.framer-1clr2fg');
  if (hero) {
    const s = getComputedStyle(hero), r = hero.getBoundingClientRect();
    const p = getComputedStyle(hero.parentElement);
    const dashboard = document.querySelector(
      '.framer-1cu329x .framer-5s59wc-container > div > div');
    heroSamples.push({
      opacity: +s.opacity, transform: s.transform,
      width: r.width, height: r.height, left: r.left, right: r.right,
      parentTransform: p.transform,
      dashboardTransform: dashboard && getComputedStyle(dashboard).transform,
      replacement: getComputedStyle(hero.querySelector('img')).content
    });
  }
  if (performance.now() < 4000) requestAnimationFrame(sampleHero);
}
requestAnimationFrame(sampleHero);
"""})
base = "https://" + os.environ["REPLIT_DEV_DOMAIN"]
for width in [320, 390, 768, 1440]:
    browser.call("Emulation.setDeviceMetricsOverride", {
        "width": width, "height": 844, "deviceScaleFactor": 1, "mobile": width < 810,
    })
    for reload in [False, True] if width == 390 else [False]:
        if reload:
            browser.call("Page.reload", {"ignoreCache": True})
        else:
            browser.call("Page.navigate", {"url": base + "/"})
        time.sleep(5)
        samples = browser.evaluate("heroSamples")
        assert len(samples) > 10, len(samples)
        assert all(s["opacity"] == 1 and s["transform"] == "none" for s in samples), samples
        widths = [s["width"] for s in samples]
        assert max(widths) - min(widths) < 1, (min(widths), max(widths))
        assert all("hero-sales-team.webp" in s["replacement"] for s in samples)
        dashboard_transforms = {s["dashboardTransform"] for s in samples
                                if s["dashboardTransform"]}
        assert dashboard_transforms == {
            "matrix(0.377273, 0, 0, 0.377273, -500, -330)"
        }, dashboard_transforms
        if width < 810:
            assert all(s["left"] >= -1 and s["right"] <= width + 1 for s in samples), samples
        print(json.dumps({"width": width, "reload": reload, "samples": len(samples),
                          "imageWidth": widths[-1], "noOpacityReset": True,
                          "noResizeFlash": True, "dashboardScale": next(iter(dashboard_transforms))}))
motion = browser.evaluate("""(() => {
  const cards = ['1dvqzfw','1t8c3mm','1i97owk','1wnd895'];
  return cards.map(c => {
    const s = getComputedStyle(document.querySelector('.framer-'+c));
    return {duration:parseFloat(s.animationDuration), name:s.animationName};
  });
})()""")
assert all(s["duration"] >= 7 and s["name"] == "hero-card-float" for s in motion), motion
browser.call("Emulation.setEmulatedMedia", {
    "features": [{"name": "prefers-reduced-motion", "value": "reduce"}],
})
time.sleep(.2)
assert browser.evaluate("""[...document.querySelectorAll(
  '.framer-1346mgz [data-framer-appear-id]')].every(e =>
  getComputedStyle(e).animationName === 'none' &&
  getComputedStyle(e).transform === 'none')""")
print("Slow hero motion and reduced-motion checks passed.")
browser.socket.close()
