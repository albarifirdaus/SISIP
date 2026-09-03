(() => {
  const DISPLAY_TIME = 6000;
  const FADE_TIME = 560;
  const startedAt = performance.now();
  const loader = document.getElementById("siteLoader");
  const video = document.getElementById("siteLoaderVideo");

  if (!loader) {
    document.body.classList.remove("site-loading");
    return;
  }

  const finish = () => {
    loader.classList.add("is-leaving");
    document.body.classList.remove("site-loading");
    window.setTimeout(() => {
      video?.pause();
      loader.remove();
    }, FADE_TIME);
  };

  video?.addEventListener("error", () => loader.classList.add("has-video-error"), { once: true });
  video?.play().catch(() => loader.classList.add("has-video-error"));

  const remaining = Math.max(0, DISPLAY_TIME - (performance.now() - startedAt));
  window.setTimeout(finish, remaining);
})();
