/* ProductionTSH Service Worker - versioned to prevent stale UI assets */
const VERSION = '20260106_1';
const CACHE_NAME = `productiontsh-cache-${VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html?v=20260106_1',
  './style.css?v=20260106_1',
  './app.js?v=20260106_1',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      await cache.addAll(PRECACHE_URLS);
    } catch (e) {
      // Ignore precache failures (e.g., offline during install)
      console.warn('Precache failed:', e);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k.startsWith('productiontsh-cache-') && k !== CACHE_NAME) ? caches.delete(k) : Promise.resolve()));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isSameOrigin(url) {
  try {
    return new URL(url).origin === self.location.origin;
  } catch {
    return false;
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok && request.method === 'GET') {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (e) {
    const cached = await cache.match(request, { ignoreSearch: false });
    if (cached) return cached;
    // Fallback for navigations
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./index.html?v=20260106_1', { ignoreSearch: false });
      if (fallback) return fallback;
    }
    throw e;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: false });
  const fetchPromise = fetch(request).then((fresh) => {
    if (fresh && fresh.ok && request.method === 'GET') {
      cache.put(request, fresh.clone());
    }
    return fresh;
  }).catch(() => null);

  return cached || (await fetchPromise) || cached;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle same-origin GETs
  if (request.method !== 'GET' || !isSameOrigin(request.url)) return;

  // Navigations: network-first for latest HTML
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Always network-first for JS/CSS to avoid stale handler errors
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Other static assets: SWR
  event.respondWith(staleWhileRevalidate(request));
});
