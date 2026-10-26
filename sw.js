// Service Worker — DeCA Manager
const CACHE_NAME = 'deca-manager-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/supabase-config.js',
  '/js/auth.js',
  '/js/app.js',
  '/js/usuarios.js',
  '/manifest.json',
  '/icons/icon.svg'
];

// Install
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — Network first, cache fallback
self.addEventListener('fetch', (e) => {
  // No cachear peticiones a Supabase
  if (e.request.url.includes('supabase')) return;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
