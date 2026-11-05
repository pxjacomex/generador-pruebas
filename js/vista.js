// ============================================================================
// VISTA PREVIA E IMPRESIÓN
// Dibuja las páginas tal como se imprimen (cada prueba ocupa media hoja A4
// horizontal: 210 × 148,5 mm, con la cabecera OMR arriba de la cara 1),
// reparte las preguntas entre las dos caras midiendo el alto real, compone
// las hojas A4 (dos pruebas por hoja) y maneja los botones de imprimir.
// También expone el dibujo de una pregunta (nodoPregunta) que reutilizan el
// editor del banco y el selector de preguntas.
// ============================================================================
'use strict';

const VISTA = {
  prueba: null,        // prueba mostrada (con `formas`)
  cabeceras: {},       // data URL de la cabecera por casilla F (0 = sin marcar)
  escala: 1,
  avisosPaginacion: [],
  caras: {},           // por forma y cara: { libre, numeros, nodos, media } (ver paginarForma)
};

// Geometría de la media hoja (210 × 148,5 mm). Debe coincidir con .cara en el CSS.
const CARA_PAD_TOP_MM = 5;
const CARA_PAD_LADO_MM = 6;
// Cabecera impresa: 206 mm de ancho, centrada. La imagen tiene 3,6 mm de blanco
// a cada lado y 2,1 mm arriba, así que la tinta queda a ≈5,5 mm de los bordes
// laterales del papel y a ≈6,1 mm del superior (nunca dentro de los 5 mm). Su
// borde inferior se mantiene donde quedaba con el ancho anterior (198 mm):
// a CABECERA_FONDO_MM del borde superior de la media hoja.
const CABECERA_ANCHO_MM = 206;
const CABECERA_FONDO_MM = CARA_PAD_TOP_MM + 198 * 23.5 / 210;   // ≈ 27,16 mm
const PX_POR_MM = 96 / 25.4;
const ESPACIO_PASO_MM = 5;   // paso de los botones +/− del espacio en blanco

// Geometría de img/cabecera_v2.png: recorte de la cabecera v2 (x 0..210 mm,
// y 1,0..24,5 mm de la página) a 600 dpi. Casillas F en coordenadas de página
// (templates/generar_cabecera_v2.py): centros (187,1; 5,70) y (193,9; 5,70),
// lado 4 mm.
const CABECERA = {
  src: 'img/cabecera_v2.png',
  ancho_mm: 210, alto_mm: 23.5, y0_mm: 1.0,
  F: { 1: { cx: 187.1, cy: 5.70 }, 2: { cx: 193.9, cy: 5.70 } },
  lado_mm: 4.0,
};

let _cabeceraPromesa = null;
function cargarCabecera() {
  if (!_cabeceraPromesa) {
    _cabeceraPromesa = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo cargar la imagen de la cabecera (img/cabecera_v2.png)'));
      img.src = CABECERA.src;
    });
  }
  return _cabeceraPromesa;
}

// Cabecera con la casilla F pintada (F = 1 o 2); F = 0 → sin marcar.
async function cabeceraConF(F) {
  if (VISTA.cabeceras[F]) return VISTA.cabeceras[F];
  const img = await cargarCabecera();
  if (!F || !CABECERA.F[F]) { VISTA.cabeceras[F] = img.src; return img.src; }
  try {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const pxPorMm = img.naturalWidth / CABECERA.ancho_mm;
    const f = CABECERA.F[F];
    const lado = CABECERA.lado_mm * pxPorMm;
    ctx.fillStyle = '#000';
    ctx.fillRect(f.cx * pxPorMm - lado / 2, (f.cy - CABECERA.y0_mm) * pxPorMm - lado / 2, lado, lado);
    const url = c.toDataURL('image/png');
    VISTA.cabeceras[F] = url;
    return url;
  } catch (e) {
    // Lienzo "contaminado" (p. ej. abriendo el archivo con file://): se usa la
    // cabecera sin marcar y un cuadro negro superpuesto (ver .marca-f en CSS).
    console.warn('Cabecera sin canvas:', e);
    VISTA.cabeceras[F] = img.src;
    return img.src;
  }
}

// ============================================
// DIBUJO DE UNA PREGUNTA (compartido)
// ============================================
function el(tag, clase, html) {
  const n = document.createElement(tag);
  if (clase) n.className = clase;
  if (html != null) n.innerHTML = html;
  return n;
}

function crearImagenPregunta(imagen) {
  const img = document.createElement('img');
  img.src = imagen.datos;
  img.alt = '';
  img.style.width = imagen.ancho_mm + 'mm';
  if (imagen.ancho_px && imagen.alto_px) {
    img.style.height = (imagen.ancho_mm * imagen.alto_px / imagen.ancho_px) + 'mm';
  }
  return img;
}

// Según el largo de las opciones: 4 por fila, 2 por fila o una por línea.
function distribucionOpciones(opciones) {
  const max = Math.max(0, ...opciones.map((o) => (o.plano != null ? o.plano : textoPlano(o.texto)).length));
  if (max <= 14) return 'fila';
  if (max <= 48) return 'cuadricula';
  return 'lista';
}

