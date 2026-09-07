/**
 * ============================================================
 *  ORIGEN ANKI (.apkg)
 * ============================================================
 *      .apkg  →  lib/mazo.mjs (abrir, señuelo, zstd, esquemas)
 *             →  emparejar campos  →  normalizar  →  Firestore
 *
 *  EMPAREJAR POR NOMBRE, NO POR POSICIÓN.
 *  Anki guarda todos los campos de una nota en una sola columna,
 *  separados por 0x1f, y el orden lo decidió quien hizo el mazo. Pedir
 *  ese orden a mano (--campos word=0,es=1...) funciona, pero es
 *  frágil: un dígito mal puesto mete las frases de ejemplo en la
 *  columna de la traducción y no lo avisa nadie.
 *
 *  Como el tipo de nota SÍ trae los nombres de sus campos, aquí se
 *  emparejan por nombre siempre que se reconozcan, y --campos queda
 *  como último recurso para mazos con campos llamados "Field 1".
 *
 *  Los nombres se comparan sin mayúsculas, espacios ni guiones, así
 *  que "Example EN", "example_en" y "ExampleEN" son el mismo campo.
 * ============================================================
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { abrirMazo, SEPARADOR_CAMPOS, audiosDe, imagenesDe, textoLimpio } from "./mazo.mjs";

/** Nombres que reconocemos, y a qué campo nuestro van. */
const SINONIMOS = {
  conceptid: "id", id: "id",

  english: "word", word: "word", front: "word", term: "word", ingles: "word",
  spanish: "es", es: "es", castellano: "es", traduccion: "es", back: "es",
  basque: "eu", eu: "eu", euskara: "eu", euskera: "eu",

  partofspeech: "type", wordtype: "type", type: "type", pos: "type", tipo: "type",
  theme: "theme", tema: "theme", topic: "theme",
  stage: "layer", layer: "layer", capa: "layer",
  tags: "tags", etiquetas: "tags",

  exampleen: "example_en", example: "example_en", sentence: "example_en", ejemplo: "example_en",
  examplees: "example_es", ejemploes: "example_es",
  exampleeu: "example_eu", ejemploeu: "example_eu",

  /* Medios: el valor es "[sound:xxx.mp3]" o "<img src=...>" */
  wordaudioen: "word_audio", wordaudio: "word_audio", audio: "word_audio",
  exampleaudioen: "example_audio", exampleaudio: "example_audio",
  image: "image", imagen: "image",

  definitionen: "definition_en", definition: "definition_en", definicionen: "definition_en",
  definitiones: "definition_es", definiciones: "definition_es", definicion: "definition_es",
  definitioneu: "definition_eu", definizioa: "definition_eu",

  eustatus: "euStatus",
  cefr: "cefr",
  active: "active",
  imageprompt: "imagePrompt"
};

/* Campos del esquema que NO se pueden pisar con un campo suelto del
   mazo: si el mazo trae uno que se llama igual, se guarda con prefijo. */
const RESERVADOS = new Set([
  "id", "word", "es", "eu", "theme", "layer", "type", "tags", "source",
  "example", "definition", "search", "deck", "active", "imagePath", "wordAudioPath",
  "createdAt", "updatedAt"
]);

const clave = (nombre) => String(nombre || "")
  .toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]/g, "");

/**
 * Decide, para un tipo de nota, qué posición ocupa cada campo nuestro.
 * Devuelve { mapa: {word: 0, es: 2, ...}, extras: {"SensesES": 6, ...},
 *            reconocidos: n, total: n }
 */
export function emparejarCampos(nombresDeCampos, forzados = null) {
  const mapa = {};
  const extras = {};
  let reconocidos = 0;

  nombresDeCampos.forEach((nombre, posicion) => {
    const destino = SINONIMOS[clave(nombre)];
    if (destino) {
      /* El primero gana: si un mazo trae "Word" y "WordAudioEN", el
         segundo no debe robarle el sitio al primero. */
      if (mapa[destino] === undefined) { mapa[destino] = posicion; reconocidos += 1; }
    } else if (String(nombre || "").trim()) {
      extras[nombre] = posicion;
    }
  });

  /* --campos manda siempre: es el último recurso y el más explícito. */
  if (forzados) Object.assign(mapa, forzados);

  return { mapa, extras, reconocidos, total: nombresDeCampos.length };
}

/**
 * @param {string} ruta       fichero .apkg
 * @param {object} opciones
 *        - campos: { word: 0, es: 1, ... } fuerza posiciones concretas
 *        - limite: máximo de notas
 *        - sinMedios: no extraer ficheros (solo se anota su nombre)
 * @returns {Promise<{tarjetas: object[], temas: object[], carpetaMedios: string, informe: object}>}
 */
