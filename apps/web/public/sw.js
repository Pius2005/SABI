/* SABI service worker: app shell + safe public API caching.
 * Authenticated API responses are never cached. Lesson bundles are stored by
 * the app itself (localStorage) so they survive a full offline restart.
 */
const VERSION = 'sabi-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon.svg', '/icons/maskable.svg'];
const PUBLIC_API = /\/api\/v1\/(config|health|paths$|ui-strings\/|scam\/examples)/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, fallbackToShell) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackToShell) {
      const shell = (await cache.match('/index.html')) || (await cache.match('/'));
      if (shell) return shell;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    if (PUBLIC_API.test(url.pathname)) {
      event.respondWith(networkFirst(request, false));
    }
    // Authenticated API traffic always goes straight to the network.
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, true));
    return;
  }

  event.respondWith(cacheFirst(request));
});
