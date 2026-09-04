/**
 * ============================================================
 *  VOZ — única puerta de salida de audio de la aplicación
 * ============================================================
 *  Toda la app pide audio por aquí y solo por aquí:
 *
 *      Voz.decir(tarjeta.word, { audio: tarjeta.wordAudio });
 *      Voz.decir(tarjeta.example.en, { audio: tarjeta.example.audio });
 *
 *  Si la tarjeta trae un fichero de audio (mp3/ogg), se reproduce ese
 *  fichero. Si no lo trae, se sintetiza la voz con la Web Speech API.
 *
 *  Esa es toda la gracia del módulo: el día que grabemos (o compremos)
 *  audios reales solo hay que rellenar "wordAudio" / "example.audio" en
 *  el JSON. Ni las tarjetas ni la interfaz cambian una línea.
 * ============================================================
 */

const Voz = (() => {

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
   * Algunos navegadores (iOS sobre todo) solo dejan hablar después de
   * que la persona haya tocado la pantalla. La llamamos una vez desde
   * el botón "Empezar".
   */
  function desbloquear() {
    if (!soportaTTS || desbloqueada) return;
    try {
      const silencio = new SpeechSynthesisUtterance("");
      silencio.volume = 0;
      window.speechSynthesis.speak(silencio);
      desbloqueada = true;
    } catch (error) {
      /* Si falla, simplemente seguirá haciendo falta pulsar "escuchar". */
    }
  }

  /* ---------- reproducción ---------- */

  function parar() {
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
   * Dice un texto en inglés.
   *
   * @param {string} texto       lo que hay que decir.
   * @param {object} opciones
   *        - audio: URL de un fichero de audio; si existe, manda sobre el TTS.
   *        - tipo: "palabra" (más despacio) o "frase".
   * @returns {Promise<void>} se resuelve al terminar; nunca lanza:
   *          si no hay forma de sonar, se resuelve igualmente.
   */
  async function decir(texto, opciones = {}) {
    parar();
    if (!texto) return;

    const velocidad = opciones.tipo === "frase"
      ? AJUSTES.velocidadFrase
      : AJUSTES.velocidadPalabra;

    if (opciones.audio) {
      try {
        await reproducirFichero(opciones.audio);
        return;
      } catch (error) {
        /* Fichero ausente o no reproducible: seguimos con la voz sintética. */
      }
    }

    try {
      await sintetizar(texto, velocidad);
    } catch (error) {
      /* Sin voz disponible: la app sigue funcionando en silencio. */
    }
  }

  function disponible() {
    return soportaTTS;
  }

  return { decir, parar, desbloquear, disponible };

})();
