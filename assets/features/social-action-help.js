(() => {
  'use strict';
  const key = 'comootd-social-help-v1';
  let dismissed = false;
  try { dismissed = localStorage.getItem(key) === 'seen'; } catch {}
  const selector = '.look-like-button,.retention-save-button';
  let panel;
  function show(event) {
    if (dismissed || !event.target.closest?.(selector)) return;
    // Inform without intercepting the user's like/save action or changing it.
    const host = event.target.closest('dialog[open]') || document.body;
    if (!panel) {
      panel = document.createElement('aside');
      panel.className = 'social-action-help';
      panel.setAttribute('aria-label', 'Tentang suka dan simpan');
      panel.innerHTML = '<div role="status"><p><strong>Hati · Suka</strong><br>Apresiasi look yang kamu sukai.</p><p><strong>Bookmark · Simpan</strong><br>Masukkan look atau produk ke koleksi untuk ditemukan kembali.</p></div><button type="button">Mengerti</button>';
      panel.querySelector('button').addEventListener('click', () => {
        dismissed = true;
        try { localStorage.setItem(key, 'seen'); } catch {}
        const trigger = panel._trigger;
        panel.remove();
        if (trigger?.isConnected) trigger.focus({preventScroll:true});
      });
    }
    panel._trigger = event.target.closest(selector);
    if (panel.parentElement !== host) host.append(panel);
  }
  document.addEventListener('focusin', show);
  document.addEventListener('pointerover', (event) => { if (event.pointerType === 'mouse') show(event); });
  document.addEventListener('click', show);
})();
