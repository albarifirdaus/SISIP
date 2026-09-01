(() => {
  "use strict";

  const STORAGE_KEY = "comootd-privacy-choice-v1";
  const PRIVACY_VERSION = "2026-09-01";
  const TERMS_VERSION = "2026-09-01";
  const defaultChoice = () => ({ decided:false, analyticsEnabled:false, activityPersonalizationEnabled:false });
  let choice = readLocal();
  let remote = null;
  let signedIn = false;
  let busy = false;
  let feedback = "";

  function readLocal() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return defaultChoice();
      return {
        decided:Boolean(saved.decided),
        analyticsEnabled:Boolean(saved.analyticsEnabled),
        activityPersonalizationEnabled:Boolean(saved.activityPersonalizationEnabled)
      };
    } catch { return defaultChoice(); }
  }

  function persist(next) {
    feedback = "";
    choice = { ...defaultChoice(), ...next, decided:true };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(choice)); } catch { /* browser storage can be unavailable */ }
    renderBanner();
    document.querySelectorAll("[data-privacy-center]").forEach(renderPanel);
    window.dispatchEvent(new CustomEvent("comootd:privacy-change", { detail:snapshot() }));
  }

  function snapshot() {
    return { ...choice, signedIn, privacyVersion:PRIVACY_VERSION, termsVersion:TERMS_VERSION, remoteSaved:Boolean(remote) };
  }

  function allowsAnalytics() { return choice.decided && choice.analyticsEnabled; }
  function allowsActivityPersonalization() { return choice.decided && choice.activityPersonalizationEnabled; }

  function renderBanner() {
    let banner = document.getElementById("comootdPrivacyBanner");
    if (choice.decided) { banner?.remove(); return; }
    if (!banner) {
      banner = document.createElement("aside");
      banner.id = "comootdPrivacyBanner";
      banner.className = "privacy-banner";
      banner.setAttribute("aria-label", "Pilihan privasi COMOOTD");
      document.body.append(banner);
    }
    banner.innerHTML = `<div><p class="eyebrow">COMOOTD / PRIVACY</p><h2>Kamu yang menentukan data opsional.</h2><p>Fungsi dasar tetap berjalan. Analytics anonim dan riwayat aktivitas hanya aktif jika kamu izinkan.</p><a href="/privacy">Pelajari kebijakan privasi ↗</a></div><div class="privacy-banner-actions"><button class="small-button muted" type="button" data-privacy-essential>Hanya esensial</button><button class="small-button" type="button" data-privacy-allow>Izinkan opsional</button></div>`;
  }

  function renderPanel(root) {
    if (!root) return;
    root.dataset.privacyCenter = "true";
    const acceptedPrivacy = remote?.privacyAcknowledgedAt || "";
    const acceptedTerms = remote?.termsAcceptedAt || "";
    root.innerHTML = `<div class="privacy-center-head"><div><p class="eyebrow">PRIVACY CENTER</p><h3>Data kamu, kendali kamu.</h3></div><a href="/privacy">Baca kebijakan ↗</a></div>
      <p class="privacy-center-copy">Atur pemrosesan opsional, unduh salinan data akun, atau kelola penghapusan akun.</p>
      <form class="privacy-choice-form" data-privacy-choice-form>
        <label class="privacy-choice"><span><strong>Analytics minim data</strong><small>Membantu mengukur kunjungan dan klik tanpa menyimpan IP atau user-agent.</small></span><input type="checkbox" name="analytics"${choice.analyticsEnabled ? " checked" : ""}></label>
        <label class="privacy-choice"><span><strong>Riwayat untuk rekomendasi</strong><small>Menggunakan item tersimpan dan baru dilihat untuk menyusun feed. Preferensi style yang kamu isi tetap dapat dipakai.</small></span><input type="checkbox" name="personalization"${choice.activityPersonalizationEnabled ? " checked" : ""}></label>
        <label class="privacy-policy-check"><input type="checkbox" name="privacyAccepted"${acceptedPrivacy ? " checked" : ""}> <span>Saya sudah membaca <a href="/privacy">Kebijakan Privasi</a>.</span></label>
        <label class="privacy-policy-check"><input type="checkbox" name="termsAccepted"${acceptedTerms ? " checked" : ""}> <span>Saya menyetujui <a href="/terms">Ketentuan Penggunaan</a>.</span></label>
        <p class="privacy-status" data-privacy-status aria-live="polite">${feedback || (remote ? `Pilihan akun tersimpan · versi ${PRIVACY_VERSION}` : signedIn ? "Simpan pilihan agar berlaku di semua perangkat." : "Masuk untuk menyimpan pilihan di akun.")}</p>
        <button class="small-button" type="submit"${busy ? " disabled" : ""}>${busy ? "Menyimpan…" : "Simpan pilihan"}</button>
      </form>
      <div class="privacy-data-actions"><article><h4>Unduh data akun</h4><p>Ekspor profil, preferensi, koleksi, like, request, dan aktivitas akun dalam format JSON.</p><button class="small-button muted" type="button" data-privacy-export${!signedIn || busy ? " disabled" : ""}>Unduh data</button></article><article class="privacy-danger"><h4>Hapus akun</h4><p>Member biasa dapat menghapus akun secara permanen. Akun Curator/Admin diproses manual untuk melindungi konten publik.</p><button class="small-button danger" type="button" data-privacy-open-delete${!signedIn || busy ? " disabled" : ""}>Kelola penghapusan</button></article></div>
      <div class="privacy-delete-confirm" data-privacy-delete-confirm hidden><p><strong>Tindakan permanen.</strong> Data akun member akan dihapus dan tidak dapat dipulihkan.</p><label>Ketik <b>HAPUS AKUN</b><input type="text" autocomplete="off" data-privacy-delete-input></label><div><button class="small-button muted" type="button" data-privacy-cancel-delete>Batal</button><button class="small-button danger" type="button" data-privacy-delete disabled>Hapus permanen</button></div><p class="privacy-status" data-privacy-delete-status aria-live="polite"></p></div>`;
  }

  async function hydrate(isSignedIn = false) {
    signedIn = Boolean(isSignedIn);
    remote = null;
    const cloud = window.SISIPCloud;
    if (signedIn && typeof cloud?.getPrivacyPreferences === "function") {
      try {
        remote = await cloud.getPrivacyPreferences();
        if (remote) persist({
          analyticsEnabled:Boolean(remote.analyticsEnabled),
          activityPersonalizationEnabled:Boolean(remote.activityPersonalizationEnabled)
        });
      } catch (error) { console.warn("COMOOTD privacy preferences could not be loaded", error); }
    }
    document.querySelectorAll("[data-privacy-center]").forEach(renderPanel);
    return snapshot();
  }

  async function saveForm(form) {
    if (busy) return;
    const status = form.querySelector("[data-privacy-status]");
    const analyticsEnabled = form.elements.analytics.checked;
    const activityPersonalizationEnabled = form.elements.personalization.checked;
    if (!form.elements.privacyAccepted.checked || !form.elements.termsAccepted.checked) {
      feedback = "Baca dan centang Kebijakan Privasi serta Ketentuan Penggunaan terlebih dahulu.";
      status.textContent = feedback;
      return;
    }
    feedback = ""; busy = true; renderPanel(form.closest("[data-privacy-center]"));
    try {
      if (signedIn) {
        remote = await window.SISIPCloud.savePrivacyPreferences({ analyticsEnabled, activityPersonalizationEnabled, privacyVersion:PRIVACY_VERSION, termsVersion:TERMS_VERSION });
      }
      persist({ analyticsEnabled, activityPersonalizationEnabled });
    } catch (error) {
      feedback = error?.message || "Pilihan privasi belum dapat disimpan.";
    } finally { busy = false; document.querySelectorAll("[data-privacy-center]").forEach(renderPanel); }
  }

  function downloadJson(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `comootd-data-${new Date().toISOString().slice(0,10)}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-privacy-choice-form]");
    if (!form) return;
    event.preventDefault(); void saveForm(form);
  });

  document.addEventListener("input", (event) => {
    const input = event.target.closest("[data-privacy-delete-input]");
    if (!input) return;
    const button = input.closest("[data-privacy-delete-confirm]")?.querySelector("[data-privacy-delete]");
    if (button) button.disabled = input.value.trim().toUpperCase() !== "HAPUS AKUN";
  });

  document.addEventListener("click", async (event) => {
    if (event.target.closest("[data-privacy-essential]")) persist({ analyticsEnabled:false, activityPersonalizationEnabled:false });
    if (event.target.closest("[data-privacy-allow]")) persist({ analyticsEnabled:true, activityPersonalizationEnabled:true });
    const open = event.target.closest("[data-privacy-open-delete]");
    if (open) open.closest("[data-privacy-center]").querySelector("[data-privacy-delete-confirm]").hidden = false;
    const cancel = event.target.closest("[data-privacy-cancel-delete]");
    if (cancel) cancel.closest("[data-privacy-delete-confirm]").hidden = true;
    const exportButton = event.target.closest("[data-privacy-export]");
    if (exportButton && !busy) {
      busy = true; exportButton.disabled = true; exportButton.textContent = "Menyiapkan…";
      try { downloadJson(await window.SISIPCloud.exportMyData()); }
      catch (error) { window.alert(error?.message || "Data belum dapat diunduh."); }
      finally { busy = false; document.querySelectorAll("[data-privacy-center]").forEach(renderPanel); }
    }
    const deleteButton = event.target.closest("[data-privacy-delete]");
    if (deleteButton && !busy) {
      const area = deleteButton.closest("[data-privacy-delete-confirm]");
      const status = area.querySelector("[data-privacy-delete-status]");
      busy = true; deleteButton.disabled = true; status.textContent = "Menghapus akun…";
      try {
        await window.SISIPCloud.deleteMyAccount(area.querySelector("[data-privacy-delete-input]").value);
        try { await window.SISIPCloud.signOut(); } catch { /* deleted session may already be invalid */ }
        localStorage.removeItem(STORAGE_KEY);
        location.assign("/?account=deleted");
      } catch (error) { status.textContent = error?.message || "Akun belum dapat dihapus."; busy = false; }
    }
  });

  window.COMOOTDPrivacy = { hydrate, renderPanel, snapshot, allowsAnalytics, allowsActivityPersonalization };
  renderBanner();
})();
