(() => {
  "use strict";

  function create({ menuButton, mobileNav } = {}) {
    if (!menuButton || !mobileNav) throw new Error("Navigation controls are required.");

    function setOpen(open) {
      mobileNav.classList.toggle("is-open", Boolean(open));
      menuButton.setAttribute("aria-expanded", String(Boolean(open)));
      menuButton.setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
      return Boolean(open);
    }

    function close() { return setOpen(false); }
    function toggle() { return setOpen(!mobileNav.classList.contains("is-open")); }
    function onMenuClick() { toggle(); }
    function onNavClick(event) { if (event.target.closest("a")) close(); }

    menuButton.addEventListener("click", onMenuClick);
    mobileNav.addEventListener("click", onNavClick);

    return {
      close,
      open: () => setOpen(true),
      toggle,
      destroy() {
        menuButton.removeEventListener("click", onMenuClick);
        mobileNav.removeEventListener("click", onNavClick);
      }
    };
  }

  function bindSearchShortcut({ button, target, input, delay = 500, scheduler } = {}) {
    if (!button || !target || !input) throw new Error("Search shortcut controls are required.");
    const clock = scheduler || window;
    const onClick = () => {
      target.scrollIntoView({ behavior:"smooth", block:"start" });
      clock.setTimeout(() => input.focus(), delay);
    };
    button.addEventListener("click", onClick);
    return () => button.removeEventListener("click", onClick);
  }

  window.COMOOTDNavigation = Object.freeze({ create, bindSearchShortcut });
})();
