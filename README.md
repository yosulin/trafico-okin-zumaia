# Tráfico desde OKIN Zumaia

Panel visual (dashboard) para consultar de un vistazo el estado del tráfico desde
**OKIN Zumaia** hacia los destinos habituales (Zarautz, Donostia, Eibar, Irún), con
varias rutas posibles por destino y un semáforo de colores por retraso.

No sustituye a Google Maps / Waze: es un indicador rápido para decidir si merece la
pena abrir el navegador del coche antes de salir.

Sitio 100% estático — HTML, CSS y JavaScript sin frameworks ni build step. Pensado
para publicarse con **GitHub Pages**.

---

## 1. Estructura del proyecto

```
traffic-dashboard-okin/
├── index.html            → estructura de la página (sin datos ni lógica)
├── css/
│   └── styles.css        → todo el diseño visual
├── js/
│   ├── config.js          ← ÚNICO fichero que necesitas editar habitualmente
│   ├── api.js             → acceso a la API de TomTom (aislado del resto)
│   └── app.js             → lógica de pantalla: pinta lo que config.js + api.js le dan
└── README.md
```

Separación de responsabilidades:

| Fichero        | Qué contiene                                             | Cuándo tocarlo |
|-----------------|-----------------------------------------------------------|----------------|
| `js/config.js`  | Origen, destinos, rutas, umbrales de color, frecuencia    | Cada vez que cambie el contenido |
| `js/api.js`     | Cómo se llama a la API de tráfico (TomTom)                 | Solo si cambias de proveedor de tráfico |
| `js/app.js`     | Cómo se pinta el grid, el modal de la clave API, el ciclo de refresco | Solo si cambias el comportamiento de la interfaz |
| `css/styles.css`| Todo el aspecto visual                                     | Solo si quieres cambiar el diseño |

---

## 2. Configurar la API de TomTom

**No hay ninguna clave API en el código ni en el repositorio.** Como este sitio es
estático y público (GitHub Pages), cualquier clave escrita en el código quedaría
visible para cualquiera. En su lugar, la clave se introduce **una vez, desde la
propia web**, y se guarda solo en el navegador de quien la usa (`localStorage`),
nunca en el repositorio.

Pasos:

1. Crea una cuenta gratuita en [developer.tomtom.com](https://developer.tomtom.com/) y genera una clave para la **Routing API**.
2. **Importante — restringe la clave por dominio/referrer** desde el panel de TomTom, limitándola a la URL donde publiques el sitio (ej. `https://yosulin.github.io/*`). Así, aunque la clave viaje en las peticiones del navegador, no se puede reutilizar desde otro sitio.
3. Abre la web ya publicada (o `index.html` en local) y pulsa el icono ⚙️ de la cabecera.
4. Pega la clave y guarda. A partir de ahí el panel empieza a consultar tráfico automáticamente.

Si quieres cambiar de clave más adelante, vuelve a pulsar ⚙️.

---

## 3. Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub (por ejemplo `trafico-okin-zumaia`) y sube el contenido de esta carpeta a la raíz del repositorio.
2. En GitHub: **Settings → Pages**.
3. En **Source**, selecciona la rama (normalmente `main`) y la carpeta `/ (root)`.
4. Guarda. GitHub te dará una URL del tipo `https://tuusuario.github.io/trafico-okin-zumaia/`.
5. Abre esa URL y configura la clave API como se explica en el punto 2.

No hace falta ningún paso de build ni instalar dependencias: es HTML/CSS/JS puro.

---

## 4. Añadir o modificar destinos y rutas

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
como una tarjeta nueva en el panel — no hace falta tocar `index.html`, `app.js`
ni el CSS.

### Añadir una ruta nueva a un destino existente

Dentro del destino, añade un objeto más en su array `rutas`:

```js
{
  id: "gi2634",
  nombre: "GI-2634 por la costa",
  destino: { lat: 43.2833, lon: -2.1700 }
}
```

### Forzar que una ruta pase por una carretera concreta

Cuando dos rutas van al mismo destino pero por carreteras distintas (por ejemplo
AP-8 vs. una carretera nacional), añade uno o varios puntos intermedios en `via`
para que TomTom calcule el trayecto pasando por ahí:

```js
{
  id: "n634",
  nombre: "N-634",
  destino: { lat: 43.3183, lon: -1.9812 },
  via: [{ lat: 43.2831, lon: -2.1306 }]  // ej. un punto conocido de esa carretera
}
```

Para obtener coordenadas: en Google Maps, clic derecho sobre el punto exacto →
las coordenadas aparecen arriba del menú, listas para copiar.

### Cambiar los umbrales de color del semáforo

En el array `umbrales` de `config.js`, cada tramo tiene un límite en minutos
(`hasta`) y un color/emoji asociado. Cambia los números o añade/quita tramos
según necesites.

### Cambiar la frecuencia de actualización

Cambia `refreshIntervalMs` en `config.js` (en milisegundos; 180000 = 3 minutos).

---

## 5. Cómo se calcula el retraso

Para cada ruta se llama a la API `calculateRoute` de TomTom con `traffic=true`.
La API devuelve directamente `trafficDelayInSeconds` (diferencia entre el tiempo
con tráfico actual y el tiempo en condiciones normales), que es lo que se muestra
como "+X min" y lo que determina el color del semáforo de esa ruta.

El estado general de un destino (el punto de color junto a su nombre) es siempre
el peor estado entre todas sus rutas, tal y como se pidió.

Si una ruta concreta falla (red, clave inválida, respuesta inesperada de la API),
solo esa fila se muestra como **"Sin datos"** — el resto del panel sigue
funcionando con normalidad.

---

## 6. Notas de diseño

- Paleta suave (grises azulados + colores de semáforo desaturados) para que
  funcione bien tanto en pantalla de escritorio como en una TV de oficina.
- La franja de rayas discontinuas en la parte superior evoca la señalización
  vial, como único guiño decorativo al tema del panel.
- Tipografía `Oswald` (condensada, de aire "señal de carretera") para títulos y
  `Inter` para datos y texto, con números tabulares para que los tiempos no
  "bailen" al actualizarse.
- El grid de tarjetas es responsive (`auto-fit`) y crece o encoge solo al añadir
  destinos nuevos en `config.js`.
