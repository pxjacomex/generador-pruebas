# Guía paso a paso: el Generador de pruebas en su propio repositorio

El generador es un proyecto independiente del Calificador OMR: vive en su
propio repositorio de GitHub y se publica con GitHub Pages. Esta guía va **un
paso a la vez**; cada paso dice qué hacer y cómo comprobar que salió bien. No
hace falta instalar nada en el computador: todo se hace desde el navegador.

En los ejemplos el repositorio se llama `generador-pruebas`; si eliges otro
nombre, cámbialo en las direcciones.

---

## Paso 1 · Crear el repositorio en GitHub

1. Entra a <https://github.com> con tu cuenta y pulsa el **+** de arriba a la
   derecha → **New repository**.
2. *Repository name*: `generador-pruebas`. Descripción opcional: "Generador de
   pruebas en dos formas para el Calificador OMR".
3. Visibilidad **Public** (GitHub Pages gratuito necesita repositorio público).
4. Marca **Add a README file**. No añadas `.gitignore` ni licencia.
5. Pulsa **Create repository**.

**Comprobación:** se abre la página del repositorio vacío, con un solo archivo
`README.md`, en la dirección `https://github.com/pxjacomex/generador-pruebas`.

---

## Paso 2 · Dar acceso a Claude al repositorio nuevo

Claude solo puede trabajar con los repositorios que le autorizas.

1. Abre <https://claude.ai/connect-github>.
2. Pulsa el botón para configurar la aplicación de GitHub de Claude. GitHub
   mostrará la instalación en tu cuenta `pxjacomex`.
3. En *Repository access* elige **Only select repositories** y añade
   `generador-pruebas` a la lista (mantén también `scanner`). Pulsa **Save**.
4. Vuelve al chat y escribe el nombre del repositorio, por ejemplo: "listo,
   el repositorio es generador-pruebas".

**Comprobación:** en <https://github.com/settings/installations> la app
*Claude* aparece con acceso a `generador-pruebas`.

---

## Paso 3 · Claude sube el código

Al recibir el nombre, Claude conecta el repositorio a la sesión, sube todos
los archivos del generador a la rama `main` y confirma la dirección.

**Comprobación:** en la pestaña *Code* del repositorio aparecen `index.html`,
`css/`, `js/`, `img/`, `banco/`, `icons/`, `sw.js`, `README.md` y `GUIA.md`.

---

## Paso 4 · Publicar con GitHub Pages

1. En el repositorio, **Settings → Pages**.
2. En *Build and deployment*, *Source*: **Deploy from a branch**; *Branch*:
   **main**, carpeta **/ (root)**. Pulsa **Save**.
3. Espera uno o dos minutos (en la pestaña **Actions** se ve *pages build and
   deployment*).
4. Abre <https://pxjacomex.github.io/generador-pruebas/>.

**Comprobación:** se abre "📝 Generador de pruebas" con las pestañas Banco,
Armar, Vista previa, Guardadas y Ayuda. Si sale un error 404, espera un minuto
y recarga.

---

## Paso 5 · Primer recorrido con las preguntas de ejemplo

1. En la primera visita el banco está vacío y la página ofrece cargar
   preguntas de ejemplo: acepta (también puedes hacerlo después con el botón
   **📥 Cargar ejemplos** de la pestaña Banco).
2. Pulsa **👁️ Ver** en cualquier pregunta: se muestra tal como se imprimirá,
   con la correcta resaltada; en los problemas con datos puedes cambiar el set
   con el desplegable.
3. Pulsa **✏️ Editar** en "Un bloque de masa {m} kg está apoyado sobre un plano
   inclinado…" para ver cómo se definen las variables, los sets de datos y las
   fórmulas de las opciones. Cancela sin guardar.

**Comprobación:** en el editor, el panel derecho "Así se imprime" cambia al
instante cuando modificas el enunciado o un valor de la tabla.

---

## Paso 6 · Crear tu banco de preguntas

Para cada pregunta, en la pestaña **Banco**:

