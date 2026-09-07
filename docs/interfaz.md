# Interfaz: adaptación por dispositivo e idiomas

Especificación de cómo debe comportarse **Ayuda de Sofía** en cada tipo de
pantalla y cómo se separan los idiomas. Es un documento de decisiones, no un
manual: lo que aquí se fija se implementa después, por fases.

> **Estado.** Auditoría y diseño. Nada de lo que sigue está implementado salvo
> lo que se dice explícitamente que ya existe.

---

## 1. Auditoría del frontend actual

Cifras del código, no impresiones:

| | |
|---|---|
| `index.html` | 298 líneas, 12 pantallas en un solo fichero |
| `css/estilos.css` | 704 líneas, **1 sola media query de tamaño** (`max-width: 380px`) |
| `js/app.js` | 986 líneas |
| `js/i18n.js` | 482 líneas, 114 claves × 3 idiomas |
| Grid / Flex | 16 y 20 usos: la maquetación interna es moderna |
| `clamp()` | 1 uso |
| Container queries | 0 |

### Lo que está bien y no hay que tocar

- **La maquetación interna de los componentes** ya usa Grid y Flex con `gap`, no
  márgenes sueltos. Los componentes se adaptan solos dentro de su caja.
- **El sistema de tokens** (`:root`) está bien montado: colores, radios,
  sombras y tipografías centralizados.
- **`i18n.js` está mejor de lo esperado.** Los textos no están incrustados en
  los componentes: van por `data-i18n` en el HTML y por `t()` en el JavaScript,
  con recurso al castellano si falta una clave, y `documentElement.lang` se
  actualiza al cambiar de idioma.
- **`mostrarPantalla()`** es un enrutador de una sola función y es el único
  sitio por el que pasa todo cambio de pantalla. Como punto único de control,
  sirve para lo que viene.
- **`modulos.js`** ya dibuja el índice desde una lista de datos: añadir un
  módulo no obliga a tocar el HTML. Es el patrón correcto y hay que extenderlo.

### El problema de fondo

**La aplicación no es responsive: es una columna de móvil de 620 px centrada.**

```css
.cabecera  { max-width: 620px; margin: 0 auto; }
.escenario { max-width: 620px; margin: 0 auto; }
```

En un portátil de 1440 px eso deja **el 57 % de la pantalla vacía** y la
aplicación se ve como un móvil estirado en medio del monitor — exactamente lo
que no quieres. Y no es que falten ajustes finos: es que no hay ningún punto de
ruptura donde la estructura cambie. La única media query de tamaño que existe
apila dos rejillas por debajo de 380 px.

### Problemas concretos encontrados

| # | Dónde | Qué pasa | Gravedad |
|---|---|---|---|
| 1 | `estilos.css:60` | `padding: 14px 18px calc(14px + env(safe-area-inset-top))` — el margen **superior** del notch se está sumando al **inferior**. En un iPhone con notch la cabecera se separa por abajo y el título sigue pudiendo quedar bajo el notch | Alta |
| 2 | `estilos.css:61,153` | Columna fija de 620 px, sin estructura alternativa en pantallas grandes | Alta |
| 3 | `index.html:255,266` | La palabra y la frase en inglés **no llevan `lang="en"`**. Con `<html lang="es">` un lector de pantalla lee *dog* con voz castellana | Alta |
| 4 | `index.html:222` | `← Volver` escrito a mano, sin `data-i18n`: no se traduce | Media |
| 5 | `index.html:260,261,271,272` | «Castellano» y «Euskara» escritos a mano en la tarjeta. Son etiquetas de interfaz y deberían seguir al idioma elegido | Media |
| 6 | `audio.js:28` | `en-GB` fijo en el código. Es el idioma que se aprende, no una constante | Media |
| 7 | `estilos.css:199,206` | `.boton--fantasma` 40 px y `.boton--mini` 36 px de alto: por debajo de los 44 px mínimos en un dispositivo táctil | Media |
| 8 | `estilos.css` | No hay ninguna consulta `pointer` ni `hover`: los estados de hover se aplican igual en pantalla táctil | Media |
| 9 | `estilos.css:46` | `font-size: 17px` fijo en `body`: ignora el tamaño de letra que la persona haya configurado en su sistema | Media |
| 10 | `index.html` | `.modulo-cabecera` repetida **5 veces** a mano. Cada módulo nuevo la copia otra vez | Baja, pero crece |
| 11 | `index.html` | 12 pantallas en un fichero. Funciona hoy; a diez módulos, no | Baja, pero crece |

