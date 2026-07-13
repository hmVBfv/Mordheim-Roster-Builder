/* Mordheim Roster Builder — Anwendungslogik.
   Daten liegen in ../data/*.js. build.js fügt alles wieder zu EINER HTML
   zusammen (Offline-/Single-File-Variante). */
import { ABILEN, ABILITYINFO, ARMOUR_SV, BLESSINGS, BRACE_HIDE, BRACE_PLURAL, CATALOG, DISTRICTS, DP_GRADE_ORDER, DRAMATIS, EQEN, GSN_BRACE, HIREDSWORDS, HR_LABELS, HS_GRADE_ORDER, INJEN, INJURIES, ITEMINFO, LISTS, MARAUDER_MARKS, MARK_RULES, MAXPROF, MOUNTS, MUTATIONS, MUTEN, MUTLABEL, MUTSETS, NAMEEN, NR_CAT, NR_T, PENDING_1A, RACELABEL, RACE_EN, SHEET, SKILLLISTS, SKILLSETS, SPELLS, STATKEYS, STD_CATS, SV_SKILL_BASE, SV_SKILL_BONUS, TERMEN, UNITRACE, UPGRADES, WARBANDS, WBEXTRA, WBHIRE, WBRACE, _ALLCC, _CCFAM, _FAM } from '../data/index.js';
import { exportOfficialSheet, defaultWarbandName } from './pdf.js';
import { ttsOpen, ttsOpenHS, ttsOpenDP, ttsText, ttsTextHS } from './tts.js';

/* ===================== DATA ===================== */
// equipment item: [name, cost]  (cost in gc)








export function mutEN(nm){ return MUTEN[nm]||nm; }





// 1a is complete.


/* ===================== ZAUBER / GEBETE ===================== */
// Format: { name, note, spells:[[Name (Schwierigkeit), Wirkung], ...] }  (Quelle: Mordheim-Regelbuch & Warband-Quellen)


/* ===================== DESIGN NOTE — RARE ITEMS / TRADING POST (geplant) =====================
   TODO (future feature): Pull the FULL weapon/armour/equipment catalogue from Mordheimer
   (https://mordheimer.net/docs/weapons-armour/{close-combat,missile,blackpowder,armour,miscellaneous-equipment}
   and /docs/trading-post). Each item should record a `rarity` value (Common / Rare N / etc.)
   in the database. Rarity need NOT be shown on the unit cards, but is stored for future features.
   ELIGIBILITY RULE (must enforce when adding rare/magic items): a unit may only take an item whose
   BASE CATEGORY/TYPE is present in its STARTING equipment list. Map each rare/magic item to a base
   type, e.g. "magic armour that counts as heavy armour" -> requires Heavy armour in the start list;
   "magic spear" -> requires Spear; "magic sword" -> requires Sword, etc. If a unit cannot buy heavy
   armour at start, it cannot wear a magic item that counts as heavy armour; no spear at start -> no
   magic spear; and so on. Implement via per-item {base:'Schwere Rüstung'|'Speer'|...} tags checked
   against the unit's eqListFor() categories/items.
   ============================================================================================ */
/* ===================== KATALOG / TRADING POST (Raritäts-Datenbank) =====================
   Referenz-DB aller Waffen/Rüstungen/Ausrüstung der im Tool vorhandenen Warbands (core/1a/1b
   sowie tool-relevante 1c-Items für Marauders/Norse/Beastmen/Possessed/Carnival). Quelle: Mordheimer.net.
   Schema je Eintrag: {de, en, cat, cost, rare, wb}
     cat : 'cc'=Nahkampf · 'missile'=Fernkampf · 'bp'=Schwarzpulver · 'armour'=Rüstung · 'misc'=Sonstiges
     cost: Zahl (gc) ODER String bei variablen/Multiplikator-Preisen ("+20", "4× Preis", "10+1D6")
     rare: Raritätsstufe ('Common' | 'Rare 4' … 'Rare 12'). Wird NICHT auf den Einheiten-Karten gezeigt,
           nur gespeichert (für spätere Features wie Trading-Post-Suche).
     wb  : Warband-/Einheiten-Beschränkung ('' = keine).
   Tragbarkeits-/Eligibility-Regel (laut Design-Notiz) wird auf dieser Basis später ergänzt.
   ====================================================================================== */

/* ===================== SONDERFERTIGKEITEN ===================== */



/* Zuordnung Warband → Schule / Fertigkeiten */


/* ============================================================================
   HIRED SWORDS — Grade 1a (Increment A: Daten + Eligibility-Engine + Anzeige)
   Quelle: Mordheimer.net /docs/campaigns/hired-swords/grade-1a, gegen Ultimate
   FAQ geprüft. WBHIRE (Alignment/Overrides) ist bewusst eine eigene, House-Rule-
   überschreibbare Tabelle. FAQ p.147: nur 1 HS je Typ; HS zählen nicht zur max.
   Modellzahl/Heldenzahl und nicht zum Wyrdstone-Einkommen, aber zu Rout-Tests.
   ========================================================================== */


/* Warband-Metadaten: align (good|neutral|evil), Rassen-Komposition (dwarf/elf),
   Typ-Tags für namentliche Sperren und explizite HS-Overrides. House-Rule-Hook:
   diese Tabelle kann gefahrlos angepasst werden, ohne die Warband-Regeln zu berühren. */


/* human/chaos-Klassifikation (überschreibbar): steuert HS-Regeln wie
   'human', 'nonChaosHuman', 'humanOrDwarf'. greenskin = Tag 'orcsgoblins'. */
['merc','wh','sos','averland','kislev','ostlander','ostermark','bretonnian','bretchapel','hochland','gunnery','outriders','outlaws','pirates','tileans','norse','arabian','reavers','caravans','battlemonks','pitfighters','maraudersofchaos','cavalcade'].forEach(k=>{ if(WBHIRE[k]) WBHIRE[k].human=true; });
['possessed','carnival','beastmen','hornedhunters','maraudersofchaos','sonsofhashut','blackdwarfs','cppleasures','cavalcade'].forEach(k=>{ if(WBHIRE[k]) WBHIRE[k].chaos=true; });

export function hsHireRuleAllows(hs,wb){ const r=hs.rule; if(!r) return true;
  const tags=wb.tags||[];
  switch(r.type){
    case 'any': return true;
    case 'good': return wb.align==='good' && !(r.except||[]).some(t=>tags.includes(t));
    case 'evil': return wb.align==='evil';
    case 'chaos': return !!wb.chaos;
    case 'nonEvil': return wb.align!=='evil';
    case 'human': return !!wb.human;
    case 'nonChaosHuman': return !!wb.human && !wb.chaos && !(r.except||[]).some(t=>tags.includes(t));
    case 'humanOrDwarf': return (!!wb.human||!!wb.dwarf) && (!r.noChaos||!wb.chaos) && !(r.except||[]).some(t=>tags.includes(t)) && !(r.xsub||[]).some(x=>wb.key===x[0]&&wb.subtype===x[1]);
    case 'nonGood': return wb.align!=='good' || (r.wbs||[]).some(w=>w===wb.key||tags.includes(w));
    case 'humanOrHighElf': return (!!wb.human||wb.key==='shadowwarriors') && wb.align!=='evil';
    case 'onlyWb': return (r.wbs||[]).includes(wb.key) && (!r.subtype || wb.subtype===r.subtype);
    case 'except': return !(r.tags||[]).some(t=>tags.includes(t)) && !(r.flags||[]).some(f=>wb[f]) && !(r.wbs||[]).includes(wb.key) && !(r.xsub||[]).some(x=>wb.key===x[0]&&wb.subtype===x[1]);
    case 'only': { if((r.xsub||[]).some(x=>wb.key===x[0]&&wb.subtype===x[1])) return false;
      return ((r.tags||[]).some(t=>tags.includes(t)||t===wb.key) || (r.wbs||[]).includes(wb.key) || (r.flags||[]).some(f=>wb[f])) && !(r.xwbs||[]).includes(wb.key); }
    default: return true;
  } }

/* Welche Grade-1a-HS darf wbKey anheuern? Liefert {allowed:[],blocked:[]}.
   Eine explizite warband-seitige only-Whitelist ist die spezifischere Regel und
   überschreibt die generische "May be Hired" (z. B. Reavers dürfen den Troll Slayer). */
export function hireEligibility(wbKey,TABLE){ TABLE=TABLE||HIREDSWORDS;
  const wb=Object.assign({key:wbKey,subtype:(typeof S!=='undefined'&&S)?S.subtype:null},WBHIRE[wbKey]||{align:'neutral'});
  const out={allowed:[],blocked:[]};
  for(const key of Object.keys(TABLE)){ const hs=TABLE[key]; let ok=true, reason='';
    if(wb.none){ ok=false; reason='warband hires no Hired Swords'; }
    else if(wb.only){ const named=hs.rule&&(hs.rule.type==='onlyWb'||hs.rule.type==='only')&&(hs.rule.wbs||[]).includes(wb.key);
      if(!wb.only.includes(key) && !named){ ok=false; reason='not on this warband\u2019s hire list'; } }
    else if(wb.except && wb.except.includes(key)){ ok=false; reason='excluded by warband rule'; }
    else if(wb.noElfHS && key==='elfranger'){ ok=false; reason='Grudgebearers: no Elven Hired Swords'; }
    else if(wb.noChaosHS && hs.rule && hs.rule.type==='evil'){ ok=false; reason='may not hire Chaos/evil Hired Swords'; }
    else if(!hsHireRuleAllows(hs,wb)){ ok=false; reason='not available to this warband type'; }
    if(!ok){ out.blocked.push({key,name:hs.name,reason}); continue; }
    let up=hs.upkeep, note='';
    if(hs.grudge && wb[hs.grudge.tag]){ up=hs.grudge.upkeep; note=hs.grudge.note; }
    out.allowed.push({key,name:hs.name,src:hs.src,hire:hs.hire,upkeep:up,rating:hs.rating,note,conflict:hs.conflict||null});
  }
  return out;
}

/* ============================================================================
   HIRED SWORDS — Increment B: Rekrutierung + Grade-House-Rule
   HS liegen in S.hired=[{key,uid}] (getrennt von S.models, damit die
   Modell-/Helden-Zählung FAQ-konform unberührt bleibt: HS zählen nicht zur
   max. Modellzahl/Heldenzahl, aber zu Rating & Budget). 1 HS je Typ (FAQ p.147).
   ========================================================================== */

export function hsGradeIdx(g){ const i=HS_GRADE_ORDER.indexOf(g); return i<0?99:i; }
export function hsGradeAllowed(g){ const hg=HR().hsGrades; return hg?hg[g]!==false:true; }
export function setHsGrade(g,on){ const h=HR(); if(!h.hsGrades) h.hsGrades={'1a':true,'1b':true,'1c':true,'2a':true}; h.hsGrades[g]=!!on; render(); }

export function hsList(){ return (S.hired||[]); }
export function hsCount(key){ return hsList().filter(h=>h.key===key).length; }
export function hsUpkeepFor(key){ const hs=HIREDSWORDS[key]; if(!hs) return 0;
  let up=hs.upkeep||0; const wb=Object.assign({key:S.wb},WBHIRE[S.wb]||{});
  if(hs.grudge && wb[hs.grudge.tag]) up=hs.grudge.upkeep; return up; }
export function hsHireTotal(){ return hsList().reduce((s,h)=>s+(typeof hsHireCost==='function'?hsHireCost(h.key):((HIREDSWORDS[h.key]&&HIREDSWORDS[h.key].hire)||0)),0); }
export function hsRatingTotal(){ return hsList().reduce((s,h)=>s+((HIREDSWORDS[h.key]&&HIREDSWORDS[h.key].rating)||0)+(typeof hsExp==='function'?hsExp(h):0),0); }
export function hsUpkeepTotal(){ return hsList().reduce((s,h)=>s+hsUpkeepFor(h.key),0); }
export function hsSizeBonus(){ return hsList().reduce((s,h)=>s+((HIREDSWORDS[h.key]&&HIREDSWORDS[h.key].sizeBonus)||0),0); }

export function hireHS(key){ const hs=HIREDSWORDS[key]; if(!hs) return;
  if(!hsGradeAllowed(hs.grade)) return;                 // Grade-House-Rule
  const e=hireEligibility(S.wb); if(!e.allowed.some(a=>a.key===key)) return; // Eligibility
  if(hsCount(key)>=1) return;                           // 1 je Typ (FAQ)
  if(!S.hired) S.hired=[];
  S.hired.push({key, uid:'hs'+Date.now()+Math.floor(Math.random()*1000), exp:0, skills:[]});
  render();
}
export function unhireHS(uid){ S.hired=hsList().filter(h=>h.uid!==uid); render(); }

/* Anzeige-Panel: Grade-Filter · anheuerbare HS (mit Hire-Button) · angeheuerte HS
   (mit Profil, Upkeep, Remove). Rekrutierung schreibt in S.hired. */
export let hsEqOpen={};
/* HAUSREGEL: HS/DP zusätzlich ausrüsten. RAW ist die Ausrüstung eines Hired Sword
   fix (die "Equipment:"-Zeile seines Eintrags); es gibt keine Kaufliste für ihn.
   Daher standardmäßig AUS. Ist sie an, darf er aus der Helden-Ausrüstungsliste
   seiner Warband kaufen (nächstliegende Analogie, House-Rule-typisch). */
export function hsEquipOn(){ return !!HR().hsEquip; }
export function heroEqList(){ const wb=WARBANDS[S.wb]; if(!wb) return null;
  const hero=(wb.units||[]).find(u=>u.t==='hero'&&u.eq); return hero?eqListFor(hero):null; }
export function entryOf(rec){ return HIREDSWORDS[rec.key]||DRAMATIS[rec.key]||null; }
export function hsRecOf(uid){ return (S.hired||[]).find(h=>h.uid===uid)||(S.dp||[]).find(d=>d.uid===uid)||null; }
export function hsEqCost(rec){ const list=heroEqList(); if(!list||!rec.eq) return 0; let c=0;
  for(const cat in list) for(const [nm,pr] of list[cat]){ const q=Number(rec.eq[nm])||0; if(!q) continue; c+=q*adjPrice(nm,pr); }
  return c; }
export function hsEqTotal(){ if(!hsEquipOn()) return 0;
  return [...(S.hired||[]),...(S.dp||[])].reduce((t,r)=>t+hsEqCost(r),0); }
export function setHsEq(uid,nm,q){ const r=hsRecOf(uid); if(!r) return; if(!r.eq) r.eq={};
  q=Math.max(0,Math.min(9,Number(q)||0)); if(q<=0) delete r.eq[nm]; else r.eq[nm]=q; render(); }
export function hsEqParts(rec){ const list=heroEqList(); const out=[]; if(!list||!rec.eq) return out;
  for(const cat in list) for(const [nm] of list[cat]){ const q=Number(rec.eq[nm])||0; if(q>0) out.push(q>1?`${nm} ×${q}`:nm); }
  return out; }
export function hsEqSection(rec){
  if(!hsEquipOn()) return '';
  const list=heroEqList(); if(!list) return '';
  const open=!!hsEqOpen[rec.uid];
  const rows=Object.keys(list).map(cat=>{
    const items=list[cat].map(([nm,pr])=>{ const q=Number((rec.eq||{})[nm])||0; const price=adjPrice(nm,pr);
      return `<div class="eqrow"><span class="eqn">${nm}</span><span class="eqp">${price} gc</span>
        <input type="number" min="0" max="9" value="${q}" oninput="setHsEq('${rec.uid}','${nm.replace(/'/g,"\\'")}',this.value)"></div>`;
    }).join('');
    return `<div class="eqcat">${cat}</div>${items}`;
  }).join('');
  const c=hsEqCost(rec);
  return `<details class="sec-details eq-det" ${open?'open':''} ontoggle="hsEqOpen['${rec.uid}']=this.open">
      <summary class="sec-sum">Extra equipment (house rule)${c?` <span class="hr-on">${c} gc</span>`:''}</summary>
      <div class="sec-body"><div class="eqnote">RAW: a Hired Sword's equipment is fixed. This optional list lets him buy from the warband's Hero equipment chart.</div>${rows}</div>
    </details>`;
}
export let hsFilter={stat:'',op:'>=',val:'',q:''}, dpFilter={stat:'',op:'>=',val:'',q:''};

/* Profilwerte können "3(4)", "D6", "—" sein: numerisch auswerten (Klammerwert = effektiv) */
export function statNum(v){ if(v==null) return null;
  const s=String(v); const par=s.match(/\((\d+)\)/); if(par) return Number(par[1]);
  const m=s.match(/\d+/); return m?Number(m[0]):null; }
export function passNameFilter(entry,F){ const q=String((F&&F.q)||'').trim().toLowerCase();
  if(!q) return true; return String(entry.name||'').toLowerCase().includes(q); }
export function passStatFilter(entry,F){ if(!passNameFilter(entry,F)) return false;
  if(!F.stat||F.val==='') return true;
  const want=Number(F.val); if(isNaN(want)) return true;
  const vals=[entry.profile]; if(entry.profile2&&entry.profile2.p) vals.push(entry.profile2.p);
  return vals.some(p=>{ const n=statNum(p&&p[F.stat]); if(n==null) return false;
    switch(F.op){ case '>=': return n>=want; case '>': return n>want; case '=': return n===want; case '<=': return n<=want; case '<': return n<want; } return true; }); }
export function statFilterBar(id,F,setter){
  const opts=STATKEYS.map(k=>`<option value="${k}"${F.stat===k?' selected':''}>${k}</option>`).join('');
  const ops=['>=','>','=','<=','<'].map(o=>`<option value="${o}"${F.op===o?' selected':''}>${o}</option>`).join('');
  return `<div class="statfilter no-print">
    <input type="search" class="sf-q" id="q-${id}" value="${String(F.q||'').replace(/"/g,'&quot;')}" placeholder="\u2315 Search by name\u2026" oninput="${setter}('q',this.value)">
    <span class="sf-l">Stat</span>
    <select onchange="${setter}('stat',this.value)"><option value="">\u2014</option>${opts}</select>
    <select onchange="${setter}('op',this.value)">${ops}</select>
    <input type="number" style="width:52px" value="${F.val}" oninput="${setter}('val',this.value)" placeholder="val">
    ${((F.stat&&F.val!=='')||F.q)?`<button class="tiny ghost" onclick="${setter}('clear')">clear</button>`:''}
  </div>`; }
export function setHsFilter(k,v){ if(k==='clear'){ hsFilter={stat:'',op:'>=',val:'',q:''}; } else hsFilter[k]=v; render(); if(k==='q'){ const el=document.getElementById('q-hs'); if(el){ el.focus(); try{el.setSelectionRange(el.value.length,el.value.length);}catch(e){} } } }
export function setDpFilter(k,v){ if(k==='clear'){ dpFilter={stat:'',op:'>=',val:'',q:''}; } else dpFilter[k]=v; render(); if(k==='q'){ const el=document.getElementById('q-dp'); if(el){ el.focus(); try{el.setSelectionRange(el.value.length,el.value.length);}catch(e){} } } }
export function renderHiredSwords(){
  const host=document.getElementById('hspanel'); if(!host){ return; }
  if(!S.wb || !WBHIRE[S.wb]){ host.innerHTML=''; return; }
  const e=hireEligibility(S.wb);
  // Angeheuerte HS
  const hired=hsList().map(h=>{ const hs=HIREDSWORDS[h.key]; if(!hs) return '';
    const up=hsUpkeepFor(h.key);
    return `<div class="hs-hired"><div class="hs-hired-top"><b>${hs.name}</b>
        <span class="hs-badge">${hs.grade}</span>
        <button class="tiny ghost" onclick="unhireHS('${h.uid}')" title="Dismiss">✕</button></div>
      ${statTableHS(hs,h,false)}
      <div class="hs-hired-meta">Hire ${hs.hire} · Upkeep ${up} · Rating +${hs.rating}${hs.faq?' · <span class="hs-faq" title="'+hs.faq.replace(/"/g,'&quot;')+'">FAQ</span>':''}</div>
      <div class="hs-hired-eq">${hs.eq}</div></div>`;
  }).join('');
  // Anheuerbare (Eligibility + Grade-Filter; „1 je Typ" ⇒ bereits angeheuerte ausblenden)
  const rows=e.allowed.filter(a=>hsGradeAllowed(HIREDSWORDS[a.key].grade) && hsCount(a.key)<1 && passStatFilter(HIREDSWORDS[a.key],hsFilter)).map(a=>{
    const hs=HIREDSWORDS[a.key];
    const upk=a.note?`<b title="${a.note}">${a.upkeep}*</b>`:a.upkeep;
    const cf=a.conflict?` <span class="hs-cf" title="Never together with: ${a.conflict.map(c=>HIREDSWORDS[c].name).join(', ')}">⚠</span>`:'';
    const blockedByConflict=a.conflict && a.conflict.some(c=>hsCount(c)>0);
    const btn=blockedByConflict
      ? `<button class="tiny" disabled title="Conflicts with an already-hired Hired Sword">—</button>`
      : `<button class="tiny" onclick="hireHS('${a.key}')">Hire</button>`;
    const hc=(typeof hsHireCost==='function')?hsHireCost(a.key):hs.hire; const hireCell=hc<hs.hire?`<s>${hs.hire}</s> <b>${hc}</b>`:`${hs.hire}`; return `<tr><td class="hs-prev" onmouseenter="showPreview(this,'${a.key}')" onmouseleave="hideItip()" onclick="toggleItipPreview(event,this,'${a.key}')">${hs.name}${cf} \u24d8</td><td><span class="hs-badge">${hs.grade}</span></td>${hsFilter.stat?`<td class="num"><b>${hs.profile[hsFilter.stat]!==undefined?hs.profile[hsFilter.stat]:'\u2014'}</b></td>`:''}<td class="num">${hireCell}</td><td class="num">${upk}</td><td class="num">+${hs.rating}</td><td class="num">${btn}</td></tr>`;
  }).join('');
  const hg=HR().hsGrades||{};
  const gradeSel=`<span class="hs-grade-boxes" title="House rule: which Hired Sword grades are available">`+
    HS_GRADE_ORDER.map(g=>`<label class="hs-gbox"><input type="checkbox" ${hg[g]!==false?'checked':''} onchange="setHsGrade('${g}',this.checked)">${g}</label>`).join('')+`</span>`;
  const none=e.allowed.length===0?`<div class="hs-none">This warband may not hire any Hired Swords.</div>`:'';
  const upTotal=hsUpkeepTotal();
  host.innerHTML=`<details class="sec-details" ${hsOpen?'open':''} ontoggle="hsOpen=this.open"><summary class="sec-sum">Hired Swords${hsList().length?' <span class="hr-on">'+hsList().length+'</span>':''}</summary><div class="sec-body"><div class="hs-head">${gradeSel}</div>${statFilterBar('hs',hsFilter,'setHsFilter')}
    ${hired?`<div class="hs-hired-wrap">${hired}<div class="hs-uptotal">Total upkeep between games: <b>${upTotal} gc</b></div></div>`:''}
    ${none}
    ${rows?`<table class="hs-tbl"><thead><tr><th>Available</th><th>Grade</th>${hsFilter.stat?`<th class="num">${hsFilter.stat}</th>`:''}<th class="num">Hire</th><th class="num">Upk</th><th class="num">Rat</th><th></th></tr></thead><tbody>${rows}</tbody></table>`:(e.allowed.length&&!none?`<div class="hs-none">All eligible Hired Swords are already hired or filtered out by grade.</div>`:'')}
    <div class="hs-foot">Only one of each type. Hired Swords don't count toward the model/Hero limit or wyrdstone income, but count for Rout tests, Warband Rating and (as a hire cost) your budget.</div></div></details>`;
}

/* --- HS im Haupt-Roster (Sektion zwischen Heroes und Henchmen) + TTS-Export --- */
export function statBarHS(e,rec){ const k=["M","WS","BS","S","T","W","I","A","Ld"];
  const p=(rec&&typeof hsEffProfile==='function'&&HIREDSWORDS[rec.key])?hsEffProfile(rec,e):(e.profile||{});
  const cells=k.map(x=>`<span class="sb-c"><span class="sb-k">${x}</span><span class="sb-v">${p[x]!==undefined?p[x]:'\u2014'}</span></span>`).join('');
  let out=`<div class="statbar">${cells}</div>`;
  const mx=(typeof hsRaceMax==='function')?hsRaceMax(e):null;
  if(mx) out+=`<div class="statbar maxbar" title="Racial maximum (${raceEN(e.race)})">`+
    k.map(x=>`<span class="sb-c"><span class="sb-v">${mx[x]!==undefined?mx[x]:'\u2014'}</span></span>`).join('')+
    `</div><div class="maxlbl">\u25b2 Racial maximum (${raceEN(e.race)})</div>`;
  if(e.pair&&e.profile2){ const p2=e.profile2.p||{};
    const c2=k.map(x=>`<span class="sb-c"><span class="sb-k">${x}</span><span class="sb-v">${p2[x]!==undefined?p2[x]:'\u2014'}</span></span>`).join('');
    out=`<div class="sb-n">${e.profileName||'A'}</div>${out}<div class="sb-n">${e.profile2.name}</div><div class="statbar">${c2}</div>`; }
  return out; }
/* Sv = permanenter Rüstungswurf. Bewusst OHNE Schild (optional nutzbar) und ohne
   Buckler (nur Parieren). Nur was IMMER gilt: getragene Rüstung + Fähigkeiten/Naturpanzer. */

export function svFromText(t){ if(!t) return null; let best=null;
  // Rüstungsstücke im Text
  [[/gromril\s*armour/i,4],[/chaos\s*armour/i,4],[/ithilmar\s*armour/i,5],
   [/heavy\s*armour/i,5],[/light\s*armour/i,6],[/toughened\s*leathers|hardened\s*leathers/i,6]]
    .forEach(([re,v])=>{ if(re.test(t)&&(best==null||v<best)) best=v; });
  // Naturpanzer / ausdrücklich genannte Rüstungswürfe.
  // Bewusst NICHT: Saves gegen Betäubung ("3+ save to avoid being stunned", Thick Skull, 'Ard 'Ead)
  // und keine Injury-Effekte ("taken out of action on a 6+").
  const clean=String(t).replace(/[^.]*?(?:avoid being stunned|against being stunned|to avoid|out of action on)[^.]*\.?/gi,' ');
  const pats=[/\b([2-6])\+\s*(?:armour\s*)?save\b/i, /\bsave\s*(?:of\s*)?([2-6])\+/i,
              /\bscaly(?:\s*skin)?\s*([2-6])\+/i, /\bhide[^.]{0,20}?([2-6])\+\s*save/i];
  pats.forEach(re=>{ const m=re.exec(clean); if(m){ const v=Number(m[1]); if(best==null||v<best) best=v; } });
  return best; }
/* Skills, die den permanenten Rüstungswurf verbessern — NUR wenn tatsächlich erlernt. */
// +1 auf jeden Rüstungswurf
// eigener 6+, mit Rüstung kombinierbar
export function _svCombine(a,b){ if(a==null) return b; if(b==null) return a; return Math.max(2,Math.min(a,b)-1); }
export function svOfModel(m){ const def=unitDef(m.uid_def); let eqSv=null;
  for(const nm in (m.eq||{})){ if(!m.eq[nm]) continue; if(ARMOUR_SV[nm]!=null && (eqSv==null||ARMOUR_SV[nm]<eqSv)) eqSv=ARMOUR_SV[nm]; }
  const innate=svFromText(def&&def.sp);
  const combinable=/combines?\s*with\s*armour|combined with o/i.test((def&&def.sp)||'');
  let best = combinable ? _svCombine(eqSv,innate)
           : (eqSv==null?innate : (innate==null?eqSv:Math.min(eqSv,innate)));
  if(def&&def.sv!=null && (best==null||def.sv<best)) best=def.sv;
  // erlernte Skills
  const sk=(m&&m.skills)||[]; let bonus=0, base=null;
  sk.forEach(n=>{ if(SV_SKILL_BONUS[n]) bonus+=SV_SKILL_BONUS[n];
                  if(SV_SKILL_BASE[n]!=null && (base==null||SV_SKILL_BASE[n]<base)) base=SV_SKILL_BASE[n]; });
  if(base!=null) best=_svCombine(best,base);        // kombinierbarer Naturpanzer (Shaggy Hide)
  if(best!=null && bonus) best=Math.max(2,best-bonus);
  return best; }
