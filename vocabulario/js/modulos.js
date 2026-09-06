import { t } from "./i18n.js";

/**
 * ============================================================
 *  MÓDULOS — el registro de herramientas
 * ============================================================
 *  El índice de la app se dibuja desde esta lista, así que añadir una
 *  herramienta nueva es añadir una entrada aquí y su pantalla: no hay
 *  que tocar el HTML del índice ni la navegación.
 *
 *  Cada módulo tiene:
 * *    nombre    lo que se lee en la tarjeta y en la cabecera
 *    icono     un emoji, que es lo que reconoce de un vistazo
 *    color     su color, que viaja a la cabecera y a sus botones
 *    que       una frase de qué hace, en su idioma, no en el nuestro
 *    pantalla  a qué pantalla lleva (null = todavía no existe)
 *    estado    la etiqueta de la tarjeta; puede ser una función que
 *              recibe el contexto (por ejemplo, cuántas palabras hay)
 *
 *  Lo que viene: las tarjetas acabarán siendo asignaturas, y dentro de
 *  cada una sus temas y sus herramientas. Cuando toque, un módulo podrá
 *  declarar sus propios submódulos y el índice se dibujará igual, un
 *  nivel más abajo.
 * ============================================================ */

export const MODULOS = [
  {
    id: "tarjetas",
    icono: "🃏",
    color: "var(--coral)",
    pantalla: "inicio",
    estado: (contexto) => (contexto.tarjetas === 1
      ? t("modulo.tarjetas.estadoUna")
      : t("modulo.tarjetas.estado", { n: contexto.tarjetas }))
  },
  {
    id: "diccionario",
    icono: "📖",
    color: "var(--cielo)",
    pantalla: "diccionario",
    estado: () => t("modulo.diccionario.estado")
  },
  {
    id: "matemagia",
    icono: "✨",
    color: "var(--menta)",
    pantalla: "matemagia",
    estado: () => t("modulo.matemagia.estado")
  },
  {
    id: "libre",
    icono: "➕",
    color: "var(--sol)",
    pantalla: null,
    estado: () => t("modulo.libre.estado")
  }
];

/**
 * Pinta el índice. Devuelve los botones que llevan a algún sitio, para
 * que quien llama los conecte con su pantalla.
 *
 * @param {HTMLElement} lista     el <ul> del índice
 * @param {object} contexto       datos para las etiquetas de estado
 * @returns {Array<{modulo: object, boton: HTMLElement}>}
 */
export function pintarModulos(lista, contexto = {}) {
  lista.innerHTML = "";
  const activos = [];

  MODULOS.forEach((modulo) => {
    const fila = document.createElement("li");
    const boton = document.createElement("button");

    boton.type = "button";
    boton.className = "modulo" + (modulo.pantalla ? "" : " modulo--pronto");
    boton.style.setProperty("--color-modulo", modulo.color);
    if (!modulo.pantalla) boton.disabled = true;

    boton.innerHTML = `
      <span class="modulo__icono" aria-hidden="true"></span>
      <span class="modulo__nombre"></span>
      <span class="modulo__que"></span>
      <span class="modulo__estado"></span>`;

    boton.querySelector(".modulo__icono").textContent = modulo.icono;
    boton.querySelector(".modulo__nombre").textContent = t("modulo." + modulo.id + ".nombre");
    boton.querySelector(".modulo__que").textContent = t("modulo." + modulo.id + ".que");
    boton.querySelector(".modulo__estado").textContent = modulo.estado(contexto);

    fila.appendChild(boton);
    lista.appendChild(fila);

    if (modulo.pantalla) activos.push({ modulo, boton });
  });

  return activos;
}
