/**
 * ============================================================
 *  APP — la experiencia de la tarjeta
 * ============================================================
 *  Flujo de una tarjeta:
 *
 *    PREGUNTA   dibujo grande + audio automático de la palabra
 *               + campo para escribirla + "Comprobar"
 *        ↓
 *    RESPUESTA  palabra en inglés + audio + castellano + euskera
 *               + frase de ejemplo (con audio y traducciones)
 *        ↓
 *    "La sabía" / "Repasar"  → siguiente tarjeta
 *
 *  Esta capa no sabe nada de cómo suena el audio (eso es Voz) ni de
 *  dónde salen las palabras (eso es Datos) ni de cómo se guarda el
 *  progreso (eso es Progreso).
 * ============================================================
 */

(() => {

  /* ---------- referencias al DOM ---------- */

  const $ = (id) => document.getElementById(id);

  const pantallas = {
    inicio: $("pantalla-inicio"),
    tarjeta: $("pantalla-tarjeta"),
    final: $("pantalla-final")
  };

  const el = {
    marcadorInicio: $("marcador-inicio"),
    marcadorFinal: $("marcador-final"),
    empezar: $("boton-empezar"),
    reiniciar: $("boton-reiniciar"),
    otraVuelta: $("boton-otra-vuelta"),
    avisoAudio: $("aviso-audio"),
    error: $("error"),

    progresoRelleno: $("progreso-relleno"),
    progresoTexto: $("progreso-texto"),

    imagen: $("escena-img"),
    tema: $("escena-tema"),

    caraPregunta: $("cara-pregunta"),
    caraRespuesta: $("cara-respuesta"),
    escucharPregunta: $("boton-escuchar-pregunta"),
    formRespuesta: $("form-respuesta"),
    campo: $("campo-respuesta"),
    verRespuesta: $("boton-ver-respuesta"),

    veredicto: $("veredicto"),
    palabraEn: $("palabra-en"),
    palabraEs: $("palabra-es"),
    palabraEu: $("palabra-eu"),
    escucharPalabra: $("boton-escuchar-palabra"),

    ejemploEn: $("ejemplo-en"),
    ejemploEs: $("ejemplo-es"),
    ejemploEu: $("ejemplo-eu"),
    escucharEjemplo: $("boton-escuchar-ejemplo"),
    verTraduccion: $("boton-ver-traduccion"),
    ejemploTraducciones: $("ejemplo-traducciones"),

    repasar: $("boton-repasar"),
    sabia: $("boton-sabia"),
    instalar: $("boton-instalar")
  };

  /* ---------- estado en memoria de la sesión ---------- */

  let tarjetas = [];
  let temas = {};
  let mazo = [];
  let indice = 0;

  /* ---------- utilidades ---------- */

  function mostrarPantalla(nombre) {
    Object.keys(pantallas).forEach((clave) => {
      pantallas[clave].hidden = (clave !== nombre);
    });
  }

  /** Compara lo escrito con la respuesta esperada de forma tolerante. */
  function normalizar(texto) {
    return (texto || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // sin acentos
      .replace(/[.,!?;:'"]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function esCorrecta(escrito, tarjeta) {
    const valido = [tarjeta.word].concat(tarjeta.aceptar).map(normalizar);
    return valido.includes(normalizar(escrito));
  }

  /** Marca visualmente el botón que está sonando. */
  async function sonar(boton, texto, opciones) {
    if (boton) boton.classList.add("boton--sonando");
    await Voz.decir(texto, opciones);
    if (boton) boton.classList.remove("boton--sonando");
  }

  function pintarMarcador(lista) {
    const cuenta = Progreso.resumen(tarjetas);
    const etiquetas = [
      { estado: "conocida", texto: "La sabía" },
      { estado: "repasar", texto: "Repasar" },
      { estado: "vista", texto: "Vistas" },
      { estado: "nueva", texto: "Nuevas" }
    ];
    lista.innerHTML = etiquetas
      .map((item) => `<li data-estado="${item.estado}"><b>${cuenta[item.estado]}</b><span>${item.texto}</span></li>`)
      .join("");
  }

  /* ---------- ciclo de la tarjeta ---------- */

  function tarjetaActual() {
    return mazo[indice];
  }

  function mostrarPregunta() {
    const tarjeta = tarjetaActual();

    el.progresoTexto.textContent = (indice + 1) + " / " + mazo.length;
    el.progresoRelleno.style.width = ((indice + 1) / mazo.length * 100) + "%";

    el.imagen.src = tarjeta.image;
    el.imagen.alt = "Escena en gris donde solo aparece en color: " + tarjeta.es;
    const tema = temas[tarjeta.theme];
    el.tema.textContent = tema ? ((tema.emoji || "") + " " + tema.es).trim() : "";
    el.tema.hidden = !tema;

    el.caraRespuesta.hidden = true;
    el.caraPregunta.hidden = false;
    el.campo.value = "";
    el.campo.classList.remove("es-correcta", "es-fallo");
    el.veredicto.hidden = true;
    el.ejemploTraducciones.hidden = true;
    el.verTraduccion.setAttribute("aria-expanded", "false");
    el.verTraduccion.textContent = "Ver la traducción";

    Progreso.marcarVistaSiEsNueva(tarjeta.id);

    /* Audio automático al entrar en la tarjeta. */
    sonar(el.escucharPregunta, tarjeta.word, { audio: tarjeta.wordAudio });

    /* En móvil el foco automático abre el teclado y tapa el dibujo,
       así que solo enfocamos cuando hay sitio de sobra. */
    if (window.matchMedia("(min-width: 700px)").matches) el.campo.focus();
  }

  function mostrarRespuesta(veredicto) {
    const tarjeta = tarjetaActual();

    el.caraPregunta.hidden = true;
    el.caraRespuesta.hidden = false;

    if (veredicto) {
      el.veredicto.hidden = false;
      el.veredicto.dataset.tipo = veredicto.tipo;
      el.veredicto.textContent = veredicto.texto;
    } else {
      el.veredicto.hidden = true;
    }

    el.palabraEn.textContent = tarjeta.word;
    el.palabraEs.textContent = tarjeta.es;
    el.palabraEu.textContent = tarjeta.eu;

    el.ejemploEn.textContent = tarjeta.example.en;
    el.ejemploEs.textContent = tarjeta.example.es;
    el.ejemploEu.textContent = tarjeta.example.eu;

    sonar(el.escucharPalabra, tarjeta.word, { audio: tarjeta.wordAudio });
  }

  function siguienteTarjeta(estadoFinal) {
    Progreso.marcar(tarjetaActual().id, estadoFinal);
    Voz.parar();
    indice += 1;
    if (indice >= mazo.length) {
      pintarMarcador(el.marcadorFinal);
      mostrarPantalla("final");
      return;
    }
    mostrarPregunta();
  }

  function empezarRonda() {
    Voz.desbloquear();
    mazo = Datos.ordenarMazo(tarjetas);
    indice = 0;
    mostrarPantalla("tarjeta");
    mostrarPregunta();
  }

  /* ---------- eventos ---------- */

  el.empezar.addEventListener("click", empezarRonda);
  el.otraVuelta.addEventListener("click", empezarRonda);

  el.reiniciar.addEventListener("click", () => {
    const seguro = window.confirm("¿Seguro? Se olvidará todo lo aprendido y todas las palabras volverán a ser nuevas.");
    if (!seguro) return;
    Progreso.reiniciar();
    pintarMarcador(el.marcadorInicio);
  });

  el.escucharPregunta.addEventListener("click", () => {
    const tarjeta = tarjetaActual();
    sonar(el.escucharPregunta, tarjeta.word, { audio: tarjeta.wordAudio });
  });

  el.escucharPalabra.addEventListener("click", () => {
    const tarjeta = tarjetaActual();
    sonar(el.escucharPalabra, tarjeta.word, { audio: tarjeta.wordAudio });
  });

  el.escucharEjemplo.addEventListener("click", () => {
    const tarjeta = tarjetaActual();
    sonar(el.escucharEjemplo, tarjeta.example.en, { audio: tarjeta.example.audio, tipo: "frase" });
  });

  el.formRespuesta.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const tarjeta = tarjetaActual();
    const acierta = esCorrecta(el.campo.value, tarjeta);
    el.campo.classList.toggle("es-correcta", acierta);
    el.campo.classList.toggle("es-fallo", !acierta);
    mostrarRespuesta(acierta
      ? { tipo: "bien", texto: "¡Muy bien! 🎉" }
      : { tipo: "casi", texto: "Casi. Mira cómo se escribe:" });
  });

  el.verRespuesta.addEventListener("click", () => mostrarRespuesta(null));

  el.verTraduccion.addEventListener("click", () => {
    const abierto = el.ejemploTraducciones.hidden === false;
    el.ejemploTraducciones.hidden = abierto;
    el.verTraduccion.setAttribute("aria-expanded", String(!abierto));
    el.verTraduccion.textContent = abierto ? "Ver la traducción" : "Ocultar la traducción";
  });

  el.sabia.addEventListener("click", () => siguienteTarjeta(Progreso.ESTADOS.CONOCIDA));
  el.repasar.addEventListener("click", () => siguienteTarjeta(Progreso.ESTADOS.REPASAR));

  /* ---------- arranque ---------- */

  Datos.cargar()
    .then((datos) => {
      tarjetas = datos.tarjetas;
      temas = datos.temas;
      pintarMarcador(el.marcadorInicio);
      el.avisoAudio.hidden = Voz.disponible();
    })
    .catch((fallo) => {
      el.error.hidden = false;
      el.error.textContent = "No se ha podido cargar el vocabulario. " + fallo.message;
      el.empezar.disabled = true;
    });

  /* ---------- PWA: service worker e instalación ---------- */

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => { /* sin offline */ });
    });
  }

  let peticionInstalacion = null;

  window.addEventListener("beforeinstallprompt", (evento) => {
    evento.preventDefault();
    peticionInstalacion = evento;
    el.instalar.hidden = false;
  });

  el.instalar.addEventListener("click", async () => {
    if (!peticionInstalacion) return;
    peticionInstalacion.prompt();
    await peticionInstalacion.userChoice;
    peticionInstalacion = null;
    el.instalar.hidden = true;
  });

})();
