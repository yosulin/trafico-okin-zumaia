/**
 * ============================================================
 *  MEDIA — de una ruta a una URL que el navegador pueda pedir
 * ============================================================
 *  En Firestore guardamos SIEMPRE rutas, nunca URLs:
 *
 *      imagePath: "images/animals/animals_dog.svg"
 *
 *  Así el contenido no depende de tokens de descarga que pueden
 *  regenerarse, y cambiar de sitio los ficheros no obliga a reescribir
 *  ni una tarjeta.
 *
 *  De dónde salen esos ficheros lo decide una sola opción,
 *  "medios", en firebase-config.js:
 *
 *    "hosting"  →  se sirven con la propia app, desde ./media/
 *                  (Firebase Storage exige plan de pago, así que este
 *                  es el modo del prototipo)
 *
 *    "storage"  →  se piden a Firebase Storage
 *
 *  Cambiar de uno a otro es cambiar esa palabra: ni las tarjetas ni la
 *  interfaz se enteran. El importador sube los mismos ficheros con la
 *  misma estructura a Storage cuando llegue el momento.
 * ============================================================
 */

import { opciones } from "./firebase-config.js";

const ORIGEN = (opciones && opciones.medios) || "hosting";
const CARPETA_LOCAL = "./media/";

const CLAVE = "vocabulario-okin-urls-v1";

let cache = leer();

function leer() {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    const datos = crudo ? JSON.parse(crudo) : {};
    return (datos && typeof datos === "object") ? datos : {};
  } catch (error) {
    return {};
  }
}

function guardar() {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(cache));
  } catch (error) {
    /* Sin almacenamiento: seguimos con la copia en memoria. */
  }
}

/**
 * Pide a Firebase Storage la URL de descarga y la recuerda en
 * localStorage: en las siguientes aperturas (y sin conexión) ya la
 * tenemos, y el fichero lo sirve el service worker desde su caché.
 */
async function urlDeStorage(ruta) {
  if (cache[ruta]) return cache[ruta];

  try {
    const [{ getStorage, ref, getDownloadURL }, { app }] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js"),
      import("./firebase.js")
    ]);
    const url = await getDownloadURL(ref(getStorage(app), ruta));
    cache[ruta] = url;
    guardar();
    return url;
  } catch (error) {
    return null;
  }
}

/**
 * URL de un medio a partir de su ruta.
 * Devuelve null si la tarjeta no tiene ese medio o si no se puede
 * resolver. Quien llama decide qué hacer entonces: la imagen se queda
 * vacía y el audio se sintetiza con la voz del navegador.
 */
export async function urlDe(ruta) {
  if (!ruta) return null;
  if (ORIGEN === "storage") return urlDeStorage(ruta);
  return CARPETA_LOCAL + ruta;
}

/** Pide varias rutas a la vez (para ir adelantando la siguiente tarjeta). */
export function precargar(rutas) {
  return Promise.all((rutas || []).filter(Boolean).map(urlDe));
}

export function olvidarUrls() {
  cache = {};
  try { window.localStorage.removeItem(CLAVE); } catch (error) { /* nada */ }
}
