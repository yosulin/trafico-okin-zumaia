# Tráfico desde OKIN Zumaia

Panel visual (dashboard) para consultar de un vistazo el estado del tráfico desde
**OKIN Zumaia** hacia los destinos habituales (Zarautz, Donostia, Eibar, Irún), con
varias rutas posibles por destino, semáforo de colores por retraso e histórico
visual de las últimas horas.

No sustituye a Google Maps / Waze: es un indicador rápido para decidir si merece
la pena abrir el navegador del coche antes de salir.

Sitio 100% estático — HTML, CSS y JavaScript sin frameworks ni build step.
Instalable como **PWA** y publicado con **GitHub Pages**.

**Web publicada:** https://yosulin.github.io/trafico-okin-zumaia/

---

## 0. Cómo está pensada la arquitectura (léelo antes que nada)

**El navegador de quien visita la web nunca llama a TomTom, y nunca se le pide
ninguna clave de API.** Toda la información —tanto el estado "en vivo" de cada
ruta como el histórico de las últimas horas— sale de un único fichero JSON
(`data/historial.json`), que actualiza un **GitHub Action programado** cada
pocos minutos usando una clave guardada como *secret* del repositorio.

```
GitHub Action (cron) ──consulta──> TomTom
        │
        └──escribe──> data/historial.json
                              │
                              └──lee──> la web (todos los visitantes)
```

Ventajas de este enfoque frente a que cada navegador llamase a TomTom
directamente:
- Nadie necesita tener ni pegar ninguna clave para poder ver el panel.
- La clave de TomTom no viaja nunca por el navegador de nadie ni queda
  visible en el código fuente de la página.
- Un único sitio (el Action) consume la cuota gratuita de TomTom, en vez de
  multiplicarse por cada persona que tenga la web abierta.

---

## 1. Estructura del proyecto

```
traffic-dashboard-okin/
├── index.html                  → estructura de la página (sin datos ni lógica)
├── manifest.webmanifest        → metadatos de instalación como PWA
├── service-worker.js           → caché offline del "app shell"
├── .github/
│   └── workflows/
│       └── actualizar-historial.yml  → cron que consulta TomTom (única llamada de todo el proyecto)
├── scripts/
│   └── actualizar-historial.mjs      → script que ejecuta ese cron (reutiliza js/config.js, estado.js, api.js)
├── data/
│   └── historial.json          → estado en vivo + histórico compartidos; los escribe el Action, la web solo los lee
├── css/
│   └── styles.css              → todo el diseño visual
├── icons/                      → iconos de la PWA (192/512/maskable/apple/favicon)
├── js/
│   ├── config.js                ← ÚNICO fichero que necesitas editar habitualmente
│   ├── estado.js                → traduce minutos de retraso a color/índice de semáforo
│   ├── api.js                   → llamadas a la API de TomTom — SOLO las usa el Action, no el navegador
│   ├── datos.js                 → la web lee data/historial.json y expone estado en vivo + histórico
│   └── app.js                   → construye el grid, pinta los datos, modo TV, instalación PWA
└── README.md
```

Separación de responsabilidades:

| Fichero                              | Qué contiene                                                        | Cuándo tocarlo |
|----------------------------------------|-----------------------------------------------------------------------|----------------|
| `js/config.js`                        | Origen, destinos, rutas, umbrales, refresco, histórico                 | Cada vez que cambie el contenido |
| `js/estado.js`                        | Conversión retraso → tramo de color                                    | Casi nunca |
| `js/api.js`                           | Cómo se llama a la API de tráfico (solo lo usa el Action)              | Solo si cambias de proveedor |
| `js/datos.js`                         | Cómo lee la web el fichero compartido (en vivo + histórico)            | Casi nunca |
| `js/app.js`                           | Construcción del grid, pintado, modo TV, instalación                   | Solo si cambias el comportamiento de la interfaz |
| `css/styles.css`                      | Todo el aspecto visual                                                 | Solo si quieres cambiar el diseño |
| `service-worker.js`                   | Qué ficheros quedan disponibles offline                                | Solo si añades/quitas ficheros del proyecto |
| `scripts/actualizar-historial.mjs`    | Única llamada a TomTom de todo el proyecto                             | Casi nunca (usa la misma config que el resto) |
| `.github/workflows/actualizar-historial.yml` | Cuándo se ejecuta ese script                                    | Si quieres cambiar la frecuencia del cron |
| `data/historial.json`                 | Datos compartidos (los escribe el Action, no se edita a mano)          | Nunca a mano |

