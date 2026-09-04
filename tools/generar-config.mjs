/**
 * ============================================================
 *  Genera vocabulario/js/firebase-config.js a partir del .env
 * ============================================================
 *      cp .env.example .env      (y rellenarlo)
 *      node tools/generar-config.mjs
 *
 *  Sirve para no tener que copiar los valores a mano y, sobre todo,
 *  para poder generar el fichero en un despliegue automático a partir
 *  de variables de entorno.
 * ============================================================
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destino = resolve(raiz, "vocabulario/js/firebase-config.js");

/* Lector de .env mínimo: no hace falta una dependencia para esto. */
function leerEnv(ruta) {
  if (!existsSync(ruta)) return {};
  const valores = {};
  readFileSync(ruta, "utf8").split("\n").forEach((linea) => {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) return;
    const separador = limpia.indexOf("=");
    if (separador === -1) return;
    valores[limpia.slice(0, separador).trim()] = limpia.slice(separador + 1).trim();
  });
  return valores;
}

const env = Object.assign({}, leerEnv(resolve(raiz, ".env")), process.env);

const CLAVES = {
  apiKey: "FIREBASE_API_KEY",
  authDomain: "FIREBASE_AUTH_DOMAIN",
  projectId: "FIREBASE_PROJECT_ID",
  storageBucket: "FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "FIREBASE_MESSAGING_SENDER_ID",
  appId: "FIREBASE_APP_ID"
};

const config = {};
const faltan = [];

Object.entries(CLAVES).forEach(([campo, variable]) => {
  const valor = env[variable];
  if (!valor) faltan.push(variable);
  config[campo] = valor || "";
});

if (faltan.length > 0) {
  console.error("Faltan variables en .env: " + faltan.join(", "));
  process.exit(1);
}

const contenido = `/* Generado por tools/generar-config.mjs — no lo edites a mano. */
export const firebaseConfig = ${JSON.stringify(config, null, 2)};
`;

writeFileSync(destino, contenido, "utf8");
console.log("Escrito " + destino);
