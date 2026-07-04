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

  function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Llama a la API para una única ruta y devuelve un objeto normalizado:
   *   { ok: true, travelTimeMin, delayMin }
   * o, si algo falla:
   *   { ok: false, motivo }
   * "motivo" es solo informativo (para depurar), nadie más lo exige: el
   * resto de la app únicamente mira "ok". Nunca lanza una excepción hacia
   * fuera: cualquier fallo de red o de la API se traduce en { ok: false }
   * para que esa ruta se muestre como "Sin datos" sin afectar al resto.
   *
   * Si TomTom responde 429 (demasiadas peticiones a la vez — habitual en el
   * plan gratuito cuando se piden varias rutas de golpe), se reintenta una
   * única vez tras una breve espera antes de darla por fallida.
   */
  async function fetchRuta(ruta, apiKey, reintentoTras429 = true) {
    try {
      const url = buildUrl(ruta, apiKey);
      const res = await fetch(url);

      if (res.status === 429 && reintentoTras429) {
        await esperar(700 + Math.random() * 500);
        return fetchRuta(ruta, apiKey, false);
      }

      if (!res.ok) {
        let cuerpo = "";
        try { cuerpo = (await res.text()).slice(0, 200); } catch (e) { /* ignorar */ }
        return { ok: false, motivo: `HTTP ${res.status}${cuerpo ? " — " + cuerpo : ""}` };
      }

      const data = await res.json();
      const summary = data?.routes?.[0]?.summary;

      if (!summary) {
        return { ok: false, motivo: "Respuesta sin \"routes[0].summary\"" };
      }

      const travelTimeMin = Math.round(summary.travelTimeInSeconds / 60);
      const delaySeconds = summary.trafficDelayInSeconds ?? 0;
      const delayMin = Math.round(delaySeconds / 60);

      return { ok: true, travelTimeMin, delayMin };
    } catch (err) {
      return { ok: false, motivo: err && err.message ? err.message : String(err) };
    }
  }

  /**
   * Lanza las llamadas para todas las rutas de todos los destinos definidos
   * en CONFIG, y devuelve un mapa:
   *   { "zarautz.ap8": {ok, travelTimeMin, delayMin}, ... }
   *
   * Se escalonan ligeramente (en vez de lanzarlas todas en el mismo
   * instante) para no chocar con el límite de peticiones simultáneas del
   * plan gratuito de TomTom; el conjunto sigue resolviéndose en paralelo,
   * solo que con un pequeño desfase de salida entre una y otra.
   */
  async function fetchTodasLasRutas(apiKey) {
    const tareas = [];
    const claves = [];
    let indice = 0;

    CONFIG.destinos.forEach(destino => {
      destino.rutas.forEach(ruta => {
        claves.push(`${destino.id}.${ruta.id}`);
        const retraso = indice * 150;
        indice++;
        tareas.push(esperar(retraso).then(() => fetchRuta(ruta, apiKey)));
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
