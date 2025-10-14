
// ===== NFL XLSX Uploader (XLSX sheet -> cartillas) =====
(function(){
  const drop = document.getElementById('dropNFL');
  const inp = document.getElementById('fileNFL');
  const btnImport = document.getElementById('btnNFLImport');
  const fileNameEl = document.getElementById('nflFileName');
  const statusEl = document.getElementById('nflImportStatus');
  const btnWarn = document.getElementById('btnNFLWarnings');

  if(!drop || !inp || !btnImport) return;

  let nflFile = null;
  function setFile(f){
    nflFile = f;
    fileNameEl.textContent = f ? f.name : 'Ningún archivo seleccionado';
    btnImport.disabled = !f;
  }

  drop.addEventListener('click', ()=> inp.click());
  drop.addEventListener('dragover', (e)=>{ e.preventDefault(); drop.classList.add('bg-slate-100'); });
  drop.addEventListener('dragleave', ()=> drop.classList.remove('bg-slate-100'));
  drop.addEventListener('drop', (e)=>{
    e.preventDefault(); drop.classList.remove('bg-slate-100');
    const f = e.dataTransfer.files?.[0]; if(f) setFile(f);
  });
  inp.addEventListener('change', (e)=>{ const f = e.target.files?.[0]; if(f) setFile(f); });

  function aliasHeader(h){
    h = (h||'').toString().trim().toLowerCase();
    const map = {
      cartilla:['cartilla','slip','parlay','apuesta','ticket'],
      jugador:['jugador','player','nombre'],
      estadistica:['estadistica','stat','mercado','market'],
      condicion:['condicion','condición','condition','signo','symbol','over/under','pick','tipo'],
      objetivo:['objetivo','linea','línea','line','target','prop'],
      actual:['actual','valor actual','live','resultado','value'],
      equipo:['equipo','team'],
      rival:['rival','opponent','opp'],
      fecha:['fecha','date','game date'],
      semana:['semana','week','wk'],
      cuota:['cuota','odds','odd'],
      stake:['stake','monto','wager','unidad','units','u'],
      partido:['partido','game','match','matchup'],
      idpartido:['partidoid','gameid','gid']
    };
    for(const k in map){ if(map[k].includes(h)) return k; }
    return h; // default
  }

  function normCond(c){
    c = (c||'').toString().trim().toLowerCase();
    if(c === 'over' || c === 'o' || c === '>' || c === '≥' || c === '=>') return '>=';
    if(c === 'under' || c === 'u' || c === '<' || c === '≤' || c === '=<') return '<=';
    if(c === '>=' || c === '<=') return c;
    return '>=';
  }

  function toNumber(v){
    if(v===null||v===undefined||v==='') return null;
    const n = Number(String(v).replace(',','.'));
    return Number.isFinite(n) ? n : null;
  }

  function parseSheetRows(rows){
    if(!rows?.length) return {warns:['La hoja está vacía'], slips:[]};
    const canon = rows.map(r=>{
      const o={};
      Object.keys(r).forEach(h=>{ o[aliasHeader(h)] = r[h]; });
      return o;
    });
    const headers = Object.keys(canon[0]||{});
    const required = ['cartilla','jugador','estadistica','condicion','objetivo'];
    const missing = required.filter(k=>!headers.includes(k));
    const warns = [];
    if(missing.length) warns.push('Faltan columnas requeridas: '+missing.join(', '));

    const slipsMap = new Map();
    for(const r of canon){
      const cartilla = (r.cartilla||'').toString().trim();
      const jugador = (r.jugador||'').toString().trim();
      const estadistica = (r.estadistica||'').toString().trim();
      const condicion = normCond(r.condicion);
      const objetivo = toNumber(r.objetivo);
      let actual = r.hasOwnProperty('actual') ? toNumber(r.actual) : null;
      if(!cartilla || !jugador || !estadistica || !condicion || objetivo===null){
        warns.push(`Fila incompleta ignorada (Cartilla=${cartilla||'—'}, Jugador=${jugador||'—'})`);
        continue;
      }
      if(!slipsMap.has(cartilla)) slipsMap.set(cartilla,{id:cartilla, nombre:cartilla, lineas:[]});
      const meta = {equipo:r.equipo??null, rival:r.rival??null, fecha:r.fecha??r.semana??null, semana:r.semana??null, cuota:r.cuota!=null?String(r.cuota):null, stake:r.stake!=null?toNumber(r.stake):null, partido:r.partido??null, idpartido:r.idpartido??null};
      if(actual==null){
        const p = players.find(p=>p.jugador.toLowerCase()===jugador.toLowerCase() && p.estadistica.toLowerCase()===estadistica.toLowerCase());
        if(p) actual = toNumber(p.valor);
      }
      let cumple=false, restante=null;
      if(actual!==null){
        if(condicion === '>='){ cumple = actual>=objetivo; restante = Math.max(0, objetivo-actual); }
        else if(condicion === '<='){ cumple = actual<=objetivo; restante = Math.max(0, actual-objetivo); }
      }
      slipsMap.get(cartilla).lineas.push({jugador,estadistica,condicion,objetivo,actual,restante,cumple,meta});
    }
    return {warns, slips:[...slipsMap.values()]};
  }

  async function handleNFLFile(file){
    statusEl.textContent = 'Leyendo XLSX…';
    try{
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, {type:'array'});
      const sheetNames = wb.SheetNames || [];
      if(!sheetNames.length){ toast('XLSX sin hojas','error'); statusEl.textContent=''; return; }
      const pick = sheetNames.find(n=>/cartillas? *nfl/i.test(n)) || sheetNames.find(n=>/cartillas?/i.test(n)) || sheetNames[0];
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[pick], {defval:''});
      const {warns, slips} = parseSheetRows(rows);
      if(warns.length){
        const ul = document.getElementById('warnList');
        if(ul){ ul.innerHTML = warns.map(w=>`<li>${w}</li>`).join(''); document.getElementById('warnPanel')?.classList.remove('hidden'); }
      }
      if(!slips.length){ toast('No se pudieron importar cartillas','warn'); statusEl.textContent=''; return; }
      const byId = new Map(cartillas.map(c=>[c.id||c.nombre, c]));
      slips.forEach(s=>{ byId.set(s.id||s.nombre, s); });
      cartillas = Array.from(byId.values());
      save(); current = 0; showUI(true); renderAll(); adjustHeight();
      toast(`Importadas ${slips.length} cartillas NFL`,'ok');
      statusEl.textContent = `Importadas ${slips.length} cartillas`;
    }catch(err){
      console.error(err); toast('Error al procesar XLSX','error'); statusEl.textContent='';
    }
  }

  btnImport.addEventListener('click', ()=>{ if(nflFile) handleNFLFile(nflFile); });
  btnWarn?.addEventListener('click', ()=>{ document.getElementById('warnPanel')?.classList.remove('hidden'); });
})();