// Landing page motion.
//   GSAP + ScrollTrigger: hero timeline, scroll reveals, pinned steps, scrubbed video, counters, marquee.
//   Motion (vanilla Framer Motion): springs for nav, buttons, cards, accordion, track builder, chat, WhatsApp.
// Content is fully visible without this file (see the html.motion-ok failsafe in index.html).
(() => {
  "use strict";
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { gsap, ScrollTrigger, Motion } = window;
  const MA = (window.MA = window.MA || {});
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  if (reduce || !gsap || !ScrollTrigger) {
    root.classList.remove("motion-ok");
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  root.classList.add("motion-ready");

  /* ---------------- helpers ---------------- */
  function countUp(el, { duration = 1.6, delay = 0 } = {}) {
    const fmt = (n) => (el.hasAttribute("data-plain") ? String(Math.round(n)) : Math.round(n).toLocaleString("en-US"));
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target)) return null;
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const state = { v: 0 };
    el.textContent = prefix + fmt(0) + suffix;
    return gsap.to(state, {
      v: target, duration, delay, ease: "power2.out",
      onUpdate: () => { el.textContent = prefix + fmt(state.v) + suffix; },
      onComplete: () => { el.textContent = prefix + fmt(target) + suffix; },
    });
  }
  // Show an element that CSS hides until .is-in, keeping it invisible for the tween's start.
  function arm(els) {
    gsap.set(els, { opacity: 0 });
    [].concat(els).forEach((el) => el && el.classList.add("is-in"));
  }
  function splitWords(el) {
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    const wrap = (text) => {
      const frag = document.createDocumentFragment();
      text.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(" "); return; }
        const mask = document.createElement("span");
        mask.className = "wm";
        mask.setAttribute("aria-hidden", "true");
        const word = document.createElement("span");
        word.className = "w";
        word.textContent = part;
        mask.append(word);
        frag.append(mask);
      });
      return frag;
    };
    [...el.childNodes].forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) node.replaceWith(wrap(node.textContent));
      else if (node.nodeType === Node.ELEMENT_NODE) node.replaceChildren(wrap(node.textContent));
    });
    return $$(".w", el);
  }

  /* ---------------- GSAP: hero intro ---------------- */
  const hero = (name) => $(`[data-hero="${name}"]`);
  const title = $(".hero__title");
  const words = title ? splitWords(title) : [];
  gsap.set(words, { yPercent: 110 });
  title?.classList.add("is-in");
  const heroEls = ["kicker", "lead", "actions", "micro", "results", "visual", "card"].map(hero).filter(Boolean);
  arm(heroEls);

  const intro = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.8 }, delay: 0.1 });
  intro
    .fromTo(hero("kicker"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6 })
    .to(words, { yPercent: 0, duration: 0.9, stagger: 0.06, ease: "power4.out" }, "-=0.3")
    .fromTo(hero("visual"), { opacity: 0, y: 40, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 1.1 }, "<0.1")
    .fromTo(hero("lead"), { opacity: 0, y: 18 }, { opacity: 1, y: 0 }, "-=0.8")
    .fromTo(hero("actions"), { opacity: 0, y: 18 }, { opacity: 1, y: 0 }, "-=0.6")
    .fromTo(hero("micro"), { opacity: 0 }, { opacity: 1, duration: 0.5 }, "-=0.5")
    .fromTo(hero("results"), { opacity: 0, y: 16 }, { opacity: 1, y: 0 }, "-=0.4")
    .add(() => $$("[data-count]", hero("results")).forEach((el, i) => countUp(el, { delay: i * 0.12 })), "<")
    .fromTo(hero("card"), { opacity: 0, x: -50, rotate: -4 }, { opacity: 1, x: 0, rotate: 0, duration: 1, ease: "back.out(1.4)" }, "-=1.1")
    .add(() => $$(".dash-card .bar i").forEach((bar, i) => {
      const to = bar.style.getPropertyValue("--v");
      gsap.fromTo(bar, { "--v": "0%" }, { "--v": to, duration: 1.2, delay: 0.3 + i * 0.12, ease: "power3.out" });
    }), "<")
    .fromTo(".accred__list li", { opacity: 0, y: 12 }, { opacity: 1, y: 0, stagger: 0.08, duration: 0.5 }, "-=0.6");

  // Idle float on the dashboard card and ring rotation (desktop only).
  const mm = gsap.matchMedia();
  mm.add("(min-width: 561px)", () => {
    gsap.to(".dash-card", { y: -10, duration: 3, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 2 });
    gsap.to(".hero__ring", { rotate: 360, duration: 40, ease: "none", repeat: -1 });
    gsap.to(".hero__glow", { yPercent: 20, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
  });

  /* ---------------- GSAP: generic reveals ---------------- */
  ScrollTrigger.batch("[data-reveal]", {
    start: "top 88%",
    once: true,
    onEnter: (batch) => {
      arm(batch);
      gsap.fromTo(batch, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.08, ease: "power3.out", clearProps: "transform" });
    },
  });
  // Anything already scrolled past (deep links, reloads mid-page) is shown straight away.
  const revealPassed = () => $$("[data-reveal]:not(.is-in)").forEach((el) => {
    if (el.getBoundingClientRect().bottom < 0) { el.classList.add("is-in"); gsap.set(el, { opacity: 1, clearProps: "transform" }); }
  });
  revealPassed();
  window.addEventListener("hashchange", () => requestAnimationFrame(revealPassed));

  /* ---------------- GSAP: counters outside the hero ---------------- */
  $$("[data-count]").filter((el) => !el.closest("[data-hero]")).forEach((el) => {
    const target = el.dataset.count;
    el.textContent = (el.dataset.prefix || "") + "0" + (el.dataset.suffix || "");
    ScrollTrigger.create({
      trigger: el, start: "top 90%", once: true,
      onEnter: () => countUp(el, { duration: target > 999 ? 2 : 1.4 }),
    });
  });

  /* ---------------- GSAP: marquee ---------------- */
  const track = $("[data-marquee] .marquee__track");
  if (track && !track.closest(".is-static")) {
    const loop = gsap.to(track, { xPercent: -50, duration: 50, ease: "none", repeat: -1 });
    ScrollTrigger.create({ trigger: track, start: "top bottom", end: "bottom top", onToggle: (self) => (self.isActive ? loop.play() : loop.pause()) });
    track.addEventListener("pointerenter", () => gsap.to(loop, { timeScale: 0.15, duration: 0.6 }));
    track.addEventListener("pointerleave", () => gsap.to(loop, { timeScale: 1, duration: 0.6 }));
  }

  /* ---------------- GSAP: video break ---------------- */
  mm.add("(min-width: 768px)", () => {
    gsap.fromTo("[data-video-stage]",
      { scale: 0.9, borderRadius: 40 },
      { scale: 1, borderRadius: 0, ease: "none", scrollTrigger: { trigger: ".video-break", start: "top 95%", end: "top 15%", scrub: 0.5 } });
    gsap.fromTo(".video-break__frame", { y: 60, rotateX: 8 }, {
      y: 0, rotateX: 0, ease: "none", transformPerspective: 1200,
      scrollTrigger: { trigger: ".video-break", start: "top 90%", end: "top 20%", scrub: 0.5 },
    });
  });
  gsap.fromTo(".video-break__copy > *", { opacity: 0, y: 24 }, {
    opacity: 1, y: 0, stagger: 0.1, duration: 0.7, ease: "power3.out",
    scrollTrigger: { trigger: ".video-break", start: "top 70%", once: true },
  });

  /* ---------------- GSAP: how-we-work steps ---------------- */
  const steps = $$("[data-step]");
  const setActive = (index) => steps.forEach((s, i) => s.classList.toggle("is-active", i <= index));
  mm.add("(min-width: 960px)", () => {
    const progress = $(".steps__progress");
    gsap.set(progress, { scaleX: 0 });
    setActive(-1);
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: "[data-steps]", start: "top 28%", end: "+=900", pin: true, scrub: 0.6, anticipatePin: 1,
        onUpdate: (self) => setActive(self.progress === 0 ? -1 : Math.min(steps.length - 1, Math.floor(self.progress * steps.length + 0.15))),
      },
    });
    tl.to(progress, { scaleX: 1, ease: "none" });
    return () => setActive(steps.length - 1);
  });
  mm.add("(max-width: 959px)", () => {
    steps.forEach((step, i) => {
      gsap.fromTo(step, { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.7, ease: "power3.out", scrollTrigger: { trigger: step, start: "top 85%", once: true } });
      ScrollTrigger.create({ trigger: step, start: "top 60%", onEnter: () => setActive(i), onLeaveBack: () => setActive(i - 1) });
    });
  });

  /* ---------------- GSAP: comparison rows, dashboard, success ---------------- */
  gsap.fromTo("[data-compare-row]", { opacity: 0, y: 16 }, {
    opacity: 1, y: 0, stagger: 0.07, duration: 0.6, ease: "power2.out",
    scrollTrigger: { trigger: ".compare", start: "top 80%", once: true },
  });
  const dash = $("[data-dashboard]");
  if (dash) {
    const dtl = gsap.timeline({ scrollTrigger: { trigger: dash, start: "top 80%", once: true } });
    dtl.fromTo(dash, { opacity: 0, y: 50, rotateY: -10, transformPerspective: 1400 }, { opacity: 1, y: 0, rotateY: 0, duration: 1, ease: "power3.out" })
      .fromTo(".cols i", { scaleY: 0 }, { scaleY: 1, stagger: 0.07, duration: 0.7, ease: "back.out(1.6)" }, "-=0.5")
      .fromTo(".dashboard__list .row", { opacity: 0, x: 24 }, { opacity: 1, x: 0, stagger: 0.1, duration: 0.5 }, "-=0.4");
  }
  gsap.fromTo(".gaps tbody tr", { opacity: 0, x: 24 }, {
    opacity: 1, x: 0, stagger: 0.09, duration: 0.6, ease: "power2.out",
    scrollTrigger: { trigger: ".gaps", start: "top 80%", once: true },
  });
  gsap.fromTo(".outcome li", { opacity: 0, y: 30, scale: 0.94 }, {
    opacity: 1, y: 0, scale: 1, stagger: 0.12, duration: 0.8, ease: "back.out(1.5)",
    scrollTrigger: { trigger: ".outcome", start: "top 85%", once: true },
  });

  // Layout settles after fonts/images; keep trigger positions honest.
  window.addEventListener("load", () => ScrollTrigger.refresh());
  document.fonts?.ready.then(() => ScrollTrigger.refresh());

  /* ================= Motion (vanilla Framer Motion) ================= */
  if (!Motion) return;
  const { animate, inView, scroll, stagger } = Motion;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const springy = { type: "spring", stiffness: 420, damping: 26 };

  // Nav: scroll progress bar + compact height spring.
  const nav = $("[data-nav]");
  if (nav) {
    const bar = document.createElement("span");
    bar.className = "nav__progress";
    nav.append(bar);
    scroll(animate(bar, { scaleX: [0, 1] }, { ease: "linear" }));
    let compact = null;
    scroll((_, info) => {
      const next = info.y.current > 40;
      if (next === compact) return;
      compact = next;
      animate(nav, { height: next ? "62px" : "72px" }, { type: "spring", stiffness: 380, damping: 34 });
    });
  }

  // Buttons and chips: spring press.
  const pressables = $$(".btn, .chip, .acc__btn, .nav__toggle");
  pressables.forEach((el) => {
    el.addEventListener("pointerdown", () => animate(el, { scale: 0.96 }, springy));
    const release = () => animate(el, { scale: 1 }, springy);
    el.addEventListener("pointerup", release);
    el.addEventListener("pointerleave", release);
    el.addEventListener("pointercancel", release);
  });

  // Magnetic primary CTAs (fine pointers only).
  if (finePointer) {
    $$("[data-magnetic]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        animate(el, { x: dx * 0.18, y: dy * 0.3 }, { type: "spring", stiffness: 260, damping: 18 });
      });
      el.addEventListener("pointerleave", () => animate(el, { x: 0, y: 0, scale: 1 }, { type: "spring", stiffness: 260, damping: 16 }));
    });

    // Card lift: spring on the CSS `translate` property so it composes with GSAP/CSS transforms.
    $$("[data-lift]").forEach((el) => {
      let current = 0, control;
      const go = (to) => {
        control?.stop();
        control = animate(current, to, { type: "spring", stiffness: 300, damping: 20, onUpdate: (v) => { current = v; el.style.translate = `0 ${v}px`; } });
      };
      el.addEventListener("pointerenter", () => { el.classList.add("is-lifted"); go(-8); });
      el.addEventListener("pointerleave", () => { el.classList.remove("is-lifted"); go(0); });
    });

    // Cursor-follow glow on AI cards.
    $$(".ai-card").forEach((card) => card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    }));
  }

  // Collapsible panels (FAQ, pricing matrix): spring height.
  const running = new WeakMap();
  MA.animatePanel = (panel, open) => {
    running.get(panel)?.stop();
    if (open) {
      panel.hidden = false;
      const h = panel.scrollHeight;
      const control = animate(panel, { height: [0, h], opacity: [0, 1] }, { type: "spring", stiffness: 260, damping: 32, restDelta: 0.5 });
      running.set(panel, control);
      control.then(() => { if (running.get(panel) === control) { panel.style.height = ""; panel.style.opacity = ""; } });
    } else {
      const control = animate(panel, { height: [panel.offsetHeight, 0], opacity: [1, 0] }, { duration: 0.28, ease: [0.4, 0, 0.2, 1] });
      running.set(panel, control);
      control.then(() => { if (running.get(panel) === control) { panel.hidden = true; panel.style.height = ""; panel.style.opacity = ""; } });
    }
  };

  // Mobile menu: stagger links in.
  MA.menuOpened = (links) => animate($$("a", links), { opacity: [0, 1], y: [-8, 0] }, { delay: stagger(0.04), duration: 0.3 });

  // Track builder.
  MA.chipPressed = (chip) => animate(chip, { scale: [0.9, 1] }, { type: "spring", stiffness: 500, damping: 15 });
  MA.builderChanged = (summary, step) => {
    animate(summary, { opacity: [0.2, 1], y: [10, 0] }, { type: "spring", stiffness: 300, damping: 24 });
    if (step) animate(step, { backgroundColor: ["rgba(255, 101, 85, 0.35)", "rgba(255, 255, 255, 0.05)"], x: [-10, 0] }, { duration: 0.8 });
  };

  // Claude/MCP card: type the question, then spring the answer in.
  const mcp = $("[data-mcp]");
  if (mcp) {
    const q = $("[data-typing]", mcp);
    const answer = $("[data-chat-answer]", mcp);
    const full = q.dataset.typing;
    q.setAttribute("aria-label", full);
    answer.style.opacity = "0";
    inView(mcp, () => {
      q.textContent = "";
      q.classList.add("is-typing");
      let i = 0;
      const chars = [...full];
      const tick = setInterval(() => {
        q.textContent += chars[i++];
        if (i < chars.length) return;
        clearInterval(tick);
        q.classList.remove("is-typing");
        animate(answer, { opacity: [0, 1], scale: [0.9, 1], y: [12, 0] }, { type: "spring", stiffness: 260, damping: 20 });
        animate($$(".chat__line", answer), { scaleX: [0, 1] }, { delay: stagger(0.12, { startDelay: 0.2 }), duration: 0.5 });
      }, 45);
    }, { amount: 0.6 });
  }

  // "Most requested" badge pulse.
  $$("[data-pulse]").forEach((el) => animate(el, { scale: [1, 1.07, 1] }, { duration: 1.8, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }));

  // WhatsApp float: spring entrance, then a soft ring pulse.
  const wa = $("[data-wa]");
  if (wa) {
    wa.style.opacity = "0";
    animate(wa, { opacity: [0, 1], y: [30, 0], scale: [0.8, 1] }, { type: "spring", stiffness: 260, damping: 18, delay: 2 });
    animate($(".wa-float__ring", wa), { scale: [1, 1.35], opacity: [0.7, 0] }, { duration: 1.8, repeat: Infinity, repeatDelay: 1.6, delay: 3 });
  }
})();
