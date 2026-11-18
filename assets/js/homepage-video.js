(() => {
  // Framer can replace the frame during hydration. Retain one player instance.
  const player = document.createElement("video");
  player.controls = true;
  player.playsInline = true;
  player.preload = "none";
  player.src = "/media/academy-introduction.mp4";
  player.poster = "/assets/images/academy-video-poster.jpg";
  player.setAttribute("aria-label", "فيديو تعريفي بأكاديمية ماستري للمبيعات");
  player.className = "academy-video";
  player.textContent = "متصفحك لا يدعم تشغيل الفيديو.";

  const error = document.createElement("div");
  error.className = "academy-video-error";
  error.hidden = true;
  const message = document.createElement("span");
  message.textContent = "تعذّر تشغيل الفيديو. يرجى المحاولة مجدداً.";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "إعادة المحاولة";
  retry.addEventListener("click", () => {
    error.hidden = true;
    player.load();
    player.play().catch(() => { error.hidden = !player.error; });
  });
  error.append(message, retry);
  player.addEventListener("error", () => { error.hidden = false; });
  player.addEventListener("loadeddata", () => { error.hidden = true; });

  const mount = () => {
    const frame = document.querySelector('[data-framer-name="إطار الفيديو"]');
    if (!frame) return;
    frame.id = "academy-video";
    if (player.parentElement !== frame) frame.append(player, error);
  };
  mount();
  new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
})();
