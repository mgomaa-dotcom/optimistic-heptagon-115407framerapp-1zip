(() => {
  const videoId = "1xNjiL8OELY";
  // Keep one host/player when Framer replaces its surrounding section.
  const host = document.createElement("div");
  host.className = "academy-video";
  host.style.background = `#111113 url(https://i.ytimg.com/vi/${videoId}/hqdefault.jpg) center / cover no-repeat`;
  const target = document.createElement("div");
  const notice = document.createElement("div");
  notice.className = "academy-video-error";
  notice.hidden = true;
  notice.setAttribute("role", "status");
  const message = document.createElement("span");
  const play = document.createElement("button");
  play.type = "button";
  play.textContent = "تشغيل الفيديو";
  const link = document.createElement("a");
  link.href = `https://www.youtube.com/watch?v=${videoId}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "شاهد على YouTube";
  notice.append(message, play, link);
  host.append(target, notice);

  let player;
  let ready = false;
  let loading = false;
  let inView = false;
  let manuallyPaused = false;
  let ended = false;
  let automaticPause = false;
  const showNotice = (text, canPlay) => {
    message.textContent = text;
    play.hidden = !canPlay;
    notice.hidden = false;
  };
  const syncPlayback = () => {
    if (!ready) return;
    if (!inView || document.hidden) {
      if ([1, 3].includes(player.getPlayerState())) {
        automaticPause = true;
        player.pauseVideo();
      }
    } else if (!manuallyPaused && !ended) {
      player.playVideo();
    }
  };
  const createPlayer = () => {
    player = new window.YT.Player(target, {
      videoId,
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 0, controls: 1, playsinline: 1, mute: 1,
        rel: 0, origin: window.location.origin,
      },
      events: {
        onReady: () => {
          ready = true;
          const iframe = player.getIframe();
          iframe.title = "فيديو تعريفي بأكاديمية ماستري للمبيعات";
          iframe.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen");
          player.mute();
          syncPlayback();
        },
        onStateChange: event => {
          if (event.data === 1) {
            notice.hidden = true;
            manuallyPaused = false;
            ended = false;
            automaticPause = false;
            if (!inView || document.hidden) syncPlayback();
          } else if (event.data === 2) {
            if (!automaticPause && inView && !document.hidden) manuallyPaused = true;
            automaticPause = false;
          } else if (event.data === 0) ended = true;
        },
        onAutoplayBlocked: () => showNotice("اضغط لتشغيل الفيديو.", true),
        onError: () => showNotice("تعذّر تشغيل الفيديو هنا. يمكنك مشاهدته على YouTube.", false),
      },
    });
  };
  const load = () => {
    if (loading) return;
    loading = true;
    if (window.YT?.Player) {
      createPlayer();
      return;
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previous) previous();
      createPlayer();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => showNotice("تعذّر تحميل الفيديو. شاهده على YouTube.", false);
    document.head.append(script);
  };
  play.addEventListener("click", () => {
    manuallyPaused = false;
    ended = false;
    notice.hidden = true;
    if (ready) player.playVideo();
  });
  document.addEventListener("visibilitychange", syncPlayback);
  new IntersectionObserver(entries => {
    const entry = entries[entries.length - 1];
    inView = entry.isIntersecting && entry.intersectionRatio >= 0.35;
    if (inView) load();
    syncPlayback();
  }, { threshold: [0, 0.35] }).observe(host);

  const mount = () => {
    const frame = document.querySelector('[data-framer-name="إطار الفيديو"]');
    if (!frame) return;
    frame.id = "academy-video";
    if (host.parentElement !== frame) frame.append(host);
  };
  mount();
  new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
})();
