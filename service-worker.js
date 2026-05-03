const CACHE_NAME = 'expensetracker-v3';
const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './db.js',
    './manifest.json',
    './icon-192x192.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            try {
                await cache.addAll(urlsToCache);
            } catch (e) {
                console.warn('Cache addAll partial failure', e);
            }
        })()
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
            await self.clients.claim();
        })()
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    event.respondWith(
        (async () => {
            // Cache-first for our same-origin assets
            const cached = await caches.match(req);
            if (cached) return cached;
            try {
                const resp = await fetch(req);
                // Optionally cache successful same-origin responses
                if (resp && resp.status === 200 && new URL(req.url).origin === self.location.origin) {
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(req, resp.clone());
                }
                return resp;
            } catch (e) {
                // Fallback to root for navigation requests when offline
                if (req.mode === 'navigate') {
                    const fallback = await caches.match('./index.html');
                    if (fallback) return fallback;
                }
                throw e;
            }
        })()
    );
});
