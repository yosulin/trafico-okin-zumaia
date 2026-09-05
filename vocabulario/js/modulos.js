/**
 * ============================================================
 *  MÓDULOS — el registro de herramientas
 * ============================================================
 *  El índice de la app se dibuja desde esta lista, así que añadir una
 *  herramienta nueva es añadir una entrada aquí y su pantalla: no hay
 *  que tocar el HTML del índice ni la navegación.
 *
 *  Cada módulo tiene:
 *    id        interno
 *    nombre    lo que se lee en la tarjeta y en la cabecera
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
    nombre: "Tarjetas",
    icono: "🃏",
    color: "var(--coral)",
    que: "Escucha, mira el dibujo y escribe la palabra en inglés",
    pantalla: "inicio",
    estado: (contexto) => contexto.tarjetas + (contexto.tarjetas === 1 ? " palabra" : " palabras")
  },
  {
    id: "diccionario",
    nombre: "Diccionario",
    icono: "📖",
    color: "var(--cielo)",
    que: "Una palabra en un idioma y te doy los otros dos",
    pantalla: "diccionario",
    estado: () => "3 idiomas"
  },
  {
    id: "matemagia",
    nombre: "Matemagia",
    icono: "✨",
    color: "var(--menta)",
    que: "Tablas de multiplicar, sumas y trucos para calcular rápido",
    pantalla: null,
    estado: () => "Pronto"
  },
  {
    id: "libre",
    nombre: "Lo que venga",
    icono: "➕",
    color: "var(--sol)",
    que: "Aquí irá la siguiente herramienta que hagamos",
    pantalla: null,
    estado: () => "Libre"
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
    boton.querySelector(".modulo__nombre").textContent = modulo.nombre;
    boton.querySelector(".modulo__que").textContent = modulo.que;
    boton.querySelector(".modulo__estado").textContent = modulo.estado(contexto);

    fila.appendChild(boton);
    lista.appendChild(fila);

    if (modulo.pantalla) activos.push({ modulo, boton });
  });

  return activos;
}
