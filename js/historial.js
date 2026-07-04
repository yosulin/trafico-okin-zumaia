/**
 * ============================================================
 *  HISTORIAL — línea temporal tipo Uptime Kuma
 * ============================================================
 *  Los datos NO se generan aquí: los recoge un GitHub Action programado
 *  (independiente de si alguien tiene la web abierta) y los deja en
 *  CONFIG.historial.datosUrl como un JSON estático. Este módulo solo:
 *    - descarga/actualiza ese fichero en memoria (cargar())
 *    - agrupa las muestras en bloques de tiempo fijos para pintarlos
 *      (calcularBloques())
 * ============================================================
 */

const Historial = (() => {

  let datosEnMemoria = { actualizado: null, muestras: {} };

  /**
   * Descarga (o refresca) el histórico compartido. Se puede llamar tantas
   * veces como se quiera (por ejemplo, en cada ciclo de actualización) para
   * ir reflejando lo que el GitHub Action vaya añadiendo con el tiempo.
   * Si falla (sin red, primer despliegue sin Action configurado aún…),
   * simplemente se conserva lo último que había en memoria.
   */
  async function cargar() {
    try {
      // Cache-busting: GitHub Pages puede servir el JSON con caché agresiva,
      // y queremos ver los datos nuevos que vaya dejando el Action.
      const respuesta = await fetch(`${CONFIG.historial.datosUrl}?t=${Date.now()}`);
      if (!respuesta.ok) return;
      const datos = await respuesta.json();
      if (datos && typeof datos === "object") {
        datosEnMemoria = { actualizado: datos.actualizado || null, muestras: datos.muestras || {} };
      }
    } catch (err) {
      // Sin conexión o fichero aún no publicado: seguimos con lo que había.
    }
  }

  /**
   * Calcula los bloques a pintar para un destino: un array de longitud
   * CONFIG.historial.bloques, del más antiguo al más reciente, cada uno
   * con { estadoIndex, desde, hasta }. estadoIndex es Estado.SIN_DATOS_INDEX
   * si no hubo ninguna muestra dentro de ese bloque.
   */
  function calcularBloques(destinoId) {
    const muestras = datosEnMemoria.muestras[destinoId] || [];
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

  return { cargar, calcularBloques };
})();