- **Pregunta de opciones fijas:** tema, enunciado, cuatro opciones y la
  correcta marcada. Si una opción debe quedar siempre al final ("Todas las
  anteriores"), desmarca *Mezclar el orden de las opciones*.
- **Problema con datos:**
  1. Escribe el enunciado con cada dato entre llaves dobles: `Un auto viaja a
     {{v}} m/s durante {{t}} s`. También sirven dentro de una fórmula:
     `$v = {{v}}\ \mathrm{m/s}$`.
  2. En *Datos del enunciado*, pon el nombre de cada variable en la cabecera
     (`v`, `t`) y una fila por set de datos. Con **＋ Set de datos** añades
     filas; con **⧉** duplicas una para cambiar solo un valor. Conviene tener
     al menos 2 sets (uno por forma); con 3 o 4 podrás reutilizar la pregunta
     en otras pruebas con datos nuevos.
  3. En *Opciones de respuesta*, escribe la fórmula de cada opción
     (`v*t` la correcta; distractores como `v/t`, `v+t`, `2*v*t`) y marca la
     correcta. Elige el redondeo y la unidad.
  4. Revisa la tabla *Valor de cada opción por set*: si dos opciones dan el
     mismo número en algún set, aparece un aviso amarillo; cambia los datos de
     ese set.
- **Imagen o diagrama:** botón *Elegir imagen* (PNG, JPG o SVG). Ajusta el
  ancho impreso en mm y si va a la derecha del texto o debajo.
- Símbolos como ², °, π, Δ están en los botones bajo el enunciado; `m/s^{2}`
  se imprime como m/s² y `v_{0}` como v₀.
- **Ecuaciones:** escríbelas en LaTeX entre signos de dólar, por ejemplo
  `$ax + by + c = 0$` o `$E_c = \tfrac{1}{2} m v^{2}$`; se dibujan en la vista
  previa y en la impresión. El botón `$x²$` inserta los dólares. Para una
  ecuación centrada en su propia línea usa `$$…$$`.

Al terminar una sesión de trabajo, pulsa **⬇️ Exportar banco** y guarda el
archivo `banco_preguntas_<fecha>.json` (ver paso 10).

**Comprobación:** la pregunta aparece en la lista sin la etiqueta roja
"incompleta" ni la amarilla "revisar".

---

## Paso 7 · Armar y generar la primera prueba

1. Pestaña **Armar**: escribe el título (se imprime en la cabecera), el curso,
   la fecha y las instrucciones. Deja marcada *Imprimir la casilla F ya
   marcada*.
2. Pulsa **＋ Agregar del banco** y elige 5 preguntas (puedes ver cada una
   antes de agregarla). El contador debe quedar en **5 / 5**.
3. En los problemas con datos, deja *Al azar (distinto en A y B)* o fija el
   set de cada forma.
4. Pulsa **🎲 Generar formas A y B**. Se abre la vista previa y la prueba queda
   guardada en **Guardadas**.
5. Si el orden o la mezcla no te convence, **🎲 Volver a mezclar**.

**Comprobación:** en la vista previa, la cabecera de la forma A tiene pintada
la casilla F "1" y la de la forma B la "2"; ninguna pregunta ocupa la misma
posición en las dos formas.

---

## Paso 8 · Imprimir

1. En **Vista previa**, deja la disposición *Hojas A4: dos pruebas por hoja* y
   la casilla *Distribuir en dos caras* marcada (las preguntas se reparten
   entre las dos caras con el mismo espacio en blanco tras cada una). Si un
   problema necesita más espacio para los cálculos, usa el panel que hay junto
   a cada media hoja: **+** y **−** cambian su espacio de 5 en 5 mm a costa de
   las demás preguntas de esa cara; el candado 🔒 fija el espacio de una
   pregunta para que no cambie al ajustar otras; ⟲ vuelve al reparto igual.
2. Pulsa **🖨️ Solo cara 1**. En el diálogo de Chrome: papel A4, escala 100 %
   (no "ajustar a la página"), márgenes "Ninguno" (o "Predeterminados").
   Imprime **una sola hoja** de prueba.
3. Vuelve a poner esa hoja en la bandeja como lo hacías con la plantilla de
   Word y pulsa **🖨️ Solo cara 2**.
4. Comprueba que el dorso de la forma A (arriba) sea la cara 2 de la forma A.
   Si quedó la forma B detrás de la A, marca *Invertir mitades en la cara 2* y
   repite la cara 2.
5. Cuando la hoja de prueba salga bien, imprime el número de copias que
   necesites (cada hoja da una prueba A y una B) y corta por la línea de
   puntos con la guillotina.

Si tu impresora imprime a doble cara automáticamente, usa **🖨️ Imprimir
todo** con "voltear por el borde largo".

**Comprobación:** en la hoja impresa se ven completos los cuatro cuadrados
negros de las esquinas de la cabecera (los marcadores que busca el
calificador).

---

## Paso 9 · Calificar con el Calificador OMR

1. En la vista previa, en *Claves para el Calificador OMR*, copia o imprime
   (**🔑 Imprimir claves**) las claves de las dos formas.
2. Abre el calificador (<https://pxjacomex.github.io/scanner/>), pestaña
   **Clave**: en **Formato 1 (F = 1)** marca la clave de la **forma A** y en
   **Formato 2 (F = 2)** la de la **forma B**. Guarda.
3. Escanea las hojas como siempre: como la casilla F viene impresa, el
   calificador detecta la forma y aplica la clave correcta.

**Comprobación:** al escanear una hoja de la forma B, el resultado muestra
"Forma 2".

---

## Paso 10 · Copias de seguridad del banco y de las pruebas

El banco y las pruebas viven en el navegador del computador donde los creaste.
Para no perderlos y para tenerlos en GitHub:

1. Pestaña **Guardadas → ⬇️ Exportar todo (banco + pruebas)**. Se descarga
   `respaldo_generador_<fecha>.json`.
2. Para guardarlo en el repositorio: en GitHub, entra en la carpeta `banco/`,
   pulsa **Add file → Upload files**, arrastra el archivo y pulsa **Commit
   changes**.
3. En otro computador (o si borras los datos del navegador): **Guardadas →
   📂 Restaurar una copia** y elige ese archivo.

**Comprobación:** tras restaurar, el banco muestra el mismo número de
preguntas.

---

## Paso 11 (opcional) · Trabajar con el repositorio en tu computador

Solo si quieres editar el código o guardar los respaldos con Git en vez de
subirlos por la web.

1. Instala **GitHub Desktop** (<https://desktop.github.com>) e inicia sesión
   con tu cuenta; o instala Git y usa la terminal.
2. Clona el repositorio: en GitHub Desktop, **File → Clone repository →
   pxjacomex/generador-pruebas**; en terminal:

   ```bash
   git clone https://github.com/pxjacomex/generador-pruebas.git
   ```

3. Para probar cambios antes de subirlos, dentro de la carpeta clonada:

   ```bash
   python3 -m http.server 8000
   ```

   y abre <http://localhost:8000/>.
4. Guarda cambios con un *commit* y súbelos con **Push origin** (GitHub
   Desktop) o `git push`. GitHub Pages se actualiza solo.
