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
      // cache: 'reload' skips the browser HTTP cache so the offline copy is
      // the version just deployed, not an older file GitHub Pages let linger.
      .then(cache => cache.addAll(APP_ASSETS.map(url => new Request(url, { cache: 'reload' }))))
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

async function cacheResponse(request, response, alsoCacheAs = null) {
  if (!response || !response.ok || response.type === 'opaque') return response;

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  if (alsoCacheAs) await cache.put(alsoCacheAs, response.clone());
  return response;
}

function isAppShellNavigation(request) {
  const scopePath = new URL(self.registration.scope).pathname;
  const path = new URL(request.url).pathname;
  return path === scopePath || path === `${scopePath}index.html`;
}

async function networkFirst(request, { navigation = false } = {}) {
  // The app page is stored under one key as well, so an offline launch from
  // any URL shape (./, ./index.html, ./?source=homescreen) gets the newest
  // HTML instead of the copy saved when the worker was first installed.
  const shellKey = navigation && isAppShellNavigation(request) ? './index.html' : null;

  try {
    // Revalidate against GitHub Pages whenever the device is online rather than
    // allowing the browser HTTP cache to hide a newly deployed app asset.
    // A page load is fetched by its address rather than by re-wrapping the
    // browser's navigation request: Safari can refuse that, which left every
    // refresh on the page saved at install while the scripts kept updating.
    let response = navigation
      ? await fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' })
      : await fetch(request, { cache: 'no-cache' });
    // Safari will not show a page a worker answers with a redirected response.
    if (navigation && response.redirected) {
      response = new Response(await response.blob(), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }
    return await cacheResponse(request, response, shellKey);
  } catch (error) {
    const cached =
      (await caches.match(request, { ignoreSearch: navigation })) ||
      (navigation ? await caches.match('./index.html') : null);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, { navigation: true }));
    return;
  }

  // App code, styles, manifest and icons all use network-first. That means a
  // GitHub Pages deployment becomes visible on the next online load, while the
  // most recently successful copy remains available offline.
  event.respondWith(networkFirst(request));
});
