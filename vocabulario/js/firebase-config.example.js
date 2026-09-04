/**
 * ============================================================
 *  CONFIGURACIÓN DE FIREBASE — plantilla
 * ============================================================
 *  Copia este fichero como js/firebase-config.js y rellena los
 *  valores de tu proyecto (Consola de Firebase → Configuración del
 *  proyecto → Tus apps → App web).
 *
 *      cp js/firebase-config.example.js js/firebase-config.js
 *
 *  o, si prefieres partir de variables de entorno:
 *
 *      cp .env.example .env    (y rellenarlo)
 *      node tools/generar-config.mjs
 *
 *  js/firebase-config.js está en .gitignore a propósito. Estos
 *  valores NO son secretos —viajan en cualquier app web de Firebase
 *  y quien abra la página los verá—, pero así cada quien apunta a su
 *  propio proyecto sin tocar el repositorio. Lo que de verdad protege
 *  los datos son las reglas de Firestore y de Storage
 *  (firebase/firestore.rules y firebase/storage.rules).
 *
 *  Los secretos de verdad (la clave de la cuenta de servicio que usa
 *  el importador) NUNCA van aquí: ver tools/import/README.md.
 * ============================================================
 */

export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "TU-PROYECTO.firebaseapp.com",
  projectId: "TU-PROYECTO",
  storageBucket: "TU-PROYECTO.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000"
};
