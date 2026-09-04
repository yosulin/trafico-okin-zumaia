/**
 * ============================================================
 *  ZIP — lectura de ficheros .apkg (que son zips) sin dependencias
 * ============================================================
 *  Un .apkg es un zip con:
 *
 *      collection.anki2   (o .anki21 / .anki21b)  base SQLite
 *      media              JSON: { "0": "perro.mp3", "1": "gato.jpg" }
 *      0, 1, 2, ...       los ficheros de medios, numerados
 *
 *  Aquí solo se lee el zip. Node ya trae inflate, así que no hace
 *  falta ninguna librería.
 * ============================================================
 */

import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const FIRMA_DIRECTORIO = 0x02014b50;
const FIRMA_FIN = 0x06054b50;

function buscarFinDeDirectorio(buffer) {
  const minimo = Math.max(0, buffer.length - 66000);
  for (let i = buffer.length - 22; i >= minimo; i--) {
    if (buffer.readUInt32LE(i) === FIRMA_FIN) return i;
  }
  throw new Error("No parece un zip válido (falta el fin del directorio central)");
}

/**
 * Lee un zip entero en memoria.
 * @returns {Map<string, Buffer>} nombre de fichero → contenido
 */
export function leerZip(ruta) {
  const buffer = readFileSync(ruta);
  const fin = buscarFinDeDirectorio(buffer);
  const totalEntradas = buffer.readUInt16LE(fin + 10);
  let puntero = buffer.readUInt32LE(fin + 16);

  const ficheros = new Map();

  for (let i = 0; i < totalEntradas; i++) {
    if (buffer.readUInt32LE(puntero) !== FIRMA_DIRECTORIO) {
      throw new Error("Directorio central corrupto en la entrada " + i);
    }

    const metodo = buffer.readUInt16LE(puntero + 10);
    const tamanoComprimido = buffer.readUInt32LE(puntero + 20);
    const largoNombre = buffer.readUInt16LE(puntero + 28);
    const largoExtra = buffer.readUInt16LE(puntero + 30);
    const largoComentario = buffer.readUInt16LE(puntero + 32);
    const desplazamiento = buffer.readUInt32LE(puntero + 42);
    const nombre = buffer.toString("utf8", puntero + 46, puntero + 46 + largoNombre);

    /* Cabecera local: los tamaños de nombre y extra pueden diferir del central. */
    const largoNombreLocal = buffer.readUInt16LE(desplazamiento + 26);
    const largoExtraLocal = buffer.readUInt16LE(desplazamiento + 28);
    const inicioDatos = desplazamiento + 30 + largoNombreLocal + largoExtraLocal;
    const datos = buffer.subarray(inicioDatos, inicioDatos + tamanoComprimido);

    if (!nombre.endsWith("/")) {
      if (metodo === 0) {
        ficheros.set(nombre, Buffer.from(datos));
      } else if (metodo === 8) {
        ficheros.set(nombre, inflateRawSync(datos));
      } else {
        /* Método 93 = zstd: los .apkg nuevos de Anki lo usan. */
        ficheros.set(nombre, null);
      }
    }

    puntero += 46 + largoNombre + largoExtra + largoComentario;
  }

  return ficheros;
}
