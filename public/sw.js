const CACHE_NAME = 'overlay-global-lens-v4';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

const OFFLINE_HTML = () =>
  new Response('<!doctype html><title>Offline</title><p style="font-family:sans-serif;padding:2rem">Offline: connection failed. Please check your connection and refresh.</p>', {
    status: 503,
    headers: { 'Content-Type': 'text/html' }
  });

const OFFLINE_TEXT = () =>
  new Response('Offline: connection failed.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain' }
  });

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Never cache API responses or dynamic endpoints.
  if (event.request.url.includes('/api/')) return;

  // Navigation requests are network-first: after a deploy the server serves a
  // fresh HTML shell with new hashed assets, so returning a stale precached
  // shell would 404. Fall back to cache only when offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return networkResponse;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || OFFLINE_HTML())
        )
    );
    return;
  }

  // Static assets: cache-first, populate on miss.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse.ok &&
            (event.request.url.includes('images') ||
              event.request.url.match(/\.(png|jpg|jpeg|gif|svg|ico|woff2?|css|js)$/))
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => OFFLINE_TEXT());
    })
  );
});