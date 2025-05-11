const CACHE_NAME = 'weather-app-cache-v1';
const STATIC_ASSETS = [
  '/weather/',
  '/weather/index.html',
  '/weather/locations.html',
  '/weather/settings.html',
  '/weather/css/style.css',
  '/weather/js/app.js',
  '/weather/js/weather.js',
  '/weather/js/locations.js',
  '/weather/js/settings.js',
  '/weather/manifest.json',
  '/weather/images/favicon-16x16.png',
  '/weather/images/favicon-32x32.png',
  '/weather/images/apple-touch-icon.png',
  '/weather/images/favicon.ico',
  '/weather/images/icon-192x192.png',
  '/weather/images/icon-512x512.png'
];

// Instalacja Service Workera
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(STATIC_ASSETS);
      })
  );
});

// Aktywacja Service Workera
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Removing old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Obsługa zapytań
self.addEventListener('fetch', (event) => {
  // Wykluczamy zapytania do API pogodowego
  if (event.request.url.includes('api.openweathermap.org')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Zwracamy z cache jeśli istnieje
        if (response) {
          return response;
        }
        
        // Klonujemy zapytanie, bo może być wykorzystane tylko raz
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest)
          .then((response) => {
            // Sprawdzamy czy odpowiedź jest poprawna
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Klonujemy odpowiedź, bo może być wykorzystana tylko raz
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          });
      })
      .catch(() => {
        // Jeśli jesteśmy offline i żądamy strony HTML, pokazujemy stronę offline
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('offline.html');
        }
      })
  );
});