export function svOfEntry(e,rec){ let best=svFromText((typeof hsChosenEq==='function'&&rec)?hsChosenEq(rec,e):(e&&e.eq));
  const t=svFromText(e&&e.sp); if(t!=null&&(best==null||t<best)) best=t;
  if(rec&&typeof hsEquipOn==='function'&&hsEquipOn()&&typeof hsEqParts==='function'){
    const ex=svFromText(hsEqParts(rec).join(', ')); if(ex!=null&&(best==null||ex<best)) best=ex; }
  const sk=(rec&&rec.skills)||[]; let bonus=0;
  sk.forEach(n=>{ if(SV_SKILL_BONUS[n]) bonus+=SV_SKILL_BONUS[n]; });
  if(best!=null && bonus) best=Math.max(2,best-bonus);
  return best; }
export function svLabel(v){ return v==null?'\u2014':(v+'+'); }
export function statTableHS(hs,rec,showMax){ const k=["M","WS","BS","S","T","W","I","A","Ld"];
  const p=(rec&&typeof hsEffProfile==='function'&&HIREDSWORDS[rec.key])?hsEffProfile(rec,hs):(hs.profile||{});
  let rows=`<tr><td class="rh">${hs.name}</td>${k.map(x=>`<td>${p[x]!==undefined?p[x]:'\u2014'}</td>`).join('')}</tr>`;
  if(rec&&hs.pair&&hs.profile2){ const p2=hs.profile2.p||{};
    rows+=`<tr><td class="rh">${hs.profile2.name}</td>${k.map(x=>`<td>${p2[x]!==undefined?p2[x]:'\u2014'}</td>`).join('')}</tr>`; }
  if(showMax&&typeof hsRaceMax==='function'){ const mx=hsRaceMax(hs);
    if(mx) rows+=`<tr class="maxrow" title="Racial maximum (${raceEN(hs.race)})"><td class="rh">\u25b2 max (${raceEN(hs.race)})</td>${k.map(x=>`<td>${mx[x]!==undefined?mx[x]:'\u2014'}</td>`).join('')}</tr>`; }
  return `<table class="stats"><tr><th class="rh"></th>${k.map(x=>`<th>${x}</th>`).join('')}</tr>${rows}</table>`; }
export function noteLines(txt){ if(!txt) return '';
  const parts=String(txt).replace(/<br\s*\/?>/gi,'\u0001').split(/\u0001|(?<=\.)\s+(?=[A-Z\u201c\u2018])/)
    .map(x=>x.trim()).filter(Boolean);
  return parts.map(p=>`<div class="srule">${p}</div>`).join(''); }
export function hsRuleLines(sp){ if(!sp) return '';
  const parts=String(sp).replace(/<br\s*\/?>/gi,'\u0001').replace(/\s*<b>/g,'\u0001<b>').split('\u0001').map(x=>x.trim()).filter(Boolean);
  return parts.map(p=> /^<b>/.test(p)?`<div class="srule">${p}</div>`:`<div class="srule-intro">${p}</div>`).join(''); }
export let _SKNAMES=null;
export function skillText(nm,e){ if(e&&typeof hsSpecialText==='function'){ const t=hsSpecialText(e,nm); if(t) return t; }
  const si=skillInfo(nm); if(!si) return '';
  return (typeof si==='object')?(si.text||si.name||''):String(si); }
export function skillNameList(){ if(_SKNAMES) return _SKNAMES;
  const out=[]; for(const c in SKILLLISTS){ (SKILLLISTS[c].skills||[]).forEach(sk=>out.push(sk[0])); }
  _SKNAMES=[...new Set(out)].sort((a,b)=>b.length-a.length); return _SKNAMES; }
export function skillChipsIn(sp){ const out=[];
  for(const nm of skillNameList()){
    // Bindestrich/Leerzeichen austauschbar (z. B. "Knife Fighter" == "Knife-Fighter")
    const pat=nm.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/[-\s]+/g,'[-\\s]+');
    const re=new RegExp('(^|[^A-Za-z])'+pat+'([^A-Za-z]|$)','i');
    if(re.test(sp)) out.push(nm); }
  return out; }
export function fixedSkills(e,rec){ const p=(rec&&e.personas&&typeof hsPersona==='function')?hsPersona(rec,e):null;
  return [...(e.skills||[]),...((p&&p.skills)||[])]; }
