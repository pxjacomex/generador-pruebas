// ============================================================================
// MODELO: PREGUNTAS, PRUEBAS Y GENERACIÓN DE LAS FORMAS A Y B
// Estructuras de datos, normalización de lo que se importa, resolución de una
// pregunta con un set de datos (enunciado + opciones calculadas) y el sorteo
// de las dos formas. Sin DOM.
//
// Pregunta del banco:
//   { id, tema, etiqueta (texto libre, solo en listas), tipo: 'fija'|'calculo', enunciado, imagen: null | { datos
//     (data URL), ancho_mm, posicion: 'derecha'|'abajo', ancho_px, alto_px },
//     mezclar: true, opciones: [{ texto, formula, correcta }] (siempre 4),
//     variables: ['v','t'], sets: [{ v: '10', t: '5' }], formato: { modo,
//     decimales, unidad }, creada, modificada }
// Prueba:
//   { id, titulo, curso, fecha, instrucciones, opciones: {...}, items:
//     [{ preguntaId, setA: 'auto'|n, setB: 'auto'|n }], formas: null | {...},
//     creada, modificada }
// ============================================================================
'use strict';

const MODELO = {
  N_PREGUNTAS: 5,                 // lo que lee el Calificador OMR (P1..P5)
  N_OPCIONES: 4,                  // casilleros A, B, C, D
  LETRAS: ['A', 'B', 'C', 'D'],
  FORMAS: [{ letra: 'A', F: 1 }, { letra: 'B', F: 2 }],   // Forma → casilla F
  RE_NOMBRE_VARIABLE: /^[A-Za-z\u00C0-\u024F\u0370-\u03FF_][A-Za-z0-9\u00C0-\u024F\u0370-\u03FF_]*$/,
};

// Texto de instrucciones que traían por defecto las versiones anteriores (se
// vacía al migrar un borrador antiguo).
const INSTRUCCIONES_ANTERIORES = 'Marca en la cabecera, rellenando todo el cuadro, la única alternativa correcta de cada pregunta.';

const OPCIONES_PRUEBA_DEFAULT = {
  v: 4,                     // versión de estos valores por defecto (migración del borrador)
  tipo_prueba: 'control',   // 'control': control de lectura (5 preguntas, media hoja A4 por cara);
                            // 'diez': prueba de 10 preguntas (cabecera de 10, hoja A4 completa por cara)
  fuente_pt: 11,            // tamaño de letra del cuerpo (puntos)
  marcar_F: true,           // imprimir la casilla F ya pintada (A→1, B→2)
  separador: '.',           // separador decimal de los números
  disposicion: 'a4',        // 'a4': dos pruebas por hoja A4; 'a5': páginas sueltas
  invertir_dorso: false,    // intercambiar mitades en la cara 2 (según impresora)
  preguntas_cara1: 'auto',  // 'auto' o número de preguntas en la primera cara
  distribuir_dos_caras: true, // repartir las preguntas en las dos caras con espacio uniforme
  mostrar_nombre_cara2: false, // línea "Nombre" al inicio de la cara 2
};
const FUENTE_PT_MIN = 8, FUENTE_PT_MAX = 18;

// ============================================
// PREGUNTAS
// ============================================
function nuevaPregunta(tipo) {
  const ahora = ahoraISO();
  return {
    id: uid('q'),
    tema: '',
    etiqueta: '',
    tiempo_estimado: null,   // minutos (número) o null si no se indica
    tipo: tipo === 'calculo' ? 'calculo' : 'fija',
    enunciado: '',
    imagen: null,
    mezclar: true,
    opciones: MODELO.LETRAS.map((_, i) => ({ texto: '', formula: '', correcta: i === 0 })),
    variables: tipo === 'calculo' ? ['v', 't'] : [],   // se escriben {{v}} y {{t}} en el enunciado
    sets: tipo === 'calculo' ? [{ v: '', t: '' }, { v: '', t: '' }] : [],
    formato: { modo: 'auto', decimales: 2, unidad: '' },
    creada: ahora,
    modificada: ahora,
  };
}

