(() => {
  "use strict";

  function create({ element, duration = 3200, scheduler } = {}) {
    if (!element) throw new Error("Notification element is required.");
    const clock = scheduler || {
      setTimeout: window.setTimeout.bind(window),
      clearTimeout: window.clearTimeout.bind(window)
    };
    let timer = null;

    function clear() {
      if (timer !== null) clock.clearTimeout(timer);
      timer = null;
      element.classList.remove("show");
    }

    function show(message) {
      clear();
      element.textContent = String(message || "");
      element.classList.add("show");
      timer = clock.setTimeout(clear, duration);
    }

    return { show, clear };
  }

  window.COMOOTDNotification = Object.freeze({ create });
})();
