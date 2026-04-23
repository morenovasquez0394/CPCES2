// service-worker.js
const CACHE_NAME = 'cpces-chofer-v1';
const urlsToCache = [
  '/chofer', // La URL de inicio de tu módulo
  // Aquí puedes añadir rutas a CSS, JS o imágenes importantes
  // '/css/style.css',
  // '/js/main.js'
];

// Evento Install: Guarda archivos estáticos en caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Archivos en caché');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento Fetch: Intercepta peticiones de red
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Devuelve desde la caché si existe, sino, ve a la red
        return response || fetch(event.request);
      })
  );
});
