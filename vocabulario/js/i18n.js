/**
 * ============================================================
 *  I18N — el idioma de la interfaz
 * ============================================================
 *  Tres idiomas: castellano, euskera e inglés. Se elige en Ajustes y
 *  vale para TODO lo que dice la app.
 *
 *  Lo que NO se traduce es el contenido que se está aprendiendo: la
 *  palabra en inglés de una tarjeta sigue siendo la palabra en inglés,
 *  y sus traducciones al castellano y al euskera son datos, no
 *  interfaz. Traducir eso sería vaciar de sentido el ejercicio.
 *
 *  Cómo se usa:
 *
 *    En el HTML          <b data-i18n="hub.pregunta"></b>
 *                        <input data-i18n-attr="placeholder:dicc.pista">
 *    En el JavaScript    t("mates.tablaDel", { n: 7 })
 *
 *  {n} y compañía se sustituyen al vuelo. Si una clave no existe en el
 *  idioma elegido, se cae al castellano antes que enseñar la clave.
 *
 *  El idioma se guarda en este dispositivo (localStorage). Es una
 *  preferencia de cómo se ve la app, no parte del progreso: si algún
 *  día queremos que la siga entre móvil y tablet, se mueve a Firestore.
 * ============================================================
 */

const CLAVE = "ayuda-sofia-idioma";

export const IDIOMAS = [
  { codigo: "es", nombre: "Castellano", bandera: "🇪🇸" },
  { codigo: "eu", nombre: "Euskara", bandera: "🏴" },
  { codigo: "en", nombre: "English", bandera: "🇬🇧" }
];

