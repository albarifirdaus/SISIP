(() => {
  "use strict";

  function create(options = {}) {
    const { getState, getCloud, isSignedIn, requireSignIn, notify, escapeHtml, onChange } = options;
    const esc = escapeHtml || ((value) => String(value ?? ""));
    const state = { collections:[], savedItems:[], followedCuratorIds:new Set(), recentlyViewed:[], loading:false };
    const cloud = () => getCloud?.();
    const defaultCollection = () => state.collections.find((item) => item.isDefault) || null;
    const savedIn = (type, id, collectionId = defaultCollection()?.id) => state.savedItems.some((item) => item.collectionId === collectionId && item.targetType === type && item.targetId === String(id));
    const entryFor = (type, id) => {
      const catalogue = getState?.() || {};
      if (type === "look") return (catalogue.looks || []).find((item) => String(item.id) === String(id));
      if (type === "product") return (catalogue.products || []).find((item) => String(item.id) === String(id));
      return (catalogue.curators || []).find((item) => String(item.userId || item.user_id) === String(id));
    };
    const titleFor = (type, id) => {
      const entry = entryFor(type, id);
      return entry?.title || entry?.name || entry?.displayName || entry?.display_name || "Konten sudah tidak tersedia";
    };
    const fireChange = () => {
      document.querySelectorAll("[data-retention-save]").forEach((button) => {
        const active = savedIn(button.dataset.retentionSave, button.dataset.retentionId);
        button.classList.toggle("is-saved", active);
        button.setAttribute("aria-pressed", String(active));
        button.setAttribute("aria-label", active ? "Hapus dari koleksi Disimpan" : "Simpan ke koleksi");
        const icon = button.querySelector("span:first-child");
        const label = button.querySelector("span:last-child:not(:first-child)");
        if (icon) icon.textContent = active ? "◆" : "◇";
        if (label) label.textContent = active ? "Tersimpan" : "Simpan";
      });
      onChange?.();
      window.dispatchEvent(new CustomEvent("comootd:retention-change", { detail:snapshot() }));
    };
    const snapshot = () => ({
      collections:state.collections.map((item) => ({ ...item })),
      savedItems:state.savedItems.map((item) => ({ ...item })),
      followedCuratorIds:[...state.followedCuratorIds],
      recentlyViewed:state.recentlyViewed.map((item) => ({ ...item }))
    });

    async function hydrate() {
      if (!isSignedIn?.() || typeof cloud()?.loadMemberRetentionState !== "function") {
        state.collections = []; state.savedItems = []; state.followedCuratorIds.clear(); state.recentlyViewed = [];
        fireChange();
        return snapshot();
      }
      state.loading = true;
      try {
        const remote = await cloud().loadMemberRetentionState();
        state.collections = remote.collections || [];
        state.savedItems = remote.savedItems || [];
        state.followedCuratorIds = new Set((remote.followedCuratorIds || []).map(String));
        state.recentlyViewed = remote.recentlyViewed || [];
        fireChange();
        return snapshot();
      } finally { state.loading = false; }
    }

    function saveButton(type, id, compact = false) {
      const saved = savedIn(type, String(id));
      return `<button class="retention-save-button${saved ? " is-saved" : ""}${compact ? " is-compact" : ""}" type="button" data-retention-save="${esc(type)}" data-retention-id="${esc(id)}" aria-label="${saved ? "Hapus dari koleksi Disimpan" : "Simpan ke koleksi"}" aria-pressed="${saved}"><span aria-hidden="true">${saved ? "◆" : "◇"}</span>${compact ? "" : `<span>${saved ? "Tersimpan" : "Simpan"}</span>`}</button>`;
    }

    function followButton(curatorId) {
      const followed = state.followedCuratorIds.has(String(curatorId));
      return `<button class="curator-share-button retention-follow-button${followed ? " is-followed" : ""}" type="button" data-retention-follow="${esc(curatorId)}" aria-pressed="${followed}">${followed ? "Mengikuti" : "Ikuti curator"} ${followed ? "✓" : "+"}</button>`;
    }

    async function toggleSave(type, id, collectionId = null) {
      if (!isSignedIn?.()) { requireSignIn?.(); return; }
      const api = cloud();
      if (typeof api?.toggleSavedItem !== "function") return;
      try {
        const result = await api.toggleSavedItem(type, id, collectionId);
        await hydrate();
        notify?.(result.saved ? "Ditambahkan ke koleksi." : "Dihapus dari koleksi.");
      } catch (error) { notify?.(error?.message || "Item belum dapat disimpan."); }
    }

    async function toggleFollow(curatorId) {
      if (!isSignedIn?.()) { requireSignIn?.(); return; }
      try {
        const result = await cloud()?.toggleCuratorFollow?.(curatorId);
        await hydrate();
        notify?.(result?.followed ? "Curator diikuti." : "Berhenti mengikuti Curator.");
      } catch (error) { notify?.(error?.message || "Status follow belum dapat diubah."); }
    }

    async function recordView(type, id) {
      if (!isSignedIn?.() || !id) return;
      if (window.COMOOTDPrivacy && !window.COMOOTDPrivacy.allowsActivityPersonalization?.()) return;
      const now = new Date().toISOString();
      state.recentlyViewed = [{ targetType:type, targetId:String(id), viewedAt:now }, ...state.recentlyViewed.filter((item) => !(item.targetType === type && item.targetId === String(id)))].slice(0, 40);
      fireChange();
      try { await cloud()?.recordRecentView?.(type, id); } catch (error) { console.warn("Unable to record member history", error); }
    }

    function signalStyles() {
      const styles = [];
      [...state.savedItems, ...state.recentlyViewed.slice(0, 12)].forEach((item) => {
        const entry = entryFor(item.targetType, item.targetId);
        (entry?.styles || entry?.jobTags || []).forEach((style) => styles.push(String(style).toLowerCase()));
      });
      return styles;
    }

    function score(entry, type) {
      const id = String(entry?.id || "");
      let value = state.savedItems.some((item) => item.targetType === type && item.targetId === id) ? 18 : 0;
      const curatorId = String(entry?.curator?.userId || entry?.creatorId || "");
      if (curatorId && state.followedCuratorIds.has(curatorId)) value += 14;
      const styles = new Set((entry?.styles || []).map((style) => String(style).toLowerCase()));
      signalStyles().forEach((style) => { if (styles.has(style)) value += 2; });
      const recentIndex = state.recentlyViewed.findIndex((item) => item.targetType === type && item.targetId === id);
      if (recentIndex >= 0) value += Math.max(1, 5 - recentIndex);
      return value;
    }
    function hasSignals() { return Boolean(state.savedItems.length || state.followedCuratorIds.size || state.recentlyViewed.length); }

    function savedRow(item, collection) {
      const otherCollections = state.collections.filter((candidate) => candidate.id !== collection.id);
      return `<li class="retention-item"><div><span>${esc(item.targetType === "look" ? "LOOK" : "PRODUK")}</span><strong>${esc(titleFor(item.targetType, item.targetId))}</strong></div><div class="retention-item-actions">${otherCollections.length ? `<select aria-label="Pilih koleksi tujuan" data-retention-target-collection>${otherCollections.map((candidate) => `<option value="${esc(candidate.id)}">${esc(candidate.name)}</option>`).join("")}</select><button type="button" data-retention-copy="${esc(item.targetType)}" data-retention-id="${esc(item.targetId)}">Tambah</button>` : ""}<button type="button" data-retention-remove="${esc(item.targetType)}" data-retention-id="${esc(item.targetId)}" data-retention-collection="${esc(collection.id)}">Hapus</button></div></li>`;
    }

    function renderPanel(root) {
      if (!root) return;
      if (!isSignedIn?.()) { root.innerHTML = ""; return; }
      const collections = state.collections.map((collection) => {
        const items = state.savedItems.filter((item) => item.collectionId === collection.id);
        return `<article class="retention-collection"><header><div><span class="eyebrow">${collection.isDefault ? "KOLEKSI UTAMA" : "KOLEKSI"}</span><h4>${esc(collection.name)}</h4></div>${collection.isDefault ? "" : `<button type="button" data-retention-delete-collection="${esc(collection.id)}">Hapus</button>`}</header>${items.length ? `<ul>${items.map((item) => savedRow(item, collection)).join("")}</ul>` : `<p>Belum ada item di koleksi ini.</p>`}</article>`;
      }).join("");
      const followed = [...state.followedCuratorIds].map((id) => titleFor("curator", id));
      const recent = state.recentlyViewed.slice(0, 8).map((item) => `<li><span>${esc(item.targetType.toUpperCase())}</span><strong>${esc(titleFor(item.targetType, item.targetId))}</strong></li>`).join("");
      root.innerHTML = `<div class="retention-panel-head"><div><p class="eyebrow" style="color:var(--clay)">YOUR COMOOTD</p><h3>Simpan, susun, kembali lagi.</h3></div><p>Koleksi dan riwayat hanya bisa dilihat dari akunmu.</p></div><form class="retention-create" data-retention-create-collection><input name="collectionName" maxlength="60" required placeholder="Nama koleksi baru" /><button class="button-outline" type="submit">+ Buat koleksi</button></form><div class="retention-collections">${collections || `<p class="member-help">Simpan satu look atau produk untuk membuat koleksi utama.</p>`}</div><div class="retention-summary"><article><span class="eyebrow">CURATOR DIIKUTI</span><p>${followed.length ? esc(followed.join(" · ")) : "Belum mengikuti Curator."}</p></article><article><span class="eyebrow">TERAKHIR DILIHAT</span>${recent ? `<ul>${recent}</ul>` : `<p>Riwayatmu masih kosong.</p>`}</article></div>`;
    }

    document.addEventListener("click", (event) => {
      const save = event.target.closest("[data-retention-save]");
      if (save) { event.preventDefault(); event.stopPropagation(); void toggleSave(save.dataset.retentionSave, save.dataset.retentionId); return; }
      const follow = event.target.closest("[data-retention-follow]");
      if (follow) { event.preventDefault(); void toggleFollow(follow.dataset.retentionFollow); return; }
      const remove = event.target.closest("[data-retention-remove]");
      if (remove) { void toggleSave(remove.dataset.retentionRemove, remove.dataset.retentionId, remove.dataset.retentionCollection); return; }
      const copy = event.target.closest("[data-retention-copy]");
      if (copy) { const collectionId = copy.parentElement?.querySelector("[data-retention-target-collection]")?.value; if (collectionId) void toggleSave(copy.dataset.retentionCopy, copy.dataset.retentionId, collectionId); return; }
      const removeCollection = event.target.closest("[data-retention-delete-collection]");
      if (removeCollection) { void cloud()?.deleteMemberCollection?.(removeCollection.dataset.retentionDeleteCollection).then(hydrate).then(() => notify?.("Koleksi dihapus.")).catch((error) => notify?.(error?.message || "Koleksi belum dapat dihapus.")); }
    });
    document.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-retention-create-collection]");
      if (!form) return;
      event.preventDefault();
      const input = form.elements.collectionName;
      void cloud()?.createMemberCollection?.(input.value).then(() => { input.value = ""; return hydrate(); }).then(() => notify?.("Koleksi dibuat.")).catch((error) => notify?.(error?.message || "Koleksi belum dapat dibuat."));
    });

    return { hydrate, saveButton, followButton, recordView, renderPanel, score, hasSignals, snapshot };
  }

  window.COMOOTDMemberRetention = Object.freeze({ create });
})();
