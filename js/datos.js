/**
 * ============================================================
 *  DATOS — fichero compartido (estado en vivo + histórico)
 * ============================================================
 *  Único punto de entrada de datos de tráfico para la web. El navegador
 *  NUNCA llama a TomTom directamente: todo sale de CONFIG.datosCompartidos.url,
 *  un JSON que actualiza un GitHub Action programado (ver
 *  scripts/actualizar-historial.mjs y README punto 4).
 *
 *  Expone:
 *    - cargar()                    → descarga/refresca el fichero en memoria
 *    - obtenerEstadoActual(clave)  → estado "en vivo" de una ruta ("destino.ruta")
 *    - calcularBloques(destinoId)  → bloques de la línea temporal de un destino
 *    - ultimaActualizacion()       → cuándo generó el Action estos datos
 * ============================================================
 */

const Datos = (() => {

  let enMemoria = { actualizado: null, estadoActual: {}, muestras: {} };

  /**
   * Descarga (o refresca) el fichero compartido. Se puede llamar tantas
   * veces como se quiera; si falla (sin red, fichero aún no publicado…)
   * simplemente se conserva lo último que había en memoria.
   */
  async function cargar() {
    try {
      // Cache-busting: es un fichero estático y GitHub Pages puede
      // servirlo con caché agresiva; queremos ver siempre lo último
      // que haya dejado el Action.
      const respuesta = await fetch(`${CONFIG.datosCompartidos.url}?t=${Date.now()}`);
      if (!respuesta.ok) return;
      const datos = await respuesta.json();
      if (datos && typeof datos === "object") {
        enMemoria = {
          actualizado: datos.actualizado || null,
          estadoActual: datos.estadoActual || {},
          muestras: datos.muestras || {}
        };
      }
    } catch (err) {
      // Sin conexión o primer despliegue sin Action ejecutado aún: seguimos con lo que había.
    }
  }

  /**
   * Estado "en vivo" de una ruta concreta ("destinoId.rutaId"). Devuelve
   * { disponible: true, travelTimeMin, delayMin, estadoIndex, timestamp }
   * o { disponible: false } si nunca hubo dato o el Action ya lo descartó
   * por superar CONFIG.datosCompartidos.maxAntiguedadEstadoActualMin
   * (el propio Action aplica ese límite antes de publicar el fichero).
   */
  function obtenerEstadoActual(clave) {
    const entrada = enMemoria.estadoActual[clave];
    if (!entrada) return { disponible: false };
    return { disponible: true, ...entrada };
  }

  /**
   * Calcula los bloques a pintar para un destino: un array de longitud
   * CONFIG.historial.bloques, del más antiguo al más reciente, cada uno
   * con { estadoIndex, desde, hasta }. estadoIndex es Estado.SIN_DATOS_INDEX
   * si no hubo ninguna muestra dentro de ese bloque.
   */
  function calcularBloques(destinoId) {
    const muestras = enMemoria.muestras[destinoId] || [];
    const { bloques, minutosPorBloque } = CONFIG.historial;
    const duracionBloqueMs = minutosPorBloque * 60 * 1000;
    const ahora = Date.now();
    const inicioVentana = ahora - bloques * duracionBloqueMs;

    const resultado = [];
    for (let b = 0; b < bloques; b++) {
      const desde = inicioVentana + b * duracionBloqueMs;
      const hasta = desde + duracionBloqueMs;

      let peorIndex = Estado.SIN_DATOS_INDEX;
      muestras.forEach(muestra => {
        if (muestra.t >= desde && muestra.t < hasta && muestra.i > peorIndex) {
          peorIndex = muestra.i;
        }
      });

      resultado.push({ estadoIndex: peorIndex, desde, hasta });
    }

    return resultado;
  }

  function ultimaActualizacion() {
    return enMemoria.actualizado ? new Date(enMemoria.actualizado) : null;
  }

  return { cargar, obtenerEstadoActual, calcularBloques, ultimaActualizacion };
})();
