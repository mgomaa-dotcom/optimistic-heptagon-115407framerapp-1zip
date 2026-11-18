(() => {
  // Framer can replace the frame during hydration. Retain one player instance.
  const player = document.createElement("video");
  player.controls = true;
  player.playsInline = true;
  player.preload = "none";
  player.defaultMuted = true;
  player.muted = true;
  player.src = "/media/academy-introduction.mp4";
  player.poster = "/assets/images/academy-video-poster.jpg";
  player.setAttribute("aria-label", "فيديو تعريفي بأكاديمية ماستري للمبيعات");
  player.className = "academy-video";
  player.textContent = "متصفحك لا يدعم تشغيل الفيديو.";

  let inView = false;
  let manuallyPaused = false;
  let automaticPause = false;
  let playPending = false;
  const pauseOffscreen = () => {
    if (!player.paused) {
      automaticPause = true;
      player.pause();
    }
  };
  const syncPlayback = () => {
    if (!inView || document.hidden) {
      pauseOffscreen();
      return;
    }
    if (manuallyPaused || player.ended || !player.paused || playPending) return;
    playPending = true;
    player.play().then(() => {
      // The visitor may have scrolled away while the media was loading.
      if (!inView || document.hidden) pauseOffscreen();
    }).catch(() => {
      // Browser/data-saving restrictions: keep native play controls available.
    }).finally(() => { playPending = false; });
  };
  player.addEventListener("pause", () => {
    if (automaticPause) automaticPause = false;
    else if (inView && !document.hidden && !player.ended) manuallyPaused = true;
  });
  player.addEventListener("play", () => {
    manuallyPaused = false;
    if (!inView || document.hidden) pauseOffscreen();
  });
  document.addEventListener("visibilitychange", syncPlayback);
  const visibility = new IntersectionObserver(entries => {
    const entry = entries[entries.length - 1];
    inView = entry.isIntersecting && entry.intersectionRatio >= 0.35;
    syncPlayback();
  }, { threshold: [0, 0.35] });
  visibility.observe(player);

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
