# Formato del banco de preguntas (`banco-generador-omr`, versión 1)

Este es el archivo JSON que importa la pestaña **Banco** del Generador de
pruebas. Hay tres documentos complementarios en esta carpeta:

| Archivo | Para qué |
|---|---|
| `FORMATO_BANCO.md` (este) | Explicación legible de cada campo y reglas de contenido. |
| `banco.schema.json` | Esquema formal (JSON Schema, borrador 07) para validar un archivo o dárselo a una IA. |
| `plantilla_banco.json` | Archivo mínimo válido con una pregunta de cada tipo, para copiar e imitar. |

Al final hay un **bloque de instrucciones listo para pegar** en otro chat
cuando quieras que una IA te genere un banco nuevo.

## 1. Envoltorio

```json
{
 "tipo": "banco-generador-omr",
 "version": 1,
 "exportado": "2026-11-08T12:00:00.000Z",
 "nota": "texto libre opcional",
 "preguntas": [ … ]
}
```

- `tipo` y `version` son fijos. `exportado` es informativo. La app también
  acepta un array de preguntas sin envoltorio, pero conviene incluirlo.
- Codificación UTF-8. Nada de comentarios dentro del JSON.

## 2. Cada pregunta

```json
{
 "id": "q_fuente_02_07_001",
 "tema": "2.7 - Objetos en caída libre",
 "etiqueta": "concepto",
 "tipo": "fija",
 "enunciado": "…",
 "imagen": null,
 "mezclar": true,
 "opciones": [ { "texto": "…", "formula": "", "correcta": true }, { … }, { … }, { … } ],
 "variables": [],
 "sets": [],
 "formato": { "modo": "auto", "decimales": 2, "unidad": "" },
 "creada": "2026-11-08T12:00:00.000Z",
 "modificada": "2026-11-08T12:00:00.000Z"
}
```

| Campo | Obligatorio | Regla |
|---|---|---|
| `id` | sí | Único en todo el banco; solo letras, números, `_ . -`. Al reimportar, el mismo `id` **reemplaza** la pregunta anterior en vez de duplicarla. Recomendado: `q_<fuente>_<cap>_<sub>_<nnn>`, p. ej. `q_serway_02_07_013`. |
| `tema` | sí | Texto con el que se agrupa y filtra. Convención: `"C.S - Título del subcapítulo"`, p. ej. `"1.3 - Análisis dimensional"`. |
| `etiqueta` | no | Texto libre corto (≤ 40). Se ve en las listas, nunca se imprime. |
| `tipo` | sí | `"fija"` (cuatro alternativas de texto) o `"calculo"` (datos variables y fórmulas). |
| `enunciado` | sí | Texto plano, sin HTML. Ver §3. |
| `imagen` | no | `null`, o `{ "datos": "data:image/png;base64,…", "ancho_mm": 55, "posicion": "derecha" }` (`posicion` también `"abajo"`; `ancho_mm` 15–190; PNG, JPEG o SVG). |
| `mezclar` | no | `true` por defecto. `false` mantiene el orden A-D en la impresión ("Todas las anteriores"). |
| `opciones` | sí | **Exactamente 4** objetos `{ texto, formula, correcta }` y **exactamente una** con `"correcta": true`. En tipo `fija`: `texto` lleno y `formula` vacía. En tipo `calculo`: `formula` llena (o `texto` lleno y `formula` vacía para una opción de texto fijo). |
| `variables` | en `calculo` | Nombres usados en `{{…}}` y en las fórmulas: letras, dígitos y `_`, sin espacios (`v`, `t`, `ang`, `m_1`). Vacío en `fija`. |
| `sets` | en `calculo` | Lista de juegos de datos, uno por fila: `{ "v": "12", "t": "5" }`. Los valores van **como texto** (`"2.5"` o `"2,5"`; también palabras). Al menos 2 sets, idealmente 3 o 4, para que las formas A y B lleven datos distintos. Comprueba que en ningún set dos opciones den el mismo valor. |
| `formato` | en `calculo` | `modo`: `"auto"` (hasta N decimales), `"fijo"` (N decimales), `"sig"` (N cifras significativas) o `"exacto"` (fracciones, raíces y π en LaTeX). `decimales`: 0–8. `unidad`: se añade a cada valor, p. ej. `"m/s^{2}"`. |
| `creada`, `modificada` | no | Fechas ISO 8601. |

## 3. Texto de enunciados y opciones

- **LaTeX** entre dólares: `$ax + by = c$` en línea, `$$v = \frac{d}{t}$$` en su
  propia línea. Dentro del JSON cada barra invertida va doblada: `"$\\frac{1}{2} m v^{2}$"`.
  Un dólar literal se escribe `\\$`.
