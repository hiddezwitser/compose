// Kleine gedeelde UI-hulpjes.

export const VERSION = '0.1.0'; // houd gelijk met VERSION in sw.js

export const icons = {
  settings: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',
  back: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  share: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 15V4M8 8l4-4 4 4M5 12v7h14v-7"/></svg>',
};

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
