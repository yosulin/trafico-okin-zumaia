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

## 1. Estructura del proyecto

```
traffic-dashboard-okin/
├── index.html                  → estructura de la página (sin datos ni lógica)
├── manifest.webmanifest        → metadatos de instalación como PWA
├── service-worker.js           → caché offline del "app shell"
├── css/
│   └── styles.css              → todo el diseño visual
├── icons/                      → iconos de la PWA (192/512/maskable/apple/favicon)
├── js/
│   ├── config.js                ← ÚNICO fichero que necesitas editar habitualmente
│   ├── estado.js                → traduce minutos de retraso a color/índice de semáforo
│   ├── api.js                   → llamadas a la API de TomTom (sin caché, sin DOM)
│   ├── cache.js                 → guarda el último dato válido por ruta y decide qué mostrar
│   ├── historial.js             → guarda muestras y calcula los bloques de la línea temporal
│   ├── scheduler.js             → calcula cada cuánto tocar según la hora (config.horarios)
│   └── app.js                   → orquesta todo lo anterior y pinta el DOM
└── README.md
```

Separación de responsabilidades:

| Fichero            | Qué contiene                                                        | Cuándo tocarlo |
|---------------------|-----------------------------------------------------------------------|----------------|
| `js/config.js`      | Origen, destinos, rutas, umbrales, horarios, caché, histórico          | Cada vez que cambie el contenido |
| `js/estado.js`      | Conversión retraso → tramo de color                                    | Casi nunca |
| `js/api.js`         | Cómo se llama a la API de tráfico                                      | Solo si cambias de proveedor |
| `js/cache.js`       | Qué hacer cuando una consulta falla                                    | Solo si cambias la política de caché |
| `js/historial.js`   | Cómo se guardan y agrupan las muestras de la línea temporal            | Solo si cambias el histórico |
| `js/scheduler.js`   | Cada cuánto se actualiza según la hora                                 | Solo si cambias la lógica de planificación |
| `js/app.js`         | Construcción del grid, pintado, modal de clave API, modo TV            | Solo si cambias el comportamiento de la interfaz |
| `css/styles.css`    | Todo el aspecto visual                                                 | Solo si quieres cambiar el diseño |
| `service-worker.js` | Qué ficheros quedan disponibles offline                                | Solo si añades/quitas ficheros del proyecto |

---

## 2. Configurar la API de TomTom

**No hay ninguna clave API en el código ni en el repositorio.** La clave se
introduce **una vez, desde la propia web**, y se guarda solo en el navegador de
quien la usa (`localStorage`), nunca en el repositorio.

