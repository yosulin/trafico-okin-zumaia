/**
 * ============================================================
 *  ESTADO — utilidades de semáforo compartidas
 * ============================================================
 *  Traduce minutos de retraso al tramo de CONFIG.umbrales que le
 *  corresponde. Se usa desde app.js (pintado) y desde historial.js
 *  (para guardar/leer muestras), así que vive en un único sitio.
 * ============================================================
 */

const Estado = (() => {

  /**
   * Devuelve { tramo, index } para un retraso en minutos dado.
   * "index" es la posición del tramo dentro de CONFIG.umbrales
   * (0 = mejor estado, más alto = peor estado).
   */
  function porRetraso(delayMin) {
    for (let i = 0; i < CONFIG.umbrales.length; i++) {
      const tramo = CONFIG.umbrales[i];
      if (tramo.hasta === null || delayMin <= tramo.hasta) {
        return { tramo, index: i };
      }
    }
    const ultimo = CONFIG.umbrales.length - 1;
    return { tramo: CONFIG.umbrales[ultimo], index: ultimo };
  }

  /** Tramo a usar cuando no hay ningún dato disponible. */
  const SIN_DATOS_INDEX = -1;

  function colorPara(index) {
    if (index === SIN_DATOS_INDEX || index === undefined || index === null) {
      return "var(--color-sin-datos)";
    }
    return CONFIG.umbrales[index].color;
  }

  return { porRetraso, colorPara, SIN_DATOS_INDEX };
})();
