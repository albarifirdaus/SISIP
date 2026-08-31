(() => {
  "use strict";

  function renderStyleControls({ styles, select, chips, activeStyle = "all", escapeHtml } = {}) {
    if (!select || !chips) throw new Error("Style filter controls are required.");
    const esc = escapeHtml || ((value) => String(value));
    const entries = Array.isArray(styles) ? styles : [];
    const previous = select.value;
    select.innerHTML = `<option value="all">Semua style</option>${entries.map((style) => `<option value="${esc(style)}">${esc(style)}</option>`).join("")}`;
    select.value = entries.includes(previous) ? previous : "all";
    chips.innerHTML = [
      `<button class="filter-chip ${activeStyle === "all" ? "is-active" : ""}" type="button" data-style="all">Semua</button>`,
      ...entries.map((style) => `<button class="filter-chip ${activeStyle === style ? "is-active" : ""}" type="button" data-style="${esc(style)}">${esc(style)}</button>`)
    ].join("");
  }

  window.COMOOTDFilters = Object.freeze({ renderStyleControls });
})();
