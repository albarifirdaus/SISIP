/*
 * COMOOTD Curator experience.
 * The catalogue stays a plain HTML app; this module adds the contributor layer
 * without taking ownership of the existing admin Studio.
 */
(() => {
  "use strict";

  if (window.__COMOOTD_CURATOR_EXPERIENCE__) return;
  window.__COMOOTD_CURATOR_EXPERIENCE__ = true;

  const ROUTE_ROOT = "/curators";
  const DEFAULT_QUOTA = 30;
  const MIN_REFERENCES = 2;
  const MAX_REFERENCES = 5;
  const SOCIAL_LABELS = {
    instagram: "Instagram",
    tiktok: "TikTok",
    pinterest: "Pinterest",
    youtube: "YouTube",
    website: "Website"
  };
  const PRODUCT_CATEGORIES = [
    ["top", "Atasan"], ["bottom", "Bawahan"], ["outerwear", "Outerwear"],
    ["dress", "Dress / Set"], ["footwear", "Sepatu"], ["bag", "Tas"],
    ["accessory", "Aksesori"], ["hijab", "Hijab"], ["jewelry", "Perhiasan"], ["other", "Lainnya"]
  ];
  const state = {
    catalogue: { looks: [], curators: [] },
    user: null,
    curator: null,
    liked: new Set(),
    studioTab: "looks",
    editingLook: null,
    routeOpen: false,
    refreshVersion: 0,
    initialTitle: document.title,
    toastTimer: 0
  };

  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;"
  }[char]));
  const asArray = (value) => Array.isArray(value) ? value : (value ? [value] : []);
  const compact = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
  const tagList = (value, maximum = 12) => [...new Set(asArray(value)
    .flatMap((entry) => String(entry ?? "").split(","))
    .map(compact)
    .filter(Boolean))].slice(0, maximum);
  const plural = (amount, word) => `${amount} ${word}${amount === 1 ? "" : "s"}`;

  function cloud() { return window.SISIPCloud || null; }
  function publicImage(path) {
    const value = compact(path);
    if (!value) return "";
    if (/^https?:\/\//i.test(value) || value.startsWith("data:image/")) return value;
    try { return typeof cloud()?.publicUrl === "function" ? cloud().publicUrl(value) : value; } catch { return value; }
  }
  function initials(value) {
    const chars = compact(value).split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("");
    return chars.toUpperCase() || "CO";
  }
  function imageMarkup(path, alt, className, fallbackName) {
    const src = publicImage(path);
    return src
      ? `<img class="${className}" src="${esc(src)}" alt="${esc(alt || "")}" loading="lazy" />`
      : `<div class="${className}-fallback" aria-hidden="true">${esc(initials(fallbackName || alt))}</div>`;
  }
  function normaliseSocialLinks(raw) {
    const source = raw?.socialLinks || raw?.social_links || raw?.contributor_social_links || raw?.socials || raw || [];
    const output = [];
    if (Array.isArray(source)) {
      source.forEach((entry) => {
        const platform = compact(entry?.platform || entry?.type).toLowerCase();
        const url = compact(entry?.url || entry?.href);
        if (platform && url) output.push({ platform, url });
      });
    } else if (source && typeof source === "object") {
      Object.entries(source).forEach(([platform, url]) => {
        const value = compact(typeof url === "object" ? url?.url : url);
        if (value) output.push({ platform: compact(platform).toLowerCase(), url: value });
      });
    }
    return output.filter((entry, index, items) => /^[a-z0-9_-]+$/.test(entry.platform) && /^https:\/\//i.test(entry.url) && items.findIndex((item) => item.platform === entry.platform) === index);
  }
  function normaliseCurator(raw = {}) {
    const profile = raw.profile || raw.profiles || raw.user_profile || {};
    const userId = raw.userId || raw.user_id || raw.id || profile.id || "";
    const displayName = compact(raw.displayName || raw.display_name || profile.displayName || profile.display_name || raw.name || "") || "COMOOTD Curator";
    const handle = compact(raw.handle || raw.username || "").replace(/^@+/, "").toLowerCase();
    return {
      raw,
      userId: String(userId || ""),
      handle,
      displayName,
      avatarPath: raw.avatarPath || raw.avatar_path || profile.avatarPath || profile.avatar_path || "",
      bio: compact(raw.bio || raw.description || ""),
      jobTags: tagList(raw.jobTags ?? raw.job_tags ?? raw.tags, 5),
      socials: normaliseSocialLinks(raw),
      isActive: raw.isActive ?? raw.is_active ?? true,
      maxPublishedLooks: Number(raw.maxPublishedLooks ?? raw.max_published_looks ?? DEFAULT_QUOTA) || DEFAULT_QUOTA
    };
  }
  function normaliseReference(raw = {}) {
    return {
      id: raw.id || "",
      category: compact(raw.category || raw.category_label || "other") || "other",
      name: compact(raw.name || raw.productName || raw.product_name || raw.label || ""),
      colorLabel: compact(raw.colorLabel || raw.color_label || raw.variantName || raw.variant_name || ""),
      affiliateUrl: compact(raw.affiliateUrl || raw.affiliate_url || raw.url || raw.link || "")
    };
  }
  function normaliseLook(raw = {}) {
    const creator = raw.creator || raw.contributor || raw.contributor_profile || raw.contributor_profiles || null;
    return {
      raw,
      id: String(raw.id || ""),
      creatorId: String(raw.creatorId || raw.creator_id || creator?.userId || creator?.user_id || ""),
      creator: creator ? normaliseCurator(creator) : null,
      title: compact(raw.title || "Untitled look") || "Untitled look",
      slug: compact(raw.slug || raw.id || ""),
      styles: tagList(raw.styles || raw.styleTags || raw.style_tags, 8),
      gender: compact(raw.gender || "Uniseks") || "Uniseks",
      tone: compact(raw.tone || raw.mood || ""),
      coverImage: raw.coverImage || raw.cover_image_path || raw.cover_image || "",
      coverAlt: compact(raw.coverAlt || raw.cover_alt || raw.title || ""),
      status: compact(raw.status || "published").toLowerCase(),
      popularity: Number(raw.popularity || raw.likeCount || raw.like_count || 0) || 0,
      publishedAt: raw.publishedAt || raw.published_at || raw.createdAt || raw.created_at || "",
      items: asArray(raw.items || raw.look_reference_items || raw.referenceItems).map(normaliseReference).filter((item) => item.name || item.affiliateUrl)
    };
  }
  function allCurators() {
    const byId = new Map();
    asArray(state.catalogue.curators).map(normaliseCurator).forEach((curator) => {
      if (curator.userId || curator.handle) byId.set(curator.userId || curator.handle, curator);
    });
    asArray(state.catalogue.looks).map(normaliseLook).forEach((look) => {
      if (look.creator) {
        const key = look.creator.userId || look.creator.handle;
        if (key && !byId.has(key)) byId.set(key, look.creator);
      }
    });
    return [...byId.values()].filter((curator) => curator.handle && curator.isActive !== false);
  }
  function allLooks() { return asArray(state.catalogue.looks).map(normaliseLook); }
  function curatorLooks(curator) {
    if (!curator) return [];
    return allLooks().filter((look) => look.status === "published" && (look.creatorId === curator.userId || look.creator?.handle === curator.handle));
  }
  function ownCuratorLooks() {
    if (!state.curator || !state.user) return [];
    const userId = String(state.user.id || "");
    return allLooks().filter((look) => look.creatorId === userId || look.creator?.userId === userId);
  }
  function publishedOwnLookCount() { return ownCuratorLooks().filter((look) => look.status === "published").length; }
  function cardImageForCurator(curator) {
    const latest = curatorLooks(curator).sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))[0];
    return latest?.coverImage || curator.avatarPath || "";
  }
  function humanDate(value) {
    if (!value) return "Baru diterbitkan";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Baru diterbitkan" : date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }
  function safeHandle(handle) { return compact(handle).toLowerCase().replace(/[^a-z0-9_-]/g, ""); }
  function socialLabel(platform) { return SOCIAL_LABELS[platform] || platform; }
  function categoryLabel(category) { return PRODUCT_CATEGORIES.find(([value]) => value === category)?.[1] || "Produk"; }
  function isShopeeLink(value) {
    try {
      const host = new URL(value).hostname.toLowerCase();
      return host === "shopee.co.id" || host.endsWith(".shopee.co.id") || host === "shope.ee";
    } catch { return false; }
  }

  function ensureLayers() {
    if (!document.getElementById("curatorRouteLayer")) {
      const routeLayer = document.createElement("div");
      routeLayer.id = "curatorRouteLayer";
      routeLayer.className = "curator-route-layer";
      routeLayer.setAttribute("aria-live", "polite");
      document.body.append(routeLayer);
    }
    if (!document.getElementById("curatorStudioDialog")) {
      const studio = document.createElement("dialog");
      studio.id = "curatorStudioDialog";
      studio.className = "curator-studio-dialog";
      studio.setAttribute("aria-label", "COMOOTD Curator Studio");
      studio.addEventListener("close", () => { state.editingLook = null; });
      document.body.append(studio);
    }
    if (!document.getElementById("curatorOnboardDialog")) {
      const onboard = document.createElement("dialog");
      onboard.id = "curatorOnboardDialog";
      onboard.className = "curator-onboard-dialog";
      onboard.setAttribute("aria-label", "Jadi Curator COMOOTD");
      onboard.innerHTML = onboardMarkup();
      document.body.append(onboard);
    }
    if (!document.getElementById("curatorToast")) {
      const toast = document.createElement("div");
      toast.id = "curatorToast";
      toast.className = "curator-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.append(toast);
    }
  }
  function showToast(message) {
    const toast = document.getElementById("curatorToast");
    if (!toast) return;
    clearTimeout(state.toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    state.toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3400);
  }

  function curatorCardMarkup(curator, index = 0, directory = false) {
    const cover = cardImageForCurator(curator);
    const looks = curatorLooks(curator);
    const media = cover ? `<div class="curator-card-media"><img src="${esc(publicImage(cover))}" alt="" loading="lazy" /></div>` : "";
    const cardClass = directory ? "curator-directory-card" : "curator-card";
    return `<article class="${cardClass}">
      ${media}
      <div class="curator-card-top"><span class="eyebrow">CURATOR / ${String(index + 1).padStart(2, "0")}</span><span class="curator-card-number">${looks.length} LOOK${looks.length === 1 ? "" : "S"}</span></div>
      <div class="curator-card-person">
        ${imageMarkup(curator.avatarPath, "", "curator-avatar", curator.displayName)}
        <div><h3 class="curator-card-name">${esc(curator.displayName)}</h3><p class="curator-card-handle">@${esc(curator.handle)}</p></div>
      </div>
      <p class="curator-card-title">${esc(curator.bio || "A personal edit of pieces worth repeating.")}</p>
      ${curator.jobTags.length ? `<div class="curator-card-tags">${curator.jobTags.slice(0, 3).map((tag) => `<span>${esc(tag)}</span>`).join("")}</div>` : ""}
      <a href="${ROUTE_ROOT}/${encodeURIComponent(curator.handle)}" data-curator-route="${esc(curator.handle)}" aria-label="Lihat kurasi ${esc(curator.displayName)}" class="curator-card-link"></a>
    </article>`;
  }
  function renderHome() {
    const mount = document.getElementById("curatorsMount");
    if (!mount) return;
    const curators = allCurators();
    const hasCurator = Boolean(state.curator?.isActive !== false && state.curator?.handle);
    const leadAction = state.user
      ? (hasCurator
        ? `<button class="button-outline" type="button" data-open-curator-studio>Open Curator Studio ↗</button>`
        : `<button class="button-outline" type="button" data-open-curator-onboard>Jadi Curator ↗</button>`)
      : `<button class="button-outline" type="button" data-open-curator-account>Masuk untuk berkarya ↗</button>`;
    mount.innerHTML = `<section class="section curator-section" id="curators" aria-labelledby="curatorsTitle">
      <div class="section-heading">
        <div>
          <p class="section-number eyebrow">COMOOTD / COMMUNITY CURATION</p>
          <h2 class="section-title" id="curatorsTitle">Curated by People<br />with <em>Point of View.</em></h2>
        </div>
        <div class="section-lead">
          <p class="section-description">Temukan kurasi dari para fashion people dengan selera, referensi, dan tautan Shopee mereka sendiri.</p>
          <div class="curator-heading-actions"><a class="text-link" href="${ROUTE_ROOT}" data-curator-directory>Meet all curators <span aria-hidden="true">↗</span></a>${leadAction}</div>
        </div>
      </div>
      ${curators.length ? `<div class="curator-home-grid">${curators.slice(0, 4).map((curator, index) => curatorCardMarkup(curator, index)).join("")}</div>` : `<div class="curator-home-empty">Belum ada kurasi komunitas yang diterbitkan. Jadilah yang pertama membagikan sudut pandangmu.</div>`}
    </section>`;
  }
  function profileSocialMarkup(curator) {
    const socials = curator.socials.filter((social) => /^https:\/\//i.test(social.url));
    return `<div class="curator-socials">${socials.map((social) => `<a href="${esc(social.url)}" target="_blank" rel="noopener noreferrer">${esc(socialLabel(social.platform))} ↗</a>`).join("")}<button type="button" class="curator-share-button" data-share-curator="${esc(curator.handle)}">Bagikan profil ↗</button></div>`;
  }
  function lookCardMarkup(look) {
    const cover = publicImage(look.coverImage);
    const liked = state.liked.has(look.id);
    return `<article class="curator-look-card">
      ${cover ? `<div class="curator-card-media"><img src="${esc(cover)}" alt="${esc(look.coverAlt || look.title)}" loading="lazy" /></div>` : ""}
      <div class="curator-look-card-top"><span class="eyebrow">${esc(look.gender)}</span><span class="curator-look-card-meta">${esc(humanDate(look.publishedAt))}</span></div>
      <h3 class="curator-look-card-title">${esc(look.title)}</h3>
      <p class="curator-look-card-meta">${esc(look.styles.slice(0, 3).join(" · ") || look.tone || "Curated look")}</p>
      <div class="curator-look-card-actions">
        <a href="/looks/${encodeURIComponent(look.slug)}" aria-label="Buka ${esc(look.title)}">Lihat look ↗</a>
        <button type="button" data-toggle-curator-like="${esc(look.id)}" aria-pressed="${liked ? "true" : "false"}" aria-label="Sukai ${esc(look.title)}">♥ ${look.popularity}</button>
        <button type="button" data-share-curator-look="${esc(look.id)}" aria-label="Bagikan ${esc(look.title)}">Share</button>
      </div>
    </article>`;
  }
  function routeBarMarkup() {
    return `<header class="curator-route-bar"><button class="curator-route-brand" type="button" data-close-curator-route>COMO<span>O</span>TD</button><button class="curator-route-back" type="button" data-close-curator-route>← Back to COMOOTD</button></header>`;
  }
  function directoryMarkup() {
    const curators = allCurators();
    return `<div class="curator-route-shell">${routeBarMarkup()}<main class="curator-route-body">
      <section class="curator-directory-head" aria-labelledby="curatorDirectoryTitle">
        <div><p class="eyebrow" style="color:var(--clay)">COMOOTD / CURATOR DIRECTORY</p><h1 id="curatorDirectoryTitle">Meet the<br /><span>Curators.</span></h1></div>
        <p class="curator-directory-copy">A growing collective of personal fashion edits. Setiap profil membawa sudut pandang sendiri—dengan tautan affiliate yang dikelola pemilik kurasi.</p>
      </section>
      <section class="curator-directory-grid" aria-label="Daftar Curator">${curators.length ? curators.map((curator, index) => curatorCardMarkup(curator, index, true)).join("") : `<div class="curator-empty">Belum ada curator aktif. Kembali ke beranda untuk menjadi curator pertama.</div>`}</section>
    </main></div>`;
  }
  function profileMarkup(curator) {
    const looks = curatorLooks(curator).sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
    const totalLikes = looks.reduce((total, look) => total + look.popularity, 0);
    return `<div class="curator-route-shell">${routeBarMarkup()}<main class="curator-route-body">
      <section class="curator-profile-hero" aria-labelledby="curatorProfileTitle">
        <div class="curator-profile-identity">
          ${imageMarkup(curator.avatarPath, `Foto ${curator.displayName}`, "curator-profile-avatar", curator.displayName)}
          <div><p class="eyebrow" style="color:var(--clay)">COMOOTD CURATOR</p><h1 class="curator-profile-title" id="curatorProfileTitle">${esc(curator.displayName)}</h1><p class="curator-profile-handle">@${esc(curator.handle)}</p></div>
        </div>
        <div class="curator-profile-side">
          <p class="curator-profile-bio">${esc(curator.bio || "Personal edits, styled with intention.")}</p>
          ${curator.jobTags.length ? `<div class="curator-profile-tags">${curator.jobTags.map((tag) => `<span class="curator-tag">${esc(tag)}</span>`).join("")}</div>` : ""}
          ${profileSocialMarkup(curator)}
          <div class="curator-profile-stats"><div class="curator-profile-stat"><strong>${looks.length}</strong><span>Published looks</span></div><div class="curator-profile-stat"><strong>${totalLikes}</strong><span>Community likes</span></div></div>
        </div>
      </section>
      <section aria-labelledby="curatorLookTitle"><div class="curator-profile-looks-head"><div><p class="eyebrow" style="color:var(--clay)">THE EDIT</p><h2 id="curatorLookTitle">Looks by ${esc(curator.displayName.split(" ")[0])}</h2></div><span class="eyebrow">${looks.length} CURATION${looks.length === 1 ? "" : "S"}</span></div>
        ${looks.length ? `<div class="curator-look-grid">${looks.map(lookCardMarkup).join("")}</div>` : `<p class="curator-empty">Kurator ini sedang menyusun edit pertamanya. Cek lagi sebentar lagi.</p>`}
      </section>
    </main></div>`;
  }
  function notFoundMarkup(handle) {
    return `<div class="curator-route-shell">${routeBarMarkup()}<main class="curator-route-body"><section class="curator-directory-head"><div><p class="eyebrow" style="color:var(--clay)">404 / CURATOR</p><h1>Profile<br /><span>Not Found.</span></h1></div><p class="curator-directory-copy">Kami belum menemukan profil @${esc(handle)}. Mungkin handle-nya berubah atau profilnya belum aktif.</p></section><p style="margin-top:1.4rem"><a class="button" href="${ROUTE_ROOT}" data-curator-directory>Lihat semua curator ↗</a></p></main></div>`;
  }
  function routeInfo() {
    const parts = location.pathname.split("/").filter(Boolean);
    if (parts[0] !== "curators") return { type: "none" };
    if (parts.length === 1) return { type: "directory" };
    if (parts.length === 2) return { type: "profile", handle: safeHandle(decodeURIComponent(parts[1])) };
    return { type: "none" };
  }
  function closeRoute({ navigate = false } = {}) {
    const layer = document.getElementById("curatorRouteLayer");
    if (!layer) return;
    layer.classList.remove("is-open");
    layer.innerHTML = "";
    state.routeOpen = false;
    document.body.classList.remove("curator-route-open");
    document.title = state.initialTitle;
    if (navigate && routeInfo().type !== "none") history.pushState({}, "", "/");
  }
  function renderRoute() {
    const layer = document.getElementById("curatorRouteLayer");
    if (!layer) return;
    const route = routeInfo();
    if (route.type === "none") { closeRoute(); return; }
    layer.classList.add("is-open");
    state.routeOpen = true;
    document.body.classList.add("curator-route-open");
    if (route.type === "directory") {
      layer.innerHTML = directoryMarkup();
      document.title = "Curators — COMOOTD";
    } else {
      const curator = allCurators().find((entry) => entry.handle === route.handle);
      layer.innerHTML = curator ? profileMarkup(curator) : notFoundMarkup(route.handle);
      document.title = curator ? `${curator.displayName} (@${curator.handle}) — COMOOTD` : "Curator tidak ditemukan — COMOOTD";
    }
    const back = layer.querySelector("[data-close-curator-route]");
    window.setTimeout(() => back?.focus(), 0);
  }
  function goToCurator(handle) {
    const safe = safeHandle(handle);
    if (!safe) return;
    history.pushState({}, "", `${ROUTE_ROOT}/${encodeURIComponent(safe)}`);
    window.scrollTo(0, 0);
    renderRoute();
  }
  function goToDirectory() {
    history.pushState({}, "", ROUTE_ROOT);
    window.scrollTo(0, 0);
    renderRoute();
  }

  function onboardMarkup() {
    return `<div class="curator-onboard-shell"><button class="icon-button modal-close" type="button" data-close-curator-onboard aria-label="Tutup">×</button><p class="eyebrow" style="color:var(--clay)">COMOOTD / OPEN CURATOR</p><h2>Show Your<br />Point of View.</h2><p class="curator-onboard-copy">Buka profil curator gratis untuk membagikan hingga ${DEFAULT_QUOTA} look aktif. Tautan Shopee yang kamu cantumkan tetap milikmu.</p><form class="curator-form" data-curator-onboard-form>
      <div class="curator-form-grid"><div class="curator-field"><label for="curatorOnboardName">Nama tampil</label><input id="curatorOnboardName" name="displayName" maxlength="80" required placeholder="Nama kamu" /></div><div class="curator-field"><label for="curatorOnboardHandle">Handle</label><input id="curatorOnboardHandle" name="handle" minlength="3" maxlength="32" pattern="[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?" required placeholder="contoh: araedits" autocomplete="off" /><p class="curator-file-note">3–32 karakter: huruf kecil, angka, _ atau -.</p></div></div>
      <div class="curator-field"><label for="curatorOnboardJob">Job tags</label><input id="curatorOnboardJob" name="jobTags" maxlength="180" placeholder="Contoh: Stylist, Content Creator" /><p class="curator-file-note">Pisahkan dengan koma, maksimal 5 tag.</p></div>
      <div class="curator-field"><label for="curatorOnboardBio">Tentang edit kamu</label><textarea id="curatorOnboardBio" name="bio" maxlength="500" placeholder="Ceritakan sedikit sudut pandang atau pendekatan styling-mu."></textarea></div>
      <p class="curator-form-status" data-curator-onboard-status role="alert"></p><button class="button" type="submit">Aktifkan profil curator ↗</button></form></div>`;
  }
  function openAccount() {
    document.getElementById("accountButton")?.click();
  }
  function openOnboarding() {
    if (!state.user) { showToast("Masuk atau buat akun terlebih dahulu untuk membuka profil curator."); openAccount(); return; }
    const dialog = document.getElementById("curatorOnboardDialog");
    if (!dialog) return;
    const input = dialog.querySelector("[name=displayName]");
    if (input && !input.value) input.value = compact(state.user.user_metadata?.display_name || state.user.user_metadata?.name || state.user.email?.split("@")[0] || "");
    if (!dialog.open) dialog.showModal();
    window.setTimeout(() => dialog.querySelector("[name=handle]")?.focus(), 0);
  }

  function profileEditorMarkup(curator) {
    const socialMap = Object.fromEntries(curator.socials.map((item) => [item.platform, item.url]));
    return `<section class="curator-studio-panel" data-curator-studio-panel="profile"><p class="eyebrow" style="color:var(--clay)">YOUR PUBLIC PROFILE</p><h3>Make the profile<br />feel like you.</h3><p class="curator-studio-lede">Foto, job tags, bio, dan tautan sosial tampil di halaman shareable milikmu.</p>
      <form class="curator-form" data-curator-profile-form><div class="curator-profile-photo-row">${imageMarkup(curator.avatarPath, "", "curator-profile-avatar", curator.displayName)}<div class="curator-field" style="flex:1"><label for="curatorAvatarInput">Foto profil</label><input id="curatorAvatarInput" name="avatarFile" type="file" accept="image/jpeg,image/png,image/webp" /><p class="curator-file-note">JPG, PNG, atau WebP. Maksimal 5 MB.</p></div></div>
      <div class="curator-form-grid"><div class="curator-field"><label for="curatorDisplayName">Nama tampil</label><input id="curatorDisplayName" name="displayName" maxlength="80" value="${esc(curator.displayName)}" required /></div><div class="curator-field"><label for="curatorHandle">Handle</label><input id="curatorHandle" name="handle" minlength="3" maxlength="32" value="${esc(curator.handle)}" pattern="[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?" required /><p class="curator-file-note">Handle menjadi alamat profil kamu.</p></div></div>
      <div class="curator-field"><label for="curatorJobTags">Job tags</label><input id="curatorJobTags" name="jobTags" maxlength="180" value="${esc(curator.jobTags.join(", "))}" placeholder="Stylist, Content Creator" /><p class="curator-file-note">Pisahkan dengan koma, maksimal 5 tag.</p></div><div class="curator-field"><label for="curatorBio">Bio</label><textarea id="curatorBio" name="bio" maxlength="500" placeholder="Sudut pandang style kamu.">${esc(curator.bio)}</textarea></div>
      <div><p class="curator-inline-label">Social links</p><div class="curator-social-fields">${Object.entries(SOCIAL_LABELS).map(([platform, label]) => `<div class="curator-field"><label for="curatorSocial${platform}">${esc(label)}</label><input id="curatorSocial${platform}" name="social-${esc(platform)}" type="url" placeholder="https://" value="${esc(socialMap[platform] || "")}" /></div>`).join("")}</div></div>
      <div class="curator-form-actions"><p class="curator-form-status" data-curator-profile-status role="alert"></p><button class="button" type="submit">Simpan profil ↗</button></div></form></section>`;
  }
  function productReferenceMarkup(item = {}, index = 0) {
    const reference = normaliseReference(item);
    return `<div class="curator-product-reference" data-curator-reference-row>
      <div class="curator-field"><label>Kategori</label><select name="referenceCategory">${PRODUCT_CATEGORIES.map(([value, label]) => `<option value="${value}"${reference.category === value ? " selected" : ""}>${esc(label)}</option>`).join("")}</select></div>
      <div class="curator-field"><label>Nama produk</label><input name="referenceName" maxlength="160" value="${esc(reference.name)}" placeholder="Contoh: Linen Relaxed Shirt" required /></div>
      <div class="curator-field"><label>Warna / varian</label><input name="referenceColor" maxlength="80" value="${esc(reference.colorLabel)}" placeholder="Olive" /></div>
      <div class="curator-field"><label>Link affiliate Shopee</label><input name="referenceUrl" type="url" value="${esc(reference.affiliateUrl)}" placeholder="https://shopee.co.id/..." required /></div>
      <button class="curator-remove-reference" type="button" data-remove-curator-reference aria-label="Hapus produk ${index + 1}">×</button>
    </div>`;
  }
  function lookEditorMarkup(editing = null) {
    const references = editing?.items?.length ? editing.items.slice(0, MAX_REFERENCES) : [{}, {}];
    return `<section class="curator-studio-panel" data-curator-studio-panel="editor"><p class="eyebrow" style="color:var(--clay)">${editing ? "EDIT LOOK" : "NEW CURATION"}</p><h3>${editing ? "Refine this\nlook." : "Build a look\nworth sharing."}</h3><p class="curator-studio-lede">Kamu bisa menerbitkan langsung—tanpa review admin. Tambahkan 2 hingga 5 produk dengan tautan affiliate Shopee-mu sendiri.</p>
      <form class="curator-form" data-curator-look-form data-curator-edit-id="${esc(editing?.id || "")}"><div class="curator-form-grid">
        <div class="curator-field curator-field-full"><label for="curatorLookTitle">Nama mix &amp; match</label><input id="curatorLookTitle" name="title" maxlength="160" value="${esc(editing?.title || "")}" placeholder="Contoh: Monday in Olive" required /></div>
        <div class="curator-field"><label for="curatorLookGender">Gender</label><select id="curatorLookGender" name="gender"><option value="Uniseks"${editing?.gender === "Uniseks" ? " selected" : ""}>Uniseks</option><option value="Pria"${editing?.gender === "Pria" ? " selected" : ""}>Pria</option><option value="Wanita"${editing?.gender === "Wanita" ? " selected" : ""}>Wanita</option></select></div>
        <div class="curator-field"><label for="curatorLookTone">Mood / tone</label><select id="curatorLookTone" name="tone">${[["carbon","Carbon"],["clay","Clay"],["mineral","Mineral"],["olive","Olive"],["midnight","Midnight"]].map(([value,label])=>`<option value="${value}"${(editing?.tone || "carbon") === value ? " selected" : ""}>${label}</option>`).join("")}</select></div>
        <div class="curator-field curator-field-full"><label for="curatorLookStyles">Tag style</label><input id="curatorLookStyles" name="styles" maxlength="240" value="${esc((editing?.styles || []).join(", "))}" placeholder="Contoh: Clean, Casual, Workwear" /><p class="curator-file-note">Pisahkan tag dengan koma agar look lebih mudah ditemukan.</p></div>
        <div class="curator-field curator-field-full"><label for="curatorLookCover">Foto cover look${editing ? " (opsional)" : ""}</label><input id="curatorLookCover" name="coverFile" type="file" accept="image/jpeg,image/png,image/webp"${editing ? "" : " required"} /><p class="curator-file-note">Gunakan foto kombinasi outfit milikmu. JPG, PNG, atau WebP, maksimal 5 MB.</p></div>
      </div>
      <div class="curator-reference-head"><h4>Products in this look</h4><span class="curator-reference-count" data-curator-reference-count>${references.length} / ${MAX_REFERENCES}</span></div>
      <div class="curator-reference-list" data-curator-reference-list>${references.map(productReferenceMarkup).join("")}</div>
      <button class="curator-small-button" type="button" data-add-curator-reference${references.length >= MAX_REFERENCES ? " disabled" : ""}>+ Tambah produk</button>
      <div class="curator-form-actions"><button class="curator-small-button" type="button" data-cancel-curator-edit>Kembali</button><div><p class="curator-form-status" data-curator-look-status role="alert"></p><button class="button" type="submit">${editing ? "Simpan perubahan" : "Publish look"} ↗</button></div></div>
      </form></section>`;
  }
  function studioLibraryMarkup() {
    const looks = ownCuratorLooks().sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
    const quota = state.curator?.maxPublishedLooks || DEFAULT_QUOTA;
    const publishDisabled = publishedOwnLookCount() >= quota;
    return `<section class="curator-studio-panel" data-curator-studio-panel="looks"><p class="eyebrow" style="color:var(--clay)">YOUR LOOK LIBRARY</p><h3>Keep the edit<br />intentional.</h3><p class="curator-studio-lede">Setiap look yang kamu publish akan langsung tampil di profil dan dapat dibagikan ke halaman detailnya.</p><p><button class="button" type="button" data-curator-new-look${publishDisabled ? " disabled title=\"Batas look aktif sudah tercapai\"" : ""}>+ Buat look baru</button></p>
      ${looks.length ? `<div class="curator-studio-library">${looks.map((look) => `<article class="curator-studio-look-row"><div>${publicImage(look.coverImage) ? `<img class="curator-studio-thumb" src="${esc(publicImage(look.coverImage))}" alt="" />` : `<div class="curator-studio-thumb"></div>`}</div><div><h4>${esc(look.title)}</h4><p>${esc(look.status)} · ${esc(humanDate(look.publishedAt))} · ${look.items.length} items</p></div><div class="curator-studio-row-actions"><a class="curator-small-button" href="/looks/${encodeURIComponent(look.slug)}">Lihat ↗</a><button class="curator-small-button" type="button" data-edit-curator-look="${esc(look.id)}">Edit</button><button class="curator-small-button danger" type="button" data-delete-curator-look="${esc(look.id)}">Arsipkan</button></div></article>`).join("")}</div>` : `<div class="curator-studio-placeholder">Belum ada look. Mulai dari satu kombinasi yang paling ingin kamu bagikan.</div>`}
    </section>`;
  }
  function renderStudio(tab = state.studioTab) {
    const dialog = document.getElementById("curatorStudioDialog");
    if (!dialog || !state.curator) return;
    state.studioTab = tab;
    const quota = state.curator.maxPublishedLooks || DEFAULT_QUOTA;
    const count = publishedOwnLookCount();
    const body = state.editingLook ? lookEditorMarkup(state.editingLook) : (tab === "profile" ? profileEditorMarkup(state.curator) : studioLibraryMarkup());
    dialog.innerHTML = `<button class="icon-button curator-studio-close" type="button" data-close-curator-studio aria-label="Tutup Curator Studio">×</button><div class="curator-studio-shell"><aside class="curator-studio-side"><p class="eyebrow">COMOOTD / CURATOR</p><h2>Studio<br />${esc(state.curator.displayName.split(" ")[0])}</h2><div class="curator-studio-quota"><strong>${count} / ${quota}</strong><span>Look aktif di Starter</span></div><nav class="curator-studio-tabs" aria-label="Menu Curator Studio"><button class="curator-studio-tab${tab === "looks" && !state.editingLook ? " is-active" : ""}" type="button" data-curator-studio-tab="looks">Look library</button><button class="curator-studio-tab${tab === "profile" && !state.editingLook ? " is-active" : ""}" type="button" data-curator-studio-tab="profile">Profile</button></nav></aside><div class="curator-studio-main">${body}</div></div>`;
  }
  function openStudio() {
    if (!state.user) { showToast("Masuk terlebih dahulu untuk membuka Curator Studio."); openAccount(); return; }
    if (!state.curator?.isActive || !state.curator.handle) { openOnboarding(); return; }
    const dialog = document.getElementById("curatorStudioDialog");
    renderStudio("looks");
    if (!dialog.open) dialog.showModal();
    window.setTimeout(() => dialog.querySelector("[data-curator-new-look]")?.focus(), 0);
  }
  function setFormStatus(target, message, success = false) {
    if (!target) return;
    target.textContent = message || "";
    target.classList.toggle("is-success", Boolean(success));
  }
  function updateReferenceControls(form) {
    const rows = form?.querySelectorAll("[data-curator-reference-row]") || [];
    const count = rows.length;
    const countNode = form?.querySelector("[data-curator-reference-count]");
    if (countNode) countNode.textContent = `${count} / ${MAX_REFERENCES}`;
    form?.querySelector("[data-add-curator-reference]")?.toggleAttribute("disabled", count >= MAX_REFERENCES);
    rows.forEach((row) => {
      const remove = row.querySelector("[data-remove-curator-reference]");
      if (remove) remove.disabled = count <= MIN_REFERENCES;
    });
  }
  function collectLookPayload(form) {
    const references = [...form.querySelectorAll("[data-curator-reference-row]")].map((row) => ({
      category: compact(row.querySelector("[name=referenceCategory]")?.value || "other"),
      name: compact(row.querySelector("[name=referenceName]")?.value),
      colorLabel: compact(row.querySelector("[name=referenceColor]")?.value),
      affiliateUrl: compact(row.querySelector("[name=referenceUrl]")?.value)
    }));
    const coverFile = form.querySelector("[name=coverFile]")?.files?.[0] || null;
    return {
      title: compact(form.elements.title?.value),
      gender: compact(form.elements.gender?.value || "Uniseks"),
      tone: compact(form.elements.tone?.value),
      styles: tagList(form.elements.styles?.value, 10),
      coverFile,
      items: references
    };
  }
  function validateLookPayload(payload, editing) {
    if (!payload.title) return "Nama look wajib diisi.";
    if (!editing && !payload.coverFile) return "Tambahkan foto cover untuk look baru.";
    if (payload.coverFile && payload.coverFile.size > 5 * 1024 * 1024) return "Ukuran foto cover maksimal 5 MB.";
    if (payload.items.length < MIN_REFERENCES || payload.items.length > MAX_REFERENCES) return `Tambahkan ${MIN_REFERENCES}–${MAX_REFERENCES} produk ke dalam look.`;
    if (payload.items.some((item) => !item.name || !item.affiliateUrl)) return "Setiap produk membutuhkan nama dan link affiliate Shopee.";
    if (payload.items.some((item) => !isShopeeLink(item.affiliateUrl))) return "Gunakan link Shopee yang valid untuk setiap produk.";
    return "";
  }

  async function getCurrentUser() {
    const api = cloud();
    if (!api) return null;
    try {
      if (typeof api.getCurrentUser === "function") {
        const result = await api.getCurrentUser();
        if (result?.user) return result.user;
        if (result?.data?.user) return result.data.user;
        if (result?.id) return result;
      }
      if (typeof api.getSession === "function") {
        const result = await api.getSession();
        return result?.user || result?.data?.session?.user || result?.session?.user || null;
      }
    } catch (error) { console.warn("Unable to read COMOOTD member session", error); }
    return null;
  }
  async function refresh({ quiet = true } = {}) {
    const api = cloud();
    if (!api || typeof api.loadState !== "function") {
      renderHome();
      renderRoute();
      return;
    }
    const version = ++state.refreshVersion;
    try {
      const [catalogue, user] = await Promise.all([api.loadState({ admin: false }), getCurrentUser()]);
      if (version !== state.refreshVersion) return;
      state.catalogue = catalogue || { looks: [], curators: [] };
      state.user = user;
      state.curator = null;
      state.liked = new Set();
      if (user?.id) {
        const jobs = [];
        if (typeof api.getCuratorProfile === "function") jobs.push(api.getCuratorProfile());
        else jobs.push(Promise.resolve(null));
        if (typeof api.loadMyLookLikes === "function") jobs.push(api.loadMyLookLikes());
        else jobs.push(Promise.resolve([]));
        const [curatorRaw, likesRaw] = await Promise.all(jobs);
        if (version !== state.refreshVersion) return;
        if (curatorRaw) state.curator = normaliseCurator(curatorRaw);
        const likeRows = asArray(likesRaw?.likes || likesRaw);
        state.liked = new Set(likeRows.map((entry) => String(entry?.lookId || entry?.look_id || entry)).filter(Boolean));
      }
      renderHome();
      ensureMemberPrompt();
      renderRoute();
    } catch (error) {
      console.warn("Unable to load COMOOTD curator data", error);
      if (!quiet) showToast("Kurasi contributor belum dapat dimuat. Coba lagi sesaat lagi.");
      renderHome();
      renderRoute();
    }
  }
  function ensureMemberPrompt() {
    const profile = document.getElementById("memberProfileView");
    if (!profile) return;
    const existing = document.getElementById("curatorMemberPrompt");
    if (!state.user || state.curator?.isActive) { existing?.remove(); return; }
    if (existing) return;
    const prompt = document.createElement("div");
    prompt.id = "curatorMemberPrompt";
    prompt.className = "curator-callout";
    prompt.innerHTML = `<p><strong>Sudah punya sudut pandang sendiri?</strong><br />Buka profil Curator gratis untuk membagikan hingga ${DEFAULT_QUOTA} look dan tautan affiliate Shopee-mu.</p><button class="button-outline" type="button" data-open-curator-onboard>Jadi Curator ↗</button>`;
    profile.prepend(prompt);
  }
  function updateLookPopularity(id, amount) {
    asArray(state.catalogue.looks).forEach((entry) => {
      if (String(entry.id) === String(id)) entry.popularity = Math.max(0, (Number(entry.popularity) || 0) + amount);
    });
  }
  async function toggleLike(id, button) {
    if (!state.user) { showToast("Masuk terlebih dahulu untuk menyukai kurasi."); openAccount(); return; }
    const api = cloud();
    if (!api || typeof api.toggleLookLike !== "function") { showToast("Fitur like belum siap saat ini."); return; }
    button?.setAttribute("aria-busy", "true");
    try {
      const wasLiked = state.liked.has(String(id));
      const result = await api.toggleLookLike(id);
      const liked = typeof result?.liked === "boolean" ? result.liked : (typeof result?.isLiked === "boolean" ? result.isLiked : !wasLiked);
      if (liked) state.liked.add(String(id)); else state.liked.delete(String(id));
      updateLookPopularity(id, liked === wasLiked ? 0 : (liked ? 1 : -1));
      renderHome();
      renderRoute();
    } catch (error) {
      showToast(error?.message || "Like belum dapat disimpan. Coba lagi.");
    } finally { button?.removeAttribute("aria-busy"); }
  }
  async function shareUrl(url, title, text) {
    const absolute = new URL(url, location.origin).href;
    try {
      if (navigator.share) { await navigator.share({ title, text, url: absolute }); return; }
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(absolute); showToast("Link sudah disalin."); return; }
      const field = document.createElement("textarea");
      field.value = absolute;
      field.style.position = "fixed";
      document.body.append(field);
      field.select();
      document.execCommand("copy");
      field.remove();
      showToast("Link sudah disalin.");
    } catch (error) {
      if (error?.name !== "AbortError") showToast("Link belum dapat dibagikan. Coba lagi.");
    }
  }

  async function submitOnboarding(form) {
    const api = cloud();
    const status = form.querySelector("[data-curator-onboard-status]");
    const submit = form.querySelector("[type=submit]");
    if (!api || typeof api.activateCurator !== "function") { setFormStatus(status, "Fitur Curator belum tersambung. Coba lagi sesaat lagi."); return; }
    const payload = {
      displayName: compact(form.elements.displayName?.value),
      handle: safeHandle(form.elements.handle?.value),
      jobTags: tagList(form.elements.jobTags?.value, 5),
      bio: compact(form.elements.bio?.value)
    };
    if (!/^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/.test(payload.handle) || payload.handle.length < 3 || payload.handle.length > 32) { setFormStatus(status, "Handle harus 3–32 karakter dan hanya memakai huruf kecil, angka, _ atau -."); return; }
    submit.disabled = true;
    setFormStatus(status, "Mengaktifkan profil…");
    try {
      await api.activateCurator(payload);
      setFormStatus(status, "Profil curator aktif.", true);
      await refresh({ quiet: false });
      document.getElementById("curatorOnboardDialog")?.close();
      state.studioTab = "profile";
      openStudio();
      showToast("Selamat datang di COMOOTD Curator.");
    } catch (error) {
      setFormStatus(status, error?.message || "Profil curator belum dapat diaktifkan.");
    } finally { submit.disabled = false; }
  }
  async function submitProfile(form) {
    const api = cloud();
    const status = form.querySelector("[data-curator-profile-status]");
    const submit = form.querySelector("[type=submit]");
    if (!api || typeof api.saveCuratorProfile !== "function") { setFormStatus(status, "Profil belum tersambung. Coba lagi sesaat lagi."); return; }
    const avatarFile = form.elements.avatarFile?.files?.[0] || null;
    const socials = Object.keys(SOCIAL_LABELS).map((platform) => ({ platform, url: compact(form.elements[`social-${platform}`]?.value) })).filter((entry) => entry.url);
    const invalidSocial = socials.find((entry) => !/^https:\/\//i.test(entry.url));
    const payload = {
      displayName: compact(form.elements.displayName?.value),
      handle: safeHandle(form.elements.handle?.value),
      bio: compact(form.elements.bio?.value),
      jobTags: tagList(form.elements.jobTags?.value, 5),
      avatarFile,
      socials,
      socialLinks: socials
    };
    if (!payload.displayName || !payload.handle) { setFormStatus(status, "Nama tampil dan handle wajib diisi."); return; }
    if (!/^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/.test(payload.handle) || payload.handle.length < 3 || payload.handle.length > 32) { setFormStatus(status, "Handle harus 3–32 karakter dan hanya memakai huruf kecil, angka, _ atau -."); return; }
    if (avatarFile && avatarFile.size > 5 * 1024 * 1024) { setFormStatus(status, "Ukuran foto profil maksimal 5 MB."); return; }
    if (invalidSocial) { setFormStatus(status, "Gunakan alamat lengkap yang dimulai dengan https:// untuk social link."); return; }
    submit.disabled = true;
    setFormStatus(status, "Menyimpan profil…");
    try {
      await api.saveCuratorProfile(payload);
      await refresh({ quiet: false });
      renderStudio("profile");
      setFormStatus(document.querySelector("[data-curator-profile-status]"), "Profil berhasil diperbarui.", true);
      showToast("Profil curator disimpan.");
    } catch (error) {
      setFormStatus(status, error?.message || "Profil belum dapat disimpan.");
    } finally { submit.disabled = false; }
  }
  async function submitLook(form) {
    const api = cloud();
    const status = form.querySelector("[data-curator-look-status]");
    const submit = form.querySelector("[type=submit]");
    const editId = compact(form.dataset.curatorEditId);
    const payload = collectLookPayload(form);
    const validation = validateLookPayload(payload, Boolean(editId));
    if (validation) { setFormStatus(status, validation); return; }
    if (!api || (editId ? typeof api.updateCuratorLook !== "function" : typeof api.createCuratorLook !== "function")) { setFormStatus(status, "Look belum tersambung. Coba lagi sesaat lagi."); return; }
    submit.disabled = true;
    setFormStatus(status, editId ? "Menyimpan perubahan…" : "Menerbitkan look…");
    try {
      if (editId) await api.updateCuratorLook({ id: editId, ...payload });
      else await api.createCuratorLook(payload);
      state.editingLook = null;
      await refresh({ quiet: false });
      renderStudio("looks");
      showToast(editId ? "Look diperbarui." : "Look langsung diterbitkan.");
    } catch (error) {
      setFormStatus(status, error?.message || "Look belum dapat disimpan.");
    } finally { submit.disabled = false; }
  }
  async function deleteLook(id) {
    const api = cloud();
    const look = ownCuratorLooks().find((entry) => entry.id === String(id));
    if (!look || !api || typeof api.deleteCuratorLook !== "function") return;
    if (!window.confirm(`Arsipkan look “${look.title}”? Look akan hilang dari publik dan satu slot kuota akan tersedia lagi.`)) return;
    try {
      await api.deleteCuratorLook(look.id);
      await refresh({ quiet: false });
      renderStudio("looks");
      showToast("Look diarsipkan.");
    } catch (error) { showToast(error?.message || "Look belum dapat diarsipkan."); }
  }

  function onClick(event) {
    const routeLink = event.target.closest("[data-curator-route]");
    if (routeLink) { event.preventDefault(); goToCurator(routeLink.dataset.curatorRoute); return; }
    if (event.target.closest("[data-curator-directory]")) { event.preventDefault(); goToDirectory(); return; }
    if (event.target.closest("[data-close-curator-route]")) { closeRoute({ navigate: true }); return; }
    if (event.target.closest("[data-open-curator-onboard]")) { openOnboarding(); return; }
    if (event.target.closest("[data-open-curator-account]")) { openAccount(); return; }
    if (event.target.closest("[data-open-curator-studio]")) { openStudio(); return; }
    if (event.target.closest("[data-close-curator-onboard]")) { document.getElementById("curatorOnboardDialog")?.close(); return; }
    if (event.target.closest("[data-close-curator-studio]")) { document.getElementById("curatorStudioDialog")?.close(); return; }
    const studioTab = event.target.closest("[data-curator-studio-tab]");
    if (studioTab) { state.editingLook = null; renderStudio(studioTab.dataset.curatorStudioTab); return; }
    if (event.target.closest("[data-curator-new-look]")) { state.editingLook = { items: [{}, {}] }; renderStudio("looks"); return; }
    if (event.target.closest("[data-cancel-curator-edit]")) { state.editingLook = null; renderStudio("looks"); return; }
    const edit = event.target.closest("[data-edit-curator-look]");
    if (edit) { state.editingLook = ownCuratorLooks().find((look) => look.id === String(edit.dataset.editCuratorLook)) || null; if (state.editingLook) renderStudio("looks"); return; }
    const removeReference = event.target.closest("[data-remove-curator-reference]");
    if (removeReference) { const form = removeReference.closest("form"); const rows = form?.querySelectorAll("[data-curator-reference-row]") || []; if (rows.length > MIN_REFERENCES) { removeReference.closest("[data-curator-reference-row]")?.remove(); updateReferenceControls(form); } return; }
    if (event.target.closest("[data-add-curator-reference]")) { const form = event.target.closest("form"); const list = form?.querySelector("[data-curator-reference-list]"); if (list && list.querySelectorAll("[data-curator-reference-row]").length < MAX_REFERENCES) { list.insertAdjacentHTML("beforeend", productReferenceMarkup({}, list.children.length)); updateReferenceControls(form); } return; }
    const remove = event.target.closest("[data-delete-curator-look]");
    if (remove) { deleteLook(remove.dataset.deleteCuratorLook); return; }
    const like = event.target.closest("[data-toggle-curator-like]");
    if (like) { toggleLike(like.dataset.toggleCuratorLike, like); return; }
    const shareCurator = event.target.closest("[data-share-curator]");
    if (shareCurator) { const curator = allCurators().find((item) => item.handle === shareCurator.dataset.shareCurator); if (curator) shareUrl(`${ROUTE_ROOT}/${curator.handle}`, `${curator.displayName} — COMOOTD`, `Lihat kurasi ${curator.displayName} di COMOOTD.`); return; }
    const shareLook = event.target.closest("[data-share-curator-look]");
    if (shareLook) { const look = allLooks().find((item) => item.id === String(shareLook.dataset.shareCuratorLook)); if (look) shareUrl(`/looks/${look.slug}`, `${look.title} — COMOOTD`, `Lihat kurasi ${look.title} di COMOOTD.`); }
  }
  function onSubmit(event) {
    const onboard = event.target.closest("[data-curator-onboard-form]");
    if (onboard) { event.preventDefault(); submitOnboarding(onboard); return; }
    const profile = event.target.closest("[data-curator-profile-form]");
    if (profile) { event.preventDefault(); submitProfile(profile); return; }
    const look = event.target.closest("[data-curator-look-form]");
    if (look) { event.preventDefault(); submitLook(look); }
  }
  function onKeydown(event) {
    if (event.key === "Escape" && state.routeOpen) {
      event.preventDefault();
      closeRoute({ navigate: true });
    }
  }
  function installStudioCapture() {
    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("#studioButton, #mobileStudioButton");
      if (!trigger || !state.user || !state.curator?.isActive) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openStudio();
    }, true);
  }
  function installMemberPromptObserver() {
    const observer = new MutationObserver(() => ensureMemberPrompt());
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function start() {
    ensureLayers();
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    document.addEventListener("keydown", onKeydown);
    window.addEventListener("popstate", renderRoute);
    installStudioCapture();
    installMemberPromptObserver();
    const api = cloud();
    try { if (typeof api?.onAuthStateChange === "function") api.onAuthStateChange(() => window.setTimeout(() => refresh({ quiet: true }), 0)); } catch (error) { console.warn("Unable to subscribe to curator session", error); }
    refresh({ quiet: true });
  }

  window.COMOOTDCurator = { refresh, openStudio, openOnboarding, goToCurator, goToDirectory };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
