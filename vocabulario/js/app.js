/**
 * ============================================================
 *  APP — la experiencia de la tarjeta
 * ============================================================
 *  Flujo:
 *
 *    LOGIN      entrar con Google (Firebase Authentication)
 *        ↓
 *    INICIO     marcador y botón de empezar
 *        ↓
 *    PREGUNTA   dibujo grande + audio automático de la palabra
 *               + campo para escribirla + "Comprobar"
 *        ↓
 *    RESPUESTA  palabra en inglés + audio + castellano + euskera
 *               + frase de ejemplo (con audio y traducciones)
 *        ↓
 *    "La sabía" / "Repasar"  → se guarda en Firestore → siguiente tarjeta
 *
 *  Esta capa no sabe cómo suena el audio (audio.js), ni de dónde salen
 *  las tarjetas (datos.js), ni cómo se guarda el progreso (progreso.js),
 *  ni cómo se resuelven las imágenes (media.js).
 * ============================================================
 */

import { alCambiarSesion, entrar, salir, recogerRedireccion } from "./sesion.js";
import { buscar, cargarTarjetas, cargarTemas, ordenarMazo } from "./datos.js";
import { pintarModulos } from "./modulos.js";
import * as Mates from "./matemagia.js";
import * as Progreso from "./progreso.js";
import { urlDe, precargar, olvidarUrls } from "./media.js";
import { desbloquear, parar, playWordAudio, playExampleAudio, hayVozDelNavegador } from "./audio.js";

/* ---------- referencias al DOM ---------- */

const $ = (id) => document.getElementById(id);

const pantallas = {
  cargando: $("pantalla-cargando"),
  login: $("pantalla-login"),
  sinAcceso: $("pantalla-sin-acceso"),
  hub: $("pantalla-hub"),
  inicio: $("pantalla-inicio"),
  diccionario: $("pantalla-diccionario"),
  matemagia: $("pantalla-matemagia"),
  matesReto: $("pantalla-mates-reto"),
  matesFinal: $("pantalla-mates-final"),
  tarjeta: $("pantalla-tarjeta"),
  final: $("pantalla-final")
};

