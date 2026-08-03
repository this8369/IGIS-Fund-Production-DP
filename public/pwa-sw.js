const CACHE_VERSION = 'iota-mobile-shell-v1';
const MOBILE_ENTRY = '/mobile';
const CORE_ASSETS = [
  MOBILE_ENTRY,
  '/manifest.webmanifest',
  '/icons/iota-app-icon-v2-180.png',
  '/icons/iota-app-icon-v2-192.png',
  '/icons/iota-app-icon-v2-512.png',
  '/fonts/Pretendard/pretendard.css'
];

const cacheResponse = async (cache, request, response) => {
  if (response?.ok) await cache.put(request, response.clone());
  return response;
};

const extractShellAssets = (html) => {
  const urls = new Set(CORE_ASSETS);
  const assetPattern = /(?:src|href)="([^"]+)"/g;
  let match;

  while ((match = assetPattern.exec(html)) !== null) {
    const url = new URL(match[1], self.location.origin);
    if (url.origin === self.location.origin) urls.add(url.pathname + url.search);
  }

  return [...urls];
};

const warmMobileShell = async () => {
  const cache = await caches.open(CACHE_VERSION);
  const response = await fetch(MOBILE_ENTRY, { cache: 'reload' });
  if (!response.ok) return;

  await cache.put(MOBILE_ENTRY, response.clone());
  const html = await response.text();
  const shellAssets = extractShellAssets(html).filter(url => url !== MOBILE_ENTRY);
  await Promise.allSettled(shellAssets.map(async (url) => {
    const assetResponse = await fetch(url, { cache: 'reload' });
    await cacheResponse(cache, url, assetResponse);
  }));
};

self.addEventListener('install', (event) => {
  event.waitUntil(warmMobileShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter(name => name.startsWith('iota-mobile-shell-') && name !== CACHE_VERSION)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

const navigationResponse = async (request) => {
  const cache = await caches.open(CACHE_VERSION);
  const cachedShell = await cache.match(MOBILE_ENTRY);
  const networkResponse = fetch(request)
    .then(response => cacheResponse(cache, MOBILE_ENTRY, response));

  if (!cachedShell) return networkResponse;

  const cachedFallback = new Promise(resolve => {
    setTimeout(() => resolve(cachedShell), 1200);
  });

  return Promise.race([networkResponse, cachedFallback]).catch(() => cachedShell);
};

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.origin === self.location.origin && url.pathname.startsWith('/mobile')) {
    event.respondWith(navigationResponse(request));
    return;
  }

  if (url.origin !== self.location.origin || request.method !== 'GET') return;
  if (!['script', 'style', 'font', 'image'].includes(request.destination)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    const response = await fetch(request);
    return cacheResponse(cache, request, response);
  })());
});
