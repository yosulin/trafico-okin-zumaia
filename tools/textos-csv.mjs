/**
 * ============================================================
 *  Los textos de la app, en CSV y de vuelta
 * ============================================================
 *  Para poder repasar las traducciones fuera del código —con un LLM,
 *  con alguien que sepa euskera, o en una hoja de cálculo— y devolver
 *  las correcciones sin tocar JavaScript a mano.
 *
 *      node tools/textos-csv.mjs exportar > textos.csv
 *      (se corrige textos.csv)
 *      node tools/textos-csv.mjs importar textos.csv
 *
 *  El CSV tiene una fila por texto:
 *
 *      clave,es,eu,en
 *      hub.pregunta,¿Qué quieres hacer hoy?,Zer egin nahi duzu gaur?,...
 *
 *  Al importar solo se tocan los textos: el resto de i18n.js (la lógica,
 *  los comentarios) se queda como está. Las claves que no existan en el
 *  CSV se conservan; las que sobren se avisan y se ignoran.
 * ============================================================
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rutaI18n = resolve(raiz, "vocabulario/js/i18n.js");

const { TEXTOS, IDIOMAS } = await import(rutaI18n);
const CODIGOS = IDIOMAS.map((idioma) => idioma.codigo);

/* ---------- CSV ---------- */

function celda(texto) {
  const valor = String(texto === undefined ? "" : texto);
  return /[",\n]/.test(valor) ? '"' + valor.replace(/"/g, '""') + '"' : valor;
}

function partirCsv(texto) {
  const filas = [];
  let fila = [], campo = "", entreComillas = false;

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

/* ---------- exportar ---------- */

function exportar() {
  /* El castellano manda el orden: es el idioma completo de referencia. */
  const claves = Object.keys(TEXTOS.es);
  const lineas = [["clave"].concat(CODIGOS).map(celda).join(",")];

  claves.forEach((clave) => {
    const fila = [clave].concat(CODIGOS.map((codigo) => (TEXTOS[codigo] || {})[clave]));
    lineas.push(fila.map(celda).join(","));
  });

  process.stdout.write(lineas.join("\n") + "\n");
  process.stderr.write(`\n${claves.length} textos × ${CODIGOS.length} idiomas.\n\n`);
}

/* ---------- importar ---------- */

function importar(ruta) {
  const filas = partirCsv(readFileSync(resolve(ruta), "utf8").replace(/^\uFEFF/, ""));
  if (filas.length < 2) throw new Error("El CSV está vacío");

  const cabecera = filas[0].map((c) => c.trim());
  const columnaClave = cabecera.indexOf("clave");
  if (columnaClave === -1) throw new Error('Falta la columna "clave"');

  const nuevos = {};
  CODIGOS.forEach((codigo) => { nuevos[codigo] = Object.assign({}, TEXTOS[codigo]); });

  const desconocidas = [];
  let cambios = 0;

  filas.slice(1).forEach((fila) => {
    const clave = (fila[columnaClave] || "").trim();
    if (!clave) return;
    if (!(clave in TEXTOS.es)) { desconocidas.push(clave); return; }

    CODIGOS.forEach((codigo) => {
      const columna = cabecera.indexOf(codigo);
      if (columna === -1) return;
      const valor = fila[columna];
      if (valor === undefined || valor === "") return;
      if (nuevos[codigo][clave] !== valor) cambios++;
      nuevos[codigo][clave] = valor;
    });
  });

  /* Se reescribe solo el bloque de TEXTOS, respetando el resto del fichero. */
  const original = readFileSync(rutaI18n, "utf8");
  const inicio = original.indexOf("export const TEXTOS = {");
  const fin = original.indexOf("\n};", inicio) + 3;
  if (inicio === -1 || fin < inicio) throw new Error("No encuentro el bloque TEXTOS en i18n.js");

  const cuerpo = CODIGOS.map((codigo) => {
    const filas = Object.keys(TEXTOS.es)
      .map((clave) => "    " + JSON.stringify(clave) + ": " + JSON.stringify(nuevos[codigo][clave] || ""))
      .join(",\n");
    return "  " + codigo + ": {\n" + filas + "\n  }";
  }).join(",\n\n");

  writeFileSync(
    rutaI18n,
    original.slice(0, inicio) + "export const TEXTOS = {\n" + cuerpo + "\n};" + original.slice(fin),
    "utf8"
  );

  console.log(`\n${cambios} textos actualizados en vocabulario/js/i18n.js`);
  if (desconocidas.length > 0) {
    console.log(`Ignoradas ${desconocidas.length} claves que no existen: ` + desconocidas.slice(0, 5).join(", ") +
      (desconocidas.length > 5 ? "…" : ""));
  }
  console.log("");
}

/* ---------- ---------- */

const [accion, fichero] = process.argv.slice(2);

if (accion === "exportar") {
  exportar();
} else if (accion === "importar" && fichero) {
  importar(fichero);
} else {
  console.log(`
Uso:
  node tools/textos-csv.mjs exportar > textos.csv
  node tools/textos-csv.mjs importar textos.csv
`);
  process.exit(accion ? 1 : 0);
}
