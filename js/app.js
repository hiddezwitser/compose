// Opstarten: thema, navigatie tussen tabbladen, service worker (offline + updates).

import { applyTheme } from './theme.js';
import { routes } from './views.js';
import { db } from './db.js';
import { images } from './images.js';
import { toast, setPasteHandler } from './ui.js';

const view = document.getElementById('view');
const tabs = document.querySelectorAll('.tabbar a');

let renderId = 0;
let lastPath = null;

async function render() {
  const path = location.hash.replace(/^#\/?/, '') || 'home';
  let match = null;
  let route = routes.find((r) => (match = path.match(r.path)));
  if (!route) { route = routes[0]; match = []; }
  const id = ++renderId;

  let screen;
  try {
    screen = await route.view(match);
  } catch (err) {
    console.error(err);
    screen = { html: `<div class="empty"><div class="line">Er ging iets mis.</div><p class="hint">${String(err.message || err)}</p></div>` };
  }
  if (id !== renderId) return; // er is intussen al verder genavigeerd

  setPasteHandler(null);
  view.innerHTML = screen.html;
  screen.mount?.(view, { rerender: render });

  tabs.forEach((a) => {
    if (a.dataset.tab === route.tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (path !== lastPath) window.scrollTo(0, 0);
  lastPath = path;
}

// Foto's die nergens meer bij horen (bijv. gekozen en daarna geannuleerd) opruimen.
async function cleanOrphanImages() {
  const [pieces, board, wishes, imgs] = await Promise.all([db.all('pieces'), db.all('board'), db.all('wishes'), db.all('images')]);
  const used = new Set([...pieces, ...board, ...wishes].map((x) => x.imageId).filter(Boolean));
  for (const img of imgs) if (!used.has(img.id)) await images.remove(img.id);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.hostname === 'localhost') return; // tijdens ontwikkelen altijd de nieuwste bestanden

  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const offerUpdate = (worker) => toast('Nieuwe versie beschikbaar', {
      label: 'Verversen', sticky: true, run: () => worker.postMessage('skipWaiting'),
    });

    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
      });
    });

    // Bij elke keer openen even kijken of er een nieuwe versie online staat.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => { /* offline-ondersteuning niet beschikbaar; app werkt verder gewoon */ });

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

applyTheme();
window.addEventListener('hashchange', render);
cleanOrphanImages().catch(() => {}).finally(render);
registerServiceWorker();

// Vraag de browser om de opslag niet automatisch op te schonen.
navigator.storage?.persist?.().catch(() => {});
