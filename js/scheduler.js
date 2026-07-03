/**
 * ============================================================
 *  PLANIFICADOR — frecuencia de actualización según la hora
 * ============================================================
 *  Traduce CONFIG.horarios (franjas configurables) en "cuántos
 *  minutos debo esperar antes de la próxima consulta", según la
 *  hora actual del navegador. Así se respeta el plan gratuito de
 *  TomTom fuera de las horas en las que de verdad importa.
 * ============================================================
 */

const Planificador = (() => {

  function horaAMinutos(horaStr) {
    const [h, m] = horaStr.split(":").map(Number);
    return h * 60 + m;
  }

  /**
   * Minutos a esperar hasta la próxima actualización, según la hora
   * actual y los tramos definidos en CONFIG.horarios.
   */
  function intervaloActualMin(fecha = new Date()) {
    const minutosAhora = fecha.getHours() * 60 + fecha.getMinutes();

    for (const tramo of CONFIG.horarios) {
      const inicio = horaAMinutos(tramo.inicio);
      let fin = horaAMinutos(tramo.fin);

      // Un tramo que "termina" en 00:00 se entiende como "hasta medianoche"
      // (fin de día), no como el minuto 0 del mismo día.
      if (fin === 0) fin = 24 * 60;

      if (minutosAhora >= inicio && minutosAhora < fin) {
        return tramo.intervaloMin;
      }
    }

    return CONFIG.intervaloPorDefectoMin;
  }

  return { intervaloActualMin };
})();
