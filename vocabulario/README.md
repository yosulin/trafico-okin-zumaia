# Colores — vocabulario en inglés

> **Añade color a tu vida. Aprende un idioma nuevo.**

PWA para reforzar y ampliar vocabulario en inglés. No sustituye al colegio ni a
Duolingo: es una herramienta personal, pensada para alimentarla poco a poco con
palabras de los libros del cole, de sus intereses y de conversaciones reales.

Cada palabra se presenta con una **escena dibujada en gris** donde **solo el
concepto que hay que aprender aparece en color**.

El contenido y el progreso viven en **Firebase**: Firestore es la fuente de
verdad y cada persona entra con su cuenta de Google para que la app recuerde lo
que ya sabe. Las imágenes y los audios se sirven **con la propia app** (carpeta
`media/`), y el día que haga falta se pasan a Firebase Storage cambiando una
palabra en la configuración.

---

## Arquitectura

```
Navegador (esta PWA, estática, sin build step)
   │
   ├── Firebase Authentication ── entrar con Google
   │
   ├── Firestore  cards/{cardId}                 ← contenido (solo lectura)
   │              themes/{themeId}               ← etiquetas de tema (opcional)
   │              users/{uid}/progress/{cardId}  ← progreso, privado
   │
   └── medios     ./media/images/… (Hosting)  ó  Firebase Storage

tools/import/  ← el ÚNICO sitio que escribe contenido (Admin SDK)
```

La app **nunca escribe en `cards`**: las reglas de Firestore no se lo permiten.
El contenido entra por el importador, que usa una cuenta de servicio.

---

## Cómo funciona una tarjeta

**Pregunta** → dibujo grande, audio automático de la palabra en inglés, botón
para volver a escucharla y un campo para escribirla. La palabra en inglés no
aparece.

**Respuesta** → palabra en inglés en grande (con audio), traducción al
castellano y al euskera, frase de ejemplo en inglés (con audio) y su traducción
a los dos idiomas, plegable.

**Después** → «La sabía» o «Repasar», que escriben el progreso en Firestore. No
hay repaso espaciado (SRS): en la ronda siguiente van primero las de «Repasar»
y las nuevas.

---

## Puesta en marcha

### 1. Crear el proyecto Firebase

