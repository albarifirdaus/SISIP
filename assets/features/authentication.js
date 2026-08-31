(() => {
  "use strict";

  function create({ elements, onRenderResend = () => {} } = {}) {
    if (!elements) throw new Error("Authentication elements are required.");
    let mode = "signin";
    let pendingEmail = "";

    function render() {
      const signup = mode === "signup";
      elements.title.textContent = signup ? "Buat profil gayamu." : "Masuk untuk menemukan yang lebih pas.";
      elements.copy.textContent = signup ? "Daftar dengan email untuk menyimpan preferensi dan menerima kurasi yang lebih relevan." : "Simpan preferensi style, dapatkan urutan look yang lebih relevan, dan kirim request outfit ke COMOOTD Studio.";
      elements.displayNameField.hidden = !signup;
      elements.submit.innerHTML = signup ? `Buat akun <span aria-hidden="true">↗</span>` : `Masuk <span aria-hidden="true">↗</span>`;
      elements.switchButton.textContent = signup ? "Sudah punya akun? Masuk dengan email" : "Belum punya akun? Daftar dengan email";
      elements.displayNameInput.required = signup;
      elements.passwordInput.setAttribute("autocomplete", signup ? "new-password" : "current-password");
      elements.error.textContent = "";
      onRenderResend();
    }

    function setMode(value) { mode = value === "signup" ? "signup" : "signin"; render(); return mode; }
    function toggleMode() { pendingEmail = ""; return setMode(mode === "signin" ? "signup" : "signin"); }
    function setPendingEmail(value) { pendingEmail = String(value || "").trim(); return pendingEmail; }

    return {
      render, setMode, toggleMode, setPendingEmail,
      get mode() { return mode; },
      get pendingEmail() { return pendingEmail; }
    };
  }

  window.COMOOTDAuthentication = Object.freeze({ create });
})();
