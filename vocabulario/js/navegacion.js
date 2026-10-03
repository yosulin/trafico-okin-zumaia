/**
 * ============================================================
 *  NAVEGACIÓN — una lista, cuatro sitios donde ponerla
 * ============================================================
 *  Este módulo no sabe si lo que dibuja es una barra lateral, una
 *  barra inferior o un cajón, y no debe saberlo: dibuja una lista de
 *  destinos y el CSS decide dónde va según el espacio disponible.
 *
 *      < 56rem            barra inferior  (bajo 26rem, solo iconos)
 *      56rem – 75rem      barra lateral de iconos
 *      ≥ 75rem            barra lateral con texto
 *      poco alto y tumbado    cajón que se abre desde la cabecera
 *
 *  Es el MISMO elemento en los cuatro casos. Por eso al girar la
 *  tablet no hay salto, no se pierde el foco del teclado y no hay tres
 *  navegaciones que mantener.
 *
 *  Los destinos salen de modulos.js más "Inicio", que lleva al índice.
 *  Cada uno declara qué pantallas son suyas, para poder marcarlo aunque
 *  estés tres pasos dentro del módulo, y qué roles lo ven.
 * ============================================================
 */

import { MODULOS } from "./modulos.js";
import { t } from "./i18n.js";

/** El índice de módulos también es un destino, y el primero. */
const INICIO = {
  id: "inicio",
  icono: "🏠",
  color: "var(--tinta-suave)",
  pantalla: "hub",
  pantallas: ["hub"],
  roles: ["alumno", "tutor", "admin"],
  clave: "nav.inicio"
};

/**
 * Los destinos que ve un rol. Hoy todos son "alumno", pero el filtro
 * existe desde el principio: añadir el perfil de tutor será añadir
 * entradas, no rehacer esto.
 *
 * Ojo: esconder en la interfaz no es proteger. El día que haya datos
 * de tutor, el rol tiene que comprobarse también en las reglas.
 */
export function destinos(rol = "alumno") {
  const modulos = MODULOS
    .filter((modulo) => modulo.pantalla)
    .filter((modulo) => !modulo.roles || modulo.roles.includes(rol))
    .map((modulo) => Object.assign({ clave: "modulo." + modulo.id + ".nombre" }, modulo));

  return [INICIO].concat(modulos);
}

/** Qué destino está activo cuando se enseña una pantalla. */
export function destinoDePantalla(pantalla) {
  const encontrado = destinos().find((destino) => destino.pantallas.includes(pantalla));
  return encontrado ? encontrado.id : null;
}

/**
 * Dibuja la lista dentro del <ul> que se le pase.
 *
 * @param {HTMLElement} lista    el contenedor
 * @param {object} opciones
 *        - activo    id del destino marcado
 *        - rol       perfil de quien mira
 *        - alElegir  función(destino) cuando se pulsa
 */
export function pintar(lista, opciones = {}) {
  const rol = opciones.rol || "alumno";
  lista.innerHTML = "";

  destinos(rol).forEach((destino) => {
    const fila = document.createElement("li");
    const boton = document.createElement("button");

    boton.type = "button";
    boton.className = "nav-boton";
    boton.dataset.destino = destino.id;
    boton.style.setProperty("--color-modulo", destino.color);
    if (destino.id === opciones.activo) boton.setAttribute("aria-current", "page");

    boton.innerHTML = '<span class="nav-boton__icono" aria-hidden="true"></span>' +
                      '<span class="nav-boton__texto"></span>';

    const nombre = t(destino.clave);
    boton.querySelector(".nav-boton__icono").textContent = destino.icono;
    boton.querySelector(".nav-boton__texto").textContent = nombre;
    /* En barra de iconos el texto no se ve, así que el nombre tiene que
       llegar igualmente: por aria-label a quien usa lector de pantalla,
       y por title a quien pasa el ratón por encima. */
    boton.setAttribute("aria-label", nombre);
    boton.title = nombre;

    boton.addEventListener("click", () => {
      if (opciones.alElegir) opciones.alElegir(destino);
    });

    fila.appendChild(boton);
    lista.appendChild(fila);
  });
}

/**
 * Cómo se llama una pantalla, para la cabecera. Devuelve "" en las
 * pantallas que no son de ningún módulo (cargando, login, sin acceso):
 * ahí no hay dónde estar todavía.
 */
export function nombreDePantalla(pantalla) {
  if (pantalla === "ajustes") return t("comun.ajustes");
  const encontrado = destinos().find((destino) => destino.pantallas.includes(pantalla));
  return encontrado ? t(encontrado.clave) : "";
}

/** Marca el destino activo sin volver a dibujar la lista. */
export function marcar(lista, activo) {
  lista.querySelectorAll(".nav-boton").forEach((boton) => {
    if (boton.dataset.destino === activo) boton.setAttribute("aria-current", "page");
    else boton.removeAttribute("aria-current");
  });
}
