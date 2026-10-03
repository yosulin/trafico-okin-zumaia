/**
 * ============================================================
 *  SESIÓN — Firebase Authentication con cuenta de Google
 * ============================================================
 *  No hay usuarios "especiales" ni ningún uid escrito en el código:
 *  la app simplemente pregunta quién ha entrado. Quien no ha entrado
 *  no ve tarjetas (así lo exigen también las reglas de Firestore).
 *
 *  En móvil, y sobre todo con la app instalada, el popup de Google
 *  a veces está bloqueado; en ese caso se cae a la redirección.
 * ============================================================
 */

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import { auth } from "./firebase.js";

const proveedor = new GoogleAuthProvider();

/** Avisa cada vez que se entra o se sale. Devuelve la función para dejar de escuchar. */
export function alCambiarSesion(callback) {
  return onAuthStateChanged(auth, callback);
}

export function usuarioActual() {
  return auth.currentUser;
}

export async function entrar() {
  try {
    await signInWithPopup(auth, proveedor);
  } catch (error) {
    const bloqueado = [
      "auth/popup-blocked",
      "auth/popup-closed-by-user",
      "auth/cancelled-popup-request",
      "auth/operation-not-supported-in-this-environment"
    ].includes(error.code);
    if (!bloqueado) throw error;
    if (error.code === "auth/popup-closed-by-user") return; // lo ha cerrado a propósito
    await signInWithRedirect(auth, proveedor);
  }
}

export function salir() {
  return firebaseSignOut(auth);
}

/** Recoge el resultado si se volvió de una redirección; no molesta si no la hubo. */
export function recogerRedireccion() {
  return getRedirectResult(auth).catch(() => null);
}
