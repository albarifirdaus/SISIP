(() => {
  "use strict";

  function create(options = {}) {
    const { getState, getCloud, isSignedIn, requireSignIn, notify, escapeHtml, safeImage, onChange } = options;
    const esc = escapeHtml || ((value) => String(value ?? ""));
    const state = { collections:[], savedItems:[], followedCuratorIds:new Set(), recentlyViewed:[], loading:false };
    const expandedCollections = new Set();
    const collectionPreviewLimit = 8;
    let panelRoot = null;
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
        const label = active ? "Hapus dari koleksi Disimpan" : "Simpan ke koleksi";
        button.setAttribute("aria-label", label);
        button.setAttribute("title", label);
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

    function saveButton(type, id) {
      const saved = savedIn(type, String(id));
      const label = saved ? "Hapus dari koleksi Disimpan" : "Simpan ke koleksi";
      return `<button class="retention-save-button is-compact${saved ? " is-saved" : ""}" type="button" data-retention-save="${esc(type)}" data-retention-id="${esc(id)}" aria-label="${label}" title="${label}" aria-pressed="${saved}"><svg class="social-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11v17L12 17l-5.5 3.5v-17Z"/></svg></button>`;
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

    const OPEN_ICON = `<svg class="retention-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>`;
    const PLUS_ICON = `<svg class="retention-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
    const TRASH_ICON = `<svg class="retention-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>`;
    const CHEVRON_ICON = `<svg class="retention-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg>`;

    function imageFor(type, id) {
      const entry = entryFor(type, id);
      const candidate = type === "look"
        ? entry?.media?.[0]?.image || entry?.media?.[0]?.url || entry?.media?.[0]?.path || entry?.coverImage || entry?.images?.[0] || entry?.image
        : entry?.variants?.[0]?.image || entry?.image;
      return typeof safeImage === "function" ? safeImage(candidate) : String(candidate || "");
    }

    function savedRow(item, collection) {
      const otherCollections = state.collections.filter((candidate) => candidate.id !== collection.id);
      const typeLabel = item.targetType === "look" ? "LOOK" : "PRODUK";
      const title = titleFor(item.targetType, item.targetId);
      const image = imageFor(item.targetType, item.targetId);
      const media = image
        ? `<img src="${esc(image)}" alt="" loading="lazy" decoding="async" />`
        : `<span aria-hidden="true">${typeLabel.slice(0,1)}</span>`;
      return `<li class="retention-item"><button class="retention-item-main" type="button" data-retention-open="${esc(item.targetType)}" data-retention-id="${esc(item.targetId)}" aria-label="Buka ${esc(title)}"><span class="retention-item-media">${media}</span><span class="retention-item-copy"><span>${typeLabel}</span><strong>${esc(title)}</strong></span>${OPEN_ICON}</button><div class="retention-item-actions${otherCollections.length ? " has-copy" : ""}">${otherCollections.length ? `<select aria-label="Pilih koleksi tujuan" data-retention-target-collection>${otherCollections.map((candidate) => `<option value="${esc(candidate.id)}">${esc(candidate.name)}</option>`).join("")}</select><button class="retention-icon-button" type="button" data-retention-copy="${esc(item.targetType)}" data-retention-id="${esc(item.targetId)}" aria-label="Tambahkan ${esc(title)} ke koleksi terpilih" title="Tambah ke koleksi">${PLUS_ICON}</button>` : ""}<button class="retention-icon-button is-danger" type="button" data-retention-remove="${esc(item.targetType)}" data-retention-id="${esc(item.targetId)}" data-retention-collection="${esc(collection.id)}" aria-label="Hapus ${esc(title)} dari ${esc(collection.name)}" title="Hapus dari koleksi">${TRASH_ICON}</button></div></li>`;
    }

    function renderPanel(root) {
      if (!root) return;
      panelRoot = root;
      if (!isSignedIn?.()) { root.innerHTML = ""; return; }
      const collections = state.collections.map((collection) => {
        const items = state.savedItems.filter((item) => item.collectionId === collection.id);
        const expanded = expandedCollections.has(collection.id);
        const visibleItems = expanded ? items : items.slice(0, collectionPreviewLimit);
        const remaining = Math.max(0, items.length - visibleItems.length);
        return `<details class="retention-collection"${collection.isDefault ? " open" : ""}><summary><span><span class="eyebrow">${collection.isDefault ? "KOLEKSI UTAMA" : "KOLEKSI"}</span><strong>${esc(collection.name)}</strong></span><span class="retention-collection-meta"><b>${items.length}</b><small>item</small>${CHEVRON_ICON}</span></summary><div class="retention-collection-body">${items.length ? `<ul>${visibleItems.map((item) => savedRow(item, collection)).join("")}</ul>` : `<p class="retention-empty">Belum ada item di koleksi ini.</p>`}${items.length > collectionPreviewLimit ? `<button class="retention-more-button" type="button" data-retention-more="${esc(collection.id)}">${expanded ? "Tampilkan lebih sedikit" : `Lihat ${remaining} lainnya`} <span aria-hidden="true">${expanded ? "↑" : "↓"}</span></button>` : ""}${collection.isDefault ? "" : `<button class="retention-delete-collection" type="button" data-retention-delete-collection="${esc(collection.id)}">Hapus koleksi</button>`}</div></details>`;
      }).join("");
      const followed = [...state.followedCuratorIds].map((id) => titleFor("curator", id));
      const recent = state.recentlyViewed.slice(0, 8).map((item) => `<li><span>${esc(item.targetType.toUpperCase())}</span><strong>${esc(titleFor(item.targetType, item.targetId))}</strong></li>`).join("");
      root.innerHTML = `<div class="retention-panel-head"><div><p class="eyebrow" style="color:var(--clay)">YOUR COMOOTD</p><h3>Simpan, susun, kembali lagi.</h3></div><p>Koleksi dan riwayat hanya bisa dilihat dari akunmu.</p></div><form class="retention-create" data-retention-create-collection><input name="collectionName" maxlength="60" required placeholder="Nama koleksi baru" /><button class="button-outline" type="submit">+ Buat koleksi</button></form><div class="retention-collections">${collections || `<p class="member-help">Simpan satu look atau produk untuk membuat koleksi utama.</p>`}</div><div class="retention-summary"><article><span class="eyebrow">CURATOR DIIKUTI</span><p>${followed.length ? esc(followed.join(" · ")) : "Belum mengikuti Curator."}</p></article><article><span class="eyebrow">TERAKHIR DILIHAT</span>${recent ? `<ul>${recent}</ul>` : `<p>Riwayatmu masih kosong.</p>`}</article></div>`;
    }

    document.addEventListener("click", (event) => {
      const open = event.target.closest("[data-retention-open]");
      if (open) { window.dispatchEvent(new CustomEvent("comootd:open-retention-item", { detail:{ type:open.dataset.retentionOpen, id:open.dataset.retentionId } })); return; }
      const more = event.target.closest("[data-retention-more]");
      if (more) { const id = more.dataset.retentionMore; if (expandedCollections.has(id)) expandedCollections.delete(id); else expandedCollections.add(id); renderPanel(panelRoot); return; }
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
