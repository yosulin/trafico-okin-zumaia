/**
 * ============================================================
 *  DATOS — las tarjetas viven en Firestore
 * ============================================================
 *  Colección "cards": un documento por tarjeta. La app solo lee, y
 *  solo las activas (active == true); escribir tarjetas es cosa del
 *  importador de tools/import/, que entra con credenciales de
 *  administrador. Las reglas de Firestore lo imponen de verdad.
 *
 *  normalizar() rellena lo que falte y CONSERVA cualquier campo extra
 *  del documento (source, book, unit, cefr, dificultad...), para que
 *  añadir campos nuevos al contenido no obligue a tocar la app.
 * ============================================================
 */

import { collection, getDocs, limit, query, where } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db } from "./firebase.js";

/* Etiqueta que se ve sobre el dibujo. Si existe la colección "themes"
   en Firestore, manda ella; esto es solo el respaldo por defecto. */
const TEMAS_POR_DEFECTO = {
  animals:  { es: "Animales",  eu: "Animaliak", emoji: "🐾" },
  food:     { es: "Comida",    eu: "Janaria",   emoji: "🍎" },
  school:   { es: "Colegio",   eu: "Eskola",    emoji: "🎒" },
  family:   { es: "Familia",   eu: "Familia",   emoji: "👨‍👩‍👧" },
  feelings: { es: "Emociones", eu: "Emozioak",  emoji: "😀" },
  actions:  { es: "Acciones",  eu: "Ekintzak",  emoji: "⚽" },
  colors:   { es: "Colores",   eu: "Koloreak",  emoji: "🎨" },
  weather:  { es: "Tiempo",    eu: "Eguraldia", emoji: "🌦️" }
};

function normalizar(id, datos) {
  const ejemplo = datos.example || {};
  return Object.assign({}, datos, {
    id,
    word: (datos.word || "").trim(),
    es: datos.es || "",
    eu: datos.eu || "",
    imagePath: datos.imagePath || "",
    wordAudioPath: datos.wordAudioPath || "",
    /* Respuestas alternativas admitidas al escribir (opcional). */
    aceptar: Array.isArray(datos.aceptar) ? datos.aceptar : [],
    example: {
      en: ejemplo.en || "",
      es: ejemplo.es || "",
      eu: ejemplo.eu || "",
      audioPath: ejemplo.audioPath || ""
    },
    theme: datos.theme || "",
    layer: typeof datos.layer === "number" ? datos.layer : 1,
    type: datos.type || "",
    tags: Array.isArray(datos.tags) ? datos.tags : [],
    source: datos.source || { type: "general", book: null, unit: null }
  });
}

/**
 * Las tarjetas del juego: activas y marcadas para el mazo.
 * Sin conexión salen de la caché de Firestore.
 */
export async function cargarTarjetas() {
  const consulta = query(
    collection(db, "cards"),
    where("active", "==", true),
    where("deck", "==", true)
  );
  const respuesta = await getDocs(consulta);
  return respuesta.docs.map((documento) => normalizar(documento.id, documento.data()));
}

/* ---------- diccionario ---------- */

const IDIOMAS = ["en", "es", "eu"];

/** Igual que textoDeBusqueda() del importador: lo que se guarda en "search". */
export function textoDeBusqueda(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?;:'"\u00bf\u00a1]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function unir(respuestas) {
  const porId = new Map();
  respuestas.forEach((respuesta) => {
    respuesta.docs.forEach((documento) => {
      if (!porId.has(documento.id)) {
        porId.set(documento.id, normalizar(documento.id, documento.data()));
      }
    });
  });
  return [...porId.values()];
}

/**
 * Busca una palabra en los tres idiomas a la vez: se escriba "dog",
 * "perro" o "txakurra", sale la misma entrada.
 *
 * Primero la palabra exacta. Si no hay nada, prueba por principio de
 * palabra ("txak" → "txakurra"), que necesita índices compuestos; si no
 * están desplegados Firestore protesta y nos quedamos con lo exacto en
 * lugar de romper.
 */
export async function buscar(termino) {
  const texto = textoDeBusqueda(termino);
  if (!texto) return [];

  const exactas = await Promise.all(IDIOMAS.map((idioma) => getDocs(query(
    collection(db, "cards"),
    where("active", "==", true),
    where("search." + idioma, "==", texto),
    limit(10)
  ))));

  const encontradas = unir(exactas);
  if (encontradas.length > 0) return encontradas;

  try {
    const porPrincipio = await Promise.all(IDIOMAS.map((idioma) => getDocs(query(
      collection(db, "cards"),
      where("active", "==", true),
      where("search." + idioma, ">=", texto),
      where("search." + idioma, "<", texto + "\uf8ff"),
      limit(8)
    ))));
    return unir(porPrincipio);
  } catch (error) {
    return [];
  }
}

/** Etiquetas de tema. Si la colección no existe o no se puede leer, valen las de aquí. */
export async function cargarTemas() {
  const temas = Object.assign({}, TEMAS_POR_DEFECTO);
  try {
    const respuesta = await getDocs(collection(db, "themes"));
    respuesta.docs.forEach((documento) => {
      temas[documento.id] = Object.assign({}, temas[documento.id], documento.data());
    });
  } catch (error) {
    /* Colección opcional: seguimos con las etiquetas por defecto. */
  }
  return temas;
}

/* ---------- orden del mazo ---------- */

export function barajar(lista) {
  const copia = lista.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Orden de la sesión. Sigue sin ser un SRS: solo pone delante lo que
 * hay que repasar y lo que no se ha visto nunca, y deja para el final
 * lo que ya se sabe.
 */
export function ordenarMazo(tarjetas, estadoDe) {
  const prioridad = { review: 0, new: 1, learning: 2, known: 3 };
  const grupos = [[], [], [], []];
  barajar(tarjetas).forEach((tarjeta) => {
    const puesto = prioridad[estadoDe(tarjeta.id)];
    grupos[puesto === undefined ? 1 : puesto].push(tarjeta);
  });
  return grupos[0].concat(grupos[1], grupos[2], grupos[3]);
}