En [console.firebase.google.com](https://console.firebase.google.com):

1. **Crear un proyecto** (puedes desactivar Google Analytics).
2. **Authentication** → *Comenzar* → pestaña *Sign-in method* → habilitar
   **Google** → guardar.
   En *Settings → Authorized domains* añade el dominio desde el que vayas a
   abrir la app (`localhost` ya viene; añade el de Hosting o el de GitHub Pages
   si publicas ahí).
3. **Firestore Database** → *Crear base de datos* → modo **producción** →
   elige región (`eur3` o `europe-west1`).
4. **Configuración del proyecto → Tus apps → Web (`</>`)** → registra la app y
   copia el objeto de configuración.

> **Storage no hace falta.** Desde finales de 2024 exige el plan Blaze (de pago).
> El prototipo sirve imágenes y audios desde `vocabulario/media/`, con la propia
> app. Cuando quieras dar el salto: activa Blaze, crea el bucket, pon
> `MEDIA_SOURCE=storage` en `.env`, vuelve a generar la configuración y sube los
> ficheros con `npm run semilla-storage`. Las rutas guardadas en Firestore
> (`images/animals/animals_dog.svg`) son las mismas en los dos sitios, así que no
> hay que tocar ni una tarjeta.

### 2. Configurar este repositorio

Lo más seguro es no copiar la configuración a mano: con `firebase login` hecho,
la CLI se la pide al propio proyecto.

```bash
node tools/config-desde-firebase.mjs   # → vocabulario/js/firebase-config.js
```

(Copiar la `apiKey` a mano funciona, pero un carácter de más —o un editor que
guarde algo raro— produce un `auth/api-key-not-valid` que no dice por qué.)

Alternativas, si prefieres no depender de la CLI: rellenar `.env` a partir de
`.env.example` y ejecutar `node tools/generar-config.mjs`, o copiar
`vocabulario/js/firebase-config.example.js` a `vocabulario/js/firebase-config.js`
y editarlo.

`vocabulario/js/firebase-config.js` está en `.gitignore`. Esos valores **no son
secretos** —viajan en cualquier app web de Firebase—, pero así cada instalación
apunta a su propio proyecto. Lo que protege los datos de verdad son las reglas.

### 3. Publicar las reglas

```bash
npm install -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc     # y poner el id del proyecto
firebase deploy --only firestore:rules
```

### 4. Subir las 10 tarjetas de demostración

```bash
cd tools/import
npm install
export GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/clave-cuenta-de-servicio.json
npm run semilla-prueba   # ver qué haría
npm run semilla          # crear las 10 tarjetas en Firestore
```

Detalles y más orígenes (CSV escolar, mazos de Anki): **[tools/import/README.md](../tools/import/README.md)**.

### 5. Probar en local

Hace falta servirlo por HTTP (los módulos y el service worker no funcionan
abriendo el fichero directamente):

```bash
cd vocabulario
python3 -m http.server 8000
# http://localhost:8000
```

### 6. Desplegar

```bash
firebase deploy --only hosting     # publica la carpeta vocabulario/
```

También sirve cualquier hosting estático (GitHub Pages incluido): la app solo
son ficheros. En ese caso hay que **comitear** `js/firebase-config.js` (o
generarlo en el despliegue) y añadir ese dominio a los *Authorized domains* de
Authentication.

---

## Estructura

```
vocabulario/
├── index.html                  → login, inicio, tarjeta y final
├── manifest.webmanifest        → instalación como PWA
├── service-worker.js           → cachés de shell, SDK y medios (sube VERSION al publicar)
├── css/estilos.css
├── icons/
├── media/images/…              → las ilustraciones (las sirve Hosting)
└── js/
    ├── firebase.js             → inicialización única (Auth y Firestore)
    ├── firebase-config.js      → generado, fuera del repositorio
    ├── sesion.js               → entrar/salir con Google
    ├── datos.js                → lee "cards" y "themes" de Firestore
    ├── progreso.js             → users/{uid}/progress/{cardId}
    ├── media.js                → rutas → URLs (Hosting o Storage)
    ├── audio.js                → audio grabado con respaldo de voz sintética
    └── app.js                  → la interfaz de la tarjeta
```

---

## El esquema de una tarjeta

```json
{
  "id": "animals_dog",
  "word": "dog",
  "es": "perro",
  "eu": "txakurra",
  "theme": "animals",
  "layer": 1,
  "type": "noun",
  "imagePath": "images/animals/animals_dog.svg",
  "wordAudioPath": "audio/words/animals_dog.mp3",
  "example": {
    "en": "I play with my dog.",
    "es": "Juego con mi perro.",
    "eu": "Txakurrarekin jolasten dut.",
    "audioPath": "audio/examples/animals_dog_example_01.mp3"
  },
  "tags": ["animal", "pet"],
  "source": { "type": "general", "book": null, "unit": null },
  "active": true
}
```

En Firestore se guardan **rutas**, no URLs: así el contenido no depende de
tokens de descarga que pueden regenerarse, y cambiar de sitio los ficheros no
obliga a reescribir las tarjetas. `media.js` las resuelve según la opción
`medios` de la configuración: `"hosting"` las convierte en `./media/…` y
`"storage"` se las pide a Firebase Storage (y guarda la URL en `localStorage`).

`datos.js` conserva cualquier **campo extra** del documento (nivel CEFR, edad,
dificultad, procedencia...), así que ampliar el esquema no exige tocar la app.
Solo `active: true` decide qué se ve.

---

## Progreso

`users/{uid}/progress/{cardId}`:

```json
{
  "status": "known",
  "seenCount": 8,
  "knownCount": 6,
  "reviewCount": 2,
  "lastSeen": "timestamp",
  "updatedAt": "timestamp"
}
```

Cuatro estados: `new`, `learning`, `known`, `review`. Nada de estadísticas ni de
SRS todavía. Se escribe con `setDoc(merge)` + `increment()`, así que **sin
conexión Firestore encola la escritura y la envía sola al volver la red**: la app
no lleva ninguna cola propia.

---

## El audio

Toda la app pide sonido por `js/audio.js`, con dos funciones:

```js
playWordAudio(tarjeta)      // ¿wordAudioPath? → fichero de Storage; si no → voz sintética
playExampleAudio(tarjeta)   // ídem con example.audioPath
```

Hoy casi todo suena con la Web Speech API pidiendo voz **inglesa británica**
(`en-GB`). Ir sustituyéndolo por MP3 reales no exige tocar ni la interfaz ni las
tarjetas: basta con subir el audio y rellenar esas rutas (el importador de Anki
ya lo hace solo).

---

## Offline

- El **shell** (HTML, CSS, JS, iconos e ilustraciones) se precachea: la app abre
  sin red.
- El **SDK de Firebase** y las tipografías se guardan al usarlas.
- Las **imágenes y audios** ya vistos se guardan al usarlos.
- Las **tarjetas** salen de la caché persistente de Firestore.
- El **progreso** hecho sin red se sincroniza solo al volver la conexión.

Lo que no funciona sin red es **entrar por primera vez**: el login necesita
conexión. Una vez dentro, la sesión se mantiene.

---

## Las ilustraciones

SVG de 400 × 300 hechos a mano, con una regla fija:

- El escenario y los personajes que dan contexto van en **grises**
  (`#F4F5F7`, `#E4E7EB`, `#CDD2D9`, `#AAB1BB`, `#7C848F`, `#4B525C`).
- El concepto que hay que aprender va en **color**, con un halo pálido detrás
  para que no haya duda de cuál es el elemento objetivo.

Están en `vocabulario/media/images/`, organizadas por tema. Cambiar una escena
por una ilustración mejor (SVG, WebP...) es dejar el fichero nuevo ahí y apuntar
`imagePath` a él.

---

## Quién puede entrar

La app es **privada**. Cualquiera puede pulsar «Entrar con Google» —eso no se
puede impedir en el plan gratuito—, pero solo ve algo quien tenga su correo en
la colección `allowed` de Firestore. Quien no esté se encuentra una pantalla que
se lo dice, y ni una tarjeta.

El filtro está en las **reglas**, no en la página: no se puede saltar desde el
navegador. Y la lista solo se toca con la cuenta de servicio:

```bash
cd tools/import
npm run permitidos                        # ver quién puede entrar
npm run permitir -- alguien@gmail.com     # dar acceso
npm run denegar  -- alguien@gmail.com     # quitarlo
```

Los cambios son inmediatos: no hay que desplegar ni volver a publicar nada.

---

## Seguridad

`firestore.rules` y `storage.rules`, en la raíz del repositorio:

- Solo lee tarjetas quien ha entrado **y está en la lista**, y solo las activas.
- Escribir en `cards` está prohibido desde cualquier cliente: el contenido entra
  por `tools/import/`, con Admin SDK, que no pasa por las reglas.
- Cada persona solo lee y escribe **su** progreso, y solo si está en la lista.
- Todo lo demás, denegado.

La clave de la cuenta de servicio del importador nunca va al repositorio
(`.gitignore` la cubre); se indica con `GOOGLE_APPLICATION_CREDENTIALS`.
