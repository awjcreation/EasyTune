const APP_VERSION = '1.0';
const CACHE_NAME = 'easytune-offline-1.0';

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './manifest.json',
  './sw.js',
  './assets/easytune-logo.png',
  './icons/favicon.ico',
  './icons/apple-touch-icon.png',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png'
];

function abs(path) {
  return new URL(path, self.registration.scope).href;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const path of APP_SHELL) {
      try {
        const request = new Request(abs(path), { cache: 'reload' });
        const response = await fetch(request);
        if (response && response.ok) await cache.put(request, response.clone());
      } catch (error) {
        // Do not abort install because of one optional asset. index/app/css are checked below.
      }
    }

    const index = await cache.match(abs('./index.html')) || await cache.match(abs('./'));
    const app = await cache.match(abs('./app.js'));
    const css = await cache.match(abs('./styles.css'));
    if (!index || !app || !css) {
      throw new Error('EasyTune offline cache is incomplete');
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => key === CACHE_NAME ? undefined : caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function cachedIndex() {
  return await caches.match(abs('./index.html'), { ignoreSearch: true }) ||
         await caches.match(abs('./'), { ignoreSearch: true });
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok && new URL(request.url).origin === self.location.origin) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    if (request.destination === 'document' || request.mode === 'navigate') {
      const index = await cachedIndex();
      if (index) return index;
    }
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith((async () => {
      const index = await cachedIndex();
      if (index) return index;
      try {
        const response = await fetch(event.request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(abs('./index.html'), response.clone());
        }
        return response;
      } catch (error) {
        return new Response('<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EasyTune offline</title><body style="font-family:sans-serif;background:#26262a;color:white;padding:24px">EasyTune nie jest jeszcze zapisana offline. Uruchom aplikację raz przy włączonym serwerze i poczekaj kilka sekund.</body></html>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
          status: 200
        });
      }
    })());
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
