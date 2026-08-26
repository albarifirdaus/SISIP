(function () {
  "use strict";

  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  var MAX_FILE_BYTES = 5 * 1024 * 1024;
  var OUTPUT_WIDTH = 1200;
  var PRESETS = {
    portrait: {
      width: 1200,
      height: 1600,
      ratio: 3 / 4,
      cssRatio: "3 / 4",
      label: "Portrait 3:4"
    },
    square: {
      width: 1200,
      height: 1200,
      ratio: 1,
      cssRatio: "1 / 1",
      label: "Square 1:1"
    }
  };
  var states = new WeakMap();
  var activeSession = null;
  var statusCounter = 0;
  var styleId = "comootd-image-cropper-styles";

  function normalizeAspect(value, fallback) {
    var normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
    if (normalized === "square" || normalized === "1:1" || normalized === "1x1") {
      return "square";
    }
    if (
      normalized === "portrait" ||
      normalized === "3:4" ||
      normalized === "3x4" ||
      normalized === "vertical"
    ) {
      return "portrait";
    }
    return fallback === "square" ? "square" : "portrait";
  }

  function lockedAspectFor(options, fallback) {
    if (typeof options.lockedAspect === "string") {
      return normalizeAspect(options.lockedAspect, fallback);
    }
    return options.lockedAspect === true ? fallback : null;
  }

  function resolveElement(value) {
    if (!value) {
      return null;
    }
    if (typeof value === "string") {
      try {
        return document.querySelector(value);
      } catch (_error) {
        return null;
      }
    }
    return value.nodeType === 1 ? value : null;
  }

  function callSafely(callback, payload) {
    if (typeof callback !== "function") {
      return;
    }
    try {
      callback(payload);
    } catch (_error) {
      // Consumer callbacks must never interrupt the crop flow.
    }
  }

  function dispatch(input, name, detail) {
    try {
      input.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: detail }));
    } catch (_error) {
      // CustomEvent is available in supported browsers. This fallback is only
      // for older embedded webviews.
      var event = document.createEvent("Event");
      event.initEvent(name, true, false);
      event.detail = detail;
      input.dispatchEvent(event);
    }
  }

  function ensureStyles() {
    if (document.getElementById(styleId)) {
      return;
    }

    var style = document.createElement("style");
    style.id = styleId;
    style.textContent = [
      ".comootd-image-cropper-meta{display:inline-flex;align-items:center;gap:9px;margin-top:8px;color:#756e67;font:500 12px/1.35 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}",
      ".comootd-image-cropper-meta[hidden]{display:none!important;}",
      ".comootd-image-cropper-meta[data-state='error']{color:#a5402a;}",
      ".comootd-image-cropper-preview{display:block;width:36px;height:42px;object-fit:cover;background:#e7e1da;border:1px solid rgba(28,25,23,.13);}",
      ".ci-cropper-overlay{position:fixed;z-index:2147483000;inset:0;display:grid;place-items:center;padding:12px;background:rgba(20,18,16,.68);}",
      ".ci-cropper-dialog{box-sizing:border-box;width:min(100%,470px);max-height:calc(100dvh - 24px);overflow:auto;padding:20px;background:#f7f4ef;color:#1d1b19;box-shadow:0 18px 56px rgba(0,0,0,.38);font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}",
      ".ci-cropper-header{margin-bottom:15px;}",
      ".ci-cropper-title{margin:0;color:#1d1b19;font-size:18px;line-height:1.2;font-weight:760;letter-spacing:-.025em;}",
      ".ci-cropper-copy{margin:6px 0 0;color:#6e6760;font-size:13px;line-height:1.45;}",
      ".ci-cropper-stage{position:relative;isolation:isolate;width:min(100%,350px);margin:0 auto;background:#e7e1da;overflow:hidden;touch-action:none;user-select:none;cursor:grab;}",
      ".ci-cropper-stage.is-dragging{cursor:grabbing;}",
      ".ci-cropper-canvas{display:block;width:100%;height:100%;outline:none;}",
      ".ci-cropper-canvas:focus-visible{outline:2px solid #9c4e37;outline-offset:-4px;}",
      ".ci-cropper-loading{position:absolute;inset:0;display:grid;place-items:center;background:rgba(247,244,239,.82);color:#625c56;font-size:13px;pointer-events:none;}",
      ".ci-cropper-hint{margin:9px 0 0;color:#6e6760;font-size:12px;line-height:1.4;text-align:center;}",
      ".ci-cropper-aspects{display:flex;gap:8px;margin-top:16px;}",
      ".ci-cropper-aspect{flex:1;min-height:39px;padding:8px 10px;border:1px solid rgba(29,27,25,.18);border-radius:0;background:transparent;color:#39342f;font:650 12px/1.15 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;cursor:pointer;}",
      ".ci-cropper-aspect[aria-pressed='true']{border-color:#1d1b19;background:#1d1b19;color:#fff;}",
      ".ci-cropper-controls{display:grid;gap:7px;margin-top:17px;}",
      ".ci-cropper-control-label{display:flex;justify-content:space-between;gap:12px;color:#4a443e;font-size:12px;font-weight:650;}",
      ".ci-cropper-range{width:100%;accent-color:#1d1b19;}",
      ".ci-cropper-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:20px;}",
      ".ci-cropper-button{min-height:42px;padding:0 15px;border:1px solid #1d1b19;border-radius:0;background:transparent;color:#1d1b19;font:700 12px/1 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;cursor:pointer;}",
      ".ci-cropper-button:hover{background:#ece7e0;}",
      ".ci-cropper-button-primary{background:#1d1b19;color:#fff;}",
      ".ci-cropper-button-primary:hover{background:#39332f;}",
      ".ci-cropper-button:disabled{opacity:.62;cursor:wait;}",
      "@media (max-width:460px){.ci-cropper-overlay{padding:8px}.ci-cropper-dialog{max-height:calc(100dvh - 16px);padding:16px}.ci-cropper-actions{position:sticky;bottom:-16px;padding:14px 0 1px;background:#f7f4ef}.ci-cropper-button{flex:1;padding:0 10px;}}"
    ].join("");
    document.head.appendChild(style);
  }

  function element(tagName, className, text) {
    var node = document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    if (typeof text === "string") {
      node.textContent = text;
    }
    return node;
  }

  function addDescribedBy(input, id) {
    var existing = (input.getAttribute("aria-describedby") || "").trim().split(/\s+/).filter(Boolean);
    if (existing.indexOf(id) === -1) {
      existing.push(id);
      input.setAttribute("aria-describedby", existing.join(" "));
    }
  }

  function createMeta(input, options) {
    var meta = element("div", "comootd-image-cropper-meta");
    meta.hidden = true;

    var preview = element("img", "comootd-image-cropper-preview");
    preview.alt = "";
    preview.hidden = true;

    var status = element("span", "comootd-image-cropper-status");
    status.id = "comootd-image-cropper-status-" + String(++statusCounter);
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    meta.appendChild(preview);
    meta.appendChild(status);
    input.insertAdjacentElement("afterend", meta);
    addDescribedBy(input, status.id);

    return {
      meta: meta,
      preview: preview,
      status: status,
      externalStatus: resolveElement(options.statusElement || options.statusTarget)
    };
  }

  function releasePreview(state) {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
      state.previewUrl = null;
    }
    state.preview.removeAttribute("src");
    state.preview.hidden = true;
  }

  function setStatus(state, message, kind) {
    state.meta.hidden = false;
    state.meta.dataset.state = kind || "info";
    state.status.textContent = message || "";
    if (state.externalStatus) {
      state.externalStatus.textContent = message || "";
      state.externalStatus.dataset.state = kind || "info";
    }
  }

  function hideMeta(state) {
    state.meta.hidden = true;
    state.status.textContent = "";
    delete state.meta.dataset.state;
    if (state.externalStatus) {
      state.externalStatus.textContent = "";
      delete state.externalStatus.dataset.state;
    }
  }

  function displayPreparedPreview(state) {
    releasePreview(state);
    if (!state.preparedFile) {
      return;
    }
    state.previewUrl = URL.createObjectURL(state.preparedFile);
    state.preview.src = state.previewUrl;
    state.preview.style.aspectRatio = PRESETS[state.aspect].cssRatio;
    state.preview.hidden = false;
  }

  function validateFile(file) {
    if (!file) {
      return "Pilih satu file gambar terlebih dahulu.";
    }
    if (file.size > MAX_FILE_BYTES) {
      return "Ukuran gambar maksimal 5 MB.";
    }

    var type = String(file.type || "").toLowerCase();
    var name = String(file.name || "").toLowerCase();
    var allowedType = type === "image/jpeg" || type === "image/jpg" || type === "image/png" || type === "image/webp";
    var allowedExtension = /\.(jpe?g|png|webp)$/.test(name);
    if (!allowedType && !allowedExtension) {
      return "Gunakan gambar JPG, PNG, atau WebP.";
    }
    return "";
  }

  function outputFileName(file, aspect) {
    var base = String(file && file.name ? file.name : "image").replace(/\.[^/.]+$/, "");
    base = base.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "image";
    return aspect + "-" + base + ".webp";
  }

  function updateAspectControl(state) {
    var select = state.aspectSelect;
    if (!select) {
      return;
    }
    var options = select.options || [];
    for (var index = 0; index < options.length; index += 1) {
      if (normalizeAspect(options[index].value, state.aspect) === state.aspect) {
        select.value = options[index].value;
        return;
      }
    }
    select.value = state.aspect;
  }

  function notify(state, type, detail) {
    var payload = Object.assign(
      {
        input: state.input,
        file: state.preparedFile,
        aspect: state.aspect
      },
      detail || {}
    );
    dispatch(state.input, "comootd:image-" + type, payload);

    if (type === "ready") {
      callSafely(state.options.onReady, payload);
    } else if (type === "clear") {
      callSafely(state.options.onClear, payload);
    } else if (type === "error") {
      callSafely(state.options.onError, payload);
    }
  }

  function resetState(state, options) {
    var settings = options || {};
    releasePreview(state);
    state.rawFile = null;
    state.preparedFile = null;
    if (settings.clearInput !== false) {
      state.input.value = "";
    }
    if (settings.message) {
      setStatus(state, settings.message, settings.kind || "info");
    } else {
      hideMeta(state);
    }
  }

  function makeState(input, options) {
    var settings = options || {};
    var defaultAspect = normalizeAspect(settings.defaultAspect, "portrait");
    var state = {
      input: input,
      options: settings,
      aspectSelect: resolveElement(settings.aspectSelect),
      lockedAspect: lockedAspectFor(settings, defaultAspect),
      aspect: null,
      rawFile: null,
      preparedFile: null,
      previewUrl: null,
      onInputChange: null,
      onAspectChange: null
    };

    state.aspect = state.lockedAspect || defaultAspect;
    var meta = createMeta(input, settings);
    state.meta = meta.meta;
    state.preview = meta.preview;
    state.status = meta.status;
    state.externalStatus = meta.externalStatus;

    if (!input.getAttribute("accept")) {
      input.setAttribute("accept", "image/jpeg,image/png,image/webp");
    }
    updateAspectControl(state);

    state.onInputChange = function () {
      var file = input.files && input.files[0];
      if (!file) {
        resetState(state);
        return;
      }

      var error = validateFile(file);
      if (error) {
        resetState(state, {
          clearInput: true,
          message: error,
          kind: "error"
        });
        notify(state, "error", { message: error });
        return;
      }

      if (activeSession && activeSession.state === state) {
        cancelSession(activeSession, "", false);
      }
      releasePreview(state);
      state.rawFile = file;
      state.preparedFile = null;
      setStatus(state, "Atur crop foto, lalu pilih Gunakan foto.", "pending");
      openSession(state, file);
    };
    input.addEventListener("change", state.onInputChange);

    if (state.aspectSelect) {
      state.onAspectChange = function () {
        if (state.lockedAspect) {
          updateAspectControl(state);
          return;
        }
        var next = normalizeAspect(state.aspectSelect.value, state.aspect);
        if (next === state.aspect) {
          return;
        }
        state.aspect = next;
        if (activeSession && activeSession.state === state) {
          setSessionAspect(activeSession, next);
          return;
        }
        if (state.rawFile) {
          releasePreview(state);
          state.preparedFile = null;
          setStatus(state, "Rasio diubah. Atur crop foto kembali.", "pending");
          openSession(state, state.rawFile);
        }
      };
      state.aspectSelect.addEventListener("change", state.onAspectChange);
    }

    return state;
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var image = new Image();
      image.onload = function () {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Image could not be decoded."));
      };
      image.src = url;
    });
  }

  function createDialog(session) {
    var label = String(session.state.options.label || "foto");
    var overlay = element("div", "ci-cropper-overlay");
    var dialog = element("section", "ci-cropper-dialog");
    var titleId = "ci-cropper-title-" + String(Date.now()) + "-" + String(Math.round(Math.random() * 100000));

    overlay.setAttribute("role", "presentation");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", titleId);
    dialog.tabIndex = -1;

    var header = element("header", "ci-cropper-header");
    var title = element("h2", "ci-cropper-title", "Atur crop " + label);
    title.id = titleId;
    var copy = element("p", "ci-cropper-copy", "Geser foto untuk menentukan fokus. Gunakan slider untuk memperbesar.");
    header.appendChild(title);
    header.appendChild(copy);

    var stage = element("div", "ci-cropper-stage");
    stage.style.aspectRatio = PRESETS[session.aspect].cssRatio;
    var canvas = element("canvas", "ci-cropper-canvas");
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Area crop. Geser foto atau gunakan tombol panah untuk memindahkan fokus.");
    var loading = element("div", "ci-cropper-loading", "Menyiapkan foto...");
    stage.appendChild(canvas);
    stage.appendChild(loading);

    var hint = element("p", "ci-cropper-hint", "Tip: gunakan tombol panah saat area foto sedang dipilih.");

    var aspectGroup = element("div", "ci-cropper-aspects");
    aspectGroup.setAttribute("aria-label", "Pilih rasio foto");
    var portraitButton = element("button", "ci-cropper-aspect", PRESETS.portrait.label);
    var squareButton = element("button", "ci-cropper-aspect", PRESETS.square.label);
    portraitButton.type = "button";
    squareButton.type = "button";
    portraitButton.dataset.aspect = "portrait";
    squareButton.dataset.aspect = "square";
    aspectGroup.appendChild(portraitButton);
    aspectGroup.appendChild(squareButton);
    if (session.state.lockedAspect) {
      aspectGroup.hidden = true;
    }

    var controls = element("div", "ci-cropper-controls");
    var rangeLabel = element("label", "ci-cropper-control-label");
    var rangeText = element("span", "", "Zoom");
    var rangeValue = element("span", "", "100%");
    var zoom = element("input", "ci-cropper-range");
    zoom.type = "range";
    zoom.min = "1";
    zoom.max = "4";
    zoom.step = "0.01";
    zoom.value = "1";
    zoom.setAttribute("aria-label", "Zoom foto");
    rangeLabel.appendChild(rangeText);
    rangeLabel.appendChild(rangeValue);
    controls.appendChild(rangeLabel);
    controls.appendChild(zoom);

    var actions = element("footer", "ci-cropper-actions");
    var cancel = element("button", "ci-cropper-button", "Batal");
    var use = element("button", "ci-cropper-button ci-cropper-button-primary", "Gunakan foto");
    cancel.type = "button";
    use.type = "button";
    actions.appendChild(cancel);
    actions.appendChild(use);

    dialog.appendChild(header);
    dialog.appendChild(stage);
    dialog.appendChild(hint);
    dialog.appendChild(aspectGroup);
    dialog.appendChild(controls);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    // Native dialogs sit in the browser's top layer. Mount the cropper in the
    // same dialog when its file input lives there, otherwise the crop controls
    // would be visually hidden behind the active Studio dialog.
    var overlayHost = session.state.input.closest("dialog") || document.body;
    overlayHost.appendChild(overlay);

    session.overlay = overlay;
    session.dialog = dialog;
    session.stage = stage;
    session.canvas = canvas;
    session.context = canvas.getContext("2d", { alpha: false });
    session.loading = loading;
    session.aspectButtons = [portraitButton, squareButton];
    session.zoomInput = zoom;
    session.zoomValue = rangeValue;
    session.cancelButton = cancel;
    session.useButton = use;
    session.bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    setAspectButtons(session);
    bindSessionEvents(session);

    window.requestAnimationFrame(function () {
      if (activeSession === session) {
        cancel.focus();
      }
    });
  }

  function setAspectButtons(session) {
    session.aspectButtons.forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.aspect === session.aspect));
    });
  }

  function bindSessionEvents(session) {
    session.aspectButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setSessionAspect(session, button.dataset.aspect);
      });
    });

    session.zoomInput.addEventListener("input", function () {
      if (!session.image) {
        return;
      }
      session.zoom = Number(session.zoomInput.value) || 1;
      session.zoomValue.textContent = String(Math.round(session.zoom * 100)) + "%";
      syncCanvas(session, true);
    });

    session.cancelButton.addEventListener("click", function () {
      cancelSession(session, "Pemilihan foto dibatalkan.", true);
    });

    session.useButton.addEventListener("click", function () {
      prepareFile(session);
    });

    session.overlay.addEventListener("pointerdown", function (event) {
      if (event.target === session.overlay) {
        cancelSession(session, "Pemilihan foto dibatalkan.", true);
      }
    });

    session.onPointerDown = function (event) {
      if (!session.image || event.button !== 0 || event.isPrimary === false) {
        return;
      }
      event.preventDefault();
      session.drag = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY
      };
      session.stage.classList.add("is-dragging");
      try {
        session.canvas.setPointerCapture(event.pointerId);
      } catch (_error) {
        // Pointer capture is optional on older mobile browsers.
      }
    };

    session.onPointerMove = function (event) {
      if (!session.drag || event.pointerId !== session.drag.pointerId || !session.geometry) {
        return;
      }
      event.preventDefault();
      session.panX += event.clientX - session.drag.clientX;
      session.panY += event.clientY - session.drag.clientY;
      session.drag.clientX = event.clientX;
      session.drag.clientY = event.clientY;
      constrainPan(session);
      renderCanvas(session);
    };

    session.onPointerEnd = function (event) {
      if (!session.drag || event.pointerId !== session.drag.pointerId) {
        return;
      }
      session.drag = null;
      session.stage.classList.remove("is-dragging");
      try {
        session.canvas.releasePointerCapture(event.pointerId);
      } catch (_error) {
        // The pointer may already have been released by the browser.
      }
    };

    session.onCanvasKeydown = function (event) {
      if (!session.geometry) {
        return;
      }
      var step = event.shiftKey ? 28 : 10;
      var moved = true;
      if (event.key === "ArrowLeft") {
        session.panX -= step;
      } else if (event.key === "ArrowRight") {
        session.panX += step;
      } else if (event.key === "ArrowUp") {
        session.panY -= step;
      } else if (event.key === "ArrowDown") {
        session.panY += step;
      } else {
        moved = false;
      }
      if (moved) {
        event.preventDefault();
        constrainPan(session);
        renderCanvas(session);
      }
    };

    session.canvas.addEventListener("pointerdown", session.onPointerDown);
    session.canvas.addEventListener("pointermove", session.onPointerMove);
    session.canvas.addEventListener("pointerup", session.onPointerEnd);
    session.canvas.addEventListener("pointercancel", session.onPointerEnd);
    session.canvas.addEventListener("keydown", session.onCanvasKeydown);

    session.onKeydown = function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelSession(session, "Pemilihan foto dibatalkan.", true);
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      var focusable = Array.prototype.slice.call(
        session.dialog.querySelectorAll("button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])")
      ).filter(function (node) {
        return !node.hidden && node.offsetParent !== null;
      });
      if (!focusable.length) {
        return;
      }
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", session.onKeydown);

    session.onResize = function () {
      if (activeSession === session && session.image) {
        syncCanvas(session, true);
      }
    };
    if (typeof window.ResizeObserver === "function") {
      session.resizeObserver = new window.ResizeObserver(session.onResize);
      session.resizeObserver.observe(session.stage);
    } else {
      window.addEventListener("resize", session.onResize);
    }
  }

  function geometryFor(session, width, height) {
    var imageWidth = session.image.naturalWidth || session.image.width;
    var imageHeight = session.image.naturalHeight || session.image.height;
    var coverScale = Math.max(width / imageWidth, height / imageHeight);
    var scale = coverScale * session.zoom;
    var renderedWidth = imageWidth * scale;
    var renderedHeight = imageHeight * scale;
    return {
      viewportWidth: width,
      viewportHeight: height,
      scale: scale,
      imageWidth: renderedWidth,
      imageHeight: renderedHeight,
      maxPanX: Math.max(0, (renderedWidth - width) / 2),
      maxPanY: Math.max(0, (renderedHeight - height) / 2)
    };
  }

  function constrainPan(session) {
    if (!session.geometry) {
      return;
    }
    session.panX = Math.max(-session.geometry.maxPanX, Math.min(session.geometry.maxPanX, session.panX));
    session.panY = Math.max(-session.geometry.maxPanY, Math.min(session.geometry.maxPanY, session.panY));
  }

  function syncCanvas(session, preservePan) {
    if (!session.image || !session.stage || activeSession !== session) {
      return;
    }
    var rect = session.stage.getBoundingClientRect();
    var width = Math.max(1, Math.round(rect.width));
    var height = Math.max(1, Math.round(rect.height));
    var oldGeometry = session.geometry;
    var panXRatio = oldGeometry && oldGeometry.maxPanX ? session.panX / oldGeometry.maxPanX : 0;
    var panYRatio = oldGeometry && oldGeometry.maxPanY ? session.panY / oldGeometry.maxPanY : 0;
    var pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    if (session.canvas.width !== Math.round(width * pixelRatio) || session.canvas.height !== Math.round(height * pixelRatio)) {
      session.canvas.width = Math.round(width * pixelRatio);
      session.canvas.height = Math.round(height * pixelRatio);
    }

    session.geometry = geometryFor(session, width, height);
    if (preservePan) {
      session.panX = panXRatio * session.geometry.maxPanX;
      session.panY = panYRatio * session.geometry.maxPanY;
    }
    constrainPan(session);
    renderCanvas(session);
  }

  function renderCanvas(session) {
    if (!session.context || !session.geometry || !session.image) {
      return;
    }
    var geometry = session.geometry;
    var pixelRatio = session.canvas.width / geometry.viewportWidth;
    var left = (geometry.viewportWidth - geometry.imageWidth) / 2 + session.panX;
    var top = (geometry.viewportHeight - geometry.imageHeight) / 2 + session.panY;
    var context = session.context;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, geometry.viewportWidth, geometry.viewportHeight);
    context.fillStyle = "#e7e1da";
    context.fillRect(0, 0, geometry.viewportWidth, geometry.viewportHeight);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(session.image, left, top, geometry.imageWidth, geometry.imageHeight);
  }

  function setSessionAspect(session, aspect) {
    if (activeSession !== session || session.state.lockedAspect) {
      return;
    }
    var next = normalizeAspect(aspect, session.aspect);
    if (next === session.aspect) {
      return;
    }
    session.aspect = next;
    session.state.aspect = next;
    session.stage.style.aspectRatio = PRESETS[next].cssRatio;
    session.zoom = 1;
    session.panX = 0;
    session.panY = 0;
    session.zoomInput.value = "1";
    session.zoomValue.textContent = "100%";
    updateAspectControl(session.state);
    setAspectButtons(session);
    window.requestAnimationFrame(function () {
      syncCanvas(session, false);
    });
  }

  function sourceCrop(session) {
    var geometry = session.geometry;
    var sourceWidth = session.image.naturalWidth || session.image.width;
    var sourceHeight = session.image.naturalHeight || session.image.height;
    var cropWidth = geometry.viewportWidth / geometry.scale;
    var cropHeight = geometry.viewportHeight / geometry.scale;
    var left = (geometry.viewportWidth - geometry.imageWidth) / 2 + session.panX;
    var top = (geometry.viewportHeight - geometry.imageHeight) / 2 + session.panY;
    var sourceX = -left / geometry.scale;
    var sourceY = -top / geometry.scale;

    cropWidth = Math.min(cropWidth, sourceWidth);
    cropHeight = Math.min(cropHeight, sourceHeight);
    sourceX = Math.max(0, Math.min(sourceWidth - cropWidth, sourceX));
    sourceY = Math.max(0, Math.min(sourceHeight - cropHeight, sourceY));
    return {
      x: sourceX,
      y: sourceY,
      width: cropWidth,
      height: cropHeight
    };
  }

  function cropFile(session) {
    return new Promise(function (resolve, reject) {
      if (!session.image || !session.geometry) {
        reject(new Error("Image is not ready."));
        return;
      }
      var preset = PRESETS[session.aspect];
      var crop = sourceCrop(session);
      var canvas = document.createElement("canvas");
      canvas.width = preset.width;
      canvas.height = preset.height;
      var context = canvas.getContext("2d", { alpha: false });
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, preset.width, preset.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        session.image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        preset.width,
        preset.height
      );
      canvas.toBlob(
        function (blob) {
          if (!blob) {
            reject(new Error("WebP export failed."));
            return;
          }
          try {
            resolve(
              new File([blob], outputFileName(session.file, session.aspect), {
                type: "image/webp",
                lastModified: Date.now()
              })
            );
          } catch (_error) {
            reject(new Error("WebP file could not be created."));
          }
        },
        "image/webp",
        0.9
      );
    });
  }

  function prepareFile(session) {
    if (activeSession !== session || session.processing || !session.image) {
      return;
    }
    session.processing = true;
    session.useButton.disabled = true;
    session.cancelButton.disabled = true;
    session.useButton.textContent = "Menyiapkan...";

    cropFile(session)
      .then(function (file) {
        if (activeSession !== session) {
          return;
        }
        session.state.aspect = session.aspect;
        session.state.preparedFile = file;
        session.state.rawFile = session.file;
        displayPreparedPreview(session.state);
        setStatus(
          session.state,
          "Foto siap · " + PRESETS[session.aspect].label + " · " + String(PRESETS[session.aspect].width) + " × " + String(PRESETS[session.aspect].height),
          "ready"
        );
        closeSession(session, true);
        notify(session.state, "ready", { file: file });
      })
      .catch(function () {
        if (activeSession !== session) {
          return;
        }
        session.processing = false;
        session.useButton.disabled = false;
        session.cancelButton.disabled = false;
        session.useButton.textContent = "Gunakan foto";
        setStatus(session.state, "Foto belum dapat diproses. Coba gunakan file lain.", "error");
        notify(session.state, "error", { message: "WebP export failed." });
      });
  }

  function closeSession(session, focusInput) {
    if (!session || session.closed) {
      return;
    }
    session.closed = true;
    if (activeSession === session) {
      activeSession = null;
    }
    if (session.resizeObserver) {
      session.resizeObserver.disconnect();
    } else if (session.onResize) {
      window.removeEventListener("resize", session.onResize);
    }
    if (session.onKeydown) {
      document.removeEventListener("keydown", session.onKeydown);
    }
    if (session.overlay && session.overlay.parentNode) {
      session.overlay.parentNode.removeChild(session.overlay);
    }
    document.body.style.overflow = session.bodyOverflow || "";
    if (focusInput) {
      window.requestAnimationFrame(function () {
        if (session.state.input && document.contains(session.state.input)) {
          session.state.input.focus();
        }
      });
    }
  }

  function cancelSession(session, message, notifyClear) {
    if (!session || session.closed) {
      return;
    }
    var state = session.state;
    closeSession(session, true);
    resetState(state, {
      clearInput: true,
      message: message || "",
      kind: "info"
    });
    if (notifyClear) {
      notify(state, "clear", { reason: "cancelled" });
    }
  }

  function openSession(state, file) {
    if (activeSession) {
      cancelSession(activeSession, "", false);
    }
    ensureStyles();
    var session = {
      state: state,
      file: file,
      aspect: state.lockedAspect || state.aspect,
      image: null,
      geometry: null,
      panX: 0,
      panY: 0,
      zoom: 1,
      drag: null,
      processing: false,
      closed: false
    };
    activeSession = session;
    createDialog(session);

    loadImage(file)
      .then(function (image) {
        if (activeSession !== session || session.closed) {
          return;
        }
        session.image = image;
        session.loading.hidden = true;
        window.requestAnimationFrame(function () {
          syncCanvas(session, false);
        });
      })
      .catch(function () {
        if (activeSession !== session || session.closed) {
          return;
        }
        var stateForError = session.state;
        closeSession(session, true);
        resetState(stateForError, {
          clearInput: true,
          message: "Foto tidak dapat dibaca. Coba file JPG, PNG, atau WebP lain.",
          kind: "error"
        });
        notify(stateForError, "error", { message: "Image decode failed." });
      });
  }

  function bind(input, options) {
    if (!input || input.nodeType !== 1 || String(input.type || "").toLowerCase() !== "file") {
      throw new TypeError("COMOOTDImageCropper.bind expects a file input element.");
    }
    if (states.has(input)) {
      return input;
    }
    states.set(input, makeState(input, options || {}));
    return input;
  }

  function getState(input) {
    return input ? states.get(input) || null : null;
  }

  function getFile(input) {
    var state = getState(input);
    return state && state.preparedFile ? state.preparedFile : null;
  }

  function getAspect(input) {
    var state = getState(input);
    return state ? state.aspect : "portrait";
  }

  function clear(input) {
    var state = getState(input);
    if (!state) {
      if (input && String(input.type || "").toLowerCase() === "file") {
        input.value = "";
      }
      return;
    }
    if (activeSession && activeSession.state === state) {
      closeSession(activeSession, false);
    }
    resetState(state, { clearInput: true });
    notify(state, "clear", { reason: "manual" });
  }

  window.COMOOTDImageCropper = {
    bind: bind,
    getFile: getFile,
    getAspect: getAspect,
    clear: clear
  };
})();
