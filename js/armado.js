// ============================================================================
// PESTAÑA ARMAR: la prueba en construcción (borrador), selección de preguntas
// del banco, set de datos de cada forma y generación de las formas A y B.
// El borrador se guarda en localStorage con cada cambio.
// ============================================================================
'use strict';

const ARMADO = {
  prueba: null,
  filtroSelector: '',
};

function armarCargarBorrador() {
  const guardado = lsLeer(LS_BORRADOR, null);
  ARMADO.prueba = normalizarPrueba(guardado) || nuevaPrueba();
  // Borrador de una versión anterior (sin formas generadas): toma los nuevos
  // valores por defecto sin pisar lo que el usuario haya cambiado a mano.
  const vGuardada = (guardado && guardado.opciones && guardado.opciones.v) || 1;
  if (guardado && !ARMADO.prueba.formas && vGuardada < OPCIONES_PRUEBA_DEFAULT.v) {
    const op = ARMADO.prueba.opciones;
    if (vGuardada < 2) {
      ['separador', 'mostrar_nombre_cara2', 'distribuir_dos_caras'].forEach((k) => { op[k] = OPCIONES_PRUEBA_DEFAULT[k]; });
      if (op.fuente_pt === 10) op.fuente_pt = OPCIONES_PRUEBA_DEFAULT.fuente_pt;
    }
    if (vGuardada < 3) {
      if (op.fuente_pt === 16) op.fuente_pt = 12;
      if (ARMADO.prueba.instrucciones.trim() === INSTRUCCIONES_ANTERIORES) ARMADO.prueba.instrucciones = '';
    }
    if (vGuardada < 4) {
      if (op.fuente_pt === 12) op.fuente_pt = OPCIONES_PRUEBA_DEFAULT.fuente_pt;   // 11 pt
    }
    op.v = OPCIONES_PRUEBA_DEFAULT.v;
    armarGuardarBorrador();
  }
  armarRender();
}

function armarGuardarBorrador() {
  if (!ARMADO.prueba) return;
  ARMADO.prueba.modificada = ahoraISO();
  lsEscribir(LS_BORRADOR, ARMADO.prueba);
}

function armarCampo(campo, valor) {
  const p = ARMADO.prueba;
  if (campo in p.opciones) {
    if (campo === 'fuente_pt') p.opciones[campo] = clamp(parseFloat(valor) || OPCIONES_PRUEBA_DEFAULT.fuente_pt, FUENTE_PT_MIN, FUENTE_PT_MAX);
    else p.opciones[campo] = valor;
  } else {
    p[campo] = valor;
  }
  armarGuardarBorrador();
  if (campo === 'titulo') armarActualizarBadge();
  if (campo === 'tipo_prueba') armarRender();
}

function armarActualizarBadge() {
  const n = ARMADO.prueba ? ARMADO.prueba.items.length : 0;
  const b = document.getElementById('badgeArmar');
  b.textContent = n;
  b.style.display = n ? '' : 'none';
}

