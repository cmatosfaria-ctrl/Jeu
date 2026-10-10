// Service worker : met tout le jeu en cache pour jouer hors-ligne.
// Pensez à incrémenter VERSION à chaque mise à jour du jeu.
const VERSION = 'alchimie-v1';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'js/main.js', 'js/storage.js', 'js/audio.js',
  'js/core/fraction.js', 'js/core/color.js', 'js/core/rng.js',
  'js/dosage/engine.js', 'js/dosage/solver.js', 'js/dosage/generator.js',
  'js/pipes/pieces.js', 'js/pipes/sim.js', 'js/pipes/level.js', 'js/pipes/levels.js',
  'js/chain/chain.js', 'js/data/levels-data.js',
  'js/career/data.js', 'js/career/career.js', 'js/career/contracts.js',
  'js/ui/app.js', 'js/ui/dom.js', 'js/ui/icons.js', 'js/ui/widgets.js', 'js/ui/play.js',
  'js/ui/dosage-view.js', 'js/ui/pipes-view.js', 'js/ui/career-view.js', 'js/ui/howto.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache d'abord, réseau en secours (et mise en cache des nouveautés).
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok && new URL(e.request.url).origin === location.origin) {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
    }
    return res;
  })));
});