---

## 2. Publicar en GitHub Pages

1. Sube el contenido de esta carpeta a la raíz de un repositorio de GitHub.
2. **Settings → Pages** → Source: rama `main`, carpeta `/ (root)`.
3. GitHub te da la URL (`https://tuusuario.github.io/tu-repo/`).

Sin build step: es HTML/CSS/JS puro, incluido el Service Worker.

---

## 3. Instalar como aplicación (PWA)

Al abrir la web desde Chrome, Edge o Android, aparece un botón **📲 Instalar app**
en la cabecera en cuanto el navegador confirma que la app cumple los requisitos
de instalación. Se implementa capturando el evento `beforeinstallprompt` y
mostrando nuestro propio botón, en vez de depender del aviso silencioso de cada
navegador.

**En iOS (Safari) no existe ese evento** — limitación de la propia plataforma —
así que se muestra un aviso con las instrucciones manuales (Compartir →
«Añadir a pantalla de inicio»), que se puede cerrar y no vuelve a aparecer.

Una vez instalada, si no hay conexión, la app sigue mostrando el **último
estado conocido** (lo último que `datos.js` consiguió descargar de
`data/historial.json`), en vez de una pantalla en blanco. El Service Worker
solo cachea los ficheros propios de la aplicación (HTML/CSS/JS/iconos) — nunca
el fichero de datos, que siempre se pide fresco a la red.

Si cambias los ficheros del proyecto y quieres forzar que los usuarios con la
app ya instalada descarguen la versión nueva, sube el número de `CACHE_NAME`
en `service-worker.js` (y, por coherencia, `CONFIG.pwa.cacheVersion`).

---

## 4. Puesta en marcha del Action (una sola vez)

El Action es lo único que llama a TomTom en todo el proyecto. Para que
funcione:

1. **Settings → Secrets and variables → Actions → New repository secret**:
   - Name: `TOMTOM_API_KEY`
   - Value: tu clave de TomTom (Routing API)
2. **Settings → Actions → General → Workflow permissions** → comprobar que
   está en "Read and write permissions" (el Action necesita hacer `commit`
   del fichero de datos actualizado).
3. Opcional: en la pestaña **Actions**, puedes lanzar el workflow
   "Actualizar historial de tráfico" a mano la primera vez (botón
   "Run workflow") en vez de esperar a la siguiente ejecución programada.

A partir de ahí funciona solo, sin que nadie tenga que configurar nada en su
navegador.

---

## 5. Añadir o modificar destinos y rutas

Todo se hace en **`js/config.js`**, dentro del array `destinos`.

### Añadir un destino nuevo

```js
{
  id: "azpeitia",
  nombre: "Azpeitia",
  rutas: [
    {
      id: "n1",
      nombre: "N-I",
      destino: { lat: 43.1795, lon: -2.2669 }
    }
  ]
}
```

Añádelo como un elemento más del array `destinos` y aparecerá automáticamente
como una tarjeta nueva, con su propia línea de histórico — no hace falta tocar
`index.html`, `app.js` ni el CSS. El Action recogerá datos para ese destino en
su siguiente ejecución.

### Añadir una ruta nueva a un destino existente

```js
{
  id: "gi2634",
  nombre: "GI-2634 por la costa",
  destino: { lat: 43.2833, lon: -2.1700 }
}
```

### Forzar que una ruta pase por una carretera concreta

```js
{
  id: "n634",
  nombre: "N-634",
  destino: { lat: 43.3183, lon: -1.9812 },
  via: [{ lat: 43.2831, lon: -2.1306 }]
}
```

Para obtener coordenadas: en Google Maps, clic derecho sobre el punto exacto →
aparecen listas para copiar.

### Cambiar los umbrales de color del semáforo

Array `umbrales` en `config.js`: cada tramo tiene un límite en minutos
(`hasta`) y un color/emoji. Cambia los números o añade/quita tramos.

---

## 6. Cómo se mantiene fresco el dato "en vivo" (sin caché en el navegador)

Cada ruta, en `data/historial.json`, guarda su `estadoActual` con el último
resultado bueno del Action. Si una consulta puntual del Action falla, ese dato
se sigue publicando (con su marca de tiempo original) mientras no supere
`CONFIG.datosCompartidos.maxAntiguedadEstadoActualMin` (90 minutos por
defecto — ver el porqué de ese margen en el punto 9). Pasado ese tiempo sin
ninguna respuesta válida, la ruta pasa a mostrarse como **"Sin datos"**.

