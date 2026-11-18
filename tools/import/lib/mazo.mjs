/**
 * ============================================================
 *  MAZO — abrir un .apkg y entender lo que hay dentro
 * ============================================================
 *  Un único sitio que sabe abrir mazos de Anki. Antes lo sabían dos
 *  —el inspector y el importador— y se separaron: el inspector
 *  aprendió a leer el formato nuevo y el importador se quedó atrás,
 *  así que el mismo mazo se veía bien en uno y llegaba vacío al otro.
 *
 *  Lo que resuelve:
 *
 *    · El SEÑUELO. Los .apkg modernos traen la base real en
 *      collection.anki21b (comprimida con zstd) y ADEMÁS un
 *      collection.anki2 con una sola nota que dice «actualiza Anki».
 *      Quedarse con el señuelo hace parecer vacío un mazo de miles
 *      de palabras.
 *
 *    · Los DOS ESQUEMAS. Hasta el 18, los tipos de nota vivían como
 *      JSON dentro de col.models; desde el 18, en tablas propias.
 *
 *    · SQLite SIN DEPENDENCIAS. node:sqlite viene dentro de Node
 *      desde la 22, y zstd desde la 22.15. No hace falta compilar
 *      nada; better-sqlite3 queda solo para Node anteriores.
 * ============================================================
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zstdDecompressSync } from "node:zlib";
import { leerZip } from "./zip.mjs";

/** Anki separa los campos de una nota con 0x1f (unit separator). */
export const SEPARADOR_CAMPOS = "\u001f";

/** De más nueva a más vieja: la que manda es la más nueva. */
const CANDIDATAS = ["collection.anki21b", "collection.anki21", "collection.anki2"];

const esZstd = (b) => b && b.length > 4 &&
  b[0] === 0x28 && b[1] === 0xb5 && b[2] === 0x2f && b[3] === 0xfd;

async function abrirSqlite(ruta) {
  const fallos = [];

  try {
    const { DatabaseSync } = await import("node:sqlite");
    return new DatabaseSync(ruta, { readOnly: true });
  } catch (error) {
    fallos.push("node:sqlite → " + error.message.split("\n")[0]);
  }

  try {
    const modulo = await import("better-sqlite3");
    return new modulo.default(ruta, { readonly: true });
  } catch (error) {
    fallos.push("better-sqlite3 → " + error.message.split("\n")[0]);
  }

  throw new Error(
    "No se ha podido abrir la base del mazo por ninguna vía:\n\n" +
    fallos.map((f) => "  · " + f).join("\n") +
    "\n\nCon Node 22 o superior basta. En Node 22 puede hacer falta:\n" +
    "  node --experimental-sqlite <script>"
  );
}

/**
 * Abre el mazo y devuelve todo lo que hace falta para leerlo.
 *
 * @returns {Promise<object>} { zip, base, cerrar, nombreBase, basesPresentes,
 *   versionEsquema, creada, tiposDeNota, mazos, medios, carpeta }
 */
