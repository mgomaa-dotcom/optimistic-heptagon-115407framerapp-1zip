"""Browser regression check using Chromium's built-in debugging protocol.

Start Chromium with --headless --remote-debugging-port=9222 first.
Only the submission response is stubbed: this check never creates live CRM records.
"""

import base64
import json
import os
import socket
import struct
import time
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


class CDP:
    def __init__(self):
        with urlopen(Request("http://127.0.0.1:9222/json/new?about:blank", method="PUT")) as response:
            page = json.load(response)
        url = urlsplit(page["webSocketDebuggerUrl"])
        self.socket = socket.create_connection((url.hostname, url.port), timeout=60)
        key = base64.b64encode(os.urandom(16)).decode()
        self.socket.sendall((
            f"GET {url.path} HTTP/1.1\r\nHost: {url.netloc}\r\n"
            f"Upgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\nOrigin: http://127.0.0.1:9222\r\n\r\n"
        ).encode())
        header = b""
        while not header.endswith(b"\r\n\r\n"):
            header += self.socket.recv(1)
        assert header.split(b"\r\n", 1)[0].split()[1] == b"101", header
        self.counter = 0
        self.events = []

    def read(self, size):
        chunks = b""
        while len(chunks) < size:
            chunk = self.socket.recv(size - len(chunks))
            if not chunk:
                raise RuntimeError("Browser disconnected")
            chunks += chunk
        return chunks

    def receive(self):
        first, second = self.read(2)
        length = second & 127
        if length == 126:
            length = struct.unpack("!H", self.read(2))[0]
        elif length == 127:
            length = struct.unpack("!Q", self.read(8))[0]
        mask = self.read(4) if second & 128 else None
        payload = self.read(length)
        if mask:
            payload = bytes(value ^ mask[index % 4] for index, value in enumerate(payload))
        if first & 15 == 8:
            raise RuntimeError("Browser socket closed")
        return json.loads(payload)

    def call(self, method, params=None):
        self.counter += 1
        message = json.dumps({"id": self.counter, "method": method, "params": params or {}}).encode()
        mask = os.urandom(4)
        length = len(message)
        header = b"\x81" + (
            bytes([128 | length]) if length < 126 else
            b"\xfe" + struct.pack("!H", length) if length < 65536 else
            b"\xff" + struct.pack("!Q", length)
        )
        self.socket.sendall(header + mask + bytes(
            value ^ mask[index % 4] for index, value in enumerate(message)
        ))
        while True:
            result = self.receive()
            if result.get("id") == self.counter:
                if "error" in result:
                    raise RuntimeError(result["error"])
                return result.get("result")
            self.events.append(result)

    def evaluate(self, expression):
        result = self.call("Runtime.evaluate", {
            "expression": expression, "awaitPromise": True, "returnByValue": True,
        })
        if result.get("exceptionDetails"):
            raise AssertionError(result["exceptionDetails"])
        return result.get("result", {}).get("value")


