(() => {
  const busy = document.getElementById('busy');

  // Tlačidlá, ktoré volajú AI, ukážu indikátor a zablokujú sa proti dvojkliku.
  document.addEventListener('submit', (e) => {
    const btn = e.submitter;
    if (btn && btn.hasAttribute('data-confirm') && !window.confirm(btn.getAttribute('data-confirm'))) {
      e.preventDefault();
      return;
    }
    if (btn && btn.hasAttribute('data-busy') && busy) {
      busy.hidden = false;
      // Hodnotu stlačeného tlačidla treba zachovať, inak by sa po zablokovaní neodoslala.
      if (btn.name) {
        const hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = btn.name;
        hidden.value = btn.value;
        e.target.append(hidden);
      }
      setTimeout(() => e.target.querySelectorAll('button').forEach((b) => (b.disabled = true)), 0);
    }
  });

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const el = document.querySelector(btn.getAttribute('data-copy'));
    if (!el) return;
    const text = 'value' in el ? el.value : el.textContent;
    try {
      await navigator.clipboard.writeText(text);
      const old = btn.textContent;
      btn.textContent = '✓';
      setTimeout(() => (btn.textContent = old), 1500);
    } catch {}
  });
})();
