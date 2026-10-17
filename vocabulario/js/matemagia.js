/**
 * ============================================================
 *  MATEMAGIA — cálculo con método ABN
 * ============================================================
 *  Tres retos, al nivel de 4º de primaria:
 *
 *    tablas   las tablas del 1 al 10, que ya se sabe: aquí se trata
 *             de ganar velocidad y de ver cuáles cojean.
 *    sumas    suma ABN: completar la decena y sumar lo que sobra.
 *               37 + 8  →  37 +3 → 40 +5 → 45
 *    restas   resta ABN: bajar hasta la decena y quitar lo que queda.
 *               52 - 7  →  52 -2 → 50 -5 → 45
 *
 *  La diferencia con un ejercicio normal está en QUÉ se pregunta. En
 *  ABN no se pide el resultado y ya: se pide cada salto, que es donde
 *  está el razonamiento. Por eso la pantalla enseña la recta con los
 *  saltos y va preguntando uno a uno.
 *
 *  El progreso vive en users/{uid}/mates/{reto}, separado del de las
 *  tarjetas, y guarda aciertos y fallos por tabla para poder pintar
 *  cuáles están verdes y cuáles no.
 * ============================================================
 */

import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import { db } from "./firebase.js";
import { t } from "./i18n.js";

const PREGUNTAS_POR_RONDA = 10;

/* El nombre y la descripción salen de i18n.js, con las claves
   "mates.<id>.nombre" y "mates.<id>.que". */
export const RETOS = [
  { id: "tablas", icono: "✖️" },
  { id: "sumas", icono: "➕" },
  { id: "restas", icono: "➖" }
];

export function nombreDeReto(id) {
  return t("mates." + id + ".nombre");
}

export function queHaceReto(id) {
  return t("mates." + id + ".que");
}

/* ============================================================
   GENERADORES DE EJERCICIOS
   Cada uno devuelve el enunciado y la lista de pasos que hay que
   ir preguntando. Un paso normal ("¿cuánto es 40 + 5?") y un paso
   ABN ("¿cuánto le falta a 37 para llegar a 40?") se preguntan
   igual: cambia el texto, no el mecanismo.
   ============================================================ */

function alAzar(desde, hasta) {
  return desde + Math.floor(Math.random() * (hasta - desde + 1));
}

/** a × b, con a de la tabla elegida (o de cualquiera). */
function ejercicioTabla(tabla) {
  const a = tabla || alAzar(1, 10);
  const b = alAzar(1, 10);
  return {
    reto: "tablas",
    tabla: a,
    enunciado: a + " × " + b,
    saltos: [],
    pasos: [
      { pregunta: a + " × " + b, respuesta: a * b }
    ]
  };
}

/** Suma que cruza la decena: 37 + 8. */
function ejercicioSuma() {
  const decena = alAzar(1, 8) * 10;
  const unidad = alAzar(1, 9);
  const primero = decena + unidad;
  const falta = 10 - unidad;
  const segundo = alAzar(falta + 1, 9);   /* obliga a cruzar la decena */
  const redondo = primero + falta;
  const sobra = segundo - falta;

  return {
    reto: "sumas",
    enunciado: primero + " + " + segundo,
    saltos: [primero, redondo, primero + segundo],
    pasos: [
      {
        pregunta: t("mates.sumaPaso1", { a: primero, b: redondo }),
        ayuda: t("mates.sumaPaso1Ayuda"),
        respuesta: falta
      },
      {
        pregunta: t("mates.sumaPaso2", { a: falta }),
        ayuda: t("mates.sumaPaso2Ayuda", { n: segundo }),
        respuesta: sobra
      },
      {
        pregunta: redondo + " + " + sobra,
        ayuda: t("mates.pasoFinalAyuda"),
        respuesta: primero + segundo
      }
    ]
  };
}

