/* MMSports v1.4.0-merged - Enhanced Carousel merged into v1-2-full */
const STATE_KEYS = { players:'mmsports_players', cartillas:'mmsports_cartillas' };
let players = [];
let cartillas = [];

// -------- Utils ----------
const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
const normalize = s => (s ?? '').toString().trim();
const toNumber = v => (v===''||v==null?null:(Number(String(v).replace(',','.'))));

const saveState = ()=>{ localStorage.setItem(STATE_KEYS.players, JSON.stringify(players)); localStorage.setItem(STATE_KEYS.cartillas, JSON.stringify(cartillas)); }
const loadState = ()=>{
  try { players = JSON.parse(localStorage.getItem(STATE_KEYS.players)||'[]'); cartillas = JSON.parse(localStorage.getItem(STATE_KEYS.cartillas)||'[]'); }
  catch(e){ players=[]; cartillas=[]; }
};

function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}

// -------- Carousel State ----------
let currentSlide = 0;
let autoTimer = null;
let autoEnabled = false;
let autoMs = 6000;

// -------- Players & Cartillas Parsing ----------
function coerceHeaders(rows){
  return rows.map(r=>{
    const o={};
    for (const k in r){
      const kl=k.toLowerCase().trim().replace('estadística','estadistica').replace('condición','condicion');
      o[kl]=r[k];
    }
    return o;
  });
}

function parseJugadoresRows(rows){
  rows=coerceHeaders(rows);
  const out=[];
  rows.forEach(r=>{
    const jugador=normalize(r['jugador']);
    const estadistica=normalize(r['estadistica']);
    const valor=toNumber(r['valor']);
    if(jugador&&estadistica&&valor!==null) out.push({jugador,estadistica,valor});
  });
  return out;
}
function parseCartillasRows(rows){
  rows=coerceHeaders(rows);
  const byId = new Map();
  rows.forEach(r=>{
    const cartilla=normalize(r['cartilla']);
    const jugador=normalize(r['jugador']);
    const estadistica=normalize(r['estadistica']);
    const condicion=normalize(r['condicion']).replace(/\s+/g,'');
    const objetivo=toNumber(r['objetivo']);
    let actual = r.hasOwnProperty('actual') ? toNumber(r['actual']) : null;
    if(!cartilla||!jugador||!estadistica||!condicion||objetivo===null) return;
    if(!byId.has(cartilla)) byId.set(cartilla,{id:cartilla,nombre:cartilla,lineas:[]});
    if(actual===null){
      const p = players.find(p=>p.jugador.toLowerCase()===jugador.toLowerCase()&&p.estadistica.toLowerCase()===estadistica.toLowerCase());
      if(p) actual = toNumber(p.valor);
    }
    let cumple=false, restante=null;
    if(actual!==null){
      if(condicion==='>='){ cumple = actual>=objetivo; restante=Math.max(0,objetivo-actual); }
      else if(condicion==='<='){ cumple = actual<=objetivo; restante=Math.max(0,actual-objetivo); }
    }
    byId.get(cartilla).lineas.push({jugador,estadistica,condicion,objetivo,actual,restante,cumple});
  });
  return Array.from(byId.values());
}

// CSV robust
function parseCSV(text) {
  const rows=[]; let row=[]; let field=''; let inQ=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='\"'){
      if(inQ && text[i+1]==='\"'){ field+='\"'; i++; }
      else inQ=!inQ;
    } else if(c===',' && !inQ){ row.push(field); field=''; }
    else if((c==='\n'||c==='\r') && !inQ){ if(field!==''||row.length){ row.push(field); rows.push(row); row=[]; field=''; } if(c==='\r'&&text[i+1]==='\n') i++; }
    else field+=c;
  }
  if(field!==''||row.length){ row.push(field); rows.push(row); }
  if(!rows.length) return [];
  const headers=rows[0].map(h=>h.trim());
  return rows.slice(1).filter(r=>r.some(x=>x.trim()!=='')).map(r=>{ const o={}; headers.forEach((h,i)=>o[h]=r[i]??''); return o; });
}

