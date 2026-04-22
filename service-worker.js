const CACHE_NAME = 'cpces-app-v1';

// Cuando la app se instala en el celular, guarda estos archivos en su memoria
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                './',
                './index.html',
                './manifest.json'
            ]);
        })
    );
});

// Cuando la app pide datos, intenta descargarlos, si no hay red, usa los guardados
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});