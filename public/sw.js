// Intentionally versioned and committed with the app so clean deployments always expose /sw.js.
const STATIC_CACHE_NAME = 'fintechterms-static-v4';
const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
    OFFLINE_URL,
    '/manifest.json',
    '/home-logo.png',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
];

const isSameOriginGetRequest = (requestUrl, requestMethod) => (
    requestMethod === 'GET'
    && requestUrl.origin === self.location.origin
);

const isStaticAsset = (pathname) => (
    pathname.startsWith('/_next/static/')
    || /\.(?:css|js|png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(pathname)
);

const isMutableRoute = (pathname) => (
    pathname.startsWith('/api/')
    || pathname.startsWith('/_next/data/')
    || pathname === '/sitemap.xml'
    || pathname === '/robots.txt'
    || pathname.endsWith('.json')
);

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => Promise.all(
            cacheNames
                .filter((cacheName) => cacheName !== STATIC_CACHE_NAME)
                .map((cacheName) => caches.delete(cacheName))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    if (!isSameOriginGetRequest(requestUrl, event.request.method)) {
        return;
    }

    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(async () => {
                const cachedOfflinePage = await caches.match(OFFLINE_URL);
                return cachedOfflinePage || Response.error();
            })
        );
        return;
    }

    if (isMutableRoute(requestUrl.pathname)) {
        return;
    }

    if (!isStaticAsset(requestUrl.pathname)) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse.ok) {
                    return networkResponse;
                }

                const responseClone = networkResponse.clone();
                void caches.open(STATIC_CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });

                return networkResponse;
            });
        })
    );
});
