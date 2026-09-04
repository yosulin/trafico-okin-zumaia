/**
 * ============================================================
 *  SERVICE WORKER — vocabulario offline
 * ============================================================
 *  Esta app no llama a ninguna API: todo lo que necesita son sus
 *  propios ficheros (HTML, CSS, JS, el JSON de vocabulario y las
 *  ilustraciones). Con cachearlos todos, funciona sin conexión.
 *
 *  Estrategia:
 *   - Ficheros propios → caché primero, y se refresca en segundo
 *     plano para que la próxima apertura ya tenga lo nuevo.
 *   - Tipografías de Google → se guardan según se van pidiendo
 *     (así la app también se ve bien sin red la segunda vez).
 *
 *  Al publicar cambios, sube el número de CACHE_NAME.
 * ============================================================
 */

const CACHE_NAME = "vocabulario-okin-v1";

const FICHEROS_APP = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/estilos.css",
  "./js/audio.js",
  "./js/progreso.js",
  "./js/datos.js",
  "./js/app.js",
  "./data/vocabulario.json",
  "./images/animals_dog.svg",
  "./images/animals_cat.svg",
  "./images/food_apple.svg",
  "./images/school_book.svg",
  "./images/family_sister.svg",
  "./images/school_teacher.svg",
  "./images/feelings_happy.svg",
  "./images/actions_play.svg",
  "./images/colors_red.svg",
  "./images/weather_rain.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(FICHEROS_APP))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(
        nombres
          .filter((nombre) => nombre.startsWith("vocabulario-okin-") && nombre !== CACHE_NAME)
          .map((nombre) => caches.delete(nombre))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  if (evento.request.method !== "GET") return;

  const url = new URL(evento.request.url);
  const esPropio = url.origin === self.location.origin;
  const esTipografia = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";

  if (!esPropio && !esTipografia) return;

  evento.respondWith(
    caches.match(evento.request).then((cacheada) => {
      const desdeRed = fetch(evento.request)
        .then((respuesta) => {
          if (respuesta && (respuesta.ok || respuesta.type === "opaque")) {
            const copia = respuesta.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(evento.request, copia));
          }
          return respuesta;
        })
        .catch(() => cacheada);

      return cacheada || desdeRed;
    })
  );
});