export const TEXTOS = {
  es: {
    "app.titulo": "Ayuda de Sofía",
    "app.lema": "Tus herramientas",
    "comun.cargando": "Cargando…",
    "comun.volver": "Volver",
    "comun.ajustes": "Ajustes",
    "nav.inicio": "Inicio",
    "nav.principal": "Navegación principal",
    "nav.menu": "Abrir el menú",
    "nav.cerrarMenu": "Cerrar el menú",
    "comun.sinConexion": "Sin conexión: sigues jugando y tu progreso se guardará al volver la red.",

    "login.lema": "Añade color a tu vida.",
    "login.lema2": "Aprende algo nuevo.",
    "login.texto": "Entra con tu cuenta de Google para que la app recuerde lo que ya sabes.",
    "login.boton": "Entrar con Google",
    "login.error": "No se ha podido entrar: {motivo}",

    "sinAcceso.titulo": "Esta app es privada",
    "sinAcceso.texto": "Has entrado con {correo}, pero esa cuenta no tiene acceso.",
    "sinAcceso.boton": "Probar con otra cuenta",

    "hub.saludo": "Hola, {nombre}",
    "hub.saludoSinNombre": "Hola",
    "hub.pregunta": "¿Qué quieres hacer hoy?",

    "modulo.tarjetas.nombre": "Tarjetas",
    "modulo.tarjetas.que": "Escucha, mira el dibujo y escribe la palabra en inglés",
    "modulo.tarjetas.estado": "{n} palabras",
    "modulo.tarjetas.estadoUna": "1 palabra",
    "modulo.diccionario.nombre": "Diccionario",
    "modulo.diccionario.que": "Una palabra en un idioma y te doy los otros dos",
    "modulo.diccionario.estado": "3 idiomas",
    "modulo.matemagia.nombre": "Matemagia",
    "modulo.matemagia.que": "Tablas, sumas y restas con el método ABN",
    "modulo.matemagia.estado": "3 retos",
    "modulo.libre.nombre": "Lo que venga",
    "modulo.libre.que": "Aquí irá la siguiente herramienta que hagamos",
    "modulo.libre.estado": "Libre",

    "tarjetas.intro": "Escucha la palabra, mira el dibujo y escríbela en inglés.",
    "tarjetas.empezar": "Empezar",
    "tarjetas.sinVoz": "Este navegador no puede leer las palabras en voz alta.",
    "tarjetas.escucharOtra": "Escuchar otra vez",
    "tarjetas.escribe": "Escríbelo en inglés",
    "tarjetas.comprobar": "Comprobar",
    "tarjetas.noLoSe": "No lo sé, ver la respuesta",
    "tarjetas.bien": "¡Muy bien! 🎉",
    "tarjetas.casi": "Casi. Mira cómo se escribe:",
    "tarjetas.verTraduccion": "Ver la traducción",
    "tarjetas.ocultarTraduccion": "Ocultar la traducción",
    "tarjetas.repasar": "🔁 Repasar",
    "tarjetas.sabia": "✅ La sabía",
    "tarjetas.final": "¡Ronda terminada!",
    "tarjetas.otraVuelta": "Otra vuelta",
    "tarjetas.volverMenu": "Volver al menú",
    "tarjetas.escucharPalabra": "Escuchar la palabra",
    "tarjetas.escucharFrase": "Escuchar la frase",
    "tarjetas.alt": "Escena en gris donde solo aparece en color: {que}",
    "tarjetas.error": "No se han podido cargar las tarjetas: {motivo}",
    "tarjetas.vacio": "No hay tarjetas en Firestore todavía. Súbelas con tools/import (ver README).",

    "marcador.conocida": "La sabía",
    "marcador.repaso": "Repasar",
    "marcador.vista": "Vistas",
    "marcador.nueva": "Nuevas",

    "dicc.etiqueta": "Escribe una palabra en inglés, castellano o euskera",
    "dicc.pista": "dog, perro, txakurra…",
    "dicc.buscar": "Buscar",
    "dicc.definicion": "Qué significa",
    "dicc.buscando": "Buscando…",
    "dicc.nada": "No tengo esa palabra todavía.",
    "dicc.error": "No se ha podido buscar: {motivo}",

    "idioma.es": "Castellano",
    "idioma.eu": "Euskara",
    "idioma.en": "English",

    "mates.tablas.nombre": "Tablas",
    "mates.tablas.que": "Del 1 al 10, a toda velocidad",
    "mates.sumas.nombre": "Sumas ABN",
    "mates.sumas.que": "Completa la decena y suma lo que queda",
    "mates.restas.nombre": "Restas ABN",
    "mates.restas.que": "Baja hasta la decena y quita lo que queda",
    "mates.elegirTabla": "O elige una tabla",
    "mates.mezcla": "Mezcla de todas",
    "mates.tablaDel": "Tabla del {n}",
    "mates.tablaAria": "Tabla del {n}",
    "mates.leyendaVerde": "te la sabes",
    "mates.leyendaMedia": "a medias",
    "mates.leyendaNada": "sin practicar",
    "mates.sumaPaso1": "¿Cuánto le falta a {a} para llegar a {b}?",
    "mates.sumaPaso1Ayuda": "Primero completamos la decena.",
    "mates.sumaPaso2": "Ya has usado {a}. ¿Cuánto te queda por sumar?",
    "mates.sumaPaso2Ayuda": "De los {n} que sumabas.",
    "mates.restaPaso1": "¿Cuánto le quitas a {a} para bajar a {b}?",
    "mates.restaPaso1Ayuda": "Primero bajamos a la decena.",
    "mates.restaPaso2": "Ya has quitado {a}. ¿Cuánto te queda por quitar?",
    "mates.restaPaso2Ayuda": "De los {n} que quitabas.",
    "mates.pasoFinalAyuda": "Y ya está.",
    "mates.era": "Era {n}. Seguimos.",
    "mates.borrar": "Borrar",
    "mates.comprobar": "Comprobar",
    "mates.todasBien": "¡Todas bien!",
    "mates.buenaRonda": "¡Buena ronda!",
    "mates.rondaTerminada": "Ronda terminada",
    "mates.bien": "Bien",
    "mates.aRepasar": "A repasar",
    "mates.otraRonda": "Otra ronda",
    "mates.otroReto": "Elegir otro reto",

    "ajustes.idioma": "Idioma de la app",
    "ajustes.instalar": "📲 Instalar la app",
    "ajustes.instalarIOS": "En iPhone o iPad: pulsa Compartir ⬆️ y luego «Añadir a pantalla de inicio».",
    "ajustes.salir": "👋 Cerrar sesión",
    "ajustes.borrar": "Borrar todo mi progreso",
    "ajustes.borrarSeguro": "¿Seguro? Se borra el progreso de las tarjetas y de Matemagia, y todo vuelve a empezar.",
    "ajustes.version": "Versión",
    "ajustes.actualizada": "Actualizada",
    "ajustes.alDia": "Estás en la última versión.",
    "ajustes.sinComprobar": "Sin conexión: no se puede comprobar si hay una versión más nueva.",
    "ajustes.hayNueva": "Hay una versión más nueva publicada ({version} · {commit}, {fecha}). Estás usando una copia guardada.",
    "ajustes.actualizar": "Actualizar a la última versión",
    "ajustes.actualizando": "Actualizando…",
    "ajustes.contenido": "Contenido",
    "ajustes.descargar": "Descargar las tarjetas (CSV)",
    "ajustes.descargando": "Preparando…",
    "ajustes.descargaError": "No se ha podido descargar: {motivo}",
    "ajustes.descargaPista": "Para revisar o corregir el vocabulario fuera de la app. Se vuelve a subir con tools/import."
  },

  eu: {
    "app.titulo": "Sofíaren laguntza",
    "app.lema": "Zure tresnak",
    "comun.cargando": "Kargatzen…",
    "comun.volver": "Itzuli",
    "comun.ajustes": "Ezarpenak",
    "nav.inicio": "Hasiera",
    "nav.principal": "Nabigazio nagusia",
    "nav.menu": "Menua ireki",
    "nav.cerrarMenu": "Menua itxi",
    "comun.sinConexion": "Konexiorik gabe: jolasten jarraitu dezakezu eta zure aurrerapena gordeko da sarea itzultzean.",

    "login.lema": "Eman kolorea zure bizitzari.",
    "login.lema2": "Ikasi zerbait berria.",
    "login.texto": "Sartu zure Google kontuarekin, appak dakizuna gogoratu dezan.",
    "login.boton": "Sartu Googlerekin",
    "login.error": "Ezin izan da sartu: {motivo}",

    "sinAcceso.titulo": "App hau pribatua da",
    "sinAcceso.texto": "{correo} kontuarekin sartu zara, baina kontu horrek ez du sarbiderik.",
    "sinAcceso.boton": "Saiatu beste kontu batekin",

    "hub.saludo": "Kaixo, {nombre}",
    "hub.saludoSinNombre": "Kaixo",
    "hub.pregunta": "Zer egin nahi duzu gaur?",

    "modulo.tarjetas.nombre": "Txartelak",
    "modulo.tarjetas.que": "Entzun, begiratu marrazkia eta idatzi hitza ingelesez",
    "modulo.tarjetas.estado": "{n} hitz",
    "modulo.tarjetas.estadoUna": "hitz 1",
    "modulo.diccionario.nombre": "Hiztegia",
    "modulo.diccionario.que": "Hitz bat hizkuntza batean eta beste biak emango dizkizut",
    "modulo.diccionario.estado": "3 hizkuntza",
    "modulo.matemagia.nombre": "Matemagia",
    "modulo.matemagia.que": "Taulak, batuketak eta kenketak ABN metodoarekin",
    "modulo.matemagia.estado": "3 erronka",
    "modulo.libre.nombre": "Datorrena",
    "modulo.libre.que": "Hemen joango da egiten dugun hurrengo tresna",
    "modulo.libre.estado": "Libre",

    "tarjetas.intro": "Entzun hitza, begiratu marrazkia eta idatzi ingelesez.",
    "tarjetas.empezar": "Hasi",
    "tarjetas.sinVoz": "Nabigatzaile honek ezin ditu hitzak ozen irakurri.",
    "tarjetas.escucharOtra": "Entzun berriro",
    "tarjetas.escribe": "Idatzi ingelesez",
    "tarjetas.comprobar": "Egiaztatu",
    "tarjetas.noLoSe": "Ez dakit, ikusi erantzuna",
    "tarjetas.bien": "Oso ondo! 🎉",
    "tarjetas.casi": "Ia-ia. Begiratu nola idazten den:",
    "tarjetas.verTraduccion": "Ikusi itzulpena",
    "tarjetas.ocultarTraduccion": "Ezkutatu itzulpena",
    "tarjetas.repasar": "🔁 Errepasatu",
    "tarjetas.sabia": "✅ Banekien",
    "tarjetas.final": "Txanda amaituta!",
    "tarjetas.otraVuelta": "Beste txanda bat",
    "tarjetas.volverMenu": "Itzuli menura",
    "tarjetas.escucharPalabra": "Entzun hitza",
    "tarjetas.escucharFrase": "Entzun esaldia",
    "tarjetas.alt": "Eszena grisa, kolorez hau bakarrik: {que}",
    "tarjetas.error": "Ezin izan dira txartelak kargatu: {motivo}",
    "tarjetas.vacio": "Oraindik ez dago txartelik Firestoren. Igo itzazu tools/import erabiliz (ikusi README).",

    "marcador.conocida": "Banekien",
    "marcador.repaso": "Errepasatu",
    "marcador.vista": "Ikusiak",
    "marcador.nueva": "Berriak",

    "dicc.etiqueta": "Idatzi hitz bat ingelesez, gaztelaniaz edo euskaraz",
    "dicc.pista": "dog, perro, txakurra…",
    "dicc.buscar": "Bilatu",
    "dicc.definicion": "Zer esan nahi duen",
    "dicc.buscando": "Bilatzen…",
    "dicc.nada": "Ez daukat hitz hori oraindik.",
    "dicc.error": "Ezin izan da bilatu: {motivo}",

    "idioma.es": "Gaztelania",
    "idioma.eu": "Euskara",
    "idioma.en": "Ingelesa",

    "mates.tablas.nombre": "Taulak",
    "mates.tablas.que": "1etik 10era, azkar-azkar",
    "mates.sumas.nombre": "ABN batuketak",
    "mates.sumas.que": "Osatu hamarrekoa eta batu gainerakoa",
    "mates.restas.nombre": "ABN kenketak",
    "mates.restas.que": "Jaitsi hamarrekora eta kendu gainerakoa",
    "mates.elegirTabla": "Edo aukeratu taula bat",
    "mates.mezcla": "Denen nahasketa",
    "mates.tablaDel": "{n}en taula",
    "mates.tablaAria": "{n}en taula",
    "mates.leyendaVerde": "badakizu",
    "mates.leyendaMedia": "erdizka",
    "mates.leyendaNada": "landu gabe",
    "mates.sumaPaso1": "Zenbat falta zaio {a} zenbakiari {b}ra iristeko?",
    "mates.sumaPaso1Ayuda": "Lehenengo hamarrekoa osatzen dugu.",
    "mates.sumaPaso2": "{a} erabili duzu jada. Zenbat gelditzen zaizu batzeko?",
    "mates.sumaPaso2Ayuda": "Batzen zenituen {n} horietatik.",
    "mates.restaPaso1": "Zenbat kentzen diozu {a} zenbakiari {b}ra jaisteko?",
    "mates.restaPaso1Ayuda": "Lehenengo hamarrekora jaisten gara.",
    "mates.restaPaso2": "{a} kendu duzu jada. Zenbat gelditzen zaizu kentzeko?",
    "mates.restaPaso2Ayuda": "Kentzen zenituen {n} horietatik.",
    "mates.pasoFinalAyuda": "Eta kito.",
    "mates.era": "{n} zen. Jarraitu dezagun.",
    "mates.borrar": "Ezabatu",
    "mates.comprobar": "Egiaztatu",
    "mates.todasBien": "Denak ondo!",
    "mates.buenaRonda": "Txanda ona!",
    "mates.rondaTerminada": "Txanda amaituta",
    "mates.bien": "Ondo",
    "mates.aRepasar": "Errepasatzeko",
    "mates.otraRonda": "Beste txanda bat",
    "mates.otroReto": "Aukeratu beste erronka bat",

    "ajustes.idioma": "Aplikazioaren hizkuntza",
    "ajustes.instalar": "📲 Instalatu app-a",
    "ajustes.instalarIOS": "iPhone edo iPad-en: sakatu Partekatu ⬆️ eta gero «Gehitu hasierako pantailan».",
    "ajustes.salir": "👋 Itxi saioa",
    "ajustes.borrar": "Ezabatu nire aurrerapen guztia",
    "ajustes.borrarSeguro": "Ziur? Txartelen eta Matemagiaren aurrerapena ezabatuko da, eta dena hasieratik hasiko da.",
    "ajustes.version": "Bertsioa",
    "ajustes.actualizada": "Eguneratuta",
    "ajustes.alDia": "Azken bertsioan zaude.",
    "ajustes.sinComprobar": "Konexiorik gabe: ezin da egiaztatu bertsio berriagorik dagoen.",
    "ajustes.hayNueva": "Bertsio berriago bat argitaratu da ({version} · {commit}, {fecha}). Gordetako kopia bat erabiltzen ari zara.",
    "ajustes.actualizar": "Eguneratu azken bertsiora",
    "ajustes.actualizando": "Eguneratzen…",
    "ajustes.contenido": "Edukia",
    "ajustes.descargar": "Deskargatu txartelak (CSV)",
    "ajustes.descargando": "Prestatzen…",
    "ajustes.descargaError": "Ezin izan da deskargatu: {motivo}",
    "ajustes.descargaPista": "Hiztegia app-etik kanpo berrikusteko edo zuzentzeko. tools/import erabiliz igotzen da berriro."
  },

  en: {
    "app.titulo": "Sofía's Toolbox",
    "app.lema": "Your tools",
    "comun.cargando": "Loading…",
    "comun.volver": "Back",
    "comun.ajustes": "Settings",
    "nav.inicio": "Home",
    "nav.principal": "Main navigation",
    "nav.menu": "Open the menu",
    "nav.cerrarMenu": "Close the menu",
    "comun.sinConexion": "You're offline: keep playing, your progress will be saved when you're back.",

    "login.lema": "Add colour to your life.",
    "login.lema2": "Learn something new.",
    "login.texto": "Sign in with your Google account so the app remembers what you know.",
    "login.boton": "Sign in with Google",
    "login.error": "Couldn't sign in: {motivo}",

    "sinAcceso.titulo": "This app is private",
    "sinAcceso.texto": "You signed in as {correo}, but that account doesn't have access.",
    "sinAcceso.boton": "Try another account",

    "hub.saludo": "Hi, {nombre}",
    "hub.saludoSinNombre": "Hi",
    "hub.pregunta": "What would you like to do today?",

    "modulo.tarjetas.nombre": "Cards",
    "modulo.tarjetas.que": "Listen, look at the picture and write the English word",
    "modulo.tarjetas.estado": "{n} words",
    "modulo.tarjetas.estadoUna": "1 word",
    "modulo.diccionario.nombre": "Dictionary",
    "modulo.diccionario.que": "One word in one language, and I give you the other two",
    "modulo.diccionario.estado": "3 languages",
    "modulo.matemagia.nombre": "Mathmagic",
    "modulo.matemagia.que": "Times tables, adding and subtracting the ABN way",
    "modulo.matemagia.estado": "3 challenges",
    "modulo.libre.nombre": "Coming up",
    "modulo.libre.que": "The next tool we build will go here",
    "modulo.libre.estado": "Free",

    "tarjetas.intro": "Listen to the word, look at the picture and write it in English.",
    "tarjetas.empezar": "Start",
    "tarjetas.sinVoz": "This browser can't read the words out loud.",
    "tarjetas.escucharOtra": "Listen again",
    "tarjetas.escribe": "Write it in English",
    "tarjetas.comprobar": "Check",
    "tarjetas.noLoSe": "I don't know, show me",
    "tarjetas.bien": "Well done! 🎉",
    "tarjetas.casi": "Almost. This is how it's spelled:",
    "tarjetas.verTraduccion": "Show the translation",
    "tarjetas.ocultarTraduccion": "Hide the translation",
    "tarjetas.repasar": "🔁 Review",
    "tarjetas.sabia": "✅ I knew it",
    "tarjetas.final": "Round finished!",
    "tarjetas.otraVuelta": "Another round",
    "tarjetas.volverMenu": "Back to the menu",
    "tarjetas.escucharPalabra": "Listen to the word",
    "tarjetas.escucharFrase": "Listen to the sentence",
    "tarjetas.alt": "A grey scene where only this is in colour: {que}",
    "tarjetas.error": "Couldn't load the cards: {motivo}",
    "tarjetas.vacio": "There are no cards in Firestore yet. Upload them with tools/import (see the README).",

    "marcador.conocida": "I knew it",
    "marcador.repaso": "Review",
    "marcador.vista": "Seen",
    "marcador.nueva": "New",

    "dicc.etiqueta": "Write a word in English, Spanish or Basque",
    "dicc.pista": "dog, perro, txakurra…",
    "dicc.buscar": "Search",
    "dicc.definicion": "What it means",
    "dicc.buscando": "Searching…",
    "dicc.nada": "I don't have that word yet.",
    "dicc.error": "Couldn't search: {motivo}",

    "idioma.es": "Spanish",
    "idioma.eu": "Basque",
    "idioma.en": "English",

    "mates.tablas.nombre": "Times tables",
    "mates.tablas.que": "From 1 to 10, as fast as you can",
    "mates.sumas.nombre": "ABN adding",
    "mates.sumas.que": "Fill up the ten, then add what's left",
    "mates.restas.nombre": "ABN subtracting",
    "mates.restas.que": "Drop to the ten, then take away what's left",
    "mates.elegirTabla": "Or pick a table",
    "mates.mezcla": "Mix them all",
    "mates.tablaDel": "The {n} times table",
    "mates.tablaAria": "The {n} times table",
    "mates.leyendaVerde": "you know it",
    "mates.leyendaMedia": "halfway",
    "mates.leyendaNada": "not practised",
    "mates.sumaPaso1": "How much does {a} need to reach {b}?",
    "mates.sumaPaso1Ayuda": "First we fill up the ten.",
    "mates.sumaPaso2": "You've used {a} already. How much is left to add?",
    "mates.sumaPaso2Ayuda": "Out of the {n} you were adding.",
    "mates.restaPaso1": "How much do you take from {a} to drop to {b}?",
    "mates.restaPaso1Ayuda": "First we drop to the ten.",
    "mates.restaPaso2": "You've taken {a} already. How much is left to take?",
    "mates.restaPaso2Ayuda": "Out of the {n} you were taking.",
    "mates.pasoFinalAyuda": "And that's it.",
    "mates.era": "It was {n}. Let's carry on.",
    "mates.borrar": "Delete",
    "mates.comprobar": "Check",
    "mates.todasBien": "All correct!",
    "mates.buenaRonda": "Good round!",
    "mates.rondaTerminada": "Round finished",
    "mates.bien": "Right",
    "mates.aRepasar": "To review",
    "mates.otraRonda": "Another round",
    "mates.otroReto": "Pick another challenge",

    "ajustes.idioma": "App language",
    "ajustes.instalar": "📲 Install the app",
    "ajustes.instalarIOS": "On iPhone or iPad: tap Share ⬆️ and then “Add to Home Screen”.",
    "ajustes.salir": "👋 Sign out",
    "ajustes.borrar": "Delete all my progress",
    "ajustes.borrarSeguro": "Are you sure? This deletes your progress in Cards and Mathmagic, and everything starts again.",
    "ajustes.version": "Version",
    "ajustes.actualizada": "Updated",
    "ajustes.alDia": "You're on the latest version.",
    "ajustes.sinComprobar": "You're offline: can't check whether there's a newer version.",
    "ajustes.hayNueva": "A newer version is published ({version} · {commit}, {fecha}). You're using a saved copy.",
    "ajustes.actualizar": "Update to the latest version",
    "ajustes.actualizando": "Updating…",
    "ajustes.contenido": "Content",
    "ajustes.descargar": "Download the cards (CSV)",
    "ajustes.descargando": "Getting it ready…",
    "ajustes.descargaError": "Couldn't download: {motivo}",
    "ajustes.descargaPista": "To review or fix the vocabulary outside the app. You upload it back with tools/import."
  }
};