La web, por su parte, no guarda ninguna caché propia: simplemente vuelve a
descargar `data/historial.json` cada `CONFIG.datosCompartidos.refrescoMin`
minutos (2 por defecto) para enterarse de lo último que haya dejado el Action.
Como es un fichero estático (no una API con límite de peticiones), no hay
ningún problema en refrescarlo con esa frecuencia.

Si un dato tiene más de 20 minutos, se marca discretamente junto a la ruta
(`· hace X min`) para dejar claro que puede haber cambiado desde entonces, sin
llegar todavía a "Sin datos".

---

## 7. Histórico visual (línea temporal tipo Uptime Kuma)

Debajo de las rutas de cada destino aparece una tira de bloques de color, uno
por intervalo de tiempo, con el **peor estado alcanzado por ese destino** en
cada intervalo. Por defecto: 16 bloques × 30 minutos = últimas 8 horas,
configurable en `CONFIG.historial`.

A diferencia del "en vivo" (punto 6), el histórico solo cuenta una muestra
cuando el Action obtuvo un dato realmente fresco ese ciclo — nunca arrastra
hacia atrás un dato viejo, para no dibujar una tendencia inventada.

---

## 8. Estado del destino

Se mantiene la filosofía original: el estado general de un destino (el punto
de color junto a su nombre) es siempre el peor estado entre todas sus rutas
disponibles en ese momento.

---

## 9. Sobre la fiabilidad del cron de GitHub Actions (importante)

GitHub advierte explícitamente que los workflows programados con `schedule`
son **"best effort"**, no una garantía: pueden retrasarse varios minutos, o
incluso saltarse una ejecución si hay carga en sus servidores — esto es
especialmente notorio con cron muy frecuentes (cada 5-15 min) en repositorios
con poco tráfico. En la práctica, esto puede significar huecos ocasionales
más largos de lo esperado entre actualizaciones.

Por eso:
- `CONFIG.datosCompartidos.maxAntiguedadEstadoActualMin` se deja generoso
  (90 min) para no mostrar "Sin datos" solo porque el cron se haya retrasado.
- Si en algún momento ves huecos largos en la línea temporal o datos "en
  vivo" muy desactualizados de forma recurrente, la solución más fiable es
  sustituir el disparador `schedule` por un servicio externo de cron
  (ej. cron-job.org) que llame a la API de GitHub
  (`POST /repos/{owner}/{repo}/actions/workflows/actualizar-historial.yml/dispatches`)
  cada pocos minutos — los disparos manuales (`workflow_dispatch`) no sufren
  este mismo retraso. Esto no está configurado por defecto para no añadir una
  pieza más (y otro token) de la que depender, pero es la vía recomendada si
  la precisión te importa más que la sencillez.

---

## 10. Modo TV

El diseño es responsive de forma automática: a partir de anchos típicos de
1080p y 4K, las tarjetas, los textos y los bloques del histórico crecen
progresivamente para poder leerse a distancia en una pantalla compartida de
oficina.

Si el navegador no ocupa toda la resolución real de la pantalla, el botón
**📺** de la cabecera fuerza ese mismo aspecto "TV" independientemente del
ancho de la ventana. La preferencia se recuerda entre sesiones.

---

## 11. Cómo se calcula el retraso

El Action llama a `calculateRoute` de TomTom con `traffic=true` para cada
ruta. La API devuelve `trafficDelayInSeconds` directamente, que es lo que se
publica como "+X min" y determina el color de esa ruta.

---

## 12. Qué no se ha implementado (a propósito)

De momento **no** hay usuarios, autenticación, notificaciones
(push/email/Telegram/WhatsApp), panel de administración ni estadísticas
avanzadas. El manifest y el Service Worker ya están preparados para añadir
notificaciones push más adelante sin rehacer la base de la app.

---

## 13. Notas de diseño

- Paleta suave (grises azulados + colores de semáforo desaturados), pensada
  para funcionar igual de bien en escritorio, tablet y TV de oficina.
- La franja de rayas discontinuas en la parte superior evoca la señalización
  vial, como único guiño decorativo al tema del panel.
- Tipografía `Oswald` (condensada, de aire "señal de carretera") para títulos
  y `Inter` para datos y texto, con números tabulares para que los tiempos no
  "bailen" al actualizarse.
- El histórico usa el mismo lenguaje de color que el semáforo de las rutas,
  para no introducir una escala visual nueva.
- El grid de tarjetas es responsive (`auto-fit`) y crece o encoge solo al
  añadir destinos nuevos en `config.js`.