const el = {
  usuario: $("usuario"),
  usuarioFoto: $("usuario-foto"),
  usuarioNombre: $("usuario-nombre"),
  entrar: $("boton-entrar"),
  salir: $("boton-salir"),
  errorLogin: $("error-login"),
  sinAccesoCorreo: $("sin-acceso-correo"),
  salirSinAcceso: $("boton-salir-sin-acceso"),

  hubSaludo: $("hub-saludo"),
  modulos: $("modulos"),
  volverHub: $("boton-volver-hub"),
  volverHubInicio: $("boton-volver-hub-inicio"),
  volverHubTarjetas: $("boton-volver-hub-tarjetas"),
  volverHubFinal: $("boton-volver-hub-final"),

  formBuscar: $("form-buscar"),
  campoBuscar: $("campo-buscar"),
  buscadorEstado: $("buscador-estado"),
  resultados: $("resultados"),

  retos: $("retos"),
  tablasRejilla: $("tablas-rejilla"),
  volverHubMates: $("boton-volver-hub-mates"),
  volverMates: $("boton-volver-mates"),
  matesTitulo: $("mates-titulo"),
  matesProgreso: $("mates-progreso"),
  matesProgresoTexto: $("mates-progreso-texto"),
  matesEnunciado: $("mates-enunciado"),
  matesSaltos: $("mates-saltos"),
  matesPregunta: $("mates-pregunta"),
  matesAyuda: $("mates-ayuda"),
  matesRespuesta: $("mates-respuesta"),
  matesTeclado: $("mates-teclado"),
  matesMarcador: $("mates-marcador"),
  matesFinalEmoji: $("mates-final-emoji"),
  matesFinalTitulo: $("mates-final-titulo"),
  matesOtra: $("boton-mates-otra"),
  matesMenu: $("boton-mates-menu"),

  marcadorInicio: $("marcador-inicio"),
  marcadorFinal: $("marcador-final"),
  empezar: $("boton-empezar"),
  reiniciar: $("boton-reiniciar"),
  otraVuelta: $("boton-otra-vuelta"),
  avisoAudio: $("aviso-audio"),
  avisoRed: $("aviso-red"),
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

  ejemplo: $("ejemplo"),
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

/* ---------- estado en memoria ---------- */

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

function mostrarError(mensaje) {
  el.error.hidden = false;
  el.error.textContent = mensaje;
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
async function sonar(boton, reproducir, tarjeta) {
  if (boton) boton.classList.add("boton--sonando");
  await reproducir(tarjeta);
  if (boton) boton.classList.remove("boton--sonando");
}

function pintarMarcador(lista) {
  const cuenta = Progreso.resumen(tarjetas);
  const etiquetas = [
    { estado: "known", texto: "La sabía" },
    { estado: "review", texto: "Repasar" },
    { estado: "learning", texto: "Vistas" },
    { estado: "new", texto: "Nuevas" }
  ];
  lista.innerHTML = etiquetas
    .map((item) => `<li data-estado="${item.estado}"><b>${cuenta[item.estado]}</b><span>${item.texto}</span></li>`)
    .join("");
}

/* ---------- ciclo de la tarjeta ---------- */

function tarjetaActual() {
  return mazo[indice];
}

/** Va pidiendo a Storage la imagen y el audio de la tarjeta siguiente. */
function adelantarSiguiente() {
  const siguiente = mazo[indice + 1];
  if (!siguiente) return;
  precargar([siguiente.imagePath, siguiente.wordAudioPath]);
}

async function pintarImagen(tarjeta) {
  el.imagen.alt = "Escena en gris donde solo aparece en color: " + tarjeta.es;
  el.imagen.removeAttribute("src");
  const url = await urlDe(tarjeta.imagePath);
  /* Puede haber cambiado de tarjeta mientras Storage respondía. */
  if (url && tarjetaActual() === tarjeta) el.imagen.src = url;
}

function mostrarPregunta() {
  const tarjeta = tarjetaActual();

  el.progresoTexto.textContent = (indice + 1) + " / " + mazo.length;
  el.progresoRelleno.style.width = ((indice + 1) / mazo.length * 100) + "%";

  pintarImagen(tarjeta);
  const tema = temas[tarjeta.theme];
  el.tema.textContent = tema ? ((tema.emoji || "") + " " + (tema.es || "")).trim() : "";
  el.tema.hidden = !tema;

  el.caraRespuesta.hidden = true;
  el.caraPregunta.hidden = false;
  el.campo.value = "";
  el.campo.classList.remove("es-correcta", "es-fallo");
  el.veredicto.hidden = true;
  el.ejemploTraducciones.hidden = true;
  el.verTraduccion.setAttribute("aria-expanded", "false");
  el.verTraduccion.textContent = "Ver la traducción";

  Progreso.marcarVista(tarjeta.id);

  /* Audio automático al entrar en la tarjeta. */
  sonar(el.escucharPregunta, playWordAudio, tarjeta);
  adelantarSiguiente();

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

  /* El ejemplo es opcional: hay tarjetas importadas que aún no lo traen. */
  el.ejemplo.hidden = !tarjeta.example.en;
  el.ejemploEn.textContent = tarjeta.example.en;
  el.ejemploEs.textContent = tarjeta.example.es;
  el.ejemploEu.textContent = tarjeta.example.eu;
  el.verTraduccion.hidden = !(tarjeta.example.es || tarjeta.example.eu);

  sonar(el.escucharPalabra, playWordAudio, tarjeta);
}

function siguienteTarjeta(estadoFinal) {
  Progreso.marcar(tarjetaActual().id, estadoFinal);
  parar();
  indice += 1;
  if (indice >= mazo.length) {
    pintarMarcador(el.marcadorFinal);
    mostrarPantalla("final");
    return;
  }
  mostrarPregunta();
}

function empezarRonda() {
  desbloquear();
  mazo = ordenarMazo(tarjetas, Progreso.estado);
  indice = 0;
  mostrarPantalla("tarjeta");
  mostrarPregunta();
}

/* ---------- diccionario ---------- */

/**
 * Pinta una entrada encontrada. Enseña lo que la tarjeta tenga: si no
 * hay dibujo, ejemplo o definición, esa parte simplemente no aparece.
 * Así el mismo trozo sirve para las 10 tarjetas ilustradas de ahora y
 * para un léxico importado que solo traiga palabra y traducción.
 */
function pintarEntrada(tarjeta) {
  const seccion = document.createElement("article");
  seccion.className = "entrada";

  const tema = temas[tarjeta.theme];

  seccion.innerHTML = `
    <div class="entrada__cabecera">
      <h3 class="entrada__palabra"></h3>
      <button class="boton boton--redondo" type="button" aria-label="Escuchar la palabra">🔊</button>
    </div>
    <ul class="traducciones">
      <li><span class="traducciones__idioma">Castellano</span><span class="traducciones__texto"></span></li>
      <li><span class="traducciones__idioma">Euskara</span><span class="traducciones__texto"></span></li>
    </ul>`;

  seccion.querySelector(".entrada__palabra").textContent = tarjeta.word;
  const traducciones = seccion.querySelectorAll(".traducciones__texto");
  traducciones[0].textContent = tarjeta.es || "—";
  traducciones[1].textContent = tarjeta.eu || "—";

  const botonPalabra = seccion.querySelector(".boton--redondo");
  botonPalabra.addEventListener("click", () => sonar(botonPalabra, playWordAudio, tarjeta));

  if (tema) {
    const etiqueta = document.createElement("span");
    etiqueta.className = "entrada__tipo";
    etiqueta.textContent = ((tema.emoji || "") + " " + (tema.es || "")).trim();
    seccion.querySelector(".entrada__cabecera").insertBefore(etiqueta, botonPalabra);
  }

  /* La definición aún no existe en ninguna tarjeta, pero si algún día se
     añade (definition.es / .en / .eu), aparece aquí sin tocar nada. */
  const definicion = tarjeta.definition && (tarjeta.definition.es || tarjeta.definition.en || tarjeta.definition.eu);
  if (definicion) {
    const parrafo = document.createElement("p");
    parrafo.className = "entrada__definicion";
    parrafo.textContent = definicion;
    seccion.insertBefore(parrafo, seccion.querySelector(".traducciones"));
  }

  if (tarjeta.imagePath) {
    const imagen = document.createElement("img");
    imagen.className = "entrada__dibujo";
    imagen.alt = "";
    urlDe(tarjeta.imagePath).then((url) => { if (url) imagen.src = url; });
    seccion.insertBefore(imagen, seccion.querySelector(".traducciones"));
  }

  if (tarjeta.example.en) {
    const ejemplo = document.createElement("div");
    ejemplo.className = "ejemplo";
    ejemplo.innerHTML = `
      <div class="ejemplo__linea">
        <p class="ejemplo__en"></p>
        <button class="boton boton--redondo" type="button" aria-label="Escuchar la frase">🔊</button>
      </div>`;
    ejemplo.querySelector(".ejemplo__en").textContent = tarjeta.example.en;

    if (tarjeta.example.es || tarjeta.example.eu) {
      const lista = document.createElement("ul");
      lista.className = "ejemplo__traducciones";
      lista.innerHTML = `
        <li><span class="traducciones__idioma">Castellano</span><span></span></li>
        <li><span class="traducciones__idioma">Euskara</span><span></span></li>`;
      const celdas = lista.querySelectorAll("li span:last-child");
      celdas[0].textContent = tarjeta.example.es;
      celdas[1].textContent = tarjeta.example.eu;
      ejemplo.appendChild(lista);
    }

    const botonEjemplo = ejemplo.querySelector(".boton--redondo");
    botonEjemplo.addEventListener("click", () => sonar(botonEjemplo, playExampleAudio, tarjeta));
    seccion.appendChild(ejemplo);
  }

  return seccion;
}

async function buscarPalabra(termino) {
  el.resultados.innerHTML = "";
  el.buscadorEstado.hidden = false;
  el.buscadorEstado.textContent = "Buscando…";

  try {
    const encontradas = await buscar(termino);

    if (encontradas.length === 0) {
      el.buscadorEstado.textContent = "No tengo esa palabra todavía.";
      return;
    }

    el.buscadorEstado.hidden = true;
    encontradas.forEach((tarjeta) => el.resultados.appendChild(pintarEntrada(tarjeta)));

    /* Si solo hay una, se dice sola: es lo que se viene a oír. */
    if (encontradas.length === 1) playWordAudio(encontradas[0]);
  } catch (fallo) {
    el.buscadorEstado.textContent = "No se ha podido buscar: " + fallo.message;
  }
}

/* ---------- matemagia ---------- */

let retoActual = null;      /* "tablas" | "sumas" | "restas" */
let tablaActual = null;     /* número de tabla, o null para mezcla */
let ejercicio = null;
let paso = 0;
let escrito = "";
let rondaMates = { hechas: 0, aciertos: 0, fallos: 0 };

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "borrar", "0", "ok"];

function pintarMenuMates() {
  el.retos.innerHTML = "";
  Mates.RETOS.forEach((reto) => {
    const fila = document.createElement("li");
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "reto";
    boton.innerHTML = `
      <span class="reto__icono" aria-hidden="true"></span>
      <span class="reto__texto"><b></b><small></small></span>`;
    boton.querySelector(".reto__icono").textContent = reto.icono;
    boton.querySelector("b").textContent = reto.nombre;
    boton.querySelector("small").textContent = reto.que;
    boton.addEventListener("click", () => empezarRondaMates(reto.id, null));
    fila.appendChild(boton);
    el.retos.appendChild(fila);
  });

  /* Las tablas se pintan con su nivel: de un vistazo se ve cuál cojea. */
  el.tablasRejilla.innerHTML = "";
  for (let tabla = 1; tabla <= 10; tabla++) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "tabla-boton";
    boton.textContent = tabla;
    boton.dataset.nivel = Mates.nivelDeTabla(tabla);
    boton.setAttribute("aria-label", "Tabla del " + tabla);
    boton.addEventListener("click", () => empezarRondaMates("tablas", tabla));
    el.tablasRejilla.appendChild(boton);
  }

  const mezcla = document.createElement("button");
  mezcla.type = "button";
  mezcla.className = "tabla-boton tabla-boton--mezcla";
  mezcla.textContent = "Mezcla de todas";
  mezcla.addEventListener("click", () => empezarRondaMates("tablas", null));
  el.tablasRejilla.appendChild(mezcla);
}

