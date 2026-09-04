/**
 * ============================================================
 *  DATOS — carga y normalización del vocabulario
 * ============================================================
 *  La interfaz nunca conoce ninguna palabra: todo sale de
 *  data/vocabulario.json. Para añadir contenido basta con añadir
 *  objetos a "tarjetas" en ese fichero (y su imagen en images/).
 *
 *  normalizarTarjeta() rellena lo que falte con valores por defecto
 *  y CONSERVA cualquier campo extra que traiga el JSON (unidad del
 *  libro, nivel CEFR, dificultad, edad...). Así se pueden añadir
 *  campos nuevos sin tocar este módulo ni la interfaz.
 * ============================================================
 */

const Datos = (() => {

  const RUTA = "data/vocabulario.json";

  function normalizarTarjeta(cruda) {
    const ejemplo = cruda.example || {};
    return Object.assign({}, cruda, {
      id: cruda.id,
      word: (cruda.word || "").trim(),
      es: cruda.es || "",
      eu: cruda.eu || "",
      image: cruda.image || "",
      wordAudio: cruda.wordAudio || "",
      /* Respuestas alternativas aceptadas al escribir (opcional en el JSON). */
      aceptar: Array.isArray(cruda.aceptar) ? cruda.aceptar : [],
      example: {
        en: ejemplo.en || "",
        es: ejemplo.es || "",
        eu: ejemplo.eu || "",
        audio: ejemplo.audio || ""
      },
      theme: cruda.theme || "",
      layer: typeof cruda.layer === "number" ? cruda.layer : 1,
      type: cruda.type || "",
      tags: Array.isArray(cruda.tags) ? cruda.tags : []
    });
  }

  /** Descarga y valida el fichero de vocabulario. */
  async function cargar() {
    const respuesta = await fetch(RUTA, { cache: "no-cache" });
    if (!respuesta.ok) throw new Error("No se ha podido cargar " + RUTA);

    const datos = await respuesta.json();
    const tarjetas = (datos.tarjetas || [])
      .filter((tarjeta) => tarjeta && tarjeta.id && tarjeta.word)
      .map(normalizarTarjeta);

    if (tarjetas.length === 0) throw new Error("El vocabulario está vacío");

    const temas = {};
    (datos.temas || []).forEach((tema) => { temas[tema.id] = tema; });

    return { tarjetas, temas };
  }

  /* ---------- orden del mazo ---------- */

  function barajar(lista) {
    const copia = lista.slice();
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  }

  /**
   * Orden de la sesión. No es un SRS: solo pone delante lo que hace
   * falta repasar y lo que no se ha visto nunca, y deja para el final
   * lo que ya se marcó como conocido.
   */
  function ordenarMazo(tarjetas) {
    const prioridad = {
      [Progreso.ESTADOS.REPASAR]: 0,
      [Progreso.ESTADOS.NUEVA]: 1,
      [Progreso.ESTADOS.VISTA]: 2,
      [Progreso.ESTADOS.CONOCIDA]: 3
    };
    const grupos = [[], [], [], []];
    barajar(tarjetas).forEach((tarjeta) => {
      grupos[prioridad[Progreso.estado(tarjeta.id)]].push(tarjeta);
    });
    return grupos[0].concat(grupos[1], grupos[2], grupos[3]);
  }

  return { cargar, ordenarMazo, barajar };

})();
