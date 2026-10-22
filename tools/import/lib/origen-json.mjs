/**
 * ============================================================
 *  ORIGEN JSON
 * ============================================================
 *  Admite dos formas:
 *      [ {...}, {...} ]
 *      { "tarjetas": [ {...} ], "temas": [ ... ] }
 * ============================================================
 */

import { readFileSync } from "node:fs";

export function leerJson(ruta) {
  const datos = JSON.parse(readFileSync(ruta, "utf8"));
  const tarjetas = Array.isArray(datos) ? datos : (datos.tarjetas || datos.cards || []);
  const temas = Array.isArray(datos.temas) ? datos.temas : (datos.themes || []);
  return { tarjetas, temas };
}
