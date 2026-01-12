const CACHE_NAME = 'facturation-v1-4-5';
const ASSETS = ['./','./index.html','./css/style.css','./js/app.js','./manifest.json','./icons/icon-192.png','./icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => (k !== CACHE_NAME) ? caches.delete(k) : null))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put('./', copy));
      return res;
    }).catch(()=>caches.match('./')));
    return;
  }
  event.respondWith(caches.match(req).then(cached => cached || fetch(req)));
});
