"""Test confirmed-success navigation with stubbed transport; no CRM writes."""

import json
import os
import time

from browser_form_check import CDP

browser = CDP()
browser.call("Runtime.enable")
browser.call("Page.enable")
browser.call("Page.bringToFront")
origin = "https://" + os.environ["REPLIT_DEV_DOMAIN"]


def open_form():
    browser.call("Page.navigate", {
        "url": origin + f"/?booking-check={time.time_ns()}#booking",
    })
    for _ in range(90):
        time.sleep(.5)
        if browser.evaluate("!!document.querySelector('mastery-booking-form')?.ready"):
            break
    else:
        raise AssertionError("Form did not load")
    browser.evaluate("""(() => {
      const host = document.querySelector('mastery-booking-form');
      window.fixtureHost = host;
      const picker = host.countryPicker;
      picker.open('');
      picker.choose(picker.filtered.findIndex(country => country.code === 'SA'));
      const values = {company:'Browser Fixture', fullName:'Test Person',
        phone:'+966501234567', email:'fixture@example.invalid',
        employees:'50-99', salespeople:'2', website:''};
      // Select a real supported employee bracket without relying on provider labels.
      values.employees = [...host.form.elements.employees.options].find(o => o.value).value;
      for (const [name, value] of Object.entries(values)) {
        host.form.elements[name].value = value;
        host.form.elements[name].dispatchEvent(new Event('input', {bubbles:true}));
      }
      if (!host.form.checkValidity()) throw Error('Fixture invalid');
    })()""")


open_form()
result = browser.evaluate("""(async () => {
  const host = window.fixtureHost, originalFetch = window.fetch;
  let calls = 0;
  let fixture;
  window.fetch = async (url, options) => {
    if (url !== '/api/booking') return originalFetch(url, options);
    calls++;
    if (fixture === 'network') throw new TypeError('Fixture network failure');
    return new Response(JSON.stringify(fixture.body), {
      status:fixture.status, headers:{'Content-Type':'application/json'}});
  };
  const failures = [
    {status:422, body:{error:'Validation fixture', fields:{email:'Review email'}}},
    {status:429, body:{error:'Rate limit fixture'}},
    {status:502, body:{error:'Provider fixture'}},
    {status:200, body:{ok:false, error:'Not confirmed'}},
    'network',
  ];
  for (fixture of failures) {
    host.form.requestSubmit();
    await new Promise(resolve => setTimeout(resolve, 120));
    if (location.pathname !== '/' || host.status.dataset.state !== 'error'
        || host.submitButton.disabled) throw Error('Failure must stay on editable form');
  }
  fixture = {status:409, body:{uncertain:true, error:'Uncertain fixture'}};
  host.form.requestSubmit();
  await new Promise(resolve => setTimeout(resolve, 120));
  if (location.pathname !== '/' || !host.submitButton.disabled
      || host.status.dataset.state !== 'error') throw Error('Uncertain result must not redirect');
  return {failureCases:failures.length, uncertainRemainsOnForm:true, stubbedCalls:calls};
})()""")
print(json.dumps(result))

open_form()
browser.evaluate("""(() => {
  const originalFetch = window.fetch;
  window.fetch = async (url, options) => url === '/api/booking'
    ? new Response(JSON.stringify({ok:true}), {
        status:200, headers:{'Content-Type':'application/json'}})
    : originalFetch(url, options);
  window.fixtureHost.form.requestSubmit();
})()""")
for _ in range(40):
    time.sleep(.25)
    if browser.evaluate("location.pathname === '/thank-you' && !!document.querySelector('[data-thank-you]')"):
        break
else:
    raise AssertionError("Confirmed submission did not navigate to thank-you page")

for width in (390, 768, 1440):
    browser.call("Emulation.setDeviceMetricsOverride", {
        "width": width, "height": 900, "deviceScaleFactor": 1, "mobile": width == 390,
    })
    result = browser.evaluate("""(() => ({
      title:document.querySelector('#thank-you-title')?.textContent,
      rtl:document.documentElement.dir,
      overflow:document.documentElement.scrollWidth > innerWidth,
      home:!!document.querySelector('a[href="/"]'),
      tracks:!!document.querySelector('a[href="/#tracks"]')
    }))()""")
    assert result["title"] and result["rtl"] == "rtl", result
    assert result["home"] and result["tracks"] and not result["overflow"], result
    print("Thank-you layout:", width, json.dumps(result, ensure_ascii=False))
browser.call("Page.reload")
time.sleep(1)
assert browser.evaluate("!!document.querySelector('[data-thank-you]')"), "Refresh failed"
browser.call("Emulation.setEmulatedMedia", {
    "features": [{"name": "prefers-reduced-motion", "value": "reduce"}],
})
browser.call("Page.reload")
time.sleep(1)
assert browser.evaluate("""[...document.getAnimations()].every(animation =>
  animation.playState !== 'running' || animation.effect.getTiming().duration <= 1
)"""), "Reduced-motion preference not respected"
assert not [event for event in browser.events if event.get("method") == "Runtime.exceptionThrown"]
print("Confirmed redirect, refresh, reduced motion, error isolation passed; CRM writes: 0")
browser.socket.close()