function pintarTeclado() {
  el.matesTeclado.innerHTML = "";
  TECLAS.forEach((tecla) => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "tecla" + (tecla === "ok" ? " tecla--ok" : tecla === "borrar" ? " tecla--borrar" : "");
    boton.textContent = tecla === "borrar" ? "←" : tecla === "ok" ? "✓" : tecla;
    boton.setAttribute("aria-label", tecla === "borrar" ? "Borrar" : tecla === "ok" ? "Comprobar" : tecla);
    boton.addEventListener("click", () => pulsarTecla(tecla));
    el.matesTeclado.appendChild(boton);
  });
}

function pintarSaltos() {
  const saltos = ejercicio.saltos;
  el.matesSaltos.hidden = saltos.length === 0;
  if (saltos.length === 0) return;

  el.matesSaltos.innerHTML = "";
  saltos.forEach((valor, posicion) => {
    if (posicion > 0) {
      const flecha = document.createElement("li");
      flecha.className = "salto-flecha";
      flecha.setAttribute("aria-hidden", "true");
      flecha.textContent = "→";
      el.matesSaltos.appendChild(flecha);
    }
    const casilla = document.createElement("li");
    casilla.className = "salto";
    /* El primer número se ve desde el principio; los siguientes van
       apareciendo según los va calculando. */
    const visible = posicion === 0 || posicion <= pasosResueltosEnSaltos();
    casilla.dataset.hecho = visible ? "si" : "no";
    casilla.textContent = visible ? valor : "?";
    el.matesSaltos.appendChild(casilla);
  });
}