// item: { numero, enunciado, opciones: [{ texto, correcta }] }
// imagen: la de la pregunta (o null). opts.marcarCorrecta resalta la correcta.
function nodoPregunta(item, imagen, opts) {
  opts = opts || {};
  const div = el('div', 'pregunta');
  div.dataset.numero = item.numero;
  if (imagen && imagen.datos && imagen.posicion !== 'abajo') {
    const img = crearImagenPregunta(imagen);
    img.classList.add('fig-der');
    div.appendChild(img);
  }
  const enun = el('div', 'enunciado');
  enun.innerHTML = `<span class="num">${item.numero}.</span> ${textoEnriquecido(item.enunciado)}`;
  div.appendChild(enun);
  if (imagen && imagen.datos && imagen.posicion === 'abajo') {
    const fig = el('div', 'fig-abajo');
    fig.appendChild(crearImagenPregunta(imagen));
    div.appendChild(fig);
  }
  const ops = el('div', 'opciones ' + distribucionOpciones(item.opciones));
  item.opciones.forEach((o, i) => {
    const d = el('div', 'opcion' + (opts.marcarCorrecta && o.correcta ? ' correcta' : ''));
    d.innerHTML = `<span class="letra">${MODELO.LETRAS[i] || '?'})</span> <span class="txt">${textoEnriquecido(o.texto)}</span>`;
    ops.appendChild(d);
  });
  div.appendChild(ops);
  div.appendChild(el('div', 'limpiar'));
  return div;
}

// Monta un nodo de pregunta en un "papel" de vista previa (editor y modal).
// Con anchoReal, el interior mide lo mismo que el área impresa (198 mm) y se
// reduce con transform para que quepa: las líneas se cortan igual que en la
// hoja. Sin anchoReal (panel estrecho del editor) ocupa el ancho disponible
// con la letra a tamaño legible.
const PAPEL_ANCHO_MM = 198;
function montarPapel(papel, nodo, fuentePt, anchoReal) {
  papel.innerHTML = '';
  const interior = el('div', 'papel-interior' + (anchoReal ? ' real' : ''));
  if (anchoReal) interior.style.width = PAPEL_ANCHO_MM + 'mm';
  interior.style.fontSize = (fuentePt || 10) + 'pt';
  interior.appendChild(nodo);
  papel.appendChild(interior);
  papel.style.height = '';
  if (anchoReal) {
    ajustarPapel(papel);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ajustarPapel(papel)).catch(() => {});
  }
}

function ajustarPapel(papel) {
  const interior = papel.firstElementChild;
  if (!interior || !interior.classList.contains('real') || !papel.clientWidth) return;
  const estilo = getComputedStyle(papel);
  const disponible = papel.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
  const escala = Math.min(1, disponible / interior.offsetWidth);
  interior.style.transform = `scale(${escala})`;
  papel.style.height = (interior.offsetHeight * escala + parseFloat(estilo.paddingTop) + parseFloat(estilo.paddingBottom)) + 'px';
}

function ajustarPapelesVisibles() {
  document.querySelectorAll('.papel').forEach((p) => { if (p.offsetParent) ajustarPapel(p); });
}

// ============================================
// PÁGINAS
// ============================================
function tituloPrueba(prueba) {
  return prueba.titulo.trim() || 'Prueba';
}

// Media hoja (210 × 148,5 mm). cara = 1 (con cabecera OMR) o 2 (dorso).
function construirMedia(prueba, forma, cara, cabeceraURL) {
  const media = el('div', `media forma-${forma.letra} cara-${cara}`);
  const caraEl = el('div', 'cara');
  caraEl.style.fontSize = prueba.opciones.fuente_pt + 'pt';
  media.appendChild(caraEl);

  if (cara === 1) {
    const cab = el('div', 'cabecera-omr');
    const anchoCab = CABECERA_ANCHO_MM;
    const altoCab = anchoCab * CABECERA.alto_mm / CABECERA.ancho_mm;
    cab.style.width = anchoCab + 'mm';
    // Se sale del área de márgenes (hacia arriba y a los lados) con márgenes
    // negativos; el borde inferior queda fijo en CABECERA_FONDO_MM.
    cab.style.marginTop = (CABECERA_FONDO_MM - altoCab - CARA_PAD_TOP_MM) + 'mm';
    const lado = (210 - 2 * CARA_PAD_LADO_MM - anchoCab) / 2;
    cab.style.marginLeft = lado + 'mm';
    cab.style.marginRight = lado + 'mm';
    const img = document.createElement('img');
    img.src = cabeceraURL;
    img.alt = 'Cabecera OMR';
    img.style.width = '100%';
    img.style.height = altoCab + 'mm';
    cab.appendChild(img);
    // Si el lienzo no pudo pintar la F (file://), se superpone un cuadro negro.
    if (prueba.opciones.marcar_F && cabeceraURL && !/^data:/.test(cabeceraURL) && CABECERA.F[forma.F]) {
      const f = CABECERA.F[forma.F];
      const m = el('div', 'marca-f');
      m.style.left = ((f.cx - CABECERA.lado_mm / 2) / CABECERA.ancho_mm * 100) + '%';
      m.style.top = ((f.cy - CABECERA.y0_mm - CABECERA.lado_mm / 2) / CABECERA.alto_mm * 100) + '%';
      m.style.width = (CABECERA.lado_mm / CABECERA.ancho_mm * 100) + '%';
      m.style.height = (CABECERA.lado_mm / CABECERA.alto_mm * 100) + '%';
      cab.appendChild(m);
    }
    caraEl.appendChild(cab);
    // Las preguntas empiezan justo bajo la cabecera (y las instrucciones, si
    // las hay). La forma se distingue por la casilla F impresa.
    if (prueba.instrucciones.trim()) {
      caraEl.appendChild(el('div', 'instrucciones', textoEnriquecido(prueba.instrucciones.trim())));
    }
  } else if (prueba.opciones.mostrar_nombre_cara2) {
    caraEl.appendChild(el('div', 'linea-nombre', '<span>Nombre:</span><span class="linea"></span>'));
  }
  caraEl.appendChild(el('div', 'cuerpo'));
  return media;
}

