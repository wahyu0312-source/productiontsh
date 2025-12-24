// NOTE: Cache name is bumped to force update when UI assets change
const CACHE_NAME = 'productionsh-cache-v3';
const OFFLINE_URLS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './tsh.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // API Apps Script dll (domain lain) tidak di-cache di sini
  if (!request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() =>
        caches.match(request).then((resp) => resp || caches.match('./index.html'))
      )
  );
});
