#!/usr/bin/env node
/**
 * ============================================================
 *  ACTUALIZAR HISTORIAL — script para GitHub Actions
 * ============================================================
 *  Se ejecuta periódicamente (ver .github/workflows/actualizar-historial.yml),
 *  independientemente de si alguien tiene la web abierta en un navegador.
 *  Así el histórico de las últimas horas queda completo aunque nadie haya
 *  estado mirando el panel durante ese tiempo.
 *
 *  Reutiliza js/config.js, js/estado.js y js/api.js tal cual — el mismo
 *  código que usa el navegador — para no duplicar la lógica de rutas,
 *  umbrales ni llamadas a la API. Node ya trae "fetch" incorporado desde
 *  la versión 18, así que esos ficheros funcionan sin cambios.
 * ============================================================
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RUTA_DATOS = path.join(ROOT, "data", "historial.json");

// Guardamos algo más que las 8h que se enseñan en pantalla, por margen
// (por si en algún momento se amplía la ventana visible sin más cambios).
const VENTANA_RETENCION_MS = 24 * 60 * 60 * 1000;

function cargarConfiguracionNavegador() {
  // js/config.js, js/estado.js y js/api.js declaran "const CONFIG", "const Estado"
  // y "const TrafficAPI" a nivel superior. Esas bindings solo son visibles para
  // código posterior ejecutado en el MISMO contexto de vm (igual que varios
  // <script> de una página comparten el ámbito superior) — no se convierten en
  // propiedades del objeto global automáticamente. Por eso, al final añadimos
  // un pequeño puente con "var" (que sí crea propiedades reales) para poder
  // leerlas desde fuera del contexto.
  const sandbox = { console, fetch, URLSearchParams, setTimeout, clearTimeout, Math };
  createContext(sandbox);

  const ficheros = ["js/config.js", "js/estado.js", "js/api.js"];
  ficheros.forEach((fichero) => {
    const codigo = readFileSync(path.join(ROOT, fichero), "utf8");
    runInContext(codigo, sandbox, { filename: fichero });
  });

  runInContext(
    "var __PUENTE__ = { CONFIG: CONFIG, Estado: Estado, TrafficAPI: TrafficAPI };",
    sandbox
  );

  return sandbox.__PUENTE__;
}

function leerHistorialExistente() {
  if (!existsSync(RUTA_DATOS)) {
    return { actualizado: null, muestras: {} };
  }
  try {
    const datos = JSON.parse(readFileSync(RUTA_DATOS, "utf8"));
    if (!datos.muestras) datos.muestras = {};
    return datos;
  } catch (err) {
    console.warn("No se pudo leer el historial existente, se empieza de cero:", err.message);
    return { actualizado: null, muestras: {} };
  }
}

async function main() {
  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) {
    console.error("Falta la variable de entorno TOMTOM_API_KEY (configúrala como secret del repositorio).");
    process.exit(1);
  }

  const { CONFIG, Estado, TrafficAPI } = cargarConfiguracionNavegador();

  console.log(`Consultando ${CONFIG.destinos.reduce((n, d) => n + d.rutas.length, 0)} rutas en TomTom…`);
  const resultados = await TrafficAPI.fetchTodasLasRutas(apiKey);

  const datos = leerHistorialExistente();
  const ahora = Date.now();
  const fallos = {};

  CONFIG.destinos.forEach((destino) => {
    let peorIndex = null;

    destino.rutas.forEach((ruta) => {
      const clave = `${destino.id}.${ruta.id}`;
      const resultado = resultados[clave];
      if (resultado && resultado.ok) {
        const { index } = Estado.porRetraso(resultado.delayMin);
        if (peorIndex === null || index > peorIndex) peorIndex = index;
      } else {
        if (!fallos[destino.id]) fallos[destino.id] = [];
        fallos[destino.id].push({ ruta: ruta.id, motivo: resultado ? resultado.motivo : "sin respuesta" });
      }
    });

    // Si ninguna ruta de este destino ha respondido esta vez, no añadimos
    // muestra: se deja el hueco (se pintará como "sin datos" ese instante)
    // en vez de inventar un estado.
    if (peorIndex === null) {
      console.warn(`Sin datos válidos para "${destino.id}" en este ciclo.`);
      return;
    }

    if (!datos.muestras[destino.id]) datos.muestras[destino.id] = [];
    datos.muestras[destino.id].push({ t: ahora, i: peorIndex });
    datos.muestras[destino.id] = datos.muestras[destino.id].filter(
      (muestra) => ahora - muestra.t <= VENTANA_RETENCION_MS
    );
  });

  datos.actualizado = new Date(ahora).toISOString();
  // Diagnóstico del último ciclo únicamente (no se acumula histórico de errores,
  // solo sirve para poder ver "qué falló la última vez" sin bucear en logs).
  datos.ultimosFallos = Object.keys(fallos).length > 0 ? fallos : null;

  writeFileSync(RUTA_DATOS, JSON.stringify(datos, null, 2) + "\n");
  console.log("Historial actualizado:", datos.actualizado);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