El 1 y el 3 son fallos, no carencias: producen comportamiento incorrecto hoy.

---

## 2. Sistema de layout

### El principio

**Un único armazón, tres presentaciones de navegación, el mismo estado.**

No son tres aplicaciones ni tres hojas de estilo. Es un `<nav>` con la misma
lista de enlaces y el mismo módulo activo, colocado por CSS en un sitio
distinto según el espacio disponible. El JavaScript de navegación no sabe si es
una barra lateral o una barra inferior, y no debe saberlo.

```
┌─ .armazon ─────────────────────────────────────┐
│  grid-template-areas, definidas por el ancho   │
│                                                │
│  ┌──────────┐  ┌───────────────┐  ┌─────────┐  │
│  │  <nav>   │  │    <main>     │  │ <aside> │  │
│  │ misma    │  │  la pantalla  │  │ opcional│  │
│  │ lista    │  │  activa       │  │ del     │  │
│  │ siempre  │  │               │  │ módulo  │  │
│  └──────────┘  └───────────────┘  └─────────┘  │
└────────────────────────────────────────────────┘
```

```css
.armazon {
  display: grid;
  min-height: 100dvh;              /* dvh, no vh: el teclado y la barra del
                                      navegador cambian la altura real */
  grid-template-areas:
    "cabecera"
    "trabajo"
    "navegacion";
  grid-template-rows: auto 1fr auto;
}

@media (min-width: 56rem) {
  .armazon {
    grid-template-areas:
      "navegacion cabecera"
      "navegacion trabajo";
    grid-template-columns: auto 1fr;
    grid-template-rows: auto 1fr;
  }
}
```

Cambiar de barra inferior a barra lateral es cambiar `grid-template-areas`. El
DOM no se mueve, así que no hay que desmontar y volver a montar nada, no se
pierde el foco del teclado y no hay salto visual al girar la tablet.

### Puntos de ruptura, y por qué esos

**Los puntos de ruptura los marca el contenido, no el catálogo de Apple.** Si
se atan a modelos concretos, cada aparato nuevo obliga a revisarlos.

| Desde | Nombre | Por qué ahí |
|---|---|---|
| 0 | Compacto | La tarjeta necesita unos 340 px para que el dibujo se lea y quepa el teclado |
| `37.5rem` (600 px) | Cómodo | A partir de aquí caben dos columnas de botones y la tarjeta puede crecer |
| `56rem` (900 px) | Amplio | Cabe una barra lateral estrecha **más** un área de trabajo de 560 px, que es lo que necesita la tarjeta para lucir |
| `75rem` (1200 px) | Escritorio | Cabe barra lateral con texto, área de trabajo y una columna auxiliar |

En `rem`, no en píxeles: si alguien agranda la letra del sistema, los puntos de
ruptura se mueven con ella y la interfaz cambia de estructura *antes* de
quedarse apretada, que es justo lo que se quiere.

### Consultas ortogonales al tamaño

El ancho no es la única pregunta. Estas se combinan con las anteriores y
resuelven cosas que un punto de ruptura no ve:

```css
@media (pointer: coarse)  { /* dedo: 48 px mínimo, sin depender del hover */ }
@media (hover: hover)     { /* ratón: solo aquí tiene sentido el hover */ }
@media (orientation: landscape) and (max-height: 32rem) {
  /* móvil tumbado o teclado abierto: la cabecera se encoge y el
     contenido gana el alto que le queda */
}
@media (prefers-reduced-motion: reduce) { /* ya está */ }
@media (prefers-contrast: more)         { /* bordes más marcados */ }
```

La combinación importante es **tablet horizontal**: mucho ancho *y* dedo. Se
parece a un escritorio en estructura y a un móvil en tamaño de botón. Esa es
exactamente la razón de separar `pointer` del ancho.

### Container queries: dónde sí

Las container queries se ganan el sitio en **un** caso, y es un caso real: la
tarjeta de vocabulario vive en contenedores de anchos muy distintos según haya
o no barra lateral y columna auxiliar. Preguntar por el ancho de la ventana da
la respuesta equivocada; preguntar por el ancho de *su caja* da la correcta.

