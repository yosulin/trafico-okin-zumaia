/**
 * ============================================================
 *  INSPECCIONAR — radiografía de un .apkg, sin tocarlo
 * ============================================================
 *  Herramienta de AUDITORÍA. Abre el mazo en modo lectura, copia lo
 *  imprescindible a una carpeta temporal y cuenta lo que hay dentro.
 *  No escribe en el .apkg, no sube nada, no necesita credenciales.
 *
 *      node inspeccionar.mjs <fichero.apkg> [--muestras 10] [--json]
 *
 *  Responde a lo que hace falta saber ANTES de decidir nada:
 *
 *    · cuántas notas y cuántas tarjetas
 *    · qué tipos de nota hay y con qué campos exactos, en qué orden
 *    · qué plantillas generan las tarjetas
 *    · qué etiquetas se usan y cuántas notas tiene cada una
 *    · cuántos medios hay, de qué formato y cuánto ocupan
 *    · desde qué campo se referencia cada medio
 *    · cuántas notas tienen audio, imagen, ejemplo o campos vacíos
 *    · una muestra de notas reales, campo a campo
 *
 *  Los .apkg nuevos (collection.anki21b, comprimido con zstd) no se
 *  pueden leer sin dependencias extra: en ese caso lo dice y explica
 *  cómo reexportar el mazo en formato compatible.
 * ============================================================
 */

import { mkdtempSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { leerZip } from "./lib/zip.mjs";

const SEPARADOR_CAMPOS = "\u001f";

/* ---------- línea de comandos ---------- */

const args = process.argv.slice(2);
const fichero = args.find((a) => !a.startsWith("--"));
const opcion = (nombre, pordefecto) => {
  const i = args.indexOf("--" + nombre);
  return i === -1 ? pordefecto : args[i + 1];
};
const MUESTRAS = Number(opcion("muestras", 10));
const COMO_JSON = args.includes("--json");

if (!fichero) {
  console.error("Uso: node inspeccionar.mjs <fichero.apkg> [--muestras 10] [--json]");
  process.exit(1);
}

/* ---------- utilidades ---------- */

const bonito = (bytes) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
};

const extensionDe = (nombre) => {
  const punto = String(nombre).lastIndexOf(".");
  return punto === -1 ? "(sin extensión)" : nombre.slice(punto).toLowerCase();
};

/** Cuenta ocurrencias y devuelve pares [valor, veces] de mayor a menor. */
const frecuencias = (lista) => {
  const cuenta = new Map();
  lista.forEach((v) => cuenta.set(v, (cuenta.get(v) || 0) + 1));
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1]);
};

const audiosDe = (texto) =>
  [...String(texto).matchAll(/\[sound:([^\]]+)\]/g)].map((m) => m[1]);

