(() => {
  "use strict";

  function create(options = {}) {
    const {
      getState, esc, slugify, money, safeImage, marketplaces, productCategories,
      marketplaceOf, marketplaceLabel, lookVisual, productArt, lookAttribution,
      curatorMetricsMarkup, lookLikeButton, saveButton, articleCategoryLabel
    } = options;
    if (typeof getState !== "function") throw new Error("Catalogue state provider is required.");
    const doc = options.document || window.document;
    const browserWindow = options.window || window;
    const defaults = { q:"", gender:"all", style:"all", sort:"popular", category:"all", price:"all", marketplace:"all" };
    const filters = { ...defaults };
    const views = new Map();
    const pager = window.COMOOTDPagination.create(browserWindow);
    const pages = new Map();
    let pageError = "", loadingKey = "";
    let filterPath = "", renderedPath = "", suspendedPath = "";
    const path = () => browserWindow.location.pathname.replace(/\/+$/, "") || "/";
    function syncFilters() {
      const next = path() + browserWindow.location.search;
      if (next === filterPath) return;
      if (filterPath) views.set(filterPath, { ...views.get(filterPath), filters:{ ...filters } });
      Object.assign(filters, pager.readFilters(defaults));
      filterPath = next;
    }
    function remember() {
      if (!renderedPath) return;
      views.set(renderedPath, { ...views.get(renderedPath), filters:{ ...filters }, scroll:ensureLayer().scrollTop });
      suspendedPath = renderedPath;
    }

    function readRoute() {
      const pathname = browserWindow.location.pathname.replace(/\/+$/, "") || "/";
      const entries = {
        "/looks": { key:"looks", title:"All Looks", deck:"Daily plans, different moods. Explore look dari COMOOTD dan para kurator, lengkap dengan detail produknya." },
        "/looks/comootd": { key:"comootd", title:"Looks by COMOOTD", deck:"The COMOOTD edit. Pilihan look dari tim kami untuk inspirasi mix & match kamu." },
        "/looks/curators": { key:"curators", title:"Looks by Curators", deck:"Different people, different takes. Temukan look dari kurator dengan style dan sudut pandangnya sendiri." },
        "/products": { key:"products", title:"Products", deck:"Find your next piece. Explore produk berdasarkan kategori, warna, dan budget." },
        "/journal": { key:"journal", title:"Style Journal", deck:"A little styling insight. Ide warna, proporsi, dan mix & match untuk look berikutnya." }
      };
      if (entries[pathname]) return entries[pathname];
      const styleMatch = pathname.match(/^\/styles\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
      if (styleMatch) {
        const style = (getState().styleTags || []).map((item) => typeof item === "string" ? item : item?.name).find((name) => slugify(name) === styleMatch[1]);
        if (style) return { key:"style", styleName:style, title:`${style} Looks`, deck:`Explore look ${style} dari COMOOTD dan para kurator, lengkap dengan detail produk dan link ke toko.` };
      }
      return null;
    }

    function ensureLayer() {
      let layer = doc.getElementById("catalogueRouteLayer");
      if (!layer) {
        layer = doc.createElement("div");
        layer.id = "catalogueRouteLayer";
        layer.className = "catalogue-route-layer";
        doc.body.append(layer);
      }
      return layer;
    }

    function routeBar() {
      return `<header class="catalogue-route-bar"><a class="catalogue-route-brand" href="/" data-close-catalogue-route><img src="/assets/branding/comootd-wordmark-sisip-v1.png" width="2172" height="724" alt="COMOOTD" /></a><a class="catalogue-route-back" href="/" data-close-catalogue-route>← Back to home</a></header>`;
    }

    function lookCard(entry) {
      return `<article class="catalogue-look-card"><button class="catalogue-look-image" type="button" data-open-look="${esc(entry.id)}" aria-label="Buka ${esc(entry.title)}">${lookVisual(entry)}</button><div class="catalogue-look-copy"><p class="catalogue-look-attribution">${esc(lookAttribution(entry))} / ${esc(entry.gender)}</p><h2 class="catalogue-look-title">${esc(entry.title)}</h2>${curatorMetricsMarkup(entry,true)}<div>${entry.styles.slice(0,3).map((style) => `<span class="tag">${esc(style)}</span>`).join("")}<span class="tag">${entry.items.length} items</span></div><div class="catalogue-card-actions">${lookLikeButton(entry)}${saveButton?.("look",entry.id,true) || ""}</div></div></article>`;
    }

    function productCard(entry) {
      return `<article class="catalogue-product-card"><button type="button" data-open-product="${esc(entry.id)}">${productArt(entry,entry.variants?.[0])}</button><div><p>${esc(entry.badge || "COMOOTD EDIT")} · ${esc(marketplaceLabel(entry))}</p><h2>${esc(entry.name)}</h2><span>${money(entry.price)}</span>${saveButton?.("product",entry.id) || ""}</div></article>`;
    }

    function journalCard(entry) {
      return `<article class="catalogue-journal-card"><button type="button" data-open-article="${esc(entry.id)}">${entry.coverImage ? `<img ${window.COMOOTDImageOptimizer?.attributes(safeImage(entry.coverImage))||''} src="${esc(safeImage(entry.coverImage))}" alt="${esc(entry.coverAlt || entry.title)}" />` : ""}<span>${esc(articleCategoryLabel(entry.category))}</span><h2>${esc(entry.title)}</h2><p>${esc(entry.excerpt || "Catatan style dari COMOOTD.")}</p></button></article>`;
    }

    function filterMarkup(route) {
      const state = getState();
      if (route.key === "journal") return "";
      if (route.key === "products") return `<div class="catalogue-filter" data-directory-filters><label><span>Search</span><input type="search" data-directory-filter="q" value="${esc(filters.q)}" placeholder="Cari nama, warna, atau kategori" /></label><label><span>Gender</span><select data-directory-filter="gender"><option value="all">Semua gender</option><option value="Pria"${filters.gender === "Pria" ? " selected" : ""}>Pria</option><option value="Wanita"${filters.gender === "Wanita" ? " selected" : ""}>Wanita</option><option value="Uniseks"${filters.gender === "Uniseks" ? " selected" : ""}>Uniseks</option></select></label><label><span>Kategori</span><select data-directory-filter="category"><option value="all">Semua kategori</option>${Object.entries(productCategories).map(([value,label]) => `<option value="${value}"${filters.category === value ? " selected" : ""}>${label}</option>`).join("")}</select></label><label><span>Marketplace</span><select data-directory-filter="marketplace"><option value="all">Semua marketplace</option>${Object.entries(marketplaces).map(([value,item]) => `<option value="${value}"${filters.marketplace === value ? " selected" : ""}>${esc(item.label)}</option>`).join("")}</select></label><label><span>Harga</span><select data-directory-filter="price"><option value="all">Semua harga</option><option value="under100"${filters.price === "under100" ? " selected" : ""}>Di bawah Rp100 ribu</option><option value="100to250"${filters.price === "100to250" ? " selected" : ""}>Rp100–250 ribu</option><option value="250to500"${filters.price === "250to500" ? " selected" : ""}>Rp250–500 ribu</option><option value="over500"${filters.price === "over500" ? " selected" : ""}>Di atas Rp500 ribu</option></select></label></div>`;
      const styles = [...new Set([...(state.styleTags || []).map(item => typeof item === "string" ? item : item.name), ...state.looks.flatMap(item => item.styles || [])])].filter(Boolean).sort();
      return `<div class="catalogue-filter" data-directory-filters><label><span>Search</span><input type="search" data-directory-filter="q" value="${esc(filters.q)}" placeholder="Cari nama, style, warna, atau kurator" /></label><label><span>Gender</span><select data-directory-filter="gender"><option value="all">Semua gender</option><option value="Pria"${filters.gender === "Pria" ? " selected" : ""}>Pria</option><option value="Wanita"${filters.gender === "Wanita" ? " selected" : ""}>Wanita</option><option value="Uniseks"${filters.gender === "Uniseks" ? " selected" : ""}>Uniseks</option></select></label><label><span>Style</span><select data-directory-filter="style"><option value="all">Semua style</option>${styles.map((style) => `<option value="${esc(style)}"${filters.style === style ? " selected" : ""}>${esc(style)}</option>`).join("")}</select></label><label><span>Urutkan</span><select data-directory-filter="sort"><option value="popular"${filters.sort === "popular" ? " selected" : ""}>Paling populer</option><option value="newest"${filters.sort === "newest" ? " selected" : ""}>Terbaru</option><option value="az"${filters.sort === "az" ? " selected" : ""}>A–Z</option></select></label></div>`;
    }

    function filteredEntries(route) {
      syncFilters();
      const state = getState();
      let source = route.key === "products" ? [...state.products] : route.key === "journal" ? [...state.articles] : route.key === "comootd" ? state.looks.filter((item) => item.publisherType !== "curator" && !item.curator?.handle) : route.key === "curators" ? state.looks.filter((item) => item.publisherType === "curator" || item.curator?.handle) : [...state.looks];
      if (route.key === "style") source = source.filter((item) => (item.styles || []).some((style) => String(style).toLowerCase() === String(route.styleName).toLowerCase()));
      if (route.key === "journal") return source;
      const q = filters.q.trim().toLowerCase();
      if (q) source = source.filter((item) => [item.title,item.name,item.gender,item.genderTarget,item.badge,item.category,productCategories[item.category],item.curator?.displayName,item.curator?.handle,...(item.styles || []),...(item.variants || []).flatMap((variant) => [variant.name,variant.hex])].filter(Boolean).join(" ").toLowerCase().includes(q));
      if (filters.gender !== "all") source = source.filter((item) => (item.gender || ({ pria:"Pria", wanita:"Wanita", unisex:"Uniseks" }[item.genderTarget])) === filters.gender);
      if (route.key === "products" && filters.category !== "all") source = source.filter((item) => (item.category || "other") === filters.category);
      if (route.key === "products" && filters.marketplace !== "all") source = source.filter((item) => marketplaceOf(item) === filters.marketplace);
      if (route.key === "products" && filters.price !== "all") source = source.filter((item) => { const price = Number(item.price || 0); return filters.price === "under100" ? price < 100000 : filters.price === "100to250" ? price >= 100000 && price < 250000 : filters.price === "250to500" ? price >= 250000 && price < 500000 : price >= 500000; });
      if (route.key !== "products" && filters.style !== "all") source = source.filter((item) => (item.styles || []).includes(filters.style));
      if (filters.sort === "az") source.sort((a,b) => String(a.title || a.name).localeCompare(String(b.title || b.name),"id"));
      else if (filters.sort === "newest") source.sort((a,b) => String(b.publishedAt || b.createdAt || "").localeCompare(String(a.publishedAt || a.createdAt || "")));
      else source.sort((a,b) => Number(b.popularity || 0) - Number(a.popularity || 0));
      return source;
    }

    function setMetaContent(id, value) { const node = doc.getElementById(id); if (node) node.setAttribute("content", value); }
    function updateMetadata(route) {
      const canonical = new URL(pager.canonical());
      const title = `${route.title} — COMOOTD${pager.page()>1 ? ` · Page ${pager.page()}` : ""}`;
      doc.title = title;
      doc.getElementById("pageTitle")?.replaceChildren(title);
      doc.getElementById("canonicalUrl")?.setAttribute("href", canonical.href);
      setMetaContent("pageDescription", route.deck); setMetaContent("openGraphType", "website"); setMetaContent("openGraphTitle", title);
      setMetaContent("openGraphDescription", route.deck); setMetaContent("openGraphUrl", canonical.href); setMetaContent("twitterCard", "summary");
      setMetaContent("twitterTitle", title); setMetaContent("twitterDescription", route.deck);
      doc.getElementById("openGraphImage")?.remove(); doc.getElementById("twitterImage")?.remove();
    }

    let rendering = false;
    function render() {
      if(rendering) return Boolean(readRoute());
      rendering=true;
      try { return renderView(); } finally { rendering=false; }
    }
    function renderView() {
      const route = readRoute();
      const layer = ensureLayer();
      if (!route) { if (renderedPath) remember(); renderedPath = ""; layer.classList.remove("is-open"); layer.innerHTML = ""; doc.body.classList.remove("catalogue-route-open"); return false; }
      syncFilters();
      const nextPath = path() + browserWindow.location.search;
      const scroll = renderedPath === nextPath ? layer.scrollTop : suspendedPath === nextPath ? views.get(nextPath)?.scroll || 0 : 0;
      const focused = doc.activeElement;
      const focusedFilter = focused?.getAttribute?.("data-directory-filter");
      const caret = focusedFilter === "q" ? focused.selectionStart : null;
      const paginated = true;
      const requestKey = JSON.stringify([path(),pager.page(),filters]);
      let result = pages.get(requestKey);
      if(result) options.onPage?.(result.catalogue);
      if (paginated && options.loadPage && !result && loadingKey !== requestKey) {
        loadingKey = requestKey; pageError = "";
        options.loadPage(route.key,pager.page(),{ ...filters, ...(route.styleName ? {style:route.styleName} : {}) }).then(value => {
          pages.set(requestKey,value);
          if (pages.size>5) pages.delete(pages.keys().next().value);
          if (JSON.stringify([path(),pager.page(),pager.readFilters(defaults)])!==requestKey) return;
          options.onPage?.(value.catalogue);
          if (value.page!==pager.page()) browserWindow.history.replaceState(browserWindow.history.state,"",pager.url(value.page));
          render();
        }).catch(error => {
          if (JSON.stringify([path(),pager.page(),pager.readFilters(defaults)])!==requestKey) return;
          pageError = "Katalog belum berhasil dimuat. Coba lagi.";
          console.warn("Directory page failed",error); render();
        });
      }
      const all = paginated && options.loadPage ? [] : filteredEntries(route);
      if (!result) result = { total:all.length,page:Math.min(pager.page(),Math.max(1,Math.ceil(all.length/24))),pageSize:24,entries:all };
      const source = paginated ? options.loadPage ? result.entries : all.slice((result.page-1)*24,result.page*24) : all;
      const content = route.key === "products" ? source.map(productCard).join("") : route.key === "journal" ? source.map(journalCard).join("") : source.map(lookCard).join("");
      const className = route.key === "products" ? "catalogue-product-grid" : route.key === "journal" ? "catalogue-journal-grid" : "catalogue-look-grid";
      const tabs = route.key === "products" ? `<span class="is-active">Products</span>` : route.key === "journal" ? `<span class="is-active">Journal</span>` : `<a href="/looks" class="${route.key === "looks" ? "is-active" : ""}">All Looks</a><a href="/looks/comootd" class="${route.key === "comootd" ? "is-active" : ""}">By COMOOTD</a><a href="/looks/curators" class="${route.key === "curators" ? "is-active" : ""}">By Curators</a>${route.key === "style" ? `<span class="is-active">${esc(route.styleName)}</span>` : ""}`;
      layer.innerHTML = `<div class="catalogue-route-shell">${routeBar()}<main class="catalogue-route-body"><div class="catalogue-route-heading"><p>COMOOTD / DIRECTORY</p><h1>${esc(route.title)}</h1><p>${esc(route.deck)}</p></div><nav class="catalogue-route-tabs" aria-label="Pilihan katalog">${tabs}</nav>${filterMarkup(route)}${route.key !== "journal" ? `<p class="catalogue-result-count">${source.length} hasil</p>` : ""}<section class="${className}">${content || `<p class="catalogue-empty">Belum ada konten yang cocok dengan filter ini.</p>`}</section></main></div>`;
      layer.classList.add("is-open"); doc.body.classList.add("catalogue-route-open"); updateMetadata(route);
      layer.querySelectorAll(`.${className} img`).forEach((img,index)=>{img.loading=index<4?"eager":"lazy";img.decoding="async";});
      if (paginated) {
        const count = layer.querySelector(".catalogue-result-count");
        if (count) count.textContent = result.total ? `${(result.page-1)*result.pageSize+1}–${Math.min(result.page*result.pageSize,result.total)} dari ${result.total} hasil` : "0 hasil";
        layer.querySelector("main")?.insertAdjacentHTML("beforeend",pager.markup(result.page,result.total,result.pageSize));
        if (options.loadPage && !pages.has(requestKey)) {
          const grid = layer.querySelector(`.${className}`);
          grid.innerHTML = pageError ? '<div class="directory-error" role="alert">Katalog belum berhasil dimuat. <button type="button" data-page-retry>Coba lagi</button></div>' : '<p class="directory-loading" role="status">Memuat katalog…</p>';
          if (count) count.textContent = "";
          grid.querySelector("[data-page-retry]")?.addEventListener("click",()=>{loadingKey="";render();});
        }
      }
      renderedPath = nextPath;
      suspendedPath = "";
      layer.querySelectorAll("[data-directory-filters] label > span").forEach((label) => { if (label.textContent === "Search") label.textContent = "Cari"; if (label.textContent === "Style") label.textContent = "Gaya"; });
      const empty = layer.querySelector(".catalogue-empty");
      if (empty) {
        const activeFilters = Object.keys(defaults).some((key) => filters[key] !== defaults[key]);
        empty.textContent = activeFilters ? "Tidak ada hasil yang cocok. Coba kata lain atau reset filter." : "Konten sedang disiapkan. Kamu bisa memeriksa kembali nanti.";
      }
      if (route.key !== "journal") {
        const reset = doc.createElement("button");
        reset.type = "button"; reset.className = "button-outline catalogue-reset"; reset.textContent = "Reset filter";
        reset.disabled = !Object.keys(defaults).some((key) => filters[key] !== defaults[key]);
        reset.onclick = () => { Object.assign(filters, defaults); pager.writeFilters(filters,defaults); loadingKey=""; render(); layer.querySelector('[data-directory-filter="q"]')?.focus(); };
        layer.querySelector("[data-directory-filters]")?.after(reset);
      }
      if (focusedFilter) {
        const control = layer.querySelector(`[data-directory-filter="${focusedFilter}"]`);
        control?.focus({ preventScroll:true });
        if (caret !== null) control?.setSelectionRange(caret, caret);
      }
      layer.scrollTop = scroll;
      return true;
    }

    function setFilter(name, value) { syncFilters(); if (Object.prototype.hasOwnProperty.call(filters, name)) filters[name] = String(value || ""); pager.writeFilters(filters,defaults); }

    return { readRoute, ensureLayer, render, setFilter, filteredEntries, remember };
  }

  window.COMOOTDCatalogueDirectory = Object.freeze({ create });
})();
