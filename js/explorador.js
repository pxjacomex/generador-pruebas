// ============================================================================
// EXPLORADOR DE PROBLEMAS (módulo independiente)
// Pestaña aparte que carga un archivo JSON de problemas de libro con la forma
//   { libro, fuente, capitulos: [ { capitulo, titulo, secciones: [ { seccion,
//     titulo, nota, problemas: [ { numero, dificultad, nota, enunciado,
//     figuras: [ { id, etiqueta, descripcion, svg, subfiguras: [{ id, svg }] } ],
//     respuesta, respuesta_figuras, respuesta_nota } ] } ] } ] }
// (como "serway_problemas_cap1-9_15.json") y permite filtrarlos por capítulo,
// sección, dificultad y texto, con las figuras y las ecuaciones dibujadas.
// No toca el banco, las pruebas ni el resto de la app: guarda el archivo en
// una base IndexedDB propia ("explorador-omr") para no tener que cargarlo
// cada vez. Solo reutiliza utilidades puras (escapeHtml, dividirMatematicas,
// renderTex) y toast().
// ============================================================================
'use strict';

const EXPLORADOR = (() => {
  const BD_NOMBRE = 'explorador-omr';
  const BD_STORE = 'archivos';
  const CLAVE = 'actual';
  const POR_PAGINA = 20;

  let datos = null;       // JSON cargado
  let indice = [];        // problemas aplanados: { cap, sec, secIdx, prob }
  let filtrados = [];
  let pagina = 0;
  let urls = [];          // blob URLs de las figuras dibujadas (se liberan al redibujar)
  let iniciado = false;

  // ---------- IndexedDB propia ----------
  function abrir() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('Este navegador no tiene IndexedDB')); return; }
      const req = indexedDB.open(BD_NOMBRE, 1);
      req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(BD_STORE)) db.createObjectStore(BD_STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('No se pudo abrir la base del explorador'));
    });
  }
  function operar(modo, fn) {
    return abrir().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(BD_STORE, modo);
      const req = fn(tx.objectStore(BD_STORE));
      let resultado;
      if (req) { req.onsuccess = () => { resultado = req.result; }; req.onerror = () => reject(req.error); }
      tx.oncomplete = () => { db.close(); resolve(resultado); };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transacción cancelada'));
    }));
  }
  const guardar = (obj) => operar('readwrite', (os) => os.put(obj, CLAVE));
  const leer = () => operar('readonly', (os) => os.get(CLAVE));
  const borrar = () => operar('readwrite', (os) => os.delete(CLAVE));

  // ---------- datos ----------
  function validar(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.capitulos)) throw new Error('El archivo no tiene la lista "capitulos"');
    d.capitulos.forEach((c, i) => {
      if (!Array.isArray(c.secciones)) throw new Error(`El capítulo ${c.capitulo != null ? c.capitulo : i + 1} no tiene "secciones"`);
      c.secciones.forEach((s) => { if (!Array.isArray(s.problemas)) throw new Error(`La sección ${s.seccion || s.titulo || '?'} no tiene "problemas"`); });
    });
    return d;
  }
  function indexar() {
    indice = [];
    (datos.capitulos || []).forEach((cap) => {
      (cap.secciones || []).forEach((sec, secIdx) => {
        (sec.problemas || []).forEach((prob) => indice.push({ cap, sec, secIdx, prob }));
      });
    });
  }
  const normalizar = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // ---------- texto con LaTeX ----------
  // El archivo usa LaTeX estándar ($…$ y $$…$$); fuera de las fórmulas el
  // texto se escapa tal cual (sin el markup ^{} _{} del banco).
  function texto(t) {
    return dividirMatematicas(t == null ? '' : String(t)).map((p) => (p.tipo === 'tex'
      ? renderTex(p.tex, p.display)
      : escapeHtml(p.texto).replace(/\r?\n/g, '<br>'))).join('');
  }

  // ---------- figuras ----------
  // Los SVG se dibujan con <img> desde un blob: así no pueden ejecutar código
  // ni cargar recursos externos, y se escalan como cualquier imagen.
  function urlSvg(svg) {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    urls.push(url);
    return url;
  }
  function liberarUrls() { urls.forEach((u) => URL.revokeObjectURL(u)); urls = []; }
  function anchoSvg(svg) {
    const m = /<svg[^>]*\swidth="([\d.]+)"/.exec(svg || '');
    return m ? parseFloat(m[1]) : 200;
  }
  function imgFigura(svg, alt) {
    if (!svg) return '';
    const w = Math.max(120, Math.round(anchoSvg(svg) * 1.5));
    return `<img src="${urlSvg(svg)}" alt="${escapeHtml(alt || '')}" style="width:${w}px" loading="lazy">`;
  }
  function htmlFiguras(figuras, conSub) {
    if (!figuras || !figuras.length) return '';
    return '<div class="exp-figuras">' + figuras.map((f) => {
      const sub = (conSub && Array.isArray(f.subfiguras) && f.subfiguras.length)
        ? '<div class="exp-subfiguras">' + f.subfiguras.map((s) => `<figure>${imgFigura(s.svg, (f.etiqueta || f.id || '') + ' ' + (s.id || ''))}<figcaption>(${escapeHtml(s.id || '')})${s.vectorial === false ? ' · imagen' : ''}</figcaption></figure>`).join('') + '</div>'
        : '';
      const pie = [f.etiqueta || f.id, f.descripcion].filter(Boolean).map(escapeHtml).join(' · ');
      return `<figure class="exp-figura">${imgFigura(f.svg, f.etiqueta || f.id)}<figcaption>${pie}${f.vectorial === false ? ' · imagen' : ''}${f.nota ? ` <span class="exp-nota-fig">(${escapeHtml(f.nota)})</span>` : ''}</figcaption>${sub}</figure>`;
    }).join('') + '</div>';
  }

  // ---------- interfaz ----------
  const $ = (id) => document.getElementById(id);
  const DIFICULTAD = { 1: ['●○○', 'sencillo'], 2: ['●●○', 'intermedio'], 3: ['●●●', 'desafiante'] };

  function etiquetaSeccion(sec) {
    return (sec.seccion ? sec.seccion + ' · ' : '') + (sec.titulo || 'Sin título');
  }

  function renderInfo() {
    const info = $('expInfo');
    const cont = $('expContenido');
    const quitar = $('expQuitar');
    if (!datos) {
      info.textContent = 'Ningún archivo cargado.';
      cont.classList.add('hidden'); quitar.classList.add('hidden');
      return;
    }
    const nFig = indice.reduce((a, e) => a + ((e.prob.figuras || []).length), 0);
    const nResp = indice.filter((e) => e.prob.respuesta).length;
    info.innerHTML = `<b>${escapeHtml(datos.libro || 'Archivo de problemas')}</b>${datos.fuente ? ' · ' + escapeHtml(datos.fuente) : ''}<br>${datos.capitulos.length} capítulos · ${indice.length} problemas · ${nFig} figuras · ${nResp} con respuesta`;
    cont.classList.remove('hidden'); quitar.classList.remove('hidden');
    const selCap = $('expCapitulo');
    const capActual = selCap.value;
    selCap.innerHTML = '<option value="">Todos los capítulos</option>' + datos.capitulos.map((c, i) => `<option value="${i}">Cap. ${escapeHtml(String(c.capitulo != null ? c.capitulo : i + 1))} · ${escapeHtml(c.titulo || '')}</option>`).join('');
    selCap.value = capActual && selCap.querySelector(`option[value="${capActual}"]`) ? capActual : '';
    renderSecciones();
  }

  function renderSecciones() {
    const selCap = $('expCapitulo'), selSec = $('expSeccion');
    const secActual = selSec.value;
    if (!datos || selCap.value === '') {
      selSec.innerHTML = '<option value="">Todas las secciones</option>';
      selSec.disabled = true;
      return;
    }
    const cap = datos.capitulos[parseInt(selCap.value, 10)];
    selSec.disabled = false;
    selSec.innerHTML = '<option value="">Todas las secciones</option>' + cap.secciones.map((s, i) => `<option value="${i}">${escapeHtml(etiquetaSeccion(s))} (${s.problemas.length})</option>`).join('');
    selSec.value = secActual && selSec.querySelector(`option[value="${secActual}"]`) ? secActual : '';
  }

  function filtrar() {
    if (!datos) { filtrados = []; return; }
    const capIdx = $('expCapitulo').value, secIdx = $('expSeccion').value;
    const dif = $('expDificultad').value;
    const q = normalizar($('expBuscar').value.trim());
    const conFigura = $('expConFigura').checked, conRespuesta = $('expConRespuesta').checked;
    filtrados = indice.filter((e) => {
      if (capIdx !== '' && datos.capitulos[parseInt(capIdx, 10)] !== e.cap) return false;
      if (capIdx !== '' && secIdx !== '' && e.secIdx !== parseInt(secIdx, 10)) return false;
      if (dif && String(e.prob.dificultad) !== dif) return false;
      if (conFigura && !(e.prob.figuras && e.prob.figuras.length)) return false;
      if (conRespuesta && !e.prob.respuesta) return false;
      if (q) {
        const pajar = normalizar((e.prob.enunciado || '') + ' ' + (e.prob.nota || '') + ' ' + (e.prob.respuesta || '') + ' P' + (e.cap.capitulo || '') + '.' + e.prob.numero);
        if (!pajar.includes(q)) return false;
      }
      return true;
    });
  }

  function htmlProblema(e) {
    const p = e.prob;
    const d = DIFICULTAD[p.dificultad] || ['', ''];
    const mostrarResp = $('expMostrarRespuestas').checked;
    const conSub = $('expSubfiguras').checked;
    const pag = Array.isArray(p.pagina_pdf) ? p.pagina_pdf.join(', ') : (p.pagina_pdf || '');
    let respuesta = '';
    if (p.respuesta || (p.respuesta_figuras && p.respuesta_figuras.length) || p.respuesta_nota) {
      respuesta = `<details class="exp-respuesta" ${mostrarResp ? 'open' : ''}><summary>Respuesta</summary><div class="exp-texto">${p.respuesta ? texto(p.respuesta) : ''}${htmlFiguras(p.respuesta_figuras, conSub)}${p.respuesta_nota ? `<div class="exp-nota">${escapeHtml(p.respuesta_nota)}</div>` : ''}</div></details>`;
    } else {
      respuesta = '<div class="field-note">Sin respuesta en el libro (problema par).</div>';
    }
    return `
      <article class="exp-problema">
        <header>
          <span class="badge tema">Cap. ${escapeHtml(String(e.cap.capitulo != null ? e.cap.capitulo : ''))} · ${escapeHtml(etiquetaSeccion(e.sec))}</span>
          <span class="badge num">Problema ${escapeHtml(String(p.numero))}</span>
          ${d[0] ? `<span class="badge dif d${p.dificultad}" title="Dificultad ${p.dificultad}">${d[0]} ${d[1]}</span>` : ''}
          ${p.solucion_en_manual_del_estudiante ? '<span class="badge ok" title="Solución en el manual del estudiante">manual</span>' : ''}
          ${pag ? `<span class="field-note">pág. PDF ${escapeHtml(String(pag))}</span>` : ''}
        </header>
        ${p.nota ? `<div class="exp-nota">${texto(p.nota)}</div>` : ''}
        <div class="exp-texto exp-enunciado">${texto(p.enunciado)}</div>
        ${htmlFiguras(p.figuras, conSub)}
        ${respuesta}
      </article>`;
  }

  function renderLista() {
    liberarUrls();
    const lista = $('expLista');
    const resumen = $('expResumen');
    const pagEl = $('expPaginacion');
    if (!datos) { lista.innerHTML = ''; pagEl.innerHTML = ''; resumen.textContent = ''; return; }
    const total = filtrados.length;
    const nPag = Math.max(1, Math.ceil(total / POR_PAGINA));
    pagina = Math.min(pagina, nPag - 1);
    const desde = pagina * POR_PAGINA;
    const trozo = filtrados.slice(desde, desde + POR_PAGINA);
    resumen.textContent = total ? `${total} problema${total === 1 ? '' : 's'} · mostrando ${desde + 1}–${desde + trozo.length}` : 'Ningún problema coincide con los filtros.';
    // Nota de la sección cuando se filtra por una sección concreta
    const capIdx = $('expCapitulo').value, secIdx = $('expSeccion').value;
    let notaSec = '';
    if (capIdx !== '' && secIdx !== '') {
      const sec = datos.capitulos[parseInt(capIdx, 10)].secciones[parseInt(secIdx, 10)];
      if (sec && sec.nota) notaSec = `<div class="card exp-nota-seccion">${texto(sec.nota)}</div>`;
    }
    lista.innerHTML = notaSec + trozo.map(htmlProblema).join('');
    pagEl.innerHTML = nPag > 1 ? `
      <button type="button" class="btn btn-ghost btn-inline" onclick="EXPLORADOR.irPagina(${pagina - 1})" ${pagina === 0 ? 'disabled' : ''}>‹ Anterior</button>
      <span>Página ${pagina + 1} de ${nPag}</span>
      <button type="button" class="btn btn-ghost btn-inline" onclick="EXPLORADOR.irPagina(${pagina + 1})" ${pagina >= nPag - 1 ? 'disabled' : ''}>Siguiente ›</button>` : '';
    pagEl.classList.toggle('hidden', nPag <= 1);
  }

  function refrescar(reiniciarPagina) {
    if (reiniciarPagina) pagina = 0;
    filtrar();
    renderLista();
  }

  // ---------- acciones públicas ----------
  async function cargarArchivo(file) {
    if (!file) return;
    try {
      const textoJson = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error || new Error('No se pudo leer el archivo')); r.readAsText(file, 'utf-8'); });
      const d = validar(JSON.parse(textoJson));
      d._nombreArchivo = file.name;
      d._cargado = new Date().toISOString();
      datos = d;
      indexar();
      try { await guardar(d); } catch (e) { toast('Cargado, pero no se pudo guardar en el navegador: ' + e.message, 'warn'); }
      renderInfo();
      refrescar(true);
      toast(`Archivo cargado: ${indice.length} problemas de ${d.capitulos.length} capítulos`);
    } catch (e) {
      toast('No se pudo cargar el archivo: ' + e.message, 'error');
    }
  }

  async function quitar() {
    const ok = typeof confirmar === 'function' ? await confirmar('¿Quitar el archivo de problemas?', 'Se borra solo del explorador en este navegador; tu archivo JSON no se toca.') : true;
    if (!ok) return;
    try { await borrar(); } catch (_) {}
    datos = null; indice = []; filtrados = [];
    liberarUrls();
    renderInfo(); renderLista();
    toast('Archivo quitado del explorador');
  }

  function irPagina(n) {
    pagina = Math.max(0, n);
    renderLista();
    const cima = $('expContenido');
    if (cima) window.scrollTo({ top: cima.getBoundingClientRect().top + window.scrollY - 12, behavior: 'smooth' });
  }

  // Primera vez que se abre la pestaña: recuperar el archivo guardado.
  async function activar() {
    if (iniciado) return;
    iniciado = true;
    try {
      const d = await leer();
      if (d) { datos = validar(d); indexar(); }
    } catch (e) {
      toast('No se pudo recuperar el archivo guardado: ' + e.message, 'warn');
    }
    renderInfo();
    refrescar(true);
  }

  function iniciar() {
    const tab = document.querySelector('.tab[data-section="explorador"]');
    if (tab) tab.addEventListener('click', activar);
    const input = $('expArchivoInput');
    if (input) input.addEventListener('change', (e) => { cargarArchivo(e.target.files[0]); e.target.value = ''; });
    $('expCapitulo').addEventListener('change', () => { renderSecciones(); refrescar(true); });
    $('expSeccion').addEventListener('change', () => refrescar(true));
    $('expDificultad').addEventListener('change', () => refrescar(true));
    $('expBuscar').addEventListener('input', () => refrescar(true));
    ['expConFigura', 'expConRespuesta'].forEach((id) => $(id).addEventListener('change', () => refrescar(true)));
    ['expMostrarRespuestas', 'expSubfiguras'].forEach((id) => $(id).addEventListener('change', () => refrescar(false)));
    renderInfo();
  }
  document.addEventListener('DOMContentLoaded', iniciar);

  return { activar, cargarArchivo, quitar, irPagina, get datos() { return datos; }, get filtrados() { return filtrados; } };
})();
