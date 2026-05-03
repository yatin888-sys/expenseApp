const CACHE_NAME = 'expensetracker-v4';
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
            try { await cache.addAll(urlsToCache); }
            catch (e) { console.warn('Cache addAll partial failure', e); }
        })()
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            // Purge ALL old caches (any non-current version)
            const keys = await caches.keys();
            await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
            await self.clients.claim();
        })()
    );
});

// Network-first for HTML and our own JS/CSS so updates always reach users.
// Cache-first for everything else (images, CDN libs once cached, etc.).
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    const sameOrigin = url.origin === self.location.origin;
    const isApp = sameOrigin && /\.(html|js|css|json)$/i.test(url.pathname);
    const isNavigation = req.mode === 'navigate';

    if (isNavigation || isApp) {
        // Network-first
        event.respondWith((async () => {
            try {
                const fresh = await fetch(req, { cache: 'no-store' });
                if (fresh && fresh.status === 200) {
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(req, fresh.clone());
                }
                return fresh;
            } catch (e) {
                const cached = await caches.match(req);
                if (cached) return cached;
                if (isNavigation) {
                    const fallback = await caches.match('./index.html');
                    if (fallback) return fallback;
                }
                throw e;
            }
        })());
        return;
    }

    // Cache-first for assets
    event.respondWith((async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
            const resp = await fetch(req);
            if (resp && resp.status === 200 && sameOrigin) {
                const cache = await caches.open(CACHE_NAME);
                cache.put(req, resp.clone());
            }
            return resp;
        } catch (e) { throw e; }
    })());
});

// Allow page to ask SW to update itself
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
