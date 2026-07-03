/**
 * ============================================================
 *  CONFIGURACIÓN — Dashboard de Tráfico OKIN Zumaia
 * ============================================================
 *  Este es el ÚNICO fichero que necesitas tocar para:
 *    - añadir o quitar destinos
 *    - añadir o quitar rutas dentro de un destino
 *    - cambiar los umbrales de color del semáforo
 *    - cambiar la frecuencia de actualización
 *
 *  No hace falta tocar ningún otro fichero .js ni .html para
 *  gestionar el contenido del panel.
 * ============================================================
 */

const CONFIG = {

  /**
   * Punto de origen fijo de todas las rutas.
   * "coords" se usa como primer punto en cada llamada a la API.
   */
  origin: {
    nombre: "OKIN Zumaia",
    coords: { lat: 43.2975, lon: -2.2565 } // TODO: ajusta a la ubicación exacta de la oficina
  },

  /**
   * Frecuencia de actualización automática, en milisegundos.
   * 180000 = 3 minutos
   */
  refreshIntervalMs: 180000,

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
   * Configuración de la API de tráfico.
   * La clave API NUNCA se guarda aquí ni en ningún fichero del repositorio.
   * Se introduce una vez desde la propia web (icono ⚙️) y se guarda solo
   * en el navegador del usuario (localStorage). Ver README.md.
   */
  api: {
    proveedor: "tomtom",
    baseUrl: "https://api.tomtom.com/routing/1/calculateRoute",
    localStorageKey: "okin_traffic_tomtom_api_key"
  }
};
