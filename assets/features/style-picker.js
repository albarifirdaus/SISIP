(() => {
  "use strict";
  const selector = "[data-curator-choice-picker], [data-taxonomy-picker], .member-tag-picker";
  const inputs = root => {
    if (root.matches('.member-tag-picker')) {
      return [...root.querySelectorAll('[data-member-profile-tag="styleTags"]')].map(source => {
        const value = source.dataset.memberProfileValue;
        const current = () => [...root.querySelectorAll('[data-member-profile-tag="styleTags"]')].find(el => el.dataset.memberProfileValue === value);
        return { value, label:source.textContent, dataset:{styleCurrent:'true'},
          get checked() { return current()?.getAttribute('aria-pressed') === 'true'; },
          set checked(next) { const el = current(); if (el && (el.getAttribute('aria-pressed') === 'true') !== next) el.click(); },
          dispatchEvent() {} };
      });
    }
    return [...root.querySelectorAll('.curator-choice-list input[type="checkbox"], .taxonomy-options input[type="checkbox"]')];
  };
  const allowed = input => input.dataset.styleCurrent !== 'false';
  const limit = root => Number(root.dataset.maxSelections || root.dataset.maxTags || (root.matches('.member-tag-picker') ? 10 : 3));
  const button = (label, action) => {
    const el = document.createElement('button');
    el.type = 'button'; el.textContent = label; el.onclick = action;
    return el;
  };
  function refresh(root) {
    let summary = root.querySelector('.style-picker-summary');
    if (!summary) { summary = document.createElement('div'); summary.className = 'style-picker-summary'; root.append(summary); }
    summary.replaceChildren();
    const selected = inputs(root).filter(el => el.checked);
    root.dataset.styleSelection = JSON.stringify(selected.map(el => el.value));
    root.classList.add('has-compact-style-picker');
    root.querySelector('[data-curator-choice-count], [data-taxonomy-count], .member-tag-picker-count')?.replaceChildren(`${selected.length} / ${limit(root)}`);
    selected.forEach(input => {
      const chip = button(`${input.label || input.value} ×`, () => { input.checked = false; input.dispatchEvent(new Event('change', {bubbles:true})); refresh(root); });
      chip.setAttribute('aria-label', `Hapus style ${input.value}`); summary.append(chip);
    });
    const trigger = button('+ Pilih style', () => open(root, trigger));
    trigger.setAttribute('aria-haspopup', 'dialog'); trigger.dataset.openStylePicker = ''; summary.append(trigger);
    if (selected.some(el => !allowed(el)) || selected.length > limit(root)) {
      const note = document.createElement('p'); note.className = 'curator-file-note';
      note.textContent = 'Pilihan lama tetap tersimpan. Buka Pilih style untuk menggantinya dengan maksimal 3 style utama.';
      summary.append(note);
    }
  }
  function open(root, trigger) {
    const options = inputs(root), max = limit(root);
    const chosen = new Set(options.filter(el => el.checked).map(el => el.value));
    const dialog = document.createElement('dialog'); dialog.className = 'style-picker-dialog';
    dialog.setAttribute('aria-label', 'Pilih style');
    dialog.innerHTML = '<header><h2>Pilih style</h2></header><label class="style-picker-search">Cari style<input type="search" placeholder="Cari style…" /></label><div class="style-picker-active" aria-label="Style terpilih"></div><p class="style-picker-status" aria-live="polite"></p><div class="style-picker-options"></div><footer><p>Pilihan diterapkan ke form. Simpan form untuk menyimpan perubahan.</p></footer>';
    const search = dialog.querySelector('input'), list = dialog.querySelector('.style-picker-options');
    const status = dialog.querySelector('.style-picker-status'), active = dialog.querySelector('.style-picker-active');
    const apply = button('Terapkan', () => {
      if (chosen.size > max || options.some(el => chosen.has(el.value) && !allowed(el))) return;
      // Remove first so replacements also work when the existing form is at its limit.
      options.filter(input => !chosen.has(input.value)).forEach(input => { input.checked = false; });
      options.filter(input => chosen.has(input.value)).forEach(input => { input.checked = true; });
      options[0]?.dispatchEvent(new Event('change', {bubbles:true}));
      refresh(root); dialog.close();
    });
    const close = button('×', () => dialog.close()); close.setAttribute('aria-label', 'Tutup pemilih style');
    dialog.querySelector('header').append(close);
    dialog.querySelector('footer').append(button('Batal', () => dialog.close()), apply);
    function render() {
      const legacy = options.some(el => chosen.has(el.value) && !allowed(el));
      apply.disabled = chosen.size > max || legacy;
      status.textContent = legacy ? 'Hapus tag personal lama, lalu pilih style utama.' : chosen.size >= max ? `${chosen.size}/${max} dipilih. Hapus satu untuk mengganti.` : `${chosen.size}/${max} dipilih`;
      active.replaceChildren();
      chosen.forEach(value => active.append(button(`${value} ×`, () => { chosen.delete(value); render(); })));
      list.replaceChildren();
      options.filter(el => allowed(el) && el.value.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())).forEach(input => {
        const option = button(input.label || input.value, () => { chosen.has(input.value) ? chosen.delete(input.value) : chosen.add(input.value); render(); });
        option.setAttribute('aria-pressed', String(chosen.has(input.value)));
        option.disabled = !chosen.has(input.value) && chosen.size >= max;
        list.append(option);
      });
      if (!list.children.length) list.textContent = 'Style tidak ditemukan. Coba kata lain.';
    }
    search.oninput = render;
    dialog.addEventListener('keydown', event => { event.stopPropagation(); });
    dialog.addEventListener('close', () => { dialog.remove(); (trigger.isConnected ? trigger : root.querySelector('[data-open-style-picker]'))?.focus(); });
    document.body.append(dialog); render(); dialog.showModal(); search.focus();
  }
  function scan() { document.querySelectorAll(selector).forEach(root => { if (!root.querySelector('.style-picker-summary') || root.dataset.styleSelection !== JSON.stringify(inputs(root).filter(el => el.checked).map(el => el.value))) refresh(root); }); }
  document.addEventListener('change', event => { const root = event.target.closest(selector); if (root) refresh(root); });
  new MutationObserver(scan).observe(document.body, {childList:true,subtree:true});
  scan();
})();
