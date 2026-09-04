/**
 * ============================================================
 *  FIREBASE — inicialización única
 * ============================================================
 *  Todo el resto de la app pide aquí sus servicios. Se usa el SDK
 *  modular por CDN (sin build step, igual que el resto del repo);
 *  la versión va fijada a propósito para que el service worker
 *  pueda cachearla y para que una actualización del SDK no rompa
 *  la app sin avisar.
 *
 *  Firestore se inicializa con caché persistente: eso nos da, sin
 *  escribir ni una línea más, las tarjetas ya descargadas offline y
 *  una cola de escrituras de progreso que se envía sola cuando
 *  vuelve la conexión.
 * ============================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

/* La configuración vive fuera del repositorio: ver firebase-config.example.js */
let firebaseConfig;
try {
  ({ firebaseConfig } = await import("./firebase-config.js"));
} catch (error) {
  throw new Error(
    "Falta js/firebase-config.js. Cópialo de js/firebase-config.example.js " +
    "o genéralo con: node tools/generar-config.mjs"
  );
}

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export const storage = getStorage(app);