const POR_DEFECTO = "es";

/* Con guardas para poder importar este fichero desde Node: las
   herramientas de tools/ leen TEXTOS sin navegador de por medio. */
function leerGuardado() {
  if (typeof window === "undefined") return POR_DEFECTO;
  try {
    const guardado = window.localStorage.getItem(CLAVE);
    if (guardado && TEXTOS[guardado]) return guardado;
  } catch (error) {
    /* sin almacenamiento: se usa el del navegador */
  }
  const delNavegador = (navigator.language || "").slice(0, 2);
  return TEXTOS[delNavegador] ? delNavegador : POR_DEFECTO;
}

let idioma = leerGuardado();

export function idiomaActual() {
  return idioma;
}

/**
 * Texto traducido. {claves} se sustituyen por lo que se le pase.
 * Si falta en el idioma elegido, cae al castellano: mejor una frase en
 * otro idioma que la clave cruda en la cara.
 */
export function t(clave, valores) {
  const texto = (TEXTOS[idioma] && TEXTOS[idioma][clave]) || TEXTOS[POR_DEFECTO][clave] || clave;
  if (!valores) return texto;
  return texto.replace(/\{(\w+)\}/g, (entero, nombre) => (
    valores[nombre] === undefined ? entero : valores[nombre]
  ));
}

/**
 * Traduce el HTML ya escrito:
 *   data-i18n="clave"                  → el texto del elemento
 *   data-i18n-attr="placeholder:clave" → un atributo (o varios, con ;)
 */
export function aplicar(raiz = document) {
  if (typeof document === "undefined") return;
  raiz.querySelectorAll("[data-i18n]").forEach((elemento) => {
    elemento.textContent = t(elemento.dataset.i18n);
  });

  raiz.querySelectorAll("[data-i18n-attr]").forEach((elemento) => {
    elemento.dataset.i18nAttr.split(";").forEach((par) => {
      const [atributo, clave] = par.split(":").map((trozo) => trozo.trim());
      if (atributo && clave) elemento.setAttribute(atributo, t(clave));
    });
  });

  document.documentElement.lang = idioma;
  document.title = t("app.titulo");
}

/** Cambia el idioma y lo recuerda en este dispositivo. */
export function cambiarIdioma(codigo) {
  if (!TEXTOS[codigo]) return;
  idioma = codigo;
  try { window.localStorage.setItem(CLAVE, codigo); } catch (error) { /* nada */ }
  aplicar();
}
