/**
 * ============================================================
 *  ACCESO A LA API — TomTom Routing API
 * ============================================================
 *  Único fichero que sabe cómo hablar con el proveedor de tráfico.
 *  Si en el futuro quieres cambiar de proveedor (ej. HERE, Google),
 *  solo tienes que reescribir las funciones de este fichero;
 *  el resto de la aplicación no necesita cambiar.
 * ============================================================
 */

const TrafficAPI = (() => {

  /**
   * Construye la URL de "calculateRoute" de TomTom para una ruta concreta.
   * Encadena origen -> (puntos "via" opcionales) -> destino.
   */
  function buildUrl(ruta, apiKey) {
    const puntos = [CONFIG.origin.coords];

    if (Array.isArray(ruta.via)) {
      puntos.push(...ruta.via);
    }

    puntos.push(ruta.destino);

    const locations = puntos
      .map(p => `${p.lat},${p.lon}`)
      .join(":");

    const params = new URLSearchParams({
      key: apiKey,
      traffic: "true",
      routeType: "fastest",
      travelMode: "car"
    });

    return `${CONFIG.api.baseUrl}/${locations}/json?${params.toString()}`;
  }

  /**
   * Llama a la API para una única ruta y devuelve un objeto normalizado:
   *   { ok: true, travelTimeMin, delayMin }
   * o, si algo falla:
   *   { ok: false }
   * Nunca lanza una excepción hacia fuera: cualquier fallo de red o de
   * la API se traduce en { ok: false } para que esa ruta se muestre
   * como "Sin datos" sin afectar al resto del panel.
   */
  async function fetchRuta(ruta, apiKey) {
    try {
      const url = buildUrl(ruta, apiKey);
      const res = await fetch(url);

      if (!res.ok) {
        return { ok: false };
      }

      const data = await res.json();
      const summary = data?.routes?.[0]?.summary;

      if (!summary) {
        return { ok: false };
      }

      const travelTimeMin = Math.round(summary.travelTimeInSeconds / 60);
      const delaySeconds = summary.trafficDelayInSeconds ?? 0;
      const delayMin = Math.round(delaySeconds / 60);

      return { ok: true, travelTimeMin, delayMin };
    } catch (err) {
      return { ok: false };
    }
  }

  /**
   * Lanza en paralelo las llamadas para todas las rutas de todos los
   * destinos definidos en CONFIG, y devuelve un mapa:
   *   { "zarautz.ap8": {ok, travelTimeMin, delayMin}, ... }
   */
  async function fetchTodasLasRutas(apiKey) {
    const tareas = [];
    const claves = [];

    CONFIG.destinos.forEach(destino => {
      destino.rutas.forEach(ruta => {
        claves.push(`${destino.id}.${ruta.id}`);
        tareas.push(fetchRuta(ruta, apiKey));
      });
    });

    const resultados = await Promise.all(tareas);

    const mapa = {};
    claves.forEach((clave, i) => {
      mapa[clave] = resultados[i];
    });

    return mapa;
  }

  return { fetchTodasLasRutas };
})();
