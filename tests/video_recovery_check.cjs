/* YouTube integration checks without external requests or CRM writes. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function setup() {
  const elements = [];
  let intersect, mutation, options, state = -1, plays = 0, pauses = 0, muted = false;
  class Element {
    constructor(tag) {
      this.tag = tag; this.style = {}; this.listeners = {}; this.children = [];
      elements.push(this);
    }
    append(...children) {
      for (const child of children) {
        if (child.parentElement) {
          child.parentElement.children = child.parentElement.children.filter(c => c !== child);
        }
        child.parentElement = this;
        this.children.push(child);
      }
    }
    setAttribute(name, value) { this[name] = value; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
  }
  let frame = new Element("frame");
  const document = {
    hidden: false, body: {}, head: new Element("head"), listeners: {},
    createElement: tag => new Element(tag),
    addEventListener(name, fn) { this.listeners[name] = fn; },
    querySelector: () => frame,
  };
  const iframe = new Element("iframe");
  const api = {
    getIframe: () => iframe, getPlayerState: () => state,
    mute() { muted = true; },
    playVideo() { plays++; },
    pauseVideo() { pauses++; },
  };
  const window = {
    location: {origin: "https://example.com"},
    YT: {Player: function (target, opts) { options = opts; return api; }},
  };
  vm.runInNewContext(fs.readFileSync("assets/js/homepage-video.js", "utf8"), {
    document, window,
    IntersectionObserver: class {
      constructor(fn) { intersect = fn; } observe() {}
    },
    MutationObserver: class { constructor(fn) { mutation = fn; } observe() {} },
  });
  return {
    document, window, elements,
    get options() { return options; },
    get plays() { return plays; }, get pauses() { return pauses; },
    get muted() { return muted; },
    enter() { intersect([{isIntersecting:true, intersectionRatio:.8}]); },
    leave() { intersect([{isIntersecting:false, intersectionRatio:0}]); },
    ready() { options.events.onReady(); },
    state(value) { state = value; options.events.onStateChange({data:value}); },
    remount() { frame = new Element("frame"); mutation(); return frame; },
  };
}
const s = setup();
assert.equal(s.options, undefined, "No eager YouTube player");
s.enter();
assert.equal(s.options.videoId, "1xNjiL8OELY");
assert.equal(s.options.playerVars.playsinline, 1);
s.ready();
assert(s.muted && s.plays === 1, "Muted autoplay on entry");
s.state(1);
s.leave();
assert.equal(s.pauses, 1, "Pause offscreen");
s.state(2);
s.enter();
assert.equal(s.plays, 2, "Resume after automatic pause");
s.state(1);
s.state(2);
s.leave(); s.enter();
assert.equal(s.plays, 2, "Respect manual pause");
s.options.events.onAutoplayBlocked();
const notice = s.elements.find(e => e.className === "academy-video-error");
const button = s.elements.find(e => e.tag === "button");
assert.equal(notice.hidden, false);
button.listeners.click();
assert.equal(s.plays, 3, "Manual play after autoplay blocked");
s.state(1);
s.document.hidden = true;
s.document.listeners.visibilitychange();
assert.equal(s.pauses, 2, "Pause hidden tabs");
s.state(2);
s.document.hidden = false;
s.document.listeners.visibilitychange();
assert.equal(s.plays, 4);
s.options.events.onError({data:101});
assert(!notice.hidden && button.hidden, "Embedding failure offers YouTube link");
assert(s.elements.find(e => e.tag === "a").href.endsWith("1xNjiL8OELY"));
const host = s.elements.find(e => e.className === "academy-video");
assert(s.remount().children.includes(host), "Retain host across Framer hydration");

const lazy = setup();
delete lazy.window.YT;
lazy.enter(); lazy.enter();
assert.equal(lazy.document.head.children.length, 1, "Load API only once");
lazy.document.head.children[0].onerror();
assert.equal(lazy.elements.find(e => e.className === "academy-video-error").hidden, false);
console.log("YouTube checks passed: lazy load, muted entry, pause/resume, manual pause, fallback, hydration.");
