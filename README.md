# Generador de pruebas (formas A y B)

Página web de una sola pantalla, hermana del [Calificador OMR](https://github.com/pxjacomex/scanner),
para armar pruebas de alternativas a partir de un **banco de preguntas** y
sacar dos formas (A y B) de la misma prueba, listas para imprimir con la
cabecera que lee el calificador. Igual que el calificador: sin servidor, sin
paso de build y sin dependencias; todo ocurre en el navegador y los datos
quedan en el dispositivo (IndexedDB + localStorage).

Se publica con GitHub Pages desde la raíz de este repositorio
(`https://pxjacomex.github.io/generador-pruebas/`) y también sirve en un
servidor local (`python3 -m http.server`). La puesta en marcha paso a paso
está en [GUIA.md](GUIA.md).

## Lineamientos (los mismos del calificador)

1. **Debe funcionar sin internet** después de la primera visita (service worker
   propio, sin librerías). Si algo falta en caché y no hay red, se avisa.
2. **Sin paquetes externos salvo los imprescindibles y de confianza**: APIs
   nativas del navegador (IndexedDB, Canvas, File, Cache Storage, Service
   Worker), la fuente Outfit de Google Fonts para la interfaz y **KaTeX**
   (MIT, Khan Academy) para dibujar ecuaciones LaTeX, copiado en
   `vendor/katex/` (sin CDN). El evaluador de fórmulas es código propio.
3. **Pensado para Chrome**: se edita cómodamente en computador (la impresión
   se hace desde ahí) y la interfaz también cabe en un teléfono.

Interfaz y comentarios del código en **español**.

## Qué hace

- **Banco de preguntas** con dos tipos:
  - *Opciones fijas*: cuatro alternativas de texto, una correcta.
  - *Problema con datos*: el enunciado lleva variables (`{{v}}`, `{{t}}`…),
    varios **sets de datos** (filas de valores) y una **fórmula por opción**
    (`v*t`, `sqrt(2*h/g)`…) que calcula su texto. Se eligen redondeo y unidad;
    el redondeo *Exacto* escribe el resultado como fracción, raíz o múltiplo de
    π en LaTeX (`2\sqrt{5}`, `\frac{\sqrt{2}}{2}`), con `unsimplify(…)` para
    la forma `√20` y `decimal(…)` para forzar el decimal; si no hay forma
    exacta, esa opción sale en decimal y el editor lo avisa.
  - Cualquier pregunta puede llevar una **imagen o diagrama** (ancho impreso
    en mm, a la derecha del texto o debajo) y una **etiqueta** libre que solo
    se muestra como globo en las listas (Banco, selector y Armar) y entra en
    el buscador; nunca se imprime.
  - **Ecuaciones LaTeX** en enunciados, opciones e instrucciones: `$…$` en
    línea y `$$…$$` en bloque (`dividirMatematicas` + `katex.renderToString`
    en `js/util.js`; `\$` es un dólar literal). Fuera de las fórmulas sigue el
    markup mínimo `^{}`, `_{}`, `**…**`. Las variables van con llaves dobles,
    `{{v}}`, dentro y fuera de las fórmulas (las simples son grupos de LaTeX);
    el marcador antiguo `{v}` se acepta solo fuera de las fórmulas y
    `normalizarPregunta` migra las preguntas guardadas (`migrarMarcadores`).
  - Editor con vista previa "así se imprime" y tabla con el valor de cada
    opción en cada set; avisa de fórmulas inválidas, variables sin valor y
    opciones repetidas.
  - Importar/exportar el banco como JSON; preguntas de ejemplo en
    `banco/ejemplos.json`.
  - *Limpiar vista* vacía la lista en pantalla y el selector de Armar sin
    borrar nada (`BANCO.preguntas` frente a `BANCO.todas`, que conserva todo
    lo guardado para resolver los ids de las pruebas); *Recargar banco
    guardado* la rellena, y una importación con la vista vacía muestra solo lo
    importado.
- **Armar**: título, curso, fecha, instrucciones, tamaño de letra; 5 preguntas
  elegidas del banco con un selector que filtra por texto, tema y tipo y
  muestra cada pregunta antes de agregarla; por problema, el set de cada
  forma (al azar o fijo).
- **Generar**: la forma A sale con las preguntas en orden aleatorio y la B con
  otro orden en el que ninguna pregunta repite posición; en cada pregunta las
  opciones se mezclan de forma distinta en A y B (la correcta cambia de letra)
  y los problemas usan sets de datos distintos. Dentro de cada forma, la letra
  de la respuesta correcta se reparte: ninguna letra se repite más de lo
  imprescindible (con 5 preguntas, como máximo dos veces). El resultado se guarda con una
  copia de las preguntas, así una prueba vieja se ve igual aunque el banco
  cambie después.
- **Vista previa e impresión**: páginas a tamaño real, claves de ambas formas
  y botones para imprimir todo, solo la cara 1, solo la cara 2 o la hoja de
  claves.
- **Guardadas**: ver, editar (vuelve a Armar), duplicar, exportar, importar,
  eliminar; copia de seguridad completa (banco + pruebas).

## Formato impreso

Reproduce la plantilla de Word que se imprimía a dos páginas por hoja: cada
prueba ocupa **media hoja A4 apaisada (210 × 148,5 mm) por las dos caras**.

- Disposición por defecto (`a4`): hojas A4 verticales con dos pruebas. Cara 1:
  arriba la primera cara de la forma A, abajo la de la forma B; cara 2: los
  dorsos (opción "invertir mitades" por si la impresora voltea por el otro
  borde). Línea de corte punteada en la mitad.
- Disposición `a5`: cuatro páginas sueltas de 210 × 148,5 mm (A1, A2, B1, B2),
  para seguir usando "2 páginas por hoja" del diálogo de impresión.
- La cabecera OMR (`img/cabecera_v2.png`, recorte de `templates/cabecera_v2.pdf`
  del repositorio del calificador a 600 dpi, 210 × 23,5 mm de página) se imprime a
  206 mm de ancho (`CABECERA_ANCHO_MM`), centrada y saliéndose de los márgenes
  de `.cara` con márgenes negativos: como la imagen lleva 3,6 mm de blanco a
  los lados y 2,1 mm arriba, la tinta queda a ≈5,5 mm de los bordes laterales
  del papel y a ≈6,1 mm del superior. Su borde inferior está fijo a ≈27,2 mm
  del borde superior de la media hoja (`CABECERA_FONDO_MM`). El calificador
  solo usa proporciones relativas a los marcadores, así que la escala no le
  afecta.
- **Casilla F**: con "Imprimir la casilla F ya marcada", la forma A lleva F = 1
  y la B F = 2 pintadas (se dibujan sobre la imagen con un canvas; si el
  canvas no está disponible, con un cuadro negro superpuesto). El calificador
  exige F y aplica la clave del "Formato 1" o "Formato 2": basta con escribir
  allí las claves que muestra la vista previa.
- Bajo la cabecera van directamente las instrucciones (si las hay; vacías por
  defecto) y las preguntas; no se imprime título ni "Forma A/B" (la forma la
  indica la casilla F). En la cara 2 puede ir una línea "Nombre" (desactivada
  por defecto).
- Las preguntas se reparten entre las dos caras midiendo el alto real de cada
  una en la página (`paginarForma` en `js/vista.js`). Con **Distribuir en dos
  caras** (por defecto) se elige el corte que deja un espacio por pregunta
  parecido en ambas caras y el blanco sobrante se reparte por igual tras cada
  pregunta; si se desactiva, la cara 1 se llena primero. Se puede forzar
  cuántas preguntas van en la cara 1. Si algo no cabe, la vista previa lo
  avisa. Antes de medir se esperan las imágenes y las fuentes (KaTeX).
- **Panel fijo de orden, cara y espacio** (`#vistaLateral`, `position:
  sticky`): una sección por cara (A1, A2, B1, B2) con una fila por pregunta.
  Arrastrar (HTML5 drag and drop, o ▲ ▼ ⇅) cambia el orden dentro de la cara
  o pasa la pregunta a la otra cara de la misma forma: `forma.items` se
  reordena y renumera, `forma.clave` se recalcula y `forma.corte` fija
  cuántas van en la cara 1 (null = reparto automático; el botón "auto" lo
  devuelve). Cada fila lleva además los controles de espacio en blanco: −/+
  (pasos de 5 mm) y candado; el espacio libre de la cara se reparte según
  `prueba.espacios[forma][preguntaId] = { frac, bloqueado }` (fracciones que
  suman 1 por cara; por defecto iguales), así el espacio acompaña a la
  pregunta al reordenar. Se guarda con la prueba y se reinicia al volver a
  mezclar. La vista previa avisa si una pregunta queda en la misma posición
  en las dos formas.
- Tipografía del papel: Arial/Helvetica (la de la plantilla original); tamaño
  configurable de 9 a 18 pt (11 por defecto). Separador decimal: punto por
  defecto.

## Archivos

| Archivo | Para qué |
|---|---|
| `index.html` | Pantallas (Banco, Armar, Vista previa, Guardadas, Ayuda), modales y carga de scripts. |
| `css/generador.css` | Estilos de la interfaz (tema claro; acento verde como el calificador), del "papel" y de impresión (`@media print`). |
| `js/util.js` | Utilidades: ids, fechas, azar con semilla (mulberry32), archivos, formato de números y texto enriquecido (`^{}`, `_{}`, `**`). |
| `js/formulas.js` | Evaluador de fórmulas propio (sin `eval`): tokenizador + analizador descendente; funciones y constantes permitidas. Con `{ exacto: true }` delega además en `exacto.js`. |
| `js/exacto.js` | Cálculo exacto propio: suma de términos `(a/b)·√n·π^k` con BigInt (fracciones, raíces cuadradas, π), raíces desanidadas de dos términos, división por conjugado, tabla trigonométrica exacta (0°, 15°, 30°, 45°, 60°, 75°, 90° y los triángulos notables 4.8°, 9.5°, 18.4°, 36.9°, 53.1°, 71.6°, 80.5°, 85.2°), e inversas. `unsimplify` → forma `√20`; `decimal` → fuerza decimal. Lanza `NoExacto` cuando algo no tiene forma exacta. |
| `js/almacen.js` | IndexedDB (`generador-omr`: `preguntas`, `pruebas`) y localStorage (borrador, ajustes). |
| `js/modelo.js` | Estructuras de pregunta y prueba, normalización de importaciones, `resolverPregunta` (enunciado + opciones con un set), `generarFormas` (sorteo de A y B). Sin DOM. |
| `js/vista.js` | Dibujo de una pregunta (`nodoPregunta`, compartido), páginas, paginación, hojas A4/A5, claves, impresión y cabecera con la F marcada. |
| `js/banco.js` | Lista del banco, editor, imágenes, importar/exportar, modal "ver pregunta". |
| `js/armado.js` | Borrador de la prueba, selector de preguntas, sets por forma, generación. |
| `js/guardadas.js` | Pruebas guardadas, importar/exportar, copia de seguridad. |
| `js/app.js` | Arranque, pestañas, modales, toasts, registro del service worker. |
| `js/explorador.js`, `css/explorador.css` | **Explorador de problemas**: pestaña independiente que carga un JSON de problemas de libro (libro → capítulos → secciones → problemas con enunciado, figuras SVG, respuesta; formato de `serway_problemas_cap1-9_15.json`), lo guarda en una IndexedDB propia (`explorador-omr`) y permite filtrar por capítulo, sección, dificultad y texto, con figuras (SVG vía `<img>` + blob) y LaTeX dibujado. No toca el banco ni las pruebas. |
| `sw.js` | Service worker propio del generador (ámbito `generador/`): precarga los archivos, red primero con caché de respaldo. |
| `vendor/katex/` | KaTeX 0.19.1 (`katex.min.js`, `katex.min.css`, fuentes woff2, LICENSE) tomado del paquete oficial de npm. Para actualizarlo: `npm pack katex@<versión>`, copiar `dist/katex.min.*` y `dist/fonts/*.woff2`, y subir `VERSION` en `sw.js`. |
| `img/cabecera_v2.png` | Cabecera OMR v2 recortada (600 dpi). Si cambia la cabecera del calificador, regenerarla desde su `templates/cabecera_v2.pdf` y revisar `CABECERA` en `js/vista.js` (posición de las casillas F). |
| `banco/ejemplos.json` | Preguntas de ejemplo (Física) en el formato de exportación del banco. |
| `docs/FORMATO_BANCO.md`, `docs/banco.schema.json`, `docs/plantilla_banco.json` | Especificación del formato del banco: explicación campo a campo con un bloque de instrucciones para pedir bancos a una IA, esquema JSON Schema (borrador 07) y plantilla mínima válida (la descarga el botón "Plantilla del formato" de Banco). |
| `manifest.webmanifest`, `icons/` | Para instalar la página como app (Chrome → Instalar). |
| `.nojekyll` | GitHub Pages sirve los archivos tal cual. |
| `GUIA.md` | Puesta en marcha y uso, paso a paso. |

Los scripts son clásicos (ámbito global compartido) y se cargan en el orden
`util → formulas → almacen → modelo → vista → banco → armado → guardadas → app`.
Al añadir un archivo: enlazarlo en `index.html`, añadirlo a `ASSETS` en `sw.js`
y subir `VERSION`.

## Formato de datos

Pregunta (`preguntas` en IndexedDB y en los JSON exportados):

```json
{
  "id": "q_…", "tema": "Cinemática", "etiqueta": "control 2", "tipo": "calculo",
  "enunciado": "Un automóvil … {{v}} m/s durante {{t}} s …",
  "imagen": { "datos": "data:image/png;base64,…", "ancho_mm": 55, "posicion": "derecha", "ancho_px": 600, "alto_px": 400 },
  "mezclar": true,
  "opciones": [ { "texto": "", "formula": "v*t", "correcta": true }, { "texto": "", "formula": "v/t", "correcta": false }, … ],
  "variables": ["v", "t"],
  "sets": [ { "v": "12", "t": "5" }, { "v": "15", "t": "4" } ],
  "formato": { "modo": "auto", "decimales": 1, "unidad": "m" }
}
```

Prueba: `{ id, titulo, curso, fecha, instrucciones, opciones: {…}, items:
[{ preguntaId, setA, setB }], formas: { semilla, generada, A, B, snapshot,
avisos }, espacios: { A: { "<preguntaId>": { frac, bloqueado }, … }, B: {…} } }`;
cada forma lleva `corte` (preguntas en la cara 1, o null). Cada forma tiene `items: [{ numero, preguntaId, setIndice,
enunciado, opciones: [{ texto, correcta }], correcta }]` y `clave`.

## Probar en local

```bash
python3 -m http.server 8000
# abrir http://localhost:8000/
```

Para imprimir en PDF y revisar la paginación sin impresora: Chrome → Imprimir →
Destino "Guardar como PDF", papel A4, escala 100 %, márgenes "Ninguno".
