(() => {
  "use strict";

  const SESSION_KEY = "comootd-analytics-session";
  const ATTRIBUTION_KEY = "comootd-analytics-attribution";
  const once = new Set();

  function sessionId() {
    try {
      let value = sessionStorage.getItem(SESSION_KEY);
      if (!value) {
        value = crypto.randomUUID();
        sessionStorage.setItem(SESSION_KEY, value);
      }
      return value;
    } catch {
      return crypto.randomUUID();
    }
  }

  function currentAttribution() {
    const params = new URLSearchParams(location.search);
    let referrerHost = "";
    try { referrerHost = document.referrer ? new URL(document.referrer).hostname : ""; } catch { /* empty */ }
    const utmSource = params.get("utm_source") || "";
    const source = utmSource || (referrerHost ? referrerHost.replace(/^www\./, "") : "direct");
    return {
      source,
      referrerHost,
      utmSource,
      utmMedium: params.get("utm_medium") || "",
      utmCampaign: params.get("utm_campaign") || ""
    };
  }

  function attribution() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY) || "null");
      if (saved && typeof saved === "object") return saved;
      const value = currentAttribution();
      sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(value));
      return value;
    } catch { return currentAttribution(); }
  }

  async function track(eventType, targetType = "site", targetId = null, dedupeKey = "") {
    const cloud = window.SISIPCloud;
    if (!cloud?.isConfigured?.() || typeof cloud.recordAnalyticsEvent !== "function") return false;
    const key = dedupeKey || `${eventType}:${targetType}:${targetId || "site"}`;
    if (once.has(key)) return false;
    once.add(key);
    try {
      return await cloud.recordAnalyticsEvent({ eventType, targetType, targetId, sessionId:sessionId(), ...attribution() });
    } catch {
      return false;
    }
  }

  function inspectProfile() {
    const profile = document.querySelector("[data-insight-curator-id]");
    const id = profile?.dataset.insightCuratorId;
    if (id) void track("curator_profile_view", "curator", id);
  }

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[char]);
  const number = (value) => new Intl.NumberFormat("id-ID").format(Number(value || 0));

  function barsMarkup(rows, labelKey, valueKey, secondaryKey = "", secondaryLabel = "") {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return `<div class="insights-empty">Belum cukup data pada periode ini.</div>`;
    const max = Math.max(...list.map((row) => Number(row[valueKey] || 0)), 1);
    return `<div class="insights-bars">${list.map((row) => `<div class="insights-bar"><span>${escapeHtml(row[labelKey] || "Direct")}${secondaryKey ? `<small>${number(row[secondaryKey])} ${escapeHtml(secondaryLabel)}</small>` : ""}</span><span class="insights-bar-track"><i style="--bar:${Math.max(3, Math.round(Number(row[valueKey] || 0) / max * 100))}%"></i></span><strong>${number(row[valueKey])}</strong></div>`).join("")}</div>`;
  }

  function trendMarkup(rows, role) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return `<div class="insights-empty">Belum ada tren harian pada periode ini.</div>`;
    const max = Math.max(...list.flatMap((row) => [Number(row.views || 0), Number(row.clicks || 0), Number(row.page_views || 0)]), 1);
    return `<div class="insights-trend" role="img" aria-label="Tren analytics harian">${list.map((row) => {
      const date = new Date(`${row.event_day}T00:00:00`);
      const label = Number.isNaN(date.getTime()) ? row.event_day : new Intl.DateTimeFormat("id-ID", { day:"2-digit", month:"short" }).format(date);
      const primary = role === "admin" ? Number(row.page_views || 0) : Number(row.views || 0);
      const clicks = Number(row.clicks || 0);
      return `<div class="insights-trend-day" title="${escapeHtml(label)} · ${number(primary)} view · ${number(clicks)} klik"><span><i style="--value:${Math.max(4,Math.round(primary/max*100))}%"></i><b style="--value:${Math.max(clicks ? 4 : 0,Math.round(clicks/max*100))}%"></b></span><small>${escapeHtml(label)}</small></div>`;
    }).join("")}</div><div class="insights-legend"><span><i></i>${role === "admin" ? "Page views" : "Look views"}</span><span><b></b>Product clicks</span></div>`;
  }

  function campaignBuilderMarkup() {
    return `<section class="insights-card insights-campaign-builder"><div><h4>Buat link campaign</h4><p class="microcopy">Tambahkan penanda traffic untuk Instagram, TikTok, WhatsApp, atau campaign lain. Link hanya dapat diarahkan ke halaman COMOOTD.</p></div><form data-campaign-builder><label>Halaman tujuan<input name="destination" type="url" value="${escapeHtml(`${location.origin}/looks/`)}" required /></label><div class="insights-campaign-fields"><label>Source<input name="source" value="instagram" maxlength="100" required /></label><label>Medium<input name="medium" value="social" maxlength="100" required /></label><label>Campaign<input name="campaign" placeholder="Contoh: clean_august" maxlength="120" required /></label></div><div class="insights-campaign-presets"><button type="button" data-campaign-source="instagram">Instagram</button><button type="button" data-campaign-source="tiktok">TikTok</button><button type="button" data-campaign-source="whatsapp">WhatsApp</button><button type="button" data-campaign-source="newsletter">Newsletter</button></div><div class="insights-campaign-output"><input data-campaign-output readonly aria-label="Link campaign" placeholder="Link tracking akan muncul di sini" /><button class="small-button" type="submit">Buat &amp; salin</button></div><p class="microcopy" data-campaign-status aria-live="polite"></p></form></section>`;
  }

  function buildCampaignUrl(form) {
    const data = new FormData(form);
    const url = new URL(String(data.get("destination") || "").trim(), location.origin);
    if (url.origin !== location.origin) throw new Error("Gunakan halaman tujuan di website COMOOTD.");
    for (const [key, field] of [["utm_source","source"],["utm_medium","medium"],["utm_campaign","campaign"]]) {
      const value = String(data.get(field) || "").trim().replace(/\s+/g, "_").toLowerCase();
      if (!value) throw new Error("Lengkapi source, medium, dan nama campaign.");
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  async function copyText(value) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
    const input = document.createElement("textarea");
    input.value = value; input.style.cssText = "position:fixed;left:-9999px;opacity:0"; document.body.append(input); input.select(); document.execCommand("copy"); input.remove();
  }

  function reportsMarkup(reports) {
    const open = (Array.isArray(reports) ? reports : []).filter((report) => report.status === "open");
    if (!open.length) return `<div class="insights-empty">Tidak ada laporan tautan yang perlu ditangani.</div>`;
    return `<div class="insights-report-list">${open.map((report) => `<article class="insights-report" data-report-row="${escapeHtml(report.id)}"><strong>${escapeHtml(report.reason.replaceAll("_", " "))}</strong><p class="microcopy">${escapeHtml(report.target_type)} · ${escapeHtml(report.target_id.slice(0, 8))}</p>${report.message ? `<p>${escapeHtml(report.message)}</p>` : ""}<input type="url" data-report-url placeholder="Link pengganti (untuk Update)" /><div class="insights-report-actions"><button type="button" data-link-action="updated" data-report-id="${escapeHtml(report.id)}">Update link</button><button type="button" data-link-action="disabled" data-report-id="${escapeHtml(report.id)}">Nonaktifkan</button><button type="button" data-link-action="resolved" data-report-id="${escapeHtml(report.id)}">Selesai</button><button type="button" data-link-action="dismissed" data-report-id="${escapeHtml(report.id)}">Abaikan</button></div></article>`).join("")}</div>`;
  }

  async function hydrateDashboard(root, force = false) {
    if (!root || (root.dataset.loaded === "true" && !force) || root.dataset.loading === "true") return;
    const cloud = window.SISIPCloud;
    const role = root.dataset.insightsDashboard;
    if (!cloud?.isConfigured?.()) {
      root.dataset.loaded = "true";
      root.innerHTML = `<div class="insights-empty">Analytics aktif setelah aplikasi terhubung ke Supabase.</div>`;
      return;
    }
    root.dataset.loading = "true";
    const days = Number(root.querySelector("[data-insights-days]")?.value || root.dataset.days || 30);
    try {
      const [analytics, reports] = await Promise.all([
        role === "admin" ? cloud.loadAdminAnalytics(days) : cloud.loadMyAnalytics(days),
        cloud.loadLinkReports()
      ]);
      const totals = analytics?.totals || {};
      const kpis = role === "admin"
        ? [["Page views",totals.pageViews],["Look views",totals.lookViews],["Product clicks",totals.productClicks],["Shares",totals.shares],["Unique sessions",totals.uniqueSessions]]
        : [["Look views",totals.lookViews],["Product clicks",totals.productClicks],["Shares",totals.shares],["Profile views",totals.profileViews],["Unique sessions",totals.uniqueSessions]];
      const primaryRows = role === "admin" ? analytics.topCurators : analytics.topLooks;
      const primaryLabel = role === "admin" ? "display_name" : "title";
      const primaryValue = role === "admin" ? "events" : "views";
      root.innerHTML = `<div class="insights-dashboard"><div class="insights-toolbar"><label>Periode<select data-insights-days><option value="7"${days===7?" selected":""}>7 hari</option><option value="30"${days===30?" selected":""}>30 hari</option><option value="90"${days===90?" selected":""}>90 hari</option></select></label><button class="small-button muted" type="button" data-refresh-insights>Refresh</button></div><div class="insights-kpis">${kpis.map(([label,value]) => `<div class="insights-kpi"><strong>${number(value)}</strong><span>${escapeHtml(label)}</span></div>`).join("")}</div><section class="insights-card"><h4>Tren harian</h4>${trendMarkup(analytics.daily,role)}</section><div class="insights-grid"><section class="insights-card"><h4>${role === "admin" ? "Curator dengan traffic tertinggi" : "Look paling banyak dilihat"}</h4>${barsMarkup(primaryRows,primaryLabel,primaryValue,"clicks","klik produk")}</section><section class="insights-card"><h4>Sumber traffic</h4>${barsMarkup(analytics.sources,"source","events")}</section></div><div class="insights-grid"><section class="insights-card"><h4>Campaign teratas</h4>${barsMarkup(analytics.campaigns,"campaign","events")}</section><section class="insights-card"><h4>Medium</h4>${barsMarkup(analytics.mediums,"medium","events")}</section></div>${campaignBuilderMarkup()}<section class="insights-card"><h4>Laporan tautan</h4>${reportsMarkup(reports)}</section></div>`;
      root.dataset.loaded = "true";
      root.dataset.days = String(days);
    } catch (error) {
      root.dataset.loaded = "true";
      root.innerHTML = `<div class="insights-empty">Analytics belum tersedia di environment ini. Pastikan migration Fase 4 sudah diterapkan.<br><small>${escapeHtml(error?.message || "")}</small></div>`;
    } finally { root.dataset.loading = "false"; }
  }

  function ensureReportDialog() {
    let dialog = document.getElementById("comootdLinkReportDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "comootdLinkReportDialog";
    dialog.className = "link-report-dialog";
    dialog.innerHTML = `<form class="link-report-form" data-link-report-form><h3>Laporkan tautan</h3><p class="microcopy">Laporan akan masuk ke curator pemilik atau admin COMOOTD.</p><label>Masalah<select name="reason"><option value="broken">Link tidak dapat dibuka</option><option value="wrong_product">Produk berbeda</option><option value="out_of_stock">Stok habis</option><option value="price_mismatch">Harga sangat berbeda</option><option value="unsafe">Terlihat tidak aman</option><option value="other">Lainnya</option></select></label><label>Catatan (opsional)<textarea name="message" maxlength="500" rows="4"></textarea></label><p data-report-status class="microcopy"></p><div class="link-report-actions"><button class="small-button muted" type="button" data-close-link-report>Batal</button><button class="small-button" type="submit">Kirim laporan</button></div></form>`;
    document.body.append(dialog);
    return dialog;
  }

  function injectReportButtons() {
    document.querySelectorAll(".look-item a[data-insight-target][data-insight-id],.product-detail a[data-insight-target][data-insight-id]").forEach((link) => {
      if (link.dataset.reportInjected || !link.dataset.insightId) return;
      link.dataset.reportInjected = "true";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "link-report-button";
      button.textContent = "Laporkan link";
      button.dataset.reportLink = "true";
      button.dataset.reportTarget = link.dataset.insightTarget;
      button.dataset.reportId = link.dataset.insightId;
      link.insertAdjacentElement("afterend", button);
    });
  }

  function hydrateDynamicUi() {
    inspectProfile();
    injectReportButtons();
    document.querySelectorAll("[data-insights-dashboard]").forEach((root) => {
      const adminPanel=root.closest(".studio-panel");
      if (adminPanel && !adminPanel.classList.contains("is-active")) return;
      void hydrateDashboard(root);
    });
  }

  document.addEventListener("click", async (event) => {
    const affiliate = event.target.closest("a[data-insight-target][data-insight-id]");
    if (affiliate) {
      const contextLook = affiliate.dataset.insightContextLook;
      void track("product_click", contextLook ? "look" : affiliate.dataset.insightTarget, contextLook || affiliate.dataset.insightId, `${Date.now()}:${contextLook || affiliate.dataset.insightId}`);
    }
    const lookShare = event.target.closest("[data-share-look],[data-share-curator-look]");
    if (lookShare) void track("look_share", "look", lookShare.dataset.shareLook || lookShare.dataset.shareCuratorLook, `${Date.now()}:share-look`);
    const productShare = event.target.closest("[data-share-product]");
    if (productShare) void track("product_share", "product", productShare.dataset.shareProduct, `${Date.now()}:share-product`);
    const reportButton = event.target.closest("[data-report-link]");
    if (reportButton) {
      const dialog = ensureReportDialog();
      dialog.dataset.targetType = reportButton.dataset.reportTarget;
      dialog.dataset.targetId = reportButton.dataset.reportId;
      dialog.querySelector("[data-report-status]").textContent = "";
      dialog.showModal();
    }
    if (event.target.closest("[data-close-link-report]")) ensureReportDialog().close();
    const refresh = event.target.closest("[data-refresh-insights]");
    if (refresh) { const root=refresh.closest("[data-insights-dashboard]"); if(root){root.dataset.loaded="false";void hydrateDashboard(root,true);} }
    const action = event.target.closest("[data-link-action]");
    if (action) {
      const root=action.closest("[data-insights-dashboard]");
      const row=action.closest("[data-report-row]");
      const replacement=row?.querySelector("[data-report-url]")?.value || "";
      action.disabled=true;
      try { await window.SISIPCloud.resolveLinkReport(action.dataset.reportId,action.dataset.linkAction,replacement); root.dataset.loaded="false"; await hydrateDashboard(root,true); }
      catch(error){ action.disabled=false; window.alert(error?.message || "Laporan belum dapat diperbarui."); }
    }
    const insightsTab=event.target.closest('[data-studio-tab="insights"],[data-curator-studio-tab="analytics"]');
    if(insightsTab) setTimeout(()=>document.querySelectorAll("[data-insights-dashboard]").forEach((root)=>void hydrateDashboard(root,true)),0);
    const sourcePreset=event.target.closest("[data-campaign-source]");
    if(sourcePreset){const form=sourcePreset.closest("[data-campaign-builder]");if(form){form.elements.source.value=sourcePreset.dataset.campaignSource;form.elements.medium.value=sourcePreset.dataset.campaignSource==="newsletter"?"email":sourcePreset.dataset.campaignSource==="whatsapp"?"messaging":"social";}}
  }, true);

  document.addEventListener("change", (event) => {
    const range = event.target.closest("[data-insights-days]");
    if (!range) return;
    const root=range.closest("[data-insights-dashboard]");
    root.dataset.days=range.value; root.dataset.loaded="false"; void hydrateDashboard(root,true);
  });

  document.addEventListener("submit", async (event) => {
    const campaignForm=event.target.closest("[data-campaign-builder]");
    if(campaignForm){
      event.preventDefault(); const output=campaignForm.querySelector("[data-campaign-output]"); const status=campaignForm.querySelector("[data-campaign-status]");
      try{const value=buildCampaignUrl(campaignForm);output.value=value;await copyText(value);status.textContent="Link campaign dibuat dan disalin.";}
      catch(error){status.textContent=error?.message||"Link campaign belum dapat dibuat.";}
      return;
    }
    const form=event.target.closest("[data-link-report-form]");
    if(!form)return;
    event.preventDefault();
    const dialog=ensureReportDialog(); const status=form.querySelector("[data-report-status]"); const submit=form.querySelector("button[type=submit]");
    submit.disabled=true; status.textContent="Mengirim laporan…";
    try { await window.SISIPCloud.reportLink(dialog.dataset.targetType,dialog.dataset.targetId,new FormData(form).get("reason"),new FormData(form).get("message")); status.textContent="Laporan terkirim. Terima kasih."; form.reset(); setTimeout(()=>dialog.close(),700); }
    catch(error){ status.textContent=error?.message || "Masuk terlebih dahulu untuk mengirim laporan."; }
    finally { submit.disabled=false; }
  });

  window.COMOOTDInsights = { track };
  void track("page_view", "site", null, `page:${location.pathname}:${location.search}`);
  hydrateDynamicUi();
  new MutationObserver(hydrateDynamicUi).observe(document.documentElement, { childList:true, subtree:true });
})();