- Fuera de las fórmulas: `^{2}` → superíndice, `_{0}` → subíndice, `**texto**` → negrita, `\n` → salto de línea.
- En tipo `calculo`, cada dato se escribe con **llaves dobles**: `{{v}}`, `{{t}}`,
  también dentro de una fórmula: `$v_0 = {{v}}\\ \\mathrm{m/s}$`. Las llaves
  simples son LaTeX y no se sustituyen.
- Sin HTML ni Markdown aparte de lo anterior.

## 4. Fórmulas de las opciones (tipo `calculo`)

Sintaxis de calculadora, evaluada por la app (no es JavaScript ni LaTeX):

- Operadores `+ - * / ^` y paréntesis; multiplicación implícita `2v`; decimales con punto (`0.5`).
- Variables: las de `variables`, tal cual, sin llaves.
- Constantes: `pi`, `e`, `g` = 9.8 (una variable `g` en el set la sustituye).
- Funciones: `sqrt cbrt abs sign pow hypot min max round(x,n) floor ceil trunc`,
  `sin cos tan asin acos atan atan2` (radianes), `sind cosd tand asind acosd atand` (grados),
  `ln log log10 log2 exp rad deg`, y para resultados exactos `unsimplify(x)`
  (√20 en vez de 2√5), `simplify(x)`, `decimal(x)`.
- Ejemplos: `v*t`, `0.5*m*v^2`, `sqrt(2*h/g)`, `m*10*sind(ang)`, `round(F/m, 1)`.

## 5. Cómo comprobar un archivo

1. Validar contra `banco.schema.json` (cualquier validador JSON Schema).
2. Importarlo en la app (Banco → Importar banco). Las preguntas con problemas
   aparecen con la etiqueta roja **incompleta** (campos vacíos, variables sin
   declarar, fórmula inválida) o amarilla **revisar** (dos opciones con el mismo
   valor en algún set, un solo set). "Ver" muestra cada pregunta tal como se imprime.
3. Como el `id` manda, puedes corregir el archivo y reimportarlo las veces que
   haga falta sin duplicar nada.

## 6. Bloque para pegar en otro chat

Pega lo siguiente junto con el contenido de `banco.schema.json` y de
`plantilla_banco.json` (o adjunta los dos archivos), y añade al final el tema,
el capítulo y la cantidad de preguntas que quieres. Pide la respuesta como un
único bloque de código JSON. Si el banco es grande, pide un archivo por
subcapítulo: la app los fusiona al importarlos uno tras otro.

```text
Genera un banco de preguntas de opción múltiple en el formato JSON
"banco-generador-omr" versión 1 que te adjunto (esquema banco.schema.json y
ejemplo plantilla_banco.json). Reglas obligatorias:

1. Devuelve SOLO un bloque de código JSON válido (UTF-8, sin comentarios), con el
   envoltorio { "tipo": "banco-generador-omr", "version": 1, "exportado": <fecha ISO>,
   "preguntas": [...] }.
2. Cada pregunta tiene exactamente 4 opciones y exactamente una con "correcta": true.
   Reparte la correcta entre A, B, C y D; no la pongas siempre primera.
3. "id" único con el patrón q_<fuente>_<capitulo 2 dígitos>_<subcapitulo 2 dígitos>_<nnn>.
   "tema" con el patrón "C.S - Título del subcapítulo".
4. "tipo": "fija" para preguntas conceptuales (4 textos; "formula": "" en todas;
   "variables": [], "sets": []). "tipo": "calculo" para problemas numéricos:
   el enunciado lleva cada dato como {{nombre}}, "variables" lista esos nombres,
   "sets" trae de 3 a 4 juegos de datos con los valores como texto, y cada opción
   tiene una "formula" (sintaxis de calculadora: + - * / ^, sqrt, sind, cosd, tand,
   pi, g; sin LaTeX ni JavaScript) cuyo resultado sea distinto en todos los sets.
   La correcta es la fórmula correcta; las otras tres son errores típicos.
   "formato": { "modo": "auto", "decimales": 2, "unidad": "<unidad SI>" }.
5. Ecuaciones en LaTeX entre $…$, con las barras dobladas dentro del JSON
   ("$\\vec{F} = m\\vec{a}$"). Sin HTML, sin Markdown, sin imágenes ("imagen": null).
6. Idioma: español neutro; enunciados autocontenidos, de una a tres frases.

Tema, capítulo y cantidad: <escribe aquí qué quieres>.
```