// Completa campos que falten y descarta basura (para importaciones y
// versiones anteriores). Devuelve null si no parece una pregunta.
function normalizarPregunta(p) {
  if (!p || typeof p !== 'object') return null;
  const base = nuevaPregunta(p.tipo === 'calculo' ? 'calculo' : 'fija');
  const q = Object.assign(base, {
    id: (typeof p.id === 'string' && p.id) ? p.id : base.id,
    tema: String(p.tema || '').trim(),
    etiqueta: String(p.etiqueta || '').trim(),
    tiempo_estimado: (() => { const t = normalizarNumero(p.tiempo_estimado); return (isFinite(t) && t > 0) ? Math.round(t * 100) / 100 : null; })(),
    tipo: p.tipo === 'calculo' ? 'calculo' : 'fija',
    enunciado: String(p.enunciado || ''),
    mezclar: p.mezclar !== false,
    creada: p.creada || base.creada,
    modificada: p.modificada || base.modificada,
  });
  // Opciones: siempre 4
  const ops = Array.isArray(p.opciones) ? p.opciones : [];
  q.opciones = MODELO.LETRAS.map((_, i) => {
    const o = ops[i] || {};
    return { texto: String(o.texto || ''), formula: String(o.formula || ''), correcta: !!o.correcta };
  });
  if (!q.opciones.some((o) => o.correcta)) q.opciones[0].correcta = true;
  else { let vista = false; q.opciones.forEach((o) => { if (o.correcta) { if (vista) o.correcta = false; vista = true; } }); }
  // Variables y sets
  q.variables = (Array.isArray(p.variables) ? p.variables : []).map((v) => String(v).trim()).filter(Boolean);
  q.sets = (Array.isArray(p.sets) ? p.sets : []).filter((s) => s && typeof s === 'object').map((s) => {
    const limpio = {};
    q.variables.forEach((v) => { limpio[v] = s[v] == null ? '' : String(s[v]); });
    return limpio;
  });
  if (q.tipo === 'fija') { q.variables = []; q.sets = []; }
  // Marcador antiguo {v} → {{v}} (solo para las variables declaradas; idempotente)
  if (q.tipo === 'calculo' && q.variables.length) {
    q.enunciado = migrarMarcadores(q.enunciado, q.variables);
    q.opciones.forEach((o) => { o.texto = migrarMarcadores(o.texto, q.variables); });
  }
  // Formato numérico
  const f = p.formato || {};
  q.formato = {
    modo: ['auto', 'fijo', 'sig', 'exacto'].includes(f.modo) ? f.modo : 'auto',
    decimales: clamp(parseInt(f.decimales, 10) || 0, 0, 8),
    unidad: String(f.unidad || ''),
  };
  // Imagen
  if (p.imagen && typeof p.imagen === 'object' && typeof p.imagen.datos === 'string' && /^data:image\//.test(p.imagen.datos)) {
    q.imagen = {
      datos: p.imagen.datos,
      ancho_mm: clamp(parseFloat(p.imagen.ancho_mm) || 55, 15, 190),
      posicion: p.imagen.posicion === 'abajo' ? 'abajo' : 'derecha',
      ancho_px: parseInt(p.imagen.ancho_px, 10) || 0,
      alto_px: parseInt(p.imagen.alto_px, 10) || 0,
    };
  } else {
    q.imagen = null;
  }
  return q;
}

// Errores que impiden usar la pregunta (lista de textos; vacía = válida).
function validarPregunta(p) {
  const errores = [];
  if (!String(p.enunciado || '').trim()) errores.push('El enunciado está vacío.');
  if (p.tipo === 'fija') {
    p.opciones.forEach((o, i) => { if (!String(o.texto || '').trim()) errores.push(`La opción ${MODELO.LETRAS[i]} está vacía.`); });
  } else {
    if (p.variables.length === 0) errores.push('Define al menos una variable.');
    p.variables.forEach((v) => { if (!MODELO.RE_NOMBRE_VARIABLE.test(v)) errores.push(`Nombre de variable no válido: "${v}" (letras, números y _; sin espacios).`); });
    const repetidas = p.variables.filter((v, i) => p.variables.indexOf(v) !== i);
    if (repetidas.length) errores.push('Variables repetidas: ' + repetidas.join(', '));
    if (p.sets.length === 0) errores.push('Añade al menos un set de datos.');
    p.opciones.forEach((o, i) => {
      if (!String(o.formula || '').trim() && !String(o.texto || '').trim()) errores.push(`La opción ${MODELO.LETRAS[i]} no tiene fórmula ni texto.`);
    });
    const faltan = variablesEnTexto(p.enunciado).filter((v) => !p.variables.includes(v));
    if (faltan.length) errores.push('El enunciado usa variables que no existen: ' + faltan.map((v) => '{{' + v + '}}').join(', '));
  }
  if (!p.opciones.some((o) => o.correcta)) errores.push('Marca la opción correcta.');
  return errores;
}