const imagenesDe = (texto) =>
  [...String(texto).matchAll(/<img[^>]+src\s*=\s*["']?([^"'>\s]+)/gi)].map((m) => m[1]);

/** Quita etiquetas HTML para poder enseñar el texto de verdad. */
const sinHtml = (texto) =>
  String(texto)
    .replace(/\[sound:[^\]]+\]/g, "🔊")
    .replace(/<br\s*\/?>/gi, " / ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

async function abrirSqlite(ruta) {
  try {
    const modulo = await import("better-sqlite3");
    return new modulo.default(ruta, { readonly: true });
  } catch (error) {
    throw new Error(
      "Para leer el mazo hace falta better-sqlite3:\n" +
      "  cd tools/import && npm install"
    );
  }
}

/* ============================================================
   LECTURA
   ============================================================ */

const tamanoApkg = statSync(fichero).size;
const zip = leerZip(fichero);
const entradas = [...zip.keys()];

const nombreBase = ["collection.anki2", "collection.anki21"].find((n) => zip.get(n));
if (!nombreBase) {
  if (zip.has("collection.anki21b")) {
    console.error(
      "Este .apkg usa el formato nuevo (collection.anki21b, comprimido con zstd),\n" +
      "que no se puede leer sin dependencias adicionales.\n\n" +
      "Vuelve a exportarlo desde Anki con «Compatibilidad con versiones anteriores»\n" +
      "(Support older Anki versions) y genera collection.anki2."
    );
  } else {
    console.error("El fichero no parece un .apkg: no contiene collection.anki2.");
    console.error("Entradas encontradas: " + entradas.slice(0, 20).join(", "));
  }
  process.exit(1);
}

const carpeta = mkdtempSync(join(tmpdir(), "inspeccion-anki-"));
const rutaBase = join(carpeta, "collection.anki2");
writeFileSync(rutaBase, zip.get(nombreBase));
const base = await abrirSqlite(rutaBase);

/* ---------- mapa de medios ---------- */

const crudoMedia = zip.get("media");
let mapaMedios = {};
let mediaLegible = true;
try {
  mapaMedios = crudoMedia ? JSON.parse(crudoMedia.toString("utf8")) : {};
} catch (error) {
  /* En los .apkg nuevos "media" es binario, no JSON. */
  mediaLegible = false;
}
const nombrePorNumero = new Map(Object.entries(mapaMedios));
const numeroPorNombre = new Map([...nombrePorNumero].map(([n, f]) => [f, n]));

/* ---------- tipos de nota ---------- */

const tablas = new Set(
  base.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((f) => f.name)
);

/* Anki guardaba los tipos de nota como JSON dentro de col.models; desde el
   esquema 18 viven en tablas propias. Admitimos las dos formas. */
let tiposDeNota = [];
let versionEsquema = null;
let creada = null;

const fila = base.prepare("SELECT * FROM col LIMIT 1").get();
if (fila) {
  creada = fila.crt ? new Date(fila.crt * 1000).toISOString().slice(0, 10) : null;
  versionEsquema = fila.ver;
}

if (fila && fila.models && String(fila.models).trim().startsWith("{")) {
  const modelos = JSON.parse(fila.models);
  tiposDeNota = Object.values(modelos).map((m) => ({
    id: String(m.id),
    nombre: m.name,
    campos: (m.flds || []).sort((a, b) => a.ord - b.ord).map((f) => f.name),
    plantillas: (m.tmpls || []).map((t) => ({
      nombre: t.name,
      anverso: (t.qfmt || "").replace(/\s+/g, " ").trim(),
      reverso: (t.afmt || "").replace(/\s+/g, " ").trim()
    })),
    css: (m.css || "").length
  }));
} else if (tablas.has("notetypes") && tablas.has("fields")) {
  const tipos = base.prepare("SELECT id, name FROM notetypes").all();
  tiposDeNota = tipos.map((t) => ({
    id: String(t.id),
    nombre: t.name,
    campos: base.prepare("SELECT name FROM fields WHERE ntid=? ORDER BY ord").all(t.id).map((f) => f.name),
    plantillas: base.prepare("SELECT name, config FROM templates WHERE ntid=? ORDER BY ord").all(t.id)
      .map((p) => ({ nombre: p.name, anverso: "(en config binaria)", reverso: "(en config binaria)" })),
    css: 0
  }));
}

const tipoPorId = new Map(tiposDeNota.map((t) => [t.id, t]));

/* ---------- mazos ---------- */

let mazos = [];
if (fila && fila.decks && String(fila.decks || "").trim().startsWith("{")) {
  mazos = Object.values(JSON.parse(fila.decks)).map((d) => d.name);
} else if (tablas.has("decks")) {
  mazos = base.prepare("SELECT name FROM decks").all().map((d) => String(d.name).replace(/\u001f/g, "::"));
}

/* ---------- notas y tarjetas ---------- */

const totalNotas = base.prepare("SELECT COUNT(*) n FROM notes").get().n;
const totalTarjetas = base.prepare("SELECT COUNT(*) n FROM cards").get().n;
const notas = base.prepare("SELECT id, guid, mid, tags, flds FROM notes ORDER BY id").all();

/* Estado de repaso: lo que NO debería viajar en un maestro académico. */
const conRepaso = tablas.has("revlog")
  ? base.prepare("SELECT COUNT(*) n FROM revlog").get().n : 0;
const tarjetasVistas = base.prepare("SELECT COUNT(*) n FROM cards WHERE reps > 0").get().n;

base.close();

/* ============================================================
   ANÁLISIS
   ============================================================ */

const porTipo = frecuencias(notas.map((n) => {
  const tipo = tipoPorId.get(String(n.mid));
  return tipo ? tipo.nombre : "(tipo desconocido " + n.mid + ")";
}));

const etiquetas = frecuencias(
  notas.flatMap((n) => String(n.tags || "").trim().split(/\s+/).filter(Boolean))
);

/* Recorrido campo a campo: qué se llena, qué se queda vacío, dónde
   están los medios. Esto es lo que decide si el mazo sirve de base. */
const perfil = new Map();   // "tipo · campo" → estadísticas
const mediosReferenciados = new Set();
const guids = new Set();
let guidsRepetidos = 0;

notas.forEach((nota) => {
  const tipo = tipoPorId.get(String(nota.mid));
  const nombres = tipo ? tipo.campos : [];
  const partes = String(nota.flds).split(SEPARADOR_CAMPOS);

  if (guids.has(nota.guid)) guidsRepetidos += 1;
  guids.add(nota.guid);

  partes.forEach((valor, i) => {
    const clave = (tipo ? tipo.nombre : "?") + " · [" + i + "] " + (nombres[i] || "(sin nombre)");
    const p = perfil.get(clave) || { vacios: 0, largos: [], audios: 0, imagenes: 0, html: 0, muestra: null };

    const texto = String(valor || "");
    if (!texto.trim()) p.vacios += 1;
    else {
      p.largos.push(sinHtml(texto).length);
      if (!p.muestra) p.muestra = sinHtml(texto).slice(0, 60);
    }
    const a = audiosDe(texto);
    const im = imagenesDe(texto);
    if (a.length) p.audios += 1;
    if (im.length) p.imagenes += 1;
    if (/<[a-z][^>]*>/i.test(texto.replace(/\[sound:[^\]]+\]/g, ""))) p.html += 1;
    a.concat(im).forEach((m) => mediosReferenciados.add(m));

    perfil.set(clave, p);
  });
});

/* Medios: los que están en el zip frente a los que citan las notas. */
const mediosEnZip = [...nombrePorNumero.entries()].map(([numero, nombre]) => {
  const contenido = zip.get(String(numero));
  return { nombre, bytes: contenido ? contenido.length : 0 };
});
const bytesMedios = mediosEnZip.reduce((t, m) => t + m.bytes, 0);
const porExtension = frecuencias(mediosEnZip.map((m) => extensionDe(m.nombre)));

const huerfanos = mediosEnZip.filter((m) => !mediosReferenciados.has(m.nombre));
const rotos = [...mediosReferenciados].filter((n) => !numeroPorNombre.has(n));

/* ============================================================
   INFORME
   ============================================================ */

const informe = {
  fichero,
  tamano: tamanoApkg,
  formato: nombreBase,
  versionEsquema,
  creada,
  entradasZip: entradas.length,
  mazos,
  totalNotas,
  totalTarjetas,
  guidsUnicos: guids.size,
  guidsRepetidos,
  revlog: conRepaso,
  tarjetasVistas,
  tiposDeNota,
  porTipo,
  etiquetas,
  medios: {
    legible: mediaLegible,
    total: mediosEnZip.length,
    bytes: bytesMedios,
    porExtension,
    huerfanos: huerfanos.length,
    rotos
  }
};

if (COMO_JSON) {
  console.log(JSON.stringify({ informe, perfil: [...perfil] }, null, 2));
  process.exit(0);
}

const titulo = (t) => console.log("\n" + t + "\n" + "─".repeat(t.length));

console.log("RADIOGRAFÍA DE " + fichero);
console.log("═".repeat(60));
console.log("Tamaño del .apkg   " + bonito(tamanoApkg));
console.log("Base interna       " + nombreBase + "  (esquema v" + versionEsquema + ")");
console.log("Colección creada   " + (creada || "?"));
console.log("Entradas del zip   " + entradas.length);
console.log("Mazos              " + (mazos.join(", ") || "(ninguno)"));

titulo("1-2. VOLUMEN");
console.log("Notas              " + totalNotas);
console.log("Tarjetas           " + totalTarjetas +
  (totalNotas ? "   (" + (totalTarjetas / totalNotas).toFixed(2) + " por nota)" : ""));
console.log("guid únicos        " + guids.size + (guidsRepetidos ? "   ⚠ " + guidsRepetidos + " repetidos" : "   ✓ sin repetidos"));

titulo("3-5. TIPOS DE NOTA, CAMPOS Y PLANTILLAS");
tiposDeNota.forEach((tipo) => {
  const usadas = (porTipo.find(([n]) => n === tipo.nombre) || [null, 0])[1];
  console.log("\n▸ " + tipo.nombre + "   (" + usadas + " notas)");
  tipo.campos.forEach((c, i) => console.log("    [" + i + "] " + c));
  tipo.plantillas.forEach((p) => {
    console.log("    plantilla «" + p.nombre + "»");
    console.log("      anverso: " + p.anverso.slice(0, 100));
    console.log("      reverso: " + p.reverso.slice(0, 100));
  });
});

titulo("CONTENIDO REAL DE CADA CAMPO");
console.log("(vacías / longitud media del texto / cuántas llevan audio, imagen o HTML)");
[...perfil.entries()].forEach(([clave, p]) => {
  const media = p.largos.length
    ? Math.round(p.largos.reduce((a, b) => a + b, 0) / p.largos.length) : 0;
  console.log("\n  " + clave);
  console.log("    vacías " + p.vacios + "/" + totalNotas +
    " · longitud media " + media +
    " · audio " + p.audios + " · imagen " + p.imagenes + " · HTML " + p.html);
  if (p.muestra) console.log("    ej.: " + p.muestra);
});

titulo("6. ETIQUETAS");
if (!etiquetas.length) console.log("  (ninguna)");
etiquetas.slice(0, 40).forEach(([t, n]) => console.log("  " + String(n).padStart(6) + "  " + t));
if (etiquetas.length > 40) console.log("  … y " + (etiquetas.length - 40) + " más");

titulo("7-10. MEDIOS");
if (!mediaLegible) {
  console.log("  ⚠ El índice de medios no es JSON legible (formato nuevo).");
}
console.log("Ficheros en el zip " + mediosEnZip.length);
console.log("Ocupan             " + bonito(bytesMedios) +
  (mediosEnZip.length ? "   (" + bonito(bytesMedios / mediosEnZip.length) + " de media)" : ""));
console.log("Citados por notas  " + mediosReferenciados.size);
console.log("Huérfanos          " + huerfanos.length + "   (en el zip pero que nadie usa)");
console.log("Rotos              " + rotos.length + "   (citados pero que no están)");
if (rotos.length) console.log("  " + rotos.slice(0, 10).join(", "));
console.log("\nPor formato:");
porExtension.forEach(([ext, n]) => {
  const suyos = mediosEnZip.filter((m) => extensionDe(m.nombre) === ext);
  const bytes = suyos.reduce((t, m) => t + m.bytes, 0);
  console.log("  " + String(n).padStart(6) + "  " + ext.padEnd(8) +
    bonito(bytes).padStart(10) + "   media " + bonito(bytes / n));
});
console.log("\nNombres de ejemplo:");
mediosEnZip.slice(0, 8).forEach((m) => console.log("  " + m.nombre + "  (" + bonito(m.bytes) + ")"));

titulo("11. MUESTRA DE " + MUESTRAS + " NOTAS REALES");
notas.slice(0, MUESTRAS).forEach((nota, i) => {
  const tipo = tipoPorId.get(String(nota.mid));
  const nombres = tipo ? tipo.campos : [];
  const partes = String(nota.flds).split(SEPARADOR_CAMPOS);
  console.log("\n── nota " + (i + 1) + "  id=" + nota.id + "  guid=" + nota.guid +
    "  tags=[" + String(nota.tags).trim() + "]");
  partes.forEach((v, j) => {
    const bruto = String(v || "");
    const limpio = sinHtml(bruto);
    console.log("   " + ("[" + j + "] " + (nombres[j] || "?")).padEnd(20) +
      (limpio || "(vacío)").slice(0, 90));
    const medios = audiosDe(bruto).concat(imagenesDe(bruto));
    if (medios.length) console.log("        ↳ medios: " + medios.join(", "));
  });
});

titulo("12-14. LO QUE SE PERDERÍA AL CONVERTIRLO");
console.log("Estado de repaso en el mazo:");
console.log("  entradas de revlog     " + conRepaso);
console.log("  tarjetas ya estudiadas " + tarjetasVistas + " de " + totalTarjetas);
console.log("");
console.log("Se conserva al convertir : campos de texto, etiquetas, medios, guid.");
console.log("NO se conserva           : programación (due, ivl, factor, lapses),");
console.log("                           historial de repasos, opciones de mazo,");
console.log("                           CSS y plantillas de presentación,");
console.log("                           formato HTML dentro de los campos.");
console.log("");
console.log("Carpeta temporal usada (se puede borrar): " + carpeta);
console.log("El .apkg NO ha sido modificado.");