export async function abrirMazo(ruta) {
  const zip = leerZip(ruta);
  const entradas = [...zip.keys()];

  let nombreBase = null;
  let contenido = null;
  const noLegibles = [];

  for (const candidata of CANDIDATAS) {
    if (!zip.has(candidata)) continue;
    let datos = zip.get(candidata);
    if (datos === null) { noLegibles.push(candidata); continue; }
    if (esZstd(datos)) {
      try {
        datos = zstdDecompressSync(datos);
      } catch (error) {
        noLegibles.push(candidata + " (zstd: " + error.message + ")");
        continue;
      }
    }
    nombreBase = candidata;
    contenido = datos;
    break;
  }

  if (!nombreBase) {
    if (noLegibles.length) {
      throw new Error(
        "El mazo trae su base en un formato que este Node no sabe descomprimir:\n" +
        noLegibles.map((n) => "  · " + n).join("\n") +
        "\n\nCon Node 22.15 o superior se lee sin instalar nada. Si no puedes\n" +
        "actualizar, reexporta desde Anki marcando «Compatibilidad con\n" +
        "versiones anteriores»."
      );
    }
    throw new Error(
      "El fichero no parece un .apkg: no contiene ninguna base de colección.\n" +
      "Entradas: " + entradas.slice(0, 20).join(", ")
    );
  }

  const carpeta = mkdtempSync(join(tmpdir(), "mazo-anki-"));
  const rutaBase = join(carpeta, "collection.anki2");
  writeFileSync(rutaBase, contenido);
  const base = await abrirSqlite(rutaBase);

  /* ---------- índice de medios ---------- */

  const crudoMedia = zip.get("media");
  let mapa = {};
  let mediaLegible = true;
  try {
    mapa = crudoMedia ? JSON.parse(crudoMedia.toString("utf8")) : {};
  } catch (error) {
    mediaLegible = false;   /* en algunos .apkg nuevos es binario */
  }
  const porNumero = new Map(Object.entries(mapa));
  const porNombre = new Map([...porNumero].map(([numero, nombre]) => [nombre, numero]));

  /* ---------- tipos de nota, en los dos esquemas ---------- */

  const tablas = new Set(
    base.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((f) => f.name)
  );

  const fila = base.prepare("SELECT * FROM col LIMIT 1").get();
  const versionEsquema = fila ? fila.ver : null;
  const creada = (fila && fila.crt) ? new Date(fila.crt * 1000).toISOString().slice(0, 10) : null;

  let tiposDeNota = [];

  if (fila && fila.models && String(fila.models).trim().startsWith("{")) {
    tiposDeNota = Object.values(JSON.parse(fila.models)).map((m) => ({
      id: String(m.id),
      nombre: m.name,
      campos: (m.flds || []).slice().sort((a, b) => a.ord - b.ord).map((f) => f.name),
      plantillas: (m.tmpls || []).map((t) => ({
        nombre: t.name,
        anverso: (t.qfmt || "").replace(/\s+/g, " ").trim(),
        reverso: (t.afmt || "").replace(/\s+/g, " ").trim()
      })),
      css: (m.css || "").length
    }));
  } else if (tablas.has("notetypes") && tablas.has("fields")) {
    tiposDeNota = base.prepare("SELECT id, name FROM notetypes").all().map((t) => ({
      id: String(t.id),
      nombre: t.name,
      campos: base.prepare("SELECT name FROM fields WHERE ntid=? ORDER BY ord").all(t.id).map((f) => f.name),
      plantillas: base.prepare("SELECT name FROM templates WHERE ntid=? ORDER BY ord").all(t.id)
        .map((p) => ({ nombre: p.name, anverso: "(en config binaria)", reverso: "(en config binaria)" })),
      css: 0
    }));
  }

  /* ---------- mazos ---------- */

  let mazos = [];
  if (fila && fila.decks && String(fila.decks || "").trim().startsWith("{")) {
    mazos = Object.values(JSON.parse(fila.decks)).map((d) => d.name);
  } else if (tablas.has("decks")) {
    mazos = base.prepare("SELECT name FROM decks").all()
      .map((d) => String(d.name).replace(/\u001f/g, "::"));
  }

  return {
    zip,
    base,
    cerrar: () => base.close(),
    carpeta,
    entradas,
    nombreBase,
    basesPresentes: CANDIDATAS.filter((c) => zip.has(c)),
    versionEsquema,
    creada,
    tablas,
    tiposDeNota,
    tipoPorId: new Map(tiposDeNota.map((t) => [t.id, t])),
    mazos,
    medios: { porNumero, porNombre, legible: mediaLegible }
  };
}

/* ============================================================
   MEDIOS REFERENCIADOS DESDE UN CAMPO
   ============================================================ */

export const audiosDe = (texto) =>
  [...String(texto).matchAll(/\[sound:([^\]]+)\]/g)].map((m) => m[1]);

export const imagenesDe = (texto) =>
  [...String(texto).matchAll(/<img[^>]+src\s*=\s*["']?([^"'>\s]+)/gi)].map((m) => m[1]);

/** Deja el texto de un campo legible: fuera HTML y referencias a medios. */
export function textoLimpio(valor) {
  return String(valor || "")
    .replace(/\[sound:[^\]]+\]/g, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
