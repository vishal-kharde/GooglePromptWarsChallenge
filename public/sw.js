/**
 * MonsoonGuard AI — Service Worker
 * Caches critical assets for offline checklist access.
 */

const CACHE_NAME    = 'monsoonguard-v3';
const OFFLINE_URL   = '/';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/css/components.css',
  '/css/animations.css',
  '/js/app.js',
  '/js/api.js',
  '/js/state.js',
  '/js/utils/storage.js',
  '/js/utils/sanitize.js',
  '/js/utils/location.js',
  '/js/utils/i18n.js',
  '/js/pages/dashboard.js',
  '/js/pages/plan.js',
  '/js/pages/checklist.js',
  '/js/pages/chat.js',
  '/js/pages/map.js',
  '/js/pages/shelters.js',
  '/js/pages/travel.js',
  '/js/pages/recovery.js',
  '/js/pages/profile.js',
  '/manifest.json',
];

// Install — cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network first for API, cache first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls — network only (no caching of sensitive data)
  if (url.pathname.startsWith('/api/')) {
    return; // Let the browser handle it natively
  }

  // Static assets — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});