if __name__ == "__main__":
    browser = CDP()
    browser.call("Runtime.enable")
    browser.call("Page.enable")
    browser.call("Page.bringToFront")
    browser.call("Emulation.setDeviceMetricsOverride", {
        "width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True,
    })
    browser.call("Page.navigate", {"url": "https://" + os.environ["REPLIT_DEV_DOMAIN"] + "/#booking"})
    for _ in range(60):
        time.sleep(.5)
        if browser.evaluate("!!document.querySelector('mastery-booking-form')?.ready"):
            break
    else:
        raise AssertionError("Form options did not load")
    result = browser.evaluate("""(async () => {
      const host = document.querySelector('mastery-booking-form');
      const form = host.form, root = host.shadowRoot;
      const assert = (condition, label) => { if (!condition) throw Error(label); };
      assert(root.querySelectorAll('.form-field').length === 8, 'field grouping missing');
      assert(getComputedStyle(form).gridTemplateColumns.split(' ').length === 1, 'phone layout must use one column');
      assert(document.querySelectorAll('mastery-booking-form').length === 1, 'duplicate form');
      assert(getComputedStyle(document.querySelector('form[data-framer-name="Booking Form"]')).display === 'none', 'old form visible');
      assert(host.countryPicker.countries.length > 250, 'country pagination incomplete');
      assert(host.countryPicker.countries[0].code === 'SA', 'Saudi Arabia must be first');
      assert(host.countryPicker.countries[0].flag.includes('🇸🇦'), 'country flag missing');
      assert(!form.elements.website.required, 'website must be optional');
      for (const name of ['company','fullName','phone','email','employees','salespeople','countrySearch'])
        assert(form.elements[name].required, name + ' must be required');
      assert(!form.checkValidity(), 'empty form must be invalid');
      const nameField = form.elements.fullName;
      nameField.value = 'John';
      nameField.dispatchEvent(new Event('input', {bubbles:true}));
      assert(!nameField.checkValidity(), 'single-word name must be rejected');
      nameField.value = 'John 123';
      nameField.dispatchEvent(new Event('input', {bubbles:true}));
      assert(!nameField.checkValidity(), 'number must not count as a second name');
      const picker = host.countryPicker;
      picker.input.focus();
      assert(!picker.menu.hidden && picker.menu.children[0].textContent.includes('Saudi Arabia'), 'Saudi first when opening');
      picker.input.value = 'Canada';
      picker.input.dispatchEvent(new Event('input', {bubbles:true}));
      assert(picker.filtered.length === 1 && picker.filtered[0].code === 'CA', 'English search failed');
      picker.input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
      assert(picker.input.hasAttribute('aria-activedescendant'), 'keyboard option missing');
      picker.input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      assert(form.elements.country.value === 'CA' && picker.menu.hidden, 'keyboard selection failed');
      picker.input.value = 'not-a-real-country';
      picker.input.dispatchEvent(new Event('input', {bubbles:true}));
      assert(!picker.input.checkValidity() && form.elements.country.value === '', 'unlisted country accepted');
      assert(picker.menu.textContent.includes('لا توجد'), 'empty state missing');
      picker.input.value = 'السعودية';
      picker.input.dispatchEvent(new Event('input', {bubbles:true}));
      assert(picker.filtered.some(c => c.code === 'SA'), 'Arabic search failed');
      const sa = picker.filtered.findIndex(c => c.code === 'SA');
      picker.menu.children[sa].dispatchEvent(new MouseEvent('click',{bubbles:true}));
      assert(form.elements.country.value === 'SA' && picker.input.checkValidity(), 'pointer country selection failed');
      const data = {company:'Browser Fixture',fullName:'Test Person',
        phone:'+966501234567',email:'fixture@example.invalid',
        employees:host.employees[0].value,salespeople:'2',website:''};
      for (const [name,value] of Object.entries(data)) {
        form.elements[name].value = value;
        form.elements[name].dispatchEvent(new Event('input',{bubbles:true}));
      }
      assert(form.checkValidity(), 'valid input and optional website rejected');
      form.elements.salespeople.value = '-1';
      assert(!form.checkValidity(), 'negative sales count accepted');
      form.elements.salespeople.value = '2';
      for (const [name,value,expected] of [
        ['phone','+٩٦٦٥٠١٢٣٤٥٦٧','+966501234567'],
        ['salespeople','۲','2']
      ]) {
        form.elements[name].value = value;
        form.elements[name].dispatchEvent(new Event('input',{bubbles:true}));
        assert(form.elements[name].value === expected, 'digits not normalized for '+name);
        assert(getComputedStyle(form.elements[name]).fontFamily.startsWith('Arial'), 'numeric font is not English');
      }
      assert(form.checkValidity(), 'normalized values rejected');
      const originalFetch = window.fetch;
      const submissions = [];
      let mode = 'error';
      window.fetch = async (url, options) => {
        if (url === '/api/booking') {
          submissions.push(JSON.parse(options.body));
          await new Promise(resolve => setTimeout(resolve, 60));
          return new Response(JSON.stringify(mode === 'error' ?
            {error:'Test service rejection'} : {ok:true}),
            {status: mode === 'error' ? 502 : 200,headers:{'Content-Type':'application/json'}});
        }
        return originalFetch(url, options);
      };
      form.requestSubmit();
      form.requestSubmit();
      await new Promise(resolve => setTimeout(resolve, 180));
      assert(submissions.length === 1, 'duplicate submission not blocked');
      assert(host.status.textContent === 'Test service rejection', 'error message missing');
      assert(!host.submitButton.disabled, 'retry unavailable');
      assert(form.elements.company.value === 'Browser Fixture', 'input lost on error');
      mode = 'success';
      form.requestSubmit();
      await new Promise(resolve => setTimeout(resolve, 180));
      assert(submissions.length === 2, 'retry not sent');
      assert(submissions[1].website === '', 'optional website altered');
      assert(submissions[1].fullName === 'Test Person', 'full name payload missing');
      assert(submissions[1].country === 'SA', 'country code payload missing');
      assert(!('countrySearch' in submissions[1]), 'search query leaked into payload');
      assert(host.status.dataset.state === 'success', 'success state missing');
      assert(host.submitButton.disabled, 'successful request can be resent');
      assert(host.getBoundingClientRect().width <= innerWidth, 'mobile form overflow');
      window.fetch = originalFetch;
      return {countries:picker.countries.length,requiredFields:7,
        fullNameValidation:true,englishDigits:true,saudiFirst:true,
        countrySearchEnglishAndArabic:true,keyboardAndPointerSelection:true,
        validation:true,errorAndRetry:true,success:true,doubleSubmitProtection:true,
        mobileWidth:host.getBoundingClientRect().width,submissionTransport:'stubbed; no CRM writes'};
    })()""")
    print(json.dumps(result, ensure_ascii=False))
    for width in (768, 1024, 1440):
        browser.call("Emulation.setDeviceMetricsOverride", {
            "width": width, "height": 1000, "deviceScaleFactor": 1, "mobile": False,
        })
        time.sleep(.3)
        layout = browser.evaluate("""(() => {
          const host = document.querySelector('mastery-booking-form'), form = host.form;
          const fields = [...host.shadowRoot.querySelectorAll('.form-field')];
          const box = host.getBoundingClientRect();
          return {width: innerWidth, formWidth:box.width, height:form.getBoundingClientRect().height,
            parentWidth:host.parentElement.getBoundingClientRect().width,
            columns:getComputedStyle(form).gridTemplateColumns.split(' ').length,
            paired:Math.abs(fields[0].getBoundingClientRect().top-fields[1].getBoundingClientRect().top)<1,
            overflow:form.scrollWidth>form.clientWidth};
        })()""")
        assert layout["columns"] == 2 and layout["paired"], layout
        assert not layout["overflow"], layout
        assert abs(layout["formWidth"] - layout["parentWidth"]) < 2, layout
        assert layout["height"] < 700, layout
        print("Responsive layout:", json.dumps(layout))
    errors = [event for event in browser.events if event.get("method") == "Runtime.exceptionThrown"]
    assert not errors, f"{len(errors)} uncaught browser errors"
    print("No uncaught JavaScript errors.")
    browser.socket.close()
