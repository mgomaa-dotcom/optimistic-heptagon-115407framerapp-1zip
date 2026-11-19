(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const gsap = window.gsap;
  const tracks = [
    {
      title: "التميز في مبيعات التجزئة",
      topics: ["التعامل مع الجمهور", "احتياجات العميل الفورية", "التميز في مبيعات التجزئة"],
    },
    {
      title: "مبيعات الشركات الكبرى",
      topics: ["الشراكات الاستراتيجية", "دورات البيع الطويلة", "مبيعات الشركات الكبرى"],
    },
    {
      title: "إدارة وقيادة فرق المبيعات",
      topics: ["تحليل البيانات البيعية", "بناء الاستراتيجيات", "إدارة وقيادة فرق المبيعات"],
    },
  ];
  const sitemapLabels = [
    "المسارات",
    "المنهجية",
    "المتابعة",
    "لماذا ماستري",
    "قصص النجاح",
    "الأسئلة",
  ];

  function enhancementReady() {
    if (window.__masteryLearningEnhancementsMounted) return;
    window.__masteryLearningEnhancementsMounted = true;
    const activeSections = new Map();
    const setupById = { sitemap: setupSitemap, tracks: setupTracks, method: setupMethod };
    let scheduled = false;

    function reconcile() {
      scheduled = false;
      Object.entries(setupById).forEach(([id, setup]) => {
        const previous = activeSections.get(id);
        const current = document.getElementById(id);
        const mountedControl = id === "sitemap" ? ".ma-controls" : id === "tracks" ? ".ma-track-controls" : null;
        const stillMounted = previous === current && current &&
          (mountedControl ? current.querySelector(mountedControl) : current.dataset.maMethodMounted === "true");
        if (stillMounted || (previous === current && !current)) return;
        previous?.__maCleanup?.();
        if (!current) {
          activeSections.delete(id);
          return;
        }
        current.__maCleanup = setup(current);
        activeSections.set(id, current);
      });

      const sitemap = activeSections.get("sitemap");
      const trackSection = activeSections.get("tracks");
      const method = activeSections.get("method");
      if (sitemap) bindSitemapDiagrams(sitemap);
      if (method) tagMethodCards(method);
      if (trackSection) trackSection.__maBindOriginalTrackTargets?.();
    }

    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(reconcile);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    reconcile();
    preserveInitialAnchor();
  }

  function preserveInitialAnchor() {
    const hash = location.hash;
    if (!["#sitemap", "#tracks", "#method"].includes(hash)) return;
    // Added controls and Framer's responsive hydration change section heights.
    // Keep a direct section link aligned until initial layout settles, never
    // overriding a visitor's subsequent scroll, keyboard, or pointer action.
    const events = new AbortController();
    let pending = 0;
    let finished = false;
    const layout = new ResizeObserver(() => schedule());
    function finish() {
      finished = true;
      clearTimeout(pending);
      layout.disconnect();
      events.abort();
    }
    function schedule() {
      if (finished) return;
      clearTimeout(pending);
      pending = setTimeout(() => {
        if (location.hash !== hash) return finish();
        document.querySelector(hash)?.scrollIntoView({ block: "start", behavior: "instant" });
      }, 180);
    }
    for (const event of ["wheel", "touchstart", "pointerdown", "keydown", "hashchange"]) {
      window.addEventListener(event, finish, { once: true, passive: true, signal: events.signal });
    }
    layout.observe(document.body);
    document.fonts?.ready.then(schedule);
    schedule();
    setTimeout(finish, 4000);
  }

  function makeButton(text, className, attributes = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.className = className;
    Object.entries(attributes).forEach(([key, value]) => button.setAttribute(key, value));
    return button;
  }

  function setupSitemap(section) {
    if (section.querySelector(".ma-controls")) return;
    const controls = document.createElement("div");
    controls.className = "ma-controls";
    controls.dataset.sitemapController = "";
    controls.dataset.activeIndex = "0";
    controls.dataset.autoplay = "running";
    controls.setAttribute("aria-label", "التنقل بين أقسام خريطة الموقع");

    const copy = document.createElement("div");
    copy.className = "ma-controls__copy";
    copy.innerHTML = '<div class="ma-controls__eyebrow">خريطة ماستري</div><div class="ma-controls__current" data-sitemap-current aria-live="polite">المسارات</div>';
    const actions = document.createElement("div");
    actions.className = "ma-control-actions";
    const dots = document.createElement("div");
    dots.className = "ma-step-dots";
    dots.setAttribute("role", "group");
    dots.setAttribute("aria-label", "اختر قسماً من الخريطة");
    sitemapLabels.forEach((label, index) => {
      const dot = makeButton(`القسم ${index + 1}: ${label}`, "ma-step-dot", {
        "aria-label": label,
        "aria-current": index === 0 ? "step" : "false",
        "data-sitemap-select": String(index),
      });
      dot.addEventListener("click", () => setActive(index, true));
      dots.append(dot);
    });
    const toggle = makeButton("إيقاف الحركة", "ma-autoplay-toggle", { "data-sitemap-toggle": "", "aria-pressed": "false" });
    actions.append(dots, toggle);
    controls.append(copy, actions);
    section.append(controls);

    let index = 0;
    let userPaused = false;
    let hovered = false;
    let focused = false;
    let inView = false;
    let timer = 0;
    let visibilityObserver = null;
    let lastHoveredNode = null;
    let diagrams = [];
    const current = controls.querySelector("[data-sitemap-current]");

    function updateState() {
      const running = !userPaused && !hovered && !focused && inView && !document.hidden && !reduceMotion.matches;
      controls.dataset.autoplay = running ? "running" : "paused";
      toggle.textContent = userPaused ? "استئناف الحركة" : "إيقاف الحركة";
      toggle.setAttribute("aria-pressed", String(userPaused));
      if (timer) window.clearInterval(timer);
      timer = running ? window.setInterval(() => setActive((index + 1) % sitemapLabels.length, false), 4800) : 0;
    }

    function paint(indexToShow, animate = true) {
      current.textContent = sitemapLabels[indexToShow];
      controls.dataset.activeIndex = String(indexToShow);
      controls.querySelectorAll("[data-sitemap-select]").forEach((button, i) => {
        button.setAttribute("aria-current", i === indexToShow ? "step" : "false");
      });
      diagrams.forEach(({ nodes, path, mobile }) => {
        nodes.forEach((node, i) => {
          node.dataset.sitemapNode = String(i);
          node.dataset.active = String(i === indexToShow);
          if (!mobile && gsap && animate && !reduceMotion.matches) {
            gsap.to(node, { scale: i === indexToShow ? 1.045 : 1, duration: .42, ease: "power2.out", overwrite: true });
          } else if (!mobile) {
            node.style.transform = i === indexToShow ? "scale(1.04)" : "";
          }
        });
        if (path) {
          path.dataset.sitemapActivePath = "";
          if (gsap && animate && !reduceMotion.matches) {
            gsap.fromTo(path, { opacity: .18, strokeDasharray: "5 10", strokeDashoffset: 45 }, {
              opacity: 1, strokeDasharray: "none", strokeDashoffset: 0, duration: .72, ease: "power2.out", overwrite: true,
            });
          }
        }
      });
    }

    function setActive(next, manual) {
      index = (next + sitemapLabels.length) % sitemapLabels.length;
      diagrams = collectSitemapDiagrams(section);
      section.__maSyncingNodes = true;
      diagrams.forEach(({ nodes }) => nodes[index]?.click());
      section.__maSyncingNodes = false;
      paint(index, !manual);
      if (manual) updateState();
    }
    section.__maSetSitemapActive = (next, manual = true) => setActive(next, manual);

    function bind() {
      diagrams = collectSitemapDiagrams(section);
      diagrams.forEach(({ nodes }) => {
        nodes.forEach((node, i) => {
          node.dataset.sitemapNode = String(i);
        });
      });
      paint(index, false);
    }

    const onSitemapClick = event => {
      const node = event.target.closest("[data-sitemap-node]");
      if (node && !section.__maSyncingNodes) setActive(Number(node.dataset.sitemapNode), true);
    };
    const onSitemapFocus = event => {
      focused = true;
      updateState();
      const node = event.target.closest("[data-sitemap-node]");
      if (node && !section.__maSyncingNodes) setActive(Number(node.dataset.sitemapNode), true);
    };
    const onSitemapFocusOut = event => {
      if (!section.contains(event.relatedTarget)) { focused = false; updateState(); }
    };
    const onSitemapMouseEnter = () => { hovered = true; updateState(); };
    const onSitemapMouseLeave = () => { hovered = false; lastHoveredNode = null; updateState(); };
    const onSitemapPointerOver = event => {
      const node = event.target.closest("[data-sitemap-node]");
      if (node && node !== lastHoveredNode && !section.__maSyncingNodes) {
        lastHoveredNode = node;
        setActive(Number(node.dataset.sitemapNode), true);
      }
    };
    section.addEventListener("click", onSitemapClick);
    section.addEventListener("focusin", onSitemapFocus);
    section.addEventListener("focusout", onSitemapFocusOut);
    section.addEventListener("pointerover", onSitemapPointerOver);
    bind();
    section.addEventListener("mouseenter", onSitemapMouseEnter);
    section.addEventListener("mouseleave", onSitemapMouseLeave);
    toggle.addEventListener("click", () => { userPaused = !userPaused; updateState(); });
    document.addEventListener("visibilitychange", updateState);
    reduceMotion.addEventListener?.("change", updateState);
    if ("IntersectionObserver" in window) {
      visibilityObserver = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; updateState(); }, { threshold: .12 });
      visibilityObserver.observe(section);
    } else {
      inView = true;
    }
    updateState();
    return () => {
      if (timer) window.clearInterval(timer);
      visibilityObserver?.disconnect();
      document.removeEventListener("visibilitychange", updateState);
      reduceMotion.removeEventListener?.("change", updateState);
      section.removeEventListener("click", onSitemapClick);
      section.removeEventListener("focusin", onSitemapFocus);
      section.removeEventListener("focusout", onSitemapFocusOut);
      section.removeEventListener("pointerover", onSitemapPointerOver);
      section.removeEventListener("mouseenter", onSitemapMouseEnter);
      section.removeEventListener("mouseleave", onSitemapMouseLeave);
      section.__maSetSitemapActive = null;
      section.__maSitemapTargets = null;
    };
  }

  function collectSitemapDiagrams(section) {
    const diagrams = [...section.querySelectorAll("svg")].map(svg => {
      const diagram = svg.parentElement;
      const nodes = [...diagram.querySelectorAll('[role="button"]')].slice(0, sitemapLabels.length);
      if (nodes.length !== sitemapLabels.length) return null;
      const paths = [...svg.querySelectorAll("path")];
      return { nodes, path: paths.at(-1), mobile: false };
    }).filter(Boolean);
    const mobileRows = [...section.querySelectorAll(".mt-row")].slice(0, sitemapLabels.length);
    if (mobileRows.length === sitemapLabels.length) diagrams.push({ nodes: mobileRows, path: null, mobile: true });
    return diagrams;
  }

  function bindSitemapDiagrams(section) {
    if (!section.querySelector(".ma-controls")) return;
    const diagrams = collectSitemapDiagrams(section);
    const targets = diagrams.flatMap(diagram => diagram.nodes);
    const previous = section.__maSitemapTargets;
    const changed = Array.isArray(previous) &&
      (previous.length !== targets.length || previous.some((node, index) => node !== targets[index]));
    section.__maSitemapTargets = targets;
    diagrams.forEach(({ nodes }) => nodes.forEach((node, index) => {
      node.dataset.sitemapNode = String(index);
    }));
    if (changed && section.__maSetSitemapActive) {
      section.__maSetSitemapActive(Number(section.querySelector(".ma-controls").dataset.activeIndex || 0), false);
    }
  }

  function setupTracks(section) {
    if (section.querySelector(".ma-track-controls")) return;
    const controller = document.createElement("div");
    controller.className = "ma-track-controls";
    controller.dataset.trackController = "";
    controller.dataset.activeIndex = "0";
    controller.dataset.autoplay = "running";
    controller.innerHTML = '<div class="ma-track-controls__head"><div><div class="ma-track-controls__label">المسارات التدريبية</div><div class="ma-track-controls__active" data-track-current aria-live="polite"></div></div></div>';
    const tabList = document.createElement("div");
    tabList.className = "ma-track-tabs";
    tabList.setAttribute("role", "group");
    tabList.setAttribute("aria-label", "اختر مساراً تدريبياً");
    const buttons = tracks.map((track, index) => {
      const button = makeButton("", "", { "aria-pressed": index === 0 ? "true" : "false", "data-track-select": String(index) });
      const title = document.createElement("span");
      title.className = "ma-track-tab-title";
      title.textContent = track.title;
      const topics = document.createElement("span");
      topics.className = "ma-track-tab-topics";
      track.topics.slice(0, 2).forEach(topic => {
        const chip = document.createElement("span");
        chip.className = "ma-track-topic";
        chip.textContent = topic;
        topics.append(chip);
      });
      button.append(title, topics);
      button.addEventListener("click", () => choose(index, true));
      tabList.append(button);
      return button;
    });
    const footer = document.createElement("div");
    footer.className = "ma-track-controls__footer";
    const status = document.createElement("span");
    status.textContent = "يتبدل المسار تلقائياً كل 4.5 ثوانٍ";
    const toggle = makeButton("إيقاف الحركة", "", { "data-track-toggle": "", "aria-pressed": "false" });
    footer.append(status, toggle);
    controller.append(tabList, footer);
    section.append(controller);

    let index = 0;
    let timer = 0;
    let userPaused = false;
    let hovered = false;
    let focused = false;
    let inView = false;
    let syncingOriginal = false;
    let visibilityObserver = null;
    let previousTrackNodes = null;
    const activeLabel = controller.querySelector("[data-track-current]");

    function setStatus() {
      const running = !userPaused && !hovered && !focused && inView && !document.hidden && !reduceMotion.matches;
      controller.dataset.autoplay = running ? "running" : "paused";
      toggle.textContent = userPaused ? "استئناف الحركة" : "إيقاف الحركة";
      toggle.setAttribute("aria-pressed", String(userPaused));
      if (timer) clearInterval(timer);
      timer = running ? setInterval(() => choose((index + 1) % tracks.length, false), 4500) : 0;
    }

    function bindOriginalTrackTargets() {
      const titleNodes = [...section.querySelectorAll("span,div")].filter(node =>
        node.children.length === 0 && !controller.contains(node) &&
        tracks.some(track => node.textContent.trim() === track.title)
      );
      titleNodes.forEach(node => {
        const selected = tracks.findIndex(track => node.textContent.trim() === track.title);
        node.dataset.maTrackDiagramIndex = String(selected);
      });
      const changed = previousTrackNodes &&
        (previousTrackNodes.length !== titleNodes.length || previousTrackNodes.some((node, i) => node !== titleNodes[i]));
      previousTrackNodes = titleNodes;
      if (changed) section.__maSelectTrack?.(index);
    }
    section.__maBindOriginalTrackTargets = bindOriginalTrackTargets;
    section.__maSelectTrack = selected => choose(selected, false);

    function activateOriginalTrack(track) {
      const titleNode = [...section.querySelectorAll("span,div")].find(el =>
        !controller.contains(el) && el.children.length === 0 && el.textContent.trim() === track.title
      );
      if (titleNode) {
        syncingOriginal = true;
        (titleNode.closest('div[style*="cursor"]') || titleNode).click();
        syncingOriginal = false;
      }
    }

    function originalTrackTarget(event) {
      if (syncingOriginal || controller.contains(event.target)) return;
      let label = event.target.closest("[data-ma-track-diagram-index]");
      if (!label) {
        const card = event.target.closest('div[style*="cursor"]');
        label = card?.querySelector("[data-ma-track-diagram-index]");
      }
      if (label) choose(Number(label.dataset.maTrackDiagramIndex), true);
    }

    function choose(nextIndex, manual) {
      index = (nextIndex + tracks.length) % tracks.length;
      activeLabel.textContent = tracks[index].title;
      controller.dataset.activeIndex = String(index);
      buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
      activateOriginalTrack(tracks[index]);
      if (gsap && !reduceMotion.matches) {
        gsap.fromTo(buttons[index], { opacity: .72, y: 4 }, { opacity: 1, y: 0, duration: .38, ease: "power2.out", overwrite: true });
      }
      if (manual) setStatus();
    }

    const onOriginalTrackClick = event => originalTrackTarget(event);
    const onOriginalTrackFocus = event => {
      focused = true;
      setStatus();
      originalTrackTarget(event);
    };
    const onTrackFocusOut = event => {
      if (!section.contains(event.relatedTarget)) { focused = false; setStatus(); }
    };
    const onTrackMouseEnter = () => { hovered = true; setStatus(); };
    const onTrackMouseLeave = () => { hovered = false; setStatus(); };
    section.addEventListener("click", onOriginalTrackClick);
    section.addEventListener("focusin", onOriginalTrackFocus);

    // Pause when the user is exploring any part of this section, not just our controls.
    section.addEventListener("mouseenter", onTrackMouseEnter);
    section.addEventListener("mouseleave", onTrackMouseLeave);
    section.addEventListener("focusout", onTrackFocusOut);
    toggle.addEventListener("click", () => { userPaused = !userPaused; setStatus(); });
    document.addEventListener("visibilitychange", setStatus);
    reduceMotion.addEventListener?.("change", setStatus);
    if ("IntersectionObserver" in window) {
      visibilityObserver = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; setStatus(); }, { threshold: .12 });
      visibilityObserver.observe(section);
    } else {
      inView = true;
    }
    bindOriginalTrackTargets();
    choose(0, false);
    setStatus();
    return () => {
      if (timer) clearInterval(timer);
      visibilityObserver?.disconnect();
      document.removeEventListener("visibilitychange", setStatus);
      reduceMotion.removeEventListener?.("change", setStatus);
      section.removeEventListener("click", onOriginalTrackClick);
      section.removeEventListener("focusin", onOriginalTrackFocus);
      section.removeEventListener("focusout", onTrackFocusOut);
      section.removeEventListener("mouseenter", onTrackMouseEnter);
      section.removeEventListener("mouseleave", onTrackMouseLeave);
      section.__maBindOriginalTrackTargets = null;
      section.__maSelectTrack = null;
    };
  }

  function setupMethod(section) {
    section.dataset.maMethodMounted = "true";
    section.dataset.methodPhase = "during";
    const onMethodClick = event => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.textContent.trim() === "أثناء التدريب") section.dataset.methodPhase = "during";
      if (button.textContent.trim() === "بعد التدريب") section.dataset.methodPhase = "after";
      tagMethodCards(section);
    };
    section.addEventListener("click", onMethodClick);
    tagMethodCards(section);
    return () => section.removeEventListener("click", onMethodClick);
  }

  function tagMethodCards(section) {
    const cards = [...section.querySelectorAll(".mt-card")];
    cards.forEach((card, index) => {
      card.parentElement.dataset.methodJourney = "";
      const numbers = section.dataset.methodPhase === "after" ? ["04", "05"] : ["01", "02"];
      const number = numbers[index] || String(index + 1).padStart(2, "0");
      card.dataset.methodStage = number;
      card.dataset.methodCard = "";
      let stageMarker = card.querySelector(".ma-method-step");
      if (!stageMarker) {
        stageMarker = document.createElement("span");
        stageMarker.className = "ma-method-step";
        stageMarker.setAttribute("aria-hidden", "true");
        card.prepend(stageMarker);
      }
      if (stageMarker.textContent !== number) stageMarker.textContent = number;
    });
    const tabs = [...section.querySelectorAll("button")].filter(button =>
      ["أثناء التدريب", "بعد التدريب"].includes(button.textContent.trim())
    );
    tabs.forEach(button => button.dataset.methodTab = button.textContent.trim() === "أثناء التدريب" ? "during" : "after");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhancementReady, { once: true });
  } else {
    enhancementReady();
  }
})();
