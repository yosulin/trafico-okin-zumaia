/**
 * ============================================================
 *  APLICACIÓN — lógica de pantalla
 * ============================================================
 *  No contiene datos de destinos/rutas (config.js), ni lógica de
 *  red (api.js), ni de caché (cache.js), ni de histórico (historial.js),
 *  ni de planificación (scheduler.js). Solo orquesta esas piezas y
 *  pinta el resultado en el DOM, siempre de una vez ("atómico").
 * ============================================================
 */

const App = (() => {

  const elGrid = document.getElementById("grid-destinos");
  const elUltimaActualizacion = document.getElementById("ultima-actualizacion");
  const elIndicadorCarga = document.getElementById("indicador-carga");
  const elBotonAjustes = document.getElementById("boton-ajustes");
  const elBotonTV = document.getElementById("boton-tv");
  const elModal = document.getElementById("modal-api-key");
  const elFormApiKey = document.getElementById("form-api-key");
  const elInputApiKey = document.getElementById("input-api-key");
  const elCerrarModal = document.getElementById("cerrar-modal");

  const MODO_TV_KEY = "okin_traffic_modo_tv";
  let temporizadorSiguienteCiclo = null;

  /* ---------- Construcción del grid de tarjetas (una vez) ---------- */

  function construirGrid() {
    elGrid.innerHTML = "";

    CONFIG.destinos.forEach(destino => {
      const card = document.createElement("article");
      card.className = "card";
      card.id = `card-${destino.id}`;

      card.innerHTML = `
        <header class="card__header">
          <span class="card__estado-dot" id="dot-${destino.id}" aria-hidden="true"></span>
          <h2 class="card__titulo">${destino.nombre}</h2>
        </header>
        <div class="card__rutas" id="rutas-${destino.id}">
          ${destino.rutas.map(ruta => filaRutaHTML(destino.id, ruta)).join("")}
        </div>
        <div class="card__historial">
          <div class="historial__tira" id="historial-${destino.id}"></div>
          <div class="historial__etiquetas">
            <span>hace ${CONFIG.historial.bloques * CONFIG.historial.minutosPorBloque / 60}h</span>
            <span>ahora</span>
          </div>
        </div>
      `;

      elGrid.appendChild(card);
    });
  }

  function filaRutaHTML(destinoId, ruta) {
    return `
      <div class="ruta" id="ruta-${destinoId}-${ruta.id}">
        <span class="ruta__linea" id="linea-${destinoId}-${ruta.id}" aria-hidden="true"></span>
        <span class="ruta__nombre">
          ${ruta.nombre}
          <span class="ruta__badge-cache" id="badge-${destinoId}-${ruta.id}"></span>
        </span>
        <span class="ruta__tiempo" id="tiempo-${destinoId}-${ruta.id}">—</span>
        <span class="ruta__retraso" id="retraso-${destinoId}-${ruta.id}">—</span>
        <span class="ruta__semaforo" id="semaforo-${destinoId}-${ruta.id}">–</span>
      </div>
    `;
  }

  /* ---------- Pintado atómico: todo el cálculo antes, el DOM al final ---------- */

  function pintarTodo(estadoEfectivoPorRuta) {
    // 1) Preparamos en memoria todo lo que hay que pintar, destino a destino.
    const actualizacionesPorDestino = CONFIG.destinos.map(destino => {
      let peorIndex = Estado.SIN_DATOS_INDEX;

      const filas = destino.rutas.map(ruta => {
        const clave = `${destino.id}.${ruta.id}`;
        const entrada = estadoEfectivoPorRuta[clave];

        if (entrada && entrada.estadoIndex > peorIndex) {
          peorIndex = entrada.estadoIndex;
        }

        return { destinoId: destino.id, rutaId: ruta.id, entrada };
      });

      const bloquesHistorial = Historial.calcularBloques(destino.id);

      return { destinoId: destino.id, peorIndex, filas, bloquesHistorial };
    });

    // 2) Con todo ya calculado, aplicamos los cambios al DOM de un tirón.
    actualizacionesPorDestino.forEach(({ destinoId, peorIndex, filas, bloquesHistorial }) => {
      filas.forEach(({ rutaId, entrada }) => pintarFila(destinoId, rutaId, entrada));
      pintarDot(destinoId, peorIndex);
      pintarHistorial(destinoId, bloquesHistorial);
    });
  }

  function pintarFila(destinoId, rutaId, entrada) {
    const elTiempo = document.getElementById(`tiempo-${destinoId}-${rutaId}`);
    const elRetraso = document.getElementById(`retraso-${destinoId}-${rutaId}`);
    const elSemaforo = document.getElementById(`semaforo-${destinoId}-${rutaId}`);
    const elLinea = document.getElementById(`linea-${destinoId}-${rutaId}`);
    const elFila = document.getElementById(`ruta-${destinoId}-${rutaId}`);
    const elBadge = document.getElementById(`badge-${destinoId}-${rutaId}`);

    if (!entrada || !entrada.disponible) {
      elTiempo.textContent = "Sin datos";
      elRetraso.textContent = "";
      elSemaforo.textContent = "";
      elLinea.style.backgroundColor = Estado.colorPara(Estado.SIN_DATOS_INDEX);
      elFila.classList.add("ruta--sin-datos");
      elFila.classList.remove("ruta--cache");
      elBadge.textContent = "";
      elFila.title = "";
      return;
    }

    elFila.classList.remove("ruta--sin-datos");

    const tramo = CONFIG.umbrales[entrada.estadoIndex];
    elTiempo.textContent = `${entrada.travelTimeMin} min`;
    elRetraso.textContent = entrada.delayMin > 0 ? `+${entrada.delayMin} min` : "sin retraso";
    elSemaforo.textContent = tramo.emoji;
    elLinea.style.backgroundColor = tramo.color;

    if (entrada.origen === "cache") {
      elFila.classList.add("ruta--cache");
      const minutos = Math.round((Date.now() - entrada.timestamp) / 60000);
      elBadge.textContent = `· hace ${minutos} min`;
      elFila.title = "Último dato disponible; la última consulta ha fallado.";
    } else {
      elFila.classList.remove("ruta--cache");
      elBadge.textContent = "";
      elFila.title = "";
    }
  }

  function pintarDot(destinoId, peorIndex) {
    const dot = document.getElementById(`dot-${destinoId}`);
    dot.style.backgroundColor = Estado.colorPara(peorIndex);
    dot.title = peorIndex === Estado.SIN_DATOS_INDEX ? "Sin datos" : CONFIG.umbrales[peorIndex].etiqueta;
  }

  function pintarHistorial(destinoId, bloques) {
    const contenedor = document.getElementById(`historial-${destinoId}`);
    contenedor.innerHTML = bloques.map(bloque => {
      const color = Estado.colorPara(bloque.estadoIndex);
      const etiqueta = bloque.estadoIndex === Estado.SIN_DATOS_INDEX
        ? "Sin datos"
        : CONFIG.umbrales[bloque.estadoIndex].etiqueta;
      const hora = new Date(bloque.desde).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
      return `<span class="historial__bloque" style="background-color:${color}" title="${hora} · ${etiqueta}"></span>`;
    }).join("");
  }

  /* ---------- Ciclo de actualización (atómico + con caché + con planificador) ---------- */

  async function ejecutarCiclo() {
    const apiKey = obtenerApiKey();
    if (!apiKey) {
      abrirModal();
      return;
    }

    elIndicadorCarga.classList.add("indicador-carga--activo");

    let estadoEfectivo;
    try {
      const resultadosCrudos = await TrafficAPI.fetchTodasLasRutas(apiKey);
      estadoEfectivo = Cache.resolverEstadoEfectivo(resultadosCrudos);
    } catch (err) {
      // Fallo inesperado (ej. sin conexión): tratamos como si todas las
      // rutas hubieran fallado, así la caché decide qué mostrar igualmente.
      const todasFallidas = {};
      CONFIG.destinos.forEach(destino => {
        destino.rutas.forEach(ruta => {
          todasFallidas[`${destino.id}.${ruta.id}`] = { ok: false };
        });
      });
      estadoEfectivo = Cache.resolverEstadoEfectivo(todasFallidas);
    }

    Historial.registrarMuestra(estadoEfectivo);
    pintarTodo(estadoEfectivo);

    elIndicadorCarga.classList.remove("indicador-carga--activo");
    elUltimaActualizacion.textContent =
      `Actualizado a las ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;

    programarSiguienteCiclo();
  }

  function programarSiguienteCiclo() {
    if (temporizadorSiguienteCiclo) clearTimeout(temporizadorSiguienteCiclo);
    const intervaloMin = Planificador.intervaloActualMin();
    temporizadorSiguienteCiclo = setTimeout(ejecutarCiclo, intervaloMin * 60000);
  }

  /* ---------- Gestión de la clave API (solo en el navegador del usuario) ---------- */

  function obtenerApiKey() {
    return localStorage.getItem(CONFIG.api.localStorageKey) || "";
  }

  function guardarApiKey(valor) {
    localStorage.setItem(CONFIG.api.localStorageKey, valor.trim());
  }

  function abrirModal() {
    elInputApiKey.value = obtenerApiKey();
    elModal.showModal();
  }

  function cerrarModal() {
    elModal.close();
  }

  function inicializarModal() {
    elBotonAjustes.addEventListener("click", abrirModal);
    elCerrarModal.addEventListener("click", cerrarModal);

    elFormApiKey.addEventListener("submit", (evento) => {
      evento.preventDefault();
      const valor = elInputApiKey.value.trim();
      if (!valor) return;
      guardarApiKey(valor);
      cerrarModal();
      ejecutarCiclo();
    });
  }

  /* ---------- Modo TV: tarjetas grandes, legibles a distancia ---------- */

  function inicializarModoTV() {
    if (localStorage.getItem(MODO_TV_KEY) === "1") {
      document.body.classList.add("modo-tv");
    }

    elBotonTV.addEventListener("click", () => {
      const activo = document.body.classList.toggle("modo-tv");
      localStorage.setItem(MODO_TV_KEY, activo ? "1" : "0");
    });
  }

  /* ---------- Service Worker (PWA) ---------- */

  function registrarServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    // Solo tiene sentido bajo http(s), no al abrir el fichero en local con file://
    if (location.protocol !== "http:" && location.protocol !== "https:") return;

    navigator.serviceWorker.register("service-worker.js").catch(() => {
      // Si falla el registro (ej. navegador sin soporte completo), la app
      // sigue funcionando con normalidad, simplemente sin modo offline.
    });
  }

  /* ---------- Arranque ---------- */

  function init() {
    construirGrid();
    inicializarModal();
    inicializarModoTV();
    registrarServiceWorker();

    // Si ya hay datos en caché de una sesión anterior, los pintamos
    // inmediatamente (aunque estén algo desfasados) para que la pantalla
    // nunca aparezca vacía mientras llega la primera respuesta de red.
    const cacheVacia = {};
    CONFIG.destinos.forEach(destino => {
      destino.rutas.forEach(ruta => {
        cacheVacia[`${destino.id}.${ruta.id}`] = { ok: false };
      });
    });
    pintarTodo(Cache.resolverEstadoEfectivo(cacheVacia));

    if (obtenerApiKey()) {
      ejecutarCiclo();
    } else {
      abrirModal();
    }
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", App.init);
