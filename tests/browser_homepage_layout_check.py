"""Verify requested homepage changes and real motion without CRM writes."""
import json
import os
import time
from browser_form_check import CDP

browser = CDP()
browser.call("Page.enable")
browser.call("Runtime.enable")
base = "https://" + os.environ["REPLIT_DEV_DOMAIN"]
for width in [320, 390, 768, 1440]:
    browser.call("Emulation.setDeviceMetricsOverride", {
        "width": width, "height": 900, "deviceScaleFactor": 1, "mobile": width < 810,
    })
    browser.call("Page.navigate", {"url": base + "/"})
    for _ in range(60):
        time.sleep(.2)
        if browser.evaluate("""Boolean(
          document.querySelector('.ma-hero-kicker') &&
          document.querySelector('.ma-number-stage') &&
          document.querySelector('.ma-service-branch') &&
          document.querySelector('.framer-9nhah2 h1')?.textContent.trim() ===
            'من استراتيجيات الإقناع والتفاوض الي اغلاق الصفقات و كسب ولاء العملاء'
        )"""):
            break
    # The enhanced UI is now present before first paint, not just after the
    # asynchronous Framer bundle finishes. Wait for that bundle before holding
    # long-lived DOM references; the dedicated stability check samples startup.
    for _ in range(80):
        if browser.evaluate("document.readyState === 'complete'"):
            break
        time.sleep(.1)
    time.sleep(.6)
    result = browser.evaluate("""(async () => {
      const assert = (ok, message) => { if (!ok) throw Error(message); };
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const hero = document.querySelector('.framer-9nhah2');
      assert(hero.querySelector('h1').textContent.trim() ===
        'من استراتيجيات الإقناع والتفاوض الي اغلاق الصفقات و كسب ولاء العملاء', 'Hero heading');
      const kickers = hero.querySelectorAll('.ma-hero-kicker');
      assert(kickers.length === 1 && kickers[0].textContent ===
        'اكاديميه المبيعات و خدمه العملاء', 'Centered academy heading');
      const label = kickers[0].getBoundingClientRect();
      const body = hero.querySelector('.framer-quxnty').getBoundingClientRect();
      assert(Math.abs((label.left + label.right) - (body.left + body.right)) < 3, 'Academy heading alignment');
      const accreditation = document.querySelector('#accreditation');
      assert(accreditation && document.querySelectorAll('#accreditation').length === 1, 'One accreditation section');
      assert(accreditation.nextElementSibling.matches('.framer-1qa0kh4'), 'Accreditations before company list');
      accreditation.scrollIntoView({block:'center',behavior:'instant'});
      await wait(300);
      const images = [...accreditation.querySelectorAll('img')];
      await Promise.all(images.map(image => image.decode()));
      assert(images.length === 4 && images.every(image => image.naturalWidth > 0), 'All four uploaded images');
      const company = accreditation.nextElementSibling;
      assert(accreditation.getBoundingClientRect().bottom <= company.getBoundingClientRect().top + 2, 'Accreditation visual order');
      const numbers = document.querySelector('#numbers');
      const stage = numbers.querySelector('.ma-number-stage');
      assert(stage, 'Statistics stage');
      numbers.scrollIntoView({block:'center',behavior:'instant'});
      await wait(100);
      const values = [...numbers.querySelectorAll('.ma-number-value')];
      assert(values.length === 3, 'All three metrics');
      const sampledValues = new Set();
      for (let i = 0; i < 25; i++) {
        sampledValues.add(values.map(v => v.textContent).join('|'));
        await wait(80);
      }
      assert(sampledValues.size > 1, 'Counters must animate on entry');
      assert(values.map(v => v.textContent).join('|') === '+100k|+300|+10', 'Original final metric values');
      const cards = [...stage.querySelectorAll('.ma-number-stat')];
      const center = stage.querySelector('.ma-number-mark');
      function snapshot() {
        const root = stage.getBoundingClientRect();
        return cards.map(card => {
          const r = card.getBoundingClientRect();
          return {x:r.x-root.x,y:r.y-root.y,width:r.width,height:r.height};
        });
      }
      function overlaps(a,b) {
        return a.left < b.right - 1 && a.right > b.left + 1 &&
          a.top < b.bottom - 1 && a.bottom > b.top + 1;
      }
      const before = snapshot();
      // Check separated, upright cards while their orbit progresses.
      for (let n = 0; n < 6; n++) {
        const rectangles = cards.map(c => c.getBoundingClientRect());
        const centerRect = center.getBoundingClientRect();
        rectangles.forEach((a,i) => {
          assert(!overlaps(a,centerRect), 'A statistic overlaps the central mark');
          assert(a.left >= -1 && a.right <= innerWidth + 1, 'Orbit exceeds viewport');
          rectangles.slice(i+1).forEach(b => assert(!overlaps(a,b), 'Statistics overlap: ' +
            JSON.stringify({width:innerWidth,clientWidth:document.documentElement.clientWidth,
              a:a.toJSON(),b:b.toJSON()})));
        });
        await wait(150);
      }
      const after = snapshot();
      assert(after.some((a,i) => Math.hypot(a.x-before[i].x,a.y-before[i].y) > 2), 'Actual orbital movement');
      const pause = numbers.querySelector('.ma-number-motion-control');
      assert(pause && pause.getBoundingClientRect().height >= 36, 'Visible statistics motion control');
      pause.click();
      await wait(120);
      const paused = snapshot();
      await wait(350);
      assert(snapshot().every((a,i) =>
        Math.hypot(a.x-paused[i].x,a.y-paused[i].y) < .8), 'Pause freezes orbital motion');
      // Exercise every part of the elliptical orbit without waiting 72 seconds.
      const orbit = stage.querySelector('.ma-number-orbit');
      const orbitStyle = getComputedStyle(orbit);
      const rx = parseFloat(orbitStyle.getPropertyValue('--ma-orbit-ring-width')) / 2;
      const ry = parseFloat(orbitStyle.getPropertyValue('--ma-orbit-ring-height')) / 2;
      const transforms = cards.map(card => card.style.transform);
      for (let degrees = 0; degrees < 360; degrees += 5) {
        cards.forEach((card,index) => {
          const angle = degrees * Math.PI / 180 + index * Math.PI * 2 / 3;
          card.style.transform = `translate(-50%,-50%) translate3d(${Math.cos(angle)*rx}px,${Math.sin(angle)*ry}px,0)`;
        });
        const rectangles = cards.map(card => card.getBoundingClientRect());
        const mark = center.getBoundingClientRect();
        rectangles.forEach((a,index) => {
          assert(!overlaps(a,mark), `Orbit crosses central mark at ${degrees} degrees`);
          assert(a.left >= -1 && a.right <= innerWidth + 1, `Orbit crosses viewport at ${degrees} degrees`);
          rectangles.slice(index+1).forEach(b => assert(!overlaps(a,b),
            `Orbit cards overlap at ${degrees} degrees`));
        });
      }
      cards.forEach((card,index) => { card.style.transform = transforms[index]; });
      pause.click();
      const tracks = document.querySelector('#tracks');
      tracks.scrollIntoView({block:'center',behavior:'instant'});
      await wait(300);
      assert(tracks.querySelectorAll('.ma-service-branch').length === 1, 'One new service branch');
      assert(tracks.querySelector('.ma-service-branch').textContent === 'مسار خدمه العملاء', 'Customer service branch');
      for (const title of ['التميز في مبيعات التجزئة','مبيعات الشركات الكبرى','إدارة وقيادة فرق المبيعات'])
        assert(tracks.textContent.includes(title), 'Existing track: '+title);
      const controls = [...tracks.querySelectorAll('.ma-motion-control')].filter(control =>
        getComputedStyle(control).display !== 'none' && control.getBoundingClientRect().height > 0);
      assert(controls.length >= 1, 'Visible training motion control');
      assert(document.documentElement.scrollWidth <= innerWidth + 1, 'No horizontal page overflow');
      return {width:innerWidth, hero:true, accreditationImages:4, animatedCounters:true,
        orbit:true, orbitPause:true, customerServiceBranch:true, noOverflow:true};
    })()""")
    print(json.dumps(result))

browser.call("Emulation.setEmulatedMedia", {
    "features": [{"name": "prefers-reduced-motion", "value": "reduce"}],
})
result = browser.evaluate("""(async () => {
  const numbers = document.querySelector('#numbers');
  numbers.scrollIntoView({block:'center',behavior:'instant'});
  await new Promise(r => setTimeout(r,200));
  const cards = [...numbers.querySelectorAll('.ma-number-stat')];
  const snapshot = () => cards.map(c => {
    const r=c.getBoundingClientRect();return [r.x,r.y];
  });
  const before = snapshot();
  await new Promise(r => setTimeout(r,350));
  if (snapshot().some((p,i) => Math.hypot(p[0]-before[i][0],p[1]-before[i][1]) > .8))
    throw Error('Reduced motion should stop orbital movement');
  return {reducedMotion:true};
})()""")
print(json.dumps(result))
exceptions = [e for e in browser.events if e.get("method") == "Runtime.exceptionThrown"]
assert not exceptions, exceptions
browser.socket.close()
