const CACHE = 'gym-tracker-shell-v2';
const ASSETS = ['/index.html', '/manifest.json', '/icons/arc-fit.svg', '/icons/arc-fit-192.png', '/icons/arc-fit-512.png', '/icons/arc-fit-maskable-512.png'];

// Wait for old tabs to close before activation; do not mix releases mid-session.
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('gym-tracker-') && key !== CACHE).map(key => caches.delete(key)),
  )));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cached = await caches.match('/index.html', { cacheName: CACHE });
      return cached || Response.error();
    }));
    return;
  }
  // Cache only public build assets, never auth/API responses or private media.
  if (!url.pathname.startsWith('/assets/')) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  }));
});