function desborda(media) {
  const cara = media.firstElementChild;
  return cara.scrollHeight > cara.clientHeight + 1;
}

// Espacio libre bajo las preguntas de una cara, en px (negativo si desborda).
function espacioLibre(media) {
  const cara = media.firstElementChild;
  const cuerpo = cara.querySelector('.cuerpo');
  const est = getComputedStyle(cara);
  return cara.clientHeight - parseFloat(est.paddingBottom) - (cuerpo.offsetTop + cuerpo.offsetHeight);
}

// Reparte las preguntas de una forma entre sus dos caras.
//  - "Distribuir en dos caras" (por defecto): se elige el corte que deja un
//    espacio por pregunta parecido en ambas caras y el blanco sobrante se
//    reparte por igual tras cada pregunta (padding inferior).
//  - Si no: se llena la cara 1 y el resto pasa a la cara 2.
//  - preguntas_cara1 fija el corte a mano en ambos casos.
function paginarForma(prueba, forma, media1, media2) {
  const avisos = [];
  const snapshot = prueba.formas.snapshot || {};
  const nodos = forma.items.map((it) => nodoPregunta(it, (snapshot[it.preguntaId] || {}).imagen, {}));
  const c1 = media1.querySelector('.cuerpo');
  const c2 = media2.querySelector('.cuerpo');
  const n = nodos.length;
  const pref = prueba.opciones.preguntas_cara1;
  const automatico = pref === 'auto' || pref == null || pref === '';
  const distribuir = prueba.opciones.distribuir_dos_caras !== false;

  const repartir = (k) => nodos.forEach((nd, i) => { nd.style.paddingBottom = ''; (i < k ? c1 : c2).appendChild(nd); });

  let k = null;
  if (forma.corte != null) {                    // corte fijado a mano en el panel (arrastre / ⇅)
    k = clamp(parseInt(forma.corte, 10) || 0, 0, n);
    repartir(k);
  } else if (!automatico) {
    k = clamp(parseInt(pref, 10) || 0, 0, n);
    repartir(k);
  } else if (distribuir && n >= 2) {
    let mejor = null;
    for (let cand = 1; cand <= n - 1; cand++) {
      repartir(cand);
      const l1 = espacioLibre(media1), l2 = espacioLibre(media2);
      if (l1 < 0 || l2 < 0) continue;
      const dif = Math.abs(l1 / cand - l2 / (n - cand));
      if (!mejor || dif < mejor.dif) mejor = { k: cand, dif };
    }
    if (mejor) { k = mejor.k; repartir(k); }
  }
  if (k == null) {
    repartir(n);
    while (desborda(media1) && c1.children.length > 1) c2.insertBefore(c1.lastElementChild, c2.firstChild);
  }
  if (desborda(media1)) avisos.push(`Forma ${forma.letra}: la cara 1 no cabe (reduce la letra o el ancho de las imágenes, o pasa preguntas a la cara 2).`);
  if (desborda(media2)) avisos.push(`Forma ${forma.letra}: la cara 2 no cabe (reduce la letra o el ancho de las imágenes).`);

  // Espacio en blanco tras cada pregunta (solo si todo cabe: si una cara
  // desborda, se deja el reparto natural para que se vea el problema).
  const registro = (VISTA.caras[forma.letra] = {});
  [[media1, c1, 1], [media2, c2, 2]].forEach(([media, cuerpo, cara]) => {
    const nodosCara = Array.from(cuerpo.children);
    const numeros = nodosCara.map((nd) => parseInt(nd.dataset.numero, 10));
    registro[cara] = {
      media,
      nodos: nodosCara,
      numeros,
      ids: numeros.map((num) => forma.items.find((it) => it.numero === num).preguntaId),
      libre: (distribuir && avisos.length === 0) ? Math.max(0, espacioLibre(media) - 1) : 0,
    };
  });
  aplicarEspacios(prueba, forma.letra);
  return avisos;
}

// ============================================
// ESPACIO EN BLANCO TRAS CADA PREGUNTA
// ============================================
// El espacio libre de cada cara se reparte entre sus preguntas según
// prueba.espacios[forma][preguntaId] = { frac, bloqueado }: `frac` es la parte
// del espacio libre (las de una cara suman 1; por defecto, iguales) y
// `bloqueado` hace que la pregunta no cambie cuando se ajusta otra. Se guarda
// por id de pregunta, así el espacio acompaña a la pregunta si se reordena, y
// en fracciones, así el reparto sigue valiendo si cambia la letra o el equipo.
function fraccionesDeCara(prueba, letra, cara) {
  const reg = VISTA.caras[letra] && VISTA.caras[letra][cara];
  if (!reg || !reg.ids.length) return [];
  const m = reg.ids.length;
  prueba.espacios = prueba.espacios || {};
  const porForma = (prueba.espacios[letra] = prueba.espacios[letra] || {});
  let fr = reg.ids.map((id) => (porForma[id] && typeof porForma[id].frac === 'number' && porForma[id].frac >= 0) ? porForma[id].frac : NaN);
  const suma = fr.reduce((a, b) => a + b, 0);
  if (fr.some(isNaN) || !(suma > 0)) fr = fr.map(() => 1 / m);
  else if (Math.abs(suma - 1) > 1e-6) fr = fr.map((f) => f / suma);
  reg.ids.forEach((id, i) => { porForma[id] = { frac: fr[i], bloqueado: !!(porForma[id] && porForma[id].bloqueado) }; });
  return fr;
}

