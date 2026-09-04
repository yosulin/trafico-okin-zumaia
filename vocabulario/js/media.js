/**
 * ============================================================
 *  MEDIA — resolver rutas de Firebase Storage
 * ============================================================
 *  En Firestore guardamos RUTAS, no URLs:
 *
 *      imagePath: "images/animals/animals_dog.svg"
 *
 *  Así el contenido no depende de tokens de descarga que pueden
 *  regenerarse, y mover el proyecto de bucket no obliga a reescribir
 *  las tarjetas.
 *
 *  La URL de descarga se pide a Storage la primera vez y se guarda en
 *  localStorage: en las siguientes aperturas (y sin conexión) la app
 *  ya tiene la URL, y el fichero en sí lo sirve el service worker
 *  desde su caché.
 * ============================================================
 */

import { ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { storage } from "./firebase.js";

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
 * URL de descarga de una ruta de Storage.
 * Devuelve null si la tarjeta no tiene ese medio o si no se puede
 * resolver (sin conexión y sin caché, fichero que aún no se ha subido...).
 * Quien llama decide qué hacer entonces: la imagen se queda vacía y el
 * audio se sintetiza con la voz del navegador.
 */
export async function urlDe(ruta) {
  if (!ruta) return null;
  if (cache[ruta]) return cache[ruta];

  try {
    const url = await getDownloadURL(ref(storage, ruta));
    cache[ruta] = url;
    guardar();
    return url;
  } catch (error) {
    return null;
  }
}

/** Pide varias rutas a la vez (para ir adelantando la siguiente tarjeta). */
export function precargar(rutas) {
  return Promise.all((rutas || []).filter(Boolean).map(urlDe));
}

export function olvidarUrls() {
  cache = {};
  try { window.localStorage.removeItem(CLAVE); } catch (error) { /* nada */ }
}
