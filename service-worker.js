const CACHE_NAME = 'todo-calendar-pwa-v1.0.0';
const PRECACHE_URLS = [
  './', './index.html', './styles.css', './app.js', './manifest.json', './version.json',
  './icons/icon-72.png', './icons/icon-96.png', './icons/icon-128.png', './icons/icon-144.png',
  './icons/icon-152.png', './icons/icon-192.png', './icons/icon-384.png', './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }
  if (url.origin === location.origin) {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE_NAME).then(cache => cache.put(req, copy)); return res;
    }).catch(() => caches.match('./index.html'))));
    return;
  }
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