// Pruebas guardadas antes: espacios por número de pregunta → por id.
function migrarEspacios(prueba) {
  if (!prueba.formas || !prueba.espacios) return;
  ['A', 'B'].forEach((letra) => {
    const porForma = prueba.espacios[letra];
    const forma = prueba.formas[letra];
    if (!porForma || !forma) return;
    const nuevo = {};
    let cambiado = false;
    Object.keys(porForma).forEach((k) => {
      if (/^\d+$/.test(k)) {
        const it = forma.items.find((x) => x.numero === parseInt(k, 10));
        if (it) nuevo[it.preguntaId] = porForma[k];
        cambiado = true;
      } else nuevo[k] = porForma[k];
    });
    if (cambiado) prueba.espacios[letra] = nuevo;
  });
}

function aplicarEspacios(prueba, letra) {
  [1, 2].forEach((cara) => {
    const reg = VISTA.caras[letra] && VISTA.caras[letra][cara];
    if (!reg) return;
    const fr = fraccionesDeCara(prueba, letra, cara);
    reg.nodos.forEach((nd, i) => { nd.style.paddingBottom = reg.libre > 0 ? (fr[i] * reg.libre) + 'px' : ''; });
  });
}

function caraDePregunta(letra, id) {
  const r = VISTA.caras[letra] || {};
  return (r[1] && r[1].ids.includes(id)) ? 1 : 2;
}

// Botones +/−: mueve ESPACIO_PASO_MM hacia (dir > 0) o desde (dir < 0) la
// pregunta `id`; la diferencia la absorben por igual las demás preguntas no
// bloqueadas de la misma cara (sin bajar de cero).
async function vistaEspacio(letra, id, dir) {
  const prueba = VISTA.prueba;
  if (!prueba) return;
  const cara = caraDePregunta(letra, id);
  const reg = VISTA.caras[letra] && VISTA.caras[letra][cara];
  if (!reg || reg.libre <= 0) return;
  const fr = fraccionesDeCara(prueba, letra, cara);
  const est = prueba.espacios[letra];
  const k = reg.ids.indexOf(id);
  if (k < 0) return;
  const absorbentes = reg.ids.map((_, i) => i).filter((i) => i !== k && !est[reg.ids[i]].bloqueado);
  if (!absorbentes.length) { toast('Desbloquea otra pregunta de esta cara para poder mover el espacio', 'warn'); return; }
  const paso = ESPACIO_PASO_MM * PX_POR_MM / reg.libre;
  let delta;
  if (dir > 0) delta = Math.min(paso, absorbentes.reduce((a, i) => a + fr[i], 0));
  else delta = -Math.min(paso, fr[k]);
  if (Math.abs(delta) < 1e-6) {
    toast(dir > 0 ? 'Las demás preguntas de esta cara ya no tienen espacio que ceder' : 'Este espacio ya está en cero', 'warn');
    return;
  }
  fr[k] += delta;
  let resto = -delta;                 // lo que deben absorber las demás
  let pendientes = absorbentes.slice();
  while (Math.abs(resto) > 1e-9 && pendientes.length) {
    const parte = resto / pendientes.length;
    const siguientes = [];
    pendientes.forEach((i) => {
      if (fr[i] + parte < 0) { resto += fr[i]; fr[i] = 0; }   // cede todo lo que tiene
      else { fr[i] += parte; resto -= parte; siguientes.push(i); }
    });
    pendientes = siguientes;
  }
  reg.ids.forEach((pid, i) => { est[pid].frac = Math.max(0, fr[i]); });
  aplicarEspacios(prueba, letra);
  vistaRenderPaneles();
  prueba.modificada = ahoraISO();
  await guardarPruebaSilenciosa(prueba);
}

async function vistaBloquear(letra, id, valor) {
  const prueba = VISTA.prueba;
  if (!prueba) return;
  fraccionesDeCara(prueba, letra, caraDePregunta(letra, id));
  prueba.espacios[letra][id].bloqueado = !!valor;
  prueba.modificada = ahoraISO();
  await guardarPruebaSilenciosa(prueba);
}

// Vuelve al reparto igual (y desbloquea) en una cara.
async function vistaIgualar(letra, cara) {
  const prueba = VISTA.prueba;
  const reg = VISTA.caras[letra] && VISTA.caras[letra][cara];
  if (!prueba || !reg) return;
  prueba.espacios = prueba.espacios || {};
  const porForma = (prueba.espacios[letra] = prueba.espacios[letra] || {});
  reg.ids.forEach((id) => { porForma[id] = { frac: 1 / reg.ids.length, bloqueado: false }; });
  aplicarEspacios(prueba, letra);
  vistaRenderPaneles();
  prueba.modificada = ahoraISO();
  await guardarPruebaSilenciosa(prueba);
}

// ============================================
// ORDEN DE LAS PREGUNTAS Y CARA DE CADA UNA
// ============================================
// forma.items es el orden impreso (numero 1..n) y forma.corte, si no es null,
// cuántas van en la cara 1 (fijado al arrastrar o con ⇅). Al reordenar se
// renumeran las preguntas y se recalcula la clave de la forma.
function listasDeForma(letra) {
  const r = VISTA.caras[letra] || {};
  return { 1: r[1] ? r[1].ids.slice() : [], 2: r[2] ? r[2].ids.slice() : [] };
}

