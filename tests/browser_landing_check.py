"""Landing page structure, layout and motion check (hand-written page, README copy).

Start Chromium with --headless --remote-debugging-port=9222 first.
Base URL: LANDING_TEST_BASE_URL, else https://$REPLIT_DEV_DOMAIN. Never submits the form.
"""
import json
import os
import time
from browser_form_check import CDP

SECTIONS = ["hero", "clients", "problem", "video", "how", "tracks", "ai", "reports",
            "success", "trainers", "pricing", "faq", "booking"]
base = os.environ.get("LANDING_TEST_BASE_URL") or "https://" + os.environ["REPLIT_DEV_DOMAIN"]

SCROLL_THROUGH = """(async () => {
  const step = Math.round(innerHeight * 0.6);
  for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
    scrollTo(0, y); await new Promise(r => setTimeout(r, 120));
  }
  await new Promise(r => setTimeout(r, 1500));
  scrollTo(0, 0);
  return true;
})()"""

STATE = """(() => ({
  ids: [...document.querySelectorAll('main > section[id]')].map(s => s.id),
  hidden: [...document.querySelectorAll('[data-reveal], [data-hero]')]
    .filter(e => parseFloat(getComputedStyle(e).opacity) < 0.95).length,
  scrollWidth: document.documentElement.scrollWidth,
  innerWidth,
  forms: document.querySelectorAll('mastery-booking-form').length,
  formInSlot: !!document.querySelector('#booking [data-booking-slot] mastery-booking-form'),
  placeholders: document.querySelectorAll('mark.ph').length,
  framerRuntime: !!document.querySelector('script[data-framer-bundle]'),
  navTargets: [...document.querySelectorAll('.nav__links a[href^="#"]')]
    .every(a => document.querySelector(a.getAttribute('href'))),
  motionReady: document.documentElement.classList.contains('motion-ready'),
}))()"""

browser = CDP()
browser.call("Page.enable")
browser.call("Runtime.enable")
for width, reduced in [(320, False), (390, False), (768, False), (1440, False), (390, True)]:
    browser.call("Emulation.setEmulatedMedia", {
        "features": [{"name": "prefers-reduced-motion", "value": "reduce" if reduced else "no-preference"}],
    })
    browser.call("Emulation.setDeviceMetricsOverride", {
        "width": width, "height": 844, "deviceScaleFactor": 1, "mobile": width < 810,
    })
    browser.call("Page.navigate", {"url": base + "/"})
    time.sleep(3)
    browser.evaluate(SCROLL_THROUGH)
    state = browser.evaluate(STATE)
    assert state["ids"] == SECTIONS, state["ids"]
    assert state["hidden"] == 0, f"{state['hidden']} elements still hidden at {width}px"
    assert state["scrollWidth"] <= state["innerWidth"], (width, state["scrollWidth"])
    assert state["forms"] == 1 and state["formInSlot"], state
    assert state["placeholders"] > 0, "placeholder marks missing"
    assert not state["framerRuntime"], "Framer runtime should not load"
    assert state["navTargets"], "nav link without a target section"
    assert state["motionReady"] == (not reduced), state
    print(json.dumps({"width": width, "reducedMotion": reduced, **state}, ensure_ascii=False))

# Interactions at desktop width.
browser.call("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-reduced-motion", "value": "no-preference"}]})
browser.call("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 900, "deviceScaleFactor": 1, "mobile": False})
browser.call("Page.navigate", {"url": base + "/"})
time.sleep(3)
result = browser.evaluate("""(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const assert = (c, label) => { if (!c) throw Error(label); };
  const btn = document.querySelectorAll('.acc__btn')[1];
  const panel = document.getElementById(btn.getAttribute('aria-controls'));
  assert(panel.hidden, 'second FAQ starts closed');
  btn.click(); await wait(900);
  assert(btn.getAttribute('aria-expanded') === 'true' && !panel.hidden && panel.offsetHeight > 40, 'FAQ opens');
  btn.click(); await wait(900);
  assert(panel.hidden, 'FAQ closes');
  [...document.querySelectorAll('[data-dim="sector"] .chip')].find(c => c.textContent === 'عقار').click();
  await wait(300);
  assert(document.querySelector('[data-builder-summary]').textContent.includes('عقار'), 'builder summary updates');
  const matrix = document.querySelector('[data-matrix]');
  assert(matrix.hidden, 'feature matrix starts collapsed');
  document.querySelector('[data-matrix-toggle]').click(); await wait(1200);
  assert(!matrix.hidden && matrix.offsetHeight > 400, 'feature matrix expands');
  return true;
})()""")
assert result
print("Landing structure, layout, reduced-motion and interaction checks passed.")
browser.socket.close()
