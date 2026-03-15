// Nafi's Dua List — Service Worker
// Cache-first strategy: serve offline instantly after first load

const CACHE_NAME = 'nafi-dua-list-v1';

// Files to cache on install
const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Scheherazade+New:wght@400;700&display=swap'
];

// ---- INSTALL: cache core assets ----
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ---- ACTIVATE: clean up old caches ----
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) { return caches.delete(name); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ---- FETCH: cache-first, fall back to network ----
self.addEventListener('fetch', function(event) {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and non-http(s) requests
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(function(cachedResponse) {
      if (cachedResponse) {
        // Serve from cache, update in background
        var networkFetch = fetch(event.request).then(function(networkResponse) {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
            var responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(function() { /* network failed — already served from cache */ });

        return cachedResponse;
      }

      // Not in cache — fetch from network and cache it
      return fetch(event.request).then(function(networkResponse) {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        // Don't cache opaque responses from third-party CDNs (except fonts)
        if (networkResponse.type === 'opaque') {
          return networkResponse;
        }

        var responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });

        return networkResponse;
      }).catch(function() {
        // Network failed and nothing in cache — return offline fallback
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