async function aplicarOrden(letra, listas) {
  const prueba = VISTA.prueba;
  const forma = prueba.formas[letra];
  const orden = listas[1].concat(listas[2]);
  if (orden.length !== forma.items.length) return;
  forma.items = orden.map((id, i) => Object.assign(forma.items.find((it) => it.preguntaId === id), { numero: i + 1 }));
  forma.clave = forma.items.map((it) => it.correcta);
  forma.corte = listas[1].length;
  prueba.modificada = ahoraISO();
  await guardarPruebaSilenciosa(prueba);
  vistaRenderClaves();
  await vistaRenderizar();
}

// Coloca la pregunta `id` en la cara `caraDestino` en la posición `indice`
// (índice contado sin la propia pregunta).
async function vistaReordenar(letra, id, caraDestino, indice) {
  const listas = listasDeForma(letra);
  [1, 2].forEach((c) => { const i = listas[c].indexOf(id); if (i >= 0) listas[c].splice(i, 1); });
  indice = clamp(indice, 0, listas[caraDestino].length);
  listas[caraDestino].splice(indice, 0, id);
  await aplicarOrden(letra, listas);
}

// ▲ / ▼ dentro de su cara.
async function vistaMoverFila(letra, id, delta) {
  const listas = listasDeForma(letra);
  const cara = caraDePregunta(letra, id);
  const i = listas[cara].indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= listas[cara].length) return;
  [listas[cara][i], listas[cara][j]] = [listas[cara][j], listas[cara][i]];
  await aplicarOrden(letra, listas);
}

// ⇅: pasa a la otra cara de la misma forma (de la cara 1 al principio de la
// cara 2; de la cara 2 al final de la cara 1).
async function vistaCambiarCara(letra, id) {
  const cara = caraDePregunta(letra, id);
  const listas = listasDeForma(letra);
  await vistaReordenar(letra, id, cara === 1 ? 2 : 1, cara === 1 ? 0 : listas[1].length);
}

// Vuelve al reparto automático entre caras de una forma.
async function vistaCorteAutomatico(letra) {
  const prueba = VISTA.prueba;
  if (!prueba) return;
  prueba.formas[letra].corte = null;
  prueba.modificada = ahoraISO();
  await guardarPruebaSilenciosa(prueba);
  await vistaRenderizar();
}

// Panel fijo con las cuatro secciones (Forma A cara 1 y 2, Forma B cara 1 y
// 2): arrastre u ▲ ▼ ⇅ para el orden y la cara, y −/+/🔒 para el espacio.
function vistaRenderPaneles() {
  const lateral = document.getElementById('vistaLateral');
  lateral.innerHTML = '';
  const prueba = VISTA.prueba;
  if (!prueba || !prueba.formas) return;
  const distribuir = prueba.opciones.distribuir_dos_caras !== false;
  const cab = el('div', 'panel-cabecera');
  cab.innerHTML = '<h3>Orden, cara y espacio de cada pregunta</h3><div class="field-note">Arrastra una fila (o usa ▲ ▼ ⇅) para cambiar el orden o pasarla a la otra cara de la misma forma. La numeración y las claves se recalculan.</div>';
  lateral.appendChild(cab);
  ['A', 'B'].forEach((letra) => {
    const forma = prueba.formas[letra];
    [1, 2].forEach((cara) => {
      const reg = VISTA.caras[letra] && VISTA.caras[letra][cara];
      const seccion = el('div', 'panel-espacios');
      const ids = reg ? reg.ids : [];
      const conEspacio = distribuir && reg && reg.libre > 0 && ids.length > 0;
      const fr = conEspacio ? fraccionesDeCara(prueba, letra, cara) : [];
      const est = (prueba.espacios && prueba.espacios[letra]) || {};
      const filas = ids.map((id, i) => {
        const it = forma.items.find((x) => x.preguntaId === id);
        const resumen = escapeHtml(recortar(textoPlano(it.enunciado), 48));
        const espacio = conEspacio ? `
          <span class="espacio">
            <button type="button" class="btn-x" title="Menos espacio (${ESPACIO_PASO_MM} mm)" onclick="vistaEspacio('${letra}', '${id}', -1)">−</button>
            <span class="mm">${Math.round(fr[i] * reg.libre / PX_POR_MM)} mm</span>
            <button type="button" class="btn-x" title="Más espacio (${ESPACIO_PASO_MM} mm)" onclick="vistaEspacio('${letra}', '${id}', 1)">+</button>
            <label title="Bloquear: este espacio no cambia cuando ajustas otras preguntas"><input type="checkbox" ${est[id] && est[id].bloqueado ? 'checked' : ''} onchange="vistaBloquear('${letra}', '${id}', this.checked)">🔒</label>
          </span>` : '';
        return `
          <div class="fila-orden" draggable="true" data-forma="${letra}" data-id="${id}" title="${resumen}">
            <span class="asa" title="Arrastra para cambiar el orden o la cara">⋮⋮</span>
            <span class="n">${it.numero}</span>
            <span class="txt">${resumen}</span>
            <span class="mover">
              <button type="button" class="btn-x" title="Subir" onclick="vistaMoverFila('${letra}', '${id}', -1)" ${i === 0 ? 'disabled' : ''}>▲</button>
              <button type="button" class="btn-x" title="Bajar" onclick="vistaMoverFila('${letra}', '${id}', 1)" ${i === ids.length - 1 ? 'disabled' : ''}>▼</button>
              <button type="button" class="btn-x" title="Pasar a la cara ${cara === 1 ? 2 : 1} de la forma ${letra}" onclick="vistaCambiarCara('${letra}', '${id}')">⇅</button>
            </span>
            ${espacio}
          </div>`;
      }).join('');
      let nota = '';
      if (!distribuir) nota = '<div class="field-note">Activa "Distribuir en dos caras" para ajustar el espacio en blanco.</div>';
      else if (reg && ids.length && reg.libre <= 0) nota = '<div class="field-note">Esta cara no tiene espacio libre que repartir.</div>';
      const acciones = (conEspacio ? ` <button type="button" class="btn-x" title="Repartir el espacio por igual y desbloquear" onclick="vistaIgualar('${letra}', ${cara})">⟲</button>` : '')
        + (forma.corte != null && cara === 1 ? ` <button type="button" class="btn-x ancho" title="Volver al reparto automático entre caras" onclick="vistaCorteAutomatico('${letra}')">auto</button>` : '');
      seccion.innerHTML = `<h3><span>Forma ${letra} · cara ${cara} <small>${cara === 1 ? 'frente' : 'dorso'}</small></span><span>${acciones}</span></h3>`
        + `<div class="lista-orden" data-forma="${letra}" data-cara="${cara}">${filas || '<div class="lista-vacia">Sin preguntas: arrastra aquí</div>'}</div>${nota}`;
      lateral.appendChild(seccion);
    });
  });
}