/** Cuántas casillas de la recta se han ganado ya (el paso 2 no mueve la recta). */
function pasosResueltosEnSaltos() {
  if (paso === 0) return 0;
  if (paso === 1) return 1;
  return paso === 2 ? 1 : 2;
}

function mostrarPaso() {
  const actual = ejercicio.pasos[paso];
  el.matesEnunciado.textContent = ejercicio.enunciado;
  el.matesPregunta.textContent = actual.pregunta;
  el.matesAyuda.textContent = actual.ayuda || "";
  el.matesRespuesta.textContent = "";
  el.matesRespuesta.removeAttribute("data-estado");
  escrito = "";
  pintarSaltos();
}

function siguienteEjercicio() {
  ejercicio = Mates.generarEjercicio(retoActual, tablaActual);
  paso = 0;
  el.matesProgresoTexto.textContent = (rondaMates.hechas + 1) + " / " + Mates.PREGUNTAS_POR_RONDA;
  el.matesProgreso.style.width = ((rondaMates.hechas + 1) / Mates.PREGUNTAS_POR_RONDA * 100) + "%";
  mostrarPaso();
}

function pulsarTecla(tecla) {
  if (tecla === "borrar") {
    escrito = escrito.slice(0, -1);
    el.matesRespuesta.textContent = escrito;
    return;
  }
  if (tecla === "ok") {
    comprobarPaso();
    return;
  }
  if (escrito.length >= 4) return;
  escrito += tecla;
  el.matesRespuesta.textContent = escrito;
}

