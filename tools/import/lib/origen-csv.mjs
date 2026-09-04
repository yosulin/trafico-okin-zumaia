/**
 * ============================================================
 *  ORIGEN CSV
 * ============================================================
 *  Cabecera esperada (el orden da igual, y sobra con las dos primeras):
 *
 *      word,es,eu,theme,type,layer,tags,
 *      example_en,example_es,example_eu,
 *      image,word_audio,example_audio
 *
 *  "image", "word_audio" y "example_audio" son rutas de Storage o
 *  ficheros dentro de la carpeta indicada con --media.
 * ============================================================
 */

import { readFileSync } from "node:fs";

/** Parser de CSV pequeño pero correcto: comillas dobles y saltos dentro de campo. */
function partir(texto) {
  const filas = [];
  let fila = [];
  let campo = "";
  let entreComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const caracter = texto[i];

    if (entreComillas) {
      if (caracter === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else entreComillas = false;
      } else campo += caracter;
      continue;
    }

    if (caracter === '"') { entreComillas = true; continue; }
    if (caracter === ",") { fila.push(campo); campo = ""; continue; }
    if (caracter === "\r") continue;
    if (caracter === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; continue; }
    campo += caracter;
  }

  if (campo !== "" || fila.length > 0) { fila.push(campo); filas.push(fila); }
  return filas.filter((f) => f.some((c) => c.trim() !== ""));
}

export function leerCsv(ruta) {
  const filas = partir(readFileSync(ruta, "utf8"));
  if (filas.length < 2) return { tarjetas: [], temas: [] };

  const cabecera = filas[0].map((c) => c.trim().toLowerCase());

  const tarjetas = filas.slice(1).map((fila) => {
    const valor = (nombre) => {
      const posicion = cabecera.indexOf(nombre);
      return posicion === -1 ? "" : (fila[posicion] || "").trim();
    };

    return {
      id: valor("id") || undefined,
      word: valor("word") || valor("en"),
      es: valor("es"),
      eu: valor("eu"),
      theme: valor("theme") || valor("tema"),
      type: valor("type"),
      layer: valor("layer"),
      tags: valor("tags"),
      example: {
        en: valor("example_en"),
        es: valor("example_es"),
        eu: valor("example_eu")
      },
      media: {
        imagen: valor("image"),
        audioPalabra: valor("word_audio"),
        audioEjemplo: valor("example_audio")
      }
    };
  });

  return { tarjetas, temas: [] };
}
