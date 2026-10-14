// Service worker: bewaart de app op de telefoon zodat hij offline werkt,
// en zorgt dat een nieuwe versie netjes wordt opgepikt.
// Bij elke update: VERSION ophogen (ook in js/ui.js).

const VERSION = '0.3.0';
const APP_CACHE = `compose-app-${VERSION}`;
const FONT_CACHE = 'compose-fonts';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/views.js',
  './js/views/common.js',
  './js/views/home.js',
  './js/views/kast.js',
  './js/views/atelier.js',
  './js/views/outfit.js',
  './js/views/settings.js',
  './js/views/wishlist.js',
  './js/ui.js',
  './js/db.js',
  './js/data.js',
  './js/images.js',
  './js/theme.js',
  './js/backup.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.startsWith('compose-app-') && k !== APP_CACHE)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Lettertypen van Google: uit de cache, op de achtergrond verversen.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const cached = await cache.match(req);
      const fresh = fetch(req).then((res) => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  // App-bestanden: eerst uit de cache (snel en offline), anders van het netwerk.
  event.respondWith((async () => {
    if (req.mode === 'navigate') {
      return (await caches.match('./index.html')) || fetch(req);
    }
    return (await caches.match(req, { ignoreSearch: true })) || fetch(req);
  })());
});
