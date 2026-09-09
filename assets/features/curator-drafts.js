/* Device-local drafts. No draft content is sent to the server. */
(() => {
  "use strict";
  let database;
  const open = () => database || (database = new Promise((resolve, reject) => {
    const request = indexedDB.open("comootd-curator-drafts", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts", { keyPath:"key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = null; reject(request.error); };
    request.onblocked = () => { database = null; reject(new Error("Tutup tab COMOOTD lain lalu coba lagi.")); };
  }));
  async function transaction(mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("drafts", mode);
      const request = action(tx.objectStore("drafts"));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error("Draf tidak tersimpan."));
    });
  }
  const fields = (root) => [...root.querySelectorAll("input[name],select[name],textarea[name]")]
    .filter((input) => input.type !== "file")
    .map((input) => ({ name:input.name, value:input.value, checked:input.checked, type:input.type }));
  function restoreFields(root, values) {
    const controls = [...root.querySelectorAll("input[name],select[name],textarea[name]")];
    const used = new Set();
    values.forEach((field) => {
      const input = controls.find((entry) => !used.has(entry) && entry.name === field.name && (field.type !== "checkbox" || entry.value === field.value));
      if (!input) return;
      used.add(input);
      if (input.tagName === "SELECT" && field.value && ![...input.options].some((option) => option.value === field.value)) input.add(new Option(field.value, field.value));
      input.value = field.value;
      if (field.type === "checkbox") input.checked = field.checked;
    });
  }
  function status(form, text) { form.querySelector("[data-draft-status]").textContent = text; }
  function snapshot(form) {
    const session = form._draftSession;
    const photos = [...form.querySelectorAll("[data-curator-gallery-input]")].map((input) => {
      const raw = input.files?.[0];
      let file;
      let ready = true;
      try { file = session.options.getFile(input); } catch { file = raw; ready = false; }
      const saved = !raw && input._draftPhoto;
      return { name:input.name, file:file || saved?.file || null, ready:saved ? saved.ready : ready, aspect:session.options.getAspect(input) };
    });
    return { key:session.key, owner:session.owner, version:1, base:session.options.base, fields:fields(form), photos,
      rows:form.querySelectorAll("[data-curator-reference-row]").length, step:Number(form.dataset.currentStep || 1), updatedAt:Date.now(), title:form.elements.title.value || "Look tanpa judul" };
  }
  async function save(form) {
    const session = form?._draftSession;
    if (!session || session.finished) return true;
    clearTimeout(session.timer);
    const revision = session.revision;
    if (!session.dirty) return true;
    status(form, "Menyimpan draf di perangkat ini…");
    let draft;
    try { draft = snapshot(form); } catch { status(form, "Draf belum tersimpan. Coba simpan lagi."); return false; }
    const job = session.queue.catch(() => {}).then(() => transaction("readwrite", (store) => store.put(draft)));
    session.queue = job;
    try {
      await job;
      if (session.revision === revision) {
        session.dirty = false;
        status(form, draft.photos.some((photo) => photo.file && !photo.ready) ? "Draf tersimpan · ada foto yang masih perlu crop." : "Draf dan foto tersimpan di perangkat ini.");
      }
      return !session.dirty;
    } catch {
      status(form, "Draf belum tersimpan. Penyimpanan browser mungkin penuh atau dibatasi. Jangan tutup editor; coba simpan lagi.");
      return false;
    }
  }
  function mark(form) {
    const session = form?._draftSession;
    if (!session || session.finished || session.publishing) return;
    session.dirty = true;
    session.revision++;
    clearTimeout(session.timer);
    status(form, "Perubahan belum tersimpan…");
    session.timer = setTimeout(() => void save(form), 600);
  }
  function attach(form, options) {
    if (!form || !options.owner || form._draftSession) return;
    const draft = options.draft?.owner === options.owner ? options.draft : null;
    form._draftSession = { owner:options.owner, key:draft?.key || `${options.owner}:${crypto.randomUUID()}`, options, revision:0, dirty:false, queue:Promise.resolve() };
    const note = document.createElement("div");
    note.className = "curator-draft-note";
    note.innerHTML = '<p data-draft-status role="status" aria-live="polite">Draf otomatis aktif di browser ini.</p><p>Draf belum dipublikasikan, tidak tersinkron ke perangkat lain, dan dapat hilang jika data browser dihapus. Hindari perangkat bersama.</p><button type="button" class="curator-small-button" data-save-look-draft>Simpan draf sekarang</button>';
    form.prepend(note);
    if (draft) {
      const list = form.querySelector("[data-curator-reference-list]");
      list.innerHTML = Array.from({ length:Math.max(2, Math.min(5, draft.rows)) }, (_, index) => options.row({}, index)).join("");
      restoreFields(form, draft.fields);
      draft.photos.forEach((photo) => {
        if (!photo.file) return;
        const input = [...form.querySelectorAll("[data-curator-gallery-input]")].find((entry) => entry.name === photo.name);
        if (!input) return;
        input._draftPhoto = photo;
        input.required = false;
        const label = document.createElement("p");
        label.className = "curator-file-note";
        label.textContent = `${photo.file.name || "Foto"} dipulihkan${photo.ready ? " · siap dipakai" : " · perlu crop"}.`;
        input.after(label);
        if (!photo.ready) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = "Lanjutkan crop foto";
          button.className = "curator-small-button";
          button.onclick = () => { const transfer = new DataTransfer(); transfer.items.add(photo.file); input.files = transfer.files; input.dispatchEvent(new Event("change", { bubbles:true })); button.remove(); };
          label.after(button);
        }
      });
      options.restored(form);
      status(form, "Draf dipulihkan. Periksa kembali sebelum terbit.");
    }
    form.addEventListener("input", () => mark(form));
    form.addEventListener("change", () => mark(form));
    form.addEventListener("click", (event) => { if (event.target.closest("[data-save-look-draft]")) { mark(form); void save(form); } });
  }
  async function leave(form) {
    if (!form?._draftSession) return true;
    if (form._draftSession.publishing) return false;
    if (await save(form)) return true;
    const allowed = window.confirm("Perubahan terbaru belum tersimpan. Tetap keluar dan kehilangan perubahan tersebut?");
    if (allowed) { form._draftSession.finished = true; form._draftSession.dirty = false; clearTimeout(form._draftSession.timer); }
    return allowed;
  }
  async function finish(form) {
    const session = form._draftSession;
    if (!session) return;
    session.finished = true;
    session.dirty = false;
    clearTimeout(session.timer);
    await session.queue.catch(() => {});
    await transaction("readwrite", (store) => store.delete(session.key));
  }
  async function list(owner) {
    return (await transaction("readonly", (store) => store.getAll())).filter((draft) => draft.owner === owner && draft.version === 1).sort((a,b) => b.updatedAt - a.updatedAt);
  }
  window.addEventListener("beforeunload", (event) => {
    const session = document.querySelector("[data-curator-look-form]")?._draftSession;
    if (session?.dirty || session?.publishing) { event.preventDefault(); event.returnValue = ""; }
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void save(document.querySelector("[data-curator-look-form]")); });
  window.COMOOTDLookDrafts = { attach, mark, save, leave, finish, list };
})();
