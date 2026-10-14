// Kleine gedeelde UI-hulpjes.

export const VERSION = '0.2.0'; // houd gelijk met VERSION in sw.js

export const icons = {
  settings: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',
  back: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  share: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 15V4M8 8l4-4 4 4M5 12v7h14v-7"/></svg>',
  plus: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  close: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  image: '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14"/><path d="M4 16l5-5 4 4 2-2 5 5"/><circle cx="15.5" cy="9.5" r="1.5"/></svg>',
  paste: '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="6" y="5" width="12" height="15"/><path d="M9 5V3.5h6V5M9 10h6M9 14h4"/></svg>',
  note: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4M8 9h8M8 13h5"/></svg>',
  hanger: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M10 5.5a2 2 0 1 1 2 2V9l8.4 6.4a1 1 0 0 1-.6 1.8H4.2a1 1 0 0 1-.6-1.8L12 9"/></svg>',
  outfit: '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="9"/><rect x="13" y="4" width="7" height="5"/><rect x="13" y="11" width="7" height="9"/><rect x="4" y="15" width="7" height="5"/></svg>',
  trash: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/></svg>',
  edit: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 19l1-4L16 5l3 3L9 18z"/></svg>',
  pin: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 4h12v16l-6-4-6 4z"/></svg>',
  info: '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 11v5M12 8v.5"/></svg>',
};

// ---------- Foto's kiezen, plakken, slepen ----------

export function pickFile(accept = 'image/*') {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.hidden = true;
    const finish = (file) => { input.remove(); resolve(file); };
    input.addEventListener('change', () => finish(input.files[0] || null));
    input.addEventListener('cancel', () => finish(null));
    document.body.append(input);
    input.click();
  });
}

export async function readClipboardImage() {
  if (!navigator.clipboard?.read) throw new Error('Plakken wordt hier niet ondersteund. Gebruik "Kies foto".');
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith('image/'));
    if (type) return item.getType(type);
  }
  throw new Error('Geen foto op het klembord gevonden.');
}

// Plakken met het toetsenbord / contextmenu: het actieve scherm kan een handler zetten.
let pasteHandler = null;
export function setPasteHandler(fn) { pasteHandler = fn; }
document.addEventListener('paste', (e) => {
  if (!pasteHandler) return;
  if (e.target.closest?.('input, textarea')) return;
  const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
  if (file) { e.preventDefault(); pasteHandler(file); }
});

// Maakt een element een sleepzone voor foto's.
export function dropZone(el, onFile) {
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('dragover'); });
  el.addEventListener('dragleave', () => el.classList.remove('dragover'));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('dragover');
    const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'));
    if (file) onFile(file);
  });
}

// ---------- Onderblad (bottom sheet) ----------

export function sheet(innerHtml, onMount) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-modal="true">${innerHtml}</div>`;
  document.body.append(wrap);
  const close = () => {
    wrap.remove();
    window.removeEventListener('hashchange', close);
  };
  wrap.querySelector('.sheet-backdrop').addEventListener('click', close);
  window.addEventListener('hashchange', close);
  onMount?.(wrap.querySelector('.sheet'), close);
  return close;
}

// Tekst veilig in HTML zetten (voor alles wat de gebruiker zelf invoert).
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const nlDate = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
const nlMonth = new Intl.DateTimeFormat('nl-NL', { month: 'long' });
const nlShort = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });

export const fmt = {
  today: () => nlDate.format(new Date()),
  month: () => nlMonth.format(new Date()),
  date: (d) => nlShort.format(new Date(d)),
};

export function greeting() {
  const h = new Date().getHours();
  if (h < 6) return 'Goedenacht';
  if (h < 12) return 'Goedemorgen';
  if (h < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

let toastTimer = null;

export function toast(message, action) {
  const el = document.getElementById('toast');
  el.textContent = '';
  const text = document.createElement('span');
  text.textContent = message;
  el.append(text);
  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = action.label;
    btn.addEventListener('click', () => { el.hidden = true; action.run(); });
    el.append(btn);
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  if (!action?.sticky) toastTimer = setTimeout(() => { el.hidden = true; }, action ? 8000 : 3000);
}

export function isStandalone() {
  return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
}