1. Crea una cuenta gratuita en [developer.tomtom.com](https://developer.tomtom.com/) y genera una clave para la **Routing API**.
2. **Restringe la clave por dominio/referrer** desde el panel de TomTom (ej. `https://yosulin.github.io/*`).
3. Abre la web y pulsa el icono ⚙️ de la cabecera.
4. Pega la clave y guarda.

---

## 3. Publicar en GitHub Pages

1. Sube el contenido de esta carpeta a la raíz de un repositorio de GitHub.
2. **Settings → Pages** → Source: rama `main`, carpeta `/ (root)`.
3. GitHub te da la URL (`https://tuusuario.github.io/tu-repo/`).
4. Abre esa URL y configura la clave API (punto 2).

Sin build step: es HTML/CSS/JS puro, incluido el Service Worker.

---

## 4. Instalar como aplicación (PWA)

Al abrir la web desde Chrome, Edge o Android, aparece un botón **📲 Instalar app**
en la cabecera en cuanto el navegador confirma que la app cumple los requisitos
de instalación (no hace falta buscar el icono discreto de la barra de
direcciones). Se implementa capturando el evento `beforeinstallprompt` y
mostrando nuestro propio botón — así la opción de instalar es visible y
explícita, en vez de depender del aviso silencioso de cada navegador.

**En iOS (Safari) no existe ese evento** — es una limitación de la propia
plataforma, no de la app — así que en su lugar se muestra un aviso con las
instrucciones manuales (Compartir → «Añadir a pantalla de inicio»), que el
usuario puede cerrar y no vuelve a aparecer.

Una vez instalada:

- Se abre en su propia ventana, sin barra de navegador.
- Si no hay conexión, sigue mostrando el **último estado conocido** (guardado
  automáticamente en el propio navegador), en vez de una pantalla en blanco.
- El icono usa el color y el estilo del dashboard (semáforo sobre fondo azul acero).

El Service Worker (`service-worker.js`) solo cachea los ficheros propios de la
aplicación (HTML/CSS/JS/iconos) — **nunca** las respuestas de la API de TomTom,
que siempre se piden frescas cuando hay red. El dato offline que se muestra viene
de la caché inteligente de `cache.js` (ver punto 6), no de la caché del Service
Worker.

> Las notificaciones push no están implementadas todavía, pero el manifest y el
> Service Worker ya están preparados para añadirlas más adelante sin tener que
> rehacer la base de la PWA.

Si cambias los ficheros del proyecto y quieres forzar que los usuarios con la
app ya instalada descarguen la versión nueva, sube de versión la constante
`CACHE_NAME` en `service-worker.js`.

---

## 5. Añadir o modificar destinos y rutas

Todo se hace en **`js/config.js`**, dentro del array `destinos`.

### Añadir un destino nuevo

```js
{
  id: "azpeitia",              // identificador corto, sin espacios ni tildes
  nombre: "Azpeitia",          // lo que se ve en pantalla
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
`index.html`, `app.js` ni el CSS.

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
  via: [{ lat: 43.2831, lon: -2.1306 }]  // punto conocido de esa carretera
}
```

Para obtener coordenadas: en Google Maps, clic derecho sobre el punto exacto →
aparecen listas para copiar.

### Cambiar los umbrales de color del semáforo

Array `umbrales` en `config.js`: cada tramo tiene un límite en minutos (`hasta`)
y un color/emoji. Cambia los números o añade/quita tramos.

---

## 6. Caché inteligente (evita parpadeos y "Sin datos" innecesarios)

Cuando una consulta a la API falla puntualmente, la aplicación **no borra el
último dato bueno**. El comportamiento es:

1. Cada ruta guarda su último resultado válido (tiempo, retraso, hora).
2. Si la siguiente consulta falla, se sigue mostrando ese último dato.
3. Mientras tenga menos de `CONFIG.cache.maxAntiguedadMin` minutos (10 por
   defecto), se muestra con una marca discreta junto al nombre de la ruta
   (ej. `· hace 4 min`) para dejar claro que no es un dato recién llegado.
4. Solo cuando el último dato válido supera esa antigüedad, la ruta pasa a
   mostrarse como **"Sin datos"**.

Esto es también lo que permite el funcionamiento offline básico de la PWA: al
abrir la app sin conexión, se pinta directamente el último estado guardado.

Configurable en `CONFIG.cache.maxAntiguedadMin`.

---

## 7. Actualización atómica

Cada ciclo de actualización sigue este orden estricto:

1. Se lanzan **todas** las consultas de todas las rutas en paralelo.
2. Se espera a que **todas** hayan terminado (con éxito o fallo).
3. Se resuelve, para cada ruta, el dato a mostrar (fresco, en caché, o sin datos).
4. Se registra la muestra de este ciclo en el histórico.
5. **Solo entonces** se actualiza la pantalla entera, de una sola vez.

Así la pantalla nunca queda a medio pintar ni mezcla datos de instantes
distintos entre tarjetas.

---

## 8. Histórico visual (línea temporal tipo Uptime Kuma)

Debajo de las rutas de cada destino aparece una tira de bloques de color, uno
por intervalo de tiempo, con el **peor estado alcanzado por ese destino** en
cada intervalo. Permite detectar de un vistazo una tendencia (un atasco puntual,
una retención que se alarga, una mejora progresiva) sin tener que interpretar
una gráfica.

Por defecto: 16 bloques × 30 minutos = últimas 8 horas. Ambos valores son
configurables en `CONFIG.historial`:

```js
historial: {
  bloques: 16,
  minutosPorBloque: 30,
  // ...
}
```

Las muestras se guardan en el navegador (`localStorage`) y se purgan
automáticamente pasada la ventana visible, así que no crecen sin límite.

---

## 9. Planificador de actualizaciones (horarios configurables)

Para no gastar peticiones fuera de las horas en que de verdad importa, la
frecuencia de actualización cambia según la franja horaria, definida en
`CONFIG.horarios`:

```js
horarios: [
  { inicio: "00:00", fin: "05:00", intervaloMin: 60 },
  { inicio: "05:00", fin: "14:00", intervaloMin: 30 },
  { inicio: "14:00", fin: "18:00", intervaloMin: 3 },
  { inicio: "18:00", fin: "00:00", intervaloMin: 60 }
]
```

Añade, quita o cambia tramos libremente; solo asegúrate de que cubran las 24
horas sin huecos. Un tramo que termina en `"00:00"` se entiende como "hasta
medianoche". Si por lo que sea la hora actual no encaja en ningún tramo, se usa
`CONFIG.intervaloPorDefectoMin` como red de seguridad.

---

## 10. Modo TV

El diseño es responsive de forma automática: a partir de anchos típicos de
1080p y 4K, las tarjetas, los textos y los bloques del histórico crecen
progresivamente para poder leerse a distancia en una pantalla compartida de
oficina.

Si el navegador no ocupa toda la resolución real de la pantalla (por ejemplo,
una ventana más pequeña sobre un televisor grande), el botón **📺** de la
cabecera fuerza ese mismo aspecto "TV" independientemente del ancho de la
ventana. La preferencia se recuerda entre sesiones.

La actualización automática (punto 9) sigue funcionando igual en modo TV: no
hace falta tocar nada más para dejar el panel en una pantalla compartida.

---

## 11. Cómo se calcula el retraso

Para cada ruta se llama a `calculateRoute` de TomTom con `traffic=true`. La API
devuelve `trafficDelayInSeconds` directamente, que es lo que se muestra como
"+X min" y determina el color de esa ruta. El estado general de un destino
sigue siendo siempre el peor estado entre todas sus rutas.

---

## 12. Qué no se ha implementado (a propósito)

Tal y como se pidió, de momento **no** hay usuarios, autenticación,
notificaciones (push/email/Telegram/WhatsApp), panel de administración ni
estadísticas avanzadas. El manifest y el Service Worker ya están preparados
para añadir notificaciones push más adelante sin rehacer la base de la app.

---

## 13. Notas de diseño

- Paleta suave (grises azulados + colores de semáforo desaturados), pensada
  para funcionar igual de bien en escritorio, tablet y TV de oficina.
- La franja de rayas discontinuas en la parte superior evoca la señalización
  vial, como único guiño decorativo al tema del panel.
- Tipografía `Oswald` (condensada, de aire "señal de carretera") para títulos y
  `Inter` para datos y texto, con números tabulares para que los tiempos no
  "bailen" al actualizarse.
- El histórico usa el mismo lenguaje de color que el semáforo de las rutas,
  para no introducir una escala visual nueva.
- El grid de tarjetas es responsive (`auto-fit`) y crece o encoge solo al
  añadir destinos nuevos en `config.js`.
