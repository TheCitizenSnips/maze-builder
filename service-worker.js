const CACHE_NAME = 'maze-builder-runtime';

const APP_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-32.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon-app-128.png'
];

// Exact cache names used by earlier Maze Builder releases. Cache Storage is
// origin-wide, so intentionally avoid deleting unrelated caches.
const LEGACY_CACHE_NAMES = new Set([
  'maze-builder-v1',
  'maze-builder-modern-v1',
  'maze-builder-ios-v1',
  'maze-builder-ios-animated-v1',
  'maze-builder-ios-pencil-v1'
]);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => LEGACY_CACHE_NAMES.has(key))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function cacheResponse(request, response) {
  if (!response || !response.ok || response.type === 'opaque') return response;

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, fallbackRequest = request) {
  try {
    // Revalidate against GitHub Pages whenever the device is online rather than
    // allowing the browser HTTP cache to hide a newly deployed app asset.
    const response = await fetch(request, { cache: 'no-cache' });
    return await cacheResponse(request, response);
  } catch (_) {
    const cached = await caches.match(fallbackRequest);
    if (cached) return cached;
    throw _;
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }

  // App code, styles, manifest and icons all use network-first. That means a
  // GitHub Pages deployment becomes visible on the next online load, while the
  // most recently successful copy remains available offline.
  event.respondWith(networkFirst(request));
});
