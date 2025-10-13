/* Bets 1.0.0 (inherits MMSports components) */
const STATE_KEYS = {
  players: 'bets_players',
  cartillas: 'bets_cartillas'
};

let players = [];      // [{ jugador, estadistica, valor }]
let cartillas = [];    // [{ id, nombre, lineas: [{ jugador, estadistica, condicion, objetivo, actual, restante, cumple }] }]

// ---------- UTIL ----------
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const normalize = s => (s ?? '').toString().trim();
const toNumber = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).toString().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const saveState = () => {
  localStorage.setItem(STATE_KEYS.players, JSON.stringify(players));
  localStorage.setItem(STATE_KEYS.cartillas, JSON.stringify(cartillas));
};
const loadState = () => {
  try {
    players = JSON.parse(localStorage.getItem(STATE_KEYS.players) || '[]');
    cartillas = JSON.parse(localStorage.getItem(STATE_KEYS.cartillas) || '[]');
  } catch(e) {
    players = []; cartillas = [];
  }
};

function toast(msg, type='info') {
  const t = $('#toast');
  if (!t) return;
  t.className = 'fixed top-3 right-3 max-w-sm z-30';
  const colors = { info:'bg-sky-600', warn:'bg-amber-600', error:'bg-rose-600', ok:'bg-emerald-600' };
  t.innerHTML = `<div class="text-white ${colors[type]||colors.info} rounded-xl shadow-lg px-4 py-3">${msg}</div>`;
  t.classList.remove('hidden');
  setTimeout(()=>t.classList.add('hidden'), 2400);
}

function showWarnings(list) {
  const panel = $('#warnPanel');
  const ul = $('#warnList');
  if (!panel || !ul) return;
  ul.innerHTML = '';
  list.forEach(w => { const li = document.createElement('li'); li.textContent = w; ul.appendChild(li); });
  panel.classList.remove('hidden');
}

function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- VALIDATION ----------
const REQUIRED_CARTILLAS = ['cartilla','jugador','estadistica','condicion','objetivo']; // 'actual' optional
const REQUIRED_JUGADORES = ['jugador','estadistica','valor'];

function validateHeaders(rows, required) {
  if (!rows?.length) return ['No se encontraron filas.'];
  const headers = Object.keys(rows[0]).map(h=>h.toLowerCase().trim());
  const missing = required.filter(r => !headers.includes(r));
  return missing.length ? [`Faltan columnas: ${missing.join(', ')}`] : [];
}

function coerceHeaderVariants(rows) {
  return rows.map(r => {
    const o = {};
    for (const k in r) {
      const kl = k.toLowerCase().trim()
        .replace('estadística','estadistica')
        .replace('condición','condicion')
        .replace('objetívo','objetivo')
        .replace('actual ','actual');
      o[kl] = r[k];
    }
    return o;
  });
}

// ---------- PARSE ----------
function parseCartillasRows(rows) {
  rows = coerceHeaderVariants(rows);
  const warns = validateHeaders(rows, REQUIRED_CARTILLAS);
  if (warns.length) showWarnings(warns);

  const result = [];
  const byId = new Map();
  rows.forEach(row => {
    const cartilla   = normalize(row['cartilla']);
    const jugador    = normalize(row['jugador']);
    const estadistica= normalize(row['estadistica']);
    const condicion  = normalize(row['condicion']);
    const objetivo   = toNumber(row['objetivo']);
    let actual       = row.hasOwnProperty('actual') ? toNumber(row['actual']) : null;

    if (!cartilla || !jugador || !estadistica || !condicion || objetivo===null) return;

    if (!byId.has(cartilla)) byId.set(cartilla, { id: cartilla, nombre: cartilla, lineas: [] });

    if (actual === null) {
      const p = players.find(p => p.jugador.toLowerCase()===jugador.toLowerCase() && p.estadistica.toLowerCase()===estadistica.toLowerCase());
      if (p) actual = toNumber(p.valor);
    }

    let cumple = false; let restante = null;
    const cond = condicion.replace(/\s+/g,'');
    if (actual!==null) {
      if (cond === '>=') { cumple = actual >= objetivo; restante = Math.max(0, objetivo - actual); }
      else if (cond === '<=') { cumple = actual <= objetivo; restante = Math.max(0, actual - objetivo); }
    }

    byId.get(cartilla).lineas.push({ jugador, estadistica, condicion: cond, objetivo, actual, restante, cumple });
  });

  return Array.from(byId.values());
}

