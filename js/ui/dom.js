// Petits utilitaires DOM : création, échappement, toasts et fenêtres modales.
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer = null;
export function toast(msg, kind = '') {
  let t = document.getElementById('toast');
  if (!t) { t = el('<div id="toast" role="status" aria-live="polite"></div>'); document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 2200);
}

/**
 * Fenêtre modale. buttons : [{ label, cls, onClick, close = true }]
 * Renvoie une fonction de fermeture.
 */
export function modal({ title = '', body = '', buttons = [{ label: 'OK' }], dismissable = true, cls = '' }) {
  const m = el(`<div class="modal-wrap"><div class="modal ${cls}" role="dialog" aria-modal="true">
    ${title ? `<h2>${title}</h2>` : ''}<div class="modal-body"></div><div class="modal-actions"></div></div></div>`);
  const bodyEl = m.querySelector('.modal-body');
  if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
  const close = () => { m.classList.add('out'); setTimeout(() => m.remove(), 180); };
  for (const b of buttons) {
    const btn = el(`<button class="btn ${b.cls || ''}">${b.label}</button>`);
    btn.addEventListener('click', () => { if (b.close !== false) close(); b.onClick?.(); });
    m.querySelector('.modal-actions').appendChild(btn);
  }
  if (dismissable) m.addEventListener('click', (e) => { if (e.target === m) close(); });
  document.body.appendChild(m);
  return close;
}

export function confirmModal(title, text, onYes, yesLabel = 'Confirmer') {
  modal({ title, body: `<p>${text}</p>`, buttons: [{ label: 'Annuler', cls: 'ghost' }, { label: yesLabel, cls: 'primary', onClick: onYes }] });
}
