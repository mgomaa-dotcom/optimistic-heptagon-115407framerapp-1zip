"""Exercise homepage motion in Chromium CDP; never submits consultation data."""

import json
import os
import time

from browser_form_check import CDP


browser = CDP()
browser.call("Runtime.enable")
browser.call("Page.enable")
browser.call("Page.bringToFront")
browser.call("Emulation.setDeviceMetricsOverride", {
    "width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False,
})
browser.call("Page.navigate", {
    "url": "https://" + os.environ["REPLIT_DEV_DOMAIN"] + "/#sitemap",
})


def evaluate(expression):
    return browser.evaluate(expression)


def wait_for(expression, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if evaluate(expression):
            return
        time.sleep(.15)
    raise AssertionError(expression)


def enter_section(selector):
    evaluate("document.activeElement?.blur()")
    browser.call("Input.dispatchMouseEvent", {
        "type": "mouseMoved", "x": 1, "y": 1,
    })
    evaluate(f"document.querySelector({json.dumps(selector)}).scrollIntoView({{block:'center',behavior:'instant'}})")
    time.sleep(.4)


wait_for("document.querySelectorAll('[data-sitemap-controller]').length===1 && "
         "document.querySelectorAll('[data-track-controller]').length===1 && "
         "document.querySelectorAll('[data-method-card]').length===2")
time.sleep(2)  # Let Framer finish replacing the server-rendered sections.
assert evaluate("window.gsap.version") == "3.13.0"
assert evaluate("document.querySelectorAll('[data-sitemap-controller]').length") == 1
enter_section("[data-sitemap-controller]")
wait_for("document.querySelector('[data-sitemap-controller]').dataset.autoplay==='running'")
evaluate("document.querySelector('[data-sitemap-select=\"0\"]').click()")
wait_for("document.querySelector('[data-sitemap-controller]').dataset.activeIndex==='1'", 7)
assert evaluate("document.querySelector('#sitemap [data-sitemap-node=\"1\"]').dataset.active") == "true"
evaluate("document.querySelector('[data-sitemap-select=\"4\"]').click()")
wait_for("document.querySelector('[data-sitemap-controller]').dataset.activeIndex==='4'")
assert evaluate("!!document.querySelector('#sitemap a[href=\"#testimonials\"]')")

enter_section("[data-track-controller]")
wait_for("document.querySelector('[data-track-controller]').dataset.autoplay==='running'")
evaluate("document.querySelector('[data-track-select=\"0\"]').click()")
wait_for("document.querySelector('[data-track-controller]').dataset.activeIndex==='1'", 7)
wait_for("document.querySelector('[data-track-controller]').dataset.activeIndex==='2'", 7)
assert evaluate("document.querySelector('[data-track-select=\"2\"]').getAttribute('aria-pressed')") == "true"
assert evaluate("""document.querySelector('#tracks [data-ma-track-diagram-index="2"]')
    .closest('div[style*="cursor"]').style.border.includes('255, 101, 85')""")
evaluate("document.querySelector('[data-track-toggle]').click()")
paused_index = evaluate("document.querySelector('[data-track-controller]').dataset.activeIndex")
time.sleep(4.8)
assert evaluate("document.querySelector('[data-track-controller]').dataset.activeIndex") == paused_index
evaluate("document.querySelector('[data-track-toggle]').click()")
evaluate("document.querySelector('[data-track-select=\"1\"]').focus()")
assert evaluate("document.querySelector('[data-track-controller]').dataset.autoplay") == "paused"
evaluate("document.querySelector('[data-track-select=\"0\"]').click()")
evaluate("document.querySelector('#tracks [data-ma-track-diagram-index=\"2\"]').click()")
assert evaluate("document.querySelector('[data-track-controller]').dataset.activeIndex") == "2"
assert evaluate("document.querySelectorAll('[data-track-select]').length") == 3
assert evaluate("document.querySelectorAll('.ma-track-topic').length") == 6

enter_section("#method")
evaluate("document.querySelector('[data-method-tab=\"after\"]').click()")
wait_for("document.querySelector('#method').dataset.methodPhase==='after' && "
         "document.querySelector('#method').innerText.includes('قياس الأثر والنتائج')")
assert evaluate("document.querySelector('#method').innerText.includes('شهادات معتمدة')")
assert evaluate("[...document.querySelectorAll('[data-method-card]')].map(c=>c.dataset.methodStage).join(',')") == "04,05"
evaluate("document.querySelector('[data-method-tab=\"during\"]').click()")
wait_for("document.querySelector('#method').innerText.includes('التشخيص والتحليل')")
assert evaluate("document.querySelector('#method').innerText.includes('التمكين المعرفي')")
assert evaluate("document.querySelector('[data-method-journey]').getBoundingClientRect().width") > 900
assert evaluate("getComputedStyle(document.querySelector('[data-method-journey]')).gridTemplateColumns.split(' ').length") == 1

browser.call("Emulation.setEmulatedMedia", {
    "features": [{"name": "prefers-reduced-motion", "value": "reduce"}],
})
enter_section("[data-track-controller]")
assert evaluate("document.querySelector('[data-track-controller]').dataset.autoplay") == "paused"
reduced_index = evaluate("document.querySelector('[data-track-controller]').dataset.activeIndex")
time.sleep(4.8)
assert evaluate("document.querySelector('[data-track-controller]').dataset.activeIndex") == reduced_index

for width in (390, 768):
    browser.call("Emulation.setDeviceMetricsOverride", {
        "width": width, "height": 1100, "deviceScaleFactor": 1, "mobile": width == 390,
    })
    time.sleep(.8)
    assert evaluate("document.querySelectorAll('[data-sitemap-controller]').length") == 1
    assert evaluate("document.querySelectorAll('[data-track-controller]').length") == 1
    for selector in ("[data-sitemap-controller]", "[data-track-controller]", "#method"):
        enter_section(selector)
        box = evaluate(f"""(() => {{
          const r=document.querySelector({json.dumps(selector)}).getBoundingClientRect();
          return {{left:r.left,right:r.right,width:innerWidth}};
        }})()""")
        assert box["left"] >= -1 and box["right"] <= box["width"] + 1, (selector, box)
    if width == 390:
        evaluate("document.querySelector('[data-sitemap-select=\"3\"]').click()")
        wait_for("document.querySelector('#sitemap .mt-row[aria-label=\"لماذا ماستري\"]').getAttribute('aria-expanded')==='true'")
        assert evaluate("document.querySelector('[data-sitemap-controller]').dataset.autoplay") == "paused"

errors = [event for event in browser.events if event.get("method") == "Runtime.exceptionThrown"]
assert not errors, errors
browser.call("Page.navigate", {
    "url": "https://" + os.environ["REPLIT_DEV_DOMAIN"] + "/#method",
})
time.sleep(3)
anchor_top = evaluate("document.querySelector('#method').getBoundingClientRect().top")
assert 60 <= anchor_top <= 100, anchor_top
print(json.dumps({
    "gsap": "3.13.0", "hydrationSafe": True,
    "sitemapAutoplayAndManualNavigation": True,
    "threeTrackCycleAndOriginalDiagramSync": True,
    "pauseAndFocusHandling": True, "bothMethodologyPhases": True,
    "reducedMotion": True, "mobileAndTabletNoOverflow": True,
    "directSectionLinkAfterHydration": True,
    "crmWrites": 0,
}))
