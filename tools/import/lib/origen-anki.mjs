/**
 * ============================================================
 *  ORIGEN ANKI (.apkg)
 * ============================================================
 *  Cadena completa:
 *
 *      .apkg  →  descomprimir (lib/zip.mjs, sin dependencias)
 *             →  leer notas de collection.anki2 (SQLite)
 *             →  extraer los medios a una carpeta temporal
 *             →  normalizar  →  subir  →  Firestore
 *
 *  Un .apkg es un zip con la base "collection.anki2", un fichero
 *  "media" (JSON con numero → nombre original) y los medios
 *  numerados. Las notas guardan todos sus campos en una sola columna,
 *  separados por el carácter 0x1f y en el orden en que los definió
 *  quien hizo el mazo: por eso hay que decir qué campo es qué con
 *  --campos (ver README).
 *
 *  Leer SQLite sí necesita una dependencia:
 *
 *      cd tools/import && npm install
 *
 *  Los .apkg más nuevos usan "collection.anki21b" comprimido con
 *  zstd; en ese caso hay que reexportar el mazo desde Anki marcando
 *  "Compatibilidad con versiones anteriores", que genera
 *  collection.anki2.
 * ============================================================
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { leerZip } from "./zip.mjs";

/* Anki separa los campos de una nota con 0x1f (unit separator). */
const SEPARADOR_CAMPOS = "\u001f";

function referenciasDeMedios(texto) {
  const nombres = [];
  for (const encontrado of String(texto).matchAll(/\[sound:([^\]]+)\]/g)) {
    nombres.push({ tipo: "audio", nombre: encontrado[1] });
  }
  for (const encontrado of String(texto).matchAll(/<img[^>]+src\s*=\s*["']?([^"'>\s]+)/gi)) {
    nombres.push({ tipo: "imagen", nombre: encontrado[1] });
  }
  return nombres;
}

async function abrirSqlite(ruta) {
  try {
    const modulo = await import("better-sqlite3");
    return new modulo.default(ruta, { readonly: true });
  } catch (error) {
    throw new Error(
      "Para leer mazos de Anki hace falta la dependencia better-sqlite3.\n" +
      "  cd tools/import && npm install"
    );
  }
}

/**
 * @param {string} ruta        fichero .apkg
 * @param {object} opciones
 *        - campos: { word: 0, es: 1, example_en: 2, ... } posición de cada campo
 *        - limite: máximo de notas a leer
 * @returns {Promise<{tarjetas: object[], temas: object[], carpetaMedios: string}>}
 */
export async function leerApkg(ruta, opciones = {}) {
  const zip = leerZip(ruta);

  const nombreBase = ["collection.anki2", "collection.anki21"].find((n) => zip.get(n));
  if (!nombreBase) {
    throw new Error(zip.has("collection.anki21b")
      ? "Este .apkg usa el formato nuevo (collection.anki21b, comprimido con zstd). " +
        "Vuelve a exportarlo desde Anki marcando «Compatibilidad con versiones anteriores»."
      : "El .apkg no contiene collection.anki2");
  }

  const carpeta = mkdtempSync(join(tmpdir(), "colores-anki-"));

  /* Medios: el fichero "media" mapea número de entrada → nombre original. */
  const mapaCrudo = zip.get("media");
  const mapa = mapaCrudo ? JSON.parse(mapaCrudo.toString("utf8")) : {};
  const porNombre = new Map();
  Object.entries(mapa).forEach(([numero, nombre]) => porNombre.set(nombre, numero));

  const rutaBase = join(carpeta, "collection.anki2");
  writeFileSync(rutaBase, zip.get(nombreBase));

  const base = await abrirSqlite(rutaBase);
  const limite = opciones.limite ? " LIMIT " + Number(opciones.limite) : "";
  const notas = base.prepare("SELECT id, tags, flds FROM notes ORDER BY id" + limite).all();
  base.close();

  const campos = opciones.campos || { word: 0, es: 1 };

  const extraer = (nombreFichero) => {
    const numero = porNombre.get(nombreFichero);
    if (numero === undefined) return "";
    const contenido = zip.get(String(numero));
    if (!contenido) return "";
    const destino = join(carpeta, nombreFichero);
    writeFileSync(destino, contenido);
    return destino;
  };

  const tarjetas = notas.map((nota) => {
    const partes = String(nota.flds).split(SEPARADOR_CAMPOS);
    const campo = (nombre) => {
      const posicion = campos[nombre];
      return posicion === undefined ? "" : (partes[posicion] || "");
    };

    /* Los audios suelen venir incrustados en su propio campo, pero en
       muchos mazos van pegados al campo de la palabra o del ejemplo. */
    const mediosDe = (nombre) => referenciasDeMedios(campo(nombre));
    const primero = (lista, tipo) => {
      const encontrado = lista.find((medio) => medio.tipo === tipo);
      return encontrado ? extraer(encontrado.nombre) : "";
    };

    return {
      word: campo("word"),
      es: campo("es"),
      eu: campo("eu"),
      type: campo("type"),
      theme: campo("theme"),
      example: {
        en: campo("example_en"),
        es: campo("example_es"),
        eu: campo("example_eu")
      },
      tags: String(nota.tags || "").trim(),
      media: {
        imagen: primero(mediosDe("image").concat(mediosDe("word")), "imagen"),
        audioPalabra: primero(mediosDe("word_audio").concat(mediosDe("word")), "audio"),
        audioEjemplo: primero(mediosDe("example_audio").concat(mediosDe("example_en")), "audio")
      },
      ankiNoteId: String(nota.id)
    };
  });

  return { tarjetas, temas: [], carpetaMedios: carpeta };
}
