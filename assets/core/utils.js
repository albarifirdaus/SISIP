(() => {
  "use strict";

  function slugify(value) {
    return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function esc(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function safeImage(value) {
    return /^(data:image\/(png|jpe?g|webp|gif);base64,|https?:\/\/)/i.test(String(value || "")) ? String(value) : "";
  }

  function imageAspect(value, fallback = "portrait") {
    const source = String(value || "").trim().toLowerCase();
    if (source === "square" || /(?:^|[\/_.-])square(?:[\/_.-]|$)/.test(source)) return "square";
    if (source === "portrait" || /(?:^|[\/_.-])portrait(?:[\/_.-]|$)/.test(source)) return "portrait";
    return fallback === "square" ? "square" : "portrait";
  }

  function imageFrameClass(value, fallback = "portrait") {
    return "image-frame--" + imageAspect(value, fallback);
  }

  function money(value) {
    return new Intl.NumberFormat("id-ID", { style:"currency", currency:"IDR", maximumFractionDigits:0 }).format(Number(value || 0));
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
  }

  window.COMOOTDCore = Object.freeze({ slugify, clone, esc, safeImage, imageAspect, imageFrameClass, money, uid });
})();
