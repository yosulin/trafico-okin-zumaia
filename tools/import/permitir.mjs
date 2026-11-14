/**
 * ============================================================
 *  QUIÉN PUEDE ENTRAR
 * ============================================================
 *  La app es privada. Las reglas de Firestore solo dejan leer las
 *  tarjetas a quien tenga su correo en la colección "allowed", y esa
 *  colección no se puede tocar desde el navegador: solo desde aquí,
 *  con la cuenta de servicio.
 *
 *      npm run permitidos                      ver la lista
 *      npm run permitir -- ane@gmail.com       dar acceso
 *      npm run denegar  -- ane@gmail.com       quitarlo
 *
 *  Cualquiera puede pulsar "Entrar con Google" —eso no se puede
 *  impedir sin plan de pago—, pero quien no esté en la lista no verá
 *  ni una tarjeta: la app le enseña un aviso y poco más.
 * ============================================================
 */

import { conectar } from "./lib/firebase.mjs";

const COLECCION = "allowed";

function normalizar(correo) {
  return String(correo || "").trim().toLowerCase();
}

function esCorreo(texto) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(texto);
}

async function listar(almacen) {
  const respuesta = await almacen.collection(COLECCION).get();
  if (respuesta.empty) {
    console.log("\nNo hay nadie en la lista: ahora mismo no entra nadie.\n");
    return;
  }
  console.log("\nPueden entrar (" + respuesta.size + "):\n");
  respuesta.docs
    .map((documento) => documento.id)
    .sort()
    .forEach((correo) => console.log("  " + correo));
  console.log("");
}

async function permitir(almacen, correos) {
  for (const correo of correos) {
    await almacen.collection(COLECCION).doc(correo).set({
      email: correo,
      addedAt: new Date().toISOString()
    }, { merge: true });
    console.log("  + " + correo);
  }
  console.log("\nListo. El cambio es inmediato, no hace falta desplegar nada.\n");
}

async function denegar(almacen, correos) {
  for (const correo of correos) {
    await almacen.collection(COLECCION).doc(correo).delete();
    console.log("  - " + correo);
  }
  console.log("\nListo. Su progreso sigue guardado por si vuelve a entrar algún día.\n");
}

async function principal() {
  const [accion, ...resto] = process.argv.slice(2);
  const correos = resto.map(normalizar).filter(Boolean);

  if (!accion || !["listar", "permitir", "denegar"].includes(accion)) {
    console.log(`
Uso:
  node permitir.mjs listar
  node permitir.mjs permitir <correo> [correo...]
  node permitir.mjs denegar  <correo> [correo...]
`);
    process.exit(accion ? 1 : 0);
  }

  if (accion !== "listar" && correos.length === 0) {
    throw new Error("Dime al menos un correo:  npm run permitir -- alguien@gmail.com");
  }

  const malos = correos.filter((correo) => !esCorreo(correo));
  if (malos.length > 0) {
    throw new Error("Esto no parece un correo: " + malos.join(", "));
  }

  const { almacen } = await conectar();

  if (accion === "listar") return listar(almacen);
  if (accion === "permitir") return permitir(almacen, correos);
  return denegar(almacen, correos);
}

principal().catch((error) => {
  console.error("\n" + error.message + "\n");
  process.exit(1);
});
