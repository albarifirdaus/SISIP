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
  // The existing database still stores a tone for every Look. New curator
  // submissions keep this as an internal fallback, without making visual tone
  // another decision the curator has to make in the editor.
  const DEFAULT_LOOK_TONE = "carbon";
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
  const MARKETPLACES = {
    shopee: { label:"Shopee", placeholder:"https://shopee.co.id/..." },
    tiktok_shop: { label:"TikTok Shop", placeholder:"https://www.tiktok.com/..." }
  };
  // Keep these in lock-step with the public COMOOTD filter taxonomy. A curator
  // can only publish with the same language that visitors can actually search.
  const STYLE_OPTIONS = [
    "Clean", "Casual", "Formal", "Streetwear", "Modest",
    "Sporty", "Vintage", "Korean-inspired", "Workwear", "Party"
  ];
  const COLOR_OPTIONS = [
    ["Hitam", "#151515"], ["Putih", "#F7F7F2"], ["Ivory", "#F1EBDD"],
    ["Cream", "#E8D9C5"], ["Beige", "#CBB89D"], ["Taupe", "#988477"],
    ["Cokelat", "#704B38"], ["Abu-abu", "#8B8D8F"], ["Charcoal", "#3F4143"],
    ["Navy", "#1D2942"], ["Biru", "#4F73A1"], ["Denim", "#6E87A5"],
    ["Merah", "#A43A32"], ["Burgundy", "#6D2635"], ["Pink", "#D8A3AD"],
    ["Oranye", "#C86B32"], ["Kuning", "#D4AE3B"], ["Hijau", "#52705A"],
    ["Olive", "#6C7047"], ["Ungu", "#765A83"], ["Silver", "#B9BBC0"],
    ["Gold", "#B89A52"], ["Multicolor", "#B8AEA1"]
  ];
  const PERSONAL_PROFILE_TAG_OPTIONS = [
    "Stylist", "Fashion Creator", "Content Creator", "Creative Director",
    "Photographer", "Model", "Designer", "Writer", "Visual Artist",
    "Fashion Student", "Brand / Marketing", "Marketing", "Student",
    "Fashion Enthusiast", "Hardworker", "Minimalist", "Thrift Hunter",
    "Sneakerhead", "Style Explorer", "Wardrobe Curator"
  ];
  const PRODUCT_BADGE_OPTIONS = [
    "COMOOTD Pick", "Wardrobe Staple", "Statement Piece", "Layering Essential",
    "Occasion Ready", "New Find", "Best Value"
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
  const curatorFilters = { q:"", tag:"all", sort:"popular" };

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
  const optionMap = (options) => new Map(options.map((option) => [option.toLowerCase(), option]));
  function controlledTagList(value, options, maximum = 3) {
    const allowed = optionMap(options);
    return [...new Set(tagList(value, options.length)
      .map((tag) => allowed.get(tag.toLowerCase()))
      .filter(Boolean))].slice(0, maximum);
  }
  function controlledTagPickerMarkup({ name, options, selected, maximum = 3, label, note = "" }) {
    const chosen = new Set(controlledTagList(selected, options, maximum));
    return `<fieldset class="curator-choice-picker" data-curator-choice-picker data-max-selections="${maximum}">
      <legend>${esc(label)} <span data-curator-choice-count>${chosen.size} / ${maximum}</span></legend>
      <div class="curator-choice-list">${options.map((option) => `<label class="curator-choice${chosen.has(option) ? " is-selected" : ""}"><input type="checkbox" name="${esc(name)}" value="${esc(option)}"${chosen.has(option) ? " checked" : ""} /><span>${esc(option)}</span></label>`).join("")}</div>
      ${note ? `<p class="curator-file-note">${esc(note)}</p>` : ""}
    </fieldset>`;
  }
  function controlledValuesFromForm(form, name, options, maximum = 3) {
    const values = [...(form?.querySelectorAll(`input[name="${name}"]:checked`) || [])].map((input) => input.value);
    return controlledTagList(values, options, maximum);
  }
  function activeStyleOptions() {
    const remote = asArray(state.catalogue.styleTags || state.catalogue.style_tags)
      .map((item) => compact(typeof item === "string" ? item : item?.name))
      .filter(Boolean);
    return remote.length ? [...new Set(remote)] : STYLE_OPTIONS;
  }
  function curatorProfileTagOptions() {
    return [...new Set([...activeStyleOptions(), ...PERSONAL_PROFILE_TAG_OPTIONS])];
  }
  function normaliseCustomStyleTag(value) {
    const tag = compact(value).slice(0, 48);
    return tag && /[\p{L}\p{N}]/u.test(tag) ? tag : "";
  }
  function normaliseLookStyleTags(value, maximum = 3) {
    const presets = optionMap(activeStyleOptions());
    const seen = new Set();
    const output = [];
    tagList(value, 24).forEach((rawTag) => {
      const tag = presets.get(rawTag.toLowerCase()) || "";
      const key = tag.toLowerCase();
      if (!tag || seen.has(key) || output.length >= maximum) return;
      seen.add(key);
      output.push(tag);
    });
    return output;
  }
  function lookStylePickerMarkup(selected = []) {
    const selectedStyles = normaliseLookStyleTags(selected, 3);
    return `<div data-curator-look-style-field>${controlledTagPickerMarkup({ name:"styles", options:activeStyleOptions(), selected:selectedStyles, maximum:3, label:"Tag style", note:"Pilih maksimal 3 tag resmi COMOOTD. Style baru hanya dapat dibuat oleh admin." })}</div>`;
  }

  function cloud() { return window.SISIPCloud || null; }
  function publicImage(path) {
    const value = compact(path);
    if (!value) return "";
    if (/^https?:\/\//i.test(value) || value.startsWith("data:image/")) return value;
    try { return typeof cloud()?.publicUrl === "function" ? cloud().publicUrl(value) : value; } catch { return value; }
  }
  function imageAspect(value, fallback = "portrait") {
    const source = compact(value).toLowerCase();
    if (source === "square" || /(?:^|[\/_.-])square(?:[\/_.-]|$)/.test(source)) return "square";
    if (source === "portrait" || /(?:^|[\/_.-])portrait(?:[\/_.-]|$)/.test(source)) return "portrait";
    return fallback === "square" ? "square" : "portrait";
  }
  function preparedImageFile(input) {
    if (!input?.files?.length) return null;
    const cropper = window.COMOOTDImageCropper;
    if (!cropper) return input.files[0];
    const prepared = cropper.getFile(input);
    if (!prepared) throw new Error("Selesaikan pengaturan crop foto terlebih dahulu.");
    return prepared;
  }
  function selectedImageAspect(input, fallback = "portrait") {
    return imageAspect(window.COMOOTDImageCropper?.getAspect?.(input), fallback);
  }
  function bindImageCropper(input, options) {
    if (input && window.COMOOTDImageCropper?.bind) window.COMOOTDImageCropper.bind(input, options);
  }
  function optionalMetric(value, minimum, maximum, decimals = 0) {
    const source = compact(value);
    if (!source) return null;
    const numeric = Number(source);
    if (!Number.isFinite(numeric) || numeric < minimum || numeric > maximum) return null;
    const factor = 10 ** decimals;
    return Math.round(numeric * factor) / factor;
  }
  function truthyFlag(value) {
    if (value === true) return true;
    return ["1", "true", "yes", "on"].includes(compact(value).toLowerCase());
  }
  function normaliseGalleryEntry(raw, fallbackAspect = "portrait") {
    if (typeof raw === "string") {
      const path = compact(raw);
      return path ? { path, aspect: imageAspect("", fallbackAspect), alt: "" } : null;
    }
    if (!raw || typeof raw !== "object") return null;
    const path = compact(raw.path || raw.imagePath || raw.image_path || raw.url || raw.imageUrl || raw.image_url || raw.coverImage || raw.cover_image_path || "");
    if (!path) return null;
    return {
      id: compact(raw.id || raw.imageId || raw.image_id || ""),
      path,
      aspect: imageAspect(raw.aspect || raw.imageAspect || raw.image_aspect || raw.coverAspect || raw.cover_aspect, fallbackAspect),
      alt: compact(raw.alt || raw.imageAlt || raw.image_alt || raw.coverAlt || raw.cover_alt || "")
    };
  }
  function normaliseLookGallery(raw = {}, coverImage = "", coverAspect = "portrait") {
    const source = raw.gallery ?? raw.galleryImages ?? raw.gallery_images ?? raw.lookImages ?? raw.look_images ?? raw.images ?? [];
    const entries = Array.isArray(source) ? source : (Array.isArray(source?.images) ? source.images : asArray(source));
    const output = [];
    const paths = new Set();
    const add = (entry) => {
      const normalised = normaliseGalleryEntry(entry, coverAspect);
      if (!normalised || paths.has(normalised.path)) return;
      paths.add(normalised.path);
      output.push(normalised);
    };
    if (coverImage) add({ path: coverImage, aspect: coverAspect, alt: raw.coverAlt || raw.cover_alt || raw.title || "" });
    entries.forEach(add);
    return output.slice(0, 3);
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
    const bodyMetrics = raw.bodyMetrics || raw.body_metrics || profile.bodyMetrics || profile.body_metrics || {};
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
      jobTags: controlledTagList(raw.jobTags ?? raw.job_tags ?? raw.tags, curatorProfileTagOptions(), 5),
      heightCm: optionalMetric(raw.heightCm ?? raw.height_cm ?? bodyMetrics.heightCm ?? bodyMetrics.height_cm ?? bodyMetrics.height, 100, 250),
      weightKg: optionalMetric(raw.weightKg ?? raw.weight_kg ?? bodyMetrics.weightKg ?? bodyMetrics.weight_kg ?? bodyMetrics.weight, 25, 300, 1),
      bodyMetricsPublic: truthyFlag(raw.bodyMetricsPublic ?? raw.body_metrics_public ?? bodyMetrics.public ?? bodyMetrics.isPublic),
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
      price: Number(raw.price ?? raw.priceIdr ?? raw.price_idr ?? 0) || 0,
      affiliatePlatform: compact(raw.affiliatePlatform || raw.affiliate_platform || "shopee"),
      affiliateUrl: compact(raw.affiliateUrl || raw.affiliate_url || raw.url || raw.link || "")
    };
  }
  function normaliseLook(raw = {}) {
    const creator = raw.creator || raw.contributor || raw.contributor_profile || raw.contributor_profiles || null;
    const coverImage = raw.coverImage || raw.cover_image_path || raw.cover_image || "";
    const coverAspect = imageAspect(raw.coverAspect || raw.cover_aspect || raw.coverImageAspect || raw.cover_image_aspect, "portrait");
    const gallery = normaliseLookGallery(raw, coverImage, coverAspect);
    return {
      raw,
      id: String(raw.id || ""),
      creatorId: String(raw.creatorId || raw.creator_id || creator?.userId || creator?.user_id || ""),
      creator: creator ? normaliseCurator(creator) : null,
      title: compact(raw.title || "Untitled look") || "Untitled look",
      excerpt: compact(raw.excerpt || raw.description || ""),
      slug: compact(raw.slug || raw.id || ""),
      styles: normaliseLookStyleTags(raw.styles || raw.styleTags || raw.style_tags, 3),
      gender: compact(raw.gender || "Uniseks") || "Uniseks",
      tone: compact(raw.tone || raw.mood || ""),
      coverImage: coverImage || gallery[0]?.path || "",
      coverAspect,
      coverAlt: compact(raw.coverAlt || raw.cover_alt || raw.title || ""),
      gallery,
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
  function marketplaceFromUrl(value) {
    try {
      const host = new URL(value).hostname.toLowerCase();
      if (host === "shopee.co.id" || host.endsWith(".shopee.co.id") || host === "shope.ee") return "shopee";
      if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok_shop";
      return "";
    } catch { return ""; }
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
      <div class="curator-card-top curator-card-top--count"><span class="curator-card-number">${looks.length} CURATION${looks.length === 1 ? "" : "S"}</span></div>
      <div class="curator-card-person">
        ${imageMarkup(curator.avatarPath, "", "curator-avatar", curator.displayName)}
        <div><h3 class="curator-card-name">${esc(curator.displayName)}</h3><p class="curator-card-handle">@${esc(curator.handle)}</p></div>
      </div>
      <p class="curator-card-bio">${esc(curator.bio || "A personal edit of pieces worth repeating.")}</p>
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
          <p class="section-description">Temukan kurasi dari para fashion people dengan selera, referensi, dan tautan marketplace mereka sendiri.</p>
          <div class="curator-heading-actions"><a class="text-link" href="${ROUTE_ROOT}" data-curator-directory>Meet all curators <span aria-hidden="true">↗</span></a>${leadAction}</div>
        </div>
      </div>
      ${curators.length ? `<div class="curator-home-grid">${curators.slice(0, 4).map((curator, index) => curatorCardMarkup(curator, index)).join("")}</div>` : `<div class="curator-home-empty">Belum ada kurasi komunitas yang diterbitkan. Jadilah yang pertama membagikan sudut pandangmu.</div>`}
    </section>`;
  }
  function profileSocialMarkup(curator) {
    const socials = curator.socials.filter((social) => /^https:\/\//i.test(social.url));
    const follow = window.COMOOTDRetentionInstance?.followButton?.(curator.userId) || "";
    return `<div class="curator-socials">${socials.map((social) => `<a href="${esc(social.url)}" target="_blank" rel="noopener noreferrer">${esc(socialLabel(social.platform))} ↗</a>`).join("")}${follow}<button type="button" class="curator-share-button" data-share-curator="${esc(curator.handle)}">Bagikan profil ↗</button></div>`;
  }
  function publicBodyMetricsMarkup(curator) {
    const metrics = [];
    if (curator.heightCm !== null && curator.heightCm !== undefined) metrics.push(`Tinggi ${curator.heightCm} cm`);
    if (curator.weightKg !== null && curator.weightKg !== undefined) metrics.push(`Berat ${curator.weightKg} kg`);
    return metrics.length ? `<div class="curator-profile-tags curator-profile-metrics" aria-label="Informasi tinggi dan berat curator">${metrics.map((metric) => `<span class="curator-tag">${esc(metric)}</span>`).join("")}</div>` : "";
  }
  function lookCardMarkup(look) {
    const cover = publicImage(look.coverImage);
    const liked = state.liked.has(look.id);
    return `<article class="curator-look-card image-frame--${imageAspect(look.coverAspect || look.coverImage, "portrait")}">
      ${cover ? `<div class="curator-card-media"><img src="${esc(cover)}" alt="${esc(look.coverAlt || look.title)}" loading="lazy" /></div>` : ""}
      <div class="curator-look-card-top"><span class="eyebrow">${esc(look.gender)}</span><span class="curator-look-card-meta">${esc(humanDate(look.publishedAt))}</span></div>
      <h3 class="curator-look-card-title">${esc(look.title)}</h3>
      <p class="curator-look-card-meta">${esc(look.styles.slice(0, 3).join(" · ") || "Curated look")}</p>
      ${publicBodyMetricsMarkup(look.creator)}
      <div class="curator-look-card-actions">
        <a href="/looks/${encodeURIComponent(look.slug)}" aria-label="Buka ${esc(look.title)}">Lihat look ↗</a>
        <button type="button" data-toggle-curator-like="${esc(look.id)}" aria-pressed="${liked ? "true" : "false"}" aria-label="Sukai ${esc(look.title)}">♥ ${look.popularity}</button>
        <button type="button" data-share-curator-look="${esc(look.id)}" aria-label="Bagikan ${esc(look.title)}">Share</button>
      </div>
    </article>`;
  }
  function routeBarMarkup() {
    return `<header class="curator-route-bar"><button class="curator-route-brand" type="button" data-close-curator-route aria-label="COMOOTD, kembali ke beranda"><img class="curator-route-wordmark" src="/assets/branding/comootd-wordmark-sisip-v1.png" width="2172" height="724" alt="" decoding="async" /></button><button class="curator-route-back" type="button" data-close-curator-route>← Back to COMOOTD</button></header>`;
  }
  function directoryMarkup() {
    let curators = allCurators();
    const q = curatorFilters.q.trim().toLowerCase();
    if (q) curators = curators.filter((curator) => [curator.displayName, curator.handle, curator.bio, ...curator.jobTags].join(" ").toLowerCase().includes(q));
    if (curatorFilters.tag !== "all") curators = curators.filter((curator) => curator.jobTags.includes(curatorFilters.tag));
    curators.sort((a,b)=>curatorFilters.sort === "az" ? a.displayName.localeCompare(b.displayName,"id") : curatorFilters.sort === "newest" ? String(b.raw?.createdAt||b.raw?.created_at||"").localeCompare(String(a.raw?.createdAt||a.raw?.created_at||"")) : curatorLooks(b).reduce((sum,look)=>sum+look.popularity,0)-curatorLooks(a).reduce((sum,look)=>sum+look.popularity,0));
    const tags=[...new Set(allCurators().flatMap((curator)=>curator.jobTags))].sort();
    return `<div class="curator-route-shell">${routeBarMarkup()}<main class="curator-route-body">
      <section class="curator-directory-head" aria-labelledby="curatorDirectoryTitle">
        <div><p class="eyebrow" style="color:var(--clay)">COMOOTD / CURATOR DIRECTORY</p><h1 id="curatorDirectoryTitle">Meet the<br /><span>Curators.</span></h1></div>
        <p class="curator-directory-copy">A growing collective of personal fashion edits. Setiap profil membawa sudut pandang sendiri—dengan tautan affiliate yang dikelola pemilik kurasi.</p>
      </section>
      <div class="curator-directory-filters"><label><span>Search curator</span><input type="search" data-curator-directory-filter="q" value="${esc(curatorFilters.q)}" placeholder="Nama, @handle, bio, atau tag" /></label><label><span>Style / profile</span><select data-curator-directory-filter="tag"><option value="all">Semua tag</option>${tags.map((tag)=>`<option value="${esc(tag)}"${curatorFilters.tag===tag?" selected":""}>${esc(tag)}</option>`).join("")}</select></label><label><span>Urutkan</span><select data-curator-directory-filter="sort"><option value="popular"${curatorFilters.sort==="popular"?" selected":""}>Paling populer</option><option value="newest"${curatorFilters.sort==="newest"?" selected":""}>Terbaru</option><option value="az"${curatorFilters.sort==="az"?" selected":""}>A–Z</option></select></label></div><p class="curator-directory-result">${curators.length} curator ditemukan</p>
      <section class="curator-directory-grid" aria-label="Daftar Curator">${curators.length ? curators.map((curator, index) => curatorCardMarkup(curator, index, true)).join("") : `<div class="curator-empty">Belum ada curator aktif. Kembali ke beranda untuk menjadi curator pertama.</div>`}</section>
    </main></div>`;
  }
  function profileMarkup(curator) {
    const looks = curatorLooks(curator).sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
    const totalLikes = looks.reduce((total, look) => total + look.popularity, 0);
    return `<div class="curator-route-shell">${routeBarMarkup()}<main class="curator-route-body">
      <section class="curator-profile-hero" aria-labelledby="curatorProfileTitle" data-insight-curator-id="${esc(curator.userId)}">
        <div class="curator-profile-identity">
          ${imageMarkup(curator.avatarPath, `Foto ${curator.displayName}`, "curator-profile-avatar", curator.displayName)}
          <div><p class="eyebrow" style="color:var(--clay)">COMOOTD CURATOR</p><h1 class="curator-profile-title" id="curatorProfileTitle">${esc(curator.displayName)}</h1><p class="curator-profile-handle">@${esc(curator.handle)}</p></div>
        </div>
        <div class="curator-profile-side">
          <p class="curator-profile-bio">${esc(curator.bio || "Personal edits, styled with intention.")}</p>
          ${curator.jobTags.length ? `<div class="curator-profile-tags">${curator.jobTags.map((tag) => `<span class="curator-tag">${esc(tag)}</span>`).join("")}</div>` : ""}
          ${publicBodyMetricsMarkup(curator)}
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
      if (curator) void window.COMOOTDRetentionInstance?.recordView?.("curator", curator.userId);
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
    return `<div class="curator-onboard-shell"><button class="icon-button modal-close" type="button" data-close-curator-onboard aria-label="Tutup">×</button><p class="eyebrow" style="color:var(--clay)">COMOOTD / OPEN CURATOR</p><h2>Show Your<br />Point of View.</h2><p class="curator-onboard-copy">Buka profil curator gratis untuk membagikan hingga ${DEFAULT_QUOTA} look aktif. Tautan marketplace yang kamu cantumkan tetap milikmu.</p><form class="curator-form" data-curator-onboard-form>
      <div class="curator-form-grid"><div class="curator-field"><label for="curatorOnboardName">Nama tampil</label><input id="curatorOnboardName" name="displayName" maxlength="80" required placeholder="Nama kamu" /></div><div class="curator-field"><label for="curatorOnboardHandle">Handle</label><input id="curatorOnboardHandle" name="handle" minlength="3" maxlength="32" pattern="[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?" required placeholder="contoh: araedits" autocomplete="off" /><p class="curator-file-note">3–32 karakter: huruf kecil, angka, _ atau -.</p></div></div>
      ${controlledTagPickerMarkup({ name:"profileTags", options:curatorProfileTagOptions(), selected:[], maximum:5, label:"Fashion style & personal profile", note:"Pilih maksimal 5 tag yang menggambarkan style dan personal point of view-mu." })}
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
    const heightValue = curator.heightCm ?? "";
    const weightValue = curator.weightKg ?? "";
    return `<section class="curator-studio-panel" data-curator-studio-panel="profile"><p class="eyebrow" style="color:var(--clay)">YOUR PUBLIC PROFILE</p><h3>Make the profile<br />feel like you.</h3><p class="curator-studio-lede">Foto, tag fashion dan personal, bio, tautan sosial, serta detail tubuh opsional tampil di halaman shareable milikmu.</p>
      <form class="curator-form" data-curator-profile-form><div class="curator-profile-photo-row">${imageMarkup(curator.avatarPath, "", "curator-profile-avatar", curator.displayName)}<div class="curator-field" style="flex:1"><label for="curatorAvatarInput">Foto profil</label><input id="curatorAvatarInput" name="avatarFile" type="file" accept="image/jpeg,image/png,image/webp" /><p class="curator-file-note">JPG, PNG, atau WebP. Maksimal 5 MB.</p></div></div>
      <div class="curator-form-grid"><div class="curator-field"><label for="curatorDisplayName">Nama tampil</label><input id="curatorDisplayName" name="displayName" maxlength="80" value="${esc(curator.displayName)}" required /></div><div class="curator-field"><label for="curatorHandle">Handle</label><input id="curatorHandle" name="handle" minlength="3" maxlength="32" value="${esc(curator.handle)}" pattern="[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?" required /><p class="curator-file-note">Handle menjadi alamat profil kamu.</p></div></div>
      ${controlledTagPickerMarkup({ name:"profileTags", options:curatorProfileTagOptions(), selected:curator.jobTags, maximum:5, label:"Fashion style & personal profile", note:"Pilih maksimal 5 tag yang menggambarkan style dan personal point of view-mu." })}<div class="curator-field"><label for="curatorBio">Bio</label><textarea id="curatorBio" name="bio" maxlength="500" placeholder="Sudut pandang style kamu.">${esc(curator.bio)}</textarea></div>
      <div class="curator-form-grid"><div class="curator-field"><label for="curatorHeightCm">Tinggi badan (cm)</label><input id="curatorHeightCm" name="heightCm" type="number" min="100" max="250" step="1" inputmode="numeric" value="${esc(heightValue)}" placeholder="Contoh: 170" /></div><div class="curator-field"><label for="curatorWeightKg">Berat badan (kg)</label><input id="curatorWeightKg" name="weightKg" type="number" min="25" max="300" step="0.1" inputmode="decimal" value="${esc(weightValue)}" placeholder="Contoh: 58" /></div></div>
      <p class="curator-file-note">Tinggi dan berat badan bersifat opsional. Jika diisi, data akan otomatis tampil pada profil publik dan look yang kamu buat.</p>
      <div><p class="curator-inline-label">Social links</p><div class="curator-social-fields">${Object.entries(SOCIAL_LABELS).map(([platform, label]) => `<div class="curator-field"><label for="curatorSocial${platform}">${esc(label)}</label><input id="curatorSocial${platform}" name="social-${esc(platform)}" type="url" placeholder="https://" value="${esc(socialMap[platform] || "")}" /></div>`).join("")}</div></div>
      <div class="curator-form-actions"><p class="curator-form-status" data-curator-profile-status role="alert"></p><button class="button" type="submit">Simpan profil ↗</button></div></form></section>`;
  }
  function productReferenceMarkup(item = {}, index = 0) {
    const reference = normaliseReference(item);
    const selectedColor = COLOR_OPTIONS.some(([name]) => name.toLowerCase() === reference.colorLabel.toLowerCase()) ? reference.colorLabel : "";
    return `<div class="curator-product-reference" data-curator-reference-row>
      <div class="curator-field"><label>Kategori</label><select name="referenceCategory">${PRODUCT_CATEGORIES.map(([value, label]) => `<option value="${value}"${reference.category === value ? " selected" : ""}>${esc(label)}</option>`).join("")}</select></div>
      <div class="curator-field"><label>Nama produk</label><input name="referenceName" maxlength="160" value="${esc(reference.name)}" placeholder="Contoh: Linen Relaxed Shirt" required /></div>
      <div class="curator-field"><label>Warna / varian</label><select name="referenceColor"><option value="">Pilih warna</option>${COLOR_OPTIONS.map(([name, hex]) => `<option value="${esc(name)}"${name === selectedColor ? " selected" : ""}>${esc(name)} · ${esc(hex)}</option>`).join("")}</select><span class="curator-color-preview" data-curator-color-preview style="--curator-color:${esc(COLOR_OPTIONS.find(([name]) => name === selectedColor)?.[1] || "transparent")}">${selectedColor ? esc(COLOR_OPTIONS.find(([name]) => name === selectedColor)?.[1]) : "Opsional"}</span></div>
      <div class="curator-field"><label>Harga referensi</label><input name="referencePrice" type="number" min="1" step="1" inputmode="numeric" value="${reference.price || ""}" placeholder="Contoh: 159000" required /></div>
      <div class="curator-form-grid curator-field-full"><div class="curator-field"><label>Marketplace</label><select name="referenceMarketplace">${Object.entries(MARKETPLACES).map(([value, option]) => `<option value="${value}"${reference.affiliatePlatform === value ? " selected" : ""}>${esc(option.label)}</option>`).join("")}</select></div><div class="curator-field"><label>Link affiliate</label><input name="referenceUrl" type="url" value="${esc(reference.affiliateUrl)}" placeholder="${esc(MARKETPLACES[reference.affiliatePlatform]?.placeholder || MARKETPLACES.shopee.placeholder)}" required /></div></div>
      <button class="curator-remove-reference" type="button" data-remove-curator-reference aria-label="Hapus produk ${index + 1}">×</button>
    </div>`;
  }
  function lookEditorMarkup(editing = null) {
    const isExistingLook = Boolean(editing?.id);
    const references = editing?.items?.length ? editing.items.slice(0, MAX_REFERENCES) : [{}, {}];
    return `<section class="curator-studio-panel" data-curator-studio-panel="editor"><p class="eyebrow" style="color:var(--clay)">${isExistingLook ? "EDIT LOOK" : "NEW CURATION"}</p><h3>${isExistingLook ? "Refine this\nlook." : "Build a look\nworth sharing."}</h3><p class="curator-studio-lede">Kamu bisa menerbitkan langsung—tanpa review admin. Tambahkan 2 hingga 5 produk dengan tautan affiliate Shopee atau TikTok Shop milikmu.</p>
      <form class="curator-form" data-curator-look-form data-curator-edit-id="${esc(editing?.id || "")}"><div class="curator-form-grid">
        <div class="curator-field curator-field-full"><label for="curatorLookTitle">Nama mix &amp; match</label><input id="curatorLookTitle" name="title" maxlength="160" value="${esc(editing?.title || "")}" placeholder="Contoh: Monday in Olive" required /></div>
        <div class="curator-field curator-field-full"><label for="curatorLookExcerpt">Deskripsi kurasi (opsional)</label><textarea id="curatorLookExcerpt" name="excerpt" maxlength="240" placeholder="Jelaskan ide, occasion, atau formula styling dalam maksimal 240 karakter.">${esc(editing?.excerpt || "")}</textarea><p class="curator-file-note">Kosongkan jika judul dan visual sudah cukup menjelaskan look.</p></div>
        <div class="curator-field"><label for="curatorLookGender">Gender</label><select id="curatorLookGender" name="gender"><option value="Uniseks"${editing?.gender === "Uniseks" ? " selected" : ""}>Uniseks</option><option value="Pria"${editing?.gender === "Pria" ? " selected" : ""}>Pria</option><option value="Wanita"${editing?.gender === "Wanita" ? " selected" : ""}>Wanita</option></select></div>
        ${lookStylePickerMarkup(editing?.styles || [])}
        <div class="curator-field curator-field-full"><label for="curatorLookCover">Foto 1 · Cover look${isExistingLook ? " (opsional)" : ""}</label><input id="curatorLookCover" name="coverFile" type="file" accept="image/jpeg,image/png,image/webp" data-curator-gallery-input data-curator-gallery-slot="1"${isExistingLook ? "" : " required"} /><p class="curator-file-note">${isExistingLook ? "Pilih foto baru hanya bila ingin mengganti cover. Foto yang tidak diganti tetap disimpan." : "Wajib untuk look baru."} Atur crop lalu pilih Gunakan foto. Unggah hingga 3 foto; foto pertama selalu menjadi cover. JPG, PNG, atau WebP, maksimal 5 MB per foto.</p></div>
        <div class="curator-field"><label for="curatorLookGallery2">Foto 2 · Detail (opsional)</label><input id="curatorLookGallery2" name="galleryFile2" type="file" accept="image/jpeg,image/png,image/webp" data-curator-gallery-input data-curator-gallery-slot="2" /><p class="curator-file-note">Tambahkan detail pendukung untuk gallery look.</p></div>
        <div class="curator-field"><label for="curatorLookGallery3">Foto 3 · Detail (opsional)</label><input id="curatorLookGallery3" name="galleryFile3" type="file" accept="image/jpeg,image/png,image/webp" data-curator-gallery-input data-curator-gallery-slot="3" /><p class="curator-file-note">Atur crop foto ini sebelum disimpan.</p></div>
      </div>
      <div class="curator-reference-head"><h4>Products in this look</h4><span class="curator-reference-count" data-curator-reference-count>${references.length} / ${MAX_REFERENCES}</span></div>
      <div class="curator-reference-list" data-curator-reference-list>${references.map(productReferenceMarkup).join("")}</div>
      <button class="curator-small-button" type="button" data-add-curator-reference${references.length >= MAX_REFERENCES ? " disabled" : ""}>+ Tambah produk</button>
      <div class="curator-form-actions"><button class="curator-small-button" type="button" data-cancel-curator-edit>Kembali</button><div><p class="curator-form-status" data-curator-look-status role="alert"></p><button class="button" type="submit">${isExistingLook ? "Simpan perubahan" : "Publish look"} ↗</button></div></div>
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
  function studioInsightsMarkup() {
    return `<section class="curator-studio-panel" data-curator-studio-panel="analytics"><p class="eyebrow" style="color:var(--clay)">YOUR PERFORMANCE</p><h3>See what<br />moves people.</h3><p class="curator-studio-lede">Lihat berapa kali kurasimu dibuka, dibagikan, dan mengirim pengunjung ke produk—tanpa menampilkan identitas pengunjung.</p><div data-insights-dashboard="curator"><div class="insights-loading">Memuat analytics curator…</div></div></section>`;
  }
  function renderStudio(tab = state.studioTab) {
    const dialog = document.getElementById("curatorStudioDialog");
    if (!dialog || !state.curator) return;
    state.studioTab = tab;
    const quota = state.curator.maxPublishedLooks || DEFAULT_QUOTA;
    const count = publishedOwnLookCount();
    const body = state.editingLook ? lookEditorMarkup(state.editingLook) : (tab === "profile" ? profileEditorMarkup(state.curator) : tab === "analytics" ? studioInsightsMarkup() : studioLibraryMarkup());
    window.requestAnimationFrame(() => {
      const avatarInput = dialog.querySelector("#curatorAvatarInput");
      bindImageCropper(avatarInput, { defaultAspect:"square", lockedAspect:"square", label:"foto profil" });
      [...dialog.querySelectorAll("[data-curator-gallery-input]")].forEach((input, index) => {
        bindImageCropper(input, { defaultAspect:"portrait", label:index === 0 ? "foto cover look" : `foto look ${index + 1}` });
      });
    });
    dialog.innerHTML = `<button class="icon-button curator-studio-close" type="button" data-close-curator-studio aria-label="Tutup Curator Studio">×</button><div class="curator-studio-shell"><aside class="curator-studio-side"><p class="eyebrow">COMOOTD / CURATOR</p><h2>Studio<br />${esc(state.curator.displayName.split(" ")[0])}</h2><div class="curator-studio-quota"><strong>${count} / ${quota}</strong><span>Look aktif di Starter</span></div><nav class="curator-studio-tabs" aria-label="Menu Curator Studio"><button class="curator-studio-tab${tab === "looks" && !state.editingLook ? " is-active" : ""}" type="button" data-curator-studio-tab="looks">Look library</button><button class="curator-studio-tab${tab === "profile" && !state.editingLook ? " is-active" : ""}" type="button" data-curator-studio-tab="profile">Profile</button><button class="curator-studio-tab${tab === "analytics" && !state.editingLook ? " is-active" : ""}" type="button" data-curator-studio-tab="analytics">Analytics</button></nav></aside><div class="curator-studio-main">${body}</div></div>`;
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
  function refreshChoicePicker(picker) {
    if (!picker) return;
    const maximum = Number(picker.dataset.maxSelections || 3);
    const active = picker.querySelectorAll("input:checked");
    picker.querySelector("[data-curator-choice-count]")?.replaceChildren(`${active.length} / ${maximum}`);
    picker.querySelectorAll(".curator-choice").forEach((choice) => choice.classList.toggle("is-selected", Boolean(choice.querySelector("input")?.checked)));
  }
  function collectGalleryPayload(form) {
    const existingGallery = asArray(state.editingLook?.gallery).slice(0, 3);
    const slots = [...form.querySelectorAll("[data-curator-gallery-input]")]
      .sort((left, right) => Number(left.dataset.curatorGallerySlot || 0) - Number(right.dataset.curatorGallerySlot || 0))
      .map((input, index) => {
        const slot = Number(input.dataset.curatorGallerySlot || index + 1);
        const current = normaliseGalleryEntry(existingGallery[slot - 1], "portrait");
        const file = preparedImageFile(input);
        return {
          sortOrder: slot,
          role: slot === 1 ? "cover" : "gallery",
          file,
          aspect: selectedImageAspect(input, current?.aspect || "portrait"),
          currentPath: current?.path || "",
          path: current?.path || "",
          alt: current?.alt || ""
        };
      });
    const cover = slots.find((entry) => entry.sortOrder === 1) || null;
    const gallery = slots.filter((entry) => entry.file || entry.path);
    return {
      // Existing adapter versions still use these two cover fields.
      coverFile: cover?.file || null,
      coverAspect: cover?.aspect || "portrait",
      // New adapter versions can retain the slot order and replace only the
      // files that are present, while preserving `currentPath` for the rest.
      galleryFiles: slots.map((entry) => entry.file).filter(Boolean),
      gallery
    };
  }
  function collectLookPayload(form) {
    const references = [...form.querySelectorAll("[data-curator-reference-row]")].map((row) => ({
      category: compact(row.querySelector("[name=referenceCategory]")?.value || "other"),
      name: compact(row.querySelector("[name=referenceName]")?.value),
      colorLabel: compact(row.querySelector("[name=referenceColor]")?.value),
      price: Number(String(row.querySelector("[name=referencePrice]")?.value || "").replace(/[^0-9]/g, "")),
      affiliatePlatform: compact(row.querySelector("[name=referenceMarketplace]")?.value || "shopee"),
      affiliateUrl: compact(row.querySelector("[name=referenceUrl]")?.value)
    }));
    const galleryPayload = collectGalleryPayload(form);
    return {
      title: compact(form.elements.title?.value),
      excerpt: compact(form.elements.excerpt?.value).slice(0, 240),
      gender: compact(form.elements.gender?.value || "Uniseks"),
      tone: DEFAULT_LOOK_TONE,
      styles: normaliseLookStyleTags([...form.querySelectorAll('input[name="styles"]:checked')].map((input) => input.value), 3),
      ...galleryPayload,
      items: references
    };
  }
  function validateLookPayload(payload, editing) {
    if (!payload.title) return "Nama look wajib diisi.";
    if (!payload.styles.length) return "Pilih minimal satu tag style.";
    if (!editing && !payload.coverFile) return "Tambahkan foto cover untuk look baru.";
    if ((payload.galleryFiles || []).some((file) => file.size > 5 * 1024 * 1024)) return "Ukuran setiap foto look maksimal 5 MB.";
    if (payload.items.length < MIN_REFERENCES || payload.items.length > MAX_REFERENCES) return `Tambahkan ${MIN_REFERENCES}–${MAX_REFERENCES} produk ke dalam look.`;
    if (payload.items.some((item) => !item.name || !item.affiliateUrl || !Number.isSafeInteger(item.price) || item.price <= 0)) return "Setiap produk membutuhkan nama, harga, dan link affiliate.";
    if (payload.items.some((item) => marketplaceFromUrl(item.affiliateUrl) !== item.affiliatePlatform)) return "Pastikan setiap link sesuai dengan marketplace yang dipilih.";
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
        // The adapter returns a wrapper for every signed-in member. Only the
        // nested `curator` value represents an activated Curator profile.
        const curatorSource = curatorRaw?.curator || (curatorRaw?.handle ? curatorRaw : null);
        if (curatorSource) state.curator = normaliseCurator(curatorSource);
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
    prompt.innerHTML = `<p><strong>Sudah punya sudut pandang sendiri?</strong><br />Buka profil Curator gratis untuk membagikan hingga ${DEFAULT_QUOTA} look dan tautan affiliate marketplace-mu.</p><button class="button-outline" type="button" data-open-curator-onboard>Jadi Curator ↗</button>`;
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
      window.dispatchEvent(new CustomEvent("comootd:like-change", { detail: { source: "curator", lookId: String(id), liked, delta: liked === wasLiked ? 0 : (liked ? 1 : -1) } }));
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
      profileTags: controlledValuesFromForm(form, "profileTags", curatorProfileTagOptions(), 5),
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
    const avatarInput = form.elements.avatarFile;
    const avatarFile = preparedImageFile(avatarInput);
    const heightInput = form.elements.heightCm;
    const weightInput = form.elements.weightKg;
    const heightCm = optionalMetric(heightInput?.value, 100, 250);
    const weightKg = optionalMetric(weightInput?.value, 25, 300, 1);
    const socials = Object.keys(SOCIAL_LABELS).map((platform) => ({ platform, url: compact(form.elements[`social-${platform}`]?.value) })).filter((entry) => entry.url);
    const invalidSocial = socials.find((entry) => !/^https:\/\//i.test(entry.url));
    const payload = {
      displayName: compact(form.elements.displayName?.value),
      handle: safeHandle(form.elements.handle?.value),
      bio: compact(form.elements.bio?.value),
      profileTags: controlledValuesFromForm(form, "profileTags", curatorProfileTagOptions(), 5),
      avatarFile,
      heightCm,
      weightKg,
      bodyMetricsPublic: true,
      socials,
      socialLinks: socials
    };
    if (!payload.displayName || !payload.handle) { setFormStatus(status, "Nama tampil dan handle wajib diisi."); return; }
    if (!/^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/.test(payload.handle) || payload.handle.length < 3 || payload.handle.length > 32) { setFormStatus(status, "Handle harus 3–32 karakter dan hanya memakai huruf kecil, angka, _ atau -."); return; }
    if (avatarFile && avatarFile.size > 5 * 1024 * 1024) { setFormStatus(status, "Ukuran foto profil maksimal 5 MB."); return; }
    if (compact(heightInput?.value) && heightCm === null) { setFormStatus(status, "Tinggi badan harus berada di antara 100–250 cm."); return; }
    if (compact(weightInput?.value) && weightKg === null) { setFormStatus(status, "Berat badan harus berada di antara 25–300 kg."); return; }
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
    try {
      const payload = collectLookPayload(form);
      const validation = validateLookPayload(payload, Boolean(editId));
      if (validation) { setFormStatus(status, validation); return; }
      if (!api || (editId ? typeof api.updateCuratorLook !== "function" : typeof api.createCuratorLook !== "function")) { setFormStatus(status, "Look belum tersambung. Coba lagi sesaat lagi."); return; }
      if (submit) submit.disabled = true;
      setFormStatus(status, editId ? "Menyimpan perubahan…" : "Menerbitkan look…");
      if (editId) await api.updateCuratorLook({ id: editId, ...payload });
      else await api.createCuratorLook(payload);
      state.editingLook = null;
      await refresh({ quiet: false });
      renderStudio("looks");
      showToast(editId ? "Look diperbarui." : "Look langsung diterbitkan.");
    } catch (error) {
      setFormStatus(status, error?.message || "Look belum dapat disimpan.");
    } finally { if (submit) submit.disabled = false; }
  }
  async function deleteLook(id, trigger) {
    const api = cloud();
    const look = ownCuratorLooks().find((entry) => entry.id === String(id));
    if (!look || !api || typeof api.deleteCuratorLook !== "function") return;
    if (trigger?.dataset.archiveConfirmed !== "true") {
      trigger.dataset.archiveConfirmed = "true";
      trigger.textContent = "Konfirmasi arsip";
      trigger.classList.add("is-confirming");
      showToast(`Klik sekali lagi untuk mengarsipkan “${look.title}”.`);
      window.setTimeout(() => {
        if (!trigger?.isConnected || trigger.dataset.archiveConfirmed !== "true") return;
        delete trigger.dataset.archiveConfirmed;
        trigger.textContent = "Arsipkan";
        trigger.classList.remove("is-confirming");
      }, 6000);
      return;
    }
    trigger.disabled = true;
    trigger.textContent = "Mengarsipkan…";
    try {
      await api.deleteCuratorLook(look.id);
      state.catalogue.looks = asArray(state.catalogue.looks).filter((entry) => String(entry?.id) !== look.id);
      await refresh({ quiet: false });
      renderStudio("looks");
      showToast("Look diarsipkan.");
    } catch (error) {
      trigger.disabled = false;
      delete trigger.dataset.archiveConfirmed;
      trigger.textContent = "Arsipkan";
      trigger.classList.remove("is-confirming");
      showToast(error?.message || "Look belum dapat diarsipkan.");
    }
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
    if (remove) { void deleteLook(remove.dataset.deleteCuratorLook, remove); return; }
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
  function onChange(event) {
    const marketplace = event.target.closest('select[name="referenceMarketplace"]');
    if (marketplace) {
      const link = marketplace.closest("[data-curator-reference-row]")?.querySelector('input[name="referenceUrl"]');
      if (link) link.placeholder = MARKETPLACES[marketplace.value]?.placeholder || "https://";
      return;
    }
    const directoryFilter = event.target.closest("[data-curator-directory-filter]");
    if (directoryFilter) {
      curatorFilters[directoryFilter.dataset.curatorDirectoryFilter] = directoryFilter.value;
      renderRoute();
      return;
    }
    const colorSelect = event.target.closest('select[name="referenceColor"]');
    if (colorSelect) {
      const selected = COLOR_OPTIONS.find(([name]) => name === colorSelect.value);
      const preview = colorSelect.parentElement?.querySelector("[data-curator-color-preview]");
      if (preview) {
        preview.style.setProperty("--curator-color", selected?.[1] || "transparent");
        preview.textContent = selected?.[1] || "Opsional";
      }
      return;
    }
    const metricsVisibility = event.target.closest("[data-curator-metrics-visibility] input[type=checkbox]");
    if (metricsVisibility) {
      metricsVisibility.closest(".curator-choice")?.classList.toggle("is-selected", metricsVisibility.checked);
      return;
    }
    const input = event.target.closest("[data-curator-choice-picker] input[type=checkbox]");
    if (!input) return;
    const picker = input.closest("[data-curator-choice-picker]");
    const maximum = Number(picker?.dataset.maxSelections || 3);
    const selected = [...picker.querySelectorAll("input:checked")];
    if (selected.length > maximum) {
      input.checked = false;
      showToast(`Pilih maksimal ${maximum} tag.`);
    }
    refreshChoicePicker(picker);
  }
  let curatorSearchTimer = 0;
  function onInput(event) {
    const input = event.target.closest('[data-curator-directory-filter="q"]');
    if (!input) return;
    curatorFilters.q = input.value;
    clearTimeout(curatorSearchTimer);
    curatorSearchTimer = window.setTimeout(renderRoute, 180);
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
      // Admin Studio must always retain its own entry point. Curator Studio
      // only captures this action for an activated profile with a public handle.
      if (!trigger || !state.user || state.user.isAdmin || !state.curator?.isActive || !state.curator?.handle) return;
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
    document.addEventListener("change", onChange);
    document.addEventListener("input", onInput);
    document.addEventListener("keydown", onKeydown);
    window.addEventListener("popstate", renderRoute);
    window.addEventListener("comootd:like-change", (event) => {
      const detail = event?.detail || {};
      if (detail.source === "curator" || !detail.lookId) return;
      const id = String(detail.lookId);
      if (detail.liked) state.liked.add(id); else state.liked.delete(id);
      updateLookPopularity(id, Number(detail.delta || 0));
      renderHome();
      renderRoute();
    });
    window.addEventListener("comootd:retention-change", (event) => {
      const followed = new Set((event?.detail?.followedCuratorIds || []).map(String));
      document.querySelectorAll("[data-retention-follow]").forEach((button) => {
        const active = followed.has(String(button.dataset.retentionFollow));
        button.classList.toggle("is-followed", active);
        button.setAttribute("aria-pressed", String(active));
        button.textContent = active ? "Mengikuti ✓" : "Ikuti curator +";
      });
    });
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

