// Bets visible app (unified, final)
const K_PLAYERS='bets_players', K_SLIPS='bets_cartillas';
let players=[], cartillas=[];
const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const norm=s=>(s??'').toString().trim(); const num=v=>{ if(v===null||v===undefined||v==='') return null; const n=Number(String(v).replace(',','.')); return Number.isFinite(n)?n:null; };

function save(){ localStorage.setItem(K_PLAYERS, JSON.stringify(players)); localStorage.setItem(K_SLIPS, JSON.stringify(cartillas)); }
function load(){ try{ players=JSON.parse(localStorage.getItem(K_PLAYERS)||'[]'); cartillas=JSON.parse(localStorage.getItem(K_SLIPS)||'[]'); }catch(e){ players=[]; cartillas=[]; } }

function showUI(visible){
  $('#emptyState').classList.toggle('hidden', visible);
  $('#appUI').classList.toggle('hidden', !visible);
  $('#summaryWrap').classList.toggle('hidden', !visible);
}

function toast(msg,type='info'){
  const t=$('#toast'); if(!t) return;
  const c={info:'bg-sky-600',warn:'bg-amber-600',error:'bg-rose-600',ok:'bg-emerald-600'};
  t.className='fixed top-3 right-3 max-w-sm z-30';
  t.innerHTML=`<div class="text-white ${c[type]||c.info} rounded-xl shadow-lg px-4 py-3">${msg}</div>`;
  setTimeout(()=>t.removeAttribute('class'),2200);
}

const REQ_C=['cartilla','jugador','estadistica','condicion','objetivo'];
const REQ_P=['jugador','estadistica','valor'];
function coerce(rows){ return rows.map(r=>{ const o={}; for(const k in r){ const kl=k.toLowerCase().trim().replace('estadística','estadistica').replace('condición','condicion'); o[kl]=r[k]; } return o; }); }
function validate(rows, req){ if(!rows?.length) return ['No se encontraron filas']; const headers=Object.keys(rows[0]).map(h=>h.toLowerCase().trim()); const miss=req.filter(r=>!headers.includes(r)); return miss.length?[`Faltan columnas: ${miss.join(', ')}`]:[]; }
function parsePlayers(rows){ rows=coerce(rows); const w=validate(rows,REQ_P); if(w.length) console.warn(w.join('; ')); const out=[]; rows.forEach(r=>{ const jugador=norm(r['jugador']); const estadistica=norm(r['estadistica']); const valor=num(r['valor']); if(jugador&&estadistica&&valor!==null) out.push({jugador,estadistica,valor});}); return out;}
function parseSlips(rows){ rows=coerce(rows); const w=validate(rows,REQ_C); if(w.length) console.warn(w.join('; ')); const by=new Map(); rows.forEach(r=>{ const cartilla=norm(r['cartilla']); const jugador=norm(r['jugador']); const estadistica=norm(r['estadistica']); const condicion=norm(r['condicion']).replace(/\s+/g,''); const objetivo=num(r['objetivo']); let actual=r.hasOwnProperty('actual')?num(r['actual']):null; if(!cartilla||!jugador||!estadistica||!condicion||objetivo===null) return; if(!by.has(cartilla)) by.set(cartilla,{id:cartilla,nombre:cartilla,lineas:[]}); if(actual===null){ const p=players.find(p=>p.jugador.toLowerCase()===jugador.toLowerCase()&&p.estadistica.toLowerCase()===estadistica.toLowerCase()); if(p) actual=num(p.valor);} let cumple=false,restante=null; if(actual!==null){ if(condicion==='>='){ cumple=actual>=objetivo; restante=Math.max(0,objetivo-actual);} else if(condicion==='<='){ cumple=actual<=objetivo; restante=Math.max(0,actual-objetivo);} } by.get(cartilla).lineas.push({jugador,estadistica,condicion,objetivo,actual,restante,cumple});}); return Array.from(by.values());}
function parseCSV(text){ const rows=[]; let row=[],field='',q=false; for(let i=0;i<text.length;i++){ const c=text[i]; if(c=='\"'){ if(q&&text[i+1]=='\"'){ field+='\"'; i++; } else q=!q; } else if(c===','&&!q){ row.push(field); field=''; } else if((c==='\n'||c==='\r')&&!q){ if(field!==''||row.length){ row.push(field); rows.push(row); row=[]; field=''; } if(c==='\r'&&text[i+1]==='\n') i++; } else field+=c; } if(field!==''||row.length){ row.push(field); rows.push(row); } if(!rows.length) return []; const headers=rows[0].map(h=>h.trim()); return rows.slice(1).filter(r=>r.some(x=>x.trim()!='')).map(r=>{ const o={}; headers.forEach((h,i)=>o[h]=r[i]??''); return o; }); }

