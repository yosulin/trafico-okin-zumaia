/**
 * ============================================================
 *  Escribe firebase-config.js preguntándoselo a Firebase
 * ============================================================
 *      node tools/config-desde-firebase.mjs
 *
 *  Usa la CLI (que ya está autenticada) para pedirle al proyecto su
 *  propia configuración web, y con ella escribe
 *  vocabulario/js/firebase-config.js.
 *
 *  Existe para no copiar claves a mano: basta un carácter mal pegado
 *  —o un editor que guarde algo raro— para que Firebase responda
 *  "API key not valid" sin decir por qué. Así el valor viene del
 *  proyecto, no de un copiar y pegar.
 *
 *  Requisitos: firebase-tools instalado y "firebase login" hecho.
 *
 *  Si el proyecto tuviera varias apps web:
 *      node tools/config-desde-firebase.mjs 1:268...:web:92d2...
 * ============================================================
 */

import { execFileSync } from "node:child_process";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destino = resolve(raiz, "vocabulario/js/firebase-config.js");

const appId = process.argv[2];

/* En Windows el ejecutable es firebase.cmd y hace falta shell. */
function preguntarAFirebase() {
  const argumentos = ["apps:sdkconfig", "WEB"];
  if (appId) argumentos.push(appId);
  argumentos.push("--json");

  try {
    return execFileSync("firebase", argumentos, {
      cwd: raiz,
      encoding: "utf8",
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    const salida = (error.stdout || "") + (error.stderr || "");
    if (/Multiple apps/i.test(salida)) {
      throw new Error(
        "El proyecto tiene más de una app web. Lista las apps con:\n" +
        "  firebase apps:list\n" +
        "y vuelve a lanzar esto con el App ID:\n" +
        "  node tools/config-desde-firebase.mjs <APP_ID>"
      );
    }
    if (/not found|no such file|ENOENT/i.test(salida + error.message)) {
      throw new Error("No encuentro la CLI de Firebase.\n  npm install -g firebase-tools");
    }
    throw new Error("La CLI de Firebase ha fallado:\n" + (salida || error.message));
  }
}

/** La CLI ha cambiado de forma entre versiones; aceptamos las conocidas. */
function extraerConfig(salida) {
  const json = JSON.parse(salida.slice(salida.indexOf("{")));
  const resultado = json.result || json;
  const config = resultado.sdkConfig || resultado.fileContents || resultado;

  if (typeof config === "string") {
    /* Algunas versiones devuelven el fragmento de JavaScript entero. */
    const objeto = config.slice(config.indexOf("{"), config.lastIndexOf("}") + 1);
    return JSON.parse(objeto.replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));
  }
  return config;
}

const CAMPOS = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"];

let bruto;
try {
  bruto = extraerConfig(preguntarAFirebase());
} catch (error) {
  console.error("\n" + error.message + "\n");
  process.exit(1);
}

const config = {};
const faltan = [];
CAMPOS.forEach((campo) => {
  if (!bruto[campo]) faltan.push(campo);
  config[campo] = bruto[campo] || "";
});

if (faltan.length > 0) {
  console.error("Firebase no ha devuelto: " + faltan.join(", "));
  process.exit(1);
}

/* Se respeta el modo de medios que ya hubiera en el fichero. */
let medios = "hosting";
if (existsSync(destino)) {
  const anterior = readFileSync(destino, "utf8");
  if (/"?medios"?\s*:\s*"storage"/.test(anterior)) medios = "storage";
}

writeFileSync(destino, `/* Generado por tools/config-desde-firebase.mjs — no lo edites a mano. */
export const firebaseConfig = ${JSON.stringify(config, null, 2)};

/* De dónde salen imágenes y audios: "hosting" (./media/) o "storage". */
export const opciones = ${JSON.stringify({ medios }, null, 2)};
`, "utf8");

/* Se enseña la clave a medias: suficiente para comparar, sin volcarla entera. */
const clave = config.apiKey;
console.log("\nEscrito " + destino);
console.log("  proyecto: " + config.projectId);
console.log("  apiKey:   " + clave.slice(0, 10) + "…" + clave.slice(-4) + "  (" + clave.length + " caracteres)");
console.log("\nAhora:  firebase deploy --only hosting\n");