function parseJugadoresRows(rows) {
  rows = coerceHeaderVariants(rows);
  const warns = validateHeaders(rows, REQUIRED_JUGADORES);
  if (warns.length) showWarnings(warns);

  const out = [];
  rows.forEach(row => {
    const jugador = normalize(row['jugador']);
    const estadistica = normalize(row['estadistica']);
    const valor = toNumber(row['valor']);
    if (!jugador || !estadistica || valor===null) return;
    out.push({ jugador, estadistica, valor });
  });
  return out;
}

// Robust CSV to rows
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i=0; i<text.length; i++) {
    const c = text[i];
    if (c === '"' ) {
      if (inQuotes && text[i+1] === '"') { field += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (c === ',' && !inQuotes) {
      row.push(field); field='';
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (field!=='' || row.length) { row.push(field); rows.push(row); row=[]; field=''; }
      if (c === '\r' && text[i+1]==='\n') i++; // CRLF
    } else {
      field += c;
    }
  }
  if (field!=='' || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(h=>h.trim());
  return rows.slice(1).filter(r=>r.some(x=>x.trim()!=='')).map(r => {
    const obj = {}; headers.forEach((h, i) => obj[h] = r[i] ?? ''); return obj;
  });
}

// ---------- RENDER ----------
let currentSlide = 0;
let autoTimer = null;
let autoEnabled = false;
let autoMs = 6000;

function renderPlayersTable() {
  const tbody = $('#playersTable');
  if (!tbody) return;
  tbody.innerHTML = '';

  const q = normalize($('#playerSearch')?.value || '').toLowerCase();

  players
    .filter(p => !q || p.jugador.toLowerCase().includes(q))
    .sort((a,b) => a.jugador.localeCompare(b.jugador) || a.estadistica.localeCompare(b.estadistica))
    .forEach((p, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'border-t border-slate-100';
      tr.innerHTML = `
        <td class="px-3 py-2">${p.jugador}</td>
        <td class="px-3 py-2">${p.estadistica}</td>
        <td class="px-3 py-2 text-right">
          <input data-idx="${idx}" type="number" class="w-24 px-2 py-1 border border-slate-300 rounded-lg text-right" value="${p.valor ?? ''}" />
        </td>
      `;
      tbody.appendChild(tr);
    });

  $$('input[type="number"]', tbody).forEach(inp => {
    inp.addEventListener('change', () => {
      const i = Number(inp.dataset.idx);
      const v = toNumber(inp.value);
      players[i].valor = v;
      cascadePlayersToCartillas(players[i]);
      saveState();
      renderAll();
      checkGlobalCompletion();
    });
  });
}

function cascadePlayersToCartillas(p) {
  for (const c of cartillas) {
    for (const linea of c.lineas) {
      if (linea.jugador.toLowerCase()===p.jugador.toLowerCase()
          && linea.estadistica.toLowerCase()===p.estadistica.toLowerCase()) {
        linea.actual = p.valor;
        if (linea.condicion === '>=' ) {
          linea.cumple = p.valor >= linea.objetivo;
          linea.restante = Math.max(0, linea.objetivo - p.valor);
        } else if (linea.condicion === '<=' ) {
          linea.cumple = p.valor <= linea.objetivo;
          linea.restante = Math.max(0, p.valor - linea.objetivo);
        }
      }
    }
  }
}

function renderCarousel() {
  const container = $('#carousel');
  if (!container) return;
  container.innerHTML = '';

  cartillas.forEach((c, i) => {
    const allOk = c.lineas.length>0 && c.lineas.every(l => !!l.cumple);
    const slide = document.createElement('div');
    slide.className = 'min-w-full px-2';
    slide.setAttribute('role','group');
    slide.setAttribute('aria-label',`Cartilla ${i+1}`);
    slide.innerHTML = `
      <div class="card p-4 border rounded-2xl ${allOk ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'} shadow-sm">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-lg font-semibold">Cartilla: ${c.nombre}</h3>
          <span class="text-xs px-2 py-1 rounded-full ${allOk ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}">
            ${allOk ? 'Completada' : 'En progreso'}
          </span>
        </div>
        <div class="overflow-x-auto -mx-2">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50">
              <tr>
                <th class="text-left px-2 py-2">Jugador</th>
                <th class="text-left px-2 py-2">Estadística</th>
                <th class="text-left px-2 py-2">Condición</th>
                <th class="text-right px-2 py-2">Objetivo</th>
                <th class="text-right px-2 py-2">Actual</th>
                <th class="text-right px-2 py-2">Restante</th>
                <th class="text-right px-2 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              ${c.lineas.map(l => {
                const ok = !!l.cumple;
                const restanteCalc = (l.actual!=null ? (l.condicion==='>='?Math.max(0, l.objetivo - l.actual):Math.max(0, l.actual - l.objetivo)) : null);
                const restante = l.restante ?? restanteCalc;
                return `
                <tr class="border-t ${ok ? 'bg-emerald-50/60 border-emerald-200' : 'border-slate-100'}">
                  <td class="px-2 py-1">${l.jugador}</td>
                  <td class="px-2 py-1">${l.estadistica}</td>
                  <td class="px-2 py-1">${l.condicion}</td>
                  <td class="px-2 py-1 text-right">${l.objetivo ?? '—'}</td>
                  <td class="px-2 py-1 text-right ${ok ? 'text-emerald-700 font-medium' : ''}">${l.actual ?? '—'}</td>
                  <td class="px-2 py-1 text-right">${restante != null ? restante : '—'}</td>
                  <td class="px-2 py-1 text-right">${ok ? '✅' : '⏳'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    container.appendChild(slide);
  });

  updateCarouselTransform();
  updateCarouselControls();
  adjustWrapHeight();
}

function updateCarouselTransform(){
  const container=$('#carousel');
  container.style.transform=`translateX(-${currentSlide*100}%)`;
  $('#carouselStatus').textContent = cartillas.length?`Mostrando ${currentSlide+1} de ${cartillas.length}`:'Sin cartillas';
}

function updateCarouselControls(){
  const dotsEl=$('#dots'); if(dotsEl) dotsEl.innerHTML='';
  if (dotsEl) {
    cartillas.forEach((c,i)=>{
      const b=document.createElement('button');
      b.className='dot ' + (i===currentSlide?'active':'');
      b.setAttribute('aria-label',`Ir a cartilla ${i+1}`);
      b.addEventListener('click',()=>{ currentSlide=i; updateCarouselTransform(); adjustWrapHeight(); syncGotoSel(); });
      dotsEl.appendChild(b);
    });
  }
  const sel=$('#gotoSel'); if(sel){
    sel.innerHTML='<option value="">—</option>' + cartillas.map((c,i)=>`<option value="${i}" ${i===currentSlide?'selected':''}>${i+1}. ${c.nombre}</option>`).join('');
  }
  const pp=$('#playPause'); if(pp) pp.textContent = autoEnabled ? 'Pausar' : 'Reproducir';
}

function syncGotoSel(){
  const sel=$('#gotoSel');
  if(sel && sel.value !== String(currentSlide)) sel.value=String(currentSlide);
  $$('#dots .dot').forEach((d,i)=>{ d.classList.toggle('active', i===currentSlide); });
}

function adjustWrapHeight(){
  const wrap=$('#carouselWrap');
  const slides=$$('#carousel > div');
  if(!wrap || !slides.length) return;
  const active=slides[currentSlide];
  const h=active?.offsetHeight || 0;
  wrap.style.height = h ? (h + 40) + 'px' : 'auto';
}

// Navigation
function nextSlide(){ if(!cartillas.length) return; currentSlide=(currentSlide+1)%cartillas.length; updateCarouselTransform(); syncGotoSel(); adjustWrapHeight(); }
function prevSlide(){ if(!cartillas.length) return; currentSlide=(currentSlide-1+cartillas.length)%cartillas.length; updateCarouselTransform(); syncGotoSel(); adjustWrapHeight(); }

function startAuto(){
  stopAuto();
  if(!autoEnabled || !cartillas.length) return;
  autoTimer = setInterval(nextSlide, autoMs);
}
function stopAuto(){ if(autoTimer) clearInterval(autoTimer); autoTimer=null; }

function toggleAuto(){
  autoEnabled = !autoEnabled;
  updateCarouselControls();
  if(autoEnabled) startAuto(); else stopAuto();
}

// Summary
function renderSummary() {
  const el = $('#summary');
  if (!el) return;
  const totalCartillas = cartillas.length;
  const completas = cartillas.filter(c => c.lineas.length && c.lineas.every(l => !!l.cumple)).length;
  const totalLineas = cartillas.reduce((acc,c)=>acc + c.lineas.length, 0);
  const lineasOk = cartillas.reduce((acc,c)=>acc + c.lineas.filter(l => l.cumple).length, 0);

  el.innerHTML = `
    <div class="p-4 rounded-2xl bg-white border border-slate-200">
      <div class="text-xs text-slate-500">Cartillas</div>
      <div class="text-2xl font-semibold">${totalCartillas}</div>
    </div>
    <div class="p-4 rounded-2xl bg-white border border-slate-200">
      <div class="text-xs text-slate-500">Cartillas completas</div>
      <div class="text-2xl font-semibold">${completas}</div>
    </div>
    <div class="p-4 rounded-2xl bg-white border border-slate-200">
      <div class="text-xs text-slate-500">Líneas totales</div>
      <div class="text-2xl font-semibold">${totalLineas}</div>
    </div>
    <div class="p-4 rounded-2xl bg-white border border-slate-200">
      <div class="text-xs text-slate-500">Líneas cumplidas</div>
      <div class="text-2xl font-semibold">${lineasOk}</div>
    </div>
  `;
}

function renderAll() {
  renderPlayersTable();
  renderCarousel();
  renderSummary();
}

function confettiBurst() {
  const conf = $('#confetti');
  if (!conf) return;
  conf.innerHTML = '';
  const emojis = ['🎉','✨','🎊','⭐','💫','🏆'];
  const n = 120;
  for (let i=0; i<n; i++) {
    const span = document.createElement('span');
    span.textContent = emojis[Math.floor(Math.random()*emojis.length)];
    span.style.left = Math.random()*100 + 'vw';
    span.style.animationDelay = (Math.random()*0.8) + 's';
    conf.appendChild(span);
  }
  setTimeout(()=>conf.innerHTML='', 3500);
}

function checkGlobalCompletion() {
  if (cartillas.length && cartillas.every(c => c.lineas.length && c.lineas.every(l=>l.cumple))) {
    confettiBurst();
  }
}

// ---------- IMPORTERS ----------
async function handleFile(file) {
  const name = file.name.toLowerCase();
  let warnings = [];
  try {
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, {type:'array'});
      const sheetNames = wb.SheetNames;
      const sheetCartillas = sheetNames.find(n => n.toLowerCase().includes('cartilla')) ?? sheetNames[0];
      const sheetJugadores = sheetNames.find(n => n.toLowerCase().includes('jugad')) ?? sheetNames[1];

      if (sheetJugadores) {
        const rowsJ = XLSX.utils.sheet_to_json(wb.Sheets[sheetJugadores], {defval:''});
        players = parseJugadoresRows(rowsJ);
      } else warnings.push('No se encontró hoja de Jugadores (opcional).');

      if (sheetCartillas) {
        const rowsC = XLSX.utils.sheet_to_json(wb.Sheets[sheetCartillas], {defval:''});
        cartillas = parseCartillasRows(rowsC);
      } else warnings.push('No se encontró hoja de Cartillas.');
    } else if (name.endsWith('.csv')) {
      const text = await file.text();
      const rows = parseCSV(text);
      if (!rows.length) { toast('CSV vacío o inválido', 'error'); return; }
      const headers = Object.keys(rows[0]).map(h=>h.toLowerCase().trim());
      if (headers.includes('valor')) {
        players = parseJugadoresRows(rows);
      } else if (headers.includes('objetivo')) {
        cartillas = parseCartillasRows(rows);
      } else {
        toast('CSV no reconocido. Usa las plantillas.', 'warn');
        showWarnings(['CSV no reconocido. Usa las plantillas de Cartillas o Jugadores.']);
        return;
      }
    } else {
      toast('Formato no soportado. Usa .xlsx o .csv', 'error');
      return;
    }

    // Recompute/Backfill from players
    for (const c of cartillas) {
      for (const l of c.lineas) {
        if (l.actual==null) {
          const p = players.find(p => p.jugador.toLowerCase()===l.jugador.toLowerCase() && p.estadistica.toLowerCase()===l.estadistica.toLowerCase());
          if (p) {
            l.actual = toNumber(p.valor);
            if (l.condicion === '>=' ) {
              l.cumple = l.actual >= l.objetivo;
              l.restante = Math.max(0, l.objetivo - l.actual);
            } else if (l.condicion === '<=' ) {
              l.cumple = l.actual <= l.objetivo;
              l.restante = Math.max(0, l.actual - l.objetivo);
            }
          }
        }
      }
    }

    saveState();
    currentSlide = 0;
    renderAll();
    if (autoEnabled) startAuto();
    checkGlobalCompletion();
    if (warnings.length) showWarnings(warnings);
    toast('Archivo cargado', 'ok');
  } catch (err) {
    console.error(err);
    toast('Error al procesar el archivo', 'error');
    showWarnings(['Error al procesar el archivo: ' + (err?.message || err)]);
  }
}

// ---------- EVENTS -----------
document.addEventListener('DOMContentLoaded', () => {
  // drag-n-drop
  const dz = document.getElementById('dropzone');
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('bg-sky-50','border-sky-300'); });
  dz.addEventListener('dragleave', e => { e.preventDefault(); dz.classList.remove('bg-sky-50','border-sky-300'); });
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('bg-sky-50','border-sky-300');
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  });

  // file input
  const fi = document.getElementById('fileInput');
  fi.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  });

  // players search
  $('#playerSearch')?.addEventListener('input', renderPlayersTable);

  // nav
  $('#nextBtn').addEventListener('click', () => { nextSlide(); if(autoEnabled){ stopAuto(); startAuto(); } });
  $('#prevBtn').addEventListener('click', () => { prevSlide(); if(autoEnabled){ stopAuto(); startAuto(); } });
  $('#playPause').addEventListener('click', () => { toggleAuto(); });

  // speed
  $('#speedSel').addEventListener('change', e=>{ autoMs = Number(e.target.value)||6000; if(autoEnabled){ stopAuto(); startAuto(); } });

  // goto
  $('#gotoSel').addEventListener('change', e=>{ const i=Number(e.target.value); if(Number.isFinite(i)){ currentSlide=i; updateCarouselTransform(); adjustWrapHeight(); syncGotoSel(); } });

  // keyboard navigation
  document.addEventListener('keydown', (e)=>{
    if(e.key==='ArrowRight'){ nextSlide(); if(autoEnabled){ stopAuto(); startAuto(); } }
    else if(e.key==='ArrowLeft'){ prevSlide(); if(autoEnabled){ stopAuto(); startAuto(); } }
    else if(e.key===' '){ e.preventDefault(); toggleAuto(); }
    else if(e.key==='Home'){ currentSlide=0; updateCarouselTransform(); adjustWrapHeight(); syncGotoSel(); }
    else if(e.key==='End'){ if(cartillas.length){ currentSlide=cartillas.length-1; updateCarouselTransform(); adjustWrapHeight(); syncGotoSel(); } }
  });

  // swipe gestures
  const wrap=$('#carouselWrap');
  let startX=null, dx=0;
  wrap.addEventListener('pointerdown', e=>{ startX=e.clientX; dx=0; wrap.setPointerCapture(e.pointerId); });
  wrap.addEventListener('pointermove', e=>{ if(startX!=null) dx=e.clientX - startX; });
  wrap.addEventListener('pointerup', e=>{
    if(startX!=null){
      if(dx<-50) nextSlide();
      else if(dx>50) prevSlide();
      startX=null; dx=0;
      if(autoEnabled){ stopAuto(); startAuto(); }
    }
  });

  // state ops
  $('#btnExport').addEventListener('click', () => {
    const payload = { players, cartillas, version: 'Bets-1.0.0', exportedAt: new Date().toISOString() };
    downloadJSON('bets_estado.json', payload);
  });
  $('#btnImport').addEventListener('click', async () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json';
    inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return;
      const txt = await f.text();
      try {
        const data = JSON.parse(txt);
        players = data.players ?? [];
        cartillas = data.cartillas ?? [];
        saveState();
        renderAll();
        if(autoEnabled) startAuto();
        checkGlobalCompletion();
        toast('Estado importado', 'ok');
      } catch(err) {
        toast('JSON inválido', 'error');
      }
    };
    inp.click();
  });
  $('#btnClear').addEventListener('click', () => {
    if (confirm('¿Borrar estado local (cartillas y jugadores)?')) {
      localStorage.removeItem(STATE_KEYS.players);
      localStorage.removeItem(STATE_KEYS.cartillas);
      players = [];
      cartillas = [];
      renderAll();
      $('#carouselStatus').textContent = 'Sin cartillas';
      toast('Estado borrado', 'ok');
    }
  });

  // print columns toggle
  $('#printCols').addEventListener('change', (e) => {
    const v = e.target.value;
    document.body.classList.remove('print-cols-2','print-cols-3');
    if (v === '2') document.body.classList.add('print-cols-2');
    if (v === '3') document.body.classList.add('print-cols-3');
    toast(`Modo impresión columnas: ${v==='0'?'Auto':v}`, 'info');
  });

  // initial
  loadState();
  renderAll();
  adjustWrapHeight();
});
