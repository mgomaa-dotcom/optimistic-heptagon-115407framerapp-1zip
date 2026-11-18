(() => {
  const page = document.querySelector("[data-thank-you]");
  if (!page) return;

  document.documentElement.classList.add("js-ready");

  const check = page.querySelector(".seal-check");
  if (check && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    check.style.strokeDashoffset = "0";
  }
})();
