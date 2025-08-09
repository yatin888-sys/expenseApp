const CACHE_NAME = 'expensetrackercachev2';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './adddata.js', // Add all your JavaScript files here
  './getdata.js',
  './globals.js',
  './index.js',
  './moddata.js',
  './myDB.js',
  './manifest.json',
  './add_exp.png',
  './mod_exp.png',
  './sum_exp.png',
  './savings.png',
  './icon-192x192.png'
];

// Install a service worker
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      console.log('Opened cache');
      await cache.addAll(urlsToCache);
    })()
  );
  
});

// Cache and return requests
self.addEventListener('fetch', event => {
  event.respondWith(
    (async () => {
      const response = await caches.match(event.request);
      // Cache hit - return response
      if (response) {
        return response;
      }
      return fetch(event.request);
    })()
  );
});

// Update a service worker
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })()
  );

});
