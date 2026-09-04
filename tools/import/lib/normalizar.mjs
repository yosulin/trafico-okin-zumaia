/**
 * ============================================================
 *  NORMALIZAR — de "lo que venga" al documento de Firestore
 * ============================================================
 *  Todos los orígenes (JSON, CSV, Anki) acaban aquí, y de aquí sale
 *  siempre la misma forma de documento. Añadir un origen nuevo es
 *  escribir un lector que devuelva objetos sueltos; el resto de la
 *  cadena no cambia.
 *
 *  Los campos que todavía no tenemos (euskera, imagen, tema, capa,
 *  tipo, etiquetas, libro, unidad...) se dejan vacíos a propósito:
 *  el esquema ya los contempla y se pueden rellenar después sin
 *  migrar nada.
 * ============================================================
 */

export const CAMPOS_VACIOS = {
  eu: "",
  theme: "",
  layer: 1,
  type: "",
  imagePath: "",
  wordAudioPath: "",
  tags: []
};

function limpiar(texto) {
  return String(texto == null ? "" : texto)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")          // los campos de Anki traen HTML
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Capa: la de la tarjeta, la común de la importación o 1. Un "" no es un 0. */
function capaDe(valor, porDefecto) {
  const numero = Number(valor);
  if (valor !== "" && valor !== null && valor !== undefined && Number.isFinite(numero)) return numero;
  return porDefecto || CAMPOS_VACIOS.layer;
}

export function idDesde(palabra, tema) {
  const base = limpiar(palabra)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const prefijo = tema ? tema.replace(/[^a-z0-9]+/gi, "").toLowerCase() : "gen";
  /* Sin repetir el tema si la palabra ya empieza por él ("school bag"). */
  return base.startsWith(prefijo + "_") ? base : `${prefijo}_${base}`;
}

/**
 * @param {object} cruda    lo que ha devuelto el lector de origen.
 * @param {object} opciones valores comunes a toda la importación
 *                          (tema, capa, procedencia escolar, libro, unidad).
 * @returns {object} documento listo para Firestore.
 */
export function normalizarTarjeta(cruda, opciones = {}) {
  const tema = limpiar(cruda.theme || opciones.tema || "");
  const palabra = limpiar(cruda.word);

  const ejemplo = cruda.example || {};

  const tarjeta = {
    id: cruda.id || idDesde(palabra, tema),

    word: palabra,
    es: limpiar(cruda.es),
    eu: limpiar(cruda.eu || CAMPOS_VACIOS.eu),

    theme: tema,
    layer: capaDe(cruda.layer, opciones.capa),
    type: limpiar(cruda.type || CAMPOS_VACIOS.type),

    imagePath: cruda.imagePath || CAMPOS_VACIOS.imagePath,
    wordAudioPath: cruda.wordAudioPath || CAMPOS_VACIOS.wordAudioPath,

    example: {
      en: limpiar(ejemplo.en),
      es: limpiar(ejemplo.es),
      eu: limpiar(ejemplo.eu),
      audioPath: ejemplo.audioPath || ""
    },

    tags: Array.isArray(cruda.tags)
      ? cruda.tags.map(limpiar).filter(Boolean)
      : limpiar(cruda.tags).split(/[,;]\s*/).filter(Boolean),

    source: {
      type: (cruda.source && cruda.source.type) || opciones.fuente || "general",
      book: (cruda.source && cruda.source.book) || opciones.libro || null,
      unit: (cruda.source && cruda.source.unit) || opciones.unidad || null
    },

    active: cruda.active === undefined ? true : Boolean(cruda.active)
  };

  /* Campos extra del origen que no están en el esquema base: se
     conservan tal cual (nivel CEFR, edad, dificultad, deck...). */
  Object.keys(cruda).forEach((clave) => {
    if (!(clave in tarjeta) && clave !== "media") tarjeta[clave] = cruda[clave];
  });

  return tarjeta;
}

/** Devuelve la lista de problemas de una tarjeta (vacía si está bien). */
export function validar(tarjeta) {
  const problemas = [];
  if (!tarjeta.id) problemas.push("sin id");
  if (!tarjeta.word) problemas.push("sin word");
  if (!tarjeta.es && !tarjeta.eu) problemas.push("sin traducción (es/eu)");
  if (!/^[a-z0-9_]+$/i.test(tarjeta.id)) problemas.push("id con caracteres raros: " + tarjeta.id);
  return problemas;
}