// Resuelve la pregunta con el set indicado:
// → { enunciado, opciones: [{ texto, correcta, error }], setIndice, set,
//     errores: [], advertencias: [] }
function resolverPregunta(p, setIndice, separador) {
  separador = separador || ',';
  const res = { enunciado: p.enunciado, opciones: [], setIndice: null, set: null, errores: [], advertencias: [] };
  if (p.tipo !== 'calculo') {
    res.opciones = p.opciones.map((o) => ({ texto: o.texto, plano: textoPlano(o.texto), correcta: !!o.correcta, error: null }));
  } else {
    const n = p.sets.length;
    const idx = n ? clamp(parseInt(setIndice, 10) || 0, 0, n - 1) : -1;
    const set = idx >= 0 ? p.sets[idx] : {};
    res.setIndice = idx >= 0 ? idx : null;
    res.set = set;
    if (idx < 0) res.errores.push('La pregunta no tiene sets de datos.');
    res.enunciado = sustituirVariables(p.enunciado, set, separador);
    const faltan = variablesEnTexto(res.enunciado);
    if (faltan.length) res.errores.push('Sin valor en este set: ' + faltan.map((v) => '{{' + v + '}}').join(', '));
    res.opciones = p.opciones.map((o, i) => {
      const letra = MODELO.LETRAS[i];
      const formula = String(o.formula || '').trim();
      if (!formula) {
        if (!String(o.texto || '').trim()) res.errores.push(`Opción ${letra}: sin fórmula ni texto.`);
        const t = sustituirVariables(o.texto, set, separador);
        return { texto: t, plano: textoPlano(t), correcta: !!o.correcta, error: null };
      }
      const exacto = p.formato.modo === 'exacto';
      const r = FORMULAS.calcular(formula, set, { exacto });
      if (r.error) {
        res.errores.push(`Opción ${letra} (${formula}): ${r.error}`);
        return { texto: '¿?', plano: '¿?', correcta: !!o.correcta, error: r.error, valor: null };
      }
      let texto, plano;
      if (r.exacto) {
        plano = r.exacto.texto;
        texto = /^-?\d+$/.test(r.exacto.latex) ? r.exacto.latex : '$' + r.exacto.latex + '$';   // fracciones y raíces las dibuja KaTeX
      } else {
        const fmt = exacto ? Object.assign({}, p.formato, { modo: 'auto' }) : p.formato;
        texto = plano = formatearNumero(r.valor, fmt, separador);
        if (exacto && r.avisoExacto) res.advertencias.push(`Opción ${letra}: sin forma exacta (${r.avisoExacto}); se muestra en decimal.`);
      }
      const unidad = String(p.formato.unidad || '').trim();
      if (unidad) { texto += ' ' + unidad; plano += ' ' + unidad; }
      return { texto, plano, correcta: !!o.correcta, error: null, valor: r.valor };
    });
    // Opciones repetidas (mismo valor, o misma cadena si no hay valor): el
    // problema no se puede responder
    const vistos = new Map();
    res.opciones.forEach((o, i) => {
      const k = (typeof o.valor === 'number') ? 'v:' + Number(o.valor.toPrecision(12)) : 't:' + textoPlano(o.texto);
      if (vistos.has(k)) res.advertencias.push(`Las opciones ${MODELO.LETRAS[vistos.get(k)]} y ${MODELO.LETRAS[i]} dan el mismo valor (${o.plano || textoPlano(o.texto)}).`);
      else vistos.set(k, i);
    });
  }
  return res;
}

// Revisión completa (todos los sets) para la lista del banco y el editor.
// → { errores: [...], advertencias: [...] } con el set indicado en cada texto.
function comprobarPregunta(p) {
  const out = { errores: validarPregunta(p), advertencias: [] };
  if (p.tipo === 'calculo') {
    p.sets.forEach((_, i) => {
      const r = resolverPregunta(p, i, ',');
      r.errores.forEach((e) => out.errores.push(`Set ${i + 1}: ${e}`));
      r.advertencias.forEach((a) => out.advertencias.push(`Set ${i + 1}: ${a}`));
    });
    if (p.sets.length < 2) out.advertencias.push('Con un solo set, las formas A y B llevarán los mismos datos.');
  }
  return out;
}

