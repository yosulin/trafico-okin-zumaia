/**
 * ============================================================
 *  AUDIO — única puerta de salida de sonido de la aplicación
 * ============================================================
 *  La interfaz solo llama a dos funciones:
 *
 *      playWordAudio(tarjeta)
 *      playExampleAudio(tarjeta)
 *
 *  y cada una decide sola:
 *
 *      ¿la tarjeta tiene audio en Firebase Storage?
 *          → se reproduce ese fichero
 *      si no
 *          → se sintetiza con la Web Speech API (voz en-GB)
 *
 *  Por eso ir sustituyendo el TTS por MP3 reales no exige tocar ni la
 *  interfaz ni la estructura de las tarjetas: basta con subir el audio
 *  y rellenar wordAudioPath / example.audioPath en Firestore.
 * ============================================================
 */

import { urlDe } from "./media.js";

const AJUSTES = {
  /* Preferimos inglés británico; si el dispositivo no lo tiene, vamos
     bajando por la lista hasta encontrar cualquier voz inglesa. */
  idiomasPreferidos: ["en-GB", "en-AU", "en-IE", "en-US", "en"],
  /* Un poco más lento que el habla normal: es para aprender. */
  velocidadPalabra: 0.85,
  velocidadFrase: 0.9
};

let vozElegida = null;
let desbloqueada = false;
let audioEnCurso = null;

const soportaTTS = typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  typeof window.SpeechSynthesisUtterance === "function";

/* ---------- selección de voz ---------- */

function puntuar(voz) {
  const idioma = (voz.lang || "").replace("_", "-");
  for (let i = 0; i < AJUSTES.idiomasPreferidos.length; i++) {
    const preferido = AJUSTES.idiomasPreferidos[i];
    const coincide = preferido.includes("-")
      ? idioma.toLowerCase() === preferido.toLowerCase()
      : idioma.toLowerCase().startsWith(preferido.toLowerCase());
    if (coincide) return i;
  }
  return -1;
}

function elegirVoz() {
  if (!soportaTTS) return null;
  const voces = window.speechSynthesis.getVoices() || [];
  let mejor = null;
  let mejorPuntuacion = Infinity;
  voces.forEach((voz) => {
    const puntuacion = puntuar(voz);
    if (puntuacion === -1) return;
    if (puntuacion < mejorPuntuacion) {
      mejorPuntuacion = puntuacion;
      mejor = voz;
    }
  });
  vozElegida = mejor;
  return vozElegida;
}

/* La lista de voces llega de forma asíncrona en muchos navegadores. */
if (soportaTTS) {
  elegirVoz();
  window.speechSynthesis.addEventListener("voiceschanged", elegirVoz);
}

/**
 * Algunos navegadores (iOS sobre todo) solo dejan sonar algo después de
 * que la persona haya tocado la pantalla. Se llama una vez desde el
 * botón "Empezar".
 */
export function desbloquear() {
  if (!soportaTTS || desbloqueada) return;
  try {
    const silencio = new SpeechSynthesisUtterance("");
    silencio.volume = 0;
    window.speechSynthesis.speak(silencio);
    desbloqueada = true;
  } catch (error) {
    /* Si falla, solo significa que habrá que pulsar "escuchar". */
  }
}

/* ---------- reproducción ---------- */

export function parar() {
  if (audioEnCurso) {
    audioEnCurso.pause();
    audioEnCurso.currentTime = 0;
    audioEnCurso = null;
  }
  if (soportaTTS) window.speechSynthesis.cancel();
}

function reproducirFichero(url) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    audioEnCurso = audio;
    audio.addEventListener("ended", resolve, { once: true });
    audio.addEventListener("error", () => reject(new Error("audio-no-disponible")), { once: true });
    audio.play().catch(reject);
  });
}

function sintetizar(texto, velocidad) {
  return new Promise((resolve, reject) => {
    if (!soportaTTS) {
      reject(new Error("sin-sintesis-de-voz"));
      return;
    }
    const frase = new SpeechSynthesisUtterance(texto);
    const voz = vozElegida || elegirVoz();
    if (voz) frase.voice = voz;
    frase.lang = (voz && voz.lang) || "en-GB";
    frase.rate = velocidad;
    frase.pitch = 1;
    frase.addEventListener("end", resolve, { once: true });
    frase.addEventListener("error", () => reject(new Error("error-de-sintesis")), { once: true });
    window.speechSynthesis.speak(frase);
  });
}

/**
 * Dice un texto en inglés: fichero de Storage si lo hay, voz sintética si no.
 *
 * @param {string} texto        lo que hay que decir.
 * @param {string} rutaStorage  ruta en Firebase Storage (puede ir vacía).
 * @param {string} tipo         "palabra" (más despacio) o "frase".
 * @returns {Promise<void>} nunca lanza: si no hay forma de sonar, se resuelve igual.
 */
async function decir(texto, rutaStorage, tipo) {
  parar();
  if (!texto) return;

  const url = await urlDe(rutaStorage);
  if (url) {
    try {
      await reproducirFichero(url);
      return;
    } catch (error) {
      /* Fichero ausente o no reproducible: seguimos con la voz sintética. */
    }
  }

  try {
    await sintetizar(texto, tipo === "frase" ? AJUSTES.velocidadFrase : AJUSTES.velocidadPalabra);
  } catch (error) {
    /* Sin voz disponible: la app sigue funcionando en silencio. */
  }
}

export function playWordAudio(tarjeta) {
  return decir(tarjeta.word, tarjeta.wordAudioPath, "palabra");
}

export function playExampleAudio(tarjeta) {
  return decir(tarjeta.example.en, tarjeta.example.audioPath, "frase");
}

export function hayVozDelNavegador() {
  return soportaTTS;
}
