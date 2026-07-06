/**
 * ============================================================
 *  SERVICE WORKER — app shell offline
 * ============================================================
 *  Objetivo único: que la web (HTML/CSS/JS/iconos) cargue aunque
 *  no haya conexión, para que la app pueda abrirse y mostrar el
 *  último estado conocido (el que datos.js dejó en memoria la
 *  última vez que se pudo descargar data/historial.json).
 *
 *  El navegador nunca llama a TomTom directamente (eso lo hace un
 *  GitHub Action con su propia clave, ver README punto 4), así que
 *  este Service Worker no tiene ninguna API externa que gestionar:
 *  solo cachea los ficheros propios de la aplicación.
 *
 *  Para forzar que los usuarios con la app instalada descarguen
 *  la versión nueva de los ficheros, sube el número de aquí abajo
 *  (CACHE_NAME) y, por coherencia documental, también
 *  CONFIG.pwa.cacheVersion en config.js.
 * ============================================================
 */

const CACHE_NAME = "okin-traffic-v2";

const FICHEROS_APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/config.js",
  "./js/estado.js",
  "./js/datos.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(FICHEROS_APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((nombre) => nombre !== CACHE_NAME)
          .map((nombre) => caches.delete(nombre))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);

  // Nunca interceptar peticiones a la API de tráfico: deben ir
  // siempre a la red para tener datos actuales.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Tampoco interceptar el fichero de histórico compartido: cambia con
  // frecuencia (lo actualiza un GitHub Action) y se pide con un parámetro
  // de cache-busting distinto cada vez, así que cachearlo aquí solo
  // acumularía entradas sin límite sin aportar nada útil offline.
  if (url.pathname.includes("/data/historial.json")) {
    return;
  }

  // App shell: estrategia "cache primero, con actualización en segundo plano".
  evento.respondWith(
    caches.match(evento.request).then((respuestaCacheada) => {
      const fetchPromise = fetch(evento.request)
        .then((respuestaRed) => {
          if (respuestaRed && respuestaRed.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(evento.request, respuestaRed.clone()));
          }
          return respuestaRed;
        })
        .catch(() => respuestaCacheada); // sin red: nos quedamos con lo que había en caché

      return respuestaCacheada || fetchPromise;
    })
  );
});