function letraCorrecta(opciones) {
  const i = opciones.findIndex((o) => o.correcta);
  return i >= 0 ? MODELO.LETRAS[i] : '?';
}

// ============================================
// PRUEBAS
// ============================================
function nuevaPrueba() {
  const ahora = ahoraISO();
  return {
    id: uid('p'),
    titulo: '',
    curso: '',
    fecha: '',
    instrucciones: '',
    opciones: Object.assign({}, OPCIONES_PRUEBA_DEFAULT),
    items: [],
    formas: null,
    espacios: null,   // espacio en blanco tras cada pregunta, por forma (ver vista.js)
    creada: ahora,
    modificada: ahora,
  };
}

function normalizarPrueba(p) {
  if (!p || typeof p !== 'object') return null;
  const base = nuevaPrueba();
  const t = Object.assign(base, {
    id: (typeof p.id === 'string' && p.id) ? p.id : base.id,
    titulo: String(p.titulo || ''),
    curso: String(p.curso || ''),
    fecha: String(p.fecha || ''),
    instrucciones: String(p.instrucciones == null ? base.instrucciones : p.instrucciones),
    opciones: Object.assign({}, OPCIONES_PRUEBA_DEFAULT, (p.opciones && typeof p.opciones === 'object') ? p.opciones : {}),
    items: (Array.isArray(p.items) ? p.items : []).filter((it) => it && typeof it.preguntaId === 'string').map((it) => ({
      preguntaId: it.preguntaId,
      setA: it.setA === 'auto' || it.setA == null ? 'auto' : parseInt(it.setA, 10),
      setB: it.setB === 'auto' || it.setB == null ? 'auto' : parseInt(it.setB, 10),
    })),
    formas: (p.formas && typeof p.formas === 'object' && p.formas.A && p.formas.B) ? p.formas : null,
    espacios: (p.espacios && typeof p.espacios === 'object') ? p.espacios : null,
    creada: p.creada || base.creada,
    modificada: p.modificada || base.modificada,
  });
  t.opciones.fuente_pt = clamp(parseFloat(t.opciones.fuente_pt) || OPCIONES_PRUEBA_DEFAULT.fuente_pt, FUENTE_PT_MIN, FUENTE_PT_MAX);
  delete t.opciones.ancho_cabecera_mm;   // ahora es una constante (CABECERA_ANCHO_MM en vista.js)
  t.opciones.separador = t.opciones.separador === ',' ? ',' : '.';
  t.opciones.tipo_prueba = t.opciones.tipo_prueba === 'diez' ? 'diez' : 'control';
  t.opciones.disposicion = t.opciones.disposicion === 'a5' ? 'a5' : 'a4';
  return t;
}

