(() => {
  "use strict";

  function create(options = {}) {
    const likedIds = new Set();
    const esc = options.escapeHtml || ((value) => String(value));

    function replace(ids) { likedIds.clear(); for (const id of ids || []) likedIds.add(String(id)); }
    function clear() { likedIds.clear(); }
    function applyExternal(lookId, liked) { if (liked) likedIds.add(lookId); else likedIds.delete(lookId); }

    function button(entry, compact = false) {
      const liked = likedIds.has(entry.id);
      const label = liked ? "Disukai" : "Sukai look";
      const accessibleLabel = `${label} ${esc(entry.title)}`;
      return `<button class="look-like-button${liked ? " is-liked" : ""}${compact ? " is-compact" : ""}" type="button" data-toggle-main-like="${esc(entry.id)}" aria-pressed="${String(liked)}" aria-label="${accessibleLabel}" title="${accessibleLabel}"><svg class="social-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"/></svg><span>${entry.popularity || 0}</span></button>`;
    }

    async function toggle(lookId) {
      const entry = options.getLook(lookId);
      if (!entry) return;
      const cloud = options.getCloud();
      if (!options.isCloudEnabled() || typeof cloud?.toggleLookLike !== "function") { options.notify("Fitur like aktif saat katalog cloud COMOOTD terhubung."); return; }
      if (!options.isSignedIn()) { options.notify("Masuk untuk menyukai look."); options.requireSignIn(); return; }
      try {
        const wasLiked = likedIds.has(lookId);
        const result = await cloud.toggleLookLike(lookId);
        const liked = Boolean(result?.liked);
        applyExternal(lookId, liked);
        entry.popularity = Math.max(0, Number(entry.popularity || 0) + (liked === wasLiked ? 0 : liked ? 1 : -1));
        options.onUpdated(entry);
        options.emit?.({ source:"main", lookId, liked, delta:liked === wasLiked ? 0 : liked ? 1 : -1 });
      } catch (error) { options.notify(error?.message || "Like belum dapat disimpan."); }
    }

    return { button, toggle, replace, clear, applyExternal, has:(lookId) => likedIds.has(lookId) };
  }

  window.COMOOTDLookLikes = Object.freeze({ create });
})();