export async function leerApkg(ruta, opciones = {}) {
  const mazo = await abrirMazo(ruta);

  const limite = opciones.limite ? " LIMIT " + Number(opciones.limite) : "";
  const notas = mazo.base
    .prepare("SELECT id, guid, mid, tags, flds FROM notes ORDER BY id" + limite)
    .all();
  mazo.cerrar();

  /* Emparejamiento por tipo de nota: un mazo puede tener varios. */
  const emparejamientos = new Map();
  mazo.tiposDeNota.forEach((tipo) => {
    emparejamientos.set(tipo.id, emparejarCampos(tipo.campos, opciones.campos));
  });

  const extraer = (nombreFichero) => {
    if (opciones.sinMedios) return "";
    const numero = mazo.medios.porNombre.get(nombreFichero);
    if (numero === undefined) return "";
    const contenido = mazo.zip.get(String(numero));
    if (!contenido) return "";
    const destino = join(mazo.carpeta, nombreFichero);
    writeFileSync(destino, contenido);
    return destino;
  };

  const informe = {
    notas: notas.length,
    tiposUsados: new Set(),
    sinEmparejar: 0,
    sinPalabra: 0,
    conAudioPalabra: 0,
    conAudioEjemplo: 0,
    conImagen: 0
  };

  const tarjetas = notas.map((nota) => {
    const tipo = mazo.tipoPorId.get(String(nota.mid));
    const emparejamiento = emparejamientos.get(String(nota.mid));
    const partes = String(nota.flds).split(SEPARADOR_CAMPOS);

    if (tipo) informe.tiposUsados.add(tipo.nombre);
    if (!emparejamiento || emparejamiento.reconocidos === 0) informe.sinEmparejar += 1;

    const mapa = (emparejamiento && emparejamiento.mapa) || {};
    const bruto = (nuestro) => {
      const posicion = mapa[nuestro];
      return posicion === undefined ? "" : (partes[posicion] || "");
    };
    const campo = (nuestro) => textoLimpio(bruto(nuestro));

    /* Los audios suelen tener campo propio, pero en muchos mazos van
       pegados al de la palabra o al del ejemplo: se busca en los dos. */
    const primerAudio = (...nuestros) => {
      for (const nuestro of nuestros) {
        const encontrados = audiosDe(bruto(nuestro));
        if (encontrados.length) return encontrados[0];
      }
      return "";
    };
    const primeraImagen = (...nuestros) => {
      for (const nuestro of nuestros) {
        const encontradas = imagenesDe(bruto(nuestro));
        if (encontradas.length) return encontradas[0];
      }
      return "";
    };

    const audioPalabra = primerAudio("word_audio", "word");
    const audioEjemplo = primerAudio("example_audio", "example_en");
    const imagen = primeraImagen("image", "word");

    if (audioPalabra) informe.conAudioPalabra += 1;
    if (audioEjemplo) informe.conAudioEjemplo += 1;
    if (imagen) informe.conImagen += 1;

    const palabra = campo("word");
    if (!palabra) informe.sinPalabra += 1;

    const tarjeta = {
      id: campo("id") || undefined,
      word: palabra,
      es: campo("es"),
      eu: campo("eu"),
      type: campo("type"),
      theme: campo("theme"),
      layer: campo("layer"),
      example: {
        en: campo("example_en"),
        es: campo("example_es"),
        eu: campo("example_eu")
      },
      /* El diccionario da traducción Y definición en los tres idiomas.
         En el mazo de Oxford vienen vacías —traía glosas, no
         definiciones—, pero el hueco está hecho: en cuanto se rellenen
         en el mazo, aparecen en la app sin tocar código. */
      definition: {
        en: campo("definition_en"),
        es: campo("definition_es"),
        eu: campo("definition_eu")
      },
      /* Las etiquetas del mazo y las del campo "Tags", juntas. */
      tags: [String(nota.tags || "").trim(), campo("tags")].filter(Boolean).join(" "),
      media: {
        imagen: imagen ? extraer(imagen) : "",
        audioPalabra: audioPalabra ? extraer(audioPalabra) : "",
        audioEjemplo: audioEjemplo ? extraer(audioEjemplo) : ""
      },
      /* Aunque no subamos los medios, dejamos apuntado CUÁL era: es lo
         que permitirá enlazarlos después sin volver a abrir el mazo, y
         es la trazabilidad de su procedencia. */
      wordAudioSource: audioPalabra || "",
      exampleAudioSource: audioEjemplo || "",
      imageSource: imagen || "",

      ankiNoteId: String(nota.id),
      ankiGuid: String(nota.guid || "")
    };

    /* Campos del mazo que no sabemos interpretar: se conservan tal cual,
       porque tirarlos es perder trabajo de otro. */
    if (emparejamiento) {
      Object.entries(emparejamiento.extras).forEach(([nombre, posicion]) => {
        const valor = textoLimpio(partes[posicion] || "");
        if (!valor) return;
        const destino = RESERVADOS.has(nombre) ? "anki_" + nombre : nombre;
        tarjeta[destino] = valor;
      });
    }

    return tarjeta;
  });

  informe.tiposUsados = [...informe.tiposUsados];
  informe.emparejamientos = [...emparejamientos.entries()].map(([id, e]) => ({
    tipo: (mazo.tipoPorId.get(id) || {}).nombre || id,
    reconocidos: e.reconocidos,
    total: e.total,
    mapa: e.mapa,
    extras: Object.keys(e.extras)
  }));

  return { tarjetas, temas: [], carpetaMedios: mazo.carpeta, informe };
}
