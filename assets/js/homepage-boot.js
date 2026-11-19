/* Apply first-paint hero copy before the deferred enhancement and Framer run.
   Observe text changes too: hydration can replace only a text node. */
(() => {
  "use strict";
  const title = "من استراتيجيات الإقناع والتفاوض الي اغلاق الصفقات و كسب ولاء العملاء";
  const label = "اكاديميه المبيعات و خدمه العملاء";
  let pending = false;
  const retained = new Map();

  function retainTextBlock(parent, selector, key, after = null) {
    if (!parent) return;
    let state = retained.get(key);
    if (!state) retained.set(key, state = {});
    const original = [...parent.querySelectorAll(selector)].find(node =>
      !node.closest("[data-ma-hydration-fallback]"));
    if (original) {
      const signature = original.outerHTML;
      if (signature !== state.signature) {
        state.signature = signature;
        state.snapshot = original.cloneNode(true);
        state.snapshot.dataset.maHydrationFallback = key;
      }
      state.fallback?.remove();
      state.fallback = null;
    } else if (state.snapshot && !state.fallback?.isConnected) {
      // Framer's responsive RichText boundaries can be absent for several
      // frames, not merely replaced within one commit. Retain only the last
      // real text block, then remove it as soon as the live block returns.
      state.fallback = state.snapshot.cloneNode(true);
      if (after) after.after(state.fallback);
      else parent.prepend(state.fallback);
    }
  }

  function restoreCopy() {
    pending = false;
    const content = document.querySelector(".framer-9nhah2 .framer-quxnty");
    if (!content) return;
    const heading = content.querySelector(".framer-14tqi72 h1");
    if (heading && heading.textContent !== title) heading.textContent = title;
    let kicker = content.querySelector(":scope > .ma-hero-kicker");
    if (!kicker) {
      kicker = document.createElement("p");
      kicker.className = "ma-hero-kicker";
      kicker.dir = "rtl";
      content.prepend(kicker);
    }
    if (kicker.textContent !== label) kicker.textContent = label;
    const copy = content.querySelector(".framer-14tqi72");
    retainTextBlock(copy, ".framer-158q6ga", "hero-heading");
    retainTextBlock(copy, ".framer-7g44gx", "hero-description",
      copy?.querySelector(".framer-158q6ga"));
    retainTextBlock(document.querySelector("#numbers .framer-ppco5e"),
      ".framer-1bzp11m", "numbers-heading");
  }

  const observer = new MutationObserver(records => {
    if (pending) return;
    const relevant = records.some(({ target }) => {
      const element = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
      return element && (
        element === document.documentElement ||
        element.id === "main" ||
        element.matches("body, [data-framer-root]") ||
        element.closest(".framer-9nhah2") ||
        (element.closest("#numbers") && !element.closest(".ma-number-value"))
      );
    });
    if (!relevant) return;
    pending = true;
    // Run in the same rendering turn, never paint reverted export copy.
    queueMicrotask(restoreCopy);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  restoreCopy();
})();
