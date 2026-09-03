(() => {
  try {
    const navigation = performance.getEntriesByType("navigation")[0];
    const isReload = navigation?.type === "reload" || performance.navigation?.type === 1;
    const referrerIsInternal = document.referrer
      ? new URL(document.referrer).origin === window.location.origin
      : false;
    const introSeen = sessionStorage.getItem("comootd:intro-seen") === "1";

    if (introSeen && referrerIsInternal && !isReload) {
      document.documentElement.classList.add("skip-site-loader");
    }

    sessionStorage.setItem("comootd:intro-seen", "1");
  } catch {}
})();