function armarRender() {
  const p = ARMADO.prueba;
  if (!p) return;
  document.getElementById('pruebaTitulo').value = p.titulo;
  document.getElementById('pruebaCurso').value = p.curso;
  document.getElementById('pruebaFecha').value = p.fecha;
  document.getElementById('pruebaInstrucciones').value = p.instrucciones;
  document.getElementById('pruebaFuente').value = String(p.opciones.fuente_pt);
  document.getElementById('pruebaSeparador').value = p.opciones.separador;
  document.getElementById('pruebaMarcarF').checked = !!p.opciones.marcar_F;
  document.getElementById('pruebaTipo').value = p.opciones.tipo_prueba || 'control';
  document.getElementById('pruebaNombreCara2').checked = p.opciones.mostrar_nombre_cara2 !== false;

  const porId = bancoPorId();
  const cont = document.getElementById('armarItems');
  const n = p.items.length;
  const objetivo = objetivoPreguntas(p);
  const contador = document.getElementById('armarContador');
  contador.textContent = `${n} / ${objetivo}`;
  contador.className = 'badge ' + (n === objetivo ? 'ok' : 'warn');
  // Prueba de 10 preguntas: tiempo estimado acumulado de las elegidas
  const tiempoEl = document.getElementById('armarTiempo');
  if (p.opciones.tipo_prueba === 'diez' && n) {
    tiempoEl.innerHTML = textoTiempoTotal(p, porId);
    tiempoEl.classList.remove('hidden');
  } else {
    tiempoEl.classList.add('hidden');
  }
  armarActualizarBadge();

  const avisos = [];
  if (n === 0) avisos.push(`Agrega preguntas del banco. Esta cabecera tiene casillas para ${objetivo} preguntas (P1 a P${objetivo}).`);
  else if (n !== objetivo) avisos.push(`La prueba tiene ${n} pregunta${n === 1 ? '' : 's'}; esta cabecera tiene casillas para exactamente ${objetivo}.`);
  const faltan = p.items.filter((it) => !porId.has(it.preguntaId));
  if (faltan.length) avisos.push(`${faltan.length} pregunta${faltan.length === 1 ? ' ya no está' : 's ya no están'} en el banco (quítala${faltan.length === 1 ? '' : 's'} de la lista).`);
  const av = document.getElementById('armarAviso');
  av.innerHTML = avisos.map((a) => `<div class="aviso-item warn">${escapeHtml(a)}</div>`).join('');
  av.classList.toggle('hidden', avisos.length === 0);

  if (n === 0) { cont.innerHTML = ''; return; }
  cont.innerHTML = p.items.map((it, i) => {
    const q = porId.get(it.preguntaId);
    if (!q) {
      return `<div class="item-pregunta faltante"><div class="item-cuerpo"><div class="item-texto">⚠ Esta pregunta ya no existe en el banco.</div>
        <div class="item-acciones"><button class="btn btn-ghost btn-mini peligro" onclick="armarQuitar(${i})">✖ Quitar</button></div></div></div>`;
    }
    const rev = comprobarPregunta(q);
    const estado = rev.errores.length ? `<span class="badge error" title="${escapeHtml(rev.errores.join('\n'))}">⚠ incompleta</span>` : '';
    const selSets = q.tipo === 'calculo' ? `
      <div class="sets-forma">
        ${['A', 'B'].map((f) => {
          const val = it['set' + f];
          return `<label>Set forma ${f}
            <select class="select select-mini" onchange="armarSet(${i}, '${f}', this.value)">
              <option value="auto" ${val === 'auto' ? 'selected' : ''}>Al azar (distinto en A y B)</option>
              ${q.sets.map((_, k) => `<option value="${k}" ${val === k ? 'selected' : ''}>Set ${k + 1}: ${escapeHtml(recortar(q.variables.map((v) => `${v}=${_[v]}`).join(', '), 40))}</option>`).join('')}
            </select></label>`;
        }).join('')}
      </div>` : '';
    return `
      <div class="item-pregunta">
        <div class="item-orden">
          <button class="btn-x" title="Subir" onclick="armarMover(${i}, -1)" ${i === 0 ? 'disabled' : ''}>▲</button>
          <span>${i + 1}</span>
          <button class="btn-x" title="Bajar" onclick="armarMover(${i}, 1)" ${i === n - 1 ? 'disabled' : ''}>▼</button>
        </div>
        ${q.imagen ? `<img class="miniatura" src="${q.imagen.datos}" alt="">` : ''}
        <div class="item-cuerpo">
          <div class="item-meta">
            ${q.tema ? `<span class="badge tema">${escapeHtml(q.tema)}</span>` : ''}
            ${globoEtiqueta(q)}
            ${globoTiempo(q)}
            <span class="badge">${etiquetaTipo(q)}</span>
            ${estado}
          </div>
          <div class="item-texto">${textoEnriquecido(resumenPregunta(q, 160))}</div>
          ${selSets}
          <div class="item-acciones">
            <button class="btn btn-ghost btn-mini" onclick="bancoVer('${q.id}')">👁️ Ver</button>
            <button class="btn btn-ghost btn-mini" onclick="bancoEditar('${q.id}'); switchSection('banco')">✏️ Editar</button>
            <button class="btn btn-ghost btn-mini peligro" onclick="armarQuitar(${i})">✖ Quitar</button>
          </div>
        </div>
      </div>`;
  }).join('');
  document.getElementById('armarOrdenNota').classList.toggle('hidden', n < 2);
}

