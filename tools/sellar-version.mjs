/**
 * ============================================================
 *  Sella la versión antes de publicar
 * ============================================================
 *      node tools/sellar-version.mjs
 *
 *  Escribe la misma información en tres sitios, para que no puedan
 *  contradecirse:
 *
 *    vocabulario/js/version.js    la versión que va DENTRO de la app
 *                                 (la cachea el service worker, así que
 *                                 es la que de verdad estás usando)
 *    vocabulario/version.json     la versión PUBLICADA, que la app pide
 *                                 siempre a la red para compararse
 *    service-worker.js            el nombre de las cachés, que así cambia
 *                                 en cada despliegue y no se queda nadie
 *                                 con ficheros viejos
 *
 *  Lo ejecuta solo "firebase deploy" (ver firebase.json), para que no se
 *  pueda olvidar. El número de versión sale del fichero VERSION, que se
 *  sube a mano cuando toca.
 * ============================================================
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const version = readFileSync(resolve(raiz, "VERSION"), "utf8").trim();

function commit() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: raiz, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch (error) {
    return "sin-git";
  }
}

const sello = {
  version,
  commit: commit(),
  fecha: new Date().toISOString()
};

/* El sello completo identifica un despliegue concreto. */
const identificador = version + "+" + sello.commit;

writeFileSync(
  resolve(raiz, "vocabulario/version.json"),
  JSON.stringify(sello, null, 2) + "\n",
  "utf8"
);

writeFileSync(
  resolve(raiz, "vocabulario/js/version.js"),
  `/* Generado por tools/sellar-version.mjs al desplegar — no lo edites a mano. */
export const VERSION = ${JSON.stringify(sello, null, 2)};
`,
  "utf8"
);

/* El service worker YA NO se toca aquí. Su versión le llega en la URL
   con la que la app lo registra (service-worker.js?v=...), así que las
   cachés siguen estrenándose en cada publicación sin que el sello tenga
   que reescribir un fichero versionado. Eso es lo que hacía chocar el
   git pull después de cada despliegue. */

console.log("Sellado " + identificador + "  (" + sello.fecha + ")");
