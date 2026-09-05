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
import { cargarTarjetas, cargarTemas, ordenarMazo } from "./datos.js";
import * as Progreso from "./progreso.js";
import { urlDe, precargar, olvidarUrls } from "./media.js";
import { desbloquear, parar, playWordAudio, playExampleAudio, hayVozDelNavegador } from "./audio.js";

/* ---------- referencias al DOM ---------- */

const $ = (id) => document.getElementById(id);

const pantallas = {
  cargando: $("pantalla-cargando"),
  login: $("pantalla-login"),
  sinAcceso: $("pantalla-sin-acceso"),
  inicio: $("pantalla-inicio"),
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
      Progreso.cargar(usuario.uid)
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
    mostrarPantalla("inicio");
  } catch (fallo) {
    /* Las reglas de Firestore solo dejan leer a quien está en la lista
       de invitadas: cualquiera puede entrar con Google, pero no ver nada. */
    if (fallo.code === "permission-denied") {
      el.sinAccesoCorreo.textContent = usuario.email || "esta cuenta";
      mostrarPantalla("sinAcceso");
      return;
    }
    mostrarPantalla("inicio");
    mostrarError("No se han podido cargar las tarjetas: " + fallo.message);
  }
}

function cerrarSesion() {
  tarjetas = [];
  mazo = [];
  temas = {};
  Progreso.olvidar();
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