// "⏱ Tiempo estimado total: 24.5 min (2 preguntas sin tiempo)" para la prueba actual.
function textoTiempoTotal(p, porId) {
  porId = porId || bancoPorId();
  const st = sumarTiempos(p.items.map((it) => porId.get(it.preguntaId)).filter(Boolean));
  return `⏱ Tiempo estimado total: <b>${formatearTiempo(st.total) || '0 min'}</b>${st.sin ? ` <span class="field-note">(${st.sin} pregunta${st.sin === 1 ? '' : 's'} sin tiempo)</span>` : ''}`;
}

function armarSet(i, forma, valor) {
  const it = ARMADO.prueba.items[i];
  if (!it) return;
  it['set' + forma] = valor === 'auto' ? 'auto' : parseInt(valor, 10);
  armarGuardarBorrador();
}

function armarMover(i, delta) {
  const items = ARMADO.prueba.items;
  const j = i + delta;
  if (j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  armarGuardarBorrador();
  armarRender();
}

function armarQuitar(i) {
  ARMADO.prueba.items.splice(i, 1);
  armarGuardarBorrador();
  armarRender();
  bancoRender();
}

function armarAgregar(pregunta) {
  const p = ARMADO.prueba;
  if (p.items.some((it) => it.preguntaId === pregunta.id)) { toast('Esa pregunta ya está en la prueba', 'warn'); return; }
  const rev = comprobarPregunta(pregunta);
  if (rev.errores.length) { toast('La pregunta está incompleta; corrígela en el banco antes de usarla', 'error'); return; }
  if (p.opciones.tipo_prueba === 'diez' && p.items.length >= objetivoPreguntas(p)) {
    toast(`La prueba de 10 preguntas ya tiene ${objetivoPreguntas(p)}; quita una antes de agregar otra`, 'warn');
    return;
  }
  p.items.push({ preguntaId: pregunta.id, setA: 'auto', setB: 'auto' });
  armarGuardarBorrador();
  armarRender();
  selectorRender();
  bancoRender();
  toast(`Pregunta agregada (${p.items.length} de ${objetivoPreguntas(p)})`);
}

async function armarNueva() {
  const p = ARMADO.prueba;
  if (p.items.length || p.titulo) {
    const ok = await confirmar('¿Empezar una prueba nueva?', p.formas ? 'La prueba actual ya está guardada en "Guardadas"; solo se vacía el borrador.' : 'Se vaciará el borrador actual (título y preguntas elegidas).');
    if (!ok) return;
  }
  ARMADO.prueba = nuevaPrueba();
  armarGuardarBorrador();
  armarRender();
  bancoRender();
  toast('Borrador nuevo');
}

// Carga una prueba guardada como borrador para modificarla.
function armarCargarPrueba(prueba) {
  ARMADO.prueba = normalizarPrueba(copiaProfunda(prueba));
  armarGuardarBorrador();
  armarRender();
  bancoRender();
  switchSection('armar');
  toast('Prueba cargada en Armar; al generar se guardará con sus cambios');
}

// Vuelve a sortear las formas de una prueba con el banco actual.
function regenerarFormas(prueba, semilla) {
  const porId = bancoPorId();
  const faltan = prueba.items.filter((it) => !porId.has(it.preguntaId));
  if (faltan.length) throw new Error(`${faltan.length} pregunta(s) de la prueba ya no están en el banco; edítala en Armar y quítalas.`);
  const incompletas = prueba.items.map((it) => porId.get(it.preguntaId)).filter((q) => comprobarPregunta(q).errores.length);
  if (incompletas.length) throw new Error('Hay preguntas incompletas: ' + incompletas.map((q) => '"' + recortar(textoPlano(q.enunciado), 40) + '"').join(', '));
  return generarFormas(prueba, porId, semilla);
}

async function armarGenerar() {
  const p = ARMADO.prueba;
  if (p.items.length === 0) { toast('Agrega preguntas antes de generar', 'error'); return; }
  const objetivo = objetivoPreguntas(p);
  if (p.items.length !== objetivo) {
    const ok = await confirmar(`La prueba tiene ${p.items.length} preguntas`, `La cabecera elegida tiene casillas para exactamente ${objetivo}. ¿Generar igual?`);
    if (!ok) return;
  }
  try {
    p.formas = regenerarFormas(p, semillaNueva());
    p.espacios = null;        // orden nuevo: los espacios vuelven a repartirse por igual
    p.modificada = ahoraISO();
    const copia = copiaProfunda(p);
    await bdGuardar(BD_PRUEBAS, copia);
    armarGuardarBorrador();
    await guardadasRender();
    await vistaMostrar(copia);
    toast('Formas A y B generadas y guardadas');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ============================================
// SELECTOR DE PREGUNTAS DEL BANCO (modal)
// ============================================
function armarAbrirSelector() {
  ARMADO.filtroSelector = '';
  document.getElementById('selectorBuscar').value = '';
  const selTema = document.getElementById('selectorTema');
  selTema.innerHTML = '<option value="">Todos los temas</option>' + bancoTemas().map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  document.getElementById('selectorTipo').value = '';
  selectorRender();
  abrirModal('modalSelector');
  setTimeout(() => document.getElementById('selectorBuscar').focus(), 50);
}

function selectorRender() {
  const cont = document.getElementById('selectorItems');
  if (!cont) return;
  const filtro = { texto: document.getElementById('selectorBuscar').value, tema: document.getElementById('selectorTema').value, tipo: document.getElementById('selectorTipo').value };
  const lista = bancoFiltrar(BANCO.preguntas, filtro);
  const enPrueba = new Set(ARMADO.prueba.items.map((it) => it.preguntaId));
  // Resumen de la prueba en construcción: contador y, en la de 10, tiempo acumulado
  const p = ARMADO.prueba;
  const objetivo = objetivoPreguntas(p);
  const lleno = p.opciones.tipo_prueba === 'diez' && p.items.length >= objetivo;
  const resumen = document.getElementById('selectorResumen');
  resumen.innerHTML = `<span class="badge ${p.items.length === objetivo ? 'ok' : 'warn'}">${p.items.length} / ${objetivo}</span>`
    + (p.opciones.tipo_prueba === 'diez' ? ` <span class="tiempo-total">${textoTiempoTotal(p)}</span>` : '')
    + (lleno ? ' <span class="field-note">La prueba ya tiene sus 10 preguntas.</span>' : '');
  if (BANCO.preguntas.length === 0) {
    cont.innerHTML = BANCO.todas.length
      ? '<div class="vacio">La vista del banco está vacía. En la pestaña Banco pulsa "Recargar banco guardado" o importa un archivo.</div>'
      : '<div class="vacio">El banco está vacío. Crea preguntas en la pestaña Banco o carga las de ejemplo.</div>';
    return;
  }
  if (lista.length === 0) { cont.innerHTML = '<div class="vacio">Ninguna pregunta coincide.</div>'; return; }
  cont.innerHTML = lista.map((q) => {
    const ya = enPrueba.has(q.id);
    const rev = comprobarPregunta(q);
    return `
      <div class="item-pregunta compacta ${ya ? 'ya' : ''}">
        ${q.imagen ? `<img class="miniatura" src="${q.imagen.datos}" alt="">` : ''}
        <div class="item-cuerpo">
          <div class="item-meta">
            ${q.tema ? `<span class="badge tema">${escapeHtml(q.tema)}</span>` : ''}
            ${globoEtiqueta(q)}
            ${globoTiempo(q)}
            <span class="badge">${etiquetaTipo(q)}</span>
            ${rev.errores.length ? '<span class="badge error">⚠ incompleta</span>' : ''}
            ${ya ? '<span class="badge ok">en la prueba</span>' : ''}
          </div>
          <div class="item-texto">${textoEnriquecido(resumenPregunta(q, 140))}</div>
          <div class="item-acciones">
            <button class="btn btn-ghost btn-mini" onclick="selectorVer('${q.id}')">👁️ Ver</button>
            <button class="btn btn-primary btn-mini" onclick="selectorAgregar('${q.id}')" ${ya || rev.errores.length || lleno ? 'disabled' : ''}>＋ Agregar</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function selectorVer(id) {
  const q = bancoPorId().get(id);
  if (!q) return;
  const ya = ARMADO.prueba.items.some((it) => it.preguntaId === id);
  mostrarVistaPregunta(q, { alAgregar: ya ? null : (pregunta) => armarAgregar(pregunta) });
}

function selectorAgregar(id) {
  const q = bancoPorId().get(id);
  if (q) armarAgregar(q);
}