let current=0, timer=null, auto=false, speed=6000;

function renderPlayers(){
  const tb=$('#playersTable'); if(!tb) return; tb.innerHTML='';
  const q=(($('#playerSearch')?.value)||'').toLowerCase();
  players.filter(p=>!q||p.jugador.toLowerCase().includes(q)).sort((a,b)=>a.jugador.localeCompare(b.jugador)||a.estadistica.localeCompare(b.estadistica)).forEach((p,i)=>{
    const tr=document.createElement('tr'); tr.className='border-t border-slate-100';
    tr.innerHTML = `<td class="px-3 py-2">${p.jugador}</td><td class="px-3 py-2">${p.estadistica}</td>
      <td class="px-3 py-2 text-right"><input data-i="${i}" type="number" class="w-24 px-2 py-1 border border-slate-300 rounded-lg text-right" value="${p.valor??''}"/></td>`;
    tb.appendChild(tr);
  });
  $$('input[type="number"]',tb).forEach(inp=>inp.addEventListener('change',()=>{
    const i=Number(inp.dataset.i), v=num(inp.value); players[i].valor=v; cascade(players[i]); save(); renderAll();
  }));
}

function cascade(p){
  for(const c of cartillas){ for(const l of c.lineas){
    if(l.jugador.toLowerCase()===p.jugador.toLowerCase()&&l.estadistica.toLowerCase()===p.estadistica.toLowerCase()){
      l.actual=p.valor;
      if(l.condicion==='>='){ l.cumple=p.valor>=l.objetivo; l.restante=Math.max(0,l.objetivo-p.valor); }
      else if(l.condicion==='<='){ l.cumple=p.valor<=l.objetivo; l.restante=Math.max(0,p.valor-l.objetivo); }
    }
  } }
}

function renderCarousel(){
  const wrap=$('#carousel'); if(!wrap) return; wrap.innerHTML='';
  cartillas.forEach((sl,i)=>{
    const allOk=sl.lineas.length>0 && sl.lineas.every(l=>!!l.cumple);
    const el=document.createElement('div'); el.className='min-w-full px-2';
    el.innerHTML = `<div class="p-4 border rounded-2xl ${allOk?'border-emerald-300 bg-emerald-50':'border-slate-200 bg-white'} shadow-sm">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-lg font-semibold">Cartilla: ${sl.nombre}</h3>
        <span class="text-xs px-2 py-1 rounded-full ${allOk?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-600'}">${allOk?'Completada':'En progreso'}</span>
      </div>
      <div class="-mx-2 overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-50">
            <tr><th class="text-left px-2 py-2">Jugador</th><th class="text-left px-2 py-2">Estadística</th><th class="text-left px-2 py-2">Condición</th><th class="text-right px-2 py-2">Objetivo</th><th class="text-right px-2 py-2">Actual</th><th class="text-right px-2 py-2">Restante</th><th class="text-right px-2 py-2">Estado</th></tr>
          </thead>
          <tbody>${
            sl.lineas.map(l=>{
              const ok=!!l.cumple;
              const restante=(l.actual!=null?(l.condicion==='>='?Math.max(0,l.objetivo-l.actual):Math.max(0,l.actual-l.objetivo)):null);
              return `<tr class="border-t ${ok?'bg-emerald-50/60 border-emerald-200':'border-slate-100'}">
                <td class="px-2 py-1">${l.jugador}</td><td class="px-2 py-1">${l.estadistica}</td><td class="px-2 py-1">${l.condicion}</td>
                <td class="px-2 py-1 text-right">${l.objetivo??'—'}</td>
                <td class="px-2 py-1 text-right ${ok?'text-emerald-700 font-medium':''}">${l.actual??'—'}</td>
                <td class="px-2 py-1 text-right">${restante!=null?restante:'—'}</td>
                <td class="px-2 py-1 text-right">${ok?'✅':'⏳'}</td></tr>`;
            }).join('')
          }</tbody>
        </table>
      </div>
    </div>`;
    wrap.appendChild(el);
  });
  updateTransform(); updateControls(); adjustHeight();
}