export function spellChipRow(rec,e){ if(!e||!e.magic||!SPELLS[e.magic]) return '';
  const sel=(rec&&rec.spells)||[]; if(!sel.length) return '';
  const lore=e.magic;
  const chips=sel.map(sp=>{ const d=(typeof spellEffDiff==='function')?spellEffDiff(sp):null;
    const t=String(spellEffect(sp.name,lore)||'').replace(/"/g,'&quot;').replace(/'/g,"\\'");
    const nm=spellLabel(sp.name);
    return `<span class="kwchip" tabindex="0" onmouseenter="showItipHTML(this,'<b>${String(nm).replace(/'/g,"\\'")}${d!=null?' ('+d+')':''}</b><br>${t}',false,320)" onmouseleave="hideItip()">${nm}${d!=null?` <b>(${d})</b>`:''} \u24d8</span>`; }).join('');
  return `<div class="abil-sk"><b>Spells (${SPELLS[lore].name}):</b> ${chips}</div>`; }
export function skillChipRow(names,label,e){ if(!names||!names.length) return '';
  const chip=(nm)=>{ const t=skillText(nm,e).replace(/"/g,'&quot;').replace(/'/g,"\\'");
    return t?`<span class="kwchip" tabindex="0" onmouseenter="showItipHTML(this,'<b>${nm.replace(/'/g,"\\'")}</b><br>${t}',false,300)" onmouseleave="hideItip()">${nm} \u24d8</span>`
            :`<span class="kwchip kw-plain">${nm}</span>`; };
  return `<div class="abil-sk"><b>${label||'Skills'}:</b> ${names.map(chip).join('')}</div>`; }
export function hsAbilitySection(hs,rec){
  const pers=(rec&&hs.personas&&typeof hsPersona==='function')?hsPersona(rec,hs):null;
  const sp=[(pers&&pers.sp)||'',hs.sp||''].filter(Boolean).join(' ');
  let found=[]; const seen=new Set();
  for(const [re,info] of ABILITYINFO){ if(re.test(sp) && !seen.has(info.name)){ seen.add(info.name); found.push(info); } }
  if(found.some(f=>f.name==='Fearless')) found=found.filter(f=>f.name!=='Fear'&&f.name!=='Terror');
  if(/not a wizard/i.test(sp)) found=found.filter(f=>f.name!=='Wizard');
  if(/immune to fear/i.test(sp) && !/causes? fear|fearsome/i.test(sp)) found=found.filter(f=>f.name!=='Fear');
  const skFound=skillChipsIn(sp).filter(n=>!seen.has(n));
  const chip=(label,lookup)=>{ const esc=String(lookup).replace(/'/g,"\\'"); return `<span class="kwchip" tabindex="0" onmouseenter="showItip(this,'${esc}')" onmouseleave="hideItip()" onfocus="showItip(this,'${esc}')" onblur="hideItip()" onclick="toggleItip(event,this,'${esc}')">${label} \u24d8</span>`; };
  const skChip=(nm)=>{ const t=skillText(nm).replace(/"/g,'&quot;').replace(/'/g,"\\'");
    return `<span class="kwchip" tabindex="0" onmouseenter="showItipHTML(this,'<b>${nm.replace(/'/g,"\\'")}</b><br>${t}',false,300)" onmouseleave="hideItip()">${nm} \u24d8</span>`; };
  let html=`<div class="abil"><div class="abil-h">Abilities &amp; Special Rules</div>`;
  const gained=(rec&&rec.skills)?rec.skills:[];
  html+=skillChipRow([...fixedSkills(hs,rec),...gained],'Skills',hs);
  html+=spellChipRow(rec,hs);
  const spc=hsSpecialSkills(hs).map(x=>x[0]);
  if(spc.length) html+=skillChipRow(spc,'Special skills (gained through experience)',hs);
  if(hs.skills2) html+=skillChipRow(hs.skills2, hs.profile2?hs.profile2.name:'Skills (2)');
  if(sp) html+=`<div class="abil-sp">${ruleSplitBold(sp).join('<br>')}</div>`;
  if(found.length||skFound.length) html+=`<div class="abil-kw no-print">`+found.map(info=>chip(info.name,info.name)).join('')+skFound.map(skChip).join('')+`</div>`;
  return html+`</div>`;
}
/* HIRED SWORDS: Erfahrung. RAW (Rulebook S.147): "Hired Swords gain experience in
   exactly the same way as Henchmen ... Once the Hired Sword gains enough experience
   for an advance, roll on the HEROES Advancement table (as opposed to Henchmen)."
   → Henchmen-XP-Pfad (Advances bei 2/5/9/14, Max 14), aber Helden-Advances.
   Dramatis Personae gewinnen KEINE Erfahrung. */
const HS_ADV=[2,5,9,14], HS_XP_MAX=14;
export function hsExp(rec){ return Math.max(0,Math.min(HS_XP_MAX,Number(rec.exp)||0)); }
export function setHsExp(uid,v){ const r=(S.hired||[]).find(h=>h.uid===uid); if(!r) return;
  r.exp=Math.max(0,Math.min(HS_XP_MAX,Number(v)||0)); render(); }
export function hsAdvancesDue(rec){ const x=hsExp(rec); return HS_ADV.filter(t=>x>=t).length; }
export function addHsSkill(uid){ const r=(S.hired||[]).find(h=>h.uid===uid)||(S.dp||[]).find(d=>d.uid===uid); if(!r) return;
  const el=document.getElementById('hssk-'+uid); const v=(el&&el.value)||''; if(!v||v==='\u2014') return;
  if(!r.skills) r.skills=[]; if(!r.skills.includes(v)) r.skills.push(v); render(); }
export function delHsSkill(uid,nm){ const r=(S.hired||[]).find(h=>h.uid===uid); if(!r) return;
  r.skills=(r.skills||[]).filter(x=>x!==nm); render(); }
export function hsSkillOptions(hs){ return (hs.sk||[]).map(cat=>{ const L=SKILLLISTS[cat]; if(!L) return '';
  return `<optgroup label="${L.name}">`+L.skills.map(sk=>`<option value="${sk[0].replace(/"/g,'&quot;')}">${sk[0]}</option>`).join('')+`</optgroup>`; }).join(''); }
export function hsOptSet(uid,v){ const r=(S.hired||[]).find(h=>h.uid===uid)||(S.dp||[]).find(d=>d.uid===uid); if(r){ r.opt=v; render(); } }
export function hsPersonasAllowed(e){ if(!e.personas) return [];
  const wb=Object.assign({key:S.wb,subtype:S.subtype},WBHIRE[S.wb]||{align:'neutral'});
  return e.personas.filter(p=>!p.rule||hsHireRuleAllows({rule:p.rule},wb)); }
export function hsOptSection(rec,e){
  if(e.personas){
    const av=hsPersonasAllowed(e); if(!av.length) return '';
    const cur=hsPersona(rec,e); const curName=av.some(p=>p.name===cur.name)?cur.name:av[0].name;
    if(rec.opt!==curName){ rec.opt=curName; }
    const p=av.find(x=>x.name===curName)||av[0];
    return `<div class="hs-opt"><b>Persona:</b>
      <select onchange="hsOptSet('${rec.uid}',this.value)">`+
      av.map(x=>`<option value="${x.name.replace(/"/g,'&quot;')}"${curName===x.name?' selected':''}>${x.name}</option>`).join('')+
      `</select><span class="hs-optn">sets equipment, skills &amp; rules (chosen when hired)</span>
      ${p.note?`<div class="hs-pnote">${p.note}</div>`:''}
      </div>`; }
  if(!e.opts) return '';
  const cur=(rec.opt!=null&&rec.opt!=='')?rec.opt:e.opts.choices[0];
  return `<div class="hs-opt"><b>${e.opts.label}:</b>
    <select onchange="hsOptSet('${rec.uid}',this.value)">`+
    e.opts.choices.map(c=>`<option value="${c.replace(/"/g,'&quot;')}"${cur===c?' selected':''}>${c}</option>`).join('')+
    `</select><span class="hs-optn">chosen when hired (RAW)</span></div>`; }
export function hsChosenEq(rec,e){ if(!e) return '';
  if(e.personas){ const p=hsPersona(rec,e); return (p&&p.eq)||e.eq||''; }
  if(!e.opts) return e.eq||'';
  const cur=(rec.opt!=null&&rec.opt!=='')?rec.opt:e.opts.choices[0];
  return cur+((e.eqBase)?', '+e.eqBase:'');
}

/* --- HS-Advances: Henchmen-XP-Pfad (2/5/9/14), aber HELDEN-Advance-Tabelle (RAW S.147) --- */
export function hsSpecialSkills(e){ return (e&&e.hsSpecial)||[]; }
export function hsSpecialText(e,nm){ const f=hsSpecialSkills(e).find(x=>x[0]===nm); return f?f[1]:''; }
export function hsRaceMax(e){ return (e&&e.race&&typeof MAXPROF!=='undefined'&&MAXPROF[e.race])?MAXPROF[e.race]:null; }
export function hsPersona(rec,e){ if(!e||!e.personas) return null;
  let list=e.personas;
  if(typeof hsPersonasAllowed==='function' && typeof S!=='undefined' && S && S.wb){
    const av=hsPersonasAllowed(e); if(av.length) list=av; }
  const nm=(rec&&rec.opt)||'';
  return list.find(p=>p.name===nm)||list[0]; }
export function hsSkillCats(rec,e){ const p=hsPersona(rec,e); return (p&&p.sk)||e.sk||[]; }
export function hsEffProfile(rec,e){ const p=Object.assign({},(e&&e.profile)||{}); const adv=(rec&&rec.adv)||{};
  ["M","WS","BS","S","T","W","I","A","Ld"].forEach(k=>{ const d=Number(adv[k])||0; if(!d) return;
    const b=Number(p[k]); if(!isNaN(b)) p[k]=b+d; });
  return p; }
export function hsCanAdv(rec,e,stat){ const mx=hsRaceMax(e); if(!mx) return true;
  const cur=Number(hsEffProfile(rec,e)[stat]), lim=Number(mx[stat]);
  return (isNaN(cur)||isNaN(lim))?true:cur<lim; }
export function hsRec(uid){ return (S.hired||[]).find(h=>h.uid===uid)||null; }
export function addHsAdv(uid,stat){ const r=hsRec(uid); if(!r) return; const e=HIREDSWORDS[r.key];
  if(!hsCanAdv(r,e,stat)) return; if(!r.adv) r.adv={}; r.adv[stat]=(Number(r.adv[stat])||0)+1; render(); }
export function remHsAdv(uid,stat){ const r=hsRec(uid); if(!r||!r.adv) return;
  r.adv[stat]=(Number(r.adv[stat])||0)-1; if(r.adv[stat]<=0) delete r.adv[stat]; render(); }
export function remHsSkillIdx(uid,i){ const r=hsRec(uid); if(!r) return; (r.skills||[]).splice(i,1); render(); }
export function setHsAdvOpen(uid,v){ const r=hsRec(uid); if(r) r._advOpen=!!v; }
export function hsSkillSelect(rec,e){ const cats=hsSkillCats(rec,e);
  let out=cats.map(c=>{ const L=SKILLLISTS[c]||SKILLSETS[c]; if(!L) return '';
    return `<optgroup label="${L.name}">`+L.skills.map(sk=>`<option value="${String(sk[0]).replace(/"/g,'&quot;')}">${sk[0]}</option>`).join('')+`</optgroup>`; }).join('');
  const spc=hsSpecialSkills(e);
  if(spc.length) out+=`<optgroup label="${e.name} \u2014 special skills">`+spc.map(x=>`<option value="${String(x[0]).replace(/"/g,'&quot;')}">${x[0]}</option>`).join('')+`</optgroup>`;
  return out; }
export function hsSkillDatalist(rec,e){ const cats=hsSkillCats(rec,e);
  let out=cats.map(c=>{ const L=SKILLLISTS[c]; if(!L) return '';
    return L.skills.map(sk=>`<option value="${String(sk[0]).replace(/"/g,'&quot;')}">${sk[0]} \u00b7 ${L.name}</option>`).join(''); }).join('');
  out+=hsSpecialSkills(e).map(x=>`<option value="${String(x[0]).replace(/"/g,'&quot;')}">${x[0]} \u00b7 ${e.name} special</option>`).join('');
  return out; }
export function hsSpellRed(uid,i,d){ const r=hsRec(uid)||(S.dp||[]).find(x=>x.uid===uid); if(!r) return;
  const sp=r.spells&&r.spells[i]; if(!sp) return;
  const b=spellBase(sp.name); sp.red=Math.max(0,(sp.red||0)+d);
  if(b!=null) sp.red=Math.min(sp.red,b-2); render(); }
export function hsSpells(rec){ return rec.spells||[]; }
export function addHsSpell(uid){ const r=hsRec(uid)||(S.dp||[]).find(d=>d.uid===uid); if(!r) return;
  const e=HIREDSWORDS[r.key]||DRAMATIS[r.key]; if(!e||!e.magic) return;
  const el=document.getElementById('hssp-'+uid); const name=el&&el.value; if(!name||name==='\u2014') return;
  r.spells=r.spells||[]; if(r.spells.some(x=>x.name===name)) return;
  r.spells.push({name}); render(); }
export function delHsSpell(uid,i){ const r=hsRec(uid)||(S.dp||[]).find(d=>d.uid===uid); if(!r) return;
  (r.spells||[]).splice(i,1); render(); }
export function setHsSpOpen(uid,v){ const r=hsRec(uid)||(S.dp||[]).find(d=>d.uid===uid); if(r) r._spOpen=!!v; }
export function hsSpellSection(rec,e){
  if(!e||!e.magic||!SPELLS[e.magic]) return '';
  const lore=e.magic, list=SPELLS[lore].spells.filter(x=>!String(x[0]).startsWith('\u25b8'));
  const sel=hsSpells(rec);
  const chips=sel.map((sp,i)=>{ const d=(typeof spellEffDiff==='function')?spellEffDiff(sp):null;
    return `<span class="spellchip" title="${String(spellEffect(sp.name,lore)||'').replace(/"/g,'&quot;')}">${spellLabel(sp.name)}${d!=null?` <b>(${d})</b>`:''}<button class="advx no-print" title="Difficulty \u22121 (e.g. an advancement re-rolled a spell he already knew)" onclick="hsSpellRed('${rec.uid}',${i},1)">\u25bc</button><button class="advx no-print" title="remove" onclick="delHsSpell('${rec.uid}',${i})">\u00d7</button></span>`; }).join('');
  const taken=new Set(sel.map(x=>x.name));
  const opts=list.filter(x=>!taken.has(x[0])).map(x=>`<option value="${String(x[0]).replace(/"/g,'&quot;')}">${x[0]}</option>`).join('');
  return `<details class="adv spell caster" ${rec._spOpen?'open':''} ontoggle="setHsSpOpen('${rec.uid}',this.open)">
      <summary><span class="spelltag">\u2726 Caster</span>Spells / Prayers \u2014 ${SPELLS[lore].name}${sel.length?` <b>(${sel.length})</b>`:''}</summary>
      ${chips?`<div class="advchips">${chips}</div>`:'<div class="note" style="padding:2px 10px">No spells chosen yet.</div>'}
      <div class="advskilladd no-print"><select id="hssp-${rec.uid}"><option value="\u2014">\u2014 choose spell \u2014</option>${opts}</select>
      <button class="btnsm" onclick="addHsSpell('${rec.uid}')">+ Spell</button></div>
      <div class="note" style="padding:2px 10px 8px">Number = difficulty (2D6 to cast). \u201c\u25bc\u201d lowers it by 1 \u2014 e.g. when an advancement re-rolled a spell he already knew.</div>
    </details>`;
}
export function addHsSpellFromAdv(uid){ const el=document.getElementById('hssp2-'+uid); if(!el) return;
  const v=el.value; if(!v||v==='\u2014') return;
  const r=hsRec(uid)||(S.dp||[]).find(d=>d.uid===uid); if(!r) return;
  const e=HIREDSWORDS[r.key]||DRAMATIS[r.key]; if(!e||!e.magic) return;
  r.spells=r.spells||[]; if(r.spells.some(x=>x.name===v)) return;
  r.spells.push({name:v}); render(); }
export function hsAdvSection(rec,e){
  const th=[2,5,9,14];                       // Henchmen-XP-Pfad
  const xp=hsExp(rec), earned=th.filter(t=>t<=xp).length;
  const adv=rec.adv||{}, skills=rec.skills||[];
  const _sp=(rec.spells||[]);
  const _spAdv=Math.max(0,_sp.length-spellStartCount(e))+_sp.reduce((a,x)=>a+(Number(x.red)||0),0);
  const applied=Object.values(adv).reduce((a,v)=>a+(Number(v)||0),0)+skills.length+_spAdv;
  const order=["M","WS","BS","S","T","W","I","A","Ld"];
  const chips=order.filter(x=>adv[x]).map(x=>`<span class="advchip">+${adv[x]} ${x}<button class="advx no-print" title="remove" onclick="remHsAdv('${rec.uid}','${x}')">\u00d7</button></span>`).join('')
    + skills.map((sk,i)=>`<span class="advchip skill" title="${skillText(sk,e).replace(/"/g,'&quot;')}">${String(sk).replace(/</g,'&lt;')}<button class="advx no-print" title="remove" onclick="remHsSkillIdx('${rec.uid}',${i})">\u00d7</button></span>`).join('');
  const btns=order.map(x=>{ const ok=hsCanAdv(rec,e,x);
    return `<button class="btnsm advb" ${ok?'':'disabled'} title="${ok?('apply +1 '+x):'racial maximum reached'}" onclick="addHsAdv('${rec.uid}','${x}')">+${x}</button>`; }).join('');
  const mx=hsRaceMax(e);
  const maxNote = mx ? `Maxima (${raceEN(e.race)}): ${order.map(x=>`${x} ${mx[x]}`).join(' \u00b7 ')}.` : 'No racial maxima on file \u2014 track manually.';
  let stTxt,stCls;
  if(applied<earned){ stTxt=`${earned-applied} to apply`; stCls='advopen'; }
  else if(applied>earned){ stTxt=`${applied-earned} over earned`; stCls='advwarn'; }
  else { stTxt='complete'; stCls='advok'; }
  const track=th.map(t=>`<span class="xp-t ${xp>=t?'on':''}" title="Advance at ${t} XP">${t}</span>`).join('');
  return `<details class="adv" ${rec._advOpen?'open':''} ontoggle="setHsAdvOpen('${rec.uid}',this.open)">
    <summary>Advances &amp; Stats \u2014 <b>${applied}/${earned}</b> Applied \u00b7 <span class="${stCls}">${stTxt}</span></summary>
    <div class="advstat">XP <input type="number" min="0" max="${HS_XP_MAX}" value="${xp}" oninput="setHsExp('${rec.uid}',this.value)"> / ${HS_XP_MAX}
      <span class="xp-track">${track}</span> \u00b7 earned: <b>${earned}</b> \u00b7 applied: <b>${applied}</b></div>
    ${chips?`<div class="advchips">${chips}</div>`:`<div class="note" style="padding:2px 10px">No advances applied yet.</div>`}
    <div class="advbtns no-print">${btns}</div>
    <div class="advskilladd no-print"><select id="hssk-${rec.uid}" class="advsel"><option value="\u2014">\u2014 choose a skill \u2014</option>${hsSkillSelect(rec,e)}</select><button class="btnsm" onclick="addHsSkill('${rec.uid}')">+ Skill</button></div>
    ${e.magic&&SPELLS[e.magic]?`<div class="advskilladd no-print"><span class="spelltag">\u2726</span><select id="hssp2-${rec.uid}" onchange="document.getElementById('hssp-${rec.uid}')&&(document.getElementById('hssp-${rec.uid}').value=this.value)"><option value="\u2014">\u2014 or take a new spell instead of a skill \u2014</option>${SPELLS[e.magic].spells.filter(x=>!String(x[0]).startsWith('\u25b8')&&!(rec.spells||[]).some(y=>y.name===x[0])).map(x=>`<option value="${String(x[0]).replace(/"/g,'&quot;')}">${x[0]}</option>`).join('')}</select><button class="btnsm" onclick="addHsSpellFromAdv('${rec.uid}')">+ Spell</button></div>`:''}
    <div class="note" style="padding:2px 10px 8px">XP path: <b>Henchmen</b> (2 / 5 / 9 / 14, max ${HS_XP_MAX}) \u2014 but advances are rolled on the <b>Heroes</b> table: 2\u20135 New Skill \u00b7 6: +1 S/A \u00b7 7: +1 WS/BS \u00b7 8: +1 I/Ld \u00b7 9: +1 W/T \u00b7 10\u201312 New Skill.<br>${maxNote}</div>
  </details>`;
}
export function hsExpSection(rec,hs){
  const x=hsExp(rec), due=hsAdvancesDue(rec);
  const track=HS_ADV.map(t=>`<span class="xp-t ${x>=t?'on':''}" title="Advance at ${t} XP">${t}</span>`).join('');
  const sk=(rec.skills||[]).map(n=>`<span class="hs-skill" title="${skillText(n).replace(/"/g,'&quot;')}">${n}<button class="tiny ghost" onclick="delHsSkill('${rec.uid}',this.parentNode.firstChild.textContent)">\u2715</button></span>`).join('');
  return `<div class="hs-exp">
      <label>XP <input type="number" min="0" max="${HS_XP_MAX}" value="${x}" oninput="setHsExp('${rec.uid}',this.value)"></label>
      <span class="xp-track">${track}</span>
      <span class="xp-note">${due?due+' advance'+(due>1?'s':'')+' \u2014 roll on the <b>Heroes</b> table':'Henchmen XP path \u00b7 Heroes advances'}</span>
      <div class="hs-skills">${sk}
        <select id="hssk-${rec.uid}" class="hs-sksel"><option value="">+ skill\u2026</option>${hsSkillOptions(hs)}</select>
        <button class="tiny" onclick="addHsSkill('${rec.uid}')">Add</button></div>
    </div>`;
}
export function hsRosterCards(){
  return hsList().map(h=>{ const hs=HIREDSWORDS[h.key]; if(!hs) return '';
    const up=hsUpkeepFor(h.key);
    const hc=(typeof hsHireCost==='function')?hsHireCost(h.key):hs.hire; const meta=`Hire ${hc<hs.hire?hc+' gc (was '+hs.hire+')':hs.hire+' gc'} \u00b7 Upkeep ${up} gc \u00b7 Rating +${hs.rating+(typeof hsExp==='function'?hsExp(h):0)}`
      +(hs.faq?` \u00b7 <span class="hs-faq" title="${hs.faq.replace(/"/g,'&quot;')}">FAQ</span>`:'');
    const notes=hs.upkeepNote?`<div class="hs-notes">${noteLines(hs.upkeepNote)}</div>`:'';
    return `<div class="model"><div class="mhead">
        <span class="badge hs">Hired Sword</span>
        <input class="namefld" value="${(h.name!=null?h.name:hs.name).replace(/"/g,'&quot;')}" oninput="hsSetName('${h.uid}',this.value)">
        <span class="note">${hs.grade}</span>
        <button class="tiny ghost no-print" onclick="ttsOpenHS('${h.uid}')" title="Description for Tabletop Simulator">\u29c9 TTS</button>
        <button class="tiny ghost no-print" onclick="unhireHS('${h.uid}')">remove</button>
      </div><div class="mbody">
        ${statTableHS(hs,h,true)}
        <div class="hs-card-eq"><b>Equipment:</b> ${hs.eq}</div>
        <div class="hs-card-rules">${hsAbilitySection(hs,h)}</div>
        <div class="hs-card-meta">${meta}</div>
        ${notes}
        ${hsOptSection(h,hs)}
        ${hsSpellSection(h,hs)}
        ${hsAdvSection(h,hs)}
        ${hsEqSection(h)}
        <div class="subtotal">${hs.hire} GK</div>
      </div></div>`;
  }).join('');
}
export function hsSetName(uid,v){ const h=hsList().find(x=>x.uid===uid); if(h){ h.name=v; } }




/* ===================== STATE ===================== */
export let S={wb:null, subtype:null, name:"", budget:500, models:[]};
export let uid=1;

/* ===================== HAUSREGELN (House Rules) ===================== */
export function houseDefaults(){ return {startGold:'',min:'',max:'',heroes:6,priceAll:100,priceArmour:100,priceBP:100,priceMissile:100,clubSurcharge:0,slingSurcharge:0,armourBodyOnly:false,freeDagger:false,miscHench:false,freeMarket:false,allSkills:false,showRarity:false,rangedCapOn:false,rangedCap:0,rerollOne:false,eqLimitOn:true,hsGrades:{'1a':true,'1b':true,'1c':true,'2a':true},dpGrades:{core:true,'1a':true,'1b':true,'1c':true,'2a':true},hsEquip:false,notes:''}; }
export function HR(){ if(!S.house) S.house=houseDefaults(); else for(const k in houseDefaults()) if(!(k in S.house)) S.house[k]=houseDefaults()[k]; return S.house; }
export function houseActive(){ const h=HR(),d=houseDefaults(); for(const k in d){ if(String(h[k])!==String(d[k])) return true; } return false; }
export function setHouseNum(k,v){ HR()[k]=(v===''||v==null)?'':Math.max(0,Number(v)||0); render(); }
export function setHouseBool(k,v){ HR()[k]=!!v; render(); }
export function setHouseStr(k,v){ HR()[k]=v||''; render(); }
export function setHouseNotes(v){ HR().notes=String(v); const el=document.getElementById('notesprint'); if(el){ el.textContent=v?('House rules / notes: '+v):''; el.style.display=v?'':'none'; } }
export function resetHouse(){ S.house=houseDefaults(); render(); }
export function adjPrice(nm,pr){ const h=HR(); if(typeof pr!=='number') return pr; const fam=itemFamily(nm);
  let mult=(Number(h.priceAll)||100)/100;
  if(['pistol','longgun','swivel'].includes(fam)) mult*=(Number(h.priceBP)||100)/100;
  else if(['bow','crossbow','sling','thrown','blowpipe','sunweapon'].includes(fam)) mult*=(Number(h.priceMissile)||100)/100;
  else if(['lightarmour','heavyarmour','toughenedleathers','gromrilarmour','ithilmararmour','chaosarmour','barding'].includes(fam)) mult*=(Number(h.priceArmour)||100)/100;
  else if(['shield','buckler','helmet'].includes(fam) && !h.armourBodyOnly) mult*=(Number(h.priceArmour)||100)/100;
  let p=Math.round(pr*mult);
  if(fam==='blunt') p+=Number(h.clubSurcharge)||0;
  if(fam==='sling') p+=Number(h.slingSurcharge)||0;
  if(p>0 && typeof itemHalfActive==='function' && itemHalfActive(nm)) p=Math.floor(p*0.5);
  return Math.max(0,p);
}

/* ============================================================================
   DRAMATIS PERSONAE (Core + Grade 1a) — nutzt WBHIRE + hsHireRuleAllows +
   hireEligibility(TABLE) + statTableHS/hsAbilitySection/ttsTextHS mit.
   DP: kein XP, einzigartig (1 je Charakter), eigene Ausrüstung, Hire+Upkeep
   nach jeder Schlacht, zählen NICHT zur Modell-/Heldenzahl (aber zum Rating).
   ========================================================================== */



export function dpGradeAllowed(g){ const dg=HR().dpGrades; return dg?dg[g]!==false:true; }
export function setDpGrade(g,on){ const h=HR(); if(!h.dpGrades) h.dpGrades={core:true,'1a':true,'1b':true,'1c':true,'2a':true}; h.dpGrades[g]=!!on; render(); }
export function dpEligibility(wbKey){
  const wb=Object.assign({key:wbKey,subtype:(typeof S!=='undefined'&&S)?S.subtype:null},WBHIRE[wbKey]||{align:'neutral'});
  const out={allowed:[],blocked:[]};
  for(const key of Object.keys(DRAMATIS)){ const dp=DRAMATIS[key]; let ok=true,reason='';
    const named=dp.rule&&(dp.rule.type==='onlyWb'||dp.rule.type==='only')&&(dp.rule.wbs||[]).includes(wb.key);
    if(wb.none && !named){ ok=false; reason='warband cannot recruit special characters'; }
    else if(!hsHireRuleAllows(dp,wb)){ ok=false; reason='not available to this warband'; }
    if(!ok){ out.blocked.push({key,name:dp.name,reason}); continue; }
    out.allowed.push({key,name:dp.name,hire:dp.hire,upkeep:dp.upkeep,rating:dp.rating}); }
  return out; }
export function dpList(){ return (S.dp||[]); }
export function dpCount(key){ return dpList().filter(d=>d.key===key).length; }
export function dpHireTotal(){ return dpList().reduce((s,d)=>s+(typeof dpHireCost==='function'?dpHireCost(d.key):((DRAMATIS[d.key]&&DRAMATIS[d.key].hire)||0)),0); }
export function dpUpkeepTotal(){ return dpList().reduce((s,d)=>s+((DRAMATIS[d.key]&&DRAMATIS[d.key].upkeep)||0),0); }
export function dpRatingTotal(){ return dpList().reduce((s,d)=>s+((DRAMATIS[d.key]&&DRAMATIS[d.key].rating)||0),0); }
export function hireDP(key){ const dp=DRAMATIS[key]; if(!dp) return;
  if(!dpGradeAllowed(dp.grade)) return;
  if(!dpEligibility(S.wb).allowed.some(a=>a.key===key)) return;
  if(dpCount(key)>=1) return;               // einzigartig
  if(!S.dp) S.dp=[];
  S.dp.push({key,uid:'dp'+Date.now()+Math.floor(Math.random()*1000)}); render(); }
export function unhireDP(uid){ S.dp=dpList().filter(d=>d.uid!==uid); render(); }
export function dpSetName(uid,v){ const d=dpList().find(x=>x.uid===uid); if(d) d.name=v; }

export function dpRosterCards(){
  return dpList().map(d=>{ const dp=DRAMATIS[d.key]; if(!dp) return '';
    const cost = dp.hire>0?`Hire ${dp.hire} gc`:'Hire: special';
    const upk = dp.upkeep>0?` \u00b7 Upkeep ${dp.upkeep} gc`:'';
    const meta=`${cost}${upk} \u00b7 Rating +${dp.rating}`;
    const notes=dp.upkeepNote?`<div class="hs-notes">${noteLines(dp.upkeepNote)}</div>`:'';
    let stat=statTableHS(dp,d,true);

    return `<div class="model"><div class="mhead">
        <span class="badge dp">Dramatis Personae</span>
        <input class="namefld" value="${(d.name!=null?d.name:dp.name).replace(/"/g,'&quot;')}" oninput="dpSetName('${d.uid}',this.value)">
        <span class="note">${dp.grade}</span>
        <button class="tiny ghost no-print" onclick="ttsOpenDP('${d.uid}')" title="Description for Tabletop Simulator">\u29c9 TTS</button>
        <button class="tiny ghost no-print" onclick="unhireDP('${d.uid}')">remove</button>
      </div><div class="mbody">
        ${stat}
        <div class="hs-card-eq"><b>Equipment:</b> ${hsChosenEq(d,dp)}</div>
        <div class="hs-card-rules">${hsAbilitySection(dp,d)}</div>
        <div class="hs-card-meta">${meta}</div>
        ${notes}
        ${hsOptSection(d,dp)}
        ${hsSpellSection(d,dp)}
        ${hsEqSection(d)}
        <div class="subtotal">${dp.hire>0?dp.hire+' GK':'\u2014'}</div>
      </div></div>`;
  }).join('');
}


export function renderDramatis(){
  const host=document.getElementById('dppanel'); if(!host) return;
  if(!S.wb || !WBHIRE[S.wb]){ host.innerHTML=''; return; }
  const e=dpEligibility(S.wb);
  const dg=HR().dpGrades||{};
  const gradeSel=`<span class="hs-grade-boxes" title="House rule: which Dramatis Personae grades are available">`+
    DP_GRADE_ORDER.map(g=>`<label class="hs-gbox"><input type="checkbox" ${dg[g]!==false?'checked':''} onchange="setDpGrade('${g}',this.checked)">${g}</label>`).join('')+`</span>`;
  const hired=dpList().map(d=>{ const dp=DRAMATIS[d.key]; if(!dp) return '';
    const c=dp.hire>0?`${dp.hire} gc`:'special'; const u=dp.upkeep>0?`Upkeep ${dp.upkeep}`:'no gold upkeep';
    return `<div class="hs-hired"><div class="hs-hired-top"><b>${dp.name}</b><span class="hs-badge">${dp.grade}</span>
        <button class="tiny ghost" onclick="unhireDP('${d.uid}')" title="Dismiss">\u2715</button></div>
      ${statTableHS(dp,d,false)}
      <div class="hs-hired-meta">Hire ${c} \u00b7 ${u} \u00b7 Rating +${dp.rating}</div></div>`;
  }).join('');
  const rows=e.allowed.filter(a=>dpGradeAllowed(DRAMATIS[a.key].grade) && dpCount(a.key)<1 && passStatFilter(DRAMATIS[a.key],dpFilter)).map(a=>{
    const dp=DRAMATIS[a.key]; const dhc=(typeof dpHireCost==='function')?dpHireCost(a.key):dp.hire; const c=dp.hire>0?(dhc<dp.hire?`<s>${dp.hire}</s> <b>${dhc}</b>`:dp.hire):'\u2014';
    return `<tr><td class="hs-prev" onmouseenter="showPreview(this,'${a.key}')" onmouseleave="hideItip()" onclick="toggleItipPreview(event,this,'${a.key}')">${dp.name} \u24d8</td><td><span class="hs-badge">${dp.grade}</span></td>${dpFilter.stat?`<td class="num"><b>${dp.profile[dpFilter.stat]!==undefined?dp.profile[dpFilter.stat]:'\u2014'}</b></td>`:''}<td class="num">${c}</td><td class="num">${dp.upkeep||'\u2014'}</td><td class="num">+${dp.rating}</td><td class="num"><button class="tiny" onclick="hireDP('${a.key}')">Recruit</button></td></tr>`;
  }).join('');
  const none=e.allowed.length===0?`<div class="hs-none">No Dramatis Personae will join this warband.</div>`:'';
  host.innerHTML=`<details class="sec-details" ${dpOpen?'open':''} ontoggle="dpOpen=this.open"><summary class="sec-sum">Dramatis Personae${dpList().length?' <span class="hr-on">'+dpList().length+'</span>':''}</summary><div class="sec-body"><div class="hs-head">${gradeSel}</div>${statFilterBar('dp',dpFilter,'setDpFilter')}
    ${hired?`<div class="hs-hired-wrap">${hired}</div>`:''}
    ${none}
    ${rows?`<table class="hs-tbl"><thead><tr><th>Available</th><th>Grade</th>${dpFilter.stat?`<th class="num">${dpFilter.stat}</th>`:''}<th class="num">Hire</th><th class="num">Upk</th><th class="num">Rat</th><th></th></tr></thead><tbody>${rows}</tbody></table>`:(e.allowed.length&&!none?`<div class="hs-none">All available special characters are recruited or filtered out by grade.</div>`:'')}
    <div class="hs-foot">Special characters are unique (one each), earn no experience, keep their own equipment, and don't count toward the model/Hero limit \u2014 but add their full rating. Found by sending Heroes to search (roll under Initiative).</div></div></details>`;
}

/* ============================================================================
   KAMPAGNEN-LAYER (Control / Foothold) — mordheim-map.com
   S.campaign.districts = { <id>: 'none'|'foothold'|'control' } (fährt via JSON
   automatisch im Save/Export mit). DISTRICTS = überschreibbare Definitionstabelle
   (House-Rule-editierbar). priceMod() ist stapelbar (weitere Quellen andockbar).
   Namen/Gruppierung orientieren sich an der Karten-Legende; anpassbar.
   ========================================================================== */


export function campDistricts(){ if(!S.campaign) S.campaign={districts:{}}; if(!S.campaign.districts) S.campaign.districts={}; return S.campaign.districts; }
export function districtState(id){ return campDistricts()[id]||'none'; }
export function setDistrict(id,state){ campDistricts()[id]=state; render(); }
export function activeDistrictEffects(){ const cd=campDistricts(); const out=[];
  for(const d of DISTRICTS){ const st=cd[d.id]||'none'; if(st==='none') continue;
    for(const eff of d.effects){ if(eff.tier==='control' && st!=='control') continue; out.push(Object.assign({district:d.name},eff)); } }
  return out; }

/* Stapelbarer Preis-Modifikator. kind:'hire'|'item'. Weitere Quellen (Händler-HS,
   Alignment-Aufschlag) können hier zusätzlich einstapeln. Gibt Multiplikator zurück. */
export function priceMod(kind,key){ let mult=1;
  for(const eff of activeDistrictEffects()){
    if(kind==='hire' && eff.kind==='hireHalf' && (eff.keys||[]).includes(key)) mult=Math.min(mult,0.5);
    if(kind==='item' && eff.kind==='itemHalf' && (eff.keys||[]).includes(key)) mult=Math.min(mult,0.5);
  }
  return mult; }
export function itemHalfActive(en){ if(!en) return false; const nz=x=>String(x).toLowerCase().replace(/[^a-z0-9]/g,'');
  const t=nz(en); for(const eff of activeDistrictEffects()){ if(eff.kind==='itemHalf'){ for(const k of (eff.keys||[])){ if(nz(k)===t) return true; } } } return false; }
export function hireCostOf(TABLE,key){ const e=TABLE[key]; if(!e) return 0; return Math.floor((e.hire||0)*priceMod('hire',key)); }
export function hsHireCost(key){ return hireCostOf(HIREDSWORDS,key); }
export function dpHireCost(key){ return hireCostOf(DRAMATIS,key); }
export function hireDiscounted(key){ const anyTab=HIREDSWORDS[key]||DRAMATIS[key]; return anyTab && priceMod('hire',key)<1; }

export function renderCampaign(){
  const host=document.getElementById('campaignpanel'); if(!host) return;
  if(!S.wb){ host.innerHTML=''; return; }
  const on=(S.campaign&&S.campaign.on);
  if(!on){ host.innerHTML=`<details class="sec-details" ${campOpen?'open':''} ontoggle="campOpen=this.open"><summary class="sec-sum">Campaign</summary><div class="sec-body"><label class="hs-gbox"><input type="checkbox" onchange="campToggle(this.checked)"> enable campaign layer</label>
      <div class="hs-foot">Optional Control/Foothold layer (mordheim-map.com). Enable to set the districts your warband holds; \u00bd-price bonuses then apply to Hired Sword / Dramatis Personae hiring. Saved with your warband.</div></details>`; return; }
  const groups={}; DISTRICTS.forEach(d=>{ (groups[d.area]=groups[d.area]||[]).push(d); });
  const seg=Object.keys(groups).map(area=>{
    const rows=groups[area].slice().sort((a,b)=>a.name.localeCompare(b.name)).map(d=>{ const st=districtState(d.id);
      const eff=d.effects.map(e=>e.label).join('<br>');
      const hf=(d.hardFought?' <span class="hs-badge camp-hf" title="Hard Fought \u2014 the benefits apply only if you CONTROL this district (sole foothold holder)">Hard Fought</span>':'')+(d.abundance?' <span class="hs-badge camp-ab" title="Abundance of Wyrdstone \u2014 winner of a battle here gains +1D3 wyrdstone (not affected by control)">\u2604</span>':'')+(d.gate?' <span class="hs-badge" title="Gate of Mordheim">Gate</span>':'');
      const sel=g=>`<option value="${g}"${st===g?' selected':''}>${g}</option>`;
      return `<div class="camp-row"><div class="camp-d"><b>${d.name}</b>${hf}<div class="camp-eff">${eff}</div></div>
        <select class="camp-sel" onchange="setDistrict('${d.id}',this.value)">${sel('none')}${sel('foothold')}${sel('control')}</select></div>`;
    }).join('');
    return `<div class="ulsec">${area}</div>${rows}`;
  }).join('');
  // Aktive Boni: automatisch angewandt vs. Erinnerung
  const act=activeDistrictEffects();
  const hires=[...new Set(act.filter(e=>e.kind==='hireHalf').flatMap(e=>e.keys).map(k=>(HIREDSWORDS[k]||DRAMATIS[k]||{}).name).filter(Boolean))];
  const items=[...new Set(act.filter(e=>e.kind==='itemHalf').flatMap(e=>e.keys))];
  const unitc=act.filter(e=>e.kind==='unitCost').map(e=>e.label);
  const others=act.filter(e=>e.kind==='other').map(e=>`<b>${e.district}:</b> ${e.label}`);
  const auto=[];
  if(hires.length) auto.push(`\u00bd-price hire: ${hires.join(', ')}`);
  if(items.length) auto.push(`\u00bd-price items: ${items.join(', ')} <i>(fixed costs & variable bases; roll & halve dice yourself)</i>`);
  unitc.forEach(u=>auto.push(u));
  const summary = act.length?`<div class="camp-sum">`
      +(auto.length?`<div class="camp-auto"><b>\u2713 Applied automatically</b><ul>${auto.map(l=>`<li>${l}</li>`).join('')}</ul></div>`:'')
      +(others.length?`<div class="camp-remind"><b>\u2691 Battle / campaign reminders</b><ul>${others.map(l=>`<li>${l}</li>`).join('')}</ul></div>`:'')
      +`</div>`:'';
  host.innerHTML=`<details class="sec-details" ${campOpen?'open':''} ontoggle="campOpen=this.open"><summary class="sec-sum">Campaign <span class="hr-on">on</span></summary><div class="sec-body"><label class="hs-gbox"><input type="checkbox" checked onchange="campToggle(this.checked)"> enabled</label>
    <div class="camp-io no-print"><button class="tiny" onclick="openCampaignIO()">\u2b06 Export</button> <button class="tiny" onclick="openCampaignIO()">\u2b07 Import</button></div>
    ${summary}
    ${seg}
    <div class="hs-foot">Control = you are the sole foothold holder (Hard Fought districts). Half-price always rounds down; rare items still need their availability roll.</div></details>`;
}
export function campToggle(on){ if(!S.campaign) S.campaign={districts:{}}; S.campaign.on=!!on; render(); }
export function exportCampaign(){ const data={type:'mordheim-campaign',wb:S.wb,name:S.name||'',campaign:S.campaign||{districts:{}}}; dl(JSON.stringify(data,null,2),(safeName?safeName():'warband')+'_campaign.json','application/json'); }
export function importCampaign(ev){ const f=ev.target.files&&ev.target.files[0]; if(!f) return; const rd=new FileReader();
  rd.onload=()=>{ try{ const d=JSON.parse(rd.result); const camp=d.campaign||(d.districts?d:null); if(camp){ S.campaign=Object.assign({on:true},camp); render(); } }catch(e){ alert('Could not read campaign file.'); } };
  rd.readAsText(f); ev.target.value=''; }

export function campaignJSON(){ return JSON.stringify({type:'mordheim-campaign',wb:S.wb,name:S.name||'',campaign:S.campaign||{on:false,districts:{}}},null,2); }
export function campaignTextReport(){ const cd=(S.campaign&&S.campaign.districts)||{}; const held=DISTRICTS.filter(d=>cd[d.id]&&cd[d.id]!=='none');
  const lines=['MORDHEIM CAMPAIGN','Warband: '+(S.name||'(unnamed)')+(S.wb?' ['+S.wb+']':''),''];
  if(!held.length) lines.push('No districts held.');
  else { const areas=[...new Set(held.map(d=>d.area))];
    areas.forEach(a=>{ lines.push(a.toUpperCase()); held.filter(d=>d.area===a).sort((x,y)=>x.name.localeCompare(y.name)).forEach(d=>{ lines.push('  '+d.name+' \u2014 '+cd[d.id].toUpperCase()+(d.hardFought?' (Hard Fought)':'')); }); lines.push(''); }); }
  const act=activeDistrictEffects();
  if(act.length){ lines.push('ACTIVE EFFECTS'); act.forEach(e=>lines.push('  \u2022 '+e.district+': '+e.label)); }
  return lines.join('\n'); }
export function openCampaignIO(){ const ta=document.getElementById('campexport'); if(ta) ta.value=campaignJSON(); const pb=document.getElementById('camppaste'); if(pb) pb.value=''; document.getElementById('campmodal').style.display='flex'; }
export function closeCampaignIO(){ document.getElementById('campmodal').style.display='none'; }
export function campShowJSON(){ document.getElementById('campexport').value=campaignJSON(); }
export function campShowText(){ document.getElementById('campexport').value=campaignTextReport(); }
export function copyCampaign(){ const ta=document.getElementById('campexport'); ta.select(); ta.setSelectionRange(0,99999); if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(ta.value).then(()=>{ if(typeof flash==='function') flash('Campaign copied.'); },()=>{}); } else { try{ document.execCommand('copy'); if(typeof flash==='function') flash('Campaign copied.'); }catch(e){} } }
export function downloadCampaignJSON(){ dl(campaignJSON(),(typeof safeName==='function'?safeName():'warband')+'_campaign.json','application/json'); }
export function downloadCampaignText(){ dl(campaignTextReport(),(typeof safeName==='function'?safeName():'warband')+'_campaign.txt','text/plain;charset=utf-8'); }
export function importCampaignText(str){ str=String(str||'').trim(); if(!str){ if(typeof flash==='function') flash('Nothing to import.'); return; }
  try{ const d=JSON.parse(str); const camp=d.campaign||(d.districts?d:null); if(!camp||typeof camp!=='object'){ if(typeof flash==='function') flash('No campaign data found.'); return; }
    S.campaign=Object.assign({on:true,districts:{}},camp); if(!S.campaign.districts) S.campaign.districts={};
    closeCampaignIO(); render(); if(typeof flash==='function') flash('Campaign imported.'); }
  catch(e){ if(typeof flash==='function') flash('Could not read campaign data (expects JSON).'); } }
export function importCampaignFile(ev){ const f=ev.target.files&&ev.target.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=>importCampaignText(rd.result); rd.readAsText(f); ev.target.value=''; }

export function _modelHasRanged(m){ const def=unitDef(m.uid_def); if(!def) return false;
  const RNG=['bow','crossbow','sling','thrown','blowpipe','sunweapon','pistol','longgun','swivel'];
  if(def.eq){ const list=eqListFor(def); if(list) for(const cat in list) for(const [nm] of list[cat]){ if((Number(m.eq[nm])||0)>0 && RNG.includes(itemFamily(nm))) return true; } }
  if(def.gear) for(const g of def.gear){ if(RNG.includes(itemFamily(g))) return true; }
  const r=m.rare||{}; for(const de in r){ const it=CATALOG.find(x=>x.de===de); if(it&&(it.cat==='missile'||it.cat==='bp')) return true; }
  return false;
}
export function rangedModelCount(){ return S.models.reduce((s,m)=>{ const def=unitDef(m.uid_def); const q=(def&&def.t==='hen')?(Number(m.qty)||1):1; return s+(_modelHasRanged(m)?q:0); },0); }
export function rerollItemCount(){ const RX=/gl(ü|u)cksbringer|lucky charm|hasenpfote|rabbit|relikt|\brelic\b|familiar|vertrauter|gl(ü|u)cksklee/i;
  return S.models.reduce((s,m)=>{ const def=unitDef(m.uid_def); const q=(def&&def.t==='hen')?(Number(m.qty)||1):1; let n=0;
    for(const nm in (m.eq||{})){ if((Number(m.eq[nm])||0)>0 && RX.test(nm)) n++; }
    for(const de in (m.rare||{})){ const it=CATALOG.find(x=>x.de===de); const nm=it?(it.de+' '+it.en):de; if(RX.test(nm)) n+=(Number(m.rare[de].q)||1); }
    return s+n*q; },0); }

/* ===================== PICKER ===================== */
export function renderPicker(){
  const p=document.getElementById('picker'); p.innerHTML='';
  const groups=[
    ["core","Core (rulebook)"],
    ["1a","Grade 1a — official (GW/Fanatic)"],
    ["1b","Grade 1b — unofficial, pro standard"],
    ["1c","Grade 1c — experimental (vetted by 1a/1b authors)"],
    ["2a","Grade 2a — fan-made, reliable (blends with grade 1)"]
  ];
  groups.forEach(([g,label])=>{
    const sortName=n=>String(n).replace(/^(the|der|die|das)\s+/i,'').toLowerCase();
    const entries=Object.entries(WARBANDS).filter(([k,wb])=>(wb.grade||"core")===g)
      .sort((a,b)=>sortName(a[1].name).localeCompare(sortName(b[1].name)));
    if(!entries.length && !(g==="1a")) return;
    const h=document.createElement('h2'); h.className='grade-head'; h.textContent=label; p.appendChild(h);
    const grid=document.createElement('div'); grid.className='picker-grid';
    entries.forEach(([key,wb])=>{
      const heroes=wb.units.filter(u=>u.t==='hero').length;
      const d=document.createElement('div'); d.className='wb-card'; d.onclick=()=>chooseWb(key);
      d.innerHTML=`<div class="seal"></div><span class="gradebadge">${(wb.grade||'core').toUpperCase()}</span>
        <h3>${wb.name}</h3>
        <div class="meta">min ${wb.min} · max ${wb.max} models · ${wb.gold} gc · ${heroes} hero types</div>`;
      grid.appendChild(d);
    });
    p.appendChild(grid);
    if(g==="1a" && PENDING_1A.length){
      const note=document.createElement('div'); note.className='pending';
      note.innerHTML="<b>Folgt (Werte werden geprüft):</b> "+PENDING_1A.join(" · ")+
        "<br><span class='note'>Online kursieren für diese teils inoffizielle Homebrew-Werte; ich baue nur die geprüften offiziellen Listen ein.</span>";
      p.appendChild(note);
    }
  });
}
export function chooseWb(key){
  S={wb:key, subtype:WARBANDS[key].subtypes?WARBANDS[key].subtypes[0].key:null, name:"", budget:WARBANDS[key].gold, models:[], hired:[], dp:[], leaderUid:null, campaign:{on:false,districts:{}}, stash:{wyrd:0,gold:null,items:[]}};
  document.getElementById('picker-view').style.display='none';
  document.getElementById('builder-view').style.display='block';
  document.getElementById('wbname').value='';
  document.getElementById('savename').value='';
  
  setupBuilder(); render(); window.scrollTo(0,0);
}
export function backToPicker(){
  document.getElementById('builder-view').style.display='none';
  document.getElementById('picker-view').style.display='block';
}

/* ===================== BUILDER SETUP ===================== */
// Split a text into one line per rule: breaks before "Header:" patterns, auto-bolds headers,
// and bolds short colon-less standalone rules. Shared by warband rules and unit sp display.
export function ruleSplitBold(p){
  const segs=String(p).split(/(?<=[.!?)"\u201d;]|<\/b>)\s+(?=(?:<b>)?[A-Z][^:<>.]{1,36}:)/);
  return segs.map(x=>x.trim()).filter(Boolean).map(sg=>{
    if(!/^<b>/.test(sg)){
      if(/^[A-Z][^:<>.]{1,36}:/.test(sg)) sg=sg.replace(/^([A-Z][^:<>.]{1,36}:)\s*/,(mm,l)=>'<b>'+l+'</b> ');
      else if(sg.length<60 && !/<b>/.test(sg)) sg='<b>'+sg+'</b>';
    }
    return sg;
  });
}
export function formatRules(s){
  if(!s) return '';
  // Each rule on its own line: split at <br>, at <b> markers, and at "Header:" boundaries.
  const parts=String(s).replace(/<br\s*\/?>/gi,'\u0001').replace(/\s*<b>/g,'\u0001<b>').split('\u0001').map(x=>x.trim()).filter(Boolean);
  let lines=[]; parts.forEach(p=>ruleSplitBold(p).forEach(l=>lines.push(l)));
  // Erste Zeile ohne Doppelpunkt = Intro: nie komplett auto-fett (Konsistenz kurzer/langer Intros).
  if(lines.length && /^<b>[^:<]*<\/b>$/.test(lines[0])) lines[0]=lines[0].replace(/^<b>|<\/b>$/g,'');
  return lines.map(p=> /^<b>/.test(p) ? `<div class="srule">${p}</div>` : `<div class="srule-intro">${p}</div>`).join('');
}
// Render a vehicle's full rules one-per-line (split on <br> and <b>), inside a collapsed <details>.
export function vehRules(sp){
  if(!sp) return '';
  const s=String(sp).replace(/<br\s*\/?>/gi,'\u0001').replace(/\s*<b>/g,'\u0001<b>');
  const parts=s.split('\u0001').map(x=>x.trim()).filter(Boolean);
  return parts.map(p=> /^<b>/.test(p) ? `<div class="srule">${p}</div>` : `<div class="srule-intro">${p}</div>`).join('');
}
export function vehRulesBlock(def){
  if(!def||!def.vehicle||!def.sp) return '';
  const n=(String(def.sp).match(/<b>/g)||[]).length;
  return `<details class="vehrules no-print"><summary>⚙ ${def.name} — full rules${n?` (${n})`:''}</summary><div class="vehrules-body">${vehRules(def.sp)}</div></details>
    <div class="vehrules print-only">${vehRules(def.sp)}</div>`;
}
export function setupBuilder(){
  const wb=WARBANDS[S.wb];
  document.getElementById('wbtype').textContent=wb.name;
  document.getElementById('srules').innerHTML=formatRules(wb.rules);
  renderExtra();
  
  // subtype picker
  const st=document.getElementById('subtype-pick');
  if(wb.subtypes){
    const lbl=wb.subtypeLabel||'Variant: ';
    const cur=wb.subtypes.find(s=>s.key===S.subtype)||wb.subtypes[0];
    st.innerHTML='<label style="font-weight:600">'+lbl+'</label>'+wb.subtypes.map(s=>
      `<button class="tiny ${s.key===S.subtype?'blood':'ghost'}" onclick="pickSub('${s.key}')">${s.name}</button>`).join(' ')
      +(cur&&cur.note?`<div class="subnote">${cur.note}</div>`:'');
  } else st.innerHTML='';
  document.getElementById('wbname').oninput=e=>{S.name=e.target.value;};
}
export function renderExtra(){
  const box=document.getElementById('sextra'); if(!box) return;
  const ex=WBEXTRA[S.wb]; if(!ex){box.innerHTML=''; return;}
  let html='';
  if(ex.magic && SPELLS[ex.magic]){
    const sc=SPELLS[ex.magic];
    let body='<div class="lore-note">'+sc.note+'</div>';
    if(sc.spells && sc.spells.length){
      body+='<table class="lore-tbl">'+sc.spells.map(s=>
        '<tr><td class="lore-n">'+s[0]+'</td><td>'+(s[1]||'<i>effect t.b.d.</i>')+'</td></tr>').join('')+'</table>';
    }
    html+='<details class="lore"><summary>Magic / Prayers — '+sc.name+'</summary>'+body+'</details>';
  }
  if(ex.skills && SKILLSETS[ex.skills]){
    const sk=SKILLSETS[ex.skills];
    let body='<div class="lore-note">'+sk.note+'</div><table class="lore-tbl">'+sk.skills.map(s=>
      '<tr><td class="lore-n">'+s[0]+'</td><td>'+s[1]+'</td></tr>').join('')+'</table>';
    html+='<details class="lore"><summary>Special Skills — '+sk.name+'</summary>'+body+'</details>';
  }
  box.innerHTML=html;
}
export function pickSub(k){
  const wb=WARBANDS[S.wb]; S.subtype=k;
  const sub=wb.subtypes.find(s=>s.key===k);
  S.budget=sub.gold; if(S.stash) S.stash.gold=sub.gold;
  // ungültige Ausrüstung nach Stammwechsel entfernen (z. B. Kurgan-Bogen)
  S.models.forEach(m=>{ const def=unitDef(m.uid_def); const list=eqListFor(def); if(!list) return;
    const valid=new Set(); for(const c in list) for(const [nm] of list[c]) valid.add(nm);
    Object.keys(m.eq).forEach(nm=>{ if(!valid.has(nm)) delete m.eq[nm]; }); });
  setupBuilder(); render();
}

/* ===================== ADD / REMOVE ===================== */
export function unitDef(id){return WARBANDS[S.wb].units.find(u=>u.id===id);}
export function countOf(id){return S.models.filter(m=>m.uid_def===id).length;}
export function modelsOf(id){const def=unitDef(id); if(def.t==='hero') return countOf(id);
  return S.models.filter(m=>m.uid_def===id&&!m.promoted).reduce((s,m)=>s+(m.qty||1),0);}
/* --- Subtyp-Effekte (Marauder-Stämme) --- */
export function unitMax(def){ if(S.wb==='maraudersofchaos'&&S.subtype==='kurgan'&&def.id==='warhound') return null; return def.max; }
export function warbandMax(){ const h=HR(); if(h.max!==''&&h.max!=null) return Number(h.max); const wb=WARBANDS[S.wb]; if(S.wb==='maraudersofchaos'&&S.subtype==='hung') return 12; let mx=wb.max; if(S.wb==='carnival'&&(S.models||[]).some(m=>m.uid_def==='cart')) mx+=2; mx+= (typeof hsSizeBonus==='function'?hsSizeBonus():0); return mx; }
export function eqListFor(def){ let list=LISTS[def.eq]; if(!list) return list;
  if(S.wb==='maraudersofchaos'&&S.subtype==='kurgan'&&(def.eq==='marChaosHero'||def.eq==='marChaosHench')){
    list=JSON.parse(JSON.stringify(list)); list.Fernkampf=list.Fernkampf||[];
    if(!list.Fernkampf.some(x=>x[0]==='Bogen')) list.Fernkampf.push(['Bogen',10]);
  } return list; }
// Core rule: up to 2 close combat weapons (besides the free dagger) + up to 2 missile weapons (a brace of pistols = 1).
export function eqWeaponLimit(m){ const def=unitDef(m.uid_def); const list=def?eqListFor(def):null; if(!list) return {cc:0,missile:0};
  let cc=0,missile=0;
  (list.Nahkampf||[]).forEach(([nm])=>{ const q=Number(m.eq[nm])||0; if(!q) return; cc += (nm.indexOf('1. gratis')>=0)?Math.max(0,q-1):q; });
  (list.Fernkampf||[]).forEach(([nm])=>{ const q=Number(m.eq[nm])||0; if(!q) return; missile += (BRACE_PLURAL[nm]&&q>=2)?1:q; });
  return {cc,missile}; }
export function addUnit(id){
  const def=unitDef(id); const mx=unitMax(def);
  if(mx!==null && modelsOf(id)>=mx) return;
  S.models.push({uid:uid++, uid_def:id, name:def.name, exp:def.exp, qty:def.t==='hen'?1:1, eq:{}, rare:{}, mut:[], adv:{}, skills:[], inj:[], spells:[]});
  if(typeof ensureFreeDagger==='function') ensureFreeDagger(S.models[S.models.length-1]);
  render();
}
export function removeUnit(u){ S.models=S.models.filter(m=>m.uid!==u); render(); }

/* ===================== COST ===================== */
// Nuln-Paarpreise lt. NC-Liste
export function eqCost(m){
  const def=unitDef(m.uid_def); if(!def.eq) return 0;
  let c=0; const list=eqListFor(def); const h=HR();
  for(const cat in list) for(const [nm,pr] of list[cat]){
    const qty=Number(m.eq[nm])||0; if(!qty) continue;
    const price=adjPrice(nm,pr);
    if(nm.startsWith("Dolch")){ if(h.freeDagger) c+=0; else c+=Math.max(0,qty-1)*price; } // erster Dolch gratis (Hausregel: alle gratis)
    else if(S.wb==="gunnery"&&GSN_BRACE[nm]&&qty>=2){ const pairs=Math.floor(qty/2); c+=pairs*adjPrice(nm,GSN_BRACE[nm])+(qty%2)*price; }
    else c+=qty*price;
  }
  return c;
}
export function mutKindFor(m){ const def=unitDef(m.uid_def); if(def.mut) return def.mut; if((m.skills||[]).some(sk=>/^mutant\b/i.test(String(sk)))) return 'chaos'; return null; }
export function mutCost(m){
  const def=unitDef(m.uid_def); const kind=mutKindFor(m);
  if(!kind || !m.mut || !m.mut.length) return 0;
  const set=MUTSETS[kind]||MUTATIONS;
  // cheapest config for player: most expensive at single price, rest doubled
  const prices=m.mut.map(nm=>{const e=set.find(x=>x[0]===nm); return e?e[1]:0;}).sort((a,b)=>b-a);
  let c=prices[0]||0; for(let i=1;i<prices.length;i++) c+=prices[i]*2;
  return c;
}
export function heirloomDiscount(m){ if(S.wb!=='kislev') return 0; const def=unitDef(m.uid_def); if(!def||def.id!=='capt') return 0; const nm=m.heirloom; if(!nm||!(m.eq&&m.eq[nm]>0)) return 0; const L=eqListFor(def); for(const c in L){ const it=(L[c]||[]).find(x=>x[0]===nm); if(it) return Math.floor(it[1]/2); } return 0; }
export function setHeirloom(u,v){ const m=S.models.find(x=>x.uid===u); m.heirloom=v||null; render(); }
export function unitBaseCost(def){ let c=def.cost;
  if(typeof activeDistrictEffects==='function'){ for(const eff of activeDistrictEffects()){ if(eff.kind==='unitCost' && eff.map && eff.map[def.id]!=null) c=eff.map[def.id]; } }
  return c; }
/* Gratis-Dolch: Jede Einheit erhält automatisch den ersten Dolch gratis, sofern sie
   ihn laut Ausrüstungsliste überhaupt führen darf. Einheiten ohne Dolch in der Liste
   (z. B. Flagellants, Tiere, waffenlose Kreaturen) bekommen laut RAW KEINEN. */
export function daggerNameFor(def){ if(!def||!def.eq) return null;
  const list=eqListFor(def); if(!list) return null;
  for(const cat in list) for(const it of list[cat]){ if(/^Dolch/i.test(it[0])) return it[0]; }
  return null; }
export function ensureFreeDagger(m){ const def=unitDef(m.uid_def); const nm=daggerNameFor(def);
  if(!nm) return false;                       // darf keinen Dolch führen -> keiner
  if(m._noDagger) return false;               // vom Spieler entfernt
  if(!m.eq) m.eq={};
  if(!m.eq[nm]) { m.eq[nm]=1; return true; }
  return false; }
export function applyFreeDaggers(){ let ch=false; (S.models||[]).forEach(function(m){ if(ensureFreeDagger(m)) ch=true; }); return ch; }
export function modelUnitCost(m){ // cost for ONE model of this entry
  const def=unitDef(m.uid_def);
  return unitBaseCost(def) + eqCost(m) + mutCost(m) + rareCost(m) - heirloomDiscount(m);
}
/* --- Rare Items / Trading Post (Katalog-gefiltert) --- */
export function _stripParen(s){ return String(s).replace(/\s*\([^)]*\)\s*/g,' ').trim(); }
export function rareCost(m){ const r=m.rare||{}; let c=0; for(const de in r){ c+=(Number(r[de].q)||0)*(Number(r[de].paid)||0); } return c; }
export function catalogDefaultPaid(item){ if(!item) return 0; let v;
  if(typeof item.cost==='number') v=item.cost;
  else { const s=String(item.cost); if(/×|x\s*Preis|Preis/i.test(s)) v=0; else { const mt=s.match(/\d+/); v=mt?Number(mt[0]):0; } }
  if(v>0 && typeof itemHalfActive==='function' && itemHalfActive(item.en)) v=Math.floor(v*0.5);
  return v; }
/* --- Waffen-Upgrades (Dark Elf Blade, Dark Venom, Gromril/Ithilmar/Obsidian) --- */


export function isUpgrade(de){ return !!UPGRADES[de]; }
export function eqWeaponsOf(m){ const def=unitDef(m.uid_def); if(!def||!def.eq) return []; const list=eqListFor(def); const out=[];
  if(list.Nahkampf) for(const [nm,pr] of list.Nahkampf){ if((Number(m.eq[nm])||0)>0) out.push({nm,price:pr,fam:itemFamily(nm)}); }
  return out; }
export function upgradeTargets(m,de){ const u=UPGRADES[de]; if(!u) return []; return eqWeaponsOf(m).filter(w=>u.fams.includes(w.fam)); }
export function upgradePaid(m,de,targetNm){ const u=UPGRADES[de]; if(!u) return 0;
  let paid;
  if(u.mult){ const w=eqWeaponsOf(m).find(x=>x.nm===targetNm); let mu=u.mult; if(de==="Gromril-Waffe"&&(S.wb==="dwarftreasure"||S.wb==="dwarfrangers")) mu=3; paid=w?mu*w.price:0; }
  else paid=u.base;
  if(paid>0 && typeof itemHalfActive==='function' && itemHalfActive(de)) paid=Math.floor(paid*0.5);
  return paid; }
// Flat upgrades (mult 0, e.g. Dark Elf Blade / Dark Venom) are shown INLINE next to the weapon,
// not in the Rare/Trading-Post section. inlineUpgradeActive = flat + warband matches current warband.
export function inlineUpgradeActive(de){ const u=UPGRADES[de]; return !!(u && !u.mult && (!u.wb || u.wb.indexOf(S.wb)>=0)); }
export function weaponUpgradesFor(m,nm){ const def=unitDef(m.uid_def); if(!def) return [];
  const isHero=def.t==='hero'||m.promoted; const fam=itemFamily(nm); const out=[];
  for(const de in UPGRADES){ const u=UPGRADES[de];
    if(u.mult) continue;                              // material upgrades stay in the trading post
    if(u.heroesOnly && !isHero) continue;
    if(u.wb && u.wb.indexOf(S.wb)<0) continue;         // warband-specific (e.g. Dark Elf blade = Dark Elves)
    if(u.fams.indexOf(fam)<0) continue;               // only weapons this upgrade can modify
    out.push({de,u}); }
  return out; }
export function toggleWeaponUpgrade(uid,de,nm,on){ const m=S.models.find(x=>x.uid===uid); if(!m) return; m.rare=m.rare||{};
  if(on) m.rare[de]={q:1,on:nm,paid:(UPGRADES[de]&&UPGRADES[de].base)||0}; else delete m.rare[de];
  render(); }
export function rareEligibleItems(m){ const def=unitDef(m.uid_def); if(!def||!def.eq) return [];
  const list=eqListFor(def); const have=new Set(); const h=HR();
  if(list) for(const cat in list) for(const [nm] of list[cat]) have.add(_stripParen(nm).toLowerCase());
  const isHero=def.t==='hero'||m.promoted;
  return CATALOG.filter(it=>{
    if(def.noArmour && it.cat==='armour') return false;
    if(def.noMissile && (it.cat==='missile'||it.cat==='bp')) return false;
    if(def.noHeavy && itemFamily(it.de)==='heavyarmour') return false;
    if(isUpgrade(it.de)){ const u=UPGRADES[it.de];
      if(!u.mult && inlineUpgradeActive(it.de)){ if((!u.heroesOnly||isHero) && upgradeTargets(m,it.de).length>0) return false; } // shown inline next to the weapon
      if(u.heroesOnly && !isHero) return false; return upgradeTargets(m,it.de).length>0; }
    if(it.cat==='misc' && !isHero && !h.miscHench && !h.freeMarket) return false;   // Misc nur Helden (Hausregel hebt auf)
    if(h.freeMarket) return true;                                                    // Hausregel: Freier Markt – Kategorieschranke ignorieren
    if(have.has(_stripParen(it.de).toLowerCase())) return false;        // bereits Startoption
    return catalogEligible(def,it).ok;
  }); }
export function modelTotalCost(m){
  const def=unitDef(m.uid_def);
  const q=def.t==='hen'?m.qty:1;
  return modelUnitCost(m)*q;
}
/* Startgold der Warband (House-Rule-überschreibbar) */
export function startGold(){ const h=HR();
  if(h && h.startGold!=='' && h.startGold!=null && !isNaN(Number(h.startGold))) return Number(h.startGold);
  const wb=WARBANDS[S.wb]; if(!wb) return 500;
  const sub=(S.subtype&&wb.subtypes)?wb.subtypes.find(x=>x.key===S.subtype):null;
  return (sub&&sub.gold!=null)?sub.gold:(wb.gold||500); }
/* EIN Gold-Wert: das aktuelle Gold der Warband. Intern liegt im Stash die
   "Kasse" (treasury); angezeigt wird überall treasury minus Ausgaben. Kauft man
   etwas, sinkt der Wert sofort - oben im Warband-Panel wie unten im Stash. */
export function goldTreasury(){ const g=(S.stash&&S.stash.gold); return (g==null||g==='')?startGold():(Number(g)||0); }
export function goldCurrent(){ return goldTreasury()-totalSpent(); }
export function goldAvailable(){ return goldTreasury(); }
export function setGoldCurrent(v){ S.stash=S.stash||{wyrd:0,gold:null,items:[]};
  S.stash.gold=Math.max(0,(Number(v)||0))+totalSpent(); render(); }
export function adjGoldCurrent(d){ setGoldCurrent(goldCurrent()+d); }
export function totalSpent(){ return S.models.reduce((s,m)=>s+modelTotalCost(m),0)+ (typeof hsHireTotal==='function'?hsHireTotal():0)+ (typeof dpHireTotal==='function'?dpHireTotal():0)+ (typeof hsEqTotal==='function'?hsEqTotal():0); }
export function totalModels(){ return S.models.reduce((s,m)=>{const d=unitDef(m.uid_def); if(d&&d.vehicle) return s; return s+(d&&d.t==='hen'?m.qty:1);},0); }
export function isHeroModel(m){ const def=unitDef(m.uid_def); return (def&&def.t==='hero')||!!m.promoted; }
export function totalHeroes(){ return S.models.filter(m=>isHeroModel(m)).length + ((S.hired||[]).filter(h=>HIREDSWORDS[h.key]&&HIREDSWORDS[h.key].slot).length); }
export function totalRating(){
  let r=0;
  S.models.forEach(m=>{
    const def=unitDef(m.uid_def); const q=def.t==='hen'?m.qty:1;
    const base=def.large?20:5;
    r+=(base+ (def.t==='hero'?Number(m.exp||0):Number(m.exp||0)) )*q;
  });
  r+= (typeof hsRatingTotal==='function'?hsRatingTotal():0);
  r+= (typeof dpRatingTotal==='function'?dpRatingTotal():0);
  return r;
}

/* ===================== RENDER ===================== */
export function render(){
  if(typeof hideItip==='function'){ itipPinned=false; hideItip(true); }
  
  renderAddMenu(); renderRoster(); renderSidebar(); renderStash(); renderHouse();
}
export function statTable(p){
  const k=["M","WS","BS","S","T","W","I","A","Ld"];
  return `<table class="stats"><tr>${k.map(x=>`<th>${x}</th>`).join('')}</tr>
    <tr>${k.map(x=>`<td>${p[x]}</td>`).join('')}</tr></table>`;
}
export function renderAddMenu(){
  const wb=WARBANDS[S.wb]; const el=document.getElementById('addmenu');
  let html='';
  [['hero','Helden'],['hen','Gefolge (Henchmen)'],['vehicle','Fahrzeug (zählt als Ausrüstung)']].forEach(([t,label])=>{
    const us=wb.units.filter(u=> t==='vehicle' ? !!u.vehicle : (u.t===t && !u.vehicle)); if(!us.length) return;
    html+=`<div class="addgroup"><h2>${label}</h2>`;
    us.forEach(u=>{
      const cnt=modelsOf(u.id); const umx=unitMax(u);
      const atMax=(umx!==null && cnt>=umx) || (t==='hero' && totalHeroes()>=(Number(HR().heroes)||6));
      const lim=umx===null?'any':(u.req?`=${umx}`:`0–${umx}`);
      html+=`<div class="addrow">
        <span class="nm">${u.name}${cnt?` <span class="rec">×${cnt}</span>`:''}</span>
        <span class="lim" title="${umx===null?'any number':(u.req?('exactly '+umx):('0 to '+umx))}">${lim}</span>
        <span class="cost">${u.cost} gc</span>
        <span class="xp">${u.exp?`${u.exp} xp`:''}</span>
        <button class="tiny blood" ${atMax?'disabled':''} onclick="addUnit('${u.id}')">+ recruit</button>
        <div class="desc">${u.vehicle?vehRulesBlock(u):(u.sp||'')}</div>
      </div>`;
    });
    html+='</div>';
  });
  el.innerHTML=html;
}
/* ===================== ITEM-EIGENSCHAFTEN (Tooltip) ===================== */

export function itemInfo(nm){ const s=String(nm); for(const [re,info] of ITEMINFO){ if(re.test(s)) return info; } return null; }
/* ===================== KATALOG-ELIGIBILITY (Tragbarkeits-Regel) =====================
   Regel (Design-Notiz / Nutzerwunsch): Eine Einheit darf einen Katalog-Gegenstand nur führen,
   wenn die zugehörige Waffen-/Rüstungs-KATEGORIE in ihrer Startausrüstung vorkommt.
   'misc' (Sonstige Ausrüstung) ist für Helden frei (nur Raritäts-/Warband-Schranke, keine Kategorie).
   Hinweis: die Warband-Beschränkung (item.wb) ist ein separat gespeichertes Feld und wird hier
   bewusst NICHT mitgeprüft – diese Funktion bildet ausschließlich die Kategorie-Regel ab.
   itemFamily() klassifiziert einen Item-Namen in eine Kategorie-Familie (spezifisch vor generisch). */

export function itemFamily(name){ const s=String(name); for(const [re,f] of _FAM){ if(re.test(s)) return f; } return null; }
export function unitFamilies(def){ const set=new Set(); const list=(def&&def.eq)?eqListFor(def):null;
  if(list) for(const cat in list) for(const [nm] of list[cat]){ const f=itemFamily(nm); if(f) set.add(f); }
  if(def&&def.gear) def.gear.forEach(nm=>{ const f=itemFamily(nm); if(f) set.add(f); });
  return set; }

export function catalogEligible(def,item){
  if(!item) return {ok:false,reason:'unbekannter Gegenstand'};
  if(item.cat==='misc') return {ok:true,reason:'Sonstige Ausrüstung – für Helden frei kaufbar (keine Kategorie-Schranke)'};
  const fam=itemFamily(item.de); const have=unitFamilies(def);
  if(fam==='upgrade'){ const ok=_CCFAM.some(f=>have.has(f));
    return ok?{ok:true,reason:'Aufwertung einer vorhandenen Nahkampfwaffe'}:{ok:false,reason:'keine aufwertbare Nahkampfwaffe in der Startliste'}; }
  if(fam==='gromrilarmour'||fam==='ithilmararmour'||fam==='chaosarmour'){ const ok=have.has('lightarmour')||have.has('heavyarmour');
    return ok?{ok:true,reason:'Spezialrüstung – Einheit darf Körperrüstung tragen'}:{ok:false,reason:'Einheit darf keine Körperrüstung tragen'}; }
  if(!fam){ const list=(def&&def.eq)?eqListFor(def):null; let found=false;
    if(list) for(const cat in list) for(const [nm] of list[cat]){ if(nm===item.de||nm.includes(item.de)||item.de.includes(nm)) found=true; }
    return found?{ok:true,reason:'bereits Bestandteil der Startliste'}:{ok:false,reason:'einzigartige Kategorie – nicht in der Startausrüstung dieser Einheit'}; }
  return have.has(fam)?{ok:true,reason:'Kategorie in der Startausrüstung vorhanden'}:{ok:false,reason:'Kategorie nicht in der Startausrüstung'};
}
if(typeof window!=='undefined'){ window.catalogEligible=catalogEligible; window.itemFamily=itemFamily; window.unitFamilies=unitFamilies; }
/* ===================== FÄHIGKEITEN / SCHLAGWORTE (Tooltip) ===================== */

export function abilityInfo(nm){ const s=String(nm); for(const [re,info] of ABILITYINFO){ if(info.name===s) return info; } for(const [re,info] of ABILITYINFO){ if(re.test(s)) return info; } return null; }

export function catLabel(cat){ const M={Nahkampf:'Melee',Fernkampf:'Missile',Rüstung:'Armour',Besonderes:'Special'};
  if(M[cat]) return M[cat];
  return cat.replace('Besonderes','Special').replace('nur Heldinnen','Heroines only').replace('nur Helden','Heroes only'); }
export function eqSection(m){
  const def=unitDef(m.uid_def);
  const mutKind=mutKindFor(m);
  if(!def.eq && !mutKind){
    if(def.gear&&def.gear.length) return `<div class="note">This unit buys no equipment. Fixed wargear: ${def.gear.join(', ')}.</div>`;
    return `<div class="note">This unit cannot buy equipment.</div>`;
  }
  let html='';
  if(def.eq){
    const list=eqListFor(def);
    html+=`<details class="eq" open><summary>Ausrüstung wählen (Waffen mit Anzahl, z. B. zwei Schwerter)</summary>`;
    if(S.wb==='kislev'&&def.id==='capt'){
      const owned=Object.keys(m.eq||{}).filter(k=>m.eq[k]>0);
      html+=`<div class="note no-print">Erbstück (Gründung: 1 Item zum halben Preis): <select onchange="setHeirloom(${m.uid},this.value)"><option value="">—</option>${owned.map(nm=>`<option value="${nm}"${m.heirloom===nm?' selected':''}>${nm}</option>`).join('')}</select>${m.heirloom&&heirloomDiscount(m)>0?` −${heirloomDiscount(m)} gc (Ersatz später: 150%)`:''}</div>`;
    }
    const _eqgroups=[];
    for(const cat in list){
      if(cat==='Besonderes'){
        const _mt=list[cat].filter(([nm])=>MOUNTS[nm]); const _ot=list[cat].filter(([nm])=>!MOUNTS[nm]);
        if(_ot.length)_eqgroups.push({cat,label:catLabel(cat),items:_ot});
        if(_mt.length)_eqgroups.push({cat:'Mounts',label:'Mounts',items:_mt});
      } else _eqgroups.push({cat,label:catLabel(cat),items:list[cat]});
    }
    for(const _g of _eqgroups){
      const cat=_g.cat;
      const isWeapon = (cat==='Nahkampf' || cat==='Fernkampf');
      html+=`<div class="eqcat">${_g.label}</div><div class="eqgrid">`;
      _g.items.forEach(([nm,pr])=>{
        if(BRACE_HIDE[nm]) return; // a brace is selected by buying a 2nd single pistol (qty 2)
        const armourBlocked = def.noArmour && cat==='Rüstung';
        const missileBlocked = def.noMissile && cat==='Fernkampf';
        const heavyBlocked = def.noHeavy && nm==='Schwere Rüstung';
        const heroBlock = (def.t!=='hero') && (cat.includes('Heldinnen'));
        const blocked = armourBlocked||missileBlocked||heavyBlocked||heroBlock;
        const free = nm.startsWith('Dolch');
        const esc = nm.replace(/'/g,"\\'");
        const qty = Number(m.eq[nm])||0;
        const ap = adjPrice(nm,pr);
        const prLabel = free
          ? (HR().freeDagger ? 'free' : (qty>=1 ? '+'+ap+' gc' : '1st free'))
          : ap+' gc';
        const ii = itemInfo(nm) ? `<span class="iinfo no-print" tabindex="0" onmouseenter="showItip(this,'${esc}')" onmouseleave="hideItip()" onfocus="showItip(this,'${esc}')" onblur="hideItip()" onclick="toggleItip(event,this,'${esc}')">ⓘ</span>` : '';
        if(isWeapon && !blocked){
          const _ups = qty>0 ? weaponUpgradesFor(m,nm) : [];
          const _upHtml = _ups.length ? `<span class="wupg no-print">`+_ups.map(({de,u})=>{ const _on=!!(m.rare&&m.rare[de]&&m.rare[de].on===nm); const _escd=de.replace(/'/g,"\\'");
              const _iiu=itemInfo(de)?`<span class="iinfo" tabindex="0" onmouseenter="showItip(this,'${_escd}')" onmouseleave="hideItip()" onfocus="showItip(this,'${_escd}')" onblur="hideItip()" onclick="toggleItip(event,this,'${_escd}')">ⓘ</span>`:'';
              return `<label class="wupgchk"><input type="checkbox" ${_on?'checked':''} onchange="toggleWeaponUpgrade(${m.uid},'${_escd}','${esc}',this.checked)"> ⤴ ${enItem(de)}${u.base?` <span class="upr">+${u.base} gc</span>`:''}</label>${_iiu}`;
            }).join('')+`</span>` : '';
          html+=`<div class="eqitem qty${_ups.length?' wupg-host':''}">
            <span class="eqnm">${enItem(nm)}${BRACE_PLURAL[nm]?` <span class="brchint">2 = Brace</span>`:''}${ii}</span>
            <span class="qtyctl">
              <button class="qbtn no-print" ${qty<=0?'disabled':''} onclick="setEqQty(${m.uid},'${esc}',${qty-1})">−</button>
              <span class="qn">${qty}</span>
              <button class="qbtn no-print" ${(BRACE_PLURAL[nm]&&qty>=2)?'disabled':''} onclick="setEqQty(${m.uid},'${esc}',${qty+1})">+</button>
            </span>
            <span class="pr">${prLabel}</span>${_upHtml}</div>`;
        } else {
          const checked = qty?'checked':'';
          html+=`<label class="eqitem ${blocked?'muted':''}">
            <input type="checkbox" ${checked} ${blocked?'disabled':''}
              onchange="toggleEq(${m.uid},'${esc}',this.checked)">
            <span>${enItem(nm)}</span>${ii}<span class="pr">${prLabel}</span></label>`;
        }
      });
      html+=`</div>`;
    }
    html+=`</details>`;
    // printable summary of chosen equipment (a 2nd pistol shows as a Brace)
    const parts=eqDisplayParts(m);
    html+=`<div class="eqchosen"><b>Equipment:</b> ${parts.length?parts.join(', '):'—'}</div>`;
  }
  if(mutKind){
    const set=MUTSETS[mutKind]||MUTATIONS;
    const label=MUTLABEL[mutKind]||"Mutations";
    const viaSkill=!def.mut;
    html+=`<details class="eq" open><summary>${label} ${def.mutReq?'(at least 1 required)':(viaSkill?'(gained via skill)':'')}</summary>
      <div class="note">First ${mutKind==='nurgle'?'blessing':'mutation'} at normal price, each further one costs double (cheapest calculation).${viaSkill?' Available because this Hero acquired the “Mutant” skill.':''}</div>
      <div class="eqgrid">`;
    set.forEach(([nm,pr])=>{
      const checked=m.mut.includes(nm)?'checked':'';
      html+=`<label class="eqitem"><input type="checkbox" ${checked}
        onchange="toggleMut(${m.uid},'${nm.replace(/'/g,"\\'")}',this.checked)"><span>${mutEN(nm)}</span><span class="pr">${pr} gc</span></label>`;
    });
    html+=`</div></details>`;
  }
  // ---- Rare Items / Trading Post (only categories the unit may carry) ----
  if(def.eq){
    const elig=rareEligibleItems(m);
    const CATLBL={cc:'Melee',missile:'Missile',bp:'Blackpowder',armour:'Armour',misc:'Misc / Trading Post'};
    let opts='';
    ['cc','missile','bp','armour','misc'].forEach(c=>{ const grp=elig.filter(it=>it.cat===c); if(!grp.length) return;
      opts+=`<optgroup label="${CATLBL[c]}">`+grp.map(it=>{ const up=UPGRADES[it.de]; const half=(!up && typeof itemHalfActive==='function' && itemHalfActive(it.en)); const cost=up?up.note:(typeof it.cost==='number'?(half?Math.floor(it.cost*0.5):it.cost)+' gc':it.cost); const rar=(it.rare&&it.rare!=='Common'&&it.rare!=='—')?' · '+it.rare:''; const tag=(up?' ⤴ Upgrade':'')+(half?' · ½ campaign':'');
        return `<option value="${String(it.de).replace(/"/g,'&quot;')}">${it.en}${tag} — ${cost}${rar}</option>`; }).join('')+`</optgroup>`; });
    html+=`<details class="eq"><summary>Rare Items / Trading Post (Kategorie-gefiltert)</summary>`;
    html+=`<div class="note">Angeboten werden nur Gegenstände, deren <b>Kategorie</b> die Einheit laut Startausrüstung führen darf (Sonstiges nur für Helden). Warband-/Raritäts-Beschränkung bitte selbst beachten; Preis ggf. anpassen (Würfelpreise wie „25+1D6").</div>`;
    html+=`<div class="eqitem"><select class="no-print" style="flex:1;min-width:0" onchange="addRare(${m.uid},this.value);this.selectedIndex=0;"><option value="">+ Gegenstand hinzufügen …</option>${opts}</select></div>`;
    const r=m.rare||{}; const keys=Object.keys(r); const vkeys=keys.filter(de=>!inlineUpgradeActive(de));
    if(vkeys.length){
      html+=`<div class="eqgrid">`;
      keys.forEach(de=>{ if(inlineUpgradeActive(de)) return; const e=r[de]; const it=CATALOG.find(x=>x.de===de); const _rr=(HR().showRarity&&it&&it.rare&&it.rare!=='Common'&&it.rare!=='—')?` <span class="note">(${it.rare})</span>`:''; const nm=(it?it.en:de)+_rr; const esc=de.replace(/'/g,"\\'"); const q=Number(e.q)||1;
        const ii=itemInfo(de)?`<span class="iinfo no-print" tabindex="0" onmouseenter="showItip(this,'${esc}')" onmouseleave="hideItip()" onfocus="showItip(this,'${esc}')" onblur="hideItip()" onclick="toggleItip(event,this,'${esc}')">ⓘ</span>`:'';
        if(isUpgrade(de)){
          const tg=upgradeTargets(m,de); const cur=e.on||(tg[0]&&tg[0].nm)||'';
          const sel=tg.map(w=>`<option value="${w.nm.replace(/"/g,'&quot;')}" ${w.nm===cur?'selected':''}>${enItem(w.nm)}</option>`).join('');
          html+=`<div class="eqitem qty rrow"><span class="eqnm">${nm}${ii} → <select class="no-print" style="max-width:140px" onchange="setRareTarget(${m.uid},'${esc}',this.value)">${sel}</select><span class="stashq-print"> auf ${cur?enItem(cur):'—'}</span></span>
            <span class="pr"><input type="number" min="0" value="${Number(e.paid)||0}" class="no-print" style="width:52px" onchange="setRarePaid(${m.uid},'${esc}',this.value)"> gc<span class="stashq-print">${Number(e.paid)||0} gc</span></span>
            <button class="advx no-print" title="entfernen" onclick="removeRare(${m.uid},'${esc}')">✕</button></div>`;
        } else {
          html+=`<div class="eqitem qty rrow"><span class="eqnm">${nm}${ii}</span>
            <span class="qtyctl"><button class="qbtn no-print" onclick="setRareQty(${m.uid},'${esc}',${q-1})">−</button><span class="qn">${q}</span><button class="qbtn no-print" onclick="setRareQty(${m.uid},'${esc}',${q+1})">+</button></span>
            <span class="pr"><input type="number" min="0" value="${Number(e.paid)||0}" class="no-print" style="width:52px" onchange="setRarePaid(${m.uid},'${esc}',this.value)"> gc<span class="stashq-print">${Number(e.paid)||0} gc</span></span>
            <button class="advx no-print" title="entfernen" onclick="removeRare(${m.uid},'${esc}')">✕</button></div>`;
        }
      });
      html+=`</div>`;
      const parts=vkeys.map(de=>{ const it=CATALOG.find(x=>x.de===de); const q=Number(r[de].q)||1; const _rr=(HR().showRarity&&it&&it.rare&&it.rare!=='Common'&&it.rare!=='—')?` (${it.rare})`:''; const nm=(it?it.en:de)+_rr;
        if(isUpgrade(de)) return `${nm}${r[de].on?` (auf ${enItem(r[de].on)})`:''}`;
        return q>1?`${q}× ${nm}`:nm; });
      html+=`<div class="eqchosen"><b>Rare:</b> ${parts.join(', ')}</div>`;
    }
    html+=`</details>`;
  }
  return html;
}
/* ===================== ERFAHRUNG / AUFSTIEG ===================== */
export function incExp(u,d){ const m=S.models.find(x=>x.uid===u); m.exp=Math.max(0,(Number(m.exp)||0)+d); render(); }
export function setExpJump(u,v){ const m=S.models.find(x=>x.uid===u); m.exp=Math.max(0,Number(v)||0); render(); }
export function leaderRuleText(){ return 'Friendly models within 6 inches may use the leader\u2019s (usually better) Leadership value for their Leadership tests.'; }
export function abilitySection(def, m){
  let sp=def.sp||'';
  if(typeof isLeaderModel==='function' && m && isHeroModel(m)){
    if(!isLeaderModel(m)) sp=sp.replace(/(<b>\s*)?Leader:(<\/b>)?[^.]*\.\s*/i,'');
    else if(!/Leader:/i.test(sp)) sp='<b>Leader:</b> '+leaderRuleText()+' '+sp;
  }
  const acquired=(m&&m.skills)||[]; const muts=(m&&m.mut)||[];
  const scan = sp+' '+muts.join(' ');   // innate special rules + mutations (acquired skills are shown separately)
  let found=[]; const seen=new Set();
  for(const [re,info] of ABILITYINFO){ if(re.test(scan) && !seen.has(info.name)){ seen.add(info.name); found.push(info); } }
  if(found.some(f=>f.name==='Fearless')) found=found.filter(f=>f.name!=='Fear'&&f.name!=='Terror');
  // which special skill list(s) this unit can draw from
  const stdCats=['combat','shooting','academic','strength','speed']; const sets=[]; const setseen=new Set();
  (def.sk||[]).forEach(c=>{ if(!stdCats.includes(c)&&SKILLSETS[c]&&!setseen.has(c)){ setseen.add(c); sets.push(SKILLSETS[c]); } });
  const ex=WBEXTRA[S.wb]; if(ex&&ex.skills&&SKILLSETS[ex.skills]&&!setseen.has(ex.skills)){ setseen.add(ex.skills); sets.push(SKILLSETS[ex.skills]); }
  const _mlore=m?casterLore(m):null; const _msp=(m&&m.spells)||[];
  if(!sp && !found.length && !sets.length && !acquired.length && !(_mlore&&_msp.length)) return '';
  const chip=(label,lookup)=>{ const esc=String(lookup).replace(/'/g,"\\'"); return `<span class="kwchip" tabindex="0" onmouseenter="showItip(this,'${esc}')" onmouseleave="hideItip()" onfocus="showItip(this,'${esc}')" onblur="hideItip()" onclick="toggleItip(event,this,'${esc}')">${label} \u24d8</span>`; };
  let html=`<div class="abil"><div class="abil-h">Abilities &amp; Special Rules</div>`;
  if(sp) html+=`<div class="abil-sp">${ruleSplitBold(sp).join('<br>')}</div>`;
  const _isHero=(def&&def.t==='hero')||(m&&m.promoted);
  if(sets.length && _isHero) html+=`<div class="abil-sp" style="margin-top:4px"><b>Special skill list${sets.length>1?'s':''}:</b> ${sets.map(x=>x.name).join(', ')}.</div>`;
  if(found.length){   const _mk=(typeof markRulesFor==='function')?markRulesFor(m):[];
  if(_mk.length) html+=`<div class="abil-sk"><b>Mark rules:</b> `+_mk.map(function(x){
    const nm=x[0], t=String(x[1]).replace(/"/g,'&quot;').replace(/'/g,"\\'");
    return '<span class="kwchip" tabindex="0" onmouseenter="showItipHTML(this,\'<b>'+nm+'</b><br>'+t+'\',false,340)" onmouseleave="hideItip()">'+nm+' \u24d8</span>'; }).join('')+`</div>`;
html+=`<div class="abil-kw no-print">`+found.map(info=>chip(info.name,info.name)).join('')+`</div>`; }
  if(_mlore && _msp.length){
    const txt=_msp.map(s=>{const d=spellEffDiff(s);return spellLabel(s.name)+(d!=null?` (${d})`:'');}).join(', ');
    html+=`<div class="abil-sp print-only" style="margin-top:4px"><b>Spells (${SPELLS[_mlore].name}):</b> ${txt}.</div>`;
    html+=`<div class="abil-kw no-print"><span class="kwlbl">Spells (${SPELLS[_mlore].name}):</span>`+_msp.map(s=>{const d=spellEffDiff(s);const lbl=spellLabel(s.name);return chip(lbl+(d!=null?` (${d})`:''),lbl);}).join('')+`</div>`;
  }
  if(acquired.length){
    html+=`<div class="abil-sp print-only" style="margin-top:4px"><b>Skills:</b> ${acquired.join(', ')}.</div>`;
    html+=`<div class="abil-kw no-print"><span class="kwlbl">Skills:</span>`+acquired.map(sk=>chip(sk,sk)).join('')+`</div>`;
  }
  return html+`</div>`;
}
export function xpThresholds(hero){ return hero
  ? [2,4,6,8,11,14,17,20,24,28,32,36,41,46,51,57,63,69,76,83,90]
  : [2,5,9,14]; }
export function xpBar(m){
  const def=unitDef(m.uid_def);
  if(def.noxp) return `<div class="xpinfo">Gains no experience.</div>`;
  const hero=isHeroModel(m); const th=xpThresholds(hero); const xp=Number(m.exp)||0; const start=Number(def.exp)||0;
  const earned=th.filter(t=>t>start && t<=xp).length;
  const next=th.find(t=>t>xp);
  const pips=th.map(t=>{
    const cls = t<=start ? 'base' : (t<=xp ? 'on' : (t===next?'next':''));
    return `<span class="xppip ${cls}" title="Advance at ${t} exp – click to set" onclick="setExpJump(${m.uid},${t})">${t}</span>`;
  }).join('');
  const due = xp>start && th.includes(xp);
  const info = next!=null
    ? `Advances earned: <b>${earned}</b> · next at <b>${next}</b> Exp (${next-xp} to go)`
    : `Advances earned: <b>${earned}</b> · maximum experience reached`;
  return `<div class="xpctl"><button class="qbtn" onclick="incExp(${m.uid},-1)">−</button><span class="xpnow">EXP ${xp}</span><button class="qbtn" onclick="incExp(${m.uid},1)">+</button>`
    +`${due?'<span class="xpdue">Advance due!</span>':''}</div>`
    +`<div class="xppips">${pips}</div><div class="xpinfo">${info} <span class="xpnote">(${hero?'Hero':'Henchman'} scale · start ${start} exp)</span></div>`;
}
/* ===================== AUFSTIEG / WERTE VERBESSERN ===================== */
export function injMods(m){ const o={}; (m.inj||[]).forEach(j=>{ if(j.mod) for(const k in j.mod) o[k]=(o[k]||0)+j.mod[k]; }); return o; }
export function netMod(m){ const adv=m.adv||{}; const inj=injMods(m); const o={};
  ["M","WS","BS","S","T","W","I","A","Ld"].forEach(k=>{ const v=(Number(adv[k])||0)+(Number(inj[k])||0); if(v) o[k]=v; }); return o; }
export function effProfile(m){
  const def=unitDef(m.uid_def); if(!def.profile) return null;
  const mod=netMod(m); const sub=(def.profSub&&def.profSub[S.subtype])||{}; const out={};
  for(const k in def.profile){ const base=def.profile[k]; const b=(Number(mod[k])||0)+(Number(sub[k])||0);
    out[k] = b ? (typeof base==='number'? base+b : base+(b>0?'+':'')+b) : base; }
  return out;
}
// combined display modifier (injuries/advances + subtype profSub) for boost/hurt colouring
export function dispMod(m){ const def=unitDef(m.uid_def); const mod=netMod(m); const sub=(def&&def.profSub&&def.profSub[S.subtype])||{}; const o={}; ["M","WS","BS","S","T","W","I","A","Ld"].forEach(k=>o[k]=(Number(mod[k])||0)+(Number(sub[k])||0)); return o; }
// Attacks display: append a constant bite bonus (e.g. Saurus "1+1"); base stays numeric so advances raise the first number (1+1 -> 2+1).
export function aDisp(m,p){ const def=unitDef(m.uid_def); const a=p.A; return (def&&def.bite)?(a+'+'+def.bite):a; }
export function statTableM(m){
  const p=effProfile(m); if(!p) return '';
  const mod=dispMod(m); const k=["M","WS","BS","S","T","W","I","A","Ld"];
  const mi=maxInfo(m);
  const maxRow = mi ? `<tr class="maxr" title="Racial maximum${mi.label?' ('+mi.label+')':''}"><td class="rh">max</td>${k.map(x=>`<td>${(typeof mi.prof[x]==='number')?mi.prof[x]:'—'}</td>`).join('')}</tr>` : '';
  return `<table class="stats"><tr><th class="rh"></th>${k.map(x=>`<th>${x}</th>`).join('')}</tr>
    <tr><td class="rh"></td>${k.map(x=>`<td class="${mod[x]>0?'boost':(mod[x]<0?'hurt':'')}">${x==='A'?aDisp(m,p):p[x]}</td>`).join('')}</tr>
    ${maxRow}</table>`;
}
/* --- Rassenmaxima (hart erzwungen) --- */




export function maxInfo(m){ const def=unitDef(m.uid_def); if(!def) return null;
  if(m.skills&&m.skills.some(s=>/chosen of chaos/i.test(s))) return {prof:MAXPROF.woc,label:'Chaoskrieger'};
  const key=S.wb+'/'+def.id; let r;
  if(Object.prototype.hasOwnProperty.call(UNITRACE,key)) r=UNITRACE[key]; else r=WBRACE[S.wb]||null;
  return r?{prof:MAXPROF[r],label:RACELABEL[r]||r,key:r}:null; }
export function canAdv(m,stat){ const def=unitDef(m.uid_def); const base=def.profile?def.profile[stat]:undefined;
  if(typeof base!=='number') return true;
  if(!isHeroModel(m) && (Number((m.adv||{})[stat])||0)>=1) return false;
  const mi=maxInfo(m); if(mi && typeof mi.prof[stat]==='number' && base+(Number((m.adv||{})[stat])||0)>=mi.prof[stat]) return false;
  return true; }
export function addAdv(u,stat){ const m=S.models.find(x=>x.uid===u); if(!canAdv(m,stat)) return; m.adv=m.adv||{}; m.adv[stat]=(m.adv[stat]||0)+1; render(); }
export function remAdv(u,stat){ const m=S.models.find(x=>x.uid===u); if(m.adv&&m.adv[stat]){ m.adv[stat]--; if(m.adv[stat]<=0) delete m.adv[stat]; } render(); }
export function addSkill(u){ const m=S.models.find(x=>x.uid===u); const el=document.getElementById('sk-'+u); const v=((el&&el.value)||'').trim(); if(!v) return; m.skills=m.skills||[]; m.skills.push(v); render(); }
export function remSkill(u,i){ const m=S.models.find(x=>x.uid===u); if(m.skills){ m.skills.splice(i,1); render(); } }
export function setAdvOpen(u,v){ const m=S.models.find(x=>x.uid===u); if(m) m._advOpen=v; }
/* ----- Aufstiegs-Fertigkeiten (Auswahl aus verfügbaren Listen) ----- */

export function skillListsFor(def){ const out=[];
  let cats = (def.skSub && def.skSub[S.subtype]) || def.sk || ['combat','shooting','academic','strength','speed'];
  if(HR().allSkills) cats=['combat','shooting','academic','strength','speed'];
  cats.forEach(c=>{ if(SKILLLISTS[c]) out.push(['['+SKILLLISTS[c].name+']',SKILLLISTS[c].skills]); else if(SKILLSETS[c]) out.push(['['+SKILLSETS[c].name+']',SKILLSETS[c].skills]); });
  const ex=WBEXTRA[S.wb]; if(ex&&ex.skills&&SKILLSETS[ex.skills]&&!def.noWbSkills) out.push(['['+SKILLSETS[ex.skills].name+']',SKILLSETS[ex.skills].skills]);
  return out; }
export function skillOptions(def){ return skillListsFor(def).map(([lab,sk])=>sk.map(s=>`<option value="${s[0].replace(/"/g,'&quot;')}">${lab} ${s[1].slice(0,60)}</option>`).join('')).join(''); }
export function skillOptionsFor(lists){ return lists.map(([lab,sk])=>sk.map(s=>`<option value="${s[0].replace(/"/g,'&quot;')}">${lab} ${s[1].slice(0,60)}</option>`).join('')).join(''); }

export function availHeroCats(){
  const wb=WARBANDS[S.wb]; const set=new Set();
  (wb.units||[]).forEach(u=>{ if(u.t==='hero'){ const c=(u.skSub&&u.skSub[S.subtype])||u.sk||STD_CATS; c.forEach(x=>{ if(STD_CATS.includes(x)) set.add(x); }); } });
  if(!set.size) STD_CATS.forEach(x=>set.add(x));
  return STD_CATS.filter(x=>set.has(x));
}
export function togglePromoCat(u,cat){ const m=S.models.find(x=>x.uid===u); if(!m) return; m.promoCats=m.promoCats||[]; const i=m.promoCats.indexOf(cat); if(i>=0) m.promoCats.splice(i,1); else { if(m.promoCats.length>=2) return; m.promoCats.push(cat); } render(); }
export function promotedSkillLists(m){
  const cats=(m&&m.promoCats)||[]; const out=[];
  cats.forEach(c=>{ if(SKILLLISTS[c]) out.push(['['+SKILLLISTS[c].name+']',SKILLLISTS[c].skills]); });
  const ex=WBEXTRA[S.wb]; if(ex&&ex.skills&&SKILLSETS[ex.skills]) out.push(['['+SKILLSETS[ex.skills].name+']',SKILLSETS[ex.skills].skills]);
  return out;
}
export function promoteHench(u){
  const m=S.models.find(x=>x.uid===u); if(!m) return;
  if(totalHeroes()>=(Number(HR().heroes)||6)){ alert('Maximum of '+(Number(HR().heroes)||6)+' Heroes per warband reached.'); return; }
  const def=unitDef(m.uid_def);
  if((Number(m.qty)||1)>1){
    m.qty=(Number(m.qty)||1)-1;
    S.models.push({uid:uid++, uid_def:m.uid_def, name:(m.name?m.name+' (Hero)':def.name+' (Hero)'), exp:Number(m.exp)||0, qty:1,
      eq:JSON.parse(JSON.stringify(m.eq||{})), mut:[...(m.mut||[])], adv:Object.assign({},m.adv||{}),
      skills:[...(m.skills||[])], inj:[...(m.inj||[])], spells:[...(m.spells||[])], miss:Number(m.miss)||0, promoted:true, promoCats:(def.promoCatsFixed?[...def.promoCatsFixed]:[]), _advOpen:true});
  } else { m.promoted=true; m.promoCats=(def.promoCatsFixed?[...def.promoCatsFixed]:(m.promoCats||[])); m._advOpen=true; }
  render();
}
export function unpromote(u){ const m=S.models.find(x=>x.uid===u); if(m){ delete m.promoted; render(); } }
/* Wie viele Sprüche/Gebete bringt die Einheit von Haus aus mit? (Rest sind Advances) */
export function addSkillFromSel(u){ const m=S.models.find(x=>x.uid===u); if(!m) return;
  const el=document.getElementById('sksel-'+u); const v=el&&el.value;
  if(!v||v==='\u2014') return;
  m.skills=m.skills||[]; if(m.skills.includes(v)) return;
  m.skills.push(v); render(); }
export function magicOfModel(m){ const def=unitDef(m.uid_def); if(!def) return null;
  if(m.magic&&SPELLS[m.magic]) return m.magic;
  if(def.magic&&SPELLS[def.magic]) return def.magic;
  return null; }
export function addSpellFromAdv(u){ const m=S.models.find(x=>x.uid===u); if(!m) return;
  const el=document.getElementById('spadv-'+u); const v=el&&el.value;
  if(!v||v==='\u2014') return;
  const lore=magicOfModel(m); if(!lore) return;
  m.spells=m.spells||[]; if(m.spells.some(x=>x.name===v)) return;
  m.spells.push({name:v}); render(); }
/* Marauders: das Mal der Warband bestimmt die Startsprüche.
   Seer mit Mark of Tchar startet mit ZWEI Sprüchen (einer frei, einer zufällig),
   mit Arkhar ist er Bloodfather und KANN NICHT zaubern (0). Sonst 1.
   Der Anführer wird nur mit Tchar zum Zauberer (1 Spruch) — er kann das Mal
   auch erst im Kampagnenverlauf erhalten. */
export function marauderStartSpells(mdl){ if(S.wb!=='maraudersofchaos'||!mdl) return null;
  const d=unitDef(mdl.uid_def); if(!d) return null;
  const mk=S.mark||'';
  if(isMarauderSeer(d)){ if(mk==='khorne') return 0; if(mk==='eagle') return 2; return mk?1:1; }
  if(isMarauderChief(d)) return (mk==='eagle' && mdl.caster)?1:0;
  return null; }
export function spellStartCount(defOrEntry,mdl){
  const mm=(typeof marauderStartSpells==='function')?marauderStartSpells(mdl):null;
  if(mm!==null&&mm!==undefined) return mm;
  const sp=(defOrEntry&&defOrEntry.sp)||'';
  const w={one:1,two:2,three:3,four:4,five:5,six:6,all:6};
  let m=/\b(one|two|three|four|five|six|all|\d+)\s+(?:[A-Za-z'\-]+\s+){0,3}(?:spells?|prayers?|runes?|rituals?)\b/i.exec(sp);
  if(m){ const v=String(m[1]).toLowerCase(); return w[v]!=null?w[v]:(Number(v)||1); }
  if(/\b(?:wizard|prayers?|priest|magician)\b/i.test(sp)) return 1;
  return 0; }
export function canBeLeader(m){ const def=unitDef(m.uid_def); if(!def) return false;
  if(!isHeroModel(m)) return false;
  return !/never become the warband leader|may not be the leader|cannot be the leader|never be the warband leader/i.test(def.sp||''); }
export function defaultLeaderUid(){ const nat=S.models.find(m=>{ const d=unitDef(m.uid_def); return d&&/\bLeader:/.test(d.sp||''); });
  if(nat) return nat.uid;
  const first=S.models.find(m=>canBeLeader(m)); return first?first.uid:null; }
export function leaderUid(){ if(S.leaderUid){ const m=S.models.find(x=>x.uid===S.leaderUid); if(m&&canBeLeader(m)) return S.leaderUid; }
  return defaultLeaderUid(); }
export function isLeaderModel(m){ return !!m && m.uid===leaderUid(); }
export function setLeader(u){ const m=S.models.find(x=>x.uid===u); if(!m||!canBeLeader(m)) return; S.leaderUid=u; render(); }
export function leaderSection(m){
  if(!isHeroModel(m)) return '';
  const cur=isLeaderModel(m), able=canBeLeader(m);
  if(!able) return `<div class="leader-row no-print"><span class="lead-no" title="This warrior may never lead the warband.">\u26d4 May never be the warband Leader</span></div>`;
  return `<label class="leader-row ${cur?'is-leader':''}"><input type="radio" name="wbleader" ${cur?'checked':''} onchange="setLeader(${m.uid})">
    <span>${cur?'\u2605 Warband Leader':'Make Leader'}</span>
    ${cur?'<span class="lead-skill" title="Friendly models within 6 inches may use his Leadership.">Leader</span>':''}</label>`;
}
export function advSection(m){
  const def=unitDef(m.uid_def); if(def.noxp||!def.profile) return '';
  const hero=isHeroModel(m);
  const th=xpThresholds(hero); const xp=Number(m.exp)||0; const start=Number(def.exp)||0;
  const earned=th.filter(t=>t>start&&t<=xp).length;
  const adv=m.adv||{}; const skills=m.skills||[];
  /* RAW: Ein Caster darf ANSTELLE eines Skills einen neuen Spruch nehmen.
     Gewählte Sprüche und Schwierigkeits-Reduktionen (bereits bekannter Spruch neu gewürfelt)
     sind daher ebenfalls "verbrauchte" Advances und zählen mit. */
  const spellsSel=(m.spells||[]);
  const spellStart=spellStartCount(def,m);
  const spellAdv=Math.max(0,spellsSel.length-spellStart)
    + spellsSel.reduce((a,sp)=>a+(Number(sp.red)||0),0);
  const applied=Object.values(adv).reduce((s,v)=>s+(Number(v)||0),0)+skills.length+spellAdv;
  const order=["M","WS","BS","S","T","W","I","A","Ld"];
  const chips=order.filter(x=>adv[x]).map(x=>`<span class="advchip">+${adv[x]} ${x}<button class="advx no-print" title="remove" onclick="remAdv(${m.uid},'${x}')">×</button></span>`).join('')
    + skills.map((sk,i)=>`<span class="advchip skill" title="${skillText(sk,e).replace(/"/g,'&quot;')}">${String(sk).replace(/</g,'&lt;')}<button class="advx no-print" title="remove" onclick="remSkill(${m.uid},${i})">×</button></span>`).join('');
  const btns=order.map(x=>{ const ok=canAdv(m,x); return `<button class="btnsm advb" ${ok?'':'disabled'} title="${ok?('apply +1 '+x):'maximum reached'}" onclick="addAdv(${m.uid},'${x}')">+${x}</button>`; }).join('');
  const mi=maxInfo(m);
  const maxNote = mi ? `Maxima (${mi.label}): ${order.map(x=>`${x} ${mi.prof[x]}`).join(' · ')}.${!hero?' Henchmen: max +1 per stat.':''}` : `No racial maxima on file — please track manually.`;
  let stTxt, stCls;
  if(applied<earned){ stTxt=`${earned-applied} to apply`; stCls='advopen'; }
  else if(applied>earned){ stTxt=`${applied-earned} over earned`; stCls='advwarn'; }
  else { stTxt='complete'; stCls='advok'; }
  const tbl = hero
    ? `2–5 New Skill · 6: +1 S/A · 7: +1 WS/BS · 8: +1 I/Ld · 9: +1 W/T · 10–12 New Skill`
    : `2–4 +1 I · 5 +1 S · 6–7 +1 WS/BS · 8 +1 A · 9 +1 Ld · 10–12 “The lad's got talent” (one model becomes a Hero)`;
  function skSelect(lists){ const opts=lists.map(([lab,sk])=>`<optgroup label="${String(lab).replace(/[\[\]]/g,'')}">`+sk.map(x=>`<option value="${String(x[0]).replace(/"/g,'&quot;')}">${x[0]}</option>`).join('')+`</optgroup>`).join('');
    return `<select id="sksel-${m.uid}" class="advsel"><option value="\u2014">\u2014 choose a skill \u2014</option>${opts}</select><button class="btnsm" onclick="addSkillFromSel(${m.uid})">+ Skill</button>`; }
  function skInput(lists){ const lore=magicOfModel(m);
    const spellAlt = (lore&&SPELLS[lore]) ? `<div class="advskilladd no-print"><span class="spelltag">✦</span><select id="spadv-${m.uid}"><option value="—">— or take a new spell instead of a skill —</option>${SPELLS[lore].spells.filter(x=>!String(x[0]).startsWith('▸')&&!((m.spells||[]).some(y=>y.name===x[0]))).map(x=>`<option value="${String(x[0]).replace(/"/g,'&quot;')}">${x[0]}</option>`).join('')}</select><button class="btnsm" onclick="addSpellFromAdv(${m.uid})">+ Spell</button></div>` : '';
    return `<div class="advskilladd no-print">${skSelect(lists)}</div>`+spellAlt; }
  let extra='';
  if(hero && m.promoted){
    const fixed=def.promoCatsFixed; const chosen=m.promoCats||[];
    if(fixed){
      const picker=fixed.map(c=>`<button class="btnsm advb blood" disabled>${SKILLLISTS[c]?SKILLLISTS[c].name:c}</button>`).join('');
      extra = `<div class="note" style="padding:4px 10px">★ Promoted (“The Lad's Got Talent”). This creature's skill categories are fixed: <b>${fixed.map(c=>SKILLLISTS[c]?SKILLLISTS[c].name:c).join(' & ')}</b>. <button class="advx no-print" style="color:#7a1410" title="revert to Henchman" onclick="unpromote(${m.uid})">revert</button></div>
        <div class="advbtns no-print">${picker}</div>` + skInput(promotedSkillLists(m));
    } else {
      let avail=availHeroCats();
      if(/may not choose strength|\bweak:/i.test(def.sp||'')) avail=avail.filter(c=>c!=='strength');
      const picker=avail.map(c=>{ const on=chosen.includes(c); const full=chosen.length>=2&&!on; const nm=SKILLLISTS[c]?SKILLLISTS[c].name:c; return `<button class="btnsm advb${on?' blood':''}" ${full?'disabled':''} title="${full?'Pick at most two categories':'toggle '+nm}" onclick="togglePromoCat(${m.uid},'${c}')">${on?'✓ ':''}${nm}</button>`; }).join('');
      extra = `<div class="note" style="padding:4px 10px">★ Promoted (“The Lad's Got Talent”) — choose <b>two</b> skill categories he may learn from (${chosen.length}/2). Warband special skills are always available. <button class="advx no-print" style="color:#7a1410" title="revert to Henchman" onclick="unpromote(${m.uid})">revert</button></div>
        <div class="advbtns no-print">${picker}</div>`;
      const lists=promotedSkillLists(m);
      extra += lists.length ? skInput(lists) : `<div class="note" style="padding:2px 10px">Pick at least one category to choose skills.</div>`;
    }
  } else if(hero){
    extra = skInput(skillListsFor(def));
  } else {
    const noXpUnit = !!def.noxp || /gains no experience|never gains? experience|gain no experience/i.test(def.sp||'');
    const noPromo = def.noPromote || noXpUnit
      || /never become a hero|cannot become a hero|can never become a hero|may never become heroes|lowest of the low|executes the slave|runts:/i.test(def.sp||'');
    if(noPromo){
      extra = noXpUnit
        ? `<div class="note" style="padding:4px 10px">${def.name} gains no experience and can never become a Hero (no “Lad’s Got Talent”).</div>`
        : `<div class="note" style="padding:4px 10px">${def.name} may gain experience but can never become a Hero (no “Lad’s Got Talent”).</div>`;
    } else {
      const hcap6=(Number(HR().heroes)||6); const full = totalHeroes()>=hcap6;
      extra = `<div class="advbtns no-print"><button class="btnsm blood" ${full?'disabled':''} title="${full?('Maximum of '+hcap6+' Heroes reached'):'Promote one model from this group to Hero'}" onclick="promoteHench(${m.uid})">★ The Lad's Got Talent → Hero</button>${full?('<span class="note" style="padding:4px 6px">max '+hcap6+' Heroes</span>'):''}</div>`;
    }
  }
  return `<details class="adv" ${m._advOpen?'open':''} ontoggle="setAdvOpen(${m.uid},this.open)">
    <summary>Advances &amp; Stats — <b>${applied}/${earned}</b> Applied · <span class="${stCls}">${stTxt}</span></summary>
    <div class="advstat">Earned in play: <b>${earned}</b> · applied: <b>${applied}</b></div>
    ${chips?`<div class="advchips">${chips}</div>`:`<div class="note" style="padding:2px 10px">No advances applied yet.</div>`}
    <div class="advbtns no-print">${btns}</div>
    ${extra}
    <div class="note" style="padding:2px 10px 8px">2D6 table (${hero?'Hero':'Henchman'}): ${tbl}.<br>${maxNote}</div>
  </details>`;
}

/* ===================== SERIOUS INJURIES (D66, Helden) ===================== */

export function injModText(j){ return j.mod?' ('+Object.entries(j.mod).map(([k,v])=>(v>0?'+':'')+v+' '+k).join(', ')+')':''; }
export function missAdj(u,d){ const m=S.models.find(x=>x.uid===u); if(!m) return; m.miss=Math.max(0,(Number(m.miss)||0)+d); render(); }
export function addInj(u){ const m=S.models.find(x=>x.uid===u); const el=document.getElementById('inj-'+u); const code=el&&el.value; const j=INJURIES.find(i=>i.code===code); if(!j) return; if(j.miss){ m.miss=(Number(m.miss)||0)+j.miss; flash(`+${j.miss} game to miss — tracked at the top of the unit card.`); render(); return; } m.inj=m.inj||[]; m.inj.push({code:j.code,name:j.name,text:j.text,mod:j.mod||null}); render(); }
export function remInj(u,i){ const m=S.models.find(x=>x.uid===u); if(m.inj){ m.inj.splice(i,1); render(); } }
export function setInjOpen(u,v){ const m=S.models.find(x=>x.uid===u); if(m) m._injOpen=v; }
export function injSection(m){
  const def=unitDef(m.uid_def); if(def.t!=='hero'||!def.profile) return '';
  const inj=m.inj||[];
  const chips=inj.map((j,i)=>`<span class="injchip" title="${(j.text||'').replace(/"/g,'&quot;')}">${j.code} ${INJEN[j.code]||j.name}${injModText(j)}<button class="advx no-print" title="remove" onclick="remInj(${m.uid},${i})">×</button></span>`).join('');
  const opts=INJURIES.map(j=>`<option value="${j.code}">${j.code} · ${INJEN[j.code]||j.name}${injModText(j)}</option>`).join('');
  return `<details class="adv inj" ${m._injOpen?'open':''} ontoggle="setInjOpen(${m.uid},this.open)">
    <summary>Serious Injuries${inj.length?` — <b>${inj.length}</b>`:''}</summary>
    ${chips?`<div class="advchips">${chips}</div>`:`<div class="note" style="padding:2px 10px">No injuries.</div>`}
    <div class="advskilladd no-print"><select id="inj-${m.uid}">${opts}</select><button class="btnsm" onclick="addInj(${m.uid})">+ Injury</button></div>
    <div class="note" style="padding:2px 10px 8px">Stat injuries (Leg/Chest/Eye/Nerve/Hand) are applied directly to the profile. D66 table (Heroes) from the rulebook.</div>
  </details>`;
}
/* ===================== TRUHE / LAGER ===================== */
export function stashAdj(field,d){ S.stash=S.stash||{wyrd:0,gold:0,items:[]}; S.stash[field]=Math.max(0,(Number(S.stash[field])||0)+d); renderStash(); }
export function stashSet(field,v){ S.stash=S.stash||{wyrd:0,gold:0,items:[]}; S.stash[field]=Math.max(0,Math.round(Number(v)||0)); renderStash(); }
export function stashAddItem(){ S.stash=S.stash||{wyrd:0,gold:0,items:[]};
  const sel=document.getElementById('stash-sel'); const free=document.getElementById('stash-free'); const qn=document.getElementById('stash-qty');
  let name=((free&&free.value)||'').trim(); if(!name && sel && sel.value!=='—') name=sel.value; name=(name||'').trim();
  if(!name||name==='—') return;
  const qty=Math.max(1,Number(qn&&qn.value)||1);
  const ex=S.stash.items.find(it=>it.name===name); if(ex) ex.qty+=qty; else S.stash.items.push({name,qty});
  renderStash(); }
export function stashRemItem(i){ if(S.stash&&S.stash.items){ S.stash.items.splice(i,1); renderStash(); } }
export function stashItemQty(i,v){ if(S.stash&&S.stash.items[i]){ S.stash.items[i].qty=Math.max(1,Number(v)||1); renderStash(); } }
export function renderStash(){
  const el=document.getElementById('stash'); if(!el) return;
  const st=S.stash||(S.stash={wyrd:0,gold:0,items:[]});
  const names=new Set();
  (WARBANDS[S.wb].units||[]).forEach(u=>{ const list=eqListFor(u); if(list) for(const c in list) for(const [nm] of list[c]) names.add(enItem(nm)); });
  const opts='<option value="—">— Warband item —</option>'+[...names].sort((a,b)=>a.localeCompare(b)).map(n=>`<option value="${n.replace(/"/g,'&quot;')}">${n}</option>`).join('');
  const rows = st.items.length? st.items.map((it,i)=>`<div class="stashrow"><span class="stashname">${String(it.name).replace(/</g,'&lt;')}</span>
     <input type="number" min="1" value="${it.qty}" class="stashq no-print" onchange="stashItemQty(${i},this.value)"><span class="stashq-print">×${it.qty}</span>
     <button class="advx no-print" title="remove" onclick="stashRemItem(${i})">×</button></div>`).join('')
     : `<div class="note">Empty.</div>`;
  el.innerHTML=`<h2 style="margin-top:0">Stash / Store</h2>
    <div class="stashtop">
      <div class="stashbox"><label>Wyrdstone shards</label><div class="stashctl"><button class="btnsm no-print" onclick="stashAdj('wyrd',-1)">−</button><input type="number" min="0" value="${st.wyrd}" class="stashnumin no-print" onchange="stashSet('wyrd',this.value)"><span class="stashq-print">${st.wyrd}</span><button class="btnsm no-print" onclick="stashAdj('wyrd',1)">+</button></div></div>
      <div class="stashbox"><label>Gold (gc)</label><div class="stashctl"><button class="btnsm no-print" onclick="adjGoldCurrent(-5)">−5</button><input type="number" value="${goldCurrent()}" class="stashnumin no-print" onchange="setGoldCurrent(this.value)"><span class="stashq-print">${goldCurrent()} gc</span><button class="btnsm no-print" onclick="adjGoldCurrent(5)">+5</button></div></div>
    </div>
    <div class="stashitems">${rows}</div>
    <div class="stashadd no-print">
      <select id="stash-sel">${opts}</select>
      <input type="text" id="stash-free" placeholder="or custom item…">
      <input type="number" id="stash-qty" min="1" value="1" class="stashq">
      <button class="btnsm" onclick="stashAddItem()">+ to stash</button>
    </div>
    <div class="note">Unused equipment, loot and wyrdstone of the warband (does not count toward warband rating).</div>`;
}
/* ===================== ZAUBER / GEBETE (pro Modell) ===================== */
export function casterMagic(def){ const ex=WBEXTRA[S.wb]; if(!ex||!ex.magic||!SPELLS[ex.magic]) return null;
  if(def.sp && /\bWizard\b|Prayers of\b|Disciple of Sigmar/i.test(def.sp)) return ex.magic; return null; }
/* --- Marauders of Chaos: Mark of a Chaos God determines the spell list --- */

export function markName(k){ const x=MARAUDER_MARKS.find(m=>m[0]===k); return x?x[1]:''; }
export function markLore(){ const x=MARAUDER_MARKS.find(m=>m[0]===S.mark); return x?x[2]:null; }
export function isMarauderSeer(def){ return S.wb==='maraudersofchaos' && def && /\bWizard\b/.test(def.sp||''); }
export function isMarauderChief(def){ return S.wb==='maraudersofchaos' && def && /\bLeader\b/.test(def.sp||''); }
export function setMark(v){ S.mark=v||''; S.models.forEach(m=>{ const d=unitDef(m.uid_def); if(isMarauderSeer(d)||isMarauderChief(d)) m.spells=[]; }); render(); }
export function casterLore(m){ if(!m) return null;
  const def=unitDef(m.uid_def);
  if(isMarauderSeer(def)) return markLore();
  if(isMarauderChief(def)) return m.caster?markLore():null;
  const inh=casterMagic(def); if(inh) return inh;
  if(m.caster) return m.lore||(WBEXTRA[S.wb]&&WBEXTRA[S.wb].magic)||null; return null; }
export function spellBase(name){ const m=String(name).match(/\((\d+)\)/); return m?parseInt(m[1],10):null; }
export function spellLabel(name){ return String(name).replace(/\s*\((\d+|auto)\)\s*$/i,'').trim(); }
export function spellEffect(name,lore){ lore=lore||(WBEXTRA[S.wb]&&WBEXTRA[S.wb].magic); if(!lore||!SPELLS[lore]) return ''; const e=SPELLS[lore].spells.find(s=>s[0]===name); return e?e[1]:''; }
export function spellEffDiff(s){ const b=spellBase(s.name); return b!=null?Math.max(2,b-(s.red||0)):null; }
export function addSpell(u){ const m=S.models.find(x=>x.uid===u); const el=document.getElementById('sp-'+u); const name=el&&el.value; if(!name||name==='—') return;
  m.spells=m.spells||[]; if(m.spells.some(s=>s.name===name)) return; m.spells.push({name,red:0}); render(); }
export function remSpell2(u,i){ const m=S.models.find(x=>x.uid===u); if(m.spells){ m.spells.splice(i,1); render(); } }
export function spellRed(u,i,d){ const m=S.models.find(x=>x.uid===u); const s=m.spells&&m.spells[i]; if(!s) return; const b=spellBase(s.name); s.red=Math.max(0,(s.red||0)+d); if(b!=null) s.red=Math.min(s.red,b-2); render(); }
export function setSpellOpen(u,v){ const m=S.models.find(x=>x.uid===u); if(m) m._spOpen=v; }
export function setCaster(u,on){ const m=S.models.find(x=>x.uid===u); if(!m) return; m.caster=!!on; if(on&&!m.lore) m.lore=(WBEXTRA[S.wb]&&WBEXTRA[S.wb].magic)||''; m._spOpen=true; render(); }
export function setLore(u,v){ const m=S.models.find(x=>x.uid===u); if(!m) return; if((m.lore||'')!==(v||'')) m.spells=[]; m.lore=v||''; m._spOpen=true; render(); }
export function spellPicker(m,magic){
  const list=SPELLS[magic].spells.filter(s=>!String(s[0]).startsWith('▸'));
  const sel=m.spells||[];
  const chips=sel.map((s,i)=>{ const d=spellEffDiff(s); return `<span class="spellchip" title="${spellEffect(s.name,magic).replace(/"/g,'&quot;')}">${spellLabel(s.name)}${d!=null?` <b>(${d})</b>`:''}<button class="advx no-print" title="Difficulty −1 (e.g. rolled again on advancement)" onclick="spellRed(${m.uid},${i},1)">▼</button><button class="advx no-print" title="remove" onclick="remSpell2(${m.uid},${i})">×</button></span>`; }).join('');
  const taken=new Set(sel.map(s=>s.name));
  const opts='<option value="—">— choose spell —</option>'+list.filter(s=>!taken.has(s[0])).map(s=>`<option value="${String(s[0]).replace(/"/g,'&quot;')}">${s[0]}</option>`).join('');
  return `${chips?`<div class="advchips">${chips}</div>`:`<div class="note" style="padding:2px 10px">No spells chosen yet.</div>`}
    <div class="advskilladd no-print"><select id="sp-${m.uid}">${opts}</select><button class="btnsm" onclick="addSpell(${m.uid})">+ Spell</button></div>
    <div class="note" style="padding:2px 10px 8px">Number = difficulty (2D6 to cast). “▼” lowers it by 1 — e.g. when an advancement re-rolled a spell you already knew.</div>`;
}

export function markRulesFor(m){ const k=S.mark; if(!k||!MARK_RULES[k]||!m) return [];
  const d=unitDef(m.uid_def); if(!d) return [];
  if(isMarauderSeer(d)) return MARK_RULES[k].seer||[];
  if(isMarauderChief(d) && m.caster) return MARK_RULES[k].leader||[];
  return []; }
export function spellSectionRaw(m,lore){ if(!lore||!SPELLS[lore]) return '';
  const cnt=(m.spells||[]).length;
  return `<details class="adv spell caster" ${m._spOpen?'open':''} ontoggle="setSpellOpen(${m.uid},this.open)">
    <summary><span class="spelltag">\u2726 Caster</span>Spells \u2014 ${SPELLS[lore].name}${cnt?` <b>(${cnt})</b>`:''}</summary>
    ${spellPicker(m,lore)}</details>`; }
export function marauderMarkSection(m, isSeer){
  const lore=markLore(), hasMark=!!S.mark;
  const chips=markRulesFor(m).map(function(x){
    const nm=x[0], t=String(x[1]).replace(/"/g,'&quot;').replace(/'/g,"\\'");
    return '<span class="kwchip" tabindex="0" onmouseenter="showItipHTML(this,\'<b>'+nm+'</b><br>'+t+'\',false,340)" onmouseleave="hideItip()">'+nm+' \u24d8</span>';
  }).join('');
  if(isSeer){
    const sel='<select class="advsel no-print" onchange="setMark(this.value)"><option value="">\u2014 choose the Mark \u2014</option>'
      +MARAUDER_MARKS.map(function(mk){return '<option value="'+mk[0]+'" '+(S.mark===mk[0]?'selected':'')+'>'+mk[1]+'</option>';}).join('')+'</select>';
    return '<div class="markbox"><div class="markhead"><b>Mark of Chaos</b> <span class="note">(the Seer MUST have a Mark \u2014 it sets the warband\u2019s god; the Chieftain may take the same Mark later)</span></div>'
      +sel
      +(!hasMark?'<div class="markwarn">\u26a0 A Seer must choose a Mark when hired.</div>':'')
      +(chips?'<div class="abil-sk"><b>Mark rules:</b> '+chips+'</div>':'')+'</div>';
  }
  const on=!!m.caster;
  return '<div class="markbox"><label class="no-print" style="display:flex;align-items:center;gap:6px;cursor:pointer">'
    +'<input type="checkbox" '+(on?'checked':'')+' '+(hasMark?'':'disabled')+' onchange="setCaster('+m.uid+',this.checked)">'
    +'<span><b>Has taken the Mark of Chaos</b>'+(hasMark?' \u2014 '+markName(S.mark):'')+'</span></label>'
    +'<span class="note">The Leader may gain the Mark during the campaign \u2014 always the SAME Mark as the Seer\u2019s, but with the Leader-specific benefits.'+(hasMark?'':' Choose the Seer\u2019s Mark first.')+'</span>'
    +(on&&chips?'<div class="abil-sk"><b>Mark rules:</b> '+chips+'</div>':'')
    +(on&&!lore?'<div class="note" style="margin-top:3px"><b>Not a spellcaster:</b> This Mark grants benefits, not spells.</div>':'')
    +'</div>';
}
export function spellSection(m){
  const def=unitDef(m.uid_def);
  if(isMarauderSeer(def)||isMarauderChief(def)){ const _lore=markLore();
    const _sp=(_lore && (isMarauderSeer(def)||m.caster)) ? spellSectionRaw(m,_lore) : '';
    return marauderMarkSection(m, isMarauderSeer(def)) + _sp; }
  const inherent=casterMagic(def);
  const cnt=(m.spells||[]).length;
  // Inherent spellcaster (e.g. Wizard, Priest, Matriarch, Magister): no toggle needed.
  if(inherent){
    return `<details class="adv spell caster" ${m._spOpen?'open':''} ontoggle="setSpellOpen(${m.uid},this.open)">
      <summary><span class="spelltag">✦ Caster</span>Spells / Prayers — ${SPELLS[inherent].name}${cnt?` <b>(${cnt})</b>`:''}</summary>
      ${spellPicker(m,inherent)}</details>`;
  }
  if(!isHeroModel(m)) return '';
  const on=!!m.caster; const defLore=(WBEXTRA[S.wb]&&WBEXTRA[S.wb].magic)||''; const cur=m.lore||defLore||'';
  let body='';
  if(on){
    const loreOpts=Object.keys(SPELLS).map(k=>`<option value="${k}" ${k===cur?'selected':''}>${SPELLS[k].name}</option>`).join('');
    body=`<div class="advskilladd no-print" style="margin:2px 10px"><span class="note">Lore:</span> <select onchange="setLore(${m.uid},this.value)"><option value="">— choose lore —</option>${loreOpts}</select></div>`
       + (cur?spellPicker(m,cur):`<div class="note" style="padding:2px 10px">Choose a magic lore to pick spells.</div>`);
  }
  const tag = on ? `<span class="spelltag">✦ Caster</span>` : `<span class="spelltag muted">○ Not a caster</span>`;
  return `<details class="adv spell ${on?'caster':'noncaster'}" ${(m._spOpen||on)?'open':''} ontoggle="setSpellOpen(${m.uid},this.open)">
    <summary>${tag}Spells / Prayers${on&&cur?` — ${SPELLS[cur].name}`:''}${on&&cnt?` <b>(${cnt})</b>`:''}</summary>
    <label class="hr-chk no-print" style="padding:2px 10px"><input type="checkbox" ${on?'checked':''} onchange="setCaster(${m.uid},this.checked)"> <span>This Hero can cast spells (gained via a skill or magic item)</span></label>
    ${body}</details>`;
}

export function attachedBlocks(def,m){
  const out=[];
  if(def&&def.attached) for(const a of def.attached) out.push(a);
  if(m&&m.eq) for(const nm in m.eq){ if((Number(m.eq[nm])||0)>0 && MOUNTS[nm]){ const a=MOUNTS[nm]; out.push({label:a.label,icon:a.icon,profile:a.profile,note:a.note,qty:Number(m.eq[nm])||1}); } }
  return out;
}
export function attachedSection(def,m){
  const blocks=attachedBlocks(def,m); if(!blocks.length) return '';
  const k=["M","WS","BS","S","T","W","I","A","Ld"];
  return blocks.map(a=>{
    const q=(a.qty&&a.qty>1)?` ×${a.qty}`:'';
    return `<div class="attached"><div class="at-h">${a.icon||'▸'} <b>${a.label}${q}</b><span class="atag">attached</span></div>`+
      `<table class="stats atbl"><tr>${k.map(x=>`<th>${x}</th>`).join('')}</tr>`+
      `<tr>${k.map(x=>`<td>${a.profile[x]}</td>`).join('')}</tr></table>`+
      (a.note?`<div class="atnote">${a.note}</div>`:'')+`</div>`;
  }).join('');
}
export function renderRoster(){
  const el=document.getElementById('roster');
  if(!S.models.length && !hsList().length && !dpList().length){ el.innerHTML=`<div class="empty">No warriors recruited yet.<br>Use “Recruit Warriors” below.</div>`; return; }
  let html='';
  // Each section is ordered by the warband's recruitment-listing order (the order units appear in
  // the recruit picker); the Leader is pinned to the top of the heroes, and the order in which models
  // were actually recruited is only a tiebreaker. Vehicles (e.g. the Trade Wagon) get their own section.
  const isLeaderDef = d => !!(d && /\bLeader:/.test(d.sp||''));
  const defOrder = (WARBANDS[S.wb].units||[]).map(u=>u.id);
  const defIdx = m => { const i=defOrder.indexOf(m.uid_def); return i<0?999:i; };
  const groupOf = m => { const d=unitDef(m.uid_def); if(d&&d.vehicle) return 'vehicle'; return isHeroModel(m)?'hero':'hen'; };
  ['hero','dp','hs','hen','vehicle'].forEach(t=>{
    if(t==='hs'){ html+=hsRosterCards(); return; }
    if(t==='dp'){ html+=dpRosterCards(); return; }
    let ms=S.models.filter(m=> groupOf(m)===t && !(t==='hen'&&m.promoted) );
    ms=ms.slice().sort((a,b)=>
      (t==='hero' ? ((isLeaderDef(unitDef(a.uid_def))?0:1)-(isLeaderDef(unitDef(b.uid_def))?0:1)) : 0)
      || (defIdx(a)-defIdx(b)) || (a.uid-b.uid) );
    ms.forEach(m=>{
      const def=unitDef(m.uid_def);
      const q=t==='hen'?m.qty:1; const promoted=!!m.promoted;
      let hcap=1, hmaxNote='';
      if(t==='hen'){ const umx=unitMax(def);
        const others=S.models.filter(x=>x.uid_def===m.uid_def&&x.uid!==m.uid).reduce((s,x)=>s+(x.qty||1),0);
        hcap=Math.min(5, (umx===null||umx===undefined)?5:Math.max(1,umx-others));
        if(def.max!=null) hmaxNote=` <span class="note">(max ${def.max} of this type per warband)</span>`; }
      html+=`<div class="model"><div class="mhead">
        <span class="badge ${t==='hero'?'hero':(t==='vehicle'?'vehicle':'hen')}">${t==='hero'?(promoted?'Hero \u2605':'Hero'):(t==='vehicle'?'Vehicle':'Henchmen')}</span>
        <input class="namefld" value="${(m.name||'').replace(/"/g,'&quot;')}" placeholder="Name…"
          oninput="setName(${m.uid},this.value)">
        <span class="note">${def.name}</span>
        <span class="missctl"><span class="misslbl no-print" title="Track games this warrior sits out (injuries that say “misses next game”, or unpaid Hired Sword upkeep). ▲ adds a game to miss, ▼ removes one.">⚑ miss games</span>${(Number(m.miss)||0)>0?`<b class="missbadge">out ${m.miss} game${m.miss>1?'s':''}</b>`:''}<button class="tiny ghost no-print" title="one fewer game to miss" ${(Number(m.miss)||0)<=0?'disabled':''} onclick="missAdj(${m.uid},-1)">▼</button><button class="tiny ghost no-print" title="miss one more game" onclick="missAdj(${m.uid},1)">▲</button></span>
        <button class="tiny ghost no-print" onclick="ttsOpen(${m.uid})" title="Description for Tabletop Simulator">⧉ TTS</button>
        <button class="tiny ghost no-print" onclick="removeUnit(${m.uid})">remove</button>
      </div><div class="mbody">
        ${def.profile?statTableM(m):''}${attachedSection(def,m)}${vehRulesBlock(def)}
        <div class="ctlrow">
          ${t==='hen'?(hcap<=1
             ? `<span class="note">Single model${def.max!=null?` · max ${def.max} per warband`:''}</span>`
             : `<label>Models in group (1–${hcap}): <input type="number" min="1" max="${hcap}" value="${m.qty}"
             onchange="setQty(${m.uid},this.value)"></label>${hmaxNote}`):''}
          ${def.noxp?'<span class="note">No experience (equipment / animal)</span>':`<label>Experience: <input type="number" min="0" value="${m.exp}" onchange="setExp(${m.uid},this.value)"></label>`}
        </div>
        ${def.noxp?'':`<div id="xp-${m.uid}" class="xpbar no-print">${xpBar(m)}</div>`}
        ${leaderSection(m)}
        ${def.noxp?'':advSection(m)}
        ${injSection(m)}
        ${spellSection(m)}
        ${eqSection(m)}
        ${abilitySection(def,m)}
        <div class="subtotal">${t==='hen'?`${q} × ${modelUnitCost(m)} GK = `:''}${modelTotalCost(m)} GK</div>
      </div></div>`;
    });
  });
  el.innerHTML=html;
}
export function renderSidebar(){
  const wb=WARBANDS[S.wb];
  const gold=goldCurrent(), mc=totalModels(), hc=totalHeroes();
  const gEl=document.getElementById('goldnow');
  if(gEl){ gEl.textContent=gold; gEl.className='v'+(gold<0?' bad':''); }
  document.getElementById('models').textContent=mc;
  document.getElementById('heroes').textContent=hc;
  document.getElementById('rating').textContent=totalRating();
  // unit breakdown (aggregated per type, regardless of group/gear)
  const counts={}, order=[];
  S.models.forEach(m=>{ const d=unitDef(m.uid_def); if(!d) return;
    if(!(d.id in counts)){ counts[d.id]={name:d.name,n:0}; order.push(d.id); }
    counts[d.id].n += (d.t==='hen'?(Number(m.qty)||1):1); });
  const ulEl=document.getElementById('unitlist');
  if(ulEl){
    const udef=k=>WARBANDS[S.wb].units.find(u=>u.id===k);
    const heroK=order.filter(k=>{const d=udef(k);return d&&d.t==='hero'&&!d.vehicle;});
    const henK =order.filter(k=>{const d=udef(k);return d&&(d.t==='hen'||d.vehicle);});
    const urow=(name,n,title,gold)=>`<div class="ulrow"${title?` title="${title}"`:''}><span>${name}</span>${gold!=null?`<span class="ulg">${gold} gc</span>`:''}<span class="uln">×${n}</span></div>`;
    const hsRows=(S.hired||[]).map(h=>{const hs=HIREDSWORDS[h.key];if(!hs)return '';const p=hs.profile;
      const tip=`${hs.name} (${hs.grade}) — ${[p.M,p.WS,p.BS,p.S,p.T,p.W,p.I,p.A,p.Ld].join('/')} · Hire ${hs.hire}, Upkeep ${hsUpkeepFor(h.key)}, Rating +${hs.rating}`;
      return urow((h.name?h.name+' ('+hs.name+')':hs.name),1,tip.replace(/"/g,'&quot;'),(typeof hsHireCost==='function'?hsHireCost(h.key):hs.hire));}).join('');
    const goldOf=k=>S.models.filter(m=>m.uid_def===k).reduce((a,m)=>a+modelTotalCost(m),0);
    const heroRows=heroK.map(k=>urow(counts[k].name,counts[k].n,null,goldOf(k))).join('');
    const henRows =henK.map(k=>urow(counts[k].name,counts[k].n,null,goldOf(k))).join('');
    const seg=(label,rows)=>rows?`<div class="ulsec">${label}</div>${rows}`:'';
    const dpRows=(S.dp||[]).map(d=>{const dp=DRAMATIS[d.key];if(!dp)return '';const p=dp.profile;
      const tip=`${dp.name} (${dp.grade}) — ${[p.M,p.WS,p.BS,p.S,p.T,p.W,p.I,p.A,p.Ld].join('/')} · Rating +${dp.rating}`;
      return urow((d.name?d.name:dp.name),1,tip.replace(/"/g,'&quot;'),(typeof dpHireCost==='function'?dpHireCost(d.key):dp.hire));}).join('');
    ulEl.innerHTML=(heroRows||hsRows||dpRows||henRows)?seg('Heroes',heroRows)+seg('Dramatis Personae',dpRows)+seg('Hired Swords',hsRows)+seg('Henchmen',henRows)+`<div class="ulrow ultot"><span><b>Total spent</b></span><span class="ulg"><b>${totalSpent()} gc</b></span><span class="uln"></span></div>`:'';
  }
  // warnings
  const w=[]; const h=HR();
  const minReq=(h.min!==''&&h.min!=null)?Number(h.min):wb.min;
  const heroCap=Number(h.heroes)||6;
  if(gold<0) w.push(`Not enough gold — short by ${-gold} gc.`);
  if(mc<minReq) w.push(`At least ${minReq} models required (currently ${mc}).`);
  if(mc>warbandMax()) w.push(`At most ${warbandMax()} models allowed (currently ${mc}).`);
  if(hc>heroCap) w.push(`A warband may have at most ${heroCap} Heroes (currently ${hc}).`);
  if(h.rangedCapOn){ const rngM=rangedModelCount(), cap=Math.floor(mc*Number(h.rangedCap)/100);
    if(rngM>cap) w.push(`House rule: at most ${h.rangedCap}% of the warband may carry ranged weapons — max ${cap} of ${mc} (currently ${rngM}).`); }
  if(h.rerollOne){ const rr=rerollItemCount(); if(rr>1) w.push(`House rule: only one re-roll item per warband allowed (currently ${rr}).`); }
  if(S.wb==='pirates'){
    const swivels=S.models.reduce((n,m)=>n+((m.eq&&m.eq['Swivel Gun']>0)?1:0),0);
    if(swivels>1) w.push(`A Pirate warband may include only one Swivel Gun (currently ${swivels}).`);
  }
  if(S.wb==='tombguardians'){
    const chariots=S.models.reduce((n,m)=>n+((m.rare&&m.rare['Skelettstreitwagen'])?(Number(m.rare['Skelettstreitwagen'].q)||1):0),0);
    if(chariots>1) w.push(`A Tomb Guardian warband may include only one Skeleton Chariot (0-1, currently ${chariots}).`);
  }
  if(S.wb==='outlaws'){
    const bows=['Kurzbogen','Bogen','Langbogen'];
    let noBow=0, multiMissile=0;
    S.models.forEach(m=>{ const d=unitDef(m.uid_def); if(!d||d.vehicle) return;
      const lim=eqWeaponLimit(m); if(lim.missile>1) multiMissile++;
      const hasBow=bows.some(b=>m.eq&&m.eq[b]>0);
      if(d.id!=='ocleric'&&!hasBow) noBow++;
    });
    if(noBow>0) w.push(`Bow duty: every warrior except the Cleric must carry a bow — ${noBow} model(s) have none.`);
    if(multiMissile>0) w.push(`Outlaws may carry only one missile weapon each — ${multiMissile} model(s) carry more.`);
  }
  if(S.wb==='bretonnian'){
    const ridesWarhorse=id=>S.models.some(m=>m.uid_def===id&&m.eq&&m.eq['Warhorse']>0);
    const qkWH=ridesWarhorse('paladin');
    const errants=S.models.filter(m=>m.uid_def==='errant');
    if(errants.some(m=>m.eq&&m.eq['Warhorse']>0)&&!qkWH)
      w.push('Bretonnian: a Knight Errant may not ride a warhorse unless the Questing Knight also rides one.');
    const allKnightsWH=qkWH && errants.every(m=>m.eq&&m.eq['Warhorse']>0);
    if(S.models.some(m=>m.uid_def==='squire'&&m.eq&&m.eq['Pferd']>0)&&!allKnightsWH)
      w.push('Bretonnian: a Squire may not ride a horse unless the Questing Knight and every Knight Errant ride warhorses.');
  }
  if(h.eqLimitOn){ S.models.forEach(m=>{ const d=unitDef(m.uid_def); if(!d||d.vehicle) return; const lim=eqWeaponLimit(m);
    if(lim.cc>2) w.push(`${m.name||d.name}: ${lim.cc} close combat weapons — max. 2 (in addition to the free dagger).`);
    if(lim.missile>2) w.push(`${m.name||d.name}: ${lim.missile} missile weapons — max. 2 (a brace of pistols counts as 1).`); }); }
  const req=wb.units.find(u=>u.req);
  if(req && countOf(req.id)<1) w.push(`A leader (${req.name}) is required.`);
  wb.units.forEach(u=>{ const umx=unitMax(u); if(umx!==null && modelsOf(u.id)>umx) w.push(`Too many ${u.name} (max. ${umx}).`); });
  wb.units.forEach(u=>{ if(u.min && modelsOf(u.id)<u.min) w.push(`At least ${u.min} ${u.name} required (currently ${modelsOf(u.id)}).`); });
  S.models.forEach(m=>{ const d=unitDef(m.uid_def); if(d.mutReq && (!m.mut||!m.mut.length)) w.push(`${m.name||d.name}: Mutant needs at least 1 mutation.`); });
  if(S.wb==='maraudersofchaos' && !S.mark && S.models.some(function(x){var d=unitDef(x.uid_def); return d&&isMarauderSeer(d);}))
    w.push('Seer without a Mark of Chaos \u2014 a Seer must choose one; the warband is not legal.');
  const el=document.getElementById('warns');
  el.innerHTML = w.length ? w.map(x=>`<div class="warn">⚠ ${x}</div>`).join('')
    : `<div class="ok">✓ Warband is legal and ready.</div>`;
  renderHiredSwords();
  renderDramatis();
  renderCampaign();
}

/* ===================== HAUSREGEL-PANEL ===================== */
export let hrOpen=false, campOpen=false, hsOpen=false, dpOpen=false, ovOpen=true, stashOpen=true, wbOpen=true;
/* House Rules: Eine Regel gilt als AKTIV, sobald sie vom Standard abweicht.
   Die Checkbox vor der Regel schaltet sie ein/aus (aus = Standardwert). Aktive
   Abweichungen werden automatisch im Export vermerkt. */

export function hrIsDefault(k){ const d=houseDefaults(), h=HR();
  return JSON.stringify(h[k])===JSON.stringify(d[k]); }
export function houseDeviations(){ const d=houseDefaults(), h=HR(), out=[];
  Object.keys(d).forEach(function(k){ if(k==='notes') return;
    if(JSON.stringify(h[k])!==JSON.stringify(d[k])){
      let v=h[k];
      if(k==='eqLimitOn') v = h[k] ? 'enforced' : 'NOT enforced (equipment beyond the list allowed)';
      else if(typeof v==='boolean') v = v?'on':'off';
      else if(v&&typeof v==='object') v = Object.keys(v).filter(function(x){return v[x]===false;}).length
        ? 'excluded: '+Object.keys(v).filter(function(x){return v[x]===false;}).join(', ') : null;
      if(v!=null&&v!=='') out.push({key:k,label:HR_LABELS[k]||k,value:String(v)}); } });
  if(h.notes) out.push({key:'notes',label:'Notes',value:String(h.notes)});
  return out; }
export function houseSummary(){ const d=houseDeviations();
  return d.length? d.map(function(x){return x.label+': '+x.value;}) : []; }
export function setHouseActive(k,on){ const h=HR(), d=houseDefaults();
  if(!on){ h[k]=d[k]; render(); return; }
  // einschalten: sinnvoller Startwert, wenn noch Standard
  if(JSON.stringify(h[k])===JSON.stringify(d[k])){
    if(typeof d[k]==='boolean') h[k]=!d[k];
    else if(k==='startGold') h[k]=startGold();
  }
  render(); }
export function hrChk(k){ return `<input type="checkbox" class="hr-en" title="Tick to activate this house rule (deviates from the standard)" ${hrIsDefault(k)?'':'checked'} onchange="setHouseActive('${k}',this.checked)">`; }
export function renderHouse(){
  const box=document.getElementById('houserules'); if(!box) return; const h=HR();
  function num(k,label,min,max,step,suffix){ const v=(h[k]===''||h[k]==null)?'':h[k];
    return `<label class="hr-row">${hrChk(k)}<span class="hl">${label}</span><span class="hc"><input type="number" min="${min}" ${max!=null?`max="${max}"`:''} ${step?`step="${step}"`:''} value="${v}" placeholder="—" onchange="setHouseNum('${k}',this.value)"></span><span class="hs">${suffix||''}</span></label>`; }
  function slider(k,label){ const v=Number(h[k])||100;
    return `<label class="hr-row">${hrChk(k)}<span class="hl">${label}</span><span class="hc"><input type="range" min="25" max="200" step="5" value="${v}" oninput="HR().${k}=Number(this.value);document.getElementById('hv-${k}').textContent=this.value+'%';renderSidebar();renderRoster();" onchange="render()"></span><span id="hv-${k}" class="hv">${v}%</span></label>`; }
  function bool(k,label){ return `<label class="hr-chk"><input type="checkbox" ${h[k]?'checked':''} onchange="setHouseBool('${k}',this.checked)"> <span>${label}</span>${hrIsDefault(k)?'':'<span class="hr-dev" title="Deviates from the standard \u2014 recorded on export">HR</span>'}</label>`; }
  const active=houseActive();
  box.innerHTML=`<details class="sec-details no-print" ${hrOpen?'open':''} ontoggle="hrOpen=this.open"><summary class="sec-sum">⚖ House Rules ${active?'<span class="hr-on">active</span>':''}<button class="tiny ghost no-print" style="float:right" onclick="event.preventDefault();resetHouse()">reset all</button></summary><div class="sec-body">
   <div class="hr-grid no-print">
    <fieldset class="hr-fs"><legend>Warband limits</legend>
      ${num('startGold','Starting gold',0,null,5,'blank = warband default')}
      ${num('min','Min. models',0,null,1,'blank = default')}
      ${num('max','Max. models',0,null,1,'blank = default')}
      ${num('heroes','Max. Heroes',1,12,1,'default 6')}
    </fieldset>
    <fieldset class="hr-fs"><legend>Equipment costs</legend>
      ${slider('priceAll','All equipment')}
      ${slider('priceArmour','Armour')}
      ${bool('armourBodyOnly','↳ body armour only (skip helmet/shield/buckler)')}
      ${slider('priceBP','Blackpowder')}
      ${slider('priceMissile','Missile')}
      ${num('clubSurcharge','Club / mace / hammer',0,null,1,'+gc each')}
      ${num('slingSurcharge','Sling',0,null,1,'+gc each')}
      ${bool('freeDagger','Daggers are free')}
    </fieldset>
    <fieldset class="hr-fs"><legend>Hired Swords</legend>
      <label class="hr-row"><span class="hl">Grades</span><span class="hc">${['1a','1b','1c','2a'].map(g=>`<label class="hr-gbox"><input type="checkbox" ${(h.hsGrades&&h.hsGrades[g]!==false)?'checked':''} onchange="setHsGrade('${g}',this.checked)">${g}</label>`).join('')}</span><span class="hs">tick = included</span></label>
      ${bool('hsEquip','Hired Swords & Dramatis Personae may buy extra equipment')}
      <div class="hr-note">RAW their equipment is fixed \u2014 with this on they may buy from the warband\u2019s Hero equipment chart.</div>
    </fieldset>
    <fieldset class="hr-fs"><legend>Access</legend>
      ${bool('miscHench','Misc items available to Henchmen')}
      ${bool('freeMarket','Free market (ignore eligibility)')}
      ${bool('allSkills','Heroes may pick any skill list')}
      ${bool('showRarity','Show item rarity on cards')}
    </fieldset>
    <fieldset class="hr-fs"><legend>Discipline / limits</legend>
      ${bool('eqLimitOn','Enforce the equipment list (standard \u2014 untick only as a house rule to allow anything)')}
      ${bool('rangedCapOn','Limit ranged models')}
      ${num('rangedCap','↳ max ranged %',0,100,5,'% of warband (0 = pure melee)')}
      ${bool('rerollOne','Only one re-roll item / warband')}
    </fieldset>
   </div>
   <label class="hr-row no-print" style="grid-template-columns:96px 1fr;align-items:flex-start;margin-top:8px"><span class="hl">Notes (printed)</span><span class="hc" style="justify-content:stretch"><textarea rows="2" style="flex:1;width:100%" oninput="setHouseNotes(this.value)" placeholder="House-rule notes shown on the roster…">${(h.notes||'').replace(/</g,'&lt;')}</textarea></span></label></div></details>`;
  setHouseNotes(h.notes||'');
}
export function setName(u,v){ const m=S.models.find(x=>x.uid===u); m.name=v; renderSidebar(); }
export function setExp(u,v){ const m=S.models.find(x=>x.uid===u); m.exp=Math.max(0,Number(v)||0); renderSidebar(); document.getElementById('rating').textContent=totalRating();
  const xe=document.getElementById('xp-'+u); if(xe) xe.innerHTML=xpBar(m); }
export function setQty(u,v){ const m=S.models.find(x=>x.uid===u); const def=unitDef(m.uid_def);
  let q=Math.min(5,Math.max(1,Number(v)||1)); const umx=unitMax(def);
  if(umx!==null){ const others=S.models.filter(x=>x.uid_def===m.uid_def&&x.uid!==m.uid).reduce((s,x)=>s+(x.qty||1),0);
    q=Math.max(1,Math.min(q, umx-others)); }
  m.qty=q; render(); }
export function toggleEq(u,nm,on){ const m=S.models.find(x=>x.uid===u); if(on)m.eq[nm]=1; else delete m.eq[nm]; render(); }
export function setEqQty(u,nm,q){
  if(/^Dolch/i.test(nm)){ const _m=S.models.find(x=>x.uid===u); if(_m) _m._noDagger=(Number(q)||0)<=0; } const m=S.models.find(x=>x.uid===u); q=Math.max(0,Math.min(9,Number(q)||0));
  if(q<=0) delete m.eq[nm]; else m.eq[nm]=q; render(); }
export function addRare(u,de){ if(!de) return; const m=S.models.find(x=>x.uid===u); m.rare=m.rare||{};
  if(m.rare[de] && !isUpgrade(de)){ m.rare[de].q=(Number(m.rare[de].q)||1)+1; }
  else if(!m.rare[de]){ const o={q:1,paid:catalogDefaultPaid(CATALOG.find(x=>x.de===de))};
    if(isUpgrade(de)){ const t=upgradeTargets(m,de); o.on=t.length?t[0].nm:null; o.paid=upgradePaid(m,de,o.on); }
    m.rare[de]=o; }
  render(); }
export function setRareTarget(u,de,nm){ const m=S.models.find(x=>x.uid===u); if(!m.rare||!m.rare[de]) return;
  m.rare[de].on=nm; if(UPGRADES[de]&&UPGRADES[de].mult) m.rare[de].paid=upgradePaid(m,de,nm); render(); }
export function setRareQty(u,de,q){ const m=S.models.find(x=>x.uid===u); if(!m.rare||!m.rare[de]) return;
  q=Math.max(0,Math.min(9,Number(q)||0)); if(q<=0) delete m.rare[de]; else m.rare[de].q=q; render(); }
export function setRarePaid(u,de,v){ const m=S.models.find(x=>x.uid===u); if(!m.rare||!m.rare[de]) return;
  m.rare[de].paid=Math.max(0,Number(v)||0); render(); }
export function removeRare(u,de){ const m=S.models.find(x=>x.uid===u); if(m.rare) delete m.rare[de]; render(); }
export function toggleMut(u,nm,on){ const m=S.models.find(x=>x.uid===u);
  if(on){ if(!m.mut.includes(nm)) m.mut.push(nm);} else { m.mut=m.mut.filter(x=>x!==nm);} render(); }

/* ===================== SAVE / LOAD / EXPORT ===================== */
export async function saveRoster(){
  const name=document.getElementById('savename').value.trim()|| (S.name||'roster');
  const data={...S, name:S.name||name, _saved:name};
  try{
    await window.storage.set('mh:'+name, JSON.stringify(data), false);
    flash('Saved as "'+name+'".');
  }catch(e){ flash('Could not save – use Export instead.'); }
}
export async function openLoad(){
  const box=document.getElementById('loadlist');
  let keys=[];
  try{ const r=await window.storage.list('mh:',false); keys=(r&&r.keys)||[]; }catch(e){}
  if(!keys.length){ box.innerHTML='<div class="note">No saved rosters found. (Tip: Export/Import as a file works everywhere.)</div>'; }
  else{
    box.innerHTML='<b>Saved rosters:</b><div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">'+
      keys.map(k=>{const nm=k.replace(/^mh:/,'');
        return `<div style="display:flex;gap:8px;align-items:center">
          <button class="tiny" onclick="loadRoster('${nm.replace(/'/g,"\\'")}')">Load</button>
          <button class="tiny ghost" onclick="delRoster('${nm.replace(/'/g,"\\'")}')">×</button>
          <span>${nm}</span></div>`;}).join('')+'</div>';
  }
  box.style.display = box.style.display==='none'?'block':'none';
}
export async function loadRoster(nm){
  try{ const r=await window.storage.get('mh:'+nm,false); if(r){ applyState(JSON.parse(r.value));  } }
  catch(e){ flash('Could not load.'); }
}
export async function delRoster(nm){ try{ await window.storage.delete('mh:'+nm,false); openLoad(); openLoad(); }catch(e){} }
export function applyState(data){
  S={wb:data.wb,subtype:data.subtype,name:data.name||'',budget:data.budget||WARBANDS[data.wb].gold,models:data.models||[],hired:data.hired||[],dp:data.dp||[],leaderUid:data.leaderUid||null,campaign:data.campaign||{on:false,districts:{}},stash:data.stash||{wyrd:0,gold:null,items:[]}};
  S.house=Object.assign(houseDefaults(), data.house||{});
  S.mark=data.mark||'';
  if(!S.stash||typeof S.stash!=='object') S.stash={wyrd:0,gold:0,items:[]};
  if(!Array.isArray(S.stash.items)) S.stash.items=[];
  S.models.forEach(m=>{ if(!m.eq)m.eq={}; if(!m.mut)m.mut=[]; if(!m.adv)m.adv={}; if(!m.skills)m.skills=[]; if(!m.inj)m.inj=[]; if(!m.spells)m.spells=[]; });
  uid=Math.max(1,...S.models.map(m=>m.uid))+1;
  document.getElementById('picker-view').style.display='none';
  document.getElementById('builder-view').style.display='block';
  setupBuilder();
  document.getElementById('wbname').value=S.name;
  
  render(); window.scrollTo(0,0);
}
/* ===================== EXPORT / IMPORT ===================== */
/* Dateiname: <Warband-Name>_<Warband-Typ[_Subtyp]> — z. B. Die_Eisernen_Mercenaries_Middenheim */
export function wbTypeSlug(){ const wb=WARBANDS[S.wb]; if(!wb) return '';
  const sub=(S.subtype&&wb.subtypes)?(wb.subtypes.find(x=>x.key===S.subtype)||{}).name:'';
  return (wb.name+(sub?' '+sub:'')).replace(/[^\w-]+/g,'_').replace(/^_+|_+$/g,''); }
export function safeName(){
  const given=(document.getElementById('savename')?.value||S.name||'').replace(/[^\w-]+/g,'_').replace(/^_+|_+$/g,'');
  const type=wbTypeSlug();
  const base=given||(type?'':'mordheim-roster');
  return [base,type].filter(Boolean).join('_')||'mordheim-roster'; }
export function rosterName(){ return (document.getElementById('savename')?.value||S.name||'roster'); }
export function dl(content,filename,mime){ const blob=new Blob([content],{type:mime}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); setTimeout(()=>{ try{document.body.removeChild(a); URL.revokeObjectURL(a.href);}catch(e){} },100); }
export function modelRating(m){ const def=unitDef(m.uid_def); return (def.large?20:5)+Number(m.exp||0); }
export function eqSummaryParts(m){
  const def=unitDef(m.uid_def); const out=[];
  if(def.gear) def.gear.forEach(g=>out.push(g));
  if(def.eq){ const list=eqListFor(def);
    for(const cat in list) for(const [nm,pr] of list[cat]){
      const qty=Number(m.eq[nm])||0; if(!qty) continue;
      out.push((qty>1?qty+'× ':'')+nm.replace(' (1. gratis)',''));
    } }
  return out;
}
// A brace of pistols is selected by buying a second single pistol (qty 2); it then displays as a "Brace".


export function eqDisplayParts(m){
  const def=unitDef(m.uid_def); const out=[];
  if(def.gear) def.gear.forEach(g=>out.push(g));
  if(def.eq){ const list=eqListFor(def);
    for(const cat in list) for(const [nm,pr] of list[cat]){
      if(BRACE_HIDE[nm]) continue;
      const qty=Number(m.eq[nm])||0; if(!qty) continue;
      const base=nm.replace(' (1. gratis)','');
      const _ups=m.rare?Object.keys(m.rare).filter(de=>inlineUpgradeActive(de)&&m.rare[de].on===nm):[];
      const _us=_ups.length?` [${_ups.map(de=>enItem(de)).join(', ')}]`:'';
      if(BRACE_PLURAL[base] && qty>=2){ out.push('Brace of '+BRACE_PLURAL[base]); if(qty>2) out.push((qty-2)+'× '+enItem(base)); }
      else out.push((qty>1?qty+'× ':'')+enItem(base)+_us);
    } }
  return out;
}

/* ---- schöner Text (BattleScribe-Stil) ---- */
export function buildText(){
  const wb=WARBANDS[S.wb];
  const spent=totalSpent(), rating=totalRating();
  const heroes=S.models.filter(m=>unitDef(m.uid_def).t==='hero');
  const hench=S.models.filter(m=>unitDef(m.uid_def).t==='hen');
  const sum=arr=>({gc:arr.reduce((s,m)=>s+modelTotalCost(m),0), r:arr.reduce((s,m)=>s+modelRating(m)*(unitDef(m.uid_def).t==='hen'?m.qty:1),0)});
  const hS=sum(heroes), nS=sum(hench);
  const det=m=>{ const def=unitDef(m.uid_def); const d=[];
    if(m.exp) d.push(`${m.exp}× Experience`);
    if(m.mut&&m.mut.length) d.push('Mutations: '+m.mut.map(mutEN).join(', '));
    if(Number(m.miss)>0) d.push(`OUT: misses next ${m.miss} game${m.miss>1?'s':''}`);
    const adv=m.adv||{}; const ord=["M","WS","BS","S","T","W","I","A","Ld"];
    const av=ord.filter(x=>adv[x]).map(x=>`+${adv[x]} ${x}`); if(av.length) d.push('Advances: '+av.join(', '));
    if(m.skills&&m.skills.length) d.push('Skills: '+m.skills.join(', '));
    if(m.inj&&m.inj.length) d.push('Injuries: '+m.inj.map(j=>INJEN[j.code]||j.name).join(', '));
    const wbx=WBEXTRA[S.wb];
    const lore=casterLore(m);
    if(lore){ const sp=(m.spells||[]); if(sp.length) d.push('Spells ('+SPELLS[lore].name+'): '+sp.map(s=>{const dd=spellEffDiff(s);return spellLabel(s.name)+(dd!=null?' ('+dd+')':'');}).join(', ')); else d.push('Magic: '+SPELLS[lore].name); }
    const eq=eqDisplayParts(m); if(eq.length) d.push('Equipment: '+eq.join(', '));
    return d.length?': '+d.join(', '):''; };
  const L=[];
  L.push(`${wb.name} - ${rosterName()} - [${rating} Warband Rating, ${spent} gc]`);
  L.push(`# ++ Warband ++ [${rating} Warband Rating, ${spent} gc]`);
  L.push(`## Heroes [${hS.r} Warband Rating, ${hS.gc} gc]`);
  heroes.forEach(m=>{ const def=unitDef(m.uid_def);
    const nm=(m.name&&m.name!==def.name)?`${def.name} „${m.name}“`:def.name;
    L.push(`${nm} [${modelUnitCost(m)} gc, ${modelRating(m)} Warband Rating]${det(m)}`); });
  L.push(`## Henchmen [${nS.r} Warband Rating, ${nS.gc} gc]`);
  hench.forEach(m=>{ const def=unitDef(m.uid_def);
    const nm=(m.name&&m.name!==def.name)?`${def.name} „${m.name}“`:def.name;
    L.push(`${nm} [${modelTotalCost(m)} gc, ${modelRating(m)*m.qty} Warband Rating]:`);
    L.push(`• ${m.qty}× ${def.name} [${modelUnitCost(m)} gc, ${modelRating(m)} Warband Rating]${det(m)}`); });
  const st=S.stash||{wyrd:0,gold:0,items:[]};
  if((st.wyrd||0)||(st.gold||0)||(st.items&&st.items.length)){
    L.push(`## Stash / Store`);
    if(st.wyrd) L.push(`• Wyrdstone shards: ${st.wyrd}`);
    if(st.gold) L.push(`• Gold in store: ${st.gold} gc`);
    (st.items||[]).forEach(it=>L.push(`• ${it.qty}× ${it.name}`));
  }
  L.push('');
  L.push('— — — — — — — — — — — — — — — — — — — —');
  L.push('MORDHEIM-DATA: '+JSON.stringify(S));
  return L.join('\n');
}

/* ---- Newrecruit / BattleScribe rosterSchema (Best-Effort) ---- */


const NR_MODEL="e1beaa44-e54d-dd6b-d1f2-446b333c9bb9";
export function rid(){const h=()=>Math.floor(Math.random()*65536).toString(16).padStart(4,'0');return `${h()}-${h()}-${h()}-${h()}`;}
export function nrProfile(def){ const p=def.profile; if(!p) return [];
  const ord=["M","WS","BS","S","T","W","I","A","Ld"];
  return [{characteristics:ord.map(k=>({"$text":String(p[k]),name:k==='Ld'?'LD':k,typeId:NR_T[k]})),id:rid(),name:def.name,hidden:false,typeId:NR_MODEL,typeName:"Model",from:"entry"}];
}
export function nrInner(m){ const def=unitDef(m.uid_def); const cat=def.t==='hero'?NR_CAT.hero:NR_CAT.hen; const sels=[];
  if(m.exp) sels.push({costs:[{name:" Warband Rating",typeId:"wb-rating",value:Number(m.exp)}],id:rid(),name:"Experience",number:Number(m.exp),type:"upgrade",from:"entry"});
  if(def.eq){const list=eqListFor(def);for(const c in list)for(const [nm,pr] of list[c]){const qty=Number(m.eq[nm])||0;if(!qty)continue;const price=nm.startsWith("Dolch")?Math.max(0,qty-1)*pr:qty*pr;sels.push({costs:[{name:" gc",typeId:"points",value:price}],id:rid(),name:enItem(nm),number:qty,type:"upgrade",from:"entry"});}}
  if(m.mut&&m.mut.length)m.mut.forEach(x=>sels.push({id:rid(),name:mutEN(x),number:1,type:"upgrade",from:"entry"}));
  if(m.rare)for(const de in m.rare){const e=m.rare[de];const q=Number(e.q)||1;const it=CATALOG.find(x=>x.de===de);sels.push({costs:[{name:" gc",typeId:"points",value:q*(Number(e.paid)||0)}],id:rid(),name:(it?it.en:de),number:q,type:"upgrade",from:"entry"});}
  return {profiles:nrProfile(def),selections:sels,costs:[{name:" gc",typeId:"points",value:modelUnitCost(m)},{name:" Warband Rating",typeId:"wb-rating",value:modelRating(m)}],categories:[{id:cat,entryId:cat,name:def.t==='hero'?"Heroes":"Henchmen",primary:true}],id:rid(),name:def.name,entryId:rid(),number:1,type:"model",from:"entry"};
}
export function nrSel(m){ const def=unitDef(m.uid_def); const inner=nrInner(m);
  if(def.t!=='hen') return inner;
  return {selections:[{...inner,number:m.qty}],costs:[{name:" gc",typeId:"points",value:modelTotalCost(m)},{name:" Warband Rating",typeId:"wb-rating",value:modelRating(m)*m.qty}],categories:[{id:NR_CAT.hen,entryId:NR_CAT.hen,name:"Henchmen",primary:true}],id:rid(),name:def.name,entryId:rid(),number:1,type:"unit",from:"entry"};
}
export function buildNR(){ const wb=WARBANDS[S.wb];
  const force={rules:[],selections:S.models.map(nrSel),categories:[
    {name:"Configuration",id:rid(),primary:false,entryId:NR_CAT.cfg},
    {name:"Heroes",id:rid(),primary:false,entryId:NR_CAT.hero},
    {name:"Henchmen",id:rid(),primary:false,entryId:NR_CAT.hen},
    {name:"Stash",id:rid(),primary:false,entryId:NR_CAT.stash}],
    id:rid(),name:"Warband",entryId:rid(),catalogueId:rid(),catalogueRevision:1,catalogueName:wb.name};
  return {roster:{costs:[{name:" gc",typeId:"points",value:totalSpent()},{name:" Warband Rating",typeId:"wb-rating",value:totalRating()}],
    costLimits:[{name:" gc",typeId:"points",value:S.budget}],forces:[force],id:rid(),name:rosterName(),
    battleScribeVersion:2.03,generatedBy:"Mordheim Roster Builder",
    gameSystemId:"9481a749-7900-614b-1695-bdc2899069c1",gameSystemName:"Mordheim",gameSystemRevision:18,
    xmlns:"http://www.battlescribe.net/schema/rosterSchema"}};
}

/* ---- export chooser modal ---- */
/* ===================== TABLETOP-SIMULATOR-EXPORT (pro Einheit) ===================== */

export function enItem(name){ let n=String(name).replace(' (1. gratis)','').trim();
  if(EQEN[n]) return EQEN[n];
  const base=n.replace(/\s*\(.*\)$/,'').trim(); if(EQEN[base]) return EQEN[base];
  const m=n.match(/^(.*?)\s*\(([^)]+)\)$/);
  if(m){ const a=m[1].trim(),b=m[2].trim(); const asA=/^[\x20-\x7E]+$/.test(a),asB=/^[\x20-\x7E]+$/.test(b);
    if(asA&&!asB) return a; if(asB&&!asA) return b; return a; }
  return n; }

export function abilityEN(nm){ const m=nm.match(/\(([^)]+)\)\s*$/); if(m) return m[1].trim(); return ABILEN[nm]||nm; }

// German rule-name -> English (for the leading name of each sp clause)

// common German description fragments -> English (literal replacement, longest first)

const _TERMS=[].concat(Object.entries(NAMEEN),TERMEN,[
  ['zählt als 2 Modelle','counts as 2 models'],['Nur Hellebarde','Only a halberd'],
  ['keine Erfahrung','gains no experience'],['Keine Ausrüstung','No equipment'],
  ['Keine Waffen/Rüstung','No weapons/armour'],['zählt als','counts as'],['Modelle','models']
]).sort((a,b)=>b[0].length-a[0].length);
export function translateTerms(s){ for(const [de,en] of _TERMS){ if(s.indexOf(de)>=0) s=s.split(de).join(en); } return s; }
export function ruleNameEN(name){ if(NAMEEN[name]) return NAMEEN[name]; const gi=abilityInfo(name); if(gi) return abilityEN(gi.name); return translateTerms(name); }
export function enRules(sp){
  if(!sp) return [];
  sp=String(sp).replace(/<br\s*\/?>/gi,' ').replace(/<\/?[a-z][^>]*>/gi,'').replace(/\s{2,}/g,' ').trim();
  const clauses=sp.split(/\.\s+(?=[A-ZÄÖÜ„])/).map(c=>c.replace(/\.\s*$/,'').trim()).filter(Boolean);
  return clauses.map(c=>{ const ci=c.indexOf(':');
    if(ci>=0){ const name=c.slice(0,ci).trim(), desc=c.slice(ci+1).trim(); return `${ruleNameEN(name)}: ${translateTerms(desc)}`; }
    return translateTerms(c); });
}



export function closeTts(){ document.getElementById('ttsmodal').style.display='none'; }
export function copyTts(){ const ta=document.getElementById('ttstext'); const txt=ta.value;
  const ok=()=>flash('TTS description copied.');
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(ok,()=>{try{ta.select();document.execCommand('copy');ok();}catch(e){}}); }
  else { try{ta.select();document.execCommand('copy');ok();}catch(e){} } }
export function openExport(){ if(!S.models.length){ flash('No warriors in the warband yet.'); return; }
  document.getElementById('extextwrap').style.display='none';
  document.getElementById('exportmodal').style.display='flex'; }
export function closeExport(){ document.getElementById('exportmodal').style.display='none'; }
export function exportTool(){ dl(JSON.stringify(S,null,2),safeName()+'.json','application/json'); closeExport(); }
export function exportNR(){ dl(JSON.stringify(buildNR(),null,2),safeName()+'_newrecruit.json','application/json'); closeExport(); }
export function exportText(){ const t=buildText(); document.getElementById('extext').value=t; document.getElementById('extextwrap').style.display='block'; }
export function downloadText(){ dl(buildText(),safeName()+'.txt','text/plain;charset=utf-8'); }
export function copyExport(){ const ta=document.getElementById('extext'); ta.select(); ta.setSelectionRange(0,99999);
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(ta.value).then(()=>flash('Text copied.'),()=>flash('Selected — please copy manually.')); }
  else { try{ document.execCommand('copy'); flash('Text copied.'); }catch(e){ flash('Selected — please copy manually.'); } } }

export function openImport(){ const ta=document.getElementById('pastebox'); if(ta) ta.value=''; document.getElementById('importmodal').style.display='flex'; }
export function closeImport(){ document.getElementById('importmodal').style.display='none'; }
export function importText(str){
  str=String(str||'').trim();
  if(!str){ flash('Nothing to import — paste a Tool-file JSON or the readable-text export.'); return; }
  let data=null;
  const mk=str.match(/MORDHEIM-DATA:\s*(\{[\s\S]*\})\s*$/);   // readable-text export with embedded data
  if(mk){ try{ data=JSON.parse(mk[1]); }catch(e){} }
  if(!data){ const a=str.indexOf('{'), b=str.lastIndexOf('}');   // raw Tool-file JSON
    if(a>=0&&b>a){ try{ data=JSON.parse(str.slice(a,b+1)); }catch(e){} } }
  if(!data){ flash('Could not read the text. Paste either a Tool-file (JSON) export or the full readable-text export.'); return; }
  if(data.roster&&data.roster.forces){ flash('Newrecruit/BattleScribe format is not supported here.'); return; }
  if(!data.wb||!WARBANDS[data.wb]){ flash('Unknown format or unknown warband.'); return; }
  applyState(data); closeImport(); flash('Imported.');
}
export function importJSON(ev){
  const f=ev.target.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=()=>{ importText(rd.result); };
  rd.readAsText(f); ev.target.value='';
}
export function flash(msg){
  const d=document.createElement('div'); d.textContent=msg;
  d.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--iron);color:var(--parch);padding:10px 18px;border:1px solid var(--gold);border-radius:4px;z-index:99;box-shadow:0 6px 20px rgba(0,0,0,.5)';
  document.body.appendChild(d); setTimeout(()=>d.remove(),2600);
}

/* ===================== ITEM-TOOLTIP ===================== */
export let itipPinned=false;
export function spellInfo(nm){ const lbl=spellLabel(nm); for(const k in SPELLS){ for(const s of SPELLS[k].spells){ if(String(s[0])[0]==='▸') continue; if(spellLabel(s[0])===lbl) return {name:lbl,line:'Spell · '+SPELLS[k].name,text:s[1]}; } } return null; }
export function skillInfo(nm){ const lists=[]; for(const k in SKILLLISTS) lists.push(SKILLLISTS[k]); for(const k in SKILLSETS) lists.push(SKILLSETS[k]);
  for(const L of lists){ const e=(L.skills||[]).find(x=>x[0]===nm); if(e) return {name:e[0],line:'Skill · '+L.name,text:e[1]}; } return null; }
export function itipBuild(nm){
  const i=itemInfo(nm)||abilityInfo(nm)||spellInfo(nm)||skillInfo(nm); if(!i) return null;
  return `<div class="itip-h">${i.name||nm}</div>`+
         (i.line?`<div class="itip-l">${i.line}</div>`:'')+
         `<div class="itip-b">${i.text}</div>`;
}
export function showItipHTML(el,html,pin,maxW){
  const t=document.getElementById('itip'); if(!t||!html) return;
  t.innerHTML=html; t.style.display='block';
  const r=el.getBoundingClientRect();
  const tw=Math.min(maxW||280, window.innerWidth-16);
  t.style.maxWidth=tw+'px';
  let left=r.left, top=r.bottom+6;
  if(left+tw>window.innerWidth-8) left=window.innerWidth-8-tw;
  if(left<8) left=8;
  if(top+t.offsetHeight>window.innerHeight-8) top=Math.max(8, r.top-t.offsetHeight-6);
  t.style.left=left+'px'; t.style.top=top+'px';
  if(pin) itipPinned=true;
}
export function showItip(el,nm,pin){ const html=itipBuild(nm); if(!html) return; showItipHTML(el,html,pin,280); }
export function hsdpPreview(e,key){ let stat=statTableHS(e);
  if(e.pair && e.profile2){ const p=e.profile2.p; const k=["M","WS","BS","S","T","W","I","A","Ld"];
    stat+=`<table class="stats"><tr><td class="rh">${e.profile2.name}</td>${k.map(x=>`<td>${p[x]!==undefined?p[x]:'\u2014'}</td>`).join('')}</table>`; }
  let hireStr;
  if(e.hire>0){ const disc=(key&&typeof hireCostOf==='function')?Math.floor(e.hire*priceMod('hire',key)):e.hire;
    hireStr=disc<e.hire?`Hire <s>${e.hire}</s> <b>${disc}</b> Gc <span class="itip-camp">(campaign)</span>`:`Hire ${e.hire} gc`; }
  else hireStr='Hire: special';
  const cost=hireStr+(e.upkeep>0?` \u00b7 Upkeep ${e.upkeep} gc`:'')+` \u00b7 Rating +${e.rating}`;
  return `<div class="itip-h">${e.name} <span class="hs-badge">${e.grade}</span></div>${stat}<div class="itip-eq"><b>Equipment:</b> ${e.eq||'\u2014'}</div><div class="itip-cost">${cost}</div>`; }
export function showPreview(el,key,pin){ const e=HIREDSWORDS[key]||DRAMATIS[key]; if(!e) return; showItipHTML(el,hsdpPreview(e,key),pin,340); }
export function toggleItipPreview(ev,el,key){ ev.stopPropagation(); ev.preventDefault(); const t=document.getElementById('itip');
  if(itipPinned && t && t.style.display==='block'){ itipPinned=false; hideItip(true); } else { showPreview(el,key,true); } }
export function hideItip(force){ if(itipPinned && !force) return; const t=document.getElementById('itip'); if(t) t.style.display='none'; }
export function toggleItip(ev,el,nm){
  ev.stopPropagation(); ev.preventDefault();
  const t=document.getElementById('itip');
  if(itipPinned && t && t.style.display==='block'){ itipPinned=false; hideItip(true); }
  else { showItip(el,nm,true); }
}
document.addEventListener('click',()=>{ if(itipPinned){ itipPinned=false; hideItip(true); } });
window.addEventListener('scroll',()=>{ if(!itipPinned) hideItip(); }, true);

/* ===================== INIT ===================== */
renderPicker();
try{ if(typeof openLoad==='function') openLoad(); }catch(e){}


/* ============================================================================
   OFFIZIELLES ROSTER-SHEET (freebooters.org v1.6) — echtes PDF-Overlay.
   Das Original-PDF hat keine Formularfelder; die Werte werden per pdf-lib an
   vermessenen Koordinaten aufgedruckt. HS/DP kommen auf ein eigenes Zusatzblatt
   (die 6 Heldenfelder sind für die max. 6 Helden reserviert).
   ========================================================================== */

export function raceEN(k){ return k?(RACE_EN[k]||k):''; }











/* Sheet-Template: modular per fetch, im Single-File-Build als Base64-Konstante. */
export let _sheetBytes=null;

/* ---- Globale Bindung ----
   Das Markup nutzt onclick="…"; im Modul-Scope sind Funktionen nicht global.
   Liste wird beim Split automatisch erzeugt. */
Object.assign(window, {
  HR, _modelHasRanged, _stripParen, _svCombine, aDisp, abilityEN,
  abilityInfo, abilitySection, activeDistrictEffects, addAdv, addHsAdv, addHsSkill,
  addHsSpell, addHsSpellFromAdv, addInj, addRare, addSkill, addSkillFromSel,
  addSpell, addSpellFromAdv, addUnit, adjGoldCurrent, adjPrice, advSection,
  applyFreeDaggers, applyState, attachedBlocks, attachedSection, availHeroCats, backToPicker,
  buildNR, buildText, campDistricts, campShowJSON, campShowText, campToggle,
  campaignJSON, campaignTextReport, canAdv, canBeLeader, casterLore, casterMagic,
  catLabel, catalogDefaultPaid, catalogEligible, chooseWb, closeCampaignIO, closeExport,
  closeImport, closeTts, copyCampaign, copyExport, copyTts, countOf,
  daggerNameFor, defaultLeaderUid, defaultWarbandName, delHsSkill, delHsSpell, delRoster,
  dispMod, districtState, dl, downloadCampaignJSON, downloadCampaignText, downloadText,
  dpCount, dpEligibility, dpGradeAllowed, dpHireCost, dpHireTotal, dpList,
  dpRatingTotal, dpRosterCards, dpSetName, dpUpkeepTotal, effProfile, enItem,
  enRules, ensureFreeDagger, entryOf, eqCost, eqDisplayParts, eqListFor,
  eqSection, eqSummaryParts, eqWeaponLimit, eqWeaponsOf, exportCampaign, exportNR,
  exportOfficialSheet, exportText, exportTool, fixedSkills, flash, formatRules,
  goldAvailable, goldCurrent, goldTreasury, heirloomDiscount, heroEqList, hideItip,
  hireCostOf, hireDP, hireDiscounted, hireEligibility, hireHS, houseActive,
  houseDefaults, houseDeviations, houseSummary, hrChk, hrIsDefault, hsAbilitySection,
  hsAdvSection, hsAdvancesDue, hsCanAdv, hsChosenEq, hsCount, hsEffProfile,
  hsEqCost, hsEqParts, hsEqSection, hsEqTotal, hsEquipOn, hsExp,
  hsExpSection, hsGradeAllowed, hsGradeIdx, hsHireCost, hsHireRuleAllows, hsHireTotal,
  hsList, hsOptSection, hsOptSet, hsPersona, hsPersonasAllowed, hsRaceMax,
  hsRatingTotal, hsRec, hsRecOf, hsRosterCards, hsRuleLines, hsSetName,
  hsSizeBonus, hsSkillCats, hsSkillDatalist, hsSkillOptions, hsSkillSelect, hsSpecialSkills,
  hsSpecialText, hsSpellRed, hsSpellSection, hsSpells, hsUpkeepFor, hsUpkeepTotal,
  hsdpPreview, importCampaign, importCampaignFile, importCampaignText, importJSON, importText,
  incExp, injModText, injMods, injSection, inlineUpgradeActive, isHeroModel,
  isLeaderModel, isMarauderChief, isMarauderSeer, isUpgrade, itemFamily, itemHalfActive,
  itemInfo, itipBuild, leaderRuleText, leaderSection, leaderUid, loadRoster,
  magicOfModel, marauderMarkSection, marauderStartSpells, markLore, markName, markRulesFor,
  maxInfo, missAdj, modelRating, modelTotalCost, modelUnitCost, modelsOf,
  mutCost, mutEN, mutKindFor, netMod, noteLines, nrInner,
  nrProfile, nrSel, openCampaignIO, openExport, openImport, openLoad,
  passNameFilter, passStatFilter, pickSub, priceMod, promoteHench, promotedSkillLists,
  raceEN, rangedModelCount, rareCost, rareEligibleItems, remAdv, remHsAdv,
  remHsSkillIdx, remInj, remSkill, remSpell2, removeRare, removeUnit,
  render, renderAddMenu, renderCampaign, renderDramatis, renderExtra, renderHiredSwords,
  renderHouse, renderPicker, renderRoster, renderSidebar, renderStash, rerollItemCount,
  resetHouse, rid, rosterName, ruleNameEN, ruleSplitBold, safeName,
  saveRoster, setAdvOpen, setCaster, setDistrict, setDpFilter, setDpGrade,
  setEqQty, setExp, setExpJump, setGoldCurrent, setHeirloom, setHouseActive,
  setHouseBool, setHouseNotes, setHouseNum, setHouseStr, setHsAdvOpen, setHsEq,
  setHsExp, setHsFilter, setHsGrade, setHsSpOpen, setInjOpen, setLeader,
  setLore, setMark, setName, setQty, setRarePaid, setRareQty,
  setRareTarget, setSpellOpen, setupBuilder, showItip, showItipHTML, showPreview,
  skillChipRow, skillChipsIn, skillInfo, skillListsFor, skillNameList, skillOptions,
  skillOptionsFor, skillText, spellBase, spellChipRow, spellEffDiff, spellEffect,
  spellInfo, spellLabel, spellPicker, spellRed, spellSection, spellSectionRaw,
  spellStartCount, startGold, stashAddItem, stashAdj, stashItemQty, stashRemItem,
  stashSet, statBarHS, statFilterBar, statNum, statTable, statTableHS,
  statTableM, svFromText, svLabel, svOfEntry, svOfModel, toggleEq,
  toggleItip, toggleItipPreview, toggleMut, togglePromoCat, toggleWeaponUpgrade, totalHeroes,
  totalModels, totalRating, totalSpent, translateTerms, ttsOpen, ttsOpenDP,
  ttsOpenHS, ttsText, ttsTextHS, unhireDP, unhireHS, unitBaseCost,
  unitDef, unitFamilies, unitMax, unpromote, upgradePaid, upgradeTargets,
  vehRules, vehRulesBlock, warbandMax, wbTypeSlug, weaponUpgradesFor, xpBar,
  xpThresholds,
});
Object.defineProperty(window,'S',{ get:()=>S, set:v=>{S=v;}, configurable:true });
