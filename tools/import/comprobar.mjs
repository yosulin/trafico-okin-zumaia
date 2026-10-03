/**
 * ============================================================
 *  COMPROBACIÓN — que todas las piezas cargan
 * ============================================================
 *  Existe por un fallo real: lib/firebase.mjs se quedó sin escribir y
 *  nadie se enteró, porque --dry-run no lo carga (solo lo importa la
 *  importación de verdad, y encima de forma perezosa). El error salió
 *  a la luz en la máquina de quien lo usaba, no en las pruebas.
 *
 *      npm run comprobar
 *
 *  No toca Firebase ni necesita credenciales: solo importa cada módulo
 *  y comprueba que exporta lo que el importador espera.
 * ============================================================
 */

const MODULOS = [
  ["./lib/zip.mjs", ["leerZip"]],
  ["./lib/normalizar.mjs", ["normalizarTarjeta", "validar", "idDesde"]],
  ["./lib/origen-json.mjs", ["leerJson"]],
  ["./lib/origen-csv.mjs", ["leerCsv"]],
  ["./lib/origen-anki.mjs", ["leerApkg"]],
  ["./lib/firebase.mjs", ["conectar", "subirMedia", "escribirTarjetas", "escribirTemas"]]
];

let problemas = 0;

for (const [ruta, esperadas] of MODULOS) {
  try {
    const modulo = await import(ruta);
    const faltan = esperadas.filter((nombre) => typeof modulo[nombre] !== "function");
    if (faltan.length > 0) {
      console.log(`✗ ${ruta} — no exporta: ${faltan.join(", ")}`);
      problemas++;
    } else {
      console.log(`✓ ${ruta}`);
    }
  } catch (error) {
    console.log(`✗ ${ruta} — ${error.message}`);
    problemas++;
  }
}

if (problemas > 0) {
  console.log(`\n${problemas} módulo(s) con problemas.\n`);
  process.exit(1);
}

console.log("\nTodo en su sitio.\n");
