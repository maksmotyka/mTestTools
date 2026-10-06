// =============================================================================
// SERVICE WORKER - działanie offline
// Wersja cache pochodzi z js/about-content.js - przy wydaniu nie trzeba
// zmieniać tego pliku. Wymaga aktualizacji tylko przy dodaniu nowych plików
// (np. nowej planszy) do list APP_FILES / ASSET_FILES.
// =============================================================================

// about-content.js zapisuje dane do window.ABOUT_CONTENT, a w workerze nie ma window
self.window = self;
importScripts('js/about-content.js');

const CACHE_PREFIX = 'mtt-';
const CACHE_NAME = CACHE_PREFIX + self.ABOUT_CONTENT.version;

// Logika klienta - serwowana "najpierw sieć", żeby online zawsze była świeża
const APP_FILES = [
    './',
    'index.html',
    'manifest.json',
    'css/common.css',
    'js/about-content.js',
    'js/patterns/pattern-utils.js',
    'js/patterns/ebu-bars.js',
    'js/patterns/smpte-rp219.js',
    'js/patterns/test-card.js',
    'js/patterns/geometry.js',
    'js/patterns/grayscale.js',
    'js/patterns/full-field.js',
    'js/audio-engine.js',
    'js/av-sync.js',
    'js/ident-indicator.js',
    'js/overlay.js',
    'js/app.js'
];

// Grafiki - serwowane "najpierw cache"
const ASSET_FILES = [
    'assets/favicon-16x16.png',
    'assets/favicon-32x32.png',
    'assets/apple-touch-icon.png',
    'assets/icon-192.png',
    'assets/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        // Każdy plik osobno - brak jednego pliku nie blokuje instalacji całości
        const files = [...APP_FILES, ...ASSET_FILES];
        const results = await Promise.allSettled(
            files.map(url => cache.add(new Request(url, { cache: 'reload' })))
        );
        results.forEach((r, i) => {
            if (r.status === 'rejected') {
                console.warn('[SW] Nie udało się zapisać w cache:', files[i]);
            }
        });
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        // Usuń cache poprzednich wersji
        const keys = await caches.keys();
        await Promise.all(
            keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
                .map(key => caches.delete(key))
        );
        await self.clients.claim();
    })());
});

// Klucz cache bez parametrów (?pattern=..., ?kiosk=1 itd.)
function cacheKey(request) {
    const url = new URL(request.url);
    url.search = '';
    return url.href;
}

async function networkFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(cacheKey(request), response.clone());
        }
        return response;
    } catch (err) {
        const cached = await cache.match(cacheKey(request));
        if (cached) return cached;
        // Nawigacja offline na nieznany adres - zwróć stronę główną
        if (request.mode === 'navigate') {
            const index = await cache.match(new URL('index.html', self.registration.scope).href);
            if (index) return index;
        }
        throw err;
    }
}

async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(cacheKey(request));
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) {
        cache.put(cacheKey(request), response.clone());
    }
    return response;
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;

    const isAsset = /\.(png|ico|webp|svg)$/i.test(url.pathname);
    event.respondWith(isAsset ? cacheFirst(request) : networkFirst(request));
});