function comprobarPaso() {
  if (escrito === "") return;

  const actual = ejercicio.pasos[paso];
  const acierta = Number(escrito) === actual.respuesta;
  el.matesRespuesta.dataset.estado = acierta ? "bien" : "mal";

  /* Solo cuenta el ejercicio entero, no cada salto: fallar un paso
     intermedio ya se corrige enseñándolo, y no queremos castigar por
     pensar en voz alta. */
  if (!acierta) {
    el.matesRespuesta.textContent = actual.respuesta;
    el.matesAyuda.textContent = "Era " + actual.respuesta + ". Seguimos.";
    ejercicio.falloEnAlgunPaso = true;
  }

  window.setTimeout(() => {
    paso += 1;

    if (paso < ejercicio.pasos.length) {
      mostrarPaso();
      return;
    }

    const bien = !ejercicio.falloEnAlgunPaso;
    Mates.anotar(retoActual, bien, ejercicio.tabla);
    rondaMates.hechas += 1;
    if (bien) rondaMates.aciertos += 1; else rondaMates.fallos += 1;

    if (rondaMates.hechas >= Mates.PREGUNTAS_POR_RONDA) {
      terminarRondaMates();
      return;
    }
    siguienteEjercicio();
  }, acierta ? 450 : 1400);
}

function empezarRondaMates(reto, tabla) {
  retoActual = reto;
  tablaActual = tabla;
  rondaMates = { hechas: 0, aciertos: 0, fallos: 0 };

  const nombre = Mates.RETOS.find((item) => item.id === reto).nombre;
  el.matesTitulo.textContent = tabla ? ("Tabla del " + tabla) : nombre;

  mostrarPantalla("matesReto");
  siguienteEjercicio();
}

function terminarRondaMates() {
  const { aciertos, fallos } = rondaMates;
  el.matesFinalEmoji.textContent = fallos === 0 ? "🏆" : aciertos >= fallos ? "🎉" : "💪";
  el.matesFinalTitulo.textContent = fallos === 0
    ? "¡Todas bien!"
    : aciertos >= fallos ? "¡Buena ronda!" : "Ronda terminada";

  el.matesMarcador.innerHTML = [
    { estado: "known", texto: "Bien", valor: aciertos },
    { estado: "review", texto: "A repasar", valor: fallos }
  ].map((item) => `<li data-estado="${item.estado}"><b>${item.valor}</b><span>${item.texto}</span></li>`).join("");

  mostrarPantalla("matesFinal");
}

/* ---------- entrada y salida ---------- */

async function prepararSesion(usuario) {
  el.usuario.hidden = false;
  el.usuarioNombre.textContent = (usuario.displayName || "").split(" ")[0] || "Hola";
  if (usuario.photoURL) el.usuarioFoto.src = usuario.photoURL;

  mostrarPantalla("cargando");

  try {
    const [contenido, etiquetas] = await Promise.all([
      cargarTarjetas(),
      cargarTemas(),
      Progreso.cargar(usuario.uid),
      Mates.cargarProgreso(usuario.uid)
    ]);
    tarjetas = contenido;
    temas = etiquetas;

    if (tarjetas.length === 0) {
      mostrarError("No hay tarjetas en Firestore todavía. Súbelas con tools/import (ver README).");
      return;
    }

    el.error.hidden = true;
    pintarMarcador(el.marcadorInicio);
    el.avisoAudio.hidden = hayVozDelNavegador();
    const nombre = (usuario.displayName || "").split(" ")[0];
    el.hubSaludo.textContent = nombre ? ("Hola, " + nombre) : "Hola";
    pintarIndice();
    mostrarPantalla("hub");
  } catch (fallo) {
    /* Las reglas de Firestore solo dejan leer a quien está en la lista
       de invitadas: cualquiera puede entrar con Google, pero no ver nada. */
    if (fallo.code === "permission-denied") {
      el.sinAccesoCorreo.textContent = usuario.email || "esta cuenta";
      mostrarPantalla("sinAcceso");
      return;
    }
    mostrarPantalla("hub");
    mostrarError("No se han podido cargar las tarjetas: " + fallo.message);
  }
}

