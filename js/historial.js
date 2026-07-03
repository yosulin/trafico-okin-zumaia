/**
 * ============================================================
 *  HISTORIAL — línea temporal tipo Uptime Kuma
 * ============================================================
 *  Cada ciclo de actualización, se guarda una "muestra" por destino
 *  con el peor estado alcanzado en ese momento. Al pintar, esas
 *  muestras se agrupan en bloques de tiempo fijos (por defecto,
 *  16 bloques de 30 min = últimas 8h) tomando el peor estado de
 *  cada bloque.
 *
 *  No sabe nada de HTML: solo guarda datos y calcula los bloques.
 * ============================================================
 */

const Historial = (() => {

  function leerTodo() {
    try {
      const crudo = localStorage.getItem(CONFIG.historial.localStorageKey);
      return crudo ? JSON.parse(crudo) : {};
    } catch (err) {
      return {};
    }
  }

  function guardarTodo(datos) {
    try {
      localStorage.setItem(CONFIG.historial.localStorageKey, JSON.stringify(datos));
    } catch (err) {
      // Igual que en cache.js: si no se puede persistir, seguimos en memoria.
    }
  }

  /**
   * Registra, para cada destino, el peor estadoIndex de este ciclo
   * (a partir del mapa "estado efectivo" ya resuelto por cache.js).
   * Purga automáticamente muestras más antiguas que la ventana visible
   * (con un pequeño margen extra) para que localStorage no crezca sin límite.
   */
  function registrarMuestra(estadoEfectivoPorRuta) {
    const ahora = Date.now();
    const ventanaMs = CONFIG.historial.bloques * CONFIG.historial.minutosPorBloque * 60 * 1000;
    const margenMs = 30 * 60 * 1000; // margen extra para no perder muestras al calcular bordes de bloque
    const limiteAntiguedad = ahora - ventanaMs - margenMs;

    const datos = leerTodo();

    CONFIG.destinos.forEach(destino => {
      let peorIndex = Estado.SIN_DATOS_INDEX;

      destino.rutas.forEach(ruta => {
        const clave = `${destino.id}.${ruta.id}`;
        const entrada = estadoEfectivoPorRuta[clave];
        if (entrada && entrada.disponible && entrada.estadoIndex > peorIndex) {
          peorIndex = entrada.estadoIndex;
        }
      });

      if (!datos[destino.id]) datos[destino.id] = [];
      datos[destino.id].push({ t: ahora, i: peorIndex });
      datos[destino.id] = datos[destino.id].filter(muestra => muestra.t >= limiteAntiguedad);
    });

    guardarTodo(datos);
  }

  /**
   * Calcula los bloques a pintar para un destino: un array de longitud
   * CONFIG.historial.bloques, del más antiguo al más reciente, cada uno
   * con { estadoIndex, desde, hasta }. estadoIndex es Estado.SIN_DATOS_INDEX
   * si no hubo ninguna muestra dentro de ese bloque.
   */
  function calcularBloques(destinoId) {
    const datos = leerTodo();
    const muestras = datos[destinoId] || [];
    const { bloques, minutosPorBloque } = CONFIG.historial;
    const duracionBloqueMs = minutosPorBloque * 60 * 1000;
    const ahora = Date.now();

    // Bloque 0 = el más antiguo (hace "bloques * minutosPorBloque" minutos),
    // último bloque = el más reciente (ahora mismo).
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

  return { registrarMuestra, calcularBloques };
})();
