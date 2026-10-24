const CACHE_NAME = 'cinderspire-v1';
const FILES = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
];
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
    .then(cache => cache.addAll(FILES))
  );
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return resp;
        }).catch(() => caches.match(event.request))
    );
  } else if (["script", "worker", "module"].includes(event.request.destination)) {
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return resp;
        }).catch(() => caches.match(event.request))
    );
  } else {
    // Pass through for other assets, fallback to cache if offline
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
