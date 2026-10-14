// Opstarten: thema, navigatie tussen tabbladen, service worker (offline + updates).

import { applyTheme } from './theme.js';
import { routes } from './views.js';
import { toast } from './ui.js';

const view = document.getElementById('view');
const tabs = document.querySelectorAll('.tabbar a');
const TAB_FOR = { instellingen: 'home' };

let renderId = 0;

async function render() {
  const name = location.hash.replace(/^#\/?/, '') || 'home';
  const route = routes[name] ? name : 'home';
  const id = ++renderId;

  const screen = await routes[route]();
  if (id !== renderId) return; // er is intussen al verder genavigeerd

  view.innerHTML = screen.html;
  screen.mount?.(view, render);

  const active = TAB_FOR[route] || route;
  tabs.forEach((a) => {
    if (a.dataset.tab === active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

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
render();
registerServiceWorker();

// Vraag de browser om de opslag niet automatisch op te schonen.
navigator.storage?.persist?.().catch(() => {});
