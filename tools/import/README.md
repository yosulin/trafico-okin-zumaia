# Importador de contenido

Herramienta de administración. **No forma parte de la PWA** y nunca se despliega
con ella: entra en Firebase con una **cuenta de servicio**, que es precisamente
lo que permite que el navegador tenga prohibido escribir tarjetas
(ver `firestore.rules` y `storage.rules` en la raíz del repositorio).

```
origen (.apkg / .json / .csv)
        ↓  leer
   normalizar  ──────────────→  mismo esquema para todo
        ↓  subir medios
Firebase Storage (images/, audio/)
        ↓  escribir
Firestore (colección "cards")
```

---

## Preparación

```bash
cd tools/import
npm install          # firebase-admin (+ better-sqlite3, solo para Anki)

# clave de la cuenta de servicio, FUERA del repositorio
# (Consola de Firebase → Configuración del proyecto → Cuentas de servicio)
export GOOGLE_APPLICATION_CREDENTIALS=/ruta/absoluta/a/clave.json
```

`--dry-run` no necesita ni dependencias ni credenciales: enseña exactamente qué
se subiría y qué documento quedaría en Firestore, sin tocar nada.

---

## Las 10 tarjetas de demostración

```bash
npm run semilla-prueba   # ver qué haría, sin tocar nada
npm run semilla          # crear las 10 tarjetas en Firestore
```

Las ilustraciones **no se suben**: viven en `vocabulario/media/` y las sirve
Hosting con la propia app (Firebase Storage exige plan de pago). Por eso la
semilla lleva `--sin-medios`.

El día que actives Blaze y quieras usar Storage:

```bash
npm run semilla-storage   # sube las ilustraciones y reescribe las tarjetas
```

y pon `MEDIA_SOURCE=storage` en `.env` antes de regenerar la configuración web.
Las rutas son idénticas en los dos modos, así que no hay nada que migrar.

---

## Opciones

```
--origen <json|csv|anki>   obligatorio
--fichero <ruta>           obligatorio
--media <carpeta>          carpeta local de medios (por defecto, la del fichero)
--dry-run                  no sube ni escribe nada
--limite <n>               importar como mucho n tarjetas
--forzar                   volver a subir medios que ya están en Storage
--sin-medios               no subir nada a Storage (los sirve Hosting)
--inactivas                crear con active:false, para revisarlas antes de publicarlas

--tema <id>                tema por defecto (animals, food, school...)
--capa <n>                 capa por defecto
--fuente <tipo>            source.type: general | escolar | anki
--libro <texto>            source.book
--unidad <texto>           source.unit

--campos a=0,b=1           solo Anki: qué posición ocupa cada campo
```

---

## CSV (vocabulario escolar)

Cabecera admitida (el orden da igual; bastan `word` y una traducción):

```csv
word,es,eu,theme,type,layer,tags,example_en,example_es,example_eu,image,word_audio,example_audio
window,ventana,leihoa,school,noun,1,"school,house","Open the window.","Abre la ventana.",,,,
```

```bash
node importar.mjs --origen csv --fichero unidad3.csv \
  --tema school --fuente escolar --libro "Explorers 4" --unidad 3 --dry-run
```

`image`, `word_audio` y `example_audio` son ficheros dentro de la carpeta
`--media`; sus rutas de Storage se calculan solas:

```
images/<tema>/<id>.<ext>
audio/words/<id>.<ext>
audio/examples/<id>_example_01.<ext>
```

---

## JSON

Admite `[ {...} ]` o `{ "tarjetas": [ ... ], "temas": [ ... ] }`, con los campos
del esquema de Firestore. Si la tarjeta ya trae `imagePath` y el fichero existe
en `<media>/` con esa misma ruta relativa, se sube ahí (es lo que hace la
semilla de demostración).

---

## Mazos de Anki (.apkg)

Un `.apkg` es un zip con una base SQLite (`collection.anki2`), un fichero `media`
que mapea número → nombre original, y los medios numerados. El zip se lee sin
dependencias (`lib/zip.mjs`); leer SQLite necesita `better-sqlite3`, que instala
`npm install`.

Anki guarda **todos los campos de una nota en una sola columna**, separados por
`0x1f` y en el orden en que los definió quien hizo el mazo. Por eso hay que
decirle al importador qué posición ocupa cada campo:

```bash
# primero, mirar qué trae el mazo
node importar.mjs --origen anki --fichero oxford3000.apkg \
  --campos word=0,es=1,example_en=2,example_audio=3 --limite 5 --dry-run
```

Ajusta los números hasta que la tarjeta de muestra salga bien, y entonces quita
`--dry-run`. Para un mazo tipo **Oxford 3000** (palabra, traducción, audio de la
palabra, ejemplo, audio del ejemplo, traducción del ejemplo) lo habitual es algo
como:

```bash
node importar.mjs --origen anki --fichero oxford3000.apkg \
  --campos word=0,word_audio=1,es=2,example_en=3,example_audio=4,example_es=5 \
  --fuente anki --capa 2 --inactivas
```

`--inactivas` es buena idea en mazos grandes: las tarjetas se crean con
`active:false`, no aparecen en la app y puedes ir activando en la consola de
Firebase las que quieras usar.

Los campos que ese mazo no trae (**euskera, imagen, tema, capa, tipo,
etiquetas, nivel infantil, libro, unidad**) quedan vacíos: ya están en el
esquema, así que rellenarlos después no exige migrar nada. El audio de Anki se
sube tal cual a `audio/words/` y `audio/examples/`, y la app lo usa en lugar de
la voz sintética en cuanto existe.

> Si el `.apkg` es del formato nuevo (`collection.anki21b`, comprimido con zstd),
> vuelve a exportarlo desde Anki marcando **«Compatibilidad con versiones
> anteriores»**.

---

## Volver a importar

Todas las escrituras son `merge`, y el `id` es estable (`<tema>_<palabra>`), así
que reimportar el mismo origen **actualiza** las tarjetas en vez de duplicarlas.
Los medios que ya están en Storage no se vuelven a subir salvo con `--forzar`.

---

## Ficheros

```
importar.mjs          la cadena completa y la línea de comandos
lib/origen-json.mjs   lector JSON
lib/origen-csv.mjs    lector CSV (con comillas y saltos de línea)
lib/origen-anki.mjs   lector .apkg
lib/zip.mjs           lectura de zips sin dependencias
lib/normalizar.mjs    de "lo que venga" al esquema de Firestore
lib/firebase.mjs      Admin SDK: subir a Storage y escribir en Firestore
datos/                las 10 tarjetas de demostración
                      (sus ilustraciones están en vocabulario/media/)
```

Añadir un origen nuevo es escribir un lector que devuelva objetos sueltos con
`word`, `es`, `example`... El resto de la cadena no cambia.