// -------- Rendering ----------
function renderPlayersTable(){
  const tbody=$('#playersTable'); if(!tbody) return;
  tbody.innerHTML='';
  const q=normalize($('#playerSearch')?.value||'').toLowerCase();
  players.filter(p=>!q||p.jugador.toLowerCase().includes(q))
    .sort((a,b)=>a.jugador.localeCompare(b.jugador)||a.estadistica.localeCompare(b.estadistica))
    .forEach((p,idx)=>{
      const tr=document.createElement('tr'); tr.className='border-t border-slate-100';
      tr.innerHTML=`<td class="px-3 py-2">${p.jugador}</td>
        <td class="px-3 py-2">${p.estadistica}</td>
        <td class="px-3 py-2 text-right"><input data-idx="${idx}" type="number" class="w-24 px-2 py-1 border border-slate-300 rounded-lg text-right" value="${p.valor??''}"/></td>`;
      tbody.appendChild(tr);
    });
  $$('input[type="number"]',tbody).forEach(inp=>{
    inp.addEventListener('change',()=>{
      const i=Number(inp.dataset.idx); const v=toNumber(inp.value);
      players[i].valor=v; cascadePlayersToCartillas(players[i]); saveState(); renderAll(); checkGlobalCompletion();
    });
  });
}

function cascadePlayersToCartillas(p){
  for(const c of cartillas){
    for(const l of c.lineas){
      if(l.jugador.toLowerCase()===p.jugador.toLowerCase() && l.estadistica.toLowerCase()===p.estadistica.toLowerCase()){
        l.actual=p.valor;
        if(l.condicion==='>='){ l.cumple=p.valor>=l.objetivo; l.restante=Math.max(0,l.objetivo-p.valor); }
        else if(l.condicion==='<='){ l.cumple=p.valor<=l.objetivo; l.restante=Math.max(0,p.valor-l.objetivo); }
      }
    }
  }
}

