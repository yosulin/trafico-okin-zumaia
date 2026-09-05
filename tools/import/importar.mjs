#!/usr/bin/env node
/**
 * ============================================================
 *  IMPORTADOR DE CONTENIDO
 * ============================================================
 *  Herramienta de administración. NO forma parte de la PWA y nunca
 *  se despliega con ella: entra con una cuenta de servicio, que es
 *  justo lo que permite que el navegador tenga prohibido escribir
 *  tarjetas.
 *
 *      leer origen  →  normalizar  →  subir medios a Storage
 *                                  →  escribir/actualizar en Firestore
 *
 *  Ejemplos:
 *
 *    # ver qué haría, sin tocar nada ni necesitar credenciales
 *    npm run semilla-prueba
 *
 *    # las 10 tarjetas de demostración, de verdad
 *    npm run semilla
 *
 *    # un CSV de vocabulario escolar
 *    node importar.mjs --origen csv --fichero unidad3.csv \
 *         --tema school --fuente escolar --libro "Explorers 4" --unidad 3
 *
 *    # un mazo de Anki (ver README para --campos)
 *    node importar.mjs --origen anki --fichero oxford3000.apkg \
 *         --campos word=0,es=1,example_en=2,example_audio=3 --limite 50
 * ============================================================
 */

import { existsSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

import { leerJson } from "./lib/origen-json.mjs";
import { leerCsv } from "./lib/origen-csv.mjs";
import { leerApkg } from "./lib/origen-anki.mjs";
import { normalizarTarjeta, validar } from "./lib/normalizar.mjs";

/* ---------- argumentos ---------- */

function leerArgumentos(lista) {
  const opciones = {};
  for (let i = 0; i < lista.length; i++) {
    const argumento = lista[i];
    if (!argumento.startsWith("--")) continue;
    const nombre = argumento.slice(2);
    const siguiente = lista[i + 1];
    if (siguiente === undefined || siguiente.startsWith("--")) {
      opciones[nombre] = true;
    } else {
      opciones[nombre] = siguiente;
      i++;
    }
  }
  return opciones;
}

const opciones = leerArgumentos(process.argv.slice(2));

if (opciones.ayuda || opciones.help || !opciones.origen || !opciones.fichero) {
  console.log(`
Uso: node importar.mjs --origen <json|csv|anki> --fichero <ruta> [opciones]

  --media <carpeta>   carpeta local de medios (por defecto, la del fichero)
  --dry-run           no sube ni escribe nada: solo enseña el resultado
  --limite <n>        importar como mucho n tarjetas
  --forzar            volver a subir medios que ya estén en Storage
  --sin-medios        no subir nada a Storage (los medios los sirve Hosting
                      desde vocabulario/media/, que es el modo del prototipo)
  --inactivas         crear las tarjetas con active:false (para revisarlas antes)
  --sin-mazo          deck:false — entran en el diccionario pero no en el juego
                      de tarjetas (para importaciones grandes tipo Oxford 3000)

  --tema <id>         tema por defecto (animals, food, school...)
  --capa <n>          capa por defecto (por defecto 1)
  --fuente <tipo>     source.type: general | escolar | anki (por defecto general)
  --libro <texto>     source.book
  --unidad <texto>    source.unit

  --campos a=0,b=1    solo para Anki: qué posición ocupa cada campo.
                      Nombres admitidos: word, es, eu, type, theme,
                      example_en, example_es, example_eu, image,
                      word_audio, example_audio
`);
  process.exit(opciones.origen ? 1 : 0);
}

const pruebaEnSeco = Boolean(opciones["dry-run"]);
const sinMedios = Boolean(opciones["sin-medios"]);
const ficheroEntrada = resolve(opciones.fichero);

if (!existsSync(ficheroEntrada)) {
  console.error("No existe el fichero: " + ficheroEntrada);
  process.exit(1);
}

/* ---------- 1. leer el origen ---------- */

function camposDeAnki(texto) {
  if (!texto || texto === true) return undefined;
  const campos = {};
  String(texto).split(",").forEach((par) => {
    const [nombre, posicion] = par.split("=");
    if (nombre && posicion !== undefined) campos[nombre.trim()] = Number(posicion);
  });
  return campos;
}

async function leerOrigen() {
  if (opciones.origen === "json") return leerJson(ficheroEntrada);
  if (opciones.origen === "csv") return leerCsv(ficheroEntrada);
  if (opciones.origen === "anki") {
    return leerApkg(ficheroEntrada, {
      campos: camposDeAnki(opciones.campos),
      limite: opciones.limite
    });
  }
  throw new Error("Origen desconocido: " + opciones.origen + " (json, csv o anki)");
}

/* ---------- 2. medios ---------- */

const carpetaMedios = opciones.media
  ? resolve(opciones.media)
  : resolve(ficheroEntrada, "..");

function extension(ruta) {
  return extname(ruta).toLowerCase() || ".bin";
}

/**
 * Decide, para una tarjeta, qué ficheros locales hay que subir y a qué
 * ruta de Storage. Dos formas de indicar un medio:
 *
 *   a) la tarjeta ya trae imagePath ("images/animals/animals_dog.svg") y
 *      el fichero está en <media>/ con esa misma ruta relativa;
 *   b) la tarjeta trae media.imagen / media.audioPalabra /
 *      media.audioEjemplo con un fichero suelto, y la ruta de Storage
 *      se calcula aquí siguiendo la convención del proyecto.
 */
function planDeMedios(tarjeta, cruda) {
  const medios = cruda.media || {};
  const plan = [];

  const anotar = (rutaLocal, rutaStorage, campo) => {
    if (!rutaLocal || !existsSync(rutaLocal) || !statSync(rutaLocal).isFile()) return;
    plan.push({ rutaLocal, rutaStorage, campo });
  };

  const localDe = (referencia) => {
    if (!referencia) return "";
    return referencia.startsWith("/") ? referencia : join(carpetaMedios, referencia);
  };

  const tema = tarjeta.theme || "otros";

  /* a) rutas ya declaradas en la tarjeta */
  if (tarjeta.imagePath) anotar(localDe(tarjeta.imagePath), tarjeta.imagePath, "imagePath");
  if (tarjeta.wordAudioPath) anotar(localDe(tarjeta.wordAudioPath), tarjeta.wordAudioPath, "wordAudioPath");
  if (tarjeta.example.audioPath) anotar(localDe(tarjeta.example.audioPath), tarjeta.example.audioPath, "example.audioPath");

  /* b) ficheros sueltos: se calcula la ruta de Storage */
  if (!tarjeta.imagePath && medios.imagen) {
    const local = localDe(medios.imagen);
    anotar(local, `images/${tema}/${tarjeta.id}${extension(local)}`, "imagePath");
  }
  if (!tarjeta.wordAudioPath && medios.audioPalabra) {
    const local = localDe(medios.audioPalabra);
    anotar(local, `audio/words/${tarjeta.id}${extension(local)}`, "wordAudioPath");
  }
  if (!tarjeta.example.audioPath && medios.audioEjemplo) {
    const local = localDe(medios.audioEjemplo);
    anotar(local, `audio/examples/${tarjeta.id}_example_01${extension(local)}`, "example.audioPath");
  }

  return plan;
}

function aplicarRuta(tarjeta, campo, rutaStorage) {
  if (campo === "example.audioPath") tarjeta.example.audioPath = rutaStorage;
  else tarjeta[campo] = rutaStorage;
}

/* ---------- 3. cadena completa ---------- */

async function principal() {
  const origen = await leerOrigen();

  const comunes = {
    tema: opciones.tema === true ? "" : opciones.tema,
    capa: opciones.capa ? Number(opciones.capa) : undefined,
    fuente: opciones.fuente === true ? undefined : opciones.fuente,
    libro: opciones.libro === true ? undefined : opciones.libro,
    unidad: opciones.unidad === true ? undefined : opciones.unidad
  };

  let crudas = origen.tarjetas;
  if (opciones.limite) crudas = crudas.slice(0, Number(opciones.limite));

  const tarjetas = [];
  const descartadas = [];
  const medios = [];

  crudas.forEach((cruda) => {
    const tarjeta = normalizarTarjeta(cruda, comunes);
    if (opciones.inactivas) tarjeta.active = false;
    if (opciones["sin-mazo"]) tarjeta.deck = false;

    const problemas = validar(tarjeta);
    if (problemas.length > 0) {
      descartadas.push({ tarjeta, problemas });
      return;
    }

    planDeMedios(tarjeta, cruda).forEach((elemento) => {
      medios.push(elemento);
      aplicarRuta(tarjeta, elemento.campo, elemento.rutaStorage);
    });

    /* Campos internos del origen que no deben acabar en Firestore. */
    delete tarjeta.media;

    tarjetas.push(tarjeta);
  });

  console.log(`\nOrigen: ${opciones.origen}  →  ${basename(ficheroEntrada)}`);
  console.log(`Tarjetas listas: ${tarjetas.length}`);
  console.log(sinMedios
    ? `Medios:          ${medios.length} (no se suben: los sirve Hosting)`
    : `Medios a subir:  ${medios.length}`);
  if (origen.temas && origen.temas.length) console.log(`Temas:           ${origen.temas.length}`);
  if (descartadas.length > 0) {
    console.log(`\nDescartadas (${descartadas.length}):`);
    descartadas.slice(0, 10).forEach(({ tarjeta, problemas }) => {
      console.log(`  - ${tarjeta.word || "(sin palabra)"}: ${problemas.join(", ")}`);
    });
    if (descartadas.length > 10) console.log(`  ... y ${descartadas.length - 10} más`);
  }

  if (pruebaEnSeco) {
    console.log("\n--dry-run: no se sube ni se escribe nada.\n");
    console.log("Primera tarjeta tal y como quedaría en Firestore:\n");
    console.log(JSON.stringify(tarjetas[0], null, 2));
    console.log("\nPrimeros medios:");
    medios.slice(0, 5).forEach((medio) => console.log(`  ${medio.rutaLocal}\n    → ${medio.rutaStorage}`));
    return;
  }

  const { subirMedia, escribirTarjetas, escribirTemas } = await import("./lib/firebase.mjs");

  let subidos = 0;
  for (const medio of (sinMedios ? [] : medios)) {
    const resultado = await subirMedia(medio.rutaLocal, medio.rutaStorage, { forzar: Boolean(opciones.forzar) });
    if (resultado.subido) subidos++;
    process.stdout.write(`\rSubiendo medios: ${subidos}/${medios.length}   `);
  }
  if (!sinMedios && medios.length > 0) process.stdout.write("\n");

  const escritas = await escribirTarjetas(tarjetas);
  const temas = await escribirTemas(origen.temas);

  console.log(`\nListo: ${escritas} tarjetas en Firestore` +
    (sinMedios ? "" : `, ${subidos} medios nuevos en Storage`) +
    (temas ? `, ${temas} temas` : "") + ".\n");
}

principal().catch((error) => {
  console.error("\n" + error.message + "\n");
  process.exit(1);
});
