/**
 * ============================================================
 *  SERVICE WORKER — offline razonable, sin complicaciones
 * ============================================================
 *  Tres cachés con reglas distintas, porque tres cosas distintas:
 *
 *   1. SHELL (HTML, CSS, JS propios e iconos): se precachean en la
 *      instalación y se sirven primero desde caché, refrescándose en
 *      segundo plano. Es lo que hace que la app abra sin red.
 *
 *   2. VENDOR (SDK de Firebase y tipografías): se van guardando según
 *      se piden. Van con versión fija en la URL, así que no caducan.
 *
 *   3. MEDIA (imágenes y audios): en el modo "hosting" son ficheros
 *      propios y van con el shell; en el modo "storage" los sirve
 *      Firebase Storage y se guardan según se usan, así que una
 *      tarjeta ya vista vuelve a funcionar sin conexión.
 *
 *  Lo que NO se toca aquí: las llamadas a Firestore y a Identity
 *  Toolkit (login). Firestore ya trae su propia persistencia y su
 *  propia cola de escrituras pendientes; interceptarlas solo podría
 *  romperlas.
 *
 *  La versión la pone quien lo registra, en la URL: así este
 *  fichero no cambia en cada despliegue.
 * ============================================================
 */

/* La versión llega en la URL con la que se registra el service worker
   (service-worker.js?v=0.6.0+abc1234), no clavada en el fichero.

   Dos cosas se arreglan con esto: el sello del despliegue deja de
   reescribir un fichero versionado —lo que hacía chocar cada git pull
   después de cada deploy— y el navegador ve una URL distinta en cada
   versión, que es justo lo que le hace instalar el service worker
   nuevo en lugar de quedarse con el viejo. */
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_SHELL = "vocabulario-okin-shell-" + VERSION;
const CACHE_VENDOR = "vocabulario-okin-vendor-" + VERSION;
const CACHE_MEDIA = "vocabulario-okin-media-" + VERSION;

const NUESTRAS_CACHES = [CACHE_SHELL, CACHE_VENDOR, CACHE_MEDIA];

const FICHEROS_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/estilos.css",
  "./js/app.js",
  "./js/version.js",
  "./js/i18n.js",
  "./js/modulos.js",
  "./js/navegacion.js",
  "./js/matemagia.js",
  "./js/firebase.js",
  "./js/firebase-config.js",
  "./js/sesion.js",
  "./js/datos.js",
  "./js/progreso.js",
  "./js/media.js",
  "./js/audio.js",
  "./media/images/animals/animals_dog.svg",
  "./media/images/animals/animals_cat.svg",
  "./media/images/food/food_apple.svg",
  "./media/images/school/school_book.svg",
  "./media/images/school/school_teacher.svg",
  "./media/images/family/family_sister.svg",
  "./media/images/feelings/feelings_happy.svg",
  "./media/images/actions/actions_play.svg",
  "./media/images/colors/colors_red.svg",
  "./media/images/weather/weather_rain.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_SHELL)
      /* Uno a uno: si falta algún fichero, el resto se cachea igual
         (addAll aborta entero al primer fallo). */
      .then((cache) => Promise.all(
        FICHEROS_SHELL.map((fichero) => cache.add(fichero).catch(() => null))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(
        nombres
          .filter((nombre) => nombre.startsWith("vocabulario-okin-") && !NUESTRAS_CACHES.includes(nombre))
          .map((nombre) => caches.delete(nombre))
      ))
      .then(() => self.clients.claim())
  );
});

/** Caché primero, y de paso se refresca para la próxima vez. */
function cachePrimero(peticion, nombreCache) {
  return caches.match(peticion).then((cacheada) => {
    const desdeRed = fetch(peticion)
      .then((respuesta) => {
        if (respuesta && (respuesta.ok || respuesta.type === "opaque")) {
          const copia = respuesta.clone();
          caches.open(nombreCache).then((cache) => cache.put(peticion, copia));
        }
        return respuesta;
      })
      .catch(() => cacheada);

    return cacheada || desdeRed;
  });
}

self.addEventListener("fetch", (evento) => {
  if (evento.request.method !== "GET") return;

  const url = new URL(evento.request.url);

  /* La versión publicada se pide siempre a la red: es justo lo que
     sirve para saber si la copia cacheada se ha quedado atrás. */
  if (url.pathname.endsWith("/version.json")) return;

  if (url.origin === self.location.origin) {
    evento.respondWith(cachePrimero(evento.request, CACHE_SHELL));
    return;
  }

  const esVendor =
    url.hostname === "www.gstatic.com" ||
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com";

  if (esVendor) {
    evento.respondWith(cachePrimero(evento.request, CACHE_VENDOR));
    return;
  }

  /* Imágenes y audios de Firebase Storage. */
  const esMedia =
    url.hostname === "firebasestorage.googleapis.com" ||
    url.hostname.endsWith(".firebasestorage.app");

  if (esMedia) {
    evento.respondWith(cachePrimero(evento.request, CACHE_MEDIA));
    return;
  }

  /* Todo lo demás (Firestore, login de Google...) va directo a la red. */
});