// Genera las dos formas. `preguntasPorId` es un Map id → pregunta del banco.
// Devuelve el objeto `formas` (autocontenido: guarda una copia de cada
// pregunta, así la prueba se puede volver a ver aunque el banco cambie).
function generarFormas(prueba, preguntasPorId, semilla) {
  semilla = (semilla >>> 0) || semillaNueva();
  const rnd = crearAleatorio(semilla);
  const sep = prueba.opciones.separador || ',';
  const avisos = [];

  const items = prueba.items
    .map((it) => ({ item: it, pregunta: preguntasPorId.get(it.preguntaId) }))
    .filter((x) => x.pregunta);
  if (items.length === 0) throw new Error('La prueba no tiene preguntas.');

  // Orden de las preguntas: A al azar; B sin ninguna pregunta en la misma posición.
  const indices = items.map((_, i) => i);
  const ordenA = mezclar(indices, rnd);
  const ordenB = permutacionSinCoincidencias(ordenA, rnd);

  // Por pregunta: set de datos de cada forma.
  const decisiones = items.map(({ item, pregunta }, i) => {
    const nSets = pregunta.tipo === 'calculo' ? pregunta.sets.length : 0;
    let setA = null, setB = null;
    if (nSets > 0) {
      const fijoA = (item.setA !== 'auto' && item.setA >= 0 && item.setA < nSets) ? item.setA : null;
      const fijoB = (item.setB !== 'auto' && item.setB >= 0 && item.setB < nSets) ? item.setB : null;
      setA = fijoA != null ? fijoA : enteroAleatorio(rnd, nSets);
      if (fijoB != null) setB = fijoB;
      else if (nSets === 1) setB = 0;
      else {
        const candidatos = Array.from({ length: nSets }, (_, k) => k).filter((k) => k !== setA);
        setB = candidatos[enteroAleatorio(rnd, candidatos.length)];
      }
      if (setA === setB) avisos.push(`Pregunta ${i + 1} (${recortar(textoPlano(pregunta.enunciado), 40)}): las dos formas usan el set ${setA + 1}.`);
    }
    if (pregunta.mezclar === false) avisos.push(`Pregunta ${i + 1}: las opciones no se mezclan (así está marcada en el banco).`);
    return { setA, setB, permA: null, permB: null };
  });

  // Orden de las opciones: primero se decide la letra de la respuesta correcta
  // de cada pregunta en las dos formas (repartirCorrectas: letras parejas en
  // cada forma y distinta letra en A y B) y luego los distractores se
  // reparten al azar en las posiciones restantes.
  const fijas = items.map(({ pregunta }) => (pregunta.mezclar === false ? indiceCorrecta(pregunta.opciones) : null));
  const letras = repartirCorrectas(fijas, fijas, MODELO.N_OPCIONES, rnd);
  items.forEach(({ pregunta }, i) => {
    const d = decisiones[i];
    const nOp = pregunta.opciones.length;
    if (fijas[i] != null) {
      d.permA = Array.from({ length: nOp }, (_, k) => k);
      d.permB = d.permA.slice();
      return;
    }
    const idxCorrecta = indiceCorrecta(pregunta.opciones);
    d.permA = permutacionConCorrecta(nOp, idxCorrecta, letras.A[i], rnd, null);
    d.permB = permutacionConCorrecta(nOp, idxCorrecta, letras.B[i], rnd, d.permA);
  });

  function construirForma(def, orden, usarSet, usarPerm) {
    const lista = orden.map((idxBase, pos) => {
      const { pregunta } = items[idxBase];
      const d = decisiones[idxBase];
      const setIdx = usarSet(d);
      const res = resolverPregunta(pregunta, setIdx, sep);
      const perm = usarPerm(d);
      const opciones = perm.map((k) => ({ texto: res.opciones[k].texto, plano: res.opciones[k].plano || textoPlano(res.opciones[k].texto), correcta: res.opciones[k].correcta }));
      res.errores.forEach((e) => avisos.push(`Forma ${def.letra}, pregunta ${pos + 1}: ${e}`));
      res.advertencias.forEach((a) => avisos.push(`Forma ${def.letra}, pregunta ${pos + 1}: ${a}`));
      return {
        numero: pos + 1,
        preguntaId: pregunta.id,
        indiceBase: idxBase,
        setIndice: res.setIndice,
        enunciado: res.enunciado,
        opciones,
        correcta: letraCorrecta(opciones),
      };
    });
    return { letra: def.letra, F: def.F, items: lista, clave: lista.map((it) => it.correcta), corte: null };
  }

  const A = construirForma(MODELO.FORMAS[0], ordenA, (d) => d.setA, (d) => d.permA);
  const B = construirForma(MODELO.FORMAS[1], ordenB, (d) => d.setB, (d) => d.permB);

  // Copia de las preguntas usadas (enunciado original, imagen, tema...)
  const snapshot = {};
  items.forEach(({ pregunta }) => {
    snapshot[pregunta.id] = {
      id: pregunta.id, tema: pregunta.tema, etiqueta: pregunta.etiqueta || '', tiempo_estimado: pregunta.tiempo_estimado != null ? pregunta.tiempo_estimado : null, tipo: pregunta.tipo,
      mezclar: pregunta.mezclar !== false,
      enunciado: pregunta.enunciado, imagen: pregunta.imagen ? Object.assign({}, pregunta.imagen) : null,
      nSets: pregunta.tipo === 'calculo' ? pregunta.sets.length : 0,
    };
  });

  return { semilla, generada: ahoraISO(), A, B, snapshot, avisos };
}

function indiceCorrecta(opciones) {
  return Math.max(0, opciones.findIndex((o) => o.correcta));
}

