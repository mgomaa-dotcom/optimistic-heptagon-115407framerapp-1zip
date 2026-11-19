/* Deterministic video failure recovery checks; no network or CRM writes. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function setup() {
  const elements = [];
  const timers = new Map();
  let timerID = 0;
  let observer;
  class Element {
    constructor(tag) {
      this.tag = tag;
      this.listeners = {};
      this.paused = true;
      this.error = null;
      this.loads = 0;
      this.plays = 0;
      elements.push(this);
    }
    setAttribute() {}
    append() {}
    addEventListener(name, fn) { this.listeners[name] = fn; }
    dispatch(name) { this.listeners[name]?.(); }
    pause() { this.paused = true; this.dispatch("pause"); }
    load() { this.loads++; this.error = null; this.paused = true; }
    play() { this.plays++; this.paused = false; return Promise.resolve(); }
  }
  const frame = new Element("frame");
  const document = {
    hidden: false, body: {}, createElement: tag => new Element(tag),
    addEventListener() {}, querySelector: () => frame,
  };
  vm.runInNewContext(fs.readFileSync("assets/js/homepage-video.js", "utf8"), {
    document,
    IntersectionObserver: class {
      constructor(fn) { observer = fn; }
      observe() {}
    },
    MutationObserver: class { observe() {} },
    setTimeout(fn) { const id = ++timerID; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  return {
    video: elements.find(e => e.tag === "video"),
    error: elements.find(e => e.className === "academy-video-error"),
    retry: elements.find(e => e.tag === "button"),
    timers, document,
    enter() { observer([{isIntersecting: true, intersectionRatio: 1}]); },
    leave() { observer([{isIntersecting: false, intersectionRatio: 0}]); },
    tick() {
      for (const [id, fn] of [...timers]) { timers.delete(id); fn(); }
    },
    fail(code) {
      this.video.error = {code};
      this.video.paused = true;
      this.video.dispatch("pause");
      this.video.dispatch("error");
    },
  };
}

(async () => {
  const s = setup();
  s.enter();
  await Promise.resolve();
  s.fail(4);
  assert.equal(s.timers.size, 1);
  s.tick();
  assert.equal(s.video.loads, 1);
  assert.equal(s.video.paused, false);
  await Promise.resolve();
  s.fail(2);
  s.tick();
  assert.equal(s.video.loads, 2);
  await Promise.resolve();
  s.fail(2);
  assert.equal(s.timers.size, 0, "Automatic retries must be bounded");
  assert.equal(s.error.hidden, false);
  s.retry.dispatch("click");
  assert.equal(s.video.loads, 3, "Manual retry remains available");
  const offscreen = setup();
  offscreen.fail(2);
  assert.equal(offscreen.timers.size, 0);
  offscreen.enter();
  assert.equal(offscreen.timers.size, 1);
  offscreen.leave();
  offscreen.tick();
  assert.equal(offscreen.video.loads, 0, "Do not reload offscreen");
  const decode = setup();
  decode.enter();
  decode.fail(3);
  assert.equal(decode.timers.size, 0, "Do not retry decode errors");
  const hidden = setup();
  hidden.enter();
  hidden.document.hidden = true;
  hidden.fail(2);
  assert.equal(hidden.timers.size, 0, "Do not retry a hidden tab");
  console.log("Video recovery: bounded retry, manual retry, offscreen, hidden-tab, decode checks passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
