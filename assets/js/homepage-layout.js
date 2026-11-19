(() => {
  "use strict";

  const HERO_LABEL = "اكاديميه المبيعات و خدمه العملاء";
  const HERO_HEADING = "من استراتيجيات الإقناع والتفاوض الي اغلاق الصفقات و كسب ولاء العملاء";
  const SERVICE_TITLE = "مسار خدمه العملاء";
  const NUMBER_TARGETS = ["+100k", "+300", "+10"];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let activeTracks = null;
  let activeHeroMotion = null;
  let activeNumbers = null;
  let scheduled = false;

  function addHeroEnhancements() {
    const hero = document.querySelector(".framer-firmG .framer-9nhah2");
    if (!hero) return;
    const content = hero.querySelector(".framer-quxnty");
    const heading = hero.querySelector(".framer-14tqi72 h1");
    if (content && heading) {
      if (heading.textContent.trim() !== HERO_HEADING) heading.textContent = HERO_HEADING;
      let kicker = content.querySelector(":scope > .ma-hero-kicker");
      if (!kicker) {
        kicker = document.createElement("p");
        kicker.className = "ma-hero-kicker";
        kicker.textContent = HERO_LABEL;
        content.prepend(kicker);
      } else if (kicker.textContent !== HERO_LABEL) {
        kicker.textContent = HERO_LABEL;
      }
    }

    // Remove the lone decorative lock glyph retained by the exported dashboard.
    const dashboard = hero.querySelector(".framer-1cu329x");
    if (dashboard && !dashboard.dataset.maEmojiCleaned) {
      const walker = document.createTreeWalker(dashboard, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      textNodes.forEach(node => {
        if (node.nodeValue.includes("🔒")) node.nodeValue = node.nodeValue.replaceAll("🔒", "").trimStart();
      });
      dashboard.dataset.maEmojiCleaned = "true";
    }
  }

  function makeMasteryMark() {
    const mark = document.createElement("div");
    mark.className = "ma-number-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.innerHTML = '<svg viewBox="0 0 133 55" focusable="false"><rect x="0" y="26.5" width="21.5" height="25"></rect><path d="M21 0h6c4 0 6 1.5 9 4.5L52.5 21c3 3 5.5 4.5 9.5 4.5h4.5V55H62c-4 0-6.5-1.5-9.5-4.5L36 34c-3-3-5-4.5-9-4.5h-6z"></path><path transform="translate(45 0)" d="M21 0h6c4 0 6 1.5 9 4.5L52.5 21c3 3 5.5 4.5 9.5 4.5h4.5V55H62c-4 0-6.5-1.5-9.5-4.5L36 34c-3-3-5-4.5-9-4.5h-6z"></path><rect x="111" y="3.5" width="22" height="25"></rect></svg>';
    return mark;
  }

  function startCount(span) {
    if (span.dataset.maCounted === "true") return;
    const finalValue = span.dataset.maFinalValue || span.textContent.trim();
    const match = finalValue.match(/^\+(\d+)(k?)$/i);
    if (!match) return;
    span.dataset.maFinalValue = finalValue;
    span.dataset.maCounted = "true";
    span.setAttribute("aria-label", finalValue);
    span.setAttribute("aria-live", "off");
    if (reduceMotion.matches) {
      span.textContent = finalValue;
      return;
    }
    const target = Number(match[1]);
    const suffix = match[2];
    const start = performance.now();
    const duration = 1100;
    const tick = now => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(target * eased);
      span.textContent = progress >= 1 ? finalValue : `+${current}${suffix}`;
      if (progress < 1) span.maCountFrame = requestAnimationFrame(tick);
      else span.maCountFrame = 0;
    };
    span.maCountFrame = requestAnimationFrame(tick);
  }

  function mountNumberOrbit(section) {
    const container = section.querySelector(".framer-10lv4ot-container");
    const stage = container?.querySelector(":scope > div");
    if (!container || !stage) return null;

    const stats = [...stage.children].filter(node => {
      const value = node.querySelector("span");
      return value && /^\+\d+k?$/i.test(value.textContent.trim());
    }).slice(0, 3);
    if (stats.length !== 3) return null;

    const orbit = document.createElement("div");
    orbit.className = "ma-number-orbit";
    orbit.setAttribute("aria-hidden", "false");
    const details = document.createElement("div");
    details.className = "ma-number-details";
    details.setAttribute("role", "list");
    details.setAttribute("aria-label", "تفاصيل أرقام ماستري");
    const motionButton = document.createElement("button");
    motionButton.type = "button";
    motionButton.className = "ma-number-motion-control";
    motionButton.textContent = "إيقاف الحركة";
    motionButton.setAttribute("aria-label", "إيقاف حركة أرقام ماستري");
    motionButton.setAttribute("aria-pressed", "false");

    stats.forEach((stat, index) => {
      const value = stat.querySelector("span");
      const children = [...stat.children];
      const label = children[1];
      const description = children[2];
      stat.classList.add("ma-number-stat");
      stat.dataset.maOrbitIndex = String(index);
      stat.setAttribute("role", "group");
      stat.setAttribute("aria-labelledby", `ma-number-label-${index}`);
      if (label) label.id = `ma-number-label-${index}`;
      if (description) {
        const detail = document.createElement("div");
        detail.className = "ma-number-detail";
        detail.setAttribute("role", "listitem");
        if (label) {
          const detailLabel = document.createElement("h3");
          detailLabel.textContent = label.textContent.trim();
          detail.append(detailLabel);
        }
        description.classList.add("ma-number-detail-copy");
        detail.append(description);
        details.append(detail);
        stat.maOriginalDescription = description;
      }
      if (value) {
        value.classList.add("ma-number-value");
        value.dataset.maFinalValue = NUMBER_TARGETS[index];
        value.setAttribute("aria-label", value.dataset.maFinalValue);
      }
      orbit.append(stat);
    });
    const masteryMark = makeMasteryMark();
    orbit.prepend(masteryMark);
    stage.classList.add("ma-number-stage");
    stage.dataset.maOrbitMounted = "true";
    stage.dataset.maMotionStatic = "true";
    stage.setAttribute("role", "group");
    stage.setAttribute("aria-label", "أرقام ماستري حول الشعار");
    stage.append(orbit);
    container.append(motionButton, details);

    let inView = false;
    let userPaused = false;
    let hasAnimated = false;
    let angle = -Math.PI / 2;
    let frame = 0;
    let lastFrameTime = 0;
    let visibilityObserver = null;
    let orbitRadii = { radiusX: 0, radiusY: 0 };

    function layoutOrbit() {
      const width = stage.getBoundingClientRect().width || Math.min(window.innerWidth - 28, 1120);
      let radiusX;
      let radiusY;
      if (window.innerWidth <= 520) {
        const cardWidth = Math.max(70, Math.min(104, width / 2 - 36));
        stats.forEach(stat => { stat.style.width = `${cardWidth}px`; });
        radiusX = Math.max(0, Math.min(112, width / 2 - cardWidth / 2 - 8));
        radiusY = 150;
      } else if (window.innerWidth <= 809) {
        stats.forEach(stat => stat.style.removeProperty("width"));
        radiusX = Math.min(240, width * .32);
        radiusY = 150;
      } else {
        stats.forEach(stat => stat.style.removeProperty("width"));
        radiusX = Math.min(280, width * .32);
        radiusY = 174;
      }
      orbit.style.setProperty("--ma-orbit-static-top", `${-radiusY}px`);
      orbit.style.setProperty("--ma-orbit-static-x", `${(radiusX * Math.sqrt(3) / 2).toFixed(2)}px`);
      orbit.style.setProperty("--ma-orbit-static-negative-x", `${(-radiusX * Math.sqrt(3) / 2).toFixed(2)}px`);
      orbit.style.setProperty("--ma-orbit-static-y", `${(radiusY / 2).toFixed(2)}px`);
      orbit.style.setProperty("--ma-orbit-ring-width", `${radiusX * 2}px`);
      orbit.style.setProperty("--ma-orbit-ring-height", `${radiusY * 2}px`);
      orbitRadii = { radiusX, radiusY };
    }

    function paintOrbit() {
      const { radiusX, radiusY } = orbitRadii;
      stats.forEach((stat, index) => {
        const point = angle + index * Math.PI * 2 / 3;
        const x = Math.cos(point) * radiusX;
        const y = Math.sin(point) * radiusY;
        stat.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      });
    }

    function finishCounters() {
      stats.forEach(stat => {
        const value = stat.querySelector(".ma-number-value");
        if (!value) return;
        if (value.maCountFrame) cancelAnimationFrame(value.maCountFrame);
        value.maCountFrame = 0;
        value.textContent = value.dataset.maFinalValue;
        value.dataset.maCounted = "true";
      });
    }

    function tick(now) {
      if (!inView || userPaused || document.hidden || reduceMotion.matches) {
        frame = 0;
        lastFrameTime = 0;
        return;
      }
      if (lastFrameTime) angle += (now - lastFrameTime) * (Math.PI * 2 / 72000);
      lastFrameTime = now;
      hasAnimated = true;
      stage.dataset.maMotionStatic = "false";
      paintOrbit();
      frame = requestAnimationFrame(tick);
    }

    function syncMotion() {
      const reduced = reduceMotion.matches;
      if (reduced) {
        finishCounters();
        stage.dataset.maMotionStatic = "true";
        stats.forEach(stat => stat.style.removeProperty("transform"));
        motionButton.textContent = "الحركة متوقفة";
        motionButton.setAttribute("aria-pressed", "true");
        motionButton.disabled = true;
      } else {
        stage.dataset.maMotionStatic = String(!hasAnimated);
        motionButton.textContent = userPaused ? "استئناف الحركة" : "إيقاف الحركة";
        motionButton.setAttribute("aria-pressed", String(userPaused));
        motionButton.disabled = false;
        if (inView) stats.forEach(stat => startCount(stat.querySelector(".ma-number-value")));
      }
      const shouldRun = inView && !userPaused && !document.hidden && !reduced;
      if (shouldRun && !frame) {
        lastFrameTime = 0;
        frame = requestAnimationFrame(tick);
      } else if (!shouldRun && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
        lastFrameTime = 0;
      }
    }

    function onMotionToggle() {
      if (reduceMotion.matches) return;
      userPaused = !userPaused;
      syncMotion();
    }
    const onVisibility = () => syncMotion();
    const onMotionPreference = () => syncMotion();
    const onResize = () => {
      layoutOrbit();
      if (hasAnimated && !reduceMotion.matches) paintOrbit();
    };
    motionButton.addEventListener("click", onMotionToggle);
    document.addEventListener("visibilitychange", onVisibility);
    reduceMotion.addEventListener?.("change", onMotionPreference);
    window.addEventListener("resize", onResize, { passive: true });
    if ("IntersectionObserver" in window) {
      visibilityObserver = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        if (inView && !reduceMotion.matches) {
          stats.forEach(stat => startCount(stat.querySelector(".ma-number-value")));
        }
        syncMotion();
      }, { threshold: .08 });
      visibilityObserver.observe(stage);
    } else {
      inView = true;
      stats.forEach(stat => startCount(stat.querySelector(".ma-number-value")));
    }
    layoutOrbit();
    syncMotion();

    const cleanup = () => {
      if (frame) cancelAnimationFrame(frame);
      visibilityObserver?.disconnect();
      motionButton.removeEventListener("click", onMotionToggle);
      document.removeEventListener("visibilitychange", onVisibility);
      reduceMotion.removeEventListener?.("change", onMotionPreference);
      window.removeEventListener("resize", onResize);
      finishCounters();
      stats.forEach(stat => {
        const stillInOrbit = stat.parentElement === orbit;
        const description = stat.maOriginalDescription;
        if (description) {
          description.classList.remove("ma-number-detail-copy");
          stat.append(description);
          delete stat.maOriginalDescription;
        }
        stat.classList.remove("ma-number-stat");
        delete stat.dataset.maOrbitIndex;
        stat.removeAttribute("role");
        stat.removeAttribute("aria-labelledby");
        stat.style.removeProperty("transform");
        stat.style.removeProperty("width");
        const value = stat.querySelector(".ma-number-value");
        value?.classList.remove("ma-number-value");
        value?.removeAttribute("aria-label");
        value?.removeAttribute("aria-live");
        if (stillInOrbit) stage.append(stat);
      });
      motionButton.remove();
      details.remove();
      orbit.remove();
      stage.classList.remove("ma-number-stage");
      delete stage.dataset.maOrbitMounted;
      delete stage.dataset.maMotionStatic;
      stage.removeAttribute("role");
      stage.removeAttribute("aria-label");
    };
    cleanup.control = motionButton;
    cleanup.stage = stage;
    cleanup.restore = () => {
      // Responsive hydration can remove individual original counter nodes
      // while retaining the stage itself. Reconnect retained nodes before paint
      // rather than resetting the orbit or restarting their count-up.
      if (orbit.parentElement !== stage) stage.append(orbit);
      if (masteryMark.parentElement !== orbit) orbit.prepend(masteryMark);
      stats.forEach(stat => {
        if (stat.parentElement !== orbit) orbit.append(stat);
      });
      if (motionButton.parentElement !== container) container.append(motionButton);
      if (details.parentElement !== container) container.append(details);
    };
    return cleanup;
  }

  function mountHeroMotion(hero) {
    const content = hero.querySelector(".framer-quxnty");
    if (!content) return null;
    let control = content.querySelector(".ma-hero-motion-control");
    if (!control) {
      control = document.createElement("button");
      control.type = "button";
      control.className = "ma-motion-control ma-hero-motion-control";
      control.textContent = "إيقاف الحركة";
      control.setAttribute("aria-pressed", "false");
      control.setAttribute("aria-label", "إيقاف حركة مرئيات الهيدر");
      content.append(control);
    }
    let inView = false;
    let userPaused = reduceMotion.matches;
    let visibilityObserver = null;
    const sync = () => {
      hero.dataset.maMotionPaused = String(userPaused);
      hero.dataset.maMotionHidden = String(!inView || document.hidden);
      control.textContent = reduceMotion.matches ? "الحركة متوقفة" : userPaused ? "استئناف الحركة" : "إيقاف الحركة";
      control.setAttribute("aria-pressed", String(userPaused || reduceMotion.matches));
      control.disabled = reduceMotion.matches;
    };
    const onClick = () => {
      if (reduceMotion.matches) return;
      userPaused = !userPaused;
      sync();
    };
    const onVisibility = () => sync();
    const onMotionPreference = () => {
      if (reduceMotion.matches) userPaused = true;
      sync();
    };
    control.addEventListener("click", onClick);
    document.addEventListener("visibilitychange", onVisibility);
    reduceMotion.addEventListener?.("change", onMotionPreference);
    if ("IntersectionObserver" in window) {
      visibilityObserver = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        sync();
      }, { threshold: .08 });
      visibilityObserver.observe(hero);
    } else inView = true;
    sync();
    const cleanup = () => {
      visibilityObserver?.disconnect();
      control.removeEventListener("click", onClick);
      document.removeEventListener("visibilitychange", onVisibility);
      reduceMotion.removeEventListener?.("change", onMotionPreference);
      control.remove();
      delete hero.dataset.maMotionPaused;
      delete hero.dataset.maMotionHidden;
    };
    cleanup.control = control;
    return cleanup;
  }

  function buildServiceBranch(section) {
    const svg = section.querySelector('.framer-iln5sx-container svg[viewBox="0 0 340 360"]');
    const diagram = svg?.parentElement;
    if (!svg || !diagram || diagram.querySelector(".ma-service-branch")) return;

    diagram.classList.add("ma-track-diagram");
    svg.setAttribute("viewBox", "0 0 340 488");
    svg.setAttribute("height", "488");
    const branchPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    branchPath.setAttribute("d", "M314 212 L314 436 L240 436");
    branchPath.classList.add("ma-service-branch-path");
    branchPath.setAttribute("aria-hidden", "true");
    const branchFlow = document.createElementNS("http://www.w3.org/2000/svg", "path");
    branchFlow.setAttribute("d", "M314 212 L314 436 L240 436");
    branchFlow.classList.add("ma-service-branch-flow");
    branchFlow.setAttribute("aria-hidden", "true");
    branchFlow.style.cssText = "opacity:.5;animation:2.4s linear 1.4s infinite tp-flow";
    const branchLink = document.createElementNS("http://www.w3.org/2000/svg", "path");
    branchLink.setAttribute("d", "M116 436 L112 436");
    branchLink.classList.add("ma-service-branch-link");
    branchLink.setAttribute("aria-hidden", "true");
    svg.append(branchPath, branchFlow, branchLink);

    const serviceTile = document.createElement("div");
    serviceTile.className = "ma-service-tile";
    serviceTile.setAttribute("aria-hidden", "true");
    serviceTile.innerHTML = '<div class="ma-service-tile__art"><svg class="ma-service-icon" viewBox="0 0 94 58" focusable="false" aria-hidden="true"><path d="M31 15.5h32a4 4 0 0 1 4 4v15a4 4 0 0 1-4 4H45l-8 5v-5h-6a4 4 0 0 1-4-4v-15a4 4 0 0 1 4-4Z" fill="none" stroke="currentColor" stroke-width="1.8"></path><path d="M38 25h18M38 31h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg></div><div class="ma-service-tile__copy"><div>التواصل الفعّال</div><div>كسب ولاء العملاء</div></div>';
    const label = document.createElement("div");
    label.className = "ma-service-branch";
    label.textContent = SERVICE_TITLE;
    label.setAttribute("aria-label", SERVICE_TITLE);
    diagram.append(serviceTile, label);
  }

  function mountTrackMotion(section) {
    const existing = section.querySelector(".ma-track-controls [data-track-toggle]");
    const customToggle = document.createElement("button");
    customToggle.type = "button";
    customToggle.className = "ma-motion-control";
    customToggle.textContent = "إيقاف الحركة";
    customToggle.setAttribute("aria-pressed", "false");
    customToggle.setAttribute("aria-label", "إيقاف حركة مسار التدريب");
    customToggle.dataset.maTrackMotionButton = "";
    section.append(customToggle);

    let inView = false;
    let userPaused = false;
    let visibilityObserver = null;
    const control = customToggle;
    const sync = () => {
      section.dataset.maMotionPaused = String(userPaused);
      section.dataset.maMotionHidden = String(!inView || document.hidden);
      customToggle.textContent = reduceMotion.matches
        ? "الحركة متوقفة"
        : userPaused ? "استئناف الحركة" : "إيقاف الحركة";
      customToggle.setAttribute("aria-pressed", String(userPaused || reduceMotion.matches));
      customToggle.disabled = reduceMotion.matches;
    };
    const onClick = event => {
      const clickedControl = event.target.closest(".ma-motion-control, [data-track-toggle]");
      if (!clickedControl || !section.contains(clickedControl)) return;
      if (reduceMotion.matches) return;
      userPaused = clickedControl === customToggle
        ? !userPaused
        : clickedControl.getAttribute("aria-pressed") === "true";
      sync();
      if (clickedControl === customToggle && existing &&
          existing.getAttribute("aria-pressed") !== String(userPaused)) {
        existing.click();
      }
    };
    const onVisibility = () => sync();
    const onMotionPreference = () => {
      if (reduceMotion.matches) userPaused = true;
      sync();
    };
    section.addEventListener("click", onClick);
    document.addEventListener("visibilitychange", onVisibility);
    reduceMotion.addEventListener?.("change", onMotionPreference);
    if ("IntersectionObserver" in window) {
      visibilityObserver = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        sync();
      }, { threshold: .08 });
      visibilityObserver.observe(section);
    } else {
      inView = true;
    }
    if (reduceMotion.matches) userPaused = true;
    sync();
    const cleanup = () => {
      visibilityObserver?.disconnect();
      section.removeEventListener("click", onClick);
      document.removeEventListener("visibilitychange", onVisibility);
      reduceMotion.removeEventListener?.("change", onMotionPreference);
      customToggle?.remove();
      delete section.dataset.maMotionPaused;
      delete section.dataset.maMotionHidden;
    };
    cleanup.control = control;
    return cleanup;
  }

  function reconcile() {
    scheduled = false;
    addHeroEnhancements();
    const hero = document.querySelector(".framer-firmG .framer-9nhah2");
    // The small script runs in the head so completed sections are enhanced in
    // the parser's rendering turn. Never move nodes out of an unfinished section.
    const parsed = section => document.readyState !== "loading" || Boolean(section?.nextElementSibling);
    if (hero && parsed(hero) && (!activeHeroMotion || activeHeroMotion.hero !== hero || !activeHeroMotion.cleanup.control.isConnected)) {
      activeHeroMotion?.cleanup();
      const cleanup = mountHeroMotion(hero);
      activeHeroMotion = cleanup ? { hero, cleanup } : null;
    } else if (!hero && activeHeroMotion) {
      activeHeroMotion.cleanup();
      activeHeroMotion = null;
    }
    const numbers = document.getElementById("numbers");
    const numberStage = numbers?.querySelector(".framer-10lv4ot-container > div");
    if (numberStage && activeNumbers?.stage === numberStage) activeNumbers.cleanup.restore();
    const numberMounted = numberStage?.querySelector(".ma-number-orbit") &&
      numbers.querySelector(".ma-number-motion-control") &&
      numberStage.querySelector(".ma-number-mark");
    if (numberStage && parsed(numbers) && (!activeNumbers || activeNumbers.stage !== numberStage || !numberMounted)) {
      activeNumbers?.cleanup();
      const cleanup = mountNumberOrbit(numbers);
      activeNumbers = cleanup ? { stage: numberStage, cleanup } : null;
    } else if (!numberStage && activeNumbers) {
      activeNumbers.cleanup();
      activeNumbers = null;
    }
    const tracks = document.getElementById("tracks");
    if (tracks && parsed(tracks)) {
      buildServiceBranch(tracks);
      if (!activeTracks || activeTracks.section !== tracks || !activeTracks.cleanup.control.isConnected) {
        activeTracks?.cleanup();
        const cleanup = mountTrackMotion(tracks);
        activeTracks = { section: tracks, cleanup };
      }
    } else if (activeTracks) {
      activeTracks.cleanup();
      activeTracks = null;
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(reconcile);
  }

  const observer = new MutationObserver(records => {
    const relevant = records.some(({ target, type }) => {
      const element = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
      // Framer may restore just the H1 text node after hydration without
      // replacing any element. Keep the requested copy in that case too.
      if (type === "characterData") return Boolean(element?.closest(".framer-14tqi72 h1"));
      return !element?.closest(".ma-number-value, .ma-number-motion-control, .ma-number-details, .ma-motion-control");
    });
    if (relevant) schedule();
  });
  observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true });
  document.addEventListener("DOMContentLoaded", schedule, { once: true });
  window.addEventListener("pageshow", schedule);
  if (reduceMotion.addEventListener) {
    reduceMotion.addEventListener("change", () => {
      if (reduceMotion.matches) {
        document.querySelectorAll("#numbers .ma-number-value").forEach(value => {
          if (value.maCountFrame) cancelAnimationFrame(value.maCountFrame);
          value.textContent = value.dataset.maFinalValue || value.textContent;
        });
        const tracks = document.getElementById("tracks");
        if (tracks) tracks.dataset.maMotionPaused = "true";
      }
    });
  }
  schedule();
})();
