# Colores — vocabulario en inglés

> **Añade color a tu vida. Aprende un idioma nuevo.**

Prototipo de PWA para reforzar y ampliar vocabulario en inglés. No sustituye al
colegio ni a Duolingo: es una herramienta personal de refuerzo, pensada para
alimentarla poco a poco con palabras de los libros del cole, de sus intereses y
de conversaciones reales.

Cada palabra se presenta con una **escena dibujada en gris**, donde **solo el
concepto que hay que aprender aparece en color**. Vive dentro de este mismo
repositorio, como subcarpeta independiente:

**https://yosulin.github.io/trafico-okin-zumaia/vocabulario/**

---

## Cómo funciona una tarjeta

**Pregunta** → dibujo grande, audio automático de la palabra en inglés, botón
para volver a escucharla y un campo para escribirla. La palabra en inglés no
aparece.

**Respuesta** → palabra en inglés en grande (con audio), traducción al
castellano y al euskera, frase de ejemplo en inglés (con audio) y su traducción
a los dos idiomas, opcional.

**Después** → «La sabía» o «Repasar». No hay repaso espaciado (SRS): solo se
guarda el estado de cada palabra y, en la siguiente ronda, van primero las de
«Repasar» y las nuevas.

---

## Estructura

```
vocabulario/
├── index.html                → estructura de las tres pantallas
├── manifest.webmanifest      → instalación como PWA
├── service-worker.js         → caché offline (sube CACHE_NAME al publicar cambios)
├── data/
│   └── vocabulario.json      → TODO el contenido: temas y tarjetas
├── images/                   → una escena SVG por tarjeta
├── icons/                    → iconos de la PWA
├── css/estilos.css
└── js/
    ├── audio.js              → Voz: única salida de audio (TTS hoy, MP3 mañana)
    ├── progreso.js           → Progreso: nueva / vista / conocida / repasar
    ├── datos.js              → Datos: carga, normaliza y ordena el mazo
    └── app.js                → la interfaz de la tarjeta
```

---

## Añadir palabras nuevas

1. Añade un objeto a `tarjetas` en `data/vocabulario.json`.
2. Guarda su ilustración en `images/` con el mismo nombre que el `id`.
3. Añade el fichero nuevo a la lista `FICHEROS_APP` de `service-worker.js` y
   sube el número de `CACHE_NAME`.

```json
{
  "id": "animals_dog",
  "word": "dog",
  "es": "perro",
  "eu": "txakurra",
  "image": "images/animals_dog.svg",
  "wordAudio": "",
  "example": {
    "en": "I play with my dog in the garden.",
    "es": "Juego con mi perro en el jardín.",
    "eu": "Nire txakurrarekin jolasten dut lorategian.",
    "audio": ""
  },
  "theme": "animals",
  "layer": 1,
  "type": "noun",
  "tags": ["animal", "pet"]
}
```

Campos opcionales que ya se admiten:

- `aceptar`: lista de respuestas alternativas válidas al escribir
  (por ejemplo `["mum", "mom"]`).

**Se pueden añadir campos nuevos sin tocar el código**: `unidad`, `libro`,
`dificultad`, `edad`, `cefr`... `datos.js` conserva cualquier campo extra tal
cual, así que estarán disponibles el día que se quieran usar para filtrar o
para ordenar.

Los temas (`temas`) solo sirven para la etiqueta que se ve sobre el dibujo.

---

## Las ilustraciones

Son SVG de 400 × 300 hechos a mano, con una regla fija:

- El escenario y los personajes que dan contexto van en **grises**
  (`#F4F5F7`, `#E4E7EB`, `#CDD2D9`, `#AAB1BB`, `#7C848F`, `#4B525C`).
- El concepto que hay que aprender va en **color**, con un halo pálido detrás
  para que no haya ninguna duda de cuál es el elemento objetivo.

Son deliberadamente sustituibles: para cambiar una escena por una ilustración
mejor (SVG, WebP o lo que sea) basta con dejar el fichero nuevo en `images/` y
apuntar a él desde el campo `image` de la tarjeta.

---

## El audio

Hoy se sintetiza con la Web Speech API del navegador, pidiendo voz **inglesa
británica** (`en-GB`) y, si no existe en el dispositivo, cualquier otra voz
inglesa.

Todo el audio pasa por `js/audio.js`. Si una tarjeta trae `wordAudio` o
`example.audio` con la ruta de un fichero, se reproduce ese fichero en lugar de
la voz sintética. Por eso, sustituir el TTS por MP3 reales no exige tocar ni la
interfaz ni la estructura de las tarjetas: solo rellenar esos dos campos.

---

## El progreso

Se guarda en `localStorage`, sin cuentas, sin backend y sin estadísticas: para
cada palabra, uno de estos cuatro estados: `nueva`, `vista`, `conocida`,
`repasar`. «Empezar de cero», en la pantalla de inicio, lo borra todo.

---

## Probarlo en local

Hace falta servirlo por HTTP (el service worker y `fetch` no funcionan abriendo
el fichero directamente):

```bash
cd vocabulario
python3 -m http.server 8000
# y abrir http://localhost:8000
```
