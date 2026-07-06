/**
 * ============================================================
 *  APLICACIÓN — lógica de pantalla
 * ============================================================
 *  No contiene datos de destinos/rutas (config.js), ni acceso a datos
 *  (datos.js). Solo construye el grid, pinta lo que datos.js entrega,
 *  y gestiona el modo TV y la instalación como PWA.
 * ============================================================
 */

const App = (() => {

  const elGrid = document.getElementById("grid-destinos");
  const elUltimaActualizacion = document.getElementById("ultima-actualizacion");
  const elIndicadorCarga = document.getElementById("indicador-carga");
  const elBotonTV = document.getElementById("boton-tv");
  const elBotonInstalar = document.getElementById("boton-instalar");
  const elAvisoIOS = document.getElementById("aviso-ios");
  const elCerrarAvisoIOS = document.getElementById("cerrar-aviso-ios");

  const MODO_TV_KEY = "okin_traffic_modo_tv";
  let temporizadorRefresco = null;

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

  function pintarTodo() {
    const actualizacionesPorDestino = CONFIG.destinos.map(destino => {
      let peorIndex = Estado.SIN_DATOS_INDEX;

      const filas = destino.rutas.map(ruta => {
        const clave = `${destino.id}.${ruta.id}`;
        const entrada = Datos.obtenerEstadoActual(clave);

        if (entrada.disponible && entrada.estadoIndex > peorIndex) {
          peorIndex = entrada.estadoIndex;
        }

        return { destinoId: destino.id, rutaId: ruta.id, entrada };
      });

      const bloquesHistorial = Datos.calcularBloques(destino.id);

      return { destinoId: destino.id, peorIndex, filas, bloquesHistorial };
    });

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

    // Aviso discreto de antigüedad: los datos los deja un GitHub Action
    // programado (best-effort, ver README punto 9), así que puede que
    // el último dato tenga ya unos minutos. A partir de 20 min se avisa;
    // por debajo se considera "reciente" y no hace falta decir nada.
    const minutos = Math.round((Date.now() - entrada.timestamp) / 60000);
    if (minutos >= 20) {
      elFila.classList.add("ruta--cache");
      elBadge.textContent = `· hace ${minutos} min`;
      elFila.title = "Último dato disponible; puede que haya cambiado desde entonces.";
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

  /* ---------- Ciclo de refresco: solo relee el fichero compartido ---------- */

  async function ejecutarCiclo() {
    elIndicadorCarga.classList.add("indicador-carga--activo");

    await Datos.cargar();
    pintarTodo();

    elIndicadorCarga.classList.remove("indicador-carga--activo");

    const ultima = Datos.ultimaActualizacion();
    elUltimaActualizacion.textContent = ultima
      ? `Datos de las ${ultima.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
      : "Sin datos todavía";
  }

  function iniciarRefrescoPeriodico() {
    if (temporizadorRefresco) clearInterval(temporizadorRefresco);
    temporizadorRefresco = setInterval(ejecutarCiclo, CONFIG.datosCompartidos.refrescoMin * 60000);
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

  /* ---------- Instalación como app (PWA) ---------- */

  const AVISO_IOS_CERRADO_KEY = "okin_traffic_aviso_ios_cerrado";
  let promptDiferido = null;

  function enModoStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function esIOS() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }

  function inicializarInstalacion() {
    if (enModoStandalone()) return; // ya está instalada: no mostramos nada

    window.addEventListener("beforeinstallprompt", (evento) => {
      evento.preventDefault();
      promptDiferido = evento;
      elBotonInstalar.hidden = false;
    });

    elBotonInstalar.addEventListener("click", async () => {
      if (!promptDiferido) return;
      elBotonInstalar.hidden = true;
      promptDiferido.prompt();
      await promptDiferido.userChoice;
      promptDiferido = null;
    });

    window.addEventListener("appinstalled", () => {
      elBotonInstalar.hidden = true;
      promptDiferido = null;
    });

    if (esIOS() && localStorage.getItem(AVISO_IOS_CERRADO_KEY) !== "1") {
      elAvisoIOS.hidden = false;
    }

    elCerrarAvisoIOS.addEventListener("click", () => {
      elAvisoIOS.hidden = true;
      localStorage.setItem(AVISO_IOS_CERRADO_KEY, "1");
    });
  }

  /* ---------- Service Worker (PWA) ---------- */

  function registrarServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "http:" && location.protocol !== "https:") return;

    navigator.serviceWorker.register("service-worker.js").catch(() => {
      // Si falla el registro, la app sigue funcionando con normalidad,
      // simplemente sin modo offline.
    });
  }

  /* ---------- Arranque ---------- */

  async function init() {
    construirGrid();
    inicializarModoTV();
    inicializarInstalacion();
    registrarServiceWorker();

    await ejecutarCiclo();       // primera carga
    iniciarRefrescoPeriodico();  // y a partir de ahí, refrescos periódicos
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", App.init);
