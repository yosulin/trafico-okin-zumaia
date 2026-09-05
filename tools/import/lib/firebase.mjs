/**
 * ============================================================
 *  FIREBASE (lado administrador)
 * ============================================================
 *  Este módulo solo lo usa el importador, nunca la PWA. Entra con el
 *  Admin SDK y una cuenta de servicio, así que NO pasa por las reglas
 *  de firestore.rules ni storage.rules: por eso el navegador puede
 *  tener prohibido escribir tarjetas y aun así el contenido se puede
 *  subir desde aquí.
 *
 *  La clave de la cuenta de servicio se indica con la variable de
 *  entorno GOOGLE_APPLICATION_CREDENTIALS y vive FUERA del repositorio.
 * ============================================================
 */

import { readFileSync, existsSync } from "node:fs";
import { extname, basename } from "node:path";

const TIPOS = {
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav"
};

export function tipoDe(ruta) {
  return TIPOS[extname(ruta).toLowerCase()] || "application/octet-stream";
}

let app = null;
let almacen = null;
let cubo = null;

export async function conectar() {
  if (app) return { almacen, cubo };

  const credenciales = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credenciales || !existsSync(credenciales)) {
    throw new Error(
      "Falta la clave de la cuenta de servicio.\n" +
      "  Windows:  set GOOGLE_APPLICATION_CREDENTIALS=C:\\ruta\\a\\clave.json\n" +
      "  macOS/Linux:  export GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/clave.json\n" +
      "(Consola de Firebase → Configuración del proyecto → Cuentas de servicio)"
    );
  }

  let admin;
  try {
    admin = await import("firebase-admin/app");
  } catch (error) {
    throw new Error("Falta la dependencia firebase-admin.\n  cd tools/import && npm install");
  }

  const { getFirestore } = await import("firebase-admin/firestore");

  const clave = JSON.parse(readFileSync(credenciales, "utf8"));
  const bucket = process.env.FIREBASE_STORAGE_BUCKET || `${clave.project_id}.firebasestorage.app`;

  app = admin.initializeApp({
    credential: admin.cert(clave),
    projectId: clave.project_id,
    storageBucket: bucket
  });

  almacen = getFirestore(app);

  return { almacen, cubo };
}

/**
 * Storage se carga solo cuando de verdad hay que subir algo: sin plan
 * Blaze no existe el bucket, y el prototipo funciona sin él.
 */
async function bucket() {
  if (cubo) return cubo;
  await conectar();
  const { getStorage } = await import("firebase-admin/storage");
  cubo = getStorage(app).bucket();
  return cubo;
}

/** Sube un fichero local a Storage. Si ya está y no se fuerza, no hace nada. */
export async function subirMedia(rutaLocal, rutaStorage, opciones = {}) {
  const cubo = await bucket();
  const destino = cubo.file(rutaStorage);

  if (!opciones.forzar) {
    const [existe] = await destino.exists();
    if (existe) return { rutaStorage, subido: false };
  }

  await cubo.upload(rutaLocal, {
    destination: rutaStorage,
    metadata: {
      contentType: tipoDe(rutaLocal),
      cacheControl: "public, max-age=31536000, immutable"
    }
  });

  return { rutaStorage, subido: true, nombre: basename(rutaLocal) };
}

/** Escribe (merge) las tarjetas en la colección "cards", por lotes. */
export async function escribirTarjetas(tarjetas) {
  const { almacen } = await conectar();
  const { FieldValue } = await import("firebase-admin/firestore");

  const TAMANO_LOTE = 400;
  let escritas = 0;

  for (let i = 0; i < tarjetas.length; i += TAMANO_LOTE) {
    const lote = almacen.batch();
    tarjetas.slice(i, i + TAMANO_LOTE).forEach((tarjeta) => {
      const { id, ...datos } = tarjeta;
      lote.set(
        almacen.collection("cards").doc(id),
        Object.assign({}, datos, { updatedAt: FieldValue.serverTimestamp() }),
        { merge: true }
      );
    });
    await lote.commit();
    escritas += Math.min(TAMANO_LOTE, tarjetas.length - i);
  }

  return escritas;
}

/** Escribe las etiquetas de tema en la colección "themes". */
export async function escribirTemas(temas) {
  if (!temas || temas.length === 0) return 0;
  const { almacen } = await conectar();
  const lote = almacen.batch();
  temas.forEach((tema) => {
    const { id, ...datos } = tema;
    lote.set(almacen.collection("themes").doc(id), datos, { merge: true });
  });
  await lote.commit();
  return temas.length;
}
