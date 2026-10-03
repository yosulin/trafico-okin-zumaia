/**
 * ============================================================
 *  PROGRESO — por usuario, en Firestore
 * ============================================================
 *      users/{uid}/progress/{cardId}
 *
 *      { status, seenCount, knownCount, reviewCount, lastSeen, updatedAt }
 *
 *  Cuatro estados y nada más (todavía no hay SRS):
 *
 *      new       nunca abierta
 *      learning  la ha visto, aún no dice saberla
 *      known     pulsó "La sabía"
 *      review    pulsó "Repasar"
 *
 *  Se escribe con setDoc(merge) + increment(): si no hay conexión,
 *  Firestore encola la escritura y la envía sola al volver la red.
 *  Por eso la app no lleva ninguna cola propia de pendientes.
 *
 *  Además guardamos una copia en memoria para que la interfaz responda
 *  al instante sin esperar a la ida y vuelta al servidor.
 * ============================================================
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import { db } from "./firebase.js";

export const ESTADOS = {
  NUEVA: "new",
  APRENDIENDO: "learning",
  CONOCIDA: "known",
  REPASO: "review"
};

let uidActual = null;
let cache = {};

function coleccion() {
  return collection(db, "users", uidActual, "progress");
}

function documento(cardId) {
  return doc(db, "users", uidActual, "progress", cardId);
}

/** Descarga el progreso del usuario que acaba de entrar. */
export async function cargar(uid) {
  uidActual = uid;
  cache = {};
  const respuesta = await getDocs(coleccion());
  respuesta.docs.forEach((registro) => { cache[registro.id] = registro.data(); });
  return cache;
}

export function olvidar() {
  uidActual = null;
  cache = {};
}

export function estado(cardId) {
  const registro = cache[cardId];
  return (registro && registro.status) || ESTADOS.NUEVA;
}

/** Recuento por estado sobre una lista de tarjetas. */
export function resumen(tarjetas) {
  const cuenta = { new: 0, learning: 0, known: 0, review: 0 };
  tarjetas.forEach((tarjeta) => { cuenta[estado(tarjeta.id)] += 1; });
  return cuenta;
}

/**
 * Escribe en Firestore y actualiza la copia local.
 * No esperamos a que termine: si falla o no hay red, la escritura queda
 * encolada y la niña no ve ningún parón.
 */
function escribir(cardId, cambios, contadores) {
  if (!uidActual) return;

  const anterior = cache[cardId] || { seenCount: 0, knownCount: 0, reviewCount: 0 };
  cache[cardId] = Object.assign({}, anterior, cambios, {
    seenCount: (anterior.seenCount || 0) + (contadores.seenCount || 0),
    knownCount: (anterior.knownCount || 0) + (contadores.knownCount || 0),
    reviewCount: (anterior.reviewCount || 0) + (contadores.reviewCount || 0)
  });

  const carga = Object.assign({}, cambios, { updatedAt: serverTimestamp() });
  Object.keys(contadores).forEach((clave) => {
    if (contadores[clave]) carga[clave] = increment(contadores[clave]);
  });

  setDoc(documento(cardId), carga, { merge: true })
    .catch(() => { /* queda encolado por la caché persistente de Firestore */ });
}

/** Al abrir una tarjeta: cuenta la vista y, si era nueva, pasa a "learning". */
export function marcarVista(cardId) {
  const eraNueva = estado(cardId) === ESTADOS.NUEVA;
  escribir(
    cardId,
    Object.assign({ lastSeen: serverTimestamp() }, eraNueva ? { status: ESTADOS.APRENDIENDO } : {}),
    { seenCount: 1 }
  );
}

/** "La sabía" / "Repasar". */
export function marcar(cardId, nuevoEstado) {
  const contadores = nuevoEstado === ESTADOS.CONOCIDA
    ? { knownCount: 1 }
    : { reviewCount: 1 };
  escribir(cardId, { status: nuevoEstado }, contadores);
}

/** "Empezar de cero": borra el progreso del usuario, no el contenido. */
export async function reiniciar() {
  if (!uidActual) return;
  const ids = Object.keys(cache);
  cache = {};
  await Promise.all(ids.map((cardId) => deleteDoc(documento(cardId)).catch(() => null)));
}
