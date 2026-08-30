(() => {
  "use strict";

  const SESSION_KEY = "comootd-analytics-session";
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

  function attribution() {
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

  function barsMarkup(rows, labelKey, valueKey) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return `<div class="insights-empty">Belum cukup data pada periode ini.</div>`;
    const max = Math.max(...list.map((row) => Number(row[valueKey] || 0)), 1);
    return `<div class="insights-bars">${list.map((row) => `<div class="insights-bar"><span>${escapeHtml(row[labelKey] || "Direct")}</span><span class="insights-bar-track"><i style="--bar:${Math.max(3, Math.round(Number(row[valueKey] || 0) / max * 100))}%"></i></span><strong>${number(row[valueKey])}</strong></div>`).join("")}</div>`;
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
      root.innerHTML = `<div class="insights-empty">Analytics aktif setelah staging terhubung ke Supabase.</div>`;
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
      root.innerHTML = `<div class="insights-dashboard"><div class="insights-toolbar"><label>Periode<select data-insights-days><option value="7"${days===7?" selected":""}>7 hari</option><option value="30"${days===30?" selected":""}>30 hari</option><option value="90"${days===90?" selected":""}>90 hari</option></select></label><button class="small-button muted" type="button" data-refresh-insights>Refresh</button></div><div class="insights-kpis">${kpis.map(([label,value]) => `<div class="insights-kpi"><strong>${number(value)}</strong><span>${escapeHtml(label)}</span></div>`).join("")}</div><div class="insights-grid"><section class="insights-card"><h4>${role === "admin" ? "Curator dengan traffic tertinggi" : "Look paling banyak dilihat"}</h4>${barsMarkup(primaryRows,primaryLabel,primaryValue)}</section><section class="insights-card"><h4>Sumber traffic</h4>${barsMarkup(analytics.sources,"source","events")}</section></div><section class="insights-card"><h4>Laporan tautan</h4>${reportsMarkup(reports)}</section></div>`;
      root.dataset.loaded = "true";
      root.dataset.days = String(days);
    } catch (error) {
      root.dataset.loaded = "true";
      root.innerHTML = `<div class="insights-empty">Analytics belum tersedia di environment ini. Terapkan migration Milestone 2 pada Supabase staging terlebih dahulu.<br><small>${escapeHtml(error?.message || "")}</small></div>`;
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
    if (affiliate) void track("product_click", affiliate.dataset.insightTarget, affiliate.dataset.insightId, `${Date.now()}:${affiliate.dataset.insightId}`);
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
  }, true);

  document.addEventListener("change", (event) => {
    const range = event.target.closest("[data-insights-days]");
    if (!range) return;
    const root=range.closest("[data-insights-dashboard]");
    root.dataset.days=range.value; root.dataset.loaded="false"; void hydrateDashboard(root,true);
  });

  document.addEventListener("submit", async (event) => {
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