function updateTransform(){ const c=$('#carousel'); c.style.transform=`translateX(-${current*100}%)`; $('#carouselStatus').textContent=cartillas.length?`Mostrando ${current+1} de ${cartillas.length}`:'Sin cartillas'; }
function updateControls(){
  const dots=$('#dots'); if(dots){ dots.innerHTML=''; cartillas.forEach((_,i)=>{ const b=document.createElement('button'); b.className='dot '+(i===current?'active':''); b.addEventListener('click',()=>{ current=i; updateTransform(); adjustHeight(); syncGoto(); }); dots.appendChild(b); }); }
  const sel=$('#gotoSel'); if(sel){ sel.innerHTML='<option value=\"\">—</option>'+cartillas.map((c,i)=>`<option value="${i}" ${i===current?'selected':''}>${i+1}. ${c.nombre}</option>`).join(''); }
  const pp=$('#playPause'); if(pp) pp.textContent=auto?'Pausar':'Reproducir';
}
function syncGoto(){ const sel=$('#gotoSel'); if(sel && sel.value!==String(current)) sel.value=String(current); $$('#dots .dot').forEach((d,i)=>d.classList.toggle('active', i===current)); }
function adjustHeight(){ const wrap=$('#carouselWrap'); const slides=$$('#carousel > div'); if(!wrap||!slides.length) return; const active=slides[current]; const h=active?.offsetHeight||0; wrap.style.height=h?(h+40)+'px':'auto'; }
function next(){ if(!cartillas.length) return; current=(current+1)%cartillas.length; updateTransform(); syncGoto(); adjustHeight(); }
function prev(){ if(!cartillas.length) return; current=(current-1+cartillas.length)%cartillas.length; updateTransform(); syncGoto(); adjustHeight(); }
function start(){ stop(); if(!auto||!cartillas.length) return; timer=setInterval(next, speed); }
function stop(){ if(timer) clearInterval(timer); timer=null; }
function toggleAuto(){ auto=!auto; updateControls(); if(auto) start(); else stop(); }

function renderSummary(){
  const el=$('#summary'); if(!el) return; const total=cartillas.length;
  const comp=cartillas.filter(c=>c.lineas.length && c.lineas.every(l=>!!l.cumple)).length;
  const totL=cartillas.reduce((a,c)=>a+c.lineas.length,0);
  const okL=cartillas.reduce((a,c)=>a+c.lineas.filter(l=>l.cumple).length,0);
  el.innerHTML = `
    <div class="p-4 rounded-2xl bg-white border border-slate-200"><div class="text-xs text-slate-500">Cartillas</div><div class="text-2xl font-semibold">${total}</div></div>
    <div class="p-4 rounded-2xl bg-white border border-slate-200"><div class="text-xs text-slate-500">Completas</div><div class="text-2xl font-semibold">${comp}</div></div>
    <div class="p-4 rounded-2xl bg-white border border-slate-200"><div class="text-xs text-slate-500">Líneas totales</div><div class="text-2xl font-semibold">${totL}</div></div>
    <div class="p-4 rounded-2xl bg-white border border-slate-200"><div class="text-xs text-slate-500">Líneas cumplidas</div><div class="text-2xl font-semibold">${okL}</div></div>`;
}

function renderAll(){ renderPlayers(); renderCarousel(); renderSummary(); }

