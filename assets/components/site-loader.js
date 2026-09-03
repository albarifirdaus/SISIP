(() => {
  const MINIMUM_TIME = 900;
  const MAXIMUM_TIME = 3000;
  const FADE_TIME = 320;
  const loader = document.getElementById("siteLoader");

  if (document.documentElement.classList.contains("skip-site-loader")) {
    document.body.classList.remove("site-loading");
    loader?.remove();
    return;
  }

  if (!loader) {
    document.body.classList.remove("site-loading");
    return;
  }

  const finish = () => {
    if (loader.classList.contains("is-leaving")) return;
    loader.classList.add("is-leaving");
    document.body.classList.remove("site-loading");
    window.setTimeout(() => loader.remove(), FADE_TIME);
  };

  let minimumElapsed = false;
  let pageReady = document.readyState !== "loading";

  const finishWhenReady = () => {
    if (minimumElapsed && pageReady) finish();
  };

  window.setTimeout(() => {
    minimumElapsed = true;
    finishWhenReady();
  }, MINIMUM_TIME);

  if (!pageReady) {
    document.addEventListener("DOMContentLoaded", () => {
      pageReady = true;
      finishWhenReady();
    }, { once: true });
  }

  window.setTimeout(finish, MAXIMUM_TIME);
})();
