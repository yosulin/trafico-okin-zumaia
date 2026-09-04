/**
 * ============================================================
 *  PROGRESO — memoria local, deliberadamente simple
 * ============================================================
 *  Sin usuarios, sin backend y sin algoritmo de repaso espaciado.
 *  Solo guardamos, para cada tarjeta, uno de estos cuatro estados:
 *
 *      nueva     → todavía no la ha visto nunca
 *      vista     → la ha visto, sin decir si la sabía
 *      conocida  → pulsó "La sabía"
 *      repasar   → pulsó "Repasar"
 *
 *  Se guarda en localStorage. Si el navegador no deja escribir
 *  (modo privado, permisos), la app funciona igual: simplemente
 *  no recuerda nada entre sesiones.
 * ============================================================
 */

const Progreso = (() => {

  const CLAVE = "vocabulario-okin-progreso-v1";

  const ESTADOS = {
    NUEVA: "nueva",
    VISTA: "vista",
    CONOCIDA: "conocida",
    REPASAR: "repasar"
  };

  let cache = leerDeDisco();

  function leerDeDisco() {
    try {
      const crudo = window.localStorage.getItem(CLAVE);
      const datos = crudo ? JSON.parse(crudo) : {};
      return (datos && typeof datos === "object") ? datos : {};
    } catch (error) {
      return {};
    }
  }

  function guardarEnDisco() {
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(cache));
    } catch (error) {
      /* Sin almacenamiento: seguimos con la copia en memoria. */
    }
  }

  /** Estado guardado de una tarjeta ("nueva" si no hay nada). */
  function estado(id) {
    const registro = cache[id];
    return (registro && registro.estado) || ESTADOS.NUEVA;
  }

  /** Marca una tarjeta con uno de los cuatro estados. */
  function marcar(id, nuevoEstado) {
    if (!id) return;
    cache[id] = { estado: nuevoEstado, fecha: new Date().toISOString() };
    guardarEnDisco();
  }

  /** Marca como "vista" solo si nunca se había abierto (no pisa nada). */
  function marcarVistaSiEsNueva(id) {
    if (estado(id) === ESTADOS.NUEVA) marcar(id, ESTADOS.VISTA);
  }

  /** Recuento por estado sobre una lista de tarjetas. */
  function resumen(tarjetas) {
    const cuenta = { nueva: 0, vista: 0, conocida: 0, repasar: 0 };
    tarjetas.forEach((tarjeta) => { cuenta[estado(tarjeta.id)] += 1; });
    return cuenta;
  }

  function reiniciar() {
    cache = {};
    try { window.localStorage.removeItem(CLAVE); } catch (error) { /* nada */ }
  }

  return { ESTADOS, estado, marcar, marcarVistaSiEsNueva, resumen, reiniciar };

})();