// ============================================
// REPARTO DE LA LETRA CORRECTA
// ============================================
// Elige la posición (letra) de la respuesta correcta de cada pregunta en las
// dos formas:
//  - En cada forma las letras quedan tan parejas como se puede: con n preguntas
//    y 4 letras, cada letra sale ⌊n/4⌋ o ⌈n/4⌉ veces (5 preguntas → 2-1-1-1,
//    una sola letra repetida; 10 → 3-3-2-2). Qué letras llevan la vez de más se
//    sortea, así a la larga todas son igual de probables.
//  - Las preguntas fijas (opciones que no se mezclan) conservan su letra y
//    cuentan en el reparto; las demás lo completan.
//  - En la forma B ninguna pregunta repite la letra que tiene en la A.
//  - Entre todas las disposiciones que cumplen lo anterior se toma una al azar
//    (barajado con rechazo, con una reparación por intercambios de reserva que
//    en la práctica no hace falta). Coste: unos cientos de operaciones.
// fijasA[i] / fijasB[i]: posición fija de la pregunta i en cada forma, o null
// si se mezcla (una pregunta es fija en las dos formas o en ninguna).
// Devuelve { A: [posición por pregunta], B: [...] }.
function repartirCorrectas(fijasA, fijasB, nOps, rnd) {
  const libres = fijasA.map((f, i) => (f == null ? i : -1)).filter((i) => i >= 0);
  const m = libres.length;
  // Letras que reciben las preguntas libres: se llena siempre la letra con
  // menos apariciones (contando las fijas); los empates se sortean. Con
  // `prohibidas` (conteo de letras de las libres en la forma A) se evita, si se
  // puede, una cuota imposible de colocar sin repetir la letra de la forma A.
  function bolsa(fijas, prohibidas) {
    const total = new Array(nOps).fill(0);
    fijas.forEach((f) => { if (f != null) total[f]++; });
    const deLibres = new Array(nOps).fill(0);
    for (let k = 0; k < m; k++) {
      const min = Math.min.apply(null, total);
      let cand = total.map((_, l) => l).filter((l) => total[l] === min);
      if (prohibidas) {
        const posibles = cand.filter((l) => deLibres[l] + 1 + prohibidas[l] <= m);
        if (posibles.length) cand = posibles;
      }
      const l = cand[enteroAleatorio(rnd, cand.length)];
      total[l]++; deLibres[l]++;
    }
    const b = [];
    deLibres.forEach((v, l) => { for (let k = 0; k < v; k++) b.push(l); });
    return b;
  }
  const A = fijasA.slice(), B = fijasB.slice();
  const bolsaA = mezclar(bolsa(fijasA, null), rnd);
  libres.forEach((i, k) => { A[i] = bolsaA[k]; });

  const letraA = libres.map((i) => A[i]);
  const conteoA = new Array(nOps).fill(0);
  letraA.forEach((l) => conteoA[l]++);
  const bolsaB = bolsa(fijasB, conteoA);
  const choques = (p) => p.reduce((s, l, k) => s + (l === letraA[k] ? 1 : 0), 0);
  let mejor = null, nChoques = Infinity;   // se baraja siempre al menos una vez
  for (let intento = 0; intento < 300 && nChoques > 0; intento++) {
    const p = mezclar(bolsaB, rnd);
    const c = choques(p);
    if (c < nChoques) { mejor = p; nChoques = c; }
  }
  // Reserva: intercambia cada letra repetida con otra posición donde el
  // cambio no cree un choque nuevo (mantiene las cuotas de la forma B).
  for (let paso = 0; nChoques > 0 && paso < 50 * m; paso++) {
    const malos = mejor.map((_, k) => k).filter((k) => mejor[k] === letraA[k]);
    const k = malos[enteroAleatorio(rnd, malos.length)];
    let cand = mejor.map((_, j) => j).filter((j) => mejor[j] !== letraA[k] && mejor[k] !== letraA[j]);
    if (!cand.length) cand = mejor.map((_, j) => j).filter((j) => mejor[j] !== mejor[k]);
    if (!cand.length) break;
    const j = cand[enteroAleatorio(rnd, cand.length)];
    [mejor[k], mejor[j]] = [mejor[j], mejor[k]];
    nChoques = choques(mejor);
  }
  libres.forEach((i, k) => { B[i] = mejor[k]; });
  return { A, B };
}

