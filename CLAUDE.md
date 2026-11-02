# Generador de pruebas — guía del proyecto

Página web de una sola pantalla (`index.html` + `css/` + `js/`) que arma
pruebas de alternativas en dos formas (A y B) desde un banco de preguntas y las
imprime con la cabecera del Calificador OMR (repositorio hermano
`pxjacomex/scanner`). Sin backend, sin build, sin `npm` en tiempo de uso: los
archivos se sirven tal cual (GitHub Pages).

La arquitectura, el formato de datos y la geometría de impresión están en
`README.md`; la puesta en marcha y el uso, en `GUIA.md`. Leer ambos antes de
cambiar algo.

## Lineamientos (obligatorios)

1. **Debe funcionar sin internet** después de la primera visita: `sw.js`
   (código propio) precarga todo lo de `ASSETS`. Al añadir o quitar archivos,
   actualizar `ASSETS` y subir `VERSION`.
2. **Sin dependencias nuevas** sin discutirlo antes. Las únicas externas son la
   fuente Outfit (interfaz) y KaTeX, copiado en `vendor/katex/` desde el
   paquete oficial de npm (nunca desde un CDN en tiempo de uso).
3. Pensado para Chrome; se usa sobre todo en computador (se imprime desde ahí)
   y la interfaz también cabe en un teléfono. Tema claro.
4. Interfaz, comentarios y mensajes de commit en **español**.

## Reparto del código

- Scripts clásicos con ámbito global; orden de carga: `vendor/katex` →
  `util` → `formulas` → `almacen` → `modelo` → `vista` → `banco` → `armado` →
  `guardadas` → `app`.
- Variables de los problemas: `{{v}}` (llaves dobles, también dentro de `$…$`);
  `{v}` solo se acepta fuera de las fórmulas por compatibilidad.
- `modelo.js` y `formulas.js` no tocan el DOM. `vista.js` dibuja páginas y
  preguntas (`nodoPregunta`, compartido con el editor y el selector).
- Los datos viven en IndexedDB (`generador-omr`) y el borrador en localStorage;
  nunca en el repositorio, salvo respaldos JSON que el usuario suba a `banco/`.

## Qué no cambiar sin recalibrar

- `img/cabecera_v2.png` y `CABECERA` en `js/vista.js` (posición de las casillas
  F): deben coincidir con la cabecera v2 del calificador.
- Ancho impreso de la cabecera (`CABECERA_ANCHO_MM` = 206 mm, con el borde
  inferior fijo en `CABECERA_FONDO_MM`) y márgenes de `.cara`: la tinta de los
  marcadores debe quedar a ≥ 5 mm del borde del papel (hoy ≈5,5 mm a los lados
  y ≈6,1 mm arriba).

## Probar en local

```bash
python3 -m http.server 8000
# abrir http://localhost:8000/
```

Para revisar la paginación sin impresora: Chrome → Imprimir → Guardar como PDF,
A4, escala 100 %, márgenes "Ninguno".
