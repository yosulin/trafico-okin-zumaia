/**
 * ============================================================
 *  CONFIGURACIÓN — Dashboard de Tráfico OKIN Zumaia
 * ============================================================
 *  Este es el ÚNICO fichero que necesitas tocar para:
 *    - añadir o quitar destinos
 *    - añadir o quitar rutas dentro de un destino
 *    - cambiar los umbrales de color del semáforo
 *    - cambiar cada cuánto refresca el navegador el fichero compartido
 *    - cambiar el rango y la resolución del histórico visual
 *
 *  No hace falta tocar ningún otro fichero .js ni .html para
 *  gestionar el contenido del panel.
 *
 *  IMPORTANTE — arquitectura: el navegador de quien visita la web NUNCA
 *  llama a TomTom directamente, y nunca se le pide ninguna clave de API.
 *  La única llamada a TomTom la hace un GitHub Action programado (con
 *  una clave guardada como secret del repositorio, ver README punto 4),
 *  que deja el resultado en un fichero JSON compartido. La web
 *  simplemente lee ese fichero. Así la clave nunca viaja por el
 *  navegador de nadie, y nadie tiene que configurar nada para poder ver
 *  el panel.
 * ============================================================
 */

const CONFIG = {

  /**
   * Punto de origen fijo de todas las rutas (lo usa el GitHub Action).
   */
  origin: {
    nombre: "OKIN Zumaia",
    coords: { lat: 43.2975, lon: -2.2565 } // TODO: ajusta a la ubicación exacta de la oficina
  },

  /**
   * Umbrales de retraso (en minutos) que determinan el color del semáforo.
   * "hasta" es el límite superior (inclusive) de cada tramo.
   * El último tramo no necesita "hasta": es "todo lo que sobra".
   */
  umbrales: [
    { estado: "normal",        hasta: 5,   color: "#4E9A6C", emoji: "🟢", etiqueta: "Normal" },
    { estado: "lento",         hasta: 10,  color: "#D9A93C", emoji: "🟡", etiqueta: "Tráfico lento" },
    { estado: "retenciones",   hasta: 20,  color: "#D9843C", emoji: "🟠", etiqueta: "Retenciones" },
    { estado: "importante",    hasta: null, color: "#C4573F", emoji: "🔴", etiqueta: "Tráfico importante" }
  ],

  /**
   * Destinos y sus rutas.
   *
   * Cada destino tiene:
   *   - id: identificador corto, sin espacios (se usa internamente)
   *   - nombre: lo que se muestra en pantalla
   *   - rutas: array de rutas posibles para llegar a ese destino
   *
   * Cada ruta tiene:
   *   - id: identificador corto, único dentro del destino
   *   - nombre: lo que se muestra en pantalla (ej. "AP-8", "Alto de Meagas")
   *   - destino: coordenadas del punto final de esa ruta
   *   - via: (opcional) array de puntos intermedios para forzar que la
   *          ruta calculada pase por una carretera concreta (por ejemplo,
   *          para diferenciar "AP-8" de "N-634" hacia el mismo destino).
   *          Si no se indica, la API elegirá su ruta más rápida por defecto.
   *
   * IMPORTANTE sobre coordenadas:
   *   Las coordenadas incluidas abajo son aproximadas (centro del núcleo
   *   urbano / punto de referencia en la carretera indicada). Verifícalas
   *   y ajústalas si quieres más precisión: en Google Maps, clic derecho
   *   sobre el punto exacto → aparecen las coordenadas para copiar.
   */
  destinos: [
    {
      id: "zarautz",
      nombre: "Zarautz",
      rutas: [
        {
          id: "ap8",
          nombre: "AP-8",
          destino: { lat: 43.2833, lon: -2.1700 }
          // Sin "via": se deja que la API calcule la ruta más rápida
          // (normalmente autopista AP-8).
        },
        {
          id: "meagas",
          nombre: "Alto de Meagas",
          destino: { lat: 43.2833, lon: -2.1700 },
          via: [{ lat: 43.2660, lon: -2.2110 }] // punto en el Alto de Meagas, ajustar si hace falta
        }
      ]
    },
    {
      id: "donostia",
      nombre: "Donostia",
      rutas: [
        {
          id: "ap8",
          nombre: "AP-8",
          destino: { lat: 43.3183, lon: -1.9812 }
        },
        {
          id: "n634",
          nombre: "N-634",
          destino: { lat: 43.3183, lon: -1.9812 },
          via: [{ lat: 43.2831, lon: -2.1306 }] // Orio, para forzar la N-634 por la costa
        }
      ]
    },
    {
      id: "eibar",
      nombre: "Eibar",
      rutas: [
        {
          id: "ap8ap1",
          nombre: "AP-8 / AP-1",
          destino: { lat: 43.1837, lon: -2.4720 }
        }
      ]
    },
    {
      id: "irun",
      nombre: "Irún",
      rutas: [
        {
          id: "ap8",
          nombre: "AP-8",
          destino: { lat: 43.3383, lon: -1.7900 }
        }
      ]
    }
  ],

  /**
   * Configuración de la API de tráfico. Solo la usa el GitHub Action
   * (scripts/actualizar-historial.mjs), nunca el navegador. La clave en
   * sí NUNCA está aquí ni en ningún fichero del repositorio: vive
   * únicamente como secret del repositorio (Settings → Secrets and
   * variables → Actions → TOMTOM_API_KEY). Ver README punto 4.
   */
  api: {
    proveedor: "tomtom",
    baseUrl: "https://api.tomtom.com/routing/1/calculateRoute"
  },

  /**
   * Fichero de datos compartido: lo escribe el GitHub Action, lo lee la
   * web. Es la ÚNICA fuente de datos de tráfico para todo el mundo que
   * visita la página — nadie hace peticiones propias a TomTom.
   */
  datosCompartidos: {
    url: "data/historial.json",

    // Cada cuánto vuelve a pedir el navegador este fichero (es un simple
    // fichero estático, así que no hay ningún límite de peticiones que
    // cuidar aquí; esto solo controla cómo de rápido se entera la pantalla
    // de que el Action ha dejado un dato nuevo).
    refrescoMin: 2,

    // Si el último dato bueno de una ruta supera esta antigüedad (en
    // minutos), se muestra como "Sin datos" en vez de un número
    // desactualizado. Se pone generoso a propósito: los workflows
    // programados de GitHub Actions son "best effort" y a veces se
    // retrasan bastante (ver README punto 9), así que un umbral muy
    // ajustado haría parpadear "Sin datos" sin motivo real.
    maxAntiguedadEstadoActualMin: 90
  },

  /**
   * Histórico visual tipo "Uptime Kuma" bajo cada destino.
   * Se muestran "bloques" de "minutosPorBloque" minutos cada uno,
   * cubriendo entre los dos un total de (bloques * minutosPorBloque) minutos.
   * Con los valores por defecto: 16 bloques x 30 min = últimas 8 horas.
   */
  historial: {
    bloques: 16,
    minutosPorBloque: 30
  },

  /**
   * PWA / Service Worker.
   * Puramente informativo / documental: el valor real que manda es la
   * constante CACHE_NAME de service-worker.js (los service workers no
   * pueden leer config.js en tiempo de instalación). Cuando cambies
   * ficheros y quieras forzar la descarga en quien ya tenga la app
   * instalada, sube el número en AMBOS sitios a la vez.
   */
  pwa: {
    cacheVersion: "okin-traffic-v2"
  }
};
