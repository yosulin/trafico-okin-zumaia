/**
 * ============================================================
 *  APLICACIÓN — lógica de pantalla
 * ============================================================
 *  Este fichero NO contiene datos de destinos ni de rutas
 *  (eso vive en config.js) ni lógica de red (eso vive en api.js).
 *  Solo se encarga de pintar en pantalla lo que las otras dos
 *  piezas le entregan.
 * ============================================================
 */

const App = (() => {

  const elGrid = document.getElementById("grid-destinos");
  const elUltimaActualizacion = document.getElementById("ultima-actualizacion");
  const elIndicadorCarga = document.getElementById("indicador-carga");
  const elBotonAjustes = document.getElementById("boton-ajustes");
  const elModal = document.getElementById("modal-api-key");
  const elFormApiKey = document.getElementById("form-api-key");
  const elInputApiKey = document.getElementById("input-api-key");
  const elCerrarModal = document.getElementById("cerrar-modal");

  let temporizador = null;

  /* ---------- Semáforo: convierte minutos de retraso en estado ---------- */

  function calcularEstado(delayMin) {
    for (const tramo of CONFIG.umbrales) {
      if (tramo.hasta === null || delayMin <= tramo.hasta) {
        return tramo;
      }
    }
    return CONFIG.umbrales[CONFIG.umbrales.length - 1];
  }

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
      `;

      elGrid.appendChild(card);
    });
  }

  function filaRutaHTML(destinoId, ruta) {
    return `
      <div class="ruta" id="ruta-${destinoId}-${ruta.id}">
        <span class="ruta__linea" id="linea-${destinoId}-${ruta.id}" aria-hidden="true"></span>
        <span class="ruta__nombre">${ruta.nombre}</span>
        <span class="ruta__tiempo" id="tiempo-${destinoId}-${ruta.id}">—</span>
        <span class="ruta__retraso" id="retraso-${destinoId}-${ruta.id}">—</span>
        <span class="ruta__semaforo" id="semaforo-${destinoId}-${ruta.id}">–</span>
      </div>
    `;
  }

  /* ---------- Pintado de resultados sobre el grid ya construido ---------- */

  function pintarResultados(mapa) {
    CONFIG.destinos.forEach(destino => {
      let peorTramoIndex = -1;

      destino.rutas.forEach(ruta => {
        const clave = `${destino.id}.${ruta.id}`;
        const resultado = mapa[clave];

        const elTiempo = document.getElementById(`tiempo-${destino.id}-${ruta.id}`);
        const elRetraso = document.getElementById(`retraso-${destino.id}-${ruta.id}`);
        const elSemaforo = document.getElementById(`semaforo-${destino.id}-${ruta.id}`);
        const elLinea = document.getElementById(`linea-${destino.id}-${ruta.id}`);
        const elFila = document.getElementById(`ruta-${destino.id}-${ruta.id}`);

        if (!resultado || !resultado.ok) {
          elTiempo.textContent = "Sin datos";
          elRetraso.textContent = "";
          elSemaforo.textContent = "";
          elLinea.style.backgroundColor = "var(--color-sin-datos)";
          elFila.classList.add("ruta--sin-datos");
          return;
        }

        elFila.classList.remove("ruta--sin-datos");

        const tramo = calcularEstado(resultado.delayMin);
        const tramoIndex = CONFIG.umbrales.indexOf(tramo);
        if (tramoIndex > peorTramoIndex) peorTramoIndex = tramoIndex;

        elTiempo.textContent = `${resultado.travelTimeMin} min`;
        elRetraso.textContent = resultado.delayMin > 0 ? `+${resultado.delayMin} min` : "sin retraso";
        elSemaforo.textContent = tramo.emoji;
        elLinea.style.backgroundColor = tramo.color;
      });

      // Estado general del destino = el peor de sus rutas
      const dot = document.getElementById(`dot-${destino.id}`);
      if (peorTramoIndex >= 0) {
        const peorTramo = CONFIG.umbrales[peorTramoIndex];
        dot.style.backgroundColor = peorTramo.color;
        dot.title = peorTramo.etiqueta;
      } else {
        dot.style.backgroundColor = "var(--color-sin-datos)";
        dot.title = "Sin datos";
      }
    });
  }

  /* ---------- Ciclo de actualización ---------- */

  async function actualizar() {
    const apiKey = obtenerApiKey();
    if (!apiKey) {
      abrirModal();
      return;
    }

    elIndicadorCarga.classList.add("indicador-carga--activo");

    const mapa = await TrafficAPI.fetchTodasLasRutas(apiKey);
    pintarResultados(mapa);

    elIndicadorCarga.classList.remove("indicador-carga--activo");
    elUltimaActualizacion.textContent = `Actualizado a las ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
  }

  function iniciarCicloActualizacion() {
    if (temporizador) clearInterval(temporizador);
    actualizar();
    temporizador = setInterval(actualizar, CONFIG.refreshIntervalMs);
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
      iniciarCicloActualizacion();
    });
  }

  /* ---------- Arranque ---------- */

  function init() {
    construirGrid();
    inicializarModal();

    if (obtenerApiKey()) {
      iniciarCicloActualizacion();
    } else {
      abrirModal();
    }
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", App.init);