// ---- Arrastrar y soltar (delegado en #vistaLateral) ----
VISTA.arrastre = null;
function indiceDeSoltado(lista, y) {
  const filas = Array.from(lista.querySelectorAll('.fila-orden:not(.arrastrando)'));
  for (let i = 0; i < filas.length; i++) {
    const r = filas[i].getBoundingClientRect();
    if (y < r.top + r.height / 2) return i;
  }
  return filas.length;
}
function quitarIndicador() {
  document.querySelectorAll('#vistaLateral .indicador-soltar').forEach((n) => n.remove());
  document.querySelectorAll('#vistaLateral .lista-orden.destino').forEach((n) => n.classList.remove('destino'));
}
function vistaInicializarArrastre() {
  const lateral = document.getElementById('vistaLateral');
  if (!lateral) return;
  lateral.addEventListener('dragstart', (e) => {
    const fila = e.target.closest && e.target.closest('.fila-orden');
    if (!fila) return;
    VISTA.arrastre = { letra: fila.dataset.forma, id: fila.dataset.id };
    fila.classList.add('arrastrando');
    try { e.dataTransfer.setData('text/plain', fila.dataset.id); e.dataTransfer.effectAllowed = 'move'; } catch (_) {}
  });
  lateral.addEventListener('dragover', (e) => {
    const lista = e.target.closest && e.target.closest('.lista-orden');
    if (!lista || !VISTA.arrastre || lista.dataset.forma !== VISTA.arrastre.letra) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    quitarIndicador();
    lista.classList.add('destino');
    const idx = indiceDeSoltado(lista, e.clientY);
    const filas = Array.from(lista.querySelectorAll('.fila-orden:not(.arrastrando)'));
    const ind = el('div', 'indicador-soltar');
    if (idx < filas.length) lista.insertBefore(ind, filas[idx]); else lista.appendChild(ind);
  });
  lateral.addEventListener('dragleave', (e) => {
    const lista = e.target.closest && e.target.closest('.lista-orden');
    if (lista && !lista.contains(e.relatedTarget)) quitarIndicador();
  });
  lateral.addEventListener('drop', async (e) => {
    const lista = e.target.closest && e.target.closest('.lista-orden');
    if (!lista || !VISTA.arrastre || lista.dataset.forma !== VISTA.arrastre.letra) { quitarIndicador(); return; }
    e.preventDefault();
    const idx = indiceDeSoltado(lista, e.clientY);
    const { letra, id } = VISTA.arrastre;
    VISTA.arrastre = null;
    quitarIndicador();
    await vistaReordenar(letra, id, parseInt(lista.dataset.cara, 10), idx);
  });
  lateral.addEventListener('dragend', () => {
    VISTA.arrastre = null;
    quitarIndicador();
    document.querySelectorAll('#vistaLateral .arrastrando').forEach((n) => n.classList.remove('arrastrando'));
  });
}
document.addEventListener('DOMContentLoaded', vistaInicializarArrastre);

function lineaCorte() {
  return el('div', 'linea-corte', '<span>✂</span>');
}

function esperarImagenes(raiz) {
  const imgs = Array.from(raiz.querySelectorAll('img'));
  return Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())));
}

