// Outbound service worker — cache-first app shell, fully offline.
// Bump CACHE when shipping changes so reps get the "New version available" toast.
const CACHE = 'outbound-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './data/content.json',
  './js/app.js',
  './js/db.js',
  './js/util.js',
  './js/ui.js',
  './js/state.js',
  './js/activity.js',
  './js/logsheet.js',
  './js/shuffle.js',
  './js/stats.js',
  './js/components.js',
  './js/pages/today.js',
  './js/pages/scripts.js',
  './js/pages/callmode.js',
  './js/pages/tracker.js',
  './js/pages/learn.js',
  './js/pages/settings.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.svg',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
    })
  );
});