async function handleFile(file){
  const name=file.name.toLowerCase();
  try{
    if(name.endsWith('.xlsx')||name.endsWith('.xls')){
      const buf=await file.arrayBuffer(); const wb=XLSX.read(buf,{type:'array'}); const sheets=wb.SheetNames;
      const sC=sheets.find(n=>n.toLowerCase().includes('cartilla')) ?? sheets[0];
      const sP=sheets.find(n=>n.toLowerCase().includes('jugad')) ?? sheets[1];
      if(sP) players=parsePlayers(XLSX.utils.sheet_to_json(wb.Sheets[sP],{defval:''}));
      if(sC) cartillas=parseSlips(XLSX.utils.sheet_to_json(wb.Sheets[sC],{defval:''}));
    } else if(name.endsWith('.csv')){
      const text=await file.text(); const rows=parseCSV(text);
      if(!rows.length) return toast('CSV vacío','error');
      const headers=Object.keys(rows[0]).map(h=>h.toLowerCase());
      if(headers.includes('valor')) players=parsePlayers(rows);
      else if(headers.includes('objetivo')) cartillas=parseSlips(rows);
      else return toast('CSV no reconocido','warn');
    } else { return toast('Formato no soportado','error'); }
    for(const c of cartillas){ for(const l of c.lineas){ if(l.actual==null){ const p=players.find(p=>p.jugador.toLowerCase()===l.jugador.toLowerCase()&&p.estadistica.toLowerCase()===l.estadistica.toLowerCase()); if(p){ l.actual=num(p.valor); if(l.condicion==='>='){ l.cumple=l.actual>=l.objetivo; l.restante=Math.max(0,l.objetivo-l.actual);} else if(l.condicion==='<='){ l.cumple=l.actual<=l.objetivo; l.restante=Math.max(0,l.actual-l.objetivo);} } } } }
    save(); current=0; showUI(true); renderAll(); if(auto) start(); toast('Archivo cargado','ok');
  }catch(err){ console.error(err); toast('Error al procesar el archivo','error'); }
}

function loadDemo(){
  players=[
    {jugador:'Jugador A', estadistica:'Yds Rec', valor:63},
    {jugador:'Jugador B', estadistica:'Yds Tierra', valor:55},
    {jugador:'Jugador C', estadistica:'Recs', valor:3}
  ];
  cartillas=[
    {id:'Slip 001', nombre:'Slip 001', lineas:[
      {jugador:'Jugador A', estadistica:'Yds Rec', condicion: '>=', objetivo:70, actual:63, restante:7, cumple:false},
      {jugador:'Jugador B', estadistica:'Yds Tierra', condicion: '>=', objetivo:60, actual:55, restante:5, cumple:false}
    ]},
    {id:'Slip 002', nombre:'Slip 002', lineas:[
      {jugador:'Jugador C', estadistica:'Recs', condicion: '>=', objetivo:5, actual:3, restante:2, cumple:false}
    ]}
  ];
  save(); current=0; showUI(true); renderAll(); toast('Demo cargada','ok');
}

document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('fileInput')?.addEventListener('change', e=>{ const f=e.target.files?.[0]; if(f) handleFile(f); });
  document.getElementById('btnDemo')?.addEventListener('click', loadDemo);
  document.getElementById('prevBtn')?.addEventListener('click', ()=>{ prev(); if(auto){ clearInterval(timer); start(); } });
  document.getElementById('nextBtn')?.addEventListener('click', ()=>{ next(); if(auto){ clearInterval(timer); start(); } });
  document.getElementById('playPause')?.addEventListener('click', toggleAuto);
  document.getElementById('speedSel')?.addEventListener('change', e=>{ speed=Number(e.target.value)||6000; if(auto){ clearInterval(timer); start(); } });
  document.getElementById('gotoSel')?.addEventListener('change', e=>{ const i=Number(e.target.value); if(Number.isFinite(i)){ current=i; updateTransform(); adjustHeight(); syncGoto(); } });
  document.getElementById('playerSearch')?.addEventListener('input', renderPlayers);

  load();
  if(cartillas.length){ showUI(true); } else { showUI(false); }
  renderAll(); adjustHeight();
});
