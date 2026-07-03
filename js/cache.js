/**
 * ============================================================
 *  CACHÉ — último dato válido por ruta
 * ============================================================
 *  Objetivo: que un fallo puntual de la API (o quedarse sin cobertura)
 *  no borre datos de la pantalla. Se guarda el último resultado bueno
 *  de cada ruta y, si una consulta falla, se sigue mostrando ese dato
 *  mientras no supere la antigüedad máxima configurada.
 *
 *  No sabe nada de HTML ni de red: solo lee/escribe localStorage y
 *  decide, para cada ruta, cuál es el "estado efectivo" a mostrar.
 * ============================================================
 */

const Cache = (() => {

  function leerTodo() {
    try {
      const crudo = localStorage.getItem(CONFIG.cache.localStorageKey);
      return crudo ? JSON.parse(crudo) : {};
    } catch (err) {
      return {};
    }
  }

  function guardarTodo(datos) {
    try {
      localStorage.setItem(CONFIG.cache.localStorageKey, JSON.stringify(datos));
    } catch (err) {
      // Si localStorage no está disponible (modo privado, cuota llena…)
      // simplemente se pierde la persistencia entre sesiones; la app
      // sigue funcionando con los datos de esta sesión en memoria.
    }
  }

  /**
   * Combina los resultados crudos de esta ronda de peticiones con la
   * caché existente y devuelve el "estado efectivo" a pintar para
   * cada ruta, además de dejar la caché actualizada en localStorage.
   *
   * @param {Object} resultadosCrudos - mapa "destinoId.rutaId" -> { ok, travelTimeMin, delayMin }
   * @returns {Object} mapa "destinoId.rutaId" -> {
   *   disponible: bool,
   *   travelTimeMin, delayMin, estadoIndex,
   *   origen: "fresco" | "cache" | "sin-datos",
   *   timestamp
   * }
   */
  function resolverEstadoEfectivo(resultadosCrudos) {
    const ahora = Date.now();
    const cacheActual = leerTodo();
    const efectivo = {};
    const maxAntiguedadMs = CONFIG.cache.maxAntiguedadMin * 60 * 1000;

    Object.keys(resultadosCrudos).forEach(clave => {
      const resultado = resultadosCrudos[clave];

      if (resultado && resultado.ok) {
        const { index } = Estado.porRetraso(resultado.delayMin);
        const entrada = {
          travelTimeMin: resultado.travelTimeMin,
          delayMin: resultado.delayMin,
          estadoIndex: index,
          timestamp: ahora
        };
        cacheActual[clave] = entrada;
        efectivo[clave] = { disponible: true, origen: "fresco", ...entrada };
        return;
      }

      // La consulta ha fallado: miramos si hay un dato previo aprovechable.
      const previo = cacheActual[clave];
      if (previo && (ahora - previo.timestamp) <= maxAntiguedadMs) {
        efectivo[clave] = { disponible: true, origen: "cache", ...previo };
      } else {
        efectivo[clave] = { disponible: false, origen: "sin-datos", estadoIndex: Estado.SIN_DATOS_INDEX };
      }
    });

    guardarTodo(cacheActual);
    return efectivo;
  }

  return { resolverEstadoEfectivo };
})();