// Orden de las opciones (lista de índices) con la correcta en `pos` y los
// distractores al azar. Si sale idéntico a `evitar` (la misma pregunta en la
// otra forma con la misma letra, solo cuando no hubo otra salida), se cambian
// dos distractores de lugar.
function permutacionConCorrecta(nOp, idxCorrecta, pos, rnd, evitar) {
  const distractores = mezclar(Array.from({ length: nOp }, (_, k) => k).filter((k) => k !== idxCorrecta), rnd);
  const perm = [];
  for (let p = 0, k = 0; p < nOp; p++) perm.push(p === pos ? idxCorrecta : distractores[k++]);
  if (evitar && distractores.length > 1 && perm.every((v, j) => v === evitar[j])) {
    const i1 = perm.findIndex((v, j) => j !== pos), i2 = perm.findIndex((v, j) => j !== pos && j !== i1);
    [perm[i1], perm[i2]] = [perm[i2], perm[i1]];
  }
  return perm;
}

// Vuelve a barajar solo las opciones de unas formas ya generadas: el orden de
// las preguntas, sus sets de datos, los cortes de cara y los espacios no
// cambian. Las letras correctas se reparten como en generarFormas.
// `seMezcla(preguntaId)` dice si una pregunta admite mezclar sus opciones; las
// que no, quedan como están. Modifica `formas` y devuelve cuántas preguntas
// se dejaron sin barajar.
function rebarajarOpciones(formas, seMezcla, semilla) {
  semilla = (semilla >>> 0) || semillaNueva();
  const rnd = crearAleatorio(semilla);
  const itemsA = formas.A.items;
  const itemB = new Map(formas.B.items.map((it) => [it.preguntaId, it]));
  if (itemsA.length !== formas.B.items.length || itemsA.some((it) => !itemB.has(it.preguntaId))) {
    throw new Error('Las formas A y B no tienen las mismas preguntas; vuelve a generarlas.');
  }
  const pares = itemsA.map((a) => ({ a, b: itemB.get(a.preguntaId) }));
  const fijo = pares.map(({ a }) => !seMezcla(a.preguntaId));
  const fijasA = pares.map(({ a }, i) => (fijo[i] ? indiceCorrecta(a.opciones) : null));
  const fijasB = pares.map(({ b }, i) => (fijo[i] ? indiceCorrecta(b.opciones) : null));
  const letras = repartirCorrectas(fijasA, fijasB, MODELO.N_OPCIONES, rnd);
  pares.forEach(({ a, b }, i) => {
    if (fijo[i]) return;
    [[a, letras.A[i]], [b, letras.B[i]]].forEach(([it, pos]) => {
      const perm = permutacionConCorrecta(it.opciones.length, indiceCorrecta(it.opciones), pos, rnd, null);
      it.opciones = perm.map((k) => it.opciones[k]);
      it.correcta = letraCorrecta(it.opciones);
    });
  });
  formas.A.clave = formas.A.items.map((it) => it.correcta);
  formas.B.clave = formas.B.items.map((it) => it.correcta);
  formas.semillaOpciones = semilla;
  return fijo.filter(Boolean).length;
}

// Número de preguntas que pide el tipo de prueba (casillas de su cabecera).
function objetivoPreguntas(prueba) {
  const t = prueba && prueba.opciones ? prueba.opciones.tipo_prueba : 'control';
  return t === 'diez' ? 10 : MODELO.N_PREGUNTAS;
}

// "2.5 min", "8 min", "1 h 15 min" (null si no hay tiempo).
function formatearTiempo(min) {
  if (typeof min !== 'number' || !isFinite(min) || min <= 0) return null;
  if (min >= 60) { const h = Math.floor(min / 60), m = Math.round(min - h * 60); return m ? `${h} h ${m} min` : `${h} h`; }
  const r = Math.round(min * 10) / 10;
  return (Number.isInteger(r) ? String(r) : r.toFixed(1)) + ' min';
}

// Suma de tiempos estimados de una lista de preguntas → { total, sin } (sin = cuántas no lo tienen).
function sumarTiempos(preguntas) {
  let total = 0, sin = 0;
  preguntas.forEach((q) => { if (q && typeof q.tiempo_estimado === 'number') total += q.tiempo_estimado; else sin++; });
  return { total: Math.round(total * 10) / 10, sin };
}

// Texto de la clave de una forma para el calificador: "1-B 2-D 3-A 4-C 5-B".
function claveTexto(forma) {
  return forma.items.map((it) => `${it.numero}-${it.correcta}`).join('  ');
}
