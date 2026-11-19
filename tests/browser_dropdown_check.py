"""Check booking dropdown placement and selection without submitting any form."""
import json
import os
import time
from browser_form_check import CDP

browser = CDP()
browser.call("Runtime.enable")
browser.call("Page.enable")
browser.call("Page.navigate", {"url": "https://" + os.environ["REPLIT_DEV_DOMAIN"] + "/#booking"})
for _ in range(100):
    time.sleep(.3)
    if browser.evaluate("Boolean(document.querySelector('mastery-booking-form')?.ready)"):
        break
else:
    raise AssertionError("Booking options did not load")
time.sleep(3)  # Let Framer finish its initial responsive hydration.

for width in [320, 390, 768, 1440]:
    browser.call("Emulation.setDeviceMetricsOverride", {
        "width": width, "height": 844, "deviceScaleFactor": 1, "mobile": width < 810,
    })
    result = browser.evaluate("""(async () => {
      const host = document.querySelector('mastery-booking-form');
      const employee = host.employeePicker, country = host.countryPicker;
      const wait = () => new Promise(r => setTimeout(r, 160));
      const assert = (ok, msg) => { if (!ok) throw Error(msg); };
      function check(anchor, menu) {
        const a = anchor.getBoundingClientRect(), m = menu.getBoundingClientRect();
        assert(menu.matches(':popover-open'), 'Menu must be in top layer: ' +
          JSON.stringify({id:menu.id, hidden:menu.hidden, anchor:a.toJSON(), menu:m.toJSON()}));
        assert(m.left >= 11 && m.right <= innerWidth - 11, 'Horizontal safe area');
        assert(m.top >= 11 && m.bottom <= innerHeight - 11, 'Vertical safe area: ' +
          JSON.stringify({a:a.toJSON(),m:m.toJSON(),height:innerHeight,
            viewport:{top:visualViewport.offsetTop,height:visualViewport.height},
            style:menu.getAttribute('style')}));
        assert(m.bottom <= a.top - 4 || m.top >= a.bottom + 4, 'Menu overlaps its input');
        assert(Math.abs(m.width - Math.min(a.width, innerWidth - 24)) < 2, 'Width alignment');
        return {placement:menu.dataset.placement, gap:Math.round(
          menu.dataset.placement === 'top' ? a.top - m.bottom : m.top - a.bottom)};
      }
      const placements = [];
      employee.trigger.scrollIntoView({block:'center',behavior:'instant'});
      await wait();
      employee.trigger.focus({preventScroll:true});
      employee.trigger.click();
      placements.push(check(employee.trigger, employee.menu));
      employee.trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));
      employee.trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      assert(host.form.elements.employees.value === host.employees[0].value, 'Keyboard employee selection');
      assert(employee.menu.hidden, 'Close on selection');
      const label = employee.trigger.textContent;
      assert(label === host.form.elements.employees.selectedOptions[0].textContent, 'Visible selected label');
      // Position the trigger near the bottom; the menu should flip above it.
      const rect = employee.trigger.getBoundingClientRect();
      window.scrollBy({top:rect.bottom - (innerHeight - 20),behavior:'instant'});
      await wait();
      employee.trigger.click();
      placements.push(check(employee.trigger, employee.menu));
      assert(employee.menu.dataset.placement === 'top', 'Bottom-edge menu must open upward');
      employee.trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
      assert(employee.menu.hidden, 'Escape closes employee menu');
      country.input.scrollIntoView({block:'center',behavior:'instant'});
      await wait();
      country.input.focus({preventScroll:true});
      country.open('');
      placements.push(check(country.input, country.menu));
      assert(country.filtered[0].code === 'SA', 'Saudi first');
      country.choose(0);
      assert(host.form.elements.country.value === 'SA', 'Country selection');
      employee.trigger.scrollIntoView({block:'center',behavior:'instant'});
      await wait();
      employee.open();
      employee.menu.children[1].click();
      assert(host.form.elements.employees.value === host.employees[1].value, 'Pointer employee selection');
      employee.open();
      document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,composed:true}));
      assert(employee.menu.hidden, 'Outside press closes menu');
      return {width:innerWidth, placements, employeeKeyboard:true,
        employeePointer:true, countrySelection:true, outsideClose:true};
    })()""")
    print(json.dumps(result))
browser.socket.close()