function cerrarSesion() {
  tarjetas = [];
  mazo = [];
  temas = {};
  Progreso.olvidar();
  Mates.olvidarProgreso();
  olvidarUrls();
  el.usuario.hidden = true;
  el.error.hidden = true;
  mostrarPantalla("login");
}

/* ---------- eventos ---------- */

el.entrar.addEventListener("click", async () => {
  el.errorLogin.hidden = true;
  el.entrar.disabled = true;
  try {
    await entrar();
  } catch (fallo) {
    el.errorLogin.hidden = false;
    el.errorLogin.textContent = "No se ha podido entrar: " + (fallo.code || fallo.message);
  } finally {
    el.entrar.disabled = false;
  }
});

el.salir.addEventListener("click", () => { parar(); salir(); });
el.salirSinAcceso.addEventListener("click", () => salir());

function irAlHub() {
  parar();
  pintarIndice();
  mostrarPantalla("hub");
}

/** Dibuja el índice y conecta cada módulo con su pantalla. */
function pintarIndice() {
  const activos = pintarModulos(el.modulos, { tarjetas: tarjetas.length });
  activos.forEach(({ modulo, boton }) => {
    boton.addEventListener("click", () => {
      if (modulo.pantalla === "inicio") pintarMarcador(el.marcadorInicio);
      if (modulo.pantalla === "matemagia") pintarMenuMates();
      mostrarPantalla(modulo.pantalla);
      if (modulo.pantalla === "diccionario") el.campoBuscar.focus();
    });
  });
}

el.volverHub.addEventListener("click", irAlHub);
el.volverHubMates.addEventListener("click", irAlHub);
el.volverMates.addEventListener("click", () => { pintarMenuMates(); mostrarPantalla("matemagia"); });
el.matesOtra.addEventListener("click", () => empezarRondaMates(retoActual, tablaActual));
el.matesMenu.addEventListener("click", () => { pintarMenuMates(); mostrarPantalla("matemagia"); });
el.volverHubInicio.addEventListener("click", irAlHub);
el.volverHubTarjetas.addEventListener("click", irAlHub);
el.volverHubFinal.addEventListener("click", irAlHub);

el.formBuscar.addEventListener("submit", (evento) => {
  evento.preventDefault();
  desbloquear();
  buscarPalabra(el.campoBuscar.value);
});

el.empezar.addEventListener("click", empezarRonda);
el.otraVuelta.addEventListener("click", empezarRonda);

el.reiniciar.addEventListener("click", async () => {
  const seguro = window.confirm("¿Seguro? Se olvidará todo lo aprendido y todas las palabras volverán a ser nuevas.");
  if (!seguro) return;
  await Progreso.reiniciar();
  pintarMarcador(el.marcadorInicio);
});

el.escucharPregunta.addEventListener("click", () => sonar(el.escucharPregunta, playWordAudio, tarjetaActual()));
el.escucharPalabra.addEventListener("click", () => sonar(el.escucharPalabra, playWordAudio, tarjetaActual()));
el.escucharEjemplo.addEventListener("click", () => sonar(el.escucharEjemplo, playExampleAudio, tarjetaActual()));

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
el.repasar.addEventListener("click", () => siguienteTarjeta(Progreso.ESTADOS.REPASO));

pintarTeclado();

/* Aviso discreto de que se está jugando sin red. */
function pintarEstadoRed() { el.avisoRed.hidden = navigator.onLine; }
window.addEventListener("online", pintarEstadoRed);
window.addEventListener("offline", pintarEstadoRed);
pintarEstadoRed();

/* ---------- arranque ---------- */

recogerRedireccion();

alCambiarSesion((usuario) => {
  if (usuario) prepararSesion(usuario);
  else cerrarSesion();
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