// Dibuja la prueba actual en #hojas. Debe llamarse con la pestaña visible
// (si está oculta no se pueden medir las alturas).
async function vistaRenderizar() {
  const prueba = VISTA.prueba;
  const hojas = document.getElementById('hojas');
  hojas.innerHTML = '';
  VISTA.caras = {};
  document.getElementById('vistaLateral').innerHTML = '';
  if (!prueba || !prueba.formas) return;
  const op = prueba.opciones;
  const [urlA, urlB] = await Promise.all([
    cabeceraConF(op.marcar_F ? prueba.formas.A.F : 0),
    cabeceraConF(op.marcar_F ? prueba.formas.B.F : 0),
  ]);
  const A1 = construirMedia(prueba, prueba.formas.A, 1, urlA);
  const A2 = construirMedia(prueba, prueba.formas.A, 2, urlA);
  const B1 = construirMedia(prueba, prueba.formas.B, 1, urlB);
  const B2 = construirMedia(prueba, prueba.formas.B, 2, urlB);

  if (op.disposicion === 'a5') {
    [[A1, 1], [A2, 2], [B1, 1], [B2, 2]].forEach(([m, cara]) => {
      const h = el('div', `hoja a5 cara-${cara}`);
      h.appendChild(m);
      hojas.appendChild(h);
    });
  } else {
    const h1 = el('div', 'hoja a4 cara-1');
    h1.appendChild(A1); h1.appendChild(lineaCorte()); h1.appendChild(B1);
    const h2 = el('div', 'hoja a4 cara-2');
    const [arriba, abajo] = op.invertir_dorso ? [B2, A2] : [A2, B2];
    h2.appendChild(arriba); h2.appendChild(lineaCorte()); h2.appendChild(abajo);
    hojas.appendChild(h1); hojas.appendChild(h2);
  }
  // Etiquetas de cada hoja (solo pantalla)
  Array.from(hojas.children).forEach((h, i) => {
    const et = el('div', 'etiqueta-hoja');
    if (op.disposicion === 'a5') {
      const m = h.firstElementChild;
      et.textContent = `Página ${i + 1} · Forma ${m.classList.contains('forma-A') ? 'A' : 'B'} · ${m.classList.contains('cara-1') ? 'cara 1 (frente)' : 'cara 2 (dorso)'}`;
    } else {
      et.textContent = i === 0 ? 'Hoja A4 · cara 1 (frente): arriba Forma A, abajo Forma B'
        : `Hoja A4 · cara 2 (dorso): arriba Forma ${op.invertir_dorso ? 'B' : 'A'}, abajo Forma ${op.invertir_dorso ? 'A' : 'B'}`;
    }
    h.insertBefore(et, h.firstChild);
  });

  await esperarImagenes(hojas);
  void hojas.offsetHeight;             // fuerza el layout: arranca la carga de fuentes de KaTeX
  if (document.fonts && document.fonts.ready) await document.fonts.ready.catch(() => {});
  VISTA.avisosPaginacion = [].concat(
    paginarForma(prueba, prueba.formas.A, A1, A2),
    paginarForma(prueba, prueba.formas.B, B1, B2),
  );
  vistaAjustarEscala();
  vistaRenderAvisos();
  vistaRenderPaneles();
}

function vistaAjustarEscala() {
  const wrap = document.getElementById('hojasWrap');
  const hojas = document.getElementById('hojas');
  if (!hojas.firstElementChild) { wrap.style.height = ''; return; }
  const anchoHoja = hojas.firstElementChild.offsetWidth;
  const escala = Math.min(1, (wrap.clientWidth - 4) / anchoHoja);
  VISTA.escala = escala;
  hojas.style.transform = `scale(${escala})`;
  wrap.style.height = Math.ceil(hojas.offsetHeight * escala) + 'px';
}

function vistaRenderAvisos() {
  const cont = document.getElementById('vistaAvisos');
  const prueba = VISTA.prueba;
  const lista = [];
  if (prueba && prueba.formas) {
    (prueba.formas.avisos || []).forEach((a) => lista.push({ tipo: 'warn', texto: a }));
    if (prueba.formas.A.items.length !== MODELO.N_PREGUNTAS) {
      lista.push({ tipo: 'warn', texto: `La prueba tiene ${prueba.formas.A.items.length} preguntas; el Calificador OMR lee ${MODELO.N_PREGUNTAS} (P1 a P5).` });
    }
  }
  if (prueba && prueba.formas) {
    prueba.formas.A.items.forEach((ia, i) => {
      const ib = prueba.formas.B.items[i];
      if (ib && ib.preguntaId === ia.preguntaId) lista.push({ tipo: 'warn', texto: `La pregunta ${i + 1} es la misma en las dos formas ("${recortar(textoPlano(ia.enunciado), 40)}"): conviene moverla en una de ellas.` });
    });
  }
  VISTA.avisosPaginacion.forEach((a) => lista.push({ tipo: 'error', texto: a }));
  cont.innerHTML = lista.map((a) => `<div class="aviso-item ${a.tipo}">${escapeHtml(a.texto)}</div>`).join('');
  cont.classList.toggle('hidden', lista.length === 0);
}

// ============================================
// CLAVES
// ============================================
function vistaRenderClaves() {
  const prueba = VISTA.prueba;
  const cont = document.getElementById('vistaClaves');
  if (!prueba || !prueba.formas) { cont.innerHTML = ''; return; }
  const { A, B, snapshot } = prueba.formas;
  const filas = A.items.map((_, i) => {
    const a = A.items[i], b = B.items[i];
    const desc = (it) => {
      const set = it.setIndice != null ? ` · set ${it.setIndice + 1}` : '';
      return `<span class="clave-letra">${it.correcta}</span> <span class="clave-desc">${textoEnriquecido(recortar(String(it.enunciado).replace(/\s+/g, ' ').trim(), 70))}${set}</span>`;
    };
    return `<tr><td>${i + 1}</td><td>${desc(a)}</td><td>${desc(b)}</td></tr>`;
  }).join('');
  const encabezado = [tituloPrueba(prueba), prueba.curso.trim(), prueba.fecha.trim()].filter(Boolean).map(escapeHtml).join(' · ');
  cont.innerHTML = `
    <div class="claves-resumen">
      <div class="claves-prueba">${encabezado}</div>
      <div><b>Forma A</b> (casilla F = ${A.F}): <code>${escapeHtml(claveTexto(A))}</code></div>
      <div><b>Forma B</b> (casilla F = ${B.F}): <code>${escapeHtml(claveTexto(B))}</code></div>
      <div class="field-note">En el Calificador OMR, pestaña Clave: "Formato 1" es la Forma A y "Formato 2" la Forma B. Si la casilla F va impresa ya marcada, el calificador elige la clave solo.</div>
    </div>
    <div class="table-wrap"><table class="tabla-claves">
      <thead><tr><th>#</th><th>Forma A</th><th>Forma B</th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>`;
}