```css
.area-trabajo { container-type: inline-size; container-name: trabajo; }

@container trabajo (min-width: 34rem) {
  .tarjeta { grid-template-columns: 1fr auto; }   /* dibujo y respuesta al lado */
}
```

En el resto de la aplicación no aportan: media queries normales bastan.

### Reglas de dimensionado

- **Nada de altos fijos** en contenedores. `min-height` como suelo, el
  contenido manda.
- **`100dvh`, nunca `100vh`.** Con `vh` el teclado del móvil tapa el botón de
  comprobar en la pantalla de tarjeta y en Matemagia.
- **Áreas seguras a los cuatro lados**, con `max()` para que no encojan por
  debajo del margen normal:
  ```css
  padding-block-start: max(0.875rem, env(safe-area-inset-top));
  padding-block-end:   max(0.875rem, env(safe-area-inset-bottom));
  ```
  La barra de navegación inferior lo necesita sí o sí, o queda bajo la barra de
  gestos del iPhone.
- **Tipografía relativa.** `body { font-size: clamp(1rem, 0.95rem + 0.25vw, 1.15rem) }`
  en lugar de los 17 px fijos de ahora, para respetar el tamaño de letra del
  sistema. Es accesibilidad, y en una herramienta infantil también es que los
  abuelos puedan leerla.
- **Objetivos táctiles de 48 px** bajo `pointer: coarse`, incluidos los botones
  hoy más pequeños.

---

## 3. Navegación por dispositivo

### Escritorio · desde 75rem

```
┌────────────────┬────────────────────────────────────┬──────────────┐
│ ● Ayuda        │  Tarjetas                      ⚙️  │              │
│   de Sofía     ├────────────────────────────────────┤  Progreso    │
│                │                                    │  ▓▓▓▓░░ 12/30│
│ 🏠 Inicio      │                                    │              │
│ 🃏 Inglés      │        [ escena en color ]         │  Tema        │
│ ✨ Matemagia   │                                    │  Animales    │
│ 📖 Diccionario │                                    │              │
│                │        ¿Qué es esto?               │  Ayuda       │
│                │        [_______________]           │  Escúchala   │
│                │        [  Comprobar   ]            │  otra vez si │
│                │                                    │  no la coges │
│ 👤 Sofía       │                                    │              │
│ ⚙️ Ajustes     │                                    │              │
└────────────────┴────────────────────────────────────┴──────────────┘
```

Barra lateral fija con icono y texto. La columna auxiliar **la aporta el
módulo**: si un módulo no tiene nada que poner ahí, no existe y el área de
trabajo ocupa su sitio. Nunca se rellena por rellenar.

### Tablet horizontal · 56rem a 75rem

```
┌──────┬──────────────────────────────────────────────────┐
│  ●   │  Tarjetas                                    ⚙️  │
│      ├──────────────────────────────────────────────────┤
│  🏠  │                                                  │
│  🃏  │            [ escena en color ]                   │
│  ✨  │                                                  │
│  📖  │            ¿Qué es esto?                         │
│      │            [_________________]                   │
│      │            [    Comprobar    ]                   │
│  👤  │                                                  │
└──────┴──────────────────────────────────────────────────┘
```

Misma estructura, barra lateral **solo de iconos** (con `aria-label`, y el
nombre visible al enfocar con teclado). Botones de 48 px porque sigue siendo
dedo. Sin columna auxiliar: el ancho no da para tres zonas cómodas.

### Tablet vertical · 37.5rem a 56rem

```
┌──────────────────────────────┐
│  ● Ayuda de Sofía        ⚙️  │
├──────────────────────────────┤
│                              │
│                              │
│      [ escena en color ]     │
│         grande de verdad     │
│                              │
│      ¿Qué es esto?           │
│      [__________________]    │
│      [    Comprobar     ]    │
│                              │
├──────────────────────────────┤
│  🏠      🃏      ✨      📖  │
│ Inicio  Inglés  Mates   Dicc │
└──────────────────────────────┘
```

**Sin barra lateral**, y es deliberado: en vertical el ancho es el recurso
escaso y la tarjeta se lo merece entero. Barra inferior con icono y etiqueta,
al alcance del pulgar. Este es el formato en el que la aplicación tiene que
sentirse mejor.

### Móvil vertical · hasta 37.5rem