function renderCarousel(){
  const container=$('#carousel'); if(!container) return;
  container.innerHTML='';
  cartillas.forEach((c,i)=>{
    const allOk = c.lineas.length>0 && c.lineas.every(l=>!!l.cumple);
    const slide=document.createElement('div');
    slide.className='min-w-full px-2';
    slide.setAttribute('role','group');
    slide.setAttribute('aria-label',`Cartilla ${i+1}`);
    slide.innerHTML=`
      <div class="card p-4 border rounded-2xl ${allOk?'border-emerald-300 bg-emerald-50':'border-slate-200 bg-white'} shadow-sm">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-lg font-semibold">Cartilla: ${c.nombre}</h3>
          <span class="text-xs px-2 py-1 rounded-full ${allOk?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-600'}">
            ${allOk?'Completada':'En progreso'}
          </span>
        </div>
        <div class="-mx-2 overflow-x-auto">
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
              ${c.lineas.map(l=>{
                const ok=!!l.cumple;
                const restanteCalc=(l.actual!=null ? (l.condicion==='>='?Math.max(0,l.objetivo-l.actual):Math.max(0,l.actual-l.objetivo)) : null);
                const restante=l.restante ?? restanteCalc;
                return `<tr class="border-t ${ok?'bg-emerald-50/60 border-emerald-200':'border-slate-100'}">
                  <td class="px-2 py-1">${l.jugador}</td>
                  <td class="px-2 py-1">${l.estadistica}</td>
                  <td class="px-2 py-1">${l.condicion}</td>
                  <td class="px-2 py-1 text-right">${l.objetivo ?? '—'}</td>
                  <td class="px-2 py-1 text-right ${ok?'text-emerald-700 font-medium':''}">${l.actual ?? '—'}</td>
                  <td class="px-2 py-1 text-right">${restante!=null?restante:'—'}</td>
                  <td class="px-2 py-1 text-right">${ok?'✅':'⏳'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    container.appendChild(slide);
  });

  // Update transform & status
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
  // toolbar elements exist? ensure create if missing
  if(!$('#dots')){
    const dots=document.createElement('div'); dots.id='dots'; $('#carouselWrap')?.appendChild(dots);
  }
  const dotsEl=$('#dots'); dotsEl.innerHTML='';
  cartillas.forEach((c,i)=>{
    const b=document.createElement('button');
    b.className='dot ' + (i===currentSlide?'active':'');
    b.setAttribute('aria-label',`Ir a cartilla ${i+1}`);
    b.addEventListener('click',()=>{ currentSlide=i; updateCarouselTransform(); adjustWrapHeight(); syncGotoSel(); });
    dotsEl.appendChild(b);
  });
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
function renderSummary(){
  const el=$('#summary'); if(!el) return;
  const totalCartillas=cartillas.length;
  const completas=cartillas.filter(c=>c.lineas.length && c.lineas.every(l=>!!l.cumple)).length;
  const totalLineas=cartillas.reduce((a,c)=>a+c.lineas.length,0);
  const lineasOk=cartillas.reduce((a,c)=>a+c.lineas.filter(l=>l.cumple).length,0);
  el.innerHTML=`
    <div class="p-4 rounded-2xl bg-white border border-slate-200"><div class="text-xs text-slate-500">Cartillas</div><div class="text-2xl font-semibold">${totalCartillas}</div></div>
    <div class="p-4 rounded-2xl bg-white border border-slate-200"><div class="text-xs text-slate-500">Completas</div><div class="text-2xl font-semibold">${completas}</div></div>
    <div class="p-4 rounded-2xl bg-white border border-slate-200"><div class="text-xs text-slate-500">Líneas totales</div><div class="text-2xl font-semibold">${totalLineas}</div></div>
    <div class="p-4 rounded-2xl bg-white border border-slate-200"><div class="text-xs text-slate-500">Líneas cumplidas</div><div class="text-2xl font-semibold">${lineasOk}</div></div>
  `;
}

function renderAll(){ renderPlayersTable(); renderCarousel(); renderSummary(); }

function confettiBurst(){
  const conf=$('#confetti'); if(!conf) return;
  conf.innerHTML='';
  const emojis=['🎉','✨','🎊','⭐','💫','🏆']; const n=100;
  for(let i=0;i<n;i++){ const s=document.createElement('span'); s.textContent=emojis[Math.floor(Math.random()*emojis.length)]; s.style.left=Math.random()*100+'vw'; s.style.animationDelay=(Math.random()*0.8)+'s'; conf.appendChild(s); }
  setTimeout(()=>conf.innerHTML='', 3500);
}

function checkGlobalCompletion(){
  if(cartillas.length && cartillas.every(c=>c.lineas.length && c.lineas.every(l=>l.cumple))) confettiBurst();
}

// Importers
async function handleFile(file){
  const name=file.name.toLowerCase();
  if(name.endsWith('.xlsx')||name.endsWith('.xls')){
    const buf=await file.arrayBuffer(); const wb=XLSX.read(buf,{type:'array'});
    const sheetNames=wb.SheetNames;
    const sC=sheetNames.find(n=>n.toLowerCase().includes('cartilla')) ?? sheetNames[0];
    const sJ=sheetNames.find(n=>n.toLowerCase().includes('jugad')) ?? sheetNames[1];
    if(sJ){ const rowsJ=XLSX.utils.sheet_to_json(wb.Sheets[sJ],{defval:''}); players=parseJugadoresRows(rowsJ); }
    if(sC){ const rowsC=XLSX.utils.sheet_to_json(wb.Sheets[sC],{defval:''}); cartillas=parseCartillasRows(rowsC); }
  } else if(name.endsWith('.csv')){
    const text=await file.text(); const rows=parseCSV(text);
    if(!rows.length) return alert('CSV vacío');
    const headers=Object.keys(rows[0]).map(h=>h.toLowerCase());
    if(headers.includes('valor')) players=parseJugadoresRows(rows);
    else if(headers.includes('objetivo')) cartillas=parseCartillasRows(rows);
    else return alert('CSV no reconocido');
  } else { return alert('Formato no soportado'); }

  // Backfill
  for(const c of cartillas){
    for(const l of c.lineas){
      if(l.actual==null){
        const p=players.find(p=>p.jugador.toLowerCase()===l.jugador.toLowerCase()&&p.estadistica.toLowerCase()===l.estadistica.toLowerCase());
        if(p){
          l.actual=toNumber(p.valor);
          if(l.condicion==='>='){ l.cumple=l.actual>=l.objetivo; l.restante=Math.max(0,l.objetivo-l.actual); }
          else if(l.condicion==='<='){ l.cumple=l.actual<=l.objetivo; l.restante=Math.max(0,l.actual-l.objetivo); }
        }
      }
    }
  }

  saveState(); currentSlide=0; renderAll(); if(autoEnabled) startAuto(); checkGlobalCompletion();
}

// -------- Events --------
document.addEventListener('DOMContentLoaded', ()=>{
  // DnD
  const dz=$('#dropzone');
  dz.addEventListener('dragover',e=>{e.preventDefault(); dz.classList.add('bg-sky-50','border-sky-300');});
  dz.addEventListener('dragleave',e=>{e.preventDefault(); dz.classList.remove('bg-sky-50','border-sky-300');});
  dz.addEventListener('drop',e=>{e.preventDefault(); dz.classList.remove('bg-sky-50','border-sky-300'); const file=e.dataTransfer.files?.[0]; if(file) handleFile(file); });

  // File input
  $('#fileInput').addEventListener('change', e=>{ const f=e.target.files?.[0]; if(f) handleFile(f); });

  // Players search
  $('#playerSearch')?.addEventListener('input', renderPlayersTable);

  // Carousel buttons
  $('#nextBtn').addEventListener('click', ()=>{ nextSlide(); if(autoEnabled){ stopAuto(); startAuto(); } });
  $('#prevBtn').addEventListener('click', ()=>{ prevSlide(); if(autoEnabled){ stopAuto(); startAuto(); } });
  $('#playPause').addEventListener('click', ()=>{ toggleAuto(); });

  // Speed
  $('#speedSel').addEventListener('change', e=>{ autoMs = Number(e.target.value)||6000; if(autoEnabled){ stopAuto(); startAuto(); } });

  // Goto
  $('#gotoSel').addEventListener('change', e=>{ const i=Number(e.target.value); if(Number.isFinite(i)){ currentSlide=i; updateCarouselTransform(); adjustWrapHeight(); syncGotoSel(); } });

  // Keyboard navigation
  document.addEventListener('keydown', (e)=>{
    if(e.key==='ArrowRight'){ nextSlide(); if(autoEnabled){ stopAuto(); startAuto(); } }
    else if(e.key==='ArrowLeft'){ prevSlide(); if(autoEnabled){ stopAuto(); startAuto(); } }
    else if(e.key===' '){ e.preventDefault(); toggleAuto(); }
    else if(e.key==='Home'){ currentSlide=0; updateCarouselTransform(); adjustWrapHeight(); syncGotoSel(); }
    else if(e.key==='End'){ if(cartillas.length){ currentSlide=cartillas.length-1; updateCarouselTransform(); adjustWrapHeight(); syncGotoSel(); } }
  });

  // Swipe gestures
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

  // Export/Import/Clear
  $('#btnExport').addEventListener('click', ()=>{ const payload={players,cartillas,version:'1.4.0-merged',exportedAt:new Date().toISOString()}; downloadJSON('mmsports_estado.json', payload); });
  $('#btnImport').addEventListener('click', async ()=>{
    const inp=document.createElement('input'); inp.type='file'; inp.accept='application/json';
    inp.onchange=async()=>{ const f=inp.files?.[0]; if(!f) return; const txt=await f.text(); try{ const data=JSON.parse(txt); players=data.players??[]; cartillas=data.cartillas??[]; saveState(); renderAll(); if(autoEnabled) startAuto(); } catch{ alert('JSON inválido'); } };
    inp.click();
  });
  $('#btnClear').addEventListener('click', ()=>{
    if(confirm('¿Borrar estado local?')){ localStorage.removeItem(STATE_KEYS.players); localStorage.removeItem(STATE_KEYS.cartillas); players=[]; cartillas=[]; renderAll(); $('#carouselStatus').textContent='Sin cartillas'; }
  });

  // Init
  loadState(); renderAll(); adjustWrapHeight();
});