// ============================================
// CONTROL DE LA PESTAÑA
// ============================================
async function vistaMostrar(prueba) {
  VISTA.prueba = prueba;
  const vacia = document.getElementById('vistaVacia');
  const cont = document.getElementById('vistaContenido');
  const hay = !!(prueba && prueba.formas);
  vacia.classList.toggle('hidden', hay);
  cont.classList.toggle('hidden', !hay);
  if (!hay) { document.getElementById('hojas').innerHTML = ''; return; }
  migrarEspacios(prueba);
  document.getElementById('vistaTitulo').textContent = tituloPrueba(prueba) + (prueba.curso ? ' · ' + prueba.curso : '');
  document.getElementById('vistaMeta').textContent = `Generada el ${fechaCorta(prueba.formas.generada)} · semilla ${prueba.formas.semilla}`;
  const op = prueba.opciones;
  document.getElementById('vistaDisposicion').value = op.disposicion || 'a4';
  document.getElementById('vistaInvertir').checked = !!op.invertir_dorso;
  document.getElementById('vistaDistribuir').checked = op.distribuir_dos_caras !== false;
  const selCara = document.getElementById('vistaCara1');
  const n = prueba.formas.A.items.length;
  selCara.innerHTML = '<option value="auto">Automático</option>' + Array.from({ length: n + 1 }, (_, k) => `<option value="${k}">${k} en la cara 1</option>`).join('');
  selCara.value = (op.preguntas_cara1 === 'auto' || op.preguntas_cara1 == null) ? 'auto' : String(op.preguntas_cara1);
  document.getElementById('vistaInvertirWrap').classList.toggle('hidden', op.disposicion === 'a5');
  vistaRenderClaves();
  switchSection('vista');
  await vistaRenderizar();
}

// Cambios en los controles de la vista (se guardan en la prueba).
async function vistaOpcion(nombre, valor) {
  const prueba = VISTA.prueba;
  if (!prueba) return;
  prueba.opciones[nombre] = valor;
  if (nombre === 'preguntas_cara1') { prueba.formas.A.corte = null; prueba.formas.B.corte = null; }
  prueba.modificada = ahoraISO();
  document.getElementById('vistaInvertirWrap').classList.toggle('hidden', prueba.opciones.disposicion === 'a5');
  await guardarPruebaSilenciosa(prueba);
  await vistaRenderizar();
}

async function guardarPruebaSilenciosa(prueba) {
  try {
    await bdGuardar(BD_PRUEBAS, prueba);
    if (ARMADO.prueba && ARMADO.prueba.id === prueba.id) {
      ARMADO.prueba.opciones = Object.assign({}, prueba.opciones);
      armarGuardarBorrador();
    }
  } catch (e) { toast('No se pudo guardar la prueba: ' + e.message, 'error'); }
}

function estiloDePagina(disposicion) {
  return disposicion === 'a5'
    ? '@page { size: 210mm 148.5mm; margin: 0; }'
    : '@page { size: A4 portrait; margin: 0; }';
}

// modo: 'todo' | 'cara1' | 'cara2' | 'claves'
function vistaImprimir(modo) {
  const prueba = VISTA.prueba;
  if (!prueba || !prueba.formas) { toast('No hay ninguna prueba para imprimir', 'error'); return; }
  document.getElementById('estiloPagina').textContent = modo === 'claves'
    ? '@page { size: A4 portrait; margin: 15mm; }'
    : estiloDePagina(prueba.opciones.disposicion);
  document.body.classList.remove('imprimir-cara1', 'imprimir-cara2', 'imprimir-claves');
  if (modo === 'cara1') document.body.classList.add('imprimir-cara1');
  if (modo === 'cara2') document.body.classList.add('imprimir-cara2');
  if (modo === 'claves') document.body.classList.add('imprimir-claves');
  const limpiar = () => {
    document.body.classList.remove('imprimir-cara1', 'imprimir-cara2', 'imprimir-claves');
    window.removeEventListener('afterprint', limpiar);
  };
  window.addEventListener('afterprint', limpiar);
  // Pequeña espera para que el navegador aplique las clases antes del diálogo.
  setTimeout(() => window.print(), 50);
}

function vistaExportar() {
  const prueba = VISTA.prueba;
  if (!prueba) return;
  const nombre = `prueba_${nombreArchivoSeguro(prueba.titulo, 'sin_titulo')}_${fechaParaNombre()}.json`;
  descargarArchivo(nombre, JSON.stringify({ tipo: 'prueba-generador-omr', version: 1, exportado: ahoraISO(), prueba }, null, 1), 'application/json');
  toast('Prueba exportada: ' + nombre);
}

function vistaEditar() {
  if (!VISTA.prueba) return;
  armarCargarPrueba(VISTA.prueba);
}

async function vistaRemezclar() {
  const prueba = VISTA.prueba;
  if (!prueba) return;
  try {
    prueba.formas = regenerarFormas(prueba, semillaNueva());
    prueba.espacios = null;
    prueba.modificada = ahoraISO();
    await guardarPruebaSilenciosa(prueba);
    await vistaMostrar(prueba);
    toast('Formas A y B generadas de nuevo');
  } catch (e) {
    toast(e.message, 'error');
  }
}

window.addEventListener('resize', debounce(() => {
  if (document.getElementById('section-vista').classList.contains('active')) vistaAjustarEscala();
  ajustarPapelesVisibles();
}, 150));
