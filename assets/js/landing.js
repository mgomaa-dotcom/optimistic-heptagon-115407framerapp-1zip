// Landing page interactions that work without any animation library.
// landing-motion.js may register window.MA hooks to animate these state changes.
(() => {
  "use strict";
  const root = document.documentElement;
  root.classList.add("js");
  const MA = (window.MA = window.MA || {});

  /* Nav: scrolled state + mobile menu */
  const nav = document.querySelector("[data-nav]");
  const toggle = nav?.querySelector(".nav__toggle");
  const links = document.getElementById("nav-links");
  const setScrolled = () => nav?.classList.toggle("is-scrolled", window.scrollY > 40);
  setScrolled();
  window.addEventListener("scroll", setScrolled, { passive: true });
  function setMenu(open) {
    if (!toggle || !links) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "إغلاق القائمة" : "فتح القائمة");
    links.classList.toggle("is-open", open);
    if (open) MA.menuOpened?.(links);
  }
  toggle?.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
  links?.addEventListener("click", (event) => { if (event.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && toggle?.getAttribute("aria-expanded") === "true") { setMenu(false); toggle.focus(); }
  });

  /* Collapsible helper: animate via MA.animatePanel when available. */
  function setPanel(panel, open) {
    if (MA.animatePanel) MA.animatePanel(panel, open);
    else panel.hidden = !open;
  }

  /* FAQ accordion (all answers visible without JS). */
  document.querySelectorAll("[data-accordion] .acc").forEach((item, index) => {
    const button = item.querySelector(".acc__btn");
    const panel = item.querySelector(".acc__panel");
    const id = `faq-panel-${index + 1}`;
    panel.id = id;
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-labelledby", (button.id = `faq-btn-${index + 1}`));
    button.setAttribute("aria-controls", id);
    const open = index === 0;
    button.setAttribute("aria-expanded", String(open));
    item.classList.toggle("is-open", open);
    panel.hidden = !open;
    button.addEventListener("click", () => {
      const next = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(next));
      item.classList.toggle("is-open", next);
      setPanel(panel, next);
    });
  });

  /* Pricing feature matrix: collapsed by default when JS runs. */
  const matrixToggle = document.querySelector("[data-matrix-toggle]");
  const matrix = document.querySelector("[data-matrix]");
  if (matrixToggle && matrix) {
    const openLabel = matrixToggle.querySelector("[data-label-open]");
    const closedLabel = matrixToggle.querySelector("[data-label-closed]");
    const apply = (open, animate) => {
      matrixToggle.setAttribute("aria-expanded", String(open));
      openLabel.hidden = !open;
      closedLabel.hidden = open;
      if (animate) setPanel(matrix, open);
      else matrix.hidden = !open;
    };
    apply(false, false);
    matrixToggle.addEventListener("click", () => apply(matrixToggle.getAttribute("aria-expanded") !== "true", true));
  }

  /* Track builder: one choice per dimension, live summary. */
  const builder = document.querySelector("[data-builder]");
  if (builder) {
    const summary = builder.querySelector("[data-builder-summary]");
    const steps = {
      competency: [builder.querySelector('[data-builder-step="competency"]'), "دروس ", " مع خبير"],
      sector: [builder.querySelector('[data-builder-step="sector"]'), "محاكاة كوتش AI بسيناريوهات ", ""],
      level: [builder.querySelector('[data-builder-step="level"]'), "متابعة بمستوى ", ""],
    };
    const selected = (dim) => builder.querySelector(`[data-dim="${dim}"] [aria-pressed="true"]`)?.textContent.trim() || "";
    const bold = (text) => { const b = document.createElement("b"); b.textContent = text; return b; };
    function render(changedDim) {
      const level = selected("level"), sector = selected("sector"), competency = selected("competency");
      summary.replaceChildren("مسار ", bold(level), " في قطاع ", bold(sector), "، يركّز على ", bold(competency));
      for (const [dim, [el, before, after]] of Object.entries(steps)) {
        if (el) el.replaceChildren(before, bold(selected(dim)), after);
      }
      if (changedDim) MA.builderChanged?.(summary, steps[changedDim]?.[0]);
    }
    builder.querySelectorAll("[data-dim]").forEach((group) => {
      group.addEventListener("click", (event) => {
        const chip = event.target.closest("button.chip");
        if (!chip || chip.getAttribute("aria-pressed") === "true") return;
        group.querySelectorAll("button.chip").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
        MA.chipPressed?.(chip);
        render(group.dataset.dim);
      });
    });
    render();
  }

  /* Promo video: the "watch" button plays the existing YouTube player with sound. */
  document.querySelector("[data-video-play]")?.addEventListener("click", () => {
    document.querySelector(".video-break__frame")?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    document.dispatchEvent(new CustomEvent("ma:video-play"));
  });

  /* Marquee: duplicate logos once so a looping translate is seamless. */
  const marqueeTrack = document.querySelector("[data-marquee] .marquee__track");
  if (marqueeTrack && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    [...marqueeTrack.children].forEach((img) => {
      const clone = img.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      marqueeTrack.append(clone);
    });
  } else {
    marqueeTrack?.closest("[data-marquee]").classList.add("is-static");
  }
})();
