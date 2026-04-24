const CACHE_NAME = 'cpces-cache-v1';

// Aquí ponemos los archivos de tu diseño que queremos que el celular guarde
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './alerta.mp3',
  './icon-192.png',
  './icon-512.png'
];

// 1. Durante la instalación, guarda los archivos básicos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Intercepta las peticiones (Modo: Red primero, luego caché)
self.addEventListener('fetch', event => {
  // Ignoramos las llamadas a la base de datos de Google Apps Script 
  // para que siempre traiga datos en vivo y nunca datos viejos.
  if (event.request.url.includes('script.google.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      // Si no hay internet, busca en el caché
      return caches.match(event.request);
    })
  );
});

// 3. Limpia cachés viejos si actualizas la versión
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});