```
┌────────────────────┐
│ ● Ayuda        ⚙️  │
├────────────────────┤
│                    │
│   [ escena ]       │
│                    │
│   ¿Qué es esto?    │
│   [____________]   │
│   [ Comprobar  ]   │
│                    │
├────────────────────┤
│  🏠   🃏   ✨   📖 │
└────────────────────┘
```

Una columna, barra inferior solo de iconos, **una acción principal visible**.
Con el teclado abierto la barra inferior se oculta: si no, se come el espacio
justo donde se está escribiendo.

### Móvil horizontal / teclado abierto

```
┌──────────────────────────────────────────┐
│ ●                                    ⚙️  │  ← cabecera encogida
├───────────────────┬──────────────────────┤
│   [ escena ]      │  ¿Qué es esto?       │
│                   │  [________________]  │
│                   │  [   Comprobar   ]   │
└───────────────────┴──────────────────────┘
```

Poco alto: la escena y la respuesta se ponen **lado a lado** en vez de
apiladas, y la navegación pasa a un menú desplegable desde la cabecera.

### Un solo componente, tres presentaciones

```
navegacion.js
  ├── elementos()            de modulos.js + rol del usuario
  ├── activo                 qué módulo está abierto
  └── pintar(contenedor)     dibuja una <ul> plana, sin saber dónde va

estilos.css
  ├── .navegacion--lateral   barra lateral con texto     (≥75rem)
  ├── .navegacion--iconos    barra lateral de iconos     (56–75rem)
  ├── .navegacion--inferior  barra inferior              (<56rem)
  └── .navegacion--cajon     desplegable                 (poco alto)
```

El único añadido de JavaScript frente a hoy es abrir y cerrar el cajón. El
resto es CSS sobre el mismo marcado.

---

## 4. Idiomas

### Los tres conceptos, separados

Hoy la aplicación mezcla dos cosas en una: el idioma en que habla y el idioma
que enseña. Se separan en tres:

```js
{
  uiLocale:         "es",           // en qué habla la aplicación
  learningLanguage: "en",           // qué se está aprendiendo
  supportLanguages: ["es", "eu"]    // en qué se apoya para explicarlo
}
```

| | Qué gobierna | Hoy |
|---|---|---|
| `uiLocale` | `t()`, `documentElement.lang`, títulos, botones, mensajes | Existe, en `localStorage` |
| `learningLanguage` | El `lang` de la palabra que se enseña, la voz del TTS, qué columna del contenido es «la respuesta» | **`en-GB` fijo en `audio.js`** |
| `supportLanguages` | Qué traducciones se muestran, en qué orden, con qué etiquetas | **«Castellano» y «Euskara» a mano en el HTML** |

Esto es lo que permite, sin tocar arquitectura: interfaz en euskera aprendiendo
inglés con apoyo en castellano; o interfaz en castellano aprendiendo euskera.

### Lo que arregla de paso

```html
<!-- ahora: el navegador cree que "dog" es castellano -->
<h2 class="palabra__en" id="palabra-en">dog</h2>

<!-- debe ser -->
<h2 class="palabra__en" id="palabra-en" lang="en">dog</h2>
```

Con `<html lang="es">` y sin `lang` en el contenido, un lector de pantalla lee
*dog* con fonética castellana y el TTS elige la voz equivocada. **El atributo
`lang` de cada elemento de contenido sale de `learningLanguage`.**

Las filas de traducción dejan de estar escritas a mano y se generan desde
`supportLanguages`, con las etiquetas traducidas (`idioma.es`, `idioma.eu`), de
modo que con la interfaz en inglés se lea «Spanish» y «Basque».

### Dónde vive la preferencia

- **`localStorage`** sigue siendo la vía rápida: se lee antes de que Firebase
  conteste, así que la aplicación no arranca en un idioma y salta a otro.
- **`users/{uid}/perfil`** es la fuente cuando hay sesión, para que el idioma
  viaje entre el móvil y la tablet.
- Al entrar: si el perfil trae idioma, gana y se copia a `localStorage`.

### Estructura de las traducciones

La forma actual es «primero el idioma»:

```js
TEXTOS = { es: { "nav.inicio": "Inicio" }, eu: { … }, en: { … } }
```

Se propone darle la vuelta, a «primero la clave», que es lo que planteas:

```js
TEXTOS = {
  "nav.inicio": { es: "Inicio", eu: "Hasiera", en: "Home" },
  "nav.ingles": { es: "Inglés", eu: "Ingelesa", en: "English" }
}
```

Ventajas concretas, no estéticas:

- **Una traducción que falta se ve de un vistazo**, porque las tres están en la
  misma línea. Con la forma actual hay que comparar tres bloques de 480 líneas.
- **La exportación a CSV que ya existe** (`tools/textos-csv.mjs`) se vuelve
  directa: una clave por fila, un idioma por columna, que es exactamente lo que
  hay que enviar a revisar.
- **Añadir un cuarto idioma** es añadir una clave a cada línea, no duplicar un
  bloque entero y descuadrarlo.

Es un cambio mecánico de forma, no de API: `t()`, `aplicar()` y `data-i18n`
siguen igual, y `tools/textos-csv.mjs` es lo único que se adapta.

**Espacio de nombres de las claves**, para que a 500 claves siga siendo
navegable:

```
comun.*            aceptar, volver, cargando, ajustes
nav.*              los destinos de navegación
ajustes.*          la pantalla de ajustes
idioma.*           nombres de idiomas (para supportLanguages)
rol.*              nombres de los perfiles
modulo.<id>.*      nombre y descripción de cada módulo
tarjetas.*         el módulo de vocabulario
mates.*            Matemagia
dicc.*             el diccionario
error.*            mensajes de error
```

**Cuándo dividir en ficheros.** Hoy son 114 claves y todo en un módulo está
bien: sin build, un `import` es más simple que una descarga. A partir de unas
500 claves, o de un cuarto idioma, se pasa a `vocabulario/i18n/<codigo>.json`
cargado bajo demanda y cacheado por el service worker. **No antes**: partirlo
ahora es complicar sin ganar nada.

### La frontera que no se cruza

```
INTERFAZ                          CONTENIDO ACADÉMICO
i18n.js                           contenido/*.csv
"Comprobar", "Repasar"            dog / perro / txakur
"Mi progreso"                     "The dog is barking."
cambia con uiLocale               NO cambia nunca con uiLocale
```

Ni una palabra de vocabulario en `i18n.js`, ni una etiqueta de interfaz en el
contenido. Es la misma separación del informe del maestro académico, aplicada
a la interfaz: hoy se respeta y hay que seguir respetándola.

---

## 5. Perfiles

La navegación debe admitir tres perfiles desde el diseño, aunque hoy solo exista
uno de verdad:

```js
{ id: "tarjetas",   roles: ["alumno", "tutor"] }
{ id: "alumnos",    roles: ["tutor"] }
{ id: "contenidos", roles: ["tutor", "admin"] }
{ id: "usuarios",   roles: ["admin"] }
```

| Perfil | Ve |
|---|---|
| **alumno** | Mis actividades, inglés, matemáticas, diccionario, mi progreso |
| **tutor** | Lo del alumno, más alumnos, contenidos, asignaciones, progreso ajeno |
| **admin** | Usuarios, configuración, catálogos, importaciones |

Tres cosas que hay que dejar dichas ahora:

1. **El rol vive en `users/{uid}/perfil.rol`**, por defecto `alumno`.
2. **Ocultar en la interfaz no es proteger.** Cuando existan datos de tutor,
   el rol tiene que comprobarse en las reglas de Firestore. La navegación por
   rol es comodidad, no seguridad.
3. **No hace falta implementarlo ahora**, pero sí que `modulos.js` acepte el
   campo `roles` y que la navegación lo filtre. Son cinco líneas hoy y un
   rediseño más adelante.

Lo que esto evita: una navegación pensada solo para Sofía, en la que meter
«mis alumnos» obligue a rehacerla.

---

## 6. Componentes a reutilizar

Los que ya existen y hay que respetar:

| Componente | Estado |
|---|---|
| Tarjeta de módulo | ✅ `modulos.js`, dibujada desde datos |
| Botones | ✅ sistematizados por clases |
| Selector de idioma | ✅ generado desde `IDIOMAS` |
| Tokens de color y tipografía | ✅ en `:root` |

Los que hay que extraer, por orden de rentabilidad:

| Componente | Hoy | Debería |
|---|---|---|
| **Navegación** | No existe: se navega desde el índice | Un módulo, tres presentaciones por CSS |
| **Cabecera de módulo** | Copiada 5 veces en el HTML | Generada: título, color, volver, acciones |
| **Pantalla / panel** | 12 `<section>` a mano | Cada módulo dibuja la suya en un punto de montaje |
| **Barra de progreso** | Repetida con variantes | Uno, con el color del módulo por variable |
| **Ficha de usuario** | Solo en Ajustes | Reutilizable en la barra lateral |
| **Teclado numérico** | Dentro de Matemagia | Extraíble para cualquier entrada numérica |
| **Zona de escucha** | Repetida en palabra y ejemplo | Un botón de audio con su estado |

Sobre las 12 pantallas en un fichero: **no hay que partirlo de golpe**. La
regla es que cada módulo que se toque por otra razón se lleve su marcado a su
propio módulo JS. Un rediseño de golpe es todo el riesgo junto y ninguna
ventaja inmediata.

---

## 7. Identidad visual

Se mantiene lo definido, con un matiz:

- **«Añade color a tu vida»** y las escenas en gris con el concepto en color son
  del **módulo lingüístico**, no de toda la aplicación.
- Lo que comparten todos los módulos son los **tokens**: paleta, tipografías,
  radios, sombras, tamaños táctiles.
- Cada módulo tiene su color (ya lo hace: `--color-modulo`) y puede tener su
  propia metáfora. Matemagia usa recta numérica y saltos, y está bien que no se
  parezca a una tarjeta de vocabulario.
- **Infantil sin infantilizar**: nada de recompensas ruidosas, tipografías de
  guardería ni animaciones que celebren cada acierto. Es una herramienta, y
  a los 9 años se nota cuando algo te trata de pequeño.
- La plataforma **no diagnostica ni clasifica** nada. Ofrece palancas —
  contenido, dificultad, cantidad, presentación, ritmo, tipo de actividad — y
  quien las mueve es el adulto responsable.

---

## 8. Plan de implementación

Cinco fases. Cada una entrega algo utilizable y ninguna necesita a la
siguiente para tener sentido. **No hay reescritura.**

### Fase 0 · Correcciones · sin cambiar el aspecto

Los fallos verificados de la sección 1. Nada de esto cambia cómo se ve la
aplicación, y todo se vuelve más caro cuanto más crezca:

1. Área segura de la cabecera (el inset de arriba aplicado abajo).
2. `lang` en el contenido que se enseña.
3. `← Volver` traducido.
4. `font-size` relativo en `body`.
5. Objetivos táctiles a 48 px bajo `pointer: coarse`.
6. Estados de hover solo bajo `hover: hover`.
7. `100dvh` donde hoy haya alturas de ventana.

### Fase 1 · El armazón y la navegación

El cambio estructural, y el único con riesgo visual. **Mockup HTML antes**, como
con la pestaña de Ajustes.

- `.armazon` con áreas de grid y los cuatro puntos de ruptura.
- `navegacion.js` con la lista y el módulo activo.
- Las cuatro presentaciones en CSS.
- Las pantallas actuales se meten dentro sin tocarlas por dentro.

Al terminar esta fase la aplicación ya se comporta distinto en PC, tablet y
móvil, con el mismo contenido.

### Fase 2 · Los tres idiomas separados

- `users/{uid}/perfil` con `uiLocale`, `learningLanguage`, `supportLanguages` y
  `rol`.
- `audio.js` deja de tener `en-GB` fijo.
- Las filas de traducción se generan desde `supportLanguages`.
- `i18n.js` cambia a la forma «primero la clave» y `textos-csv.mjs` se adapta.

### Fase 3 · Aprovechar el espacio

- Container query en el área de trabajo.
- Columna auxiliar opcional, aportada por cada módulo.
- La tarjeta con dibujo y respuesta lado a lado cuando hay ancho.

### Fase 4 · Componentes

- Cabecera de módulo generada.
- Barra de progreso unificada.
- Teclado numérico extraído.
- Cada módulo que se toque, se lleva su marcado.

### Fase 5 · Perfiles

- `roles` en `modulos.js` y filtrado en la navegación.
- Reglas de Firestore por rol cuando existan datos de tutor.

### Regla de trabajo

**Mockup HTML antes de cada fase que cambie el aspecto.** Es lo que funcionó
con la pestaña de Ajustes: se ve, se decide y luego se implementa una sola vez.