/** Resta que cruza la decena: 52 - 7. */
function ejercicioResta() {
  const decena = alAzar(2, 9) * 10;
  const unidad = alAzar(1, 8);
  const primero = decena + unidad;
  const segundo = alAzar(unidad + 1, 9);  /* obliga a bajar de decena */
  const redondo = decena;
  const sobra = segundo - unidad;

  return {
    reto: "restas",
    enunciado: primero + " − " + segundo,
    saltos: [primero, redondo, primero - segundo],
    pasos: [
      {
        pregunta: t("mates.restaPaso1", { a: primero, b: redondo }),
        ayuda: t("mates.restaPaso1Ayuda"),
        respuesta: unidad
      },
      {
        pregunta: t("mates.restaPaso2", { a: unidad }),
        ayuda: t("mates.restaPaso2Ayuda", { n: segundo }),
        respuesta: sobra
      },
      {
        pregunta: redondo + " − " + sobra,
        ayuda: t("mates.pasoFinalAyuda"),
        respuesta: primero - segundo
      }
    ]
  };
}

export function generarEjercicio(reto, tabla) {
  if (reto === "tablas") return ejercicioTabla(tabla);
  if (reto === "sumas") return ejercicioSuma();
  return ejercicioResta();
}

/* ============================================================
   PROGRESO
   users/{uid}/mates/{reto}
   ============================================================ */

let uidActual = null;
let cache = {};

function referencia(reto) {
  return doc(db, "users", uidActual, "mates", reto);
}

export async function cargarProgreso(uid) {
  uidActual = uid;
  cache = {};
  await Promise.all(RETOS.map(async (reto) => {
    try {
      const registro = await getDoc(referencia(reto.id));
      cache[reto.id] = registro.exists() ? registro.data() : {};
    } catch (error) {
      cache[reto.id] = {};
    }
  }));
  return cache;
}

export function olvidarProgreso() {
  uidActual = null;
  cache = {};
}

/** Aciertos y fallos de una tabla concreta. */
export function marcadorDeTabla(tabla) {
  const porTabla = (cache.tablas && cache.tablas.porTabla) || {};
  return porTabla[tabla] || { aciertos: 0, fallos: 0 };
}

/** "verde" si la lleva bien, "media" si va por el camino, "" si no la ha tocado. */
export function nivelDeTabla(tabla) {
  const { aciertos, fallos } = marcadorDeTabla(tabla);
  const total = aciertos + fallos;
  if (total === 0) return "";
  if (aciertos >= 8 && fallos <= aciertos / 4) return "verde";
  return "media";
}

export function totalRespondidas(reto) {
  const registro = cache[reto] || {};
  return (registro.aciertos || 0) + (registro.fallos || 0);
}

/**
 * Anota una respuesta. Como en las tarjetas, no esperamos a Firestore:
 * si no hay red, la escritura queda encolada y la niña no ve ningún parón.
 */
export function anotar(reto, acierta, tabla) {
  if (!uidActual) return;

  const local = cache[reto] || (cache[reto] = {});
  const campo = acierta ? "aciertos" : "fallos";
  local[campo] = (local[campo] || 0) + 1;

  const carga = { updatedAt: serverTimestamp() };
  carga[campo] = increment(1);

  if (reto === "tablas" && tabla) {
    const porTabla = local.porTabla || (local.porTabla = {});
    const fila = porTabla[tabla] || (porTabla[tabla] = { aciertos: 0, fallos: 0 });
    fila[campo] += 1;
    carga.porTabla = { [tabla]: { [campo]: increment(1) } };
  }

  setDoc(referencia(reto), carga, { merge: true }).catch(() => {
    /* queda encolado por la caché persistente de Firestore */
  });
}

/** "Empezar de cero": borra el progreso de los tres retos. */
export async function reiniciar() {
  if (!uidActual) return;
  cache = {};
  await Promise.all(RETOS.map((reto) => deleteDoc(referencia(reto.id)).catch(() => null)));
}

export { PREGUNTAS_POR_RONDA };
