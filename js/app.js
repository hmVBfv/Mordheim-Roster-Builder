/* Mordheim Roster Builder — Anwendungslogik.
   Daten liegen in ../data/*.js. build.js fügt alles wieder zu EINER HTML
   zusammen (Offline-/Single-File-Variante). */
import { ABILEN, ABILITYINFO, ARMOUR_SV, BLESSINGS, BRACE_HIDE, BRACE_PLURAL, CATALOG, DISTRICTS, DP_GRADE_ORDER, DRAMATIS, EQEN, GSN_BRACE, HIREDSWORDS, HR_LABELS, HS_GRADE_ORDER, INJEN, INJURIES, ITEMINFO, LISTS, MARAUDER_MARKS, MARK_RULES, MAXPROF, MOUNTS, MUTATIONS, MUTEN, MUTLABEL, MUTSETS, NAMEEN, PENDING_1A, RACELABEL, RACE_EN, SHEET, SKILLLISTS, SKILLSETS, SPELLS, STATKEYS, STD_CATS, SV_SKILL_BASE, SV_SKILL_BONUS, TERMEN, UNITRACE, UPGRADES, WARBANDS, WBEXTRA, WBHIRE, WBRACE, _ALLCC, _CCFAM, _FAM } from '../data/index.js';
import { exportOfficialSheet, defaultWarbandName } from './pdf.js';
import { ttsOpen, ttsOpenMember, ttsOpenHS, ttsOpenDP, ttsText, ttsTextHS } from './tts.js';
/* Engine (pure rules & cost calc — see js/engine.js). Imported here so the
   render/action code below can call it, and re-exported so the window bindings
   at the bottom still expose these to inline onclick handlers. */
import { adjPrice, applyFreeDaggers, catalogDefaultPaid, countOf, daggerNameFor, dpHireCost, ensureFreeDagger, eqCost, eqListFor, eqWeaponLimit, eqWeaponsOf, goldAvailable, goldCurrent, goldTreasury, heirloomDiscount, hireCostOf, hsHireCost, inlineUpgradeActive, isHeroModel, isUpgrade, henchRecruitCost, henchRecruitSurcharge, lossValueOf, modelRating, modelTotalCost, modelMarketValue, marketRarePrice, eqMarketValue, isTwoHanded, _loadoutValue, modelUnitCost, modelsOf, mutCost, mutKindFor, rareCost, rareEligibleItems, startGold, totalHeroes, totalLarge, totalModels, totalSpent, unitBaseCost, unitDef, unitMax, upgradePaid, upgradeTargets, warbandMax, weaponUpgradesFor, statNum, svFromText, _svCombine, svOfModel, svOfEntry, svLabel, _stripParen } from './engine.js';
export { adjPrice, applyFreeDaggers, catalogDefaultPaid, countOf, daggerNameFor, dpHireCost, ensureFreeDagger, eqCost, eqListFor, eqWeaponLimit, eqWeaponsOf, goldAvailable, goldCurrent, goldTreasury, heirloomDiscount, hireCostOf, hsHireCost, inlineUpgradeActive, isHeroModel, isUpgrade, henchRecruitCost, henchRecruitSurcharge, lossValueOf, modelRating, modelTotalCost, modelUnitCost, modelsOf, mutCost, mutKindFor, rareCost, rareEligibleItems, startGold, totalHeroes, totalLarge, totalModels, totalSpent, unitBaseCost, unitDef, unitMax, upgradePaid, upgradeTargets, warbandMax, weaponUpgradesFor, statNum, svFromText, _svCombine, svOfModel, svOfEntry, svLabel, _stripParen };
/* Info/tooltip lookups (name -> tooltip content + HTML — see js/info.js). */
import { itemInfo, abilityInfo, spellInfo, skillInfo, itipBuild } from './info.js';
export { itemInfo, abilityInfo, spellInfo, skillInfo, itipBuild };

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
  host.innerHTML=`<details class="sec-details" ${hsOpen?'open':''} ontoggle="setSecOpen('hs',this.open)"><summary class="sec-sum">Hired Swords${hsList().length?' <span class="hr-on">'+hsList().length+'</span>':''}</summary><div class="sec-body"><div class="hs-head">${gradeSel}</div>${statFilterBar('hs',hsFilter,'setHsFilter')}
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
/* ---- keyword scanning must respect negation ----
   The ability scanner looks for rule keywords in a unit's free rules text.
   Plain substring matching claims the opposite of what the text says whenever
   a rule is DENIED: the Ogre Maneaters' Half-grown "is NOT a Large Target",
   the Orc Nuttaz "does not suffer Animosity", Aksho'akhash "is NOT immune to
   psychology". So the text is cut into clauses and a keyword only counts if
   at least one clause mentioning it does not negate it.
   Clause boundaries are sentence enders, dashes and contrast conjunctions —
   the dash matters: "Not truly alive - immune to psychology" would otherwise
   let the first half suppress a rule the model genuinely has.
   Only "not"/"n't" count as negation, deliberately: "never gains experience
   (animal)" still makes it an Animal, and "immune to X" is a rule ABOUT X
   worth showing, not a denial that X applies. */
export function abilityMentioned(re, text){
  const cl=String(text||'').replace(/<[^>]*>/g,' ')
    .replace(/([.;:!?])\s+/g,'$1\u0001').replace(/\s+[-\u2013\u2014]\s+/g,'\u0001')
    .replace(/\s+(?:but|however|although|though|whereas|while|except)\s+/gi,'\u0001')
    .split('\u0001');
  for(const c of cl){ const i=c.search(re); if(i<0) continue;
    if(!/\b(?:not|n't)\b/i.test(c.slice(0,i))) return true; }
  return false;   // absent, or mentioned only where it is denied
}
export function hsAbilitySection(hs,rec){
  const pers=(rec&&hs.personas&&typeof hsPersona==='function')?hsPersona(rec,hs):null;
  const sp=[(pers&&pers.sp)||'',hs.sp||''].filter(Boolean).join(' ');
  let found=[]; const seen=new Set();
  for(const [re,info] of ABILITYINFO){ if(abilityMentioned(re,sp) && !seen.has(info.name)){ seen.add(info.name); found.push(info); } }
  if(found.some(f=>f.name==='Fearless')) found=found.filter(f=>f.name!=='Fear'&&f.name!=='Terror');
  // "not a wizard" is handled by abilityMentioned now. This one stays: being
  // immune to Fear is not a denial that the word appears, it is a different
  // rule — and a model that only RESISTS fear does not CAUSE it.
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
        <div class="subtotal">${hs.hire} gc</div>
      </div></div>`;
  }).join('');
}
export function hsSetName(uid,v){ const h=hsList().find(x=>x.uid===uid); if(h){ h.name=v; } }




/* ===================== STATE (see js/state.js) ===================== */
import { S, uid, nextUid, resyncUid, replaceState, houseDefaults, HR, houseActive, setHouseNum, setHouseBool, setHouseStr, setHouseNotes, resetHouse } from './state.js';
export { S, uid, nextUid, resyncUid, replaceState, houseDefaults, HR, houseActive, setHouseNum, setHouseBool, setHouseStr, setHouseNotes, resetHouse };



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
        <div class="subtotal">${dp.hire>0?dp.hire+' gc':'\u2014'}</div>
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
  host.innerHTML=`<details class="sec-details" ${dpOpen?'open':''} ontoggle="setSecOpen('dp',this.open)"><summary class="sec-sum">Dramatis Personae${dpList().length?' <span class="hr-on">'+dpList().length+'</span>':''}</summary><div class="sec-body"><div class="hs-head">${gradeSel}</div>${statFilterBar('dp',dpFilter,'setDpFilter')}
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
/* ---- Campaign chronicle ----
   S.campaign.round   0 = Setup, 1 = after the 1st battle, 2 = after the 2nd, …
   S.campaign.log[]   {id, round, type, text, auto, data}
                      auto:true  = recorded by the tool as it happened
                      auto:false = written or corrected by hand
   S.campaign.battles[] {id, round, opponents:[{name,wb}], district, outcome, notes}
   Events are stamped with the round that is current when they happen, so the
   chronicle can be replayed in order later. */
export function campState(){ if(!S.campaign) S.campaign={on:false,districts:{}};
  if(!S.campaign.districts) S.campaign.districts={};
  if(S.campaign.round==null) S.campaign.round=0;
  if(!Array.isArray(S.campaign.log)) S.campaign.log=[];
  if(!Array.isArray(S.campaign.battles)) S.campaign.battles=[];
  if(!Array.isArray(S.campaign.casualties)) S.campaign.casualties=[];
  return S.campaign; }
export function campRound(){ return campState().round; }
export function roundLabel(n){ n=Number(n)||0; return n===0?'Setup':`After battle ${n}`; }
let _logSeq=0;
export function nextLogId(){ const c=campState(); const mx=c.log.reduce((m,e)=>Math.max(m,Number(e.id)||0),0);
  const bx=c.battles.reduce((m,e)=>Math.max(m,Number(e.id)||0),0); _logSeq=Math.max(_logSeq,mx,bx)+1; return _logSeq; }
/* Record an event. Only while the campaign is switched on — otherwise plain
   roster editing would fill the chronicle with noise. */
export function logEvent(type,text,data){ const c=campState(); if(!c.on) return null;
  const e={id:nextLogId(), round:c.round, type:String(type), text:String(text), auto:true};
  if(data) e.data=data;
  c.log.push(e); return e; }
export function addLogNote(text,round){ const c=campState();
  const e={id:nextLogId(), round:(round==null?c.round:Number(round)||0), type:'note', text:String(text||''), auto:false};
  c.log.push(e); render(); return e; }
export function editLogText(id,text){ const c=campState(); const e=c.log.find(x=>x.id===Number(id));
  if(e){ e.text=String(text||''); e.edited=true; } }
export function removeLogAt(id){ const c=campState(); const i=c.log.findIndex(x=>x.id===Number(id));
  if(i<0) return;
  if(typeof confirm==='function' && !confirm('Delete this chronicle entry? This cannot be undone.')) return;
  c.log.splice(i,1); render(); }
export function setRound(n){ const c=campState(); const v=Math.max(0,Number(n)||0);
  if(v===c.round) return; c.round=v; render(); }
/* Snapshot every warrior at the close of a stage: the cheapest way to get
   experience curves and warband worth over the campaign without logging every
   single point change. */
export function snapshotStage(round){ const c=campState();
  if(!c.snapshots||typeof c.snapshots!=='object') c.snapshots={};
  // The whole warband state, exactly as an export would hold it - anything the
  // analysis might later want is in there without having to guess in advance.
  //
  // With one cut: the campaign RECORDS (log, battles, casualties, experience
  // ledger and the snapshots themselves) are left out. They live centrally and
  // only once; including them would nest every earlier snapshot inside each new
  // one and double the file with every stage. The districts stay, so who held
  // what at a given stage is preserved.
  const st=JSON.parse(JSON.stringify(S));
  st.campaign={on:!!c.on, round:Number(round)||0,
    districts:JSON.parse(JSON.stringify(c.districts||{}))};
  _stripTransient(st);
  c.snapshots[String(round)]={
    round:Number(round)||0,
    at:(new Date()).toISOString().slice(0,10),
    state:st,
    // Computed values are stored as they stood, not recomputed later: if the
    // data files change (an FAQ re-costs a unit), recomputing would silently
    // rewrite history.
    totals:{ rating:totalRating(), spent:totalSpent(), models:totalModels(),
      heroes:totalHeroes(), gold:goldCurrent(), fallen:(S.fallen||[]).length }
  };
  return c.snapshots[String(round)]; }
/* Working state of the interface (open panels, half-filled forms) has no place
   in a historical record. */
function _stripTransient(o){ if(!o||typeof o!=='object') return o;
  if(Array.isArray(o)){ o.forEach(_stripTransient); return o; }
  Object.keys(o).forEach(k=>{ if(k.charAt(0)==='_') delete o[k]; else _stripTransient(o[k]); });
  return o; }
/* One row per warrior of a snapshot, living and fallen alike. Reads both the
   current full-state snapshots and the earlier flat ones, so older campaign
   files keep working. */
export function snapRows(snapshot){ if(!snapshot) return [];
  if(Array.isArray(snapshot)) return snapshot;            // the earlier format
  const st=snapshot.state||{};
  const row=(m,alive)=>({uid:m.uid, uid_def:m.uid_def,
    name:m.name||((unitDef(m.uid_def)||{}).name)||'?',
    grade:(m.promoted||((unitDef(m.uid_def)||{}).t==='hero'))?'hero':'hench',
    qty:Number(m.qty)||1, exp:Number(m.exp)||0,
    adv:Object.assign({},m.adv||{}), skills:[...(m.skills||[])],
    spells:(m.spells||[]).map(x=>x.name||x), inj:(m.inj||[]).map(j=>j.name||j.code),
    eq:Object.assign({},m.eq||{}), rare:Object.keys(m.rare||{}),
    names:(m.names||[]).slice(),        // who exactly was in the group at the time
    alive});
  const rows=(st.models||[]).map(m=>row(m,true));
  (st.fallen||[]).forEach(e=>{ if(e&&e.m) rows.push(row(e.m,false)); });
  return rows; }
/* What changed between two stages. This is where the analysis comes from: a
   warrior present at one stage and dead at the next fell in that battle; whose
   characteristic is higher gained it then. Nothing needs to have been logged
   semantically at the time. */
export function diffStages(a,b){ const snaps=stageSnapshots();
  const A=snapRows(snaps[String(a)]), B=snapRows(snaps[String(b)]);
  const byUid=list=>{ const m={}; list.forEach(x=>m[x.uid]=x); return m; };
  const ma=byUid(A), mb=byUid(B);
  const out={from:Number(a), to:Number(b), joined:[], died:[], left:[], changed:[]};
  B.forEach(x=>{ const prev=ma[x.uid];
    if(!prev){ out.joined.push({uid:x.uid,name:x.name,grade:x.grade}); return; }
    if(prev.alive && !x.alive) out.died.push({uid:x.uid,name:x.name,grade:x.grade});
    const ch={uid:x.uid,name:x.name}; let any=false;
    if(x.exp!==prev.exp){ ch.exp={from:prev.exp,to:x.exp,gained:x.exp-prev.exp}; any=true; }
    const stats={}; Object.keys(Object.assign({},prev.adv,x.adv)).forEach(k=>{
      const d=(Number(x.adv[k])||0)-(Number(prev.adv[k])||0); if(d) stats[k]=d; });
    if(Object.keys(stats).length){ ch.stats=stats; any=true; }
    const newSk=(x.skills||[]).filter(v=>!(prev.skills||[]).includes(v));
    if(newSk.length){ ch.skills=newSk; any=true; }
    const newSp=(x.spells||[]).filter(v=>!(prev.spells||[]).includes(v));
    if(newSp.length){ ch.spells=newSp; any=true; }
    const newInj=(x.inj||[]).filter(v=>!(prev.inj||[]).includes(v));
    if(newInj.length){ ch.injuries=newInj; any=true; }
    const newEq=Object.keys(x.eq||{}).filter(k=>(Number(x.eq[k])||0)>(Number((prev.eq||{})[k])||0));
    if(newEq.length){ ch.equipment=newEq; any=true; }
    const newRare=(x.rare||[]).filter(v=>!(prev.rare||[]).includes(v));
    if(newRare.length){ ch.rare=newRare; any=true; }
    if(x.qty!==prev.qty){ ch.qty={from:prev.qty,to:x.qty}; any=true; }
    if(any) out.changed.push(ch);
  });
  A.forEach(x=>{ if(!mb[x.uid]) out.left.push({uid:x.uid,name:x.name}); });
  return out; }
/* Who was there from the very beginning. */
export function foundingMembers(){ return snapRows(stageSnapshots()['0'])
  .map(x=>({uid:x.uid,name:x.name,grade:x.grade})); }
/* Which districts the warband held at a given stage. */
export function districtsAt(round){ const sn=stageSnapshots()[String(round)];
  const d=(sn&&sn.state&&sn.state.campaign&&sn.state.campaign.districts)||{};
  return Object.keys(d).filter(k=>d[k]&&d[k]!=='none').map(k=>({id:k, name:districtName(k), state:d[k]})); }
/* The stored totals of a stage (rating, gold, size) as they stood then. */
export function totalsAt(round){ const sn=stageSnapshots()[String(round)];
  return (sn&&sn.totals)||null; }
export function stageSnapshots(){ const c=campState();
  if(!c.snapshots||typeof c.snapshots!=='object') c.snapshots={}; return c.snapshots; }
/* Warriors who sat this battle out - an Old Battle Wound, a Hired Sword whose
   upkeep went unpaid, and so on. Recorded before the stage closes, because it
   belongs to the battle that was just fought, and the count is then served:
   "misses the next game" means exactly one game. Nothing happens when Setup
   closes, since no battle was played. */
export function recordSitOuts(round){ const c=campState(); if(!c.on) return [];
  if((Number(round)||0)<1) return [];
  const out=[];
  S.models.forEach(m=>{ const n=Number(m.miss)||0; if(n<=0) return;
    const who=m.name||unitDef(m.uid_def).name;
    // the reason is whatever put him out - a lasting injury from the list, or
    // the temporary one that only costs a game
    const why=m.missWhy||(m.inj||[]).map(j=>j.name||j.code).filter(x=>/old battle wound/i.test(x))[0];
    logEventAt(round,'missed',`${who} sat out the battle${why?` (${why})`:''}.`,
      {uid:m.uid,name:who,uid_def:m.uid_def,remaining:n-1});
    m.miss=n-1; if(m.miss<=0) delete m.missWhy;
    out.push({uid:m.uid,name:who});
  });
  return out; }
export function advanceRound(){ const c=campState(); recordSitOuts(c.round); snapshotStage(c.round); c.round=(Number(c.round)||0)+1;
  logEvent('round',`Campaign moved to “${roundLabel(c.round)}”.`); render(); }
/* ---- Battles ----
   A battle may involve more than one opponent, so `opponents` is a list of
   {name, wb}. `district` is a Mordheim map location, `outcome` the result, and
   `notes` the player's own account of how it went — the raw material for the
   campaign narrative later on. */
export function addBattle(b){ const c=campState(); b=b||{};
  const bat={id:nextLogId(), round:(b.round==null?c.round:Number(b.round)||0),
    // every participant with the outcome from their own point of view; the
    // opponents list is kept alongside it so anything reading the older shape
    // still works
    sides:Array.isArray(b.sides)?b.sides.filter(x=>x&&(x.name||x.wb)):[],
    opponents:Array.isArray(b.opponents)?b.opponents.filter(o=>o&&(o.name||o.wb)):[],
    district:b.district||'', outcome:b.outcome||'', notes:b.notes||''};
  c.battles.push(bat);
  const who=bat.opponents.length?bat.opponents.map(o=>o.name||wbName(o.wb)).join(', '):'an unnamed foe';
  logEventAt(bat.round,'battle',`Battle ${bat.round}: fought ${who}${bat.district?` at ${districtName(bat.district)}`:''}${bat.outcome?` — ${bat.outcome}`:''}.`,{battleId:bat.id});
  render(); return bat; }
export function editBattle(id,patch){ const c=campState(); const b=c.battles.find(x=>x.id===Number(id));
  if(!b||!patch) return; Object.assign(b,patch); render(); }
export function removeBattle(id){ const c=campState(); const i=c.battles.findIndex(x=>x.id===Number(id));
  if(i<0) return;
  if(typeof confirm==='function' && !confirm('Delete this battle record? This cannot be undone.')) return;
  const bid=c.battles[i].id; c.battles.splice(i,1);
  c.log=c.log.filter(e=>!(e.data&&e.data.battleId===bid));
  render(); }
/* Like logEvent, but stamped with a given round (a battle records itself under
   the round it belongs to, which may be ahead of the current one). */
export function logEventAt(round,type,text,data){ const c=campState(); if(!c.on) return null;
  const e={id:nextLogId(), round:Number(round)||0, type:String(type), text:String(text), auto:true};
  if(data) e.data=data; c.log.push(e); return e; }
export function districtName(id){ const d=DISTRICTS.find(x=>x.id===id); return d?d.name:(id||''); }
export function wbName(key){ return (WARBANDS[key]&&WARBANDS[key].name)||key||'unknown warband'; }
export function districtState(id){ return campDistricts()[id]||'none'; }
/* ---- Footholds and control ----
   Winning a battle at a location gives that warband a foothold there. Control
   is not something a warband is given: a warband controls a location when it is
   the ONLY one in the campaign holding a foothold there. That makes control a
   derived fact about the whole campaign, not a value one warband can set for
   itself - which is why it can only be answered when the campaign file is open
   and every warband's claims are known.

   A warband on its own still stores 'control' if it was set by hand; that is
   left alone as a manual override so nothing that already exists breaks. */
export function cfFootholdsAt(districtId){ const cf=cfGet(); const out=[];
  const mineName=(S.name||wbName(S.wb));
  const isMine=w=>(w.name||'').toLowerCase()===mineName.toLowerCase() && w.wb===S.wb;
  // Our own warband counts too, and its live state is newer than whatever copy
  // of it the campaign file holds - so take the live one and skip the copy.
  const own=(campDistricts()||{})[districtId];
  if(own==='foothold'||own==='control') out.push({id:null, name:mineName, wb:S.wb, mine:true});
  if(cf) cf.warbands.forEach(w=>{ if(isMine(w)) return;
    const d=((w.roster||{}).campaign||{}).districts||{};
    if(d[districtId]==='foothold'||d[districtId]==='control') out.push({id:w.id,name:w.name,wb:w.wb}); });
  return out; }
/* Who controls a location, if anybody: exactly one holder and no other. */
export function cfControlAt(districtId){ const held=cfFootholdsAt(districtId);
  return held.length===1? held[0] : null; }
/* Every contested and controlled location in the campaign. */
export function cfTerritory(){ const cf=cfGet(); if(!cf) return [];
  const ids=new Set();
  Object.keys(campDistricts()||{}).forEach(k=>{ const v=campDistricts()[k]; if(v&&v!=='none') ids.add(k); });
  cf.warbands.forEach(w=>{ const d=((w.roster||{}).campaign||{}).districts||{};
    Object.keys(d).forEach(k=>{ if(d[k]&&d[k]!=='none') ids.add(k); }); });
  return [...ids].map(id=>{ const held=cfFootholdsAt(id);
    return {id, name:districtName(id), holders:held, control: held.length===1?held[0]:null}; })
    .sort((a,b)=>a.name.localeCompare(b.name)); }
/* What our own warband holds, with control worked out from the campaign file
   when one is open. */
export function districtStatus(id){ const raw=(campDistricts()||{})[id]||'none';
  if(raw==='none') return 'none';
  const cf=cfGet(); if(!cf) return raw;                 // no campaign to compare against
  const ctl=cfControlAt(id);
  return (ctl && ctl.mine)? 'control' : 'foothold'; }
/* Winning a battle in a district gains a foothold there; the defeated warband
   loses its foothold if it had one. Control is not stored - it follows from
   being the only warband with a foothold, so taking one away can hand control
   to whoever is left. */
export function claimFoothold(districtId){ if(!districtId) return null;
  const d=campDistricts();
  if(d[districtId]!=='foothold' && d[districtId]!=='control'){ d[districtId]='foothold';
    logEvent('district',`Gained a foothold at ${districtName(districtId)}.`,{district:districtId}); }
  return d[districtId]; }
export function loseFoothold(districtId){ if(!districtId) return null;
  const d=campDistricts();
  if(d[districtId]&&d[districtId]!=='none'){ d[districtId]='none';
    logEvent('district',`Lost the foothold at ${districtName(districtId)}.`,{district:districtId}); }
  return 'none'; }
/* The same for another warband held in the campaign file. Their roster there is
   the campaign master's copy, which is what the shared document is for. */
export function cfSetFoothold(cfId,districtId,val){ const cf=cfGet(); if(!cf||!districtId) return;
  const w=cf.warbands.find(x=>x.id===Number(cfId)); if(!w||!w.roster) return;
  w.roster.campaign=w.roster.campaign||{}; w.roster.campaign.districts=w.roster.campaign.districts||{};
  if(val==='none') delete w.roster.campaign.districts[districtId];
  else w.roster.campaign.districts[districtId]=val; }
/* Apply one battle's outcomes to the map, for every side at once. */
export function applyBattleTerritory(sides,districtId){ if(!districtId||!Array.isArray(sides)) return;
  sides.forEach((x,i)=>{
    const won=/victor/i.test(x.outcome||''), lost=/defeat|routed/i.test(x.outcome||'');
    if(!won && !lost) return;
    if(x.key==='me'){ won?claimFoothold(districtId):loseFoothold(districtId); }
    else if(x.key && String(x.key).startsWith('cf')){
      cfSetFoothold(String(x.key).slice(2), districtId, won?'foothold':'none'); }
  }); }
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
export function hireDiscounted(key){ const anyTab=HIREDSWORDS[key]||DRAMATIS[key]; return anyTab && priceMod('hire',key)<1; }

/* ============================================================================
   POST-BATTLE SEQUENCE (mordheimer.net/docs/tools, /docs/campaigns/income)
   A guided checklist, not a dice roller: it lays out the rulebook's steps in
   their fixed order, explains each one in full, and links to the relevant chart
   on Mordheimer. You roll your own dice at the table and tick each step off; the
   next only unlocks once the one before it is done, so the order cannot be
   skipped. The one helper kept is the wyrdstone calculator, which only reads a
   price from a table - it rolls nothing. Progress is kept per round in
   S.campaign.postbattle and rides along in the save.
   ========================================================================== */
/* Deep links straight to the relevant section on Mordheimer. The tools page is
   the post-battle sequence itself with a numbered anchor per step; injuries and
   the exploration locations (the doubles/triples chart) live on their own pages
   and are linked there. Anchors verified against the live pages. */
export const PB_LINK={
  injuries:'https://mordheimer.net/docs/campaigns#serious-injuries',
  experience:'https://mordheimer.net/docs/tools#2-allocate-experience',
  exploration:'https://mordheimer.net/docs/campaigns/income#exploration-chart',
  wyrdstone:'https://mordheimer.net/docs/tools#4-sell-wyrdstone',
  veterans:'https://mordheimer.net/docs/tools#5-check-available-veterans',
  rare:'https://mordheimer.net/docs/tools#6-make-rarity-rolls-and-buy-rare-items',
  dramatis:'https://mordheimer.net/docs/tools#7-look-for-dramatis-personae',
  recruits:'https://mordheimer.net/docs/tools#8-hire-new-recruits--buy-common-items',
  equipment:'https://mordheimer.net/docs/tools#9-reallocate-equipment',
};
/* [key, title, url]. The body is built in the panel so it can weave in live
   numbers (who searches, how many dice, what is in the stash). */
export const PB_STEPS=[
  ['injuries','Injuries',PB_LINK.injuries],
  ['experience','Experience',PB_LINK.experience],
  ['exploration','Exploration',PB_LINK.exploration],
  ['wyrdstone','Sell wyrdstone',PB_LINK.wyrdstone],
  ['veterans','Available veterans',PB_LINK.veterans],
  ['rare','Rare items',PB_LINK.rare],
  ['dramatis','Dramatis Personae',PB_LINK.dramatis],
  ['recruits','Recruits & common items',PB_LINK.recruits],
  ['equipment','Reallocate equipment',PB_LINK.equipment],
];
export const PB_ORDER=PB_STEPS.map(s=>s[0]);
/* The round the sequence belongs to: the latest battle's round, else the
   current stage. A battle bumps the round on save, so this is normally "now". */
export function pbRound(){ const c=campState();
  const rs=(c.battles||[]).map(b=>Number(b.round)||0); const latest=rs.length?Math.max(...rs):0;
  return Math.max(latest, Number(c.round)||0); }
export function postbattleAll(){ const c=campState(); if(!c.postbattle) c.postbattle={}; return c.postbattle; }
export function postbattleState(round){ const all=postbattleAll(); const r=(round==null?pbRound():round);
  if(!all[r]) all[r]={done:{}, wyrd:null};
  const s=all[r]; if(!s.done) s.done={}; return s; }
export function pbStepDone(step,round){ return !!postbattleState(round).done[step]; }
/* How far the sequence has got: the number of steps completed from the top
   without a gap. This is what gates the rest. */
export function pbActiveStep(round){ const d=postbattleState(round).done;
  let i=0; while(i<PB_ORDER.length && d[PB_ORDER[i]]) i++; return i; }
/* Ticking a step is only allowed when every step before it is done, and a step
   can only be un-ticked when nothing after it is done - so the order holds in
   both directions and steps cannot be skipped. */
export function pbSetStepDone(step,on,round){ const st=postbattleState(round); const d=st.done;
  const idx=PB_ORDER.indexOf(step); if(idx<0) return;
  if(on){ for(let k=0;k<idx;k++){ if(!d[PB_ORDER[k]]) return; } d[step]=true; }
  else  { for(let k=idx+1;k<PB_ORDER.length;k++){ if(d[PB_ORDER[k]]) return; } delete d[step]; }
  render(); }
/* Did our warband win a battle this round? Reads the side marked key==='me',
   falling back to a legacy single outcome. */
export function pbWonThisRound(round){ const c=campState(); const r=(round==null?pbRound():round);
  return (c.battles||[]).filter(b=>Number(b.round)===r).some(b=>{
    if(Array.isArray(b.sides)&&b.sides.length){ const me=b.sides.find(s=>s.key==='me'); if(me) return /victor/i.test(me.outcome||''); }
    return /victor/i.test(b.outcome||''); }); }
/* Heroes taken out of action this round: anyone recorded as a casualty victim,
   whatever the injury result, does not search for wyrdstone. */
export function pbHeroesOOA(round){ const c=campState(); const r=(round==null?pbRound():round);
  const s=new Set(); (c.casualties||[]).forEach(x=>{ if(x.round===r && x.victim && x.victim.uid!=null) s.add(x.victim.uid); });
  return s; }
/* The Heroes who may search - those still standing who did not go out of action.
   Returned by name so the checklist can say exactly who rolls. */
export function pbSearchingHeroes(round){ const ooa=pbHeroesOOA(round);
  return S.models.filter(m=>isHeroModel(m) && !ooa.has(m.uid))
    .map(m=>m.name||unitDef(m.uid_def).name); }
/* How many Exploration dice the warband may roll: one per searching Hero, plus
   one if it won, capped at six (before any dice from skills or equipment, which
   the player adds themselves). Shown for reference only - nothing is rolled. */
export function pbExploreDice(round){ const survivors=pbSearchingHeroes(round).length;
  const winDie=pbWonThisRound(round)?1:0; const base=survivors+winDie;
  return {survivors, winDie, base, capped:Math.min(6,base)}; }
/* Selling wyrdstone (mordheimer, Income). The table gives the TOTAL gold for
   selling that many shards at once, not a price per shard: one shard fetches 45
   in a small warband, two together only 60, so a leader who can wait sells in
   small lots. It also falls as the warband grows, since more mouths eat the
   profit. Rows are shards sold (1..8, the last row covering 8 or more), columns
   are the warband's size. Values transcribed from mordheimer's table. */
export const WYRD_PRICE=[
  /*1*/ [45,40,35,30,30,25],
  /*2*/ [60,55,50,45,40,35],
  /*3*/ [75,70,65,60,55,50],
  /*4*/ [90,80,70,65,60,55],
  /*5*/ [110,100,90,80,70,65],
  /*6*/ [120,110,100,90,80,70],
  /*7*/ [145,130,120,110,100,90],
  /*8*/ [155,140,130,120,110,100],
];
export const WYRD_BANDS=[[3,'1\u20133'],[6,'4\u20136'],[9,'7\u20139'],[12,'10\u201312'],[15,'13\u201315'],[99,'16+']];
export function wyrdSizeBand(n){ n=Number(n)||0; for(let i=0;i<WYRD_BANDS.length;i++){ if(n<=WYRD_BANDS[i][0]) return i; } return WYRD_BANDS.length-1; }
/* How many models the warband fields - the figure the size bands are read from.
   Hired Swords count too; they are mouths to feed like any other. */
export function warbandSize(){ let n=(S.models||[]).reduce((s,m)=>{ const d=unitDef(m.uid_def); return s+((d&&d.t==='hen')?(Number(m.qty)||1):1); },0);
  n+=(S.hired||[]).length + (S.dp||[]).length; return n; }
export function wyrdPrice(shards, size){ shards=Math.max(1,Math.min(8,Number(shards)||1));
  const band=wyrdSizeBand(size==null?warbandSize():size); return WYRD_PRICE[shards-1][band]; }
/* Sell once per sequence: the gold goes to the treasury and the shards leave the
   stash. Recorded so it can be shown and taken back. */
export function pbSellWyrd(round, shards){ const st=postbattleState(round); if(st.wyrd&&st.wyrd.done) return;
  const have=Number((S.stash||{}).wyrd)||0; shards=Math.max(1,Math.min(have,Number(shards)||0));
  if(have<1||shards<1) return;
  const size=warbandSize(); const gc=wyrdPrice(shards,size);
  S.stash=S.stash||{wyrd:0,gold:null,items:[]};
  S.stash.gold=goldTreasury()+gc; S.stash.wyrd=have-shards;
  st.wyrd={done:true, shards, gc, size};
  logEvent('income',`Sold ${shards} wyrdstone shard${shards===1?'':'s'} for ${gc} gc.`,{round}); render(); }
export function pbClearWyrd(round){ const st=postbattleState(round); const w=st.wyrd; if(!w||!w.done) return;
  // give the gold back and return the shards, exactly as sold
  S.stash=S.stash||{wyrd:0,gold:null,items:[]};
  S.stash.gold=Math.max(0,goldTreasury()-(Number(w.gc)||0)); S.stash.wyrd=(Number(S.stash.wyrd)||0)+(Number(w.shards)||0);
  st.wyrd=null; render(); }
/* The Post-Battle Sequence panel. Each step is shown in order; the active one
   (the first not yet ticked) is open with its full explanation and a link to
   the chart on Mordheimer, the steps before it are collapsed with a tick, and
   the steps after it are locked until their turn. The wyrdstone step carries the
   sale calculator when it is active. */
export function pbStepBody(key, round){
  const c=campState();
  const link=(url,label)=>`<a class="pb-link" href="${url}" target="_blank" rel="noopener">${label||'Mordheimer chart'} \u2197</a>`;
  if(key==='injuries'){
    const unroll=(typeof unrolledCasualties==='function')?unrolledCasualties(round).length:0;
    return `<p>Test what became of every warrior taken out of action. <b>Heroes</b> roll on the Serious Injuries chart (D66). <b>Henchmen</b> roll a D6: <b>1\u20132</b> the man is dead, <b>3\u20136</b> he recovers. Resolve each one in the <b>Casualties</b> list below.</p>
      ${unroll?`<p class="pb-warn">${unroll} casualt${unroll===1?'y':'ies'} still to roll below.</p>`:`<p class="pb-note">No casualties left to roll.</p>`}
      <p>${link(PB_LINK.injuries,'Serious Injuries chart')}</p>`;
  }
  if(key==='experience'){
    const pend=(typeof unappliedXp==='function')?unappliedXp(round):0;
    return `<p>Award experience: <b>+1</b> to each Hero and to each surviving Henchman group, <b>+1</b> to the winning leader, and <b>+1</b> to a Hero for every enemy he put out of action. Some scenarios grant more \u2014 add that too.</p>
      <p>Set it on each warrior in the roster below, or let the tool apply the standard awards: <button class="tiny" onclick="applyBattleResults()">Apply battle results</button>${pend?` <span class="pb-note">${pend} point${pend===1?'':'s'} pending</span>`:''}</p>
      <p class="pb-note">Scenario experience is entered by hand on the roster \u2014 the roster is the one place experience lives.</p>
      <p>${link(PB_LINK.experience,'Allocate experience')}</p>`;
  }
  if(key==='exploration'){
    const d=pbExploreDice(round); const who=pbSearchingHeroes(round);
    return `<p>Roll <b>1D6</b> for each Hero <b>not</b> taken out of action${who.length?` (${who.map(n=>String(n).replace(/</g,'&lt;')).join(', ')})`:''}, <b>+1 die</b> if you won, plus any dice from skills or equipment. Keep at most <b>6</b>.</p>
      <p>That is <b>${d.capped}</b> dice from the roster (${d.survivors} searching Hero${d.survivors===1?'':'es'}${d.winDie?' + 1 for the win':''}${d.base>6?', capped at 6':''}) before any from skills.</p>
      <p>Total the dice and read the Exploration chart for the wyrdstone found; any <b>double, triple</b> or better reveals a special location.</p>
      <p>${link(PB_LINK.exploration,'Exploration chart (doubles &amp; locations)')}</p>`;
  }
  if(key==='wyrdstone'){
    const st=postbattleState(round); const shards=Number((S.stash||{}).wyrd)||0; const w=st.wyrd;
    const size=warbandSize(); const band=WYRD_BANDS[wyrdSizeBand(size)][1];
    let calc;
    if(w&&w.done){
      calc=`<p><span class="pb-ok">Sold ${w.shards} shard${w.shards===1?'':'s'} for ${w.gc} gc</span> (warband of ${w.size}). <button class="tiny ghost" onclick="pbClearWyrd(${round})">undo sale</button></p>
        <p class="pb-note">${shards} shard${shards===1?'':'s'} left in the stash.</p>`;
    } else if(shards<1){
      calc=`<p class="pb-note">No wyrdstone in the stash to sell.</p>`;
    } else {
      const sell=Math.max(1,Math.min(shards, Number(st._wyrdSell)||shards)); const gc=wyrdPrice(sell,size); const per=(gc/sell);
      calc=`<p>Stash: <b>${shards}</b> shard${shards===1?'':'s'} \u00b7 warband of <b>${size}</b> (band ${band}).</p>
        <p>Sell <input type="number" class="pb-sell" min="1" max="${shards}" value="${sell}" onchange="postbattleState(${round})._wyrdSell=this.value; render();" style="width:3.5em"> of them \u2192 <b>${gc} gc</b> <span class="pb-note">(${per%1?per.toFixed(1):per} each)</span>
          <button class="tiny" onclick="pbSellWyrd(${round}, postbattleState(${round})._wyrdSell||${shards})">Sell for ${gc} gc</button></p>`;
    }
    return `<p>Sell wyrdstone once per sequence. The price is a <b>total for the batch</b>, not a price per shard \u2014 smaller lots fetch more each, and a larger warband earns less. The gold goes straight to the treasury.</p>
      ${calc}
      <p>${link(PB_LINK.wyrdstone,'Wyrdstone pricing table')}</p>`;
  }
  if(key==='veterans'){
    return `<p>Roll <b>2D6</b>. You may hire new recruits whose <b>combined experience</b> does not exceed that total \u2014 seasoned warriors are only available when the roll is high.</p>
      <p>Hire them in step 8 below.</p>
      <p>${link(PB_LINK.veterans,'Check available veterans')}</p>`;
  }
  if(key==='rare'){
    return `<p>A Hero <b>not</b> taken out of action may look for a rare item: roll <b>2D6</b> against the item's Rarity. What you find can be bought and added per warrior in the <b>Rare / Trading Post</b> section.</p>
      <p>${link(PB_LINK.rare,'Rarity rolls &amp; rare items')}</p>`;
  }
  if(key==='dramatis'){
    return `<p>Look for a Dramatis Personae \u2014 a special character \u2014 if your warband may hire one and can afford it. Add them in the <b>Dramatis Personae</b> panel below.</p>
      <p>${link(PB_LINK.dramatis,'Look for Dramatis Personae')}</p>`;
  }
  if(key==='recruits'){
    return `<p>Hire new warriors (their combined experience within the veterans roll from step 5) and buy common equipment. New warriors join with their free dagger and may buy from their warband's common list.</p>
      <p>Recruit from the roster below.</p>
      <p>${link(PB_LINK.recruits,'Hire recruits &amp; buy common items')}</p>`;
  }
  if(key==='equipment'){
    return `<p>Move equipment freely between warriors as you wish. Newly hired warriors may take rare or magic items already held in the stash.</p>
      <p>${link(PB_LINK.equipment,'Reallocate equipment')}</p>`;
  }
  return '';
}
export function postbattleBlock(){
  const c=campState(); const round=pbRound();
  if(round<1 && !(c.battles||[]).length) return '';
  const st=postbattleState(round);
  const active=pbActiveStep(round);
  const total=PB_STEPS.length;
  const open=(c._pbOpen!==false);   // open by default while a sequence is unfinished
  const rows=PB_STEPS.map((step,i)=>{
    const [key,title,url]=step;
    const done=!!st.done[key];
    const isActive=(i===active);
    const locked=(i>active);
    const cls=done?'pb-step pb-done':(isActive?'pb-step pb-active':'pb-step pb-locked');
    const box=locked
      ? `<span class="pb-lock" title="Finish the step before this one first">\u2013</span>`
      : `<input type="checkbox" ${done?'checked':''} onchange="pbSetStepDone('${key}',this.checked,${round})">`;
    const head=`<label class="pb-check">${box}<span class="pb-num">${i+1}</span><b>${title}</b>${done?'<span class="pb-tick">done</span>':(locked?'<span class="pb-note pb-locknote">locked</span>':'')}</label>`;
    const body=(isActive)?`<div class="pb-body">${pbStepBody(key,round)}</div>`:'';
    return `<div class="${cls}">${head}${body}</div>`;
  }).join('');
  const pct=Math.round(active/total*100);
  return `<details class="pb-wrap" ${open?'open':''} ontoggle="campState()._pbOpen=this.open">
    <summary class="pb-sum"><span class="pb-sum-t">\u2694 Post-battle sequence</span>
      <span class="pb-prog"><span class="pb-bar"><span class="pb-bar-fill" style="width:${pct}%"></span></span><span class="pb-prog-n">${active}/${total}</span></span></summary>
    <div class="pb-intro">Work the steps in order \u2014 each unlocks the next. Roll your dice at the table; the tool explains each step and links to the chart.</div>
    ${rows}
    ${active>=total?'<div class="pb-complete">\u2713 Sequence complete \u2014 ready for the next battle.</div>':''}
  </details>`;
}
export function renderCampaign(){
  const host=document.getElementById('campaignpanel'); if(!host) return;
  if(!S.wb){ host.innerHTML=''; return; }
  const on=(S.campaign&&S.campaign.on);
  if(!on){ host.innerHTML=`<details class="sec-details" ${campOpen?'open':''} ontoggle="setSecOpen('camp',this.open)"><summary class="sec-sum">Campaign</summary><div class="sec-body"><label class="hs-gbox"><input type="checkbox" onchange="campToggle(this.checked)"> enable campaign layer</label>
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
  host.innerHTML=`<details class="sec-details" ${campOpen?'open':''} ontoggle="setSecOpen('camp',this.open)"><summary class="sec-sum">Campaign <span class="hr-on">on</span></summary><div class="sec-body"><label class="hs-gbox"><input type="checkbox" checked onchange="campToggle(this.checked)"> enabled</label>
    <div class="camp-io no-print"><button class="tiny" onclick="openCampaignIO()">\u2b06 Export</button> <button class="tiny" onclick="openCampaignIO()">\u2b07 Import</button></div>
    ${campaignFileBlock()}
    ${chronicleBlock()}
    ${postbattleBlock()}
    ${summary}
    <details class="loc-wrap"><summary class="loc-sum">Locations \u2014 districts you hold</summary>
    ${seg}
    </details>
    <div class="hs-foot">Control = you are the sole foothold holder (Hard Fought districts). Half-price always rounds down; rare items still need their availability roll.</div></details>`;
}
/* The chronicle: where the campaign stands, the battles fought, and the running
   log of what happened. Automatic entries are stamped as they occur; notes and
   corrections can be added by hand. */
export function chronicleBlock(){
  const c=campState();
  const rounds=[...new Set([0,c.round,...c.log.map(e=>e.round),...c.battles.map(b=>b.round)])]
    .map(Number).filter(n=>!isNaN(n)).sort((a,b)=>b-a);
  const roundOpts=Array.from({length:Math.max(c.round,...c.battles.map(b=>b.round),0)+2},(_,i)=>i)
    .map(n=>`<option value="${n}"${n===c.round?' selected':''}>${roundLabel(n)}</option>`).join('');
  const ICON={death:'\u2620',recruit:'+',item:'\u2696',advance:'\u2605',promote:'\u2605',battle:'\u2694',round:'\u25b6',note:'\u270e'};
  const body=rounds.map(r=>{
    const evs=c.log.filter(e=>e.round===r);
    const bats=c.battles.filter(b=>b.round===r);
    if(!evs.length && !bats.length && r!==c.round) return '';
    return `<div class="chr-round"><div class="chr-rhead">${roundLabel(r)}${r===c.round?' <span class="chr-now">current</span>':''}</div>
      ${bats.map(b=>{
        const who=(b.sides&&b.sides.length?b.sides.slice(1):(b.opponents||[]))
          .map(o=>`${(o.name||'').replace(/</g,'&lt;')}${o.wb?` <i>(${wbName(o.wb).replace(/</g,'&lt;')})</i>`:''}`).join(' &amp; ')||'unnamed foe';
        return `<div class="chr-bat">
        <div class="chr-batline">
          <span class="chr-battext"><b>\u2694 ${who}</b>${b.district?` \u2014 ${districtName(b.district).replace(/</g,'&lt;')}`:''}${b.outcome?` \u2014 <b>${String(b.outcome).replace(/</g,'&lt;')}</b>`:''}</span>
          <span class="chr-batbtns no-print">
            <button class="tiny" onclick="awardBattleXp(${b.id})" title="Award the post-battle experience for this game: +1 to everyone who survived, +1 to the leader if you won">+ post-battle XP</button>
            <button class="tiny" onclick="editBattleForm(${b.id})">edit</button>
            <button class="tiny ghost" onclick="removeBattle(${b.id})">remove</button>
          </span>
        </div>
        ${b.notes?`<div class="chr-notes">${String(b.notes).replace(/</g,'&lt;')}</div>`:''}</div>`; }).join('')}
      ${casListBlock(r)}
      ${evs.length?`<ul class="chr-list">${evs.map(e=>`<li class="chr-ev chr-${e.type}">
        <span class="chr-ic">${ICON[e.type]||'\u2022'}</span>
        <span class="chr-tx" contenteditable="true" onblur="editLogText(${e.id},this.textContent)">${String(e.text).replace(/</g,'&lt;')}</span>
        <span class="chr-tags">${e.auto?'':'<span class="chr-tag">manual</span>'}${e.edited?'<span class="chr-tag">edited</span>':''}</span>
        <button class="tiny ghost no-print" onclick="removeLogAt(${e.id})">\u00d7</button></li>`).join('')}</ul>`:'<div class="chr-empty">Nothing recorded yet.</div>'}
    </div>`;
  }).join('');
  return `<details class="chr-wrap" ${c._open?'open':''} ontoggle="setChrOpen(this.open)"><summary class="chr-sum">Chronicle \u2014 ${roundLabel(c.round)} \u00b7 ${c.battles.length} battle${c.battles.length===1?'':'s'} \u00b7 ${c.log.length} entries</summary>
    <div class="chr-tools no-print">
      <label>Stage: <select onchange="setRound(this.value)">${roundOpts}</select></label>
      <button class="tiny" onclick="advanceRound()" title="Move the campaign on to the next stage">\u25b6 next stage</button>
      <button class="tiny" onclick="openBattleForm()" title="Record a battle: opponents, where on the map, and how it ended">\u2694 record battle</button>
      <button class="tiny" onclick="openCasForm()" title="Record who was put out of action, and by whom">\u2620 casualty</button>
      <button class="tiny" onclick="openNoteForm()" title="Add your own entry to the chronicle">\u270e add note</button>
      <button class="tiny" onclick="exportNarrative()" title="A written account of the campaign, stage by stage \u2014 detailed enough to be written up as a story">chronicle text</button>
      <button class="tiny" onclick="exportAnalysis()" title="Figures per warrior and per stage, as JSON">analysis</button>
    </div>
    ${xpBarBlock()}
    ${battleFormBlock()}${casFormBlock()}${noteFormBlock()}
    ${body||'<div class="chr-empty">The chronicle is empty. Record a battle or add a note.</div>'}
  </details>`;
}
/* Warband picker options, grouped by grade and alphabetical within each group
   (leading articles ignored), matching the order of the warband picker.
   A <select> also gives type-ahead, so a warband can be found by typing. */
export function warbandOptions(sel){
  const groups=[['core','Core — official'],['1a','Grade 1a — official supplements'],
    ['1b','Grade 1b — official magazines'],['1c','Grade 1c — semi-official'],['2a','Grade 2a — fan-made, reliable']];
  const sortName=n=>String(n).replace(/^(the|der|die|das)\s+/i,'').toLowerCase();
  return `<option value="">— warband —</option>`+groups.map(([g,label])=>{
    const entries=Object.entries(WARBANDS).filter(([k,wb])=>(wb.grade||'core')===g)
      .sort((a,b)=>sortName(a[1].name).localeCompare(sortName(b[1].name)));
    if(!entries.length) return '';
    return `<optgroup label="${label}">`+entries.map(([k,wb])=>
      `<option value="${k}"${sel===k?' selected':''}>${wb.name.replace(/</g,'&lt;')}</option>`).join('')+`</optgroup>`;
  }).join('');
}
/* ---- Who fought, and who felled whom ----
   Participants come from the campaign file when one is open, so attacker and
   victim can be picked from real rosters instead of typed. The rosters there
   are the state as of the last import - which is the right state, since that is
   the warband that marched out. A warband not in the file can still be entered
   as free text and corrected later.

   Individual henchmen are listed by name, because that is the whole point of
   knowing who went down. */
export function battleSides(){ const cf=cfGet(); const out=[
  {key:'me', name:(S.name||wbName(S.wb)), wb:S.wb, mine:true}];
  if(cf) cf.warbands.forEach(w=>{
    // our own warband may also sit in the campaign file; do not offer it twice
    if((w.name||'').toLowerCase()===(S.name||'').toLowerCase() && w.wb===S.wb) return;
    out.push({key:'cf'+w.id, name:w.name, wb:w.wb, cfId:w.id}); });
  return out; }
/* Every model of one side that could put someone out of action or be put out,
   henchmen listed man by man. */
export function sideModels(key){
  let models=[], fallen=[];
  if(key==='me'){ models=S.models; fallen=S.fallen||[]; }
  else if(String(key).startsWith('cf')){ const cf=cfGet(); if(!cf) return [];
    const w=cf.warbands.find(x=>x.id===Number(String(key).slice(2)));
    if(!w||!w.roster) return []; models=w.roster.models||[]; fallen=w.roster.fallen||[]; }
  else return [];
  const wbKey=(key==='me')?S.wb:_sideWb(key);
  const defOf=m=>((WARBANDS[wbKey]||{}).units||[]).find(u=>u.id===m.uid_def)||{};
  const out=[];
  models.forEach(m=>{
    const def=defOf(m);
    const base=m.name||def.name||m.uid_def;
    const qty=Math.max(1,Number(m.qty)||1);
    const hero=!!(m.promoted||def.t==='hero');
    if(hero||qty===1){ out.push({uid:m.uid, idx:0, label:base, hero}); }
    else { for(let i=0;i<qty;i++){
      const nm=(m.names&&(m.names[i]||'').trim())||`${def.name||base} ${i+1}`;
      out.push({uid:m.uid, idx:i, label:nm, hero:false}); } }
  });
  // The fallen belong in this list too. Saying who killed a warrior is exactly
  // the moment he is no longer among the living, so leaving them out made the
  // attribution impossible for the deaths that matter most.
  fallen.forEach((e,i)=>{ if(!e||!e.m) return; const def=defOf(e.m);
    out.push({fallenIdx:i, uid:e.m.uid, idx:0, dead:true,
      label:(e.m.name||def.name||e.m.uid_def), hero:(e.kind==='hero')}); });
  return out; }
function _sideWb(key){ const cf=cfGet(); if(!cf) return S.wb;
  const w=cf.warbands.find(x=>x.id===Number(String(key).slice(2)));
  return w?w.wb:S.wb; }
export function sideName(key){ const s=battleSides().find(x=>x.key===key); return s?s.name:''; }
export function sideWb(key){ const s=battleSides().find(x=>x.key===key); return s?s.wb:''; }
/* ---- Battle entry form ----
   Held in S.campaign._draft while being filled in, so a half-typed battle
   survives the re-renders that every field change triggers. */
export function setChrOpen(v){ campState()._open=!!v; }
export function battleDraft(){ return campState()._draft||null; }
/* Load an existing battle back into the form. Its casualties are already
   recorded on their own, so the form edits the battle itself; casualties stay
   editable in the list below where the injury rolls are. */
export function editBattleForm(id){ const c=campState();
  const b=(c.battles||[]).find(x=>x.id===Number(id)); if(!b) return;
  c._draft={ editId:b.id, round:b.round, district:b.district||'', notes:b.notes||'',
    sides:(b.sides&&b.sides.length? b.sides.map(x=>({...x}))
      : [{key:'me', name:(S.name||wbName(S.wb)), wb:S.wb, outcome:b.outcome||''}]
        .concat((b.opponents||[]).map(o=>({key:'', name:o.name||'', wb:o.wb||'', outcome:''})))),
    cas:[] };
  // bring this battle's casualties back into the form, tied to their records so
  // editing corrects them instead of writing a second set
  const sideOf=(v)=>{ const i=c._draft.sides.findIndex(x=>
      (x.name||'').toLowerCase()===String(v.wb==='' && v.npc?'':(v.name||'')).toLowerCase());
    return i; };
  c._draft.cas=campCasualties().filter(x=>x.battleId===b.id).map(x=>{
    const findSide=(who)=>{ if(who && who.npc) return 'env';
      const i=c._draft.sides.findIndex(sd=>sd.key==='me'? who.uid!=null
        : (sd.name||'').toLowerCase()===String((who&&who.wbName)||'').toLowerCase());
      if(i>=0) return i;
      const j=c._draft.sides.findIndex(sd=>sd.wb===(who&&who.wb));
      return j>=0?j:0; };
    return {id:x.id, vSide:findSide(x.victim), vPick:'', vName:x.victim.name||'',
      aSide:findSide(x.attacker), aPick:'', aName:x.attacker.name||'', note:x.note||x.detail||''}; });
  c._open=true; render(); }
export function openBattleForm(){ const c=campState();
  // our own warband always fought; the others are added from the campaign file
  c._draft={ round:c.round, district:'', notes:'',
    sides:[{key:'me', name:(S.name||wbName(S.wb)), wb:S.wb, outcome:''}],
    cas:[] };
  c._open=true; render(); }
export function cancelBattleForm(){ const c=campState(); delete c._draft; render(); }
export function setDraftField(f,v){ const d=battleDraft(); if(!d) return; d[f]=v;
  if(f==='notes') return;                   // typing must not lose focus
  render(); }
/* --- participants --- */
export function addDraftSideMe(){ const d=battleDraft(); if(!d||draftIncludesUs(d)) return;
  d.sides.unshift({key:'me', name:(S.name||wbName(S.wb)), wb:S.wb, outcome:''}); render(); }
export function addDraftSide(key){ const d=battleDraft(); if(!d) return;
  if(!key){ d.sides.push({key:'', name:'', wb:'', outcome:''}); render(); return; }
  if(d.sides.some(x=>x.key===key)) return;
  const s0=battleSides().find(x=>x.key===key);
  d.sides.push({key, name:s0?s0.name:'', wb:s0?s0.wb:'', outcome:''});
  render(); }
export function remDraftSide(i){ const d=battleDraft(); if(!d) return;
  // Running the campaign does not mean fighting in every battle: our own
  // warband can be taken out, and the battle is then filed in the campaign
  // file rather than in our own chronicle.
  if(d.sides.length<=1) return;
  d.sides.splice(i,1);
  d.cas=d.cas.filter(c=>c.vSide!==i && c.aSide!==i)
    .map(c=>({...c, vSide:c.vSide>i?c.vSide-1:c.vSide, aSide:(typeof c.aSide==='number'&&c.aSide>i)?c.aSide-1:c.aSide}));
  render(); }
export function setDraftSide(i,f,v){ const d=battleDraft(); if(!d||!d.sides[i]) return;
  d.sides[i][f]=v;
  if(f==='key'){ const s0=battleSides().find(x=>x.key===v);
    if(s0){ d.sides[i].name=s0.name; d.sides[i].wb=s0.wb; } }
  if(f==='name') return;                     // free-text name, keep focus
  render(); }
/* --- casualties within the battle --- */
export function addDraftCas(){ const d=battleDraft(); if(!d) return;
  d.cas.push({vSide:d.sides.length>1?1:0, vPick:'', vName:'', aSide:0, aPick:'', aName:'', note:''});
  render(); }
export function remDraftCas(i){ const d=battleDraft(); if(!d) return; d.cas.splice(i,1); render(); }
export function setDraftCas(i,f,v){ const d=battleDraft(); if(!d||!d.cas[i]) return;
  d.cas[i][f]=(f==='vSide'||f==='aSide')&&v!=='env'?(v===''?'':Number(v)):v;
  if(f==='vName'||f==='aName'||f==='note') return;
  render(); }
/* Turn one row of the form into the side object a casualty record expects. */
function _casSide(d,sideIdx,pick,freeName){
  if(sideIdx==='env') return {uid:null, name:'The surroundings', wb:'', npc:true};
  const side=d.sides[sideIdx]; if(!side) return {uid:null, name:freeName||'', wb:''};
  if(pick){ const opts=sideModels(side.key);
    const hit=String(pick).charAt(0)==='f'
      ? opts.find(o=>o.dead && String(o.fallenIdx)===String(pick).slice(1))
      : (()=>{ const [uid,idx]=String(pick).split(':');
          return opts.find(o=>!o.dead && String(o.uid)===uid && String(o.idx)===idx); })();
    if(hit) return {uid: side.key==='me'?hit.uid:null, name:hit.label, wb:side.wb,
      grade:hit.hero?'hero':'hench', dead:!!hit.dead,
      memberIdx: hit.dead?undefined:hit.idx,
      fallenIdx: hit.dead?hit.fallenIdx:undefined}; }
  return {uid:null, name:freeName||side.name||'', wb:side.wb}; }
/* Whose battle is this? If our own warband is among the sides it belongs in our
   chronicle; if not, it is somebody else's battle that we are recording as the
   campaign's keeper, and it belongs in the campaign file. */
export function draftIncludesUs(d){ return (d.sides||[]).some(x=>x.key==='me'); }
function _ourSide(d){ return (d.sides||[]).find(x=>x.key==='me')||null; }
export function saveBattleForm(){ const d=battleDraft(); if(!d) return;
  const c=campState(); delete c._draft;
  if(!draftIncludesUs(d)){
    // a battle between other warbands, kept in the shared document
    const cf=cfGet()||cfNew('Campaign');
    cf.battles=cf.battles||[];
    const rec={id:(cf.battles.reduce((m,b)=>Math.max(m,Number(b.id)||0),0)+1),
      round:d.round, district:d.district||'', notes:d.notes||'',
      sides:d.sides.map(x=>({key:x.key,name:x.name,wb:x.wb,outcome:x.outcome})),
      opponents:d.sides.map(x=>({name:x.name,wb:x.wb})), outcome:''};
    if(d.editId!=null){ const i=cf.battles.findIndex(b=>b.id===d.editId);
      if(i>=0){ rec.id=d.editId; cf.battles[i]=rec; } else cf.battles.push(rec); }
    else cf.battles.push(rec);
    applyBattleTerritory(d.sides, d.district);
    render(); return;
  }
  if(d.editId!=null){
    const b=(c.battles||[]).find(x=>x.id===d.editId);
    if(b){ Object.assign(b, {round:d.round, district:d.district, notes:d.notes,
        sides:d.sides.map(x=>({key:x.key, name:x.name, wb:x.wb, outcome:x.outcome})),
        opponents:d.sides.filter(x=>x.key!=='me').map(x=>({name:x.name, wb:x.wb})),
        outcome:(_ourSide(d)||{}).outcome||''});
      const who=b.sides.slice(1).map(x=>x.name||wbName(x.wb)).join(', ')||'an unnamed foe';
      const ev=c.log.find(e=>e.data&&e.data.battleId===b.id);
      if(ev){ ev.text=`Battle ${b.round}: fought ${who}${b.district?` at ${districtName(b.district)}`:''}${b.outcome?` \u2014 ${b.outcome}`:''}.`; ev.edited=true; }
      applyBattleTerritory(b.sides, b.district);
      // reconcile the casualties: correct the ones that came from this battle,
      // add the new ones, and drop those taken out of the form
      const keep=new Set(d.cas.filter(r=>r.id!=null).map(r=>r.id));
      campCasualties().filter(x=>x.battleId===b.id && !keep.has(x.id))
        .forEach(x=>removeCasualty(x.id,true));
      d.cas.forEach(row=>{
        const victim=_casSide(d,row.vSide,row.vPick,row.vName);
        if(!victim.name) return;
        const attacker=_casSide(d,row.aSide,row.aPick,row.aName);
        if(row.id!=null){ const rec=campCasualties().find(x=>x.id===row.id);
          if(rec){ rec.victim=Object.assign({},rec.victim,victim); rec.attacker=attacker;
            rec.note=row.note||''; _retypeCasualty(rec); return; } }
        addCasualty({round:d.round, battleId:b.id, victim, attacker, note:row.note||'',
          result: victim.dead?'dead':'pending', noXp: row.aSide==='env'});
      });
    }
    render(); return;
  }
  const bat=addBattle({ round:d.round, district:d.district, notes:d.notes,
    sides:d.sides.map(x=>({key:x.key, name:x.name, wb:x.wb, outcome:x.outcome})),
    // kept so anything reading the older shape still works
    opponents:d.sides.filter(x=>x.key!=='me').map(x=>({name:x.name, wb:x.wb})),
    outcome:(_ourSide(d)||{}).outcome||'' });
  d.cas.forEach(row=>{
    const victim=_casSide(d,row.vSide,row.vPick,row.vName);
    if(!victim.name) return;
    const attacker=_casSide(d,row.aSide,row.aPick,row.aName);
    const rec=addCasualty({round:d.round, battleId:bat.id, victim, attacker, detail:row.note||'',
      // a warrior already in the Fallen list plainly did not survive it
      result: victim.dead?'dead':'pending',
      // the surroundings earn nobody experience
      noXp: row.aSide==='env'});
    if(rec && victim.dead && victim.fallenIdx!=null && d.sides[row.vSide] && d.sides[row.vSide].key==='me'){
      rec.fallenId=victim.fallenIdx;                       // ties it to the Fallen entry
      const fe=(S.fallen||[])[victim.fallenIdx];
      if(fe) fe.casualtyId=rec.id;                         // and back again
    }
  });
  // the map follows the outcome: winners gain a foothold, the defeated lose theirs
  applyBattleTerritory(d.sides, d.district);
  render();
  render(); }
export function battleFormBlock(){
  const d=battleDraft(); if(!d) return '';
  const dOpts=DISTRICTS.slice().sort((a,b)=>a.name.localeCompare(b.name))
    .map(x=>`<option value="${x.id}"${d.district===x.id?' selected':''}>${x.name.replace(/</g,'&lt;')}</option>`).join('');
  const OUTCOMES=['Victory','Defeat','Draw','Routed'];
  const oc=(v)=>`<option value=""> \u2014 </option>`+OUTCOMES.map(o=>`<option value="${o}"${v===o?' selected':''}>${o}</option>`).join('');
  const avail=battleSides().filter(x=>!d.sides.some(y=>y.key===x.key));
  const modelOpts=(sideIdx,pick)=>{
    if(sideIdx==='env') return '';
    const side=d.sides[sideIdx]; if(!side||!side.key) return '';
    const opts=sideModels(side.key);
    if(!opts.length) return '';
    return `<option value="">\u2014 name below \u2014</option>`+opts.map(o=>{
      const v=o.dead?`f${o.fallenIdx}`:`${o.uid}:${o.idx}`;
      return `<option value="${v}"${pick===v?' selected':''}>${o.label.replace(/</g,'&lt;')}${o.hero?' \u2605':''}${o.dead?' \u2620 (fallen)':''}</option>`;
    }).join(''); };
  const sideOpts=(sel,withEnv)=>d.sides.map((x,i)=>
      `<option value="${i}"${String(sel)===String(i)?' selected':''}>${(x.name||('Side '+(i+1))).replace(/</g,'&lt;')}</option>`).join('')
    +(withEnv?`<option value="env"${sel==='env'?' selected':''}>The surroundings</option>`:'');

  return `<div class="bat-form no-print">
    <div class="bat-fhead">${d.editId!=null?'Edit battle':'Record battle'} \u2014 ${roundLabel(d.round)}</div>

    <div class="bat-sec">Who fought</div>
    <div class="bat-sidegrid">
      <div class="bat-oh">Warband</div><div class="bat-oh">Type</div><div class="bat-oh">Outcome</div><div></div>
      ${d.sides.map((x,i)=>`
        ${x.key?`<div class="bat-sidename">${(x.name||'').replace(/</g,'&lt;')}${i===0?' <i>(yours)</i>':''}</div>`
              :`<input class="bat-in" value="${String(x.name||'').replace(/"/g,'&quot;')}" placeholder="warband name" oninput="setDraftSide(${i},'name',this.value)">`}
        ${x.key?`<div class="bat-sidewb">${wbName(x.wb).replace(/</g,'&lt;')}</div>`
              :`<select class="bat-in" onchange="setDraftSide(${i},'wb',this.value)">${warbandOptions(x.wb)}</select>`}
        <select class="bat-in" onchange="setDraftSide(${i},'outcome',this.value)">${oc(x.outcome)}</select>
        ${d.sides.length>1?`<button class="tiny ghost" onclick="remDraftSide(${i})" title="${x.key==='me'?'You did not fight in this battle':'Remove this warband'}">\u00d7</button>`:'<span></span>'}`).join('')}
    </div>
    <div class="bat-btns">
      ${avail.length?`<select class="bat-in" onchange="if(this.value)addDraftSide(this.value)">
        <option value="">+ add a warband from the campaign\u2026</option>
        ${avail.map(x=>`<option value="${x.key}">${x.name.replace(/</g,'&lt;')} (${wbName(x.wb).replace(/</g,'&lt;')})</option>`).join('')}
      </select>`:''}
      <button class="tiny" onclick="addDraftSide('')">+ someone not in the campaign</button>
    </div>

    <div class="bat-sec">Who was put out of action
      <span class="hs-foot">Leave the outcome open \u2014 the injury roll afterwards decides what became of them.</span></div>
    ${d.cas.length?`<div class="bat-casgrid">
      <div class="bat-oh">Went down</div><div class="bat-oh"></div><div class="bat-oh">By</div><div class="bat-oh"></div><div></div>
      ${d.cas.map((r,i)=>{
        const vOpts=modelOpts(r.vSide,r.vPick), aOpts=modelOpts(r.aSide,r.aPick);
        return `
        <select class="bat-in" onchange="setDraftCas(${i},'vSide',this.value)">${sideOpts(r.vSide,false)}</select>
        ${vOpts?`<select class="bat-in" onchange="setDraftCas(${i},'vPick',this.value)">${vOpts}</select>`
               :`<input class="bat-in" value="${String(r.vName||'').replace(/"/g,'&quot;')}" placeholder="who went down" oninput="setDraftCas(${i},'vName',this.value)">`}
        <select class="bat-in" onchange="setDraftCas(${i},'aSide',this.value)">${sideOpts(r.aSide,true)}</select>
        ${r.aSide==='env'
          ? `<input class="bat-in" value="${String(r.note||'').replace(/"/g,'&quot;')}" placeholder="a fall, a misfiring pistol\u2026" oninput="setDraftCas(${i},'note',this.value)">`
          : (aOpts?`<select class="bat-in" onchange="setDraftCas(${i},'aPick',this.value)">${aOpts}</select>`
                 :`<input class="bat-in" value="${String(r.aName||'').replace(/"/g,'&quot;')}" placeholder="who did it" oninput="setDraftCas(${i},'aName',this.value)">`)}
        <button class="tiny ghost" onclick="remDraftCas(${i})">\u00d7</button>`; }).join('')}
    </div>`:'<div class="chr-empty">Nobody down yet.</div>'}
    <button class="tiny" onclick="addDraftCas()">+ a warrior went down</button>

    <div class="bat-sec">Where and how it went</div>
    <div class="bat-row"><label>Location <select onchange="setDraftField('district',this.value)"><option value="">\u2014 anywhere \u2014</option>${dOpts}</select></label>
      <span class="hs-foot">Winning here gains you a foothold. You control a location when you are the only warband holding one there.</span></div>
    <label class="bat-notes">How did it go? <span class="hs-foot">Free text \u2014 this is what the campaign story is later written from.</span>
      <textarea rows="5" placeholder="The Skaven struck from the rooftops\u2026" oninput="setDraftField('notes',this.value)">${String(d.notes||'').replace(/</g,'&lt;')}</textarea></label>
    <div class="bat-btns"><button class="btnsm" onclick="saveBattleForm()">Save battle</button>
      <button class="tiny ghost" onclick="cancelBattleForm()">cancel</button></div>
  </div>`;
}
/* Large free-text entry for the chronicle, in the same style as the printed
   House-Rule notes rather than a one-line prompt. */
export function noteDraft(){ return campState()._note!=null?campState()._note:null; }
export function openNoteForm(){ const c=campState(); c._note=''; c._open=true; render(); }
export function setNoteDraft(v){ const c=campState(); c._note=v; }
export function cancelNoteForm(){ const c=campState(); delete c._note; render(); }
export function saveNoteForm(){ const c=campState(); const t=(c._note||'').trim();
  delete c._note; if(t) addLogNote(t); else render(); }
export function noteFormBlock(){ const n=noteDraft(); if(n==null) return '';
  return `<div class="bat-form no-print"><div class="bat-fhead">Chronicle entry — ${roundLabel(campRound())}</div>
    <textarea rows="4" placeholder="What happened…" oninput="setNoteDraft(this.value)">${String(n).replace(/</g,'&lt;')}</textarea>
    <div class="bat-btns"><button class="btnsm" onclick="saveNoteForm()">Add entry</button>
      <button class="tiny ghost" onclick="cancelNoteForm()">cancel</button></div></div>`; }
/* ---- Casualties: who took out whom ----
   A casualty has two stages, mirroring the rules. During the battle only two
   things are known: who went out of action, and who put them there. What
   becomes of them - dead, a lasting injury, or a full recovery - is decided by
   the injury roll in the post-battle sequence, so a record starts as 'pending'
   and is resolved afterwards.

   {id, round, battleId,
    victim:{uid?, name, wb},     uid is set when the victim is in THIS roster
    attacker:{uid?, name, wb},   uid is set when the killer is in THIS roster
    result:'pending'|'recovered'|'injured'|'dead', detail, fallenId}

   Because the victim carries a uid when they are ours, a record can be
   cross-referenced against the roster and the Fallen section. */
export function campCasualties(){ const c=campState();
  if(!Array.isArray(c.casualties)) c.casualties=[]; return c.casualties; }
export function casualtyText(r){
  const v=r.victim.name||'a warrior'; const a=r.attacker.name;
  const by=a?`${a}${r.attacker.wb?` (${wbName(r.attacker.wb)})`:''}`:'an unknown hand';
  const what={pending:'was put out of action',recovered:'recovered fully',injured:'was wounded',dead:'was slain'}[r.result]||'was put out of action';
  return `${v}${(r.victim.wb&&r.victim.uid==null)?` (${wbName(r.victim.wb)})`:''} ${what} by ${by}${r.detail?` \u2014 ${r.detail}`:''}.`; }
/* Fill in rank and gold worth for one side of a casualty. For our own models
   both are known from the roster; for an enemy they are whatever was entered. */
function _enrichSide(side){ if(side.uid!=null){ const m=S.models.find(x=>x.uid===side.uid);
    if(m){ side.grade=isHeroModel(m)?'hero':'hench'; if(side.value==null) side.value=modelUnitCost(m)||0;
      side.uid_def=m.uid_def; } }
  if(side.value!=null) side.value=Number(side.value)||0;
  return side; }
export function casualtyType(r){ return r.result==='dead'?'death':(r.result==='injured'?'injury':'casualty'); }
export function addCasualty(cas){ const c=campState(); const list=campCasualties(); cas=cas||{};
  const rec={id:nextLogId(), round:(cas.round==null?c.round:Number(cas.round)||0),
    battleId:cas.battleId||null,
    victim:_enrichSide(Object.assign({uid:null,name:'',wb:'',grade:'',value:null,memberIdx:null},cas.victim||{})),
    attacker:_enrichSide(Object.assign({uid:null,name:'',wb:'',grade:'',value:null},cas.attacker||{})),
    result:cas.result||'pending', detail:cas.detail||'', fallenId:null,
    note:String(cas.note||'')};
  list.push(rec);
  logEventAt(rec.round,casualtyType(rec),casualtyText(rec),{casualtyId:rec.id});
  // Only Heroes earn the +1 for putting an enemy out of action. Enemy NPCs
  // count when the scenario treats them as enemies (the Necromancer's Tower
  // counts its Zombies), which is why this is not restricted to player models.
  if(rec.attacker.uid!=null && rec.attacker.grade==='hero' && rec.victim.uid==null && !cas.noXp){
    const g=grantXp(rec.attacker.uid,1,`put ${rec.victim.name||'an enemy'} out of action`,rec.round);
    if(g) rec.xpId=g.id;
  }
  render(); return rec; }
/* Resolve a casualty once the injury has been rolled in the post-battle step. */
export function resolveCasualty(id,result,detail){ const r=campCasualties().find(x=>x.id===Number(id));
  if(!r) return null; r.result=result||'pending'; if(detail!=null) r.detail=String(detail);
  const c=campState();
  const ev=c.log.find(e=>e.data&&e.data.casualtyId===r.id);
  if(ev){ ev.text=casualtyText(r); ev.type=casualtyType(r); }
  else logEventAt(r.round,casualtyType(r),casualtyText(r),{casualtyId:r.id});
  render(); return r; }
/* Resolving a casualty by rolling on the proper table.
   Heroes use the D66 Serious Injuries chart; Henchmen use their own D6 - 1-2
   the man is gone for good, 3-6 he fights on as normal (mordheimer, Tools).
   Applying the result here does what applying it on the roster would do, so the
   two can never drift apart: Dead moves the warrior into the Fallen list, a
   lasting injury is written onto him. */
export const HENCH_INJ=[
  {code:'1-2', name:'Dead', dead:true},
  {code:'3-6', name:'Okay - fights on as normal', ok:true}
];
export function casualtyIsOurs(r){ return !!(r && r.victim && r.victim.uid!=null); }
export function casualtyModel(r){ if(!casualtyIsOurs(r)) return null;
  return S.models.find(x=>x.uid===r.victim.uid)||null; }
export function casualtyIsHero(r){ const m=casualtyModel(r);
  if(m) return isHeroModel(m);
  if(r.victim.grade) return r.victim.grade==='hero';
  const fe=(S.fallen||[])[r.fallenId]; return fe? fe.kind==='hero' : false; }
/* Which member of a group the record refers to, by the name it was written with. */
function _memberIndexOf(m,name){ if(!m||!name) return 0;
  for(let i=0;i<memberCount(m);i++) if(memberName(m,i)===name) return i;
  return 0; }
/* Which man of the group the record means. The index written down when the
   casualty was recorded is authoritative; the name is only a fallback, since a
   positional default no longer points at the same man once the group shrinks. */
function _casMemberIndex(r,m){
  if(r.victim && r.victim.memberIdx!=null) return Math.min(Number(r.victim.memberIdx), memberCount(m)-1);
  return _memberIndexOf(m, r.victim.name); }
export function resolveCasualtyRoll(id,code){ const r=campCasualties().find(x=>x.id===Number(id));
  if(!r) return null;
  if(!code){ r.result='pending'; r.detail=''; delete r.code; delete r.applied;
    _retypeCasualty(r); render(); return r; }
  r.code=code;
  const m=casualtyModel(r);
  const hero=casualtyIsHero(r);
  const j = hero ? INJURIES.find(x=>x.code===code) : HENCH_INJ.find(x=>x.code===code);
  if(!j){ render(); return r; }
  // not one of ours: nothing to apply to a roster, just record the outcome
  if(!m){ r.result = (hero? code==='11-15' : !!j.dead) ? 'dead' : (hero&&/full recovery/i.test(j.name)?'recovered':(hero?'injured':'recovered'));
    r.detail=(INJEN&&INJEN[code])||j.name; _retypeCasualty(r); render(); return r; }
  const dead = hero ? (code==='11-15') : !!j.dead;
  if(dead){
    _resolvingCas=r;   // so the death below settles this record, not a namesake
    // the death is applied exactly as it would be from the unit card, so the
    // warrior lands in Fallen and the two records stay tied together
    r.detail=(INJEN&&INJEN[code])||j.name;
    if(isHeroModel(m)) killHero(m.uid);
    else killHenchMember(m.uid, _casMemberIndex(r,m));
    _resolvingCas=null;
    const fe=(S.fallen||[]).length-1;
    r.result='dead'; r.applied=true;      // the roster has been changed already
    r.fallenId=fe; if(S.fallen[fe]) S.fallen[fe].casualtyId=r.id;
    _retypeCasualty(r); render(); return r;
  }
  if(hero && j.miss){ m.miss=(Number(m.miss)||0)+j.miss; m.missWhy=INJEN[code]||j.name;
    r.result='injured'; r.detail=INJEN[code]||j.name; r.applied=true; }
  else if(hero && !/full recovery|knocked|dazed/i.test(INJEN[code]||j.name)){
    m.inj=m.inj||[]; m.inj.push({code:j.code,name:j.name,text:j.text,mod:j.mod||null});
    r.result='injured'; r.detail=INJEN[code]||j.name; r.applied=true; }
  else { r.result='recovered'; r.detail=INJEN&&INJEN[code]?INJEN[code]:j.name; }
  _retypeCasualty(r); render(); return r; }
function _retypeCasualty(r){ const c=campState();
  const ev=c.log.find(e=>e.data&&e.data.casualtyId===r.id);
  if(ev){ ev.text=casualtyText(r); ev.type=casualtyType(r); } }
/* The options for one casualty, from the table that actually applies to them. */
export function casualtyRollOptions(r){
  if(casualtyIsHero(r)) return INJURIES.map(j=>({code:j.code, label:`${j.code} \u00b7 ${(INJEN&&INJEN[j.code])||j.name}`}));
  return HENCH_INJ.map(j=>({code:j.code, label:`${j.code} \u00b7 ${j.name}`})); }
export function setCasNote(id,v){ const r=campCasualties().find(x=>x.id===Number(id));
  if(r) r.note=String(v||''); }
export function removeCasualty(id,silent){ const list=campCasualties(); const i=list.findIndex(x=>x.id===Number(id));
  if(i<0) return;
  if(!silent && typeof confirm==='function' && !confirm('Delete this casualty record?')) return;
  const cid=list[i].id; list.splice(i,1);
  const c=campState(); c.log=c.log.filter(e=>!(e.data&&e.data.casualtyId===cid));
  render(); }
/* An unresolved casualty for one of our own models, so applying the injury roll
   to that model resolves the existing record instead of creating a second one. */
export function pendingCasualtyFor(uid,who){ const list=campCasualties();
  // With a henchman group several members can be down at once, so a name
  // narrows it to the right record; without one, take the oldest still open.
  if(who) { const exact=list.find(r=>r.victim.uid===uid && r.result==='pending' && r.victim.name===who); if(exact) return exact; }
  return list.find(r=>r.victim.uid===uid && r.result==='pending')||null; }
/* Called from the injury/death flow: attach the outcome to the casualty record,
   or record it after the fact if nobody noted who did it. */
let _resolvingCas=null;   // the record a deliberate resolution is working on
export function noteCasualtyOutcome(m,result,detail,who){ const c=campState(); if(!c.on) return null;
  const name=who||m.name||unitDef(m.uid_def).name;
  const r=_resolvingCas || pendingCasualtyFor(m.uid,who);
  if(r){ r.result=result; if(detail) r.detail=detail;
    if(who) r.victim.name=who;
    const ev=c.log.find(e=>e.data&&e.data.casualtyId===r.id);
    if(ev){ ev.text=casualtyText(r); ev.type=casualtyType(r); }
    return r; }
  return addCasualty({victim:{uid:m.uid, name, wb:S.wb}, result, detail});
}
/* Casualty tallies: what each of our warriors dealt out and suffered. */
export function casualtyStats(){ const list=campCasualties(); const out={inflicted:{},suffered:{}};
  list.forEach(r=>{
    if(r.attacker.uid!=null){ const k=r.attacker.name||('#'+r.attacker.uid);
      const t=out.inflicted[k]=out.inflicted[k]||{ooa:0,kills:0}; t.ooa++; if(r.result==='dead') t.kills++; }
    if(r.victim.uid!=null){ const k=r.victim.name||('#'+r.victim.uid);
      const t=out.suffered[k]=out.suffered[k]||{ooa:0,deaths:0,injuries:0}; t.ooa++;
      if(r.result==='dead') t.deaths++; if(r.result==='injured') t.injuries++; }
  });
  return out; }

/* ---- Experience earned, held until it is applied ----
   Mordheim awards experience in the post-battle sequence: +1 to a Hero for
   each enemy he puts out of action, +1 to every Hero and Henchman group that
   survives, and +1 to the leader of the winning warband. Scenarios vary these
   (Mordheim's Burning grants +5 for surviving), so the amounts are arguments
   rather than constants.

   Only HEROES earn the per-enemy point; henchmen earn as a group by surviving.
   Earned points are held here rather than written straight onto the roster, so
   the whole battle can be tallied and then applied in one go — and so the
   record of WHY a warrior gained a point survives.

   S.campaign.xp = [{id, round, uid, amount, reason, applied}] */
export function xpLedger(){ const c=campState();
  if(!Array.isArray(c.xp)) c.xp=[]; return c.xp; }
/* Beasts, wagons and the like never gain experience - the same flag that stops
   the roster offering them an experience bar. */
/* Henchmen earn experience as a group, so their entries have to say so - a bare
   "Sell-sword" reads like one man. */
export function modelLabel(m){ if(!m) return '';
  const def=unitDef(m.uid_def)||{};
  const base=m.name||def.name||m.uid_def;
  const hero=isHeroModel(m);
  return hero? base : `${base} (group${(Number(m.qty)||1)>1?` of ${Number(m.qty)||1}`:''})`; }
export function canEarnXp(m){ if(!m) return false;
  const def=unitDef(m.uid_def)||{}; return !def.noxp; }
export function grantXp(uid,amount,reason,round){ const c=campState(); if(!c.on) return null;
  const m=S.models.find(x=>x.uid===Number(uid)); if(!m) return null;
  if(!canEarnXp(m)) return null;
  const rec={id:nextLogId(), round:(round==null?c.round:Number(round)||0), uid:Number(uid),
    name:modelLabel(m), amount:Number(amount)||0, reason:String(reason||''), applied:false};
  xpLedger().push(rec); return rec; }
export function pendingXp(){ return xpLedger().filter(x=>!x.applied); }
export function pendingXpFor(uid){ return pendingXp().filter(x=>x.uid===Number(uid)).reduce((a,x)=>a+x.amount,0); }
export function pendingXpTotal(){ return pendingXp().reduce((a,x)=>a+x.amount,0); }
/* Write the held experience onto the roster in one step. */
export function applyPendingXp(){ const list=pendingXp(); if(!list.length) return 0;
  const per={}; list.forEach(x=>{ per[x.uid]=(per[x.uid]||0)+x.amount; });
  let n=0;
  Object.keys(per).forEach(uid=>{ const m=S.models.find(x=>x.uid===Number(uid)); if(!m) return;
    m.exp=(Number(m.exp)||0)+per[uid]; n+=per[uid];
    logEvent('xp',`${m.name||unitDef(m.uid_def).name} gained ${per[uid]} experience.`,
      {uid:m.uid,name:m.name||unitDef(m.uid_def).name,gained:per[uid],exp:Number(m.exp)||0}); });
  list.forEach(x=>x.applied=true);
  render(); return n; }
/* Everything a battle leaves behind, applied to the sheet in one go.
   Experience was only half of it: a casualty rolled as Dead has to actually
   leave the roster, and a lasting injury has to be written onto the warrior,
   or the chronicle and the sheet drift apart. Casualties that have not been
   rolled for yet are left alone and reported back, since guessing at them
   would be inventing dice results. */
export function outstandingCasualties(round){ const r=(round==null?campRound():round);
  return campCasualties().filter(c=>c.round===r && c.result==='dead' && !c.applied
    && c.victim.uid!=null && S.models.some(m=>m.uid===c.victim.uid)); }
export function unrolledCasualties(round){ const r=(round==null?campRound():round);
  return campCasualties().filter(c=>c.round===r && c.result==='pending'); }
export function applyBattleResults(){
  const round=campRound();
  const open=unrolledCasualties(round);
  if(open.length && typeof confirm==='function'
    && !confirm(`${open.length} casualt${open.length===1?'y has':'ies have'} not been rolled for yet. Apply the rest anyway?`)) return null;
  // deaths first: a warrior who is leaving the roster should not also be
  // handed experience for the battle he did not walk away from
  let died=0;
  outstandingCasualties(round).forEach(c=>{
    const m=S.models.find(x=>x.uid===c.victim.uid); if(!m) return;
    _resolvingCas=c;
    if(isHeroModel(m)) killHero(m.uid); else killHenchMember(m.uid,_casMemberIndex(c,m));
    _resolvingCas=null;
    const fe=(S.fallen||[]).length-1;
    c.fallenId=fe; c.applied=true; if(S.fallen[fe]) S.fallen[fe].casualtyId=c.id;
    died++; });
  const xp=applyPendingXp();
  render();
  return {died, xp, unrolled:open.length}; }
export function clearPendingXp(){ const c=campState();
  if(typeof confirm==='function' && !confirm('Discard the experience that has not been applied yet?')) return;
  c.xp=xpLedger().filter(x=>x.applied); render(); }
/* The post-battle award for one battle. Amounts default to the rulebook and can
   be overridden for scenarios that differ. */
export function awardBattleXp(battleId,opts){ const c=campState(); if(!c.on) return 0;
  opts=Object.assign({survives:1, winningLeader:1, won:null}, opts||{});
  const bat=(c.battles||[]).find(b=>b.id===Number(battleId));
  const round=bat?bat.round:c.round;
  const won=opts.won!=null?!!opts.won:(bat?/victor/i.test(bat.outcome||''):false);
  let total=0;
  // +1 survives - every Hero, and every Henchman group, still standing.
  // A warrior sitting the battle out did not survive it; he was not in it. Nor
  // did one who was carried off dead, even if the roster has not caught up yet.
  const slain=new Set((campState().casualties||[])
    .filter(r=>r.round===round && r.result==='dead' && r.victim.uid!=null)
    .map(r=>r.victim.uid));
  S.models.forEach(m=>{ if((Number(m.miss)||0)>0) return;
    if(slain.has(m.uid) && (Number(m.qty)||1)<=1) return;
    const r=grantXp(m.uid,opts.survives,'survived the battle',round); if(r) total+=r.amount; });
  // +1 to the leader of the winning warband
  if(won){ const lu=leaderUid();
    const lm=lu!=null?S.models.find(x=>x.uid===lu):null;
    if(lm && (Number(lm.miss)||0)<=0){ const r=grantXp(lu,opts.winningLeader,'led the winning warband',round); if(r) total+=r.amount; } }
  render(); return total; }
/* The experience earned but not yet written onto the roster. */
export function xpBarBlock(){ const list=pendingXp(); if(!list.length) return '';
  // The label is worked out now, not when the point was earned: a group that
  // has lost a man since must not still read "group of 3".
  const per={}; list.forEach(x=>{ const m=S.models.find(y=>y.uid===x.uid);
    (per[x.uid]=per[x.uid]||{name:(m?modelLabel(m):x.name),amount:0,why:[]});
    per[x.uid].amount+=x.amount; per[x.uid].why.push(x.reason); });
  const others=cfXpOverview(campRound());
  return `<div class="xp-pend no-print">
    <div class="xp-head">\u2605 Experience earned \u2014 ${pendingXpTotal()} point${pendingXpTotal()===1?'':'s'} waiting</div>
    <ul class="xp-list">${Object.keys(per).map(uid=>`<li><b>${String(per[uid].name).replace(/</g,'&lt;')}</b> +${per[uid].amount}
      <span class="hs-foot">${per[uid].why.map(w=>String(w).replace(/</g,'&lt;')).join('; ')}</span></li>`).join('')}</ul>
    <div class="bat-btns"><button class="btnsm" onclick="applyBattleResults()" title="Write this battle onto the roster: deaths and lasting injuries applied, experience added">Apply battle results</button>
      <button class="tiny ghost" onclick="clearPendingXp()">discard experience</button></div>
    ${others.length?`<div class="xp-others"><b>The other warbands this stage</b>
      <div class="hs-foot">Read out at the table \u2014 only your own can be applied here.</div>
      ${others.map(o=>`<div class="xp-oth"><i>${String(o.name).replace(/</g,'&lt;')}${o.player?` (${String(o.player).replace(/</g,'&lt;')})`:''}</i>
        <ul class="xp-list">${o.rows.map(x=>`<li>${String(x.name).replace(/</g,'&lt;')} +${x.amount} <span class="hs-foot">${String(x.reason).replace(/</g,'&lt;')}</span></li>`).join('')}</ul></div>`).join('')}
    </div>`:''}
    </div>`; }
/* ================= Analysis & narrative =================
   Two purposes are served from the same record:
   - a chronicle detailed enough that a person (or a language model) can write
     the campaign up as a story, and
   - figures to analyse: who was present when, what they gained and when, what
     they achieved, and how they developed. */

/* Everything that ever happened to one warrior, in order. */
export function characterTimeline(uid){ const c=campState(); uid=Number(uid);
  const events=(c.log||[]).filter(e=>e.data&&e.data.uid===uid)
    .map(e=>({round:e.round, type:e.type, text:e.text, data:e.data}));
  const kills=(c.casualties||[]).filter(r=>r.attacker.uid===uid)
    .map(r=>({round:r.round, type:'kill', victim:r.victim, result:r.result, text:casualtyText(r)}));
  const suffered=(c.casualties||[]).filter(r=>r.victim.uid===uid)
    .map(r=>({round:r.round, type:'suffered', by:r.attacker, result:r.result, text:casualtyText(r)}));
  const curve=Object.keys(stageSnapshots()).map(Number).sort((a,b)=>a-b)
    .map(rd=>{ const row=snapRows(stageSnapshots()[String(rd)]).find(x=>x.uid===uid);
      return row?{round:rd, exp:row.exp,
        advances:Object.values(row.adv||{}).reduce((x,y)=>x+(Number(y)||0),0),
        skills:(row.skills||[]).length, alive:row.alive}:null; })
    .filter(Boolean);
  const all=events.concat(kills,suffered).sort((a,b)=>(a.round-b.round));
  const live=S.models.find(m=>m.uid===uid);
  const fallen=(S.fallen||[]).find(e=>e.m&&e.m.uid===uid);
  const first=all.length?all[0].round:null;
  const deathEv=events.filter(e=>e.type==='death').map(e=>e.round);
  const deathCas=suffered.filter(x=>x.result==='dead').map(x=>x.round);
  const last=(deathEv.concat(deathCas).sort((a,b)=>a-b))[0];
  const died=(last==null?null:last);
  return { uid,
    name:(live&&(live.name||unitDef(live.uid_def).name))||(fallen&&(fallen.m.name||unitDef(fallen.m.uid_def).name))||'unknown',
    alive:!!live, joined:first, died,
    kills:kills.filter(k=>k.result==='dead').length,
    outOfActionsInflicted:kills.length,
    killsByGrade:{hero:kills.filter(k=>k.result==='dead'&&k.victim.grade==='hero').length,
                  hench:kills.filter(k=>k.result==='dead'&&k.victim.grade==='hench').length},
    goldDestroyed:kills.filter(k=>k.result==='dead').reduce((a,k)=>a+(Number(k.victim.value)||0),0),
    injuries:suffered.filter(x=>x.result==='injured').length,
    curve, events:all };
}
/* Every warrior the campaign has seen, living or fallen. */
export function characterRoster(){ const seen=new Map();
  S.models.forEach(m=>seen.set(m.uid,true));
  (S.fallen||[]).forEach(e=>{ if(e.m) seen.set(e.m.uid,true); });
  (campState().log||[]).forEach(e=>{ if(e.data&&e.data.uid!=null) seen.set(e.data.uid,true); });
  return [...seen.keys()].map(uid=>characterTimeline(uid)); }
/* Campaign-wide figures. */
export function campaignAnalysis(){ const c=campState(); const chars=characterRoster();
  const cas=c.casualties||[];
  return {
    warband:S.name||wbName(S.wb), warbandType:wbName(S.wb), stage:c.round,
    battles:(c.battles||[]).length,
    wins:(c.battles||[]).filter(b=>/victor/i.test(b.outcome||'')).length,
    losses:(c.battles||[]).filter(b=>/defeat/i.test(b.outcome||'')).length,
    warriorsEverFielded:chars.length,
    fallen:(S.fallen||[]).length,
    killsInflicted:cas.filter(r=>r.attacker.uid!=null&&r.result==='dead').length,
    goldDestroyed:cas.filter(r=>r.attacker.uid!=null&&r.result==='dead')
      .reduce((a,r)=>a+(Number(r.victim.value)||0),0),
    goldLost:cas.filter(r=>r.victim.uid!=null&&r.result==='dead')
      .reduce((a,r)=>a+(Number(r.victim.value)||0),0),
    characters:chars.map(x=>({name:x.name, alive:x.alive, joined:x.joined, died:x.died,
      kills:x.kills, killsByGrade:x.killsByGrade, goldDestroyed:x.goldDestroyed,
      injuries:x.injuries, curve:x.curve}))
  };
}
/* A written account of the campaign, stage by stage: complete and specific
   enough to be handed to someone (or a language model) to turn into a story,
   without being a story itself. */
export function narrativeReport(){
  const c=campState(); const L=[];
  L.push(`CAMPAIGN CHRONICLE — ${S.name||wbName(S.wb)} (${wbName(S.wb)})`);
  L.push(`Stage reached: ${roundLabel(c.round)}`);
  L.push('');
  const rounds=[...new Set([0,...(c.log||[]).map(e=>e.round),...(c.battles||[]).map(b=>b.round),c.round])]
    .sort((a,b)=>a-b);
  rounds.forEach(r=>{
    const evs=(c.log||[]).filter(e=>e.round===r);
    const bats=(c.battles||[]).filter(b=>b.round===r);
    const cas=(c.casualties||[]).filter(x=>x.round===r);
    if(!evs.length&&!bats.length&&!cas.length) return;
    L.push(`## ${roundLabel(r)}`);
    bats.forEach(b=>{
      const who=b.opponents.length?b.opponents.map(o=>`${o.name||'?'}${o.wb?` of the ${wbName(o.wb)}`:''}`).join(' and '):'an unnamed foe';
      L.push(`Battle against ${who}${b.district?` at ${districtName(b.district)}`:''}${b.outcome?`. Outcome: ${b.outcome}`:''}.`);
      if(b.notes) L.push(`  Account: ${b.notes}`);
    });
    cas.forEach(x=>L.push(`  ${casualtyText(x)}`));
    // battles and casualties are already written out above, and the stage
    // markers are bookkeeping rather than story
    evs.filter(e=>!(e.data&&e.data.casualtyId) && e.type!=='battle' && e.type!=='round')
       .forEach(e=>L.push(`  ${e.text}`));
    const snap=stageSnapshots()[String(r)];
    const rows=snapRows(snap).filter(x=>x.alive);
    if(rows.length) L.push(`  Warband at the close of this stage: ${rows.map(x=>`${x.name} (${x.exp} XP)`).join(', ')}.`);
    const held=districtsAt(r);
    if(held.length) L.push(`  Districts held: ${held.map(x=>`${x.name} (${x.state})`).join(', ')}.`);
    const tt=totalsAt(r);
    if(tt) L.push(`  Warband rating ${tt.rating}, ${tt.models} warriors, ${tt.gold} gc in hand.`);
    L.push('');
  });
  const chars=characterRoster().filter(x=>x.events.length);
  if(chars.length){
    L.push('## The warriors');
    chars.forEach(x=>{
      const fate=x.alive?'still standing':(x.died!=null?`slain in ${roundLabel(x.died).toLowerCase()}`:'no longer with the warband');
      L.push(`${x.name} — joined at ${x.joined!=null?roundLabel(x.joined).toLowerCase():'the outset'}, ${fate}.`
        +` Kills: ${x.kills} (${x.killsByGrade.hero} heroes, ${x.killsByGrade.hench} henchmen), worth ${x.goldDestroyed} gc.`
        +` Injuries suffered: ${x.injuries}.`
        +(x.curve.length?` Experience: ${x.curve.map(p=>`${roundLabel(p.round).toLowerCase()} ${p.exp}`).join(', ')}.`:''));
    });
  }
  return L.join('\n');
}
export function exportNarrative(){ dl(narrativeReport(), stampedName()+'_chronicle.md','text/markdown'); }
export function exportAnalysis(){ dl(JSON.stringify(campaignAnalysis(),null,2), stampedName()+'_analysis.json','application/json'); }

/* ---- Casualty entry ----
   Filled in during the battle, when only "who went down, and to whom" is known.
   Either side may be one of our own warriors (picked from the roster, which is
   what makes the record cross-referable) or a named enemy. */
export function casDraft(){ return campState()._cas||null; }
export function openCasForm(){ const c=campState();
  // default to our own warband on the losing end, since that is the usual case
  c._cas={vSideKey:'me', vPick:'', vName:'', aSideKey:'', aPick:'', aName:'', detail:''};
  c._open=true; render(); }
export function cancelCasForm(){ const c=campState(); delete c._cas; render(); }
export function setCasField(f,v){ const d=casDraft(); if(!d) return; d[f]=v;
  if(f==='vSideKey') d.vPick='';        // a different warband means a different list
  if(f==='aSideKey') d.aPick='';
  if(f==='detail'||f==='vName'||f==='aName') return;   // typing must not lose focus
  render(); }
export function saveCasForm(){ const d=casDraft(); if(!d) return;
  const c=campState(); delete c._cas;
  /* One side of the record, from whichever warband was chosen. Our own warriors
     carry their uid so the roster can be changed later; the others are names. */
  const side=(key,pickVal,freeName)=>{
    if(key==='env') return {uid:null, name:'The surroundings', wb:'', npc:true};
    if(!key) return {uid:null, name:freeName||'', wb:''};
    const meta=battleSides().find(x=>x.key===key)||{};
    if(pickVal){ const opts=sideModels(key);
      const hit=String(pickVal).charAt(0)==='f'
        ? opts.find(o=>o.dead && String(o.fallenIdx)===String(pickVal).slice(1))
        : (()=>{ const [uid,idx]=String(pickVal).split(':');
            return opts.find(o=>!o.dead && String(o.uid)===uid && String(o.idx)===idx); })();
      if(hit) return {uid:(key==='me'?hit.uid:null), name:hit.label, wb:meta.wb,
        grade:hit.hero?'hero':'hench', dead:!!hit.dead,
        memberIdx:hit.dead?undefined:hit.idx,
        fallenIdx:hit.dead?hit.fallenIdx:undefined}; }
    return {uid:null, name:freeName||'', wb:meta.wb}; };
  const victim=side(d.vSideKey, d.vPick, d.vName);
  if(!victim.name){ render(); return; }
  const attacker=side(d.aSideKey, d.aPick, d.aName);
  const lastBat=c.battles.filter(b=>b.round===c.round).slice(-1)[0];
  // a warrior already among the Fallen did not walk away from it
  const rec=addCasualty({victim, attacker, result:victim.dead?'dead':'pending',
    note:d.detail||'', detail:victim.dead?(d.detail||''):'',
    battleId:lastBat?lastBat.id:null, noXp:d.aSideKey==='env'});
  if(rec && victim.dead && victim.fallenIdx!=null){ rec.fallenId=victim.fallenIdx; rec.applied=true;
    const fe=(S.fallen||[])[victim.fallenIdx]; if(fe) fe.casualtyId=rec.id; }
  render(); }
export function casFormBlock(){ const d=casDraft(); if(!d) return '';
  const sides=battleSides();
  const sideSel=(cur,withEnv)=>`<option value="">\u2014 warband \u2014</option>`
    + sides.map(x=>`<option value="${x.key}"${cur===x.key?' selected':''}>${x.name.replace(/</g,'&lt;')}</option>`).join('')
    + (withEnv?`<option value="env"${cur==='env'?' selected':''}>The surroundings</option>`:'');
  const pick=(sideKey,cur,field)=>{
    if(!sideKey||sideKey==='env') return '';
    const opts=sideModels(sideKey); if(!opts.length) return '';
    return `<select class="bat-in" onchange="setCasField('${field}',this.value)">
      <option value="">\u2014 name below \u2014</option>
      ${opts.map(o=>{ const v=o.dead?`f${o.fallenIdx}`:`${o.uid}:${o.idx}`;
        return `<option value="${v}"${cur===v?' selected':''}>${o.label.replace(/</g,'&lt;')}${o.hero?' \u2605':''}${o.dead?' \u2620':''}</option>`; }).join('')}
    </select>`; };
  const freeName=(cur,field,ph)=>`<input class="bat-in" placeholder="${ph}" value="${String(cur||'').replace(/"/g,'&quot;')}" oninput="setCasField('${field}',this.value)">`;
  return `<div class="bat-form no-print">
    <div class="bat-fhead">A warrior went down \u2014 ${roundLabel(campRound())}</div>
    <div class="hs-foot">Both sides are drawn from the campaign, so warriors can be named rather than typed. The injury roll happens below, in the casualty list.</div>
    <div class="cas-grid2">
      <div class="bat-oh">Went down</div>
      <select class="bat-in" onchange="setCasField('vSideKey',this.value)">${sideSel(d.vSideKey,false)}</select>
      ${pick(d.vSideKey,d.vPick,'vPick') || freeName(d.vName,'vName','who went down')}
      <div class="bat-oh">Taken out by</div>
      <select class="bat-in" onchange="setCasField('aSideKey',this.value)">${sideSel(d.aSideKey,true)}</select>
      ${d.aSideKey==='env'
        ? freeName(d.detail,'detail','a fall, a misfiring pistol\u2026')
        : (pick(d.aSideKey,d.aPick,'aPick') || freeName(d.aName,'aName','who did it (optional)'))}
    </div>
    ${d.aSideKey==='env'?'':`<label class="bat-notes">Note <input class="bat-in" value="${String(d.detail||'').replace(/"/g,'&quot;')}" oninput="setCasField('detail',this.value)" placeholder="e.g. felled from the rooftop"></label>`}
    <div class="bat-btns"><button class="btnsm" onclick="saveCasForm()">Save</button>
      <button class="tiny ghost" onclick="cancelCasForm()">cancel</button></div>
  </div>`; }
/* The casualties of one stage, with a dropdown to resolve those still open. */
export function casListBlock(round){
  const list=campCasualties().filter(r=>r.round===round); if(!list.length) return '';
  return `<div class="cas-list"><b>Casualties</b>
    <div class="hs-foot">Roll on the chart that applies: the D66 Serious Injuries chart for Heroes, D6 for Henchmen (1-2 gone for good, 3-6 fights on). Applying it here does what applying it on the unit card would.</div>
    <table class="fallen-tbl">
    <tr><th>Who</th><th>By</th><th>Injury roll</th><th>Note</th><th></th></tr>
    ${list.map(r=>{
      const opts=casualtyRollOptions(r);
      return `<tr>
      <td>${(r.victim.name||'?').replace(/</g,'&lt;')}${r.victim.uid!=null?' <i>(ours)</i>':''}</td>
      <td>${(r.attacker.name||'\u2014').replace(/</g,'&lt;')}${r.attacker.uid!=null?' <i>(ours)</i>':''}</td>
      <td><select class="bat-in" onchange="resolveCasualtyRoll(${r.id},this.value)">
        <option value=""${!r.code?' selected':''}>\u2014 not yet rolled \u2014</option>
        ${opts.map(o=>`<option value="${o.code}"${r.code===o.code?' selected':''}>${o.label.replace(/</g,'&lt;')}</option>`).join('')}
      </select>${r.result!=='pending'?` <span class="cas-res cas-${r.result}">${r.result}</span>`:''}</td>
      <td><input class="bat-in" value="${String(r.note||'').replace(/"/g,'&quot;')}" placeholder="a note\u2026" onchange="setCasNote(${r.id},this.value)"></td>
      <td class="no-print"><button class="tiny ghost" onclick="removeCasualty(${r.id})">\u00d7</button></td></tr>`; }).join('')}
  </table></div>`; }

/* ================= Campaign file =================
   A campaign is kept in its own document, separate from any single warband.
   One person (the campaign master, or whoever hosts that evening) collects the
   other players' warband exports into it and passes the updated file back.

   {type:'mordheim-campaign-file', version:1, name, round,
    warbands:[{id, player, name, wb, updated, roster:<a full warband save>}],
    battles:[…], log:[…]}

   This deliberately needs no server: GitHub Pages only serves static files, so
   a shared live session is not possible there. Exchanging one file per evening
   keeps the tool offline-capable and free of accounts. */
export const CF_TYPE='mordheim-campaign-file';
let CF=null;
export function cfGet(){ return CF; }
export function cfNew(name){ CF={type:CF_TYPE, version:1, name:String(name||'New campaign'), round:0,
  warbands:[], battles:[], log:[]}; render(); return CF; }
export function cfClose(){ CF=null; render(); }
export function cfSetName(v){ if(CF){ CF.name=String(v||''); } }
export function cfSetRound(n){ if(!CF) return; CF.round=Math.max(0,Number(n)||0); render(); }
function _cfNextId(){ if(!CF) return 1; return CF.warbands.reduce((m,w)=>Math.max(m,Number(w.id)||0),0)+1; }
/* Take a warband save (the tool's own JSON export) into the campaign. A warband
   already in the file is updated in place, so re-importing after a game night
   refreshes it instead of duplicating the player. */
export function cfImportWarband(data,player){
  if(!CF) cfNew('Campaign');
  if(!data||!data.wb||!WARBANDS[data.wb]) return {ok:false,msg:'Unknown format or unknown warband.'};
  // An unnamed player leaves a blank column and cannot be told from the next
  // unnamed one, so give them a number.
  const _autoPlayer=()=>{ let n=CF.warbands.length+1;
    const taken=CF.warbands.map(w=>w.player);
    while(taken.includes('Player '+n)) n++;
    return 'Player '+n; };
  const nm=String(data.name||'').trim()||wbName(data.wb);
  const existing=CF.warbands.find(w=>w.name.toLowerCase()===nm.toLowerCase() && w.wb===data.wb);
  const entry={ id: existing?existing.id:_cfNextId(),
    player: String(player||(existing&&existing.player)||'').trim()||(existing&&existing.player)||_autoPlayer(),
    name: nm, wb: data.wb, updated: new Date().toISOString().slice(0,10),
    roster: JSON.parse(JSON.stringify(data)) };
  if(existing) Object.assign(existing, entry); else CF.warbands.push(entry);
  render(); return {ok:true, updated:!!existing, entry};
}
export function cfRemoveWarband(id){ if(!CF) return;
  const i=CF.warbands.findIndex(w=>w.id===Number(id)); if(i<0) return;
  if(typeof confirm==='function' && !confirm(`Remove ${CF.warbands[i].name} from the campaign? Their roster stays in their own file.`)) return;
  CF.warbands.splice(i,1); render();
}
/* Pull the current warband in the builder into the campaign file. */
export function cfAddCurrent(player){ return cfImportWarband(JSON.parse(JSON.stringify(S)), player); }
export function cfExport(){ if(!CF) return;
  dl(JSON.stringify(CF,null,2), (CF.name||'campaign').replace(/[^\w\-]+/g,'_')+'.campaign.json','application/json'); }
export function cfImportFile(json){
  let d=json; if(typeof d==='string'){ try{ d=JSON.parse(d); }catch(e){ return {ok:false,msg:'Could not read the file.'}; } }
  if(!d||d.type!==CF_TYPE) return {ok:false,msg:'That is not a campaign file.'};
  CF={type:CF_TYPE, version:Number(d.version)||1, name:String(d.name||'Campaign'), round:Number(d.round)||0,
    warbands:Array.isArray(d.warbands)?d.warbands:[], battles:Array.isArray(d.battles)?d.battles:[],
    log:Array.isArray(d.log)?d.log:[]};
  render(); return {ok:true};
}
/* Every warband's own chronicle, merged into one campaign-wide history:
   each entry tagged with whose warband it belongs to, ordered by stage. */
export function cfMergedLog(){ if(!CF) return [];
  const out=[];
  (CF.log||[]).forEach(e=>out.push(Object.assign({},e,{who:null})));
  CF.warbands.forEach(w=>{
    const c=(w.roster&&w.roster.campaign)||{};
    (c.log||[]).forEach(e=>out.push(Object.assign({},e,{who:w.name, wbKey:w.wb})));
  });
  return out.sort((a,b)=>(a.round-b.round)||((a.id||0)-(b.id||0)));
}
/* All battles known to the campaign: the file's own plus those each warband
   recorded. Battles the players recorded from both sides stay separate — the
   chronicle shows them as each participant told it. */
export function cfAllBattles(){ if(!CF) return [];
  const out=(CF.battles||[]).map(b=>Object.assign({},b,{who:null}));
  CF.warbands.forEach(w=>{ const c=(w.roster&&w.roster.campaign)||{};
    (c.battles||[]).forEach(b=>out.push(Object.assign({},b,{who:w.name, wbKey:w.wb}))); });
  return out.sort((a,b)=>(a.round-b.round)||((a.id||0)-(b.id||0)));
}
/* File pickers for the campaign file. */
/* ---- Merging what other players send in ----
   Two others can play a battle we were not at, record it in their own copy, and
   send the file over. Merging must add what is new without duplicating what we
   already have, and without overwriting our own record of a battle we were in.

   A battle is recognised by the stage it was fought in, the warbands that
   fought it and where - the same battle entered twice by two different players
   is one battle, not two. */
function _batSig(b){
  const who=(b.sides&&b.sides.length? b.sides.map(x=>x.name||x.wb)
            : (b.opponents||[]).map(o=>o.name||o.wb)).map(x=>String(x).toLowerCase().trim()).sort();
  return JSON.stringify([Number(b.round)||0, who, String(b.district||'')]); }
/* Accepts either another player's campaign file or a plain warband file, and
   takes the battles out of it. Returns what it did, so the panel can say so. */
export function cfMergeFrom(json){
  let d=json; if(typeof d==='string'){ try{ d=JSON.parse(d); }catch(e){ return {ok:false,msg:'Could not read the file.'}; } }
  if(!d||typeof d!=='object') return {ok:false,msg:'Could not read the file.'};
  const cf=cfGet()||cfNew('Campaign');
  cf.battles=cf.battles||[];
  const have=new Set(cf.battles.map(_batSig));
  // battles we already hold through our own chronicle should not come back as
  // duplicates either
  campState().battles.forEach(b=>have.add(_batSig(b)));
  let incoming=[], warbands=0;
  if(d.type===CF_TYPE){
    incoming=(d.battles||[]).slice();
    (d.warbands||[]).forEach(w=>{ if(w&&w.roster){
      incoming=incoming.concat(((w.roster.campaign||{}).battles)||[]);
      cfImportWarband(w.roster, w.player||''); warbands++; } });
  } else if(d.wb){                       // a plain warband file
    incoming=((d.campaign||{}).battles)||[];
    cfImportWarband(d, d.player||''); warbands++;
  } else return {ok:false,msg:'That is neither a campaign file nor a warband file.'};

  let added=0;
  incoming.forEach(b=>{ const sig=_batSig(b); if(have.has(sig)) return;
    have.add(sig);
    cf.battles.push(Object.assign({}, b,
      {id:(cf.battles.reduce((m,x)=>Math.max(m,Number(x.id)||0),0)+1)}));
    added++; });
  render();
  return {ok:true, added, warbands, seen:incoming.length}; }
export function cfPickMerge(ev){ const f=ev.target.files&&ev.target.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=()=>{ const res=cfMergeFrom(String(rd.result));
    if(!res.ok) alert(res.msg);
    else flash(res.added? `${res.added} new battle${res.added===1?'':'s'} merged in.`
                        : 'Nothing new \u2014 every battle in that file was already recorded.');
    ev.target.value=''; };
  rd.readAsText(f); }
/* Every battle of the campaign: ours and those only the others were in. */
export function cfAllBattlesMerged(){
  const cf=cfGet();
  const mine=campState().battles.map(b=>({...b, mine:true}));
  const seen=new Set(mine.map(_batSig));
  const theirs=((cf&&cf.battles)||[]).filter(b=>!seen.has(_batSig(b))).map(b=>({...b, mine:false}));
  return mine.concat(theirs).sort((a,b)=>(a.round-b.round)||(Number(a.id)-Number(b.id))); }
export function cfPickFile(ev){ const f=ev.target.files&&ev.target.files[0]; if(!f) return;
  const rd=new FileReader(); rd.onload=()=>{ const r=cfImportFile(rd.result);
    flash(r.ok?'Campaign file loaded.':(r.msg||'Could not read the file.')); }; rd.readAsText(f); ev.target.value=''; }
export function cfPickWarband(ev){ const f=ev.target.files&&ev.target.files[0]; if(!f) return;
  const rd=new FileReader(); rd.onload=()=>{ let d=null; try{ d=JSON.parse(rd.result); }catch(e){}
    const player=(typeof prompt==='function')?(prompt('Player name (optional)')||''):'';
    const r=cfImportWarband(d,player);
    flash(r.ok?(r.updated?`${r.entry.name} updated.`:`${r.entry.name} joined the campaign.`):(r.msg||'Could not read the file.')); };
  rd.readAsText(f); ev.target.value=''; }
export function cfAddCurrentPrompt(){ const player=(typeof prompt==='function')?(prompt('Player name (optional)')||''):'';
  const r=cfAddCurrent(player); if(r&&r.ok) flash(r.updated?'Your warband was updated in the campaign.':'Your warband joined the campaign.'); }
/* Hand corrections to the map: a foothold can be given to or taken from any
   warband in the campaign, and a location cleared entirely. Control follows on
   its own, since it is only ever "the sole holder". */
export function cfToggleFoothold(districtId,cfId,on){
  if(cfId==null||cfId==='null'){ on?claimFoothold(districtId):loseFoothold(districtId); }
  else cfSetFoothold(cfId,districtId,on?'foothold':'none');
  render(); }
export function cfClearDistrict(districtId){
  if(typeof confirm==='function' && !confirm('Clear this location? Nobody will hold it any more.')) return;
  loseFoothold(districtId);
  const cf=cfGet(); if(cf) cf.warbands.forEach(w=>cfSetFoothold(w.id,districtId,'none'));
  render(); }
function _terrAddPicker(districtId){
  const cf=cfGet(); const held=cfFootholdsAt(districtId).map(h=>h.mine?'me':String(h.id));
  const opts=[]; 
  if(!held.includes('me')) opts.push(`<option value="me">${(S.name||wbName(S.wb)).replace(/</g,'&lt;')}</option>`);
  if(cf) cf.warbands.forEach(w=>{ if(!held.includes(String(w.id))) opts.push(`<option value="${w.id}">${w.name.replace(/</g,'&lt;')}</option>`); });
  if(!opts.length) return '';
  return `<select class="bat-in terr-add" onchange="if(this.value)cfToggleFoothold('${districtId}',this.value==='me'?null:this.value,true)">
    <option value="">+ give a foothold\u2026</option>${opts.join('')}</select>`; }
/* The experience each warband earned this battle. Only our own can be applied
   here - the others are shown so the figures can be read out at the table. */
export function cfXpOverview(round){ const cf=cfGet(); if(!cf) return [];
  return cf.warbands.map(w=>{ const c=((w.roster||{}).campaign)||{};
    const rows=(c.xp||[]).filter(x=>x.round===round);
    return {name:w.name, player:w.player, rows}; }).filter(x=>x.rows.length); }
export function campaignFileBlock(){
  if(!CF) return `<details class="cf-wrap"><summary class="cf-sum">\u2637 Campaign file — none open</summary>
    <div class="cf-body"><div class="hs-foot">A campaign file gathers several players' warbands, the battles fought and one shared chronicle. Pass the file on after each game night — no server or account needed.</div>
    <div class="cf-btns"><button class="btnsm" onclick="cfNew(prompt('Campaign name','Mordheim Campaign')||'Mordheim Campaign')">Start a campaign file</button>
      <label class="tiny filebtn">Open campaign file<input type="file" accept="application/json,.json" style="display:none" onchange="cfPickFile(event)"></label></div></div></details>`;
  const rows=CF.warbands.map(w=>{
    const st=(cfStats()||[]).find(x=>x.id===w.id)||{};
    return `<tr><td>${(w.player||'—').replace(/</g,'&lt;')}</td>
      <td><b>${w.name.replace(/</g,'&lt;')}</b></td>
      <td>${wbName(w.wb).replace(/</g,'&lt;')}</td>
      <td>${st.rating!=null?st.rating:'\u2014'}</td>
      <td>${st.warriors||0}</td><td>${st.fallen||0}</td><td>${st.battles||0}</td><td>${st.wins||0}</td>
      <td class="no-print"><button class="tiny ghost" onclick="cfRemoveWarband(${w.id})">remove</button></td></tr>`;
  }).join('');
  return `<details class="cf-wrap" open><summary class="cf-sum">\u2637 Campaign file — ${CF.name.replace(/</g,'&lt;')} \u00b7 ${CF.warbands.length} warband${CF.warbands.length===1?'':'s'}</summary>
    <div class="cf-body">
      <div class="cf-btns no-print">
        <button class="tiny" onclick="cfAddCurrentPrompt()" title="Put the warband currently open in the builder into the campaign">+ add my warband</button>
        <label class="tiny filebtn">+ import a warband<input type="file" accept="application/json,.json" style="display:none" onchange="cfPickWarband(event)"></label>
        <button class="tiny" onclick="cfExport()">\u2b06 export campaign file</button>
        <label class="tiny filebtn">\u2b07 open another<input type="file" accept="application/json,.json" style="display:none" onchange="cfPickFile(event)"></label>
        <button class="tiny ghost" onclick="cfClose()">close</button>
      </div>
      ${CF.warbands.length?`<table class="cf-tbl"><tr><th>Player</th><th>Warband</th><th>Type</th><th>Rating</th><th>Warriors</th><th>Fallen</th><th>Battles</th><th>Won</th><th></th></tr>${rows}</table>`
        :'<div class="chr-empty">No warbands yet — add yours or import the others\u2019 export files.</div>'}
      <div class="cf-merge">
        <label class="btnsm">Merge a file from another player
          <input type="file" accept="application/json" style="display:none" onchange="cfPickMerge(event)"></label>
        <div class="hs-foot">Their campaign file or their warband file \u2014 battles they recorded are added, and one you both wrote down stays one battle.</div>
      </div>
      ${(()=>{ const all=cfAllBattlesMerged(); if(!all.length) return '';
        return `<div class="cf-bats"><b>Battles in this campaign</b>
          <table class="cf-tbl"><tr><th>Stage</th><th>Who fought</th><th>Where</th><th></th></tr>
          ${all.map(b=>{ const who=(b.sides&&b.sides.length?b.sides:(b.opponents||[]))
              .map(x=>`${String(x.name||wbName(x.wb)).replace(/</g,'&lt;')}${x.outcome?` <i>(${String(x.outcome).replace(/</g,'&lt;')})</i>`:''}`).join(' vs ');
            return `<tr><td>${b.round}</td><td>${who}</td>
              <td>${b.district?districtName(b.district).replace(/</g,'&lt;'):'\u2014'}</td>
              <td>${b.mine?'<i>yours</i>':'<span class="hs-foot">reported</span>'}</td></tr>`; }).join('')}
          </table></div>`; })()}
      ${(()=>{ const terr=cfTerritory(); if(!terr.length) return '';
        return `<div class="cf-terr"><b>Territory</b>
          <div class="hs-foot">A warband controls a location when it is the only one holding a foothold there.</div>
          <table class="cf-tbl"><tr><th>Location</th><th>Foothold</th><th>Control</th><th></th></tr>
          ${terr.map(t=>`<tr><td>${t.name.replace(/</g,'&lt;')}</td>
            <td>${t.holders.map(h=>`<label class="terr-h"><input type="checkbox" checked onchange="cfToggleFoothold('${t.id}',${h.mine?'null':h.id},false)"> ${h.name.replace(/</g,'&lt;')}</label>`).join(' ')||'\u2014'}</td>
            <td>${t.control?`<b>${t.control.name.replace(/</g,'&lt;')}</b>`:'<i>contested</i>'}</td>
            <td class="no-print">${_terrAddPicker(t.id)}<button class="tiny ghost" onclick="cfClearDistrict('${t.id}')" title="Nobody holds this location any more">\u00d7</button></td></tr>`).join('')}
          </table></div>`; })()}
      ${cfMergedLog().length?`<div class="cf-hist"><b>Campaign history</b><ul class="chr-list">${
        cfMergedLog().map(e=>`<li class="chr-ev chr-${e.type}"><span class="chr-ic">\u2022</span>
          <span class="chr-tx">${e.who?`<i>${String(e.who).replace(/</g,'&lt;')}:</i> `:''}${String(e.text).replace(/</g,'&lt;')}</span>
          <span class="chr-tag">${roundLabel(e.round)}</span></li>`).join('')}</ul></div>`:''}
    </div></details>`;
}
/* Campaign-wide tallies, the basis for later evaluation. */
export function cfStats(){ if(!CF) return null;
  return CF.warbands.map(w=>{
    const r=w.roster||{}; const c=r.campaign||{};
    const log=c.log||[];
    // The rating as it stood when the warband was imported: recomputing it here
    // would need that warband's full state loaded, and would drift if the data
    // files change later.
    const snaps=(c.snapshots&&typeof c.snapshots==='object')?c.snapshots:{};
    const latest=Object.keys(snaps).map(Number).sort((a,b)=>b-a)[0];
    const rating=(latest!=null && snaps[String(latest)] && snaps[String(latest)].totals)
      ? snaps[String(latest)].totals.rating : null;
    return { id:w.id, player:w.player, name:w.name, wb:w.wb, rating,
      warriors:(r.models||[]).reduce((s,m)=>s+(Number(m.qty)||1),0),
      fallen:(r.fallen||[]).length,
      battles:(c.battles||[]).length,
      wins:(c.battles||[]).filter(b=>/victor/i.test(b.outcome||'')).length,
      advances:log.filter(e=>e.type==='advance').length,
      items:log.filter(e=>e.type==='item').length };
  });
}
export function campToggle(on){ if(!S.campaign) S.campaign={districts:{}}; S.campaign.on=!!on; render(); }
export function exportCampaign(){ const data={type:'mordheim-campaign',wb:S.wb,name:S.name||'',campaign:S.campaign||{districts:{}}}; dl(JSON.stringify(data,null,2),stampedName()+'_campaign.json','application/json'); }
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
export function downloadCampaignJSON(){ dl(campaignJSON(),stampedName()+'_campaign.json','application/json'); }
export function downloadCampaignText(){ dl(campaignTextReport(),stampedName()+'_campaign.txt','text/plain;charset=utf-8'); }
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
      note.innerHTML="<b>Coming (values under review):</b> "+PENDING_1A.join(" · ")+
        "<br><span class='note'>Partly unofficial homebrew values circulate online for these; only the verified official lists are included.</span>";
      p.appendChild(note);
    }
  });
}
function hideWelcome(){ const w=document.getElementById('welcome-view'); if(w) w.style.display='none'; }
export function chooseWb(key){
  hideWelcome();
  // A blank name makes every export and every campaign list read "warband".
  // Defaulting to the type gives something sensible that can still be renamed.
  const defName=WARBANDS[key].name;
  replaceState({wb:key, subtype:WARBANDS[key].subtypes?WARBANDS[key].subtypes[0].key:null, name:defName, budget:WARBANDS[key].gold, models:[], hired:[], dp:[], leaderUid:null, campaign:{on:false,districts:{}}, stash:{wyrd:0,gold:null,items:[]}, fallen:[]});
  document.getElementById('picker-view').style.display='none';
  document.getElementById('builder-view').style.display='block';
  document.getElementById('wbname').value=defName;
  document.getElementById('savename').value='';
  
  setupBuilder(); render(); window.scrollTo(0,0);
}
export function backToPicker(){
  document.getElementById('builder-view').style.display='none';
  document.getElementById('picker-view').style.display='block';
}
/* ---- welcome screen ---- */
export function welcomeNew(){ hideWelcome(); document.getElementById('picker-view').style.display='block'; }
export function welcomeImport(){ openImport(); }
/* Saved rosters straight on the welcome screen, so "continue where I left
   off" is one click instead of New -> some warband -> Load. Quietly absent
   when storage is unavailable or empty. */
export async function renderWelcome(){
  const wrap=document.getElementById('welcomecontinue'), box=document.getElementById('welcomelist');
  if(!wrap||!box) return;
  let keys=[];
  try{ const r=await window.storage.list('mh:',false); keys=(r&&r.keys)||[]; }catch(e){}
  if(!keys.length){ wrap.style.display='none'; return; }
  box.innerHTML=keys.map(k=>{const nm=k.replace(/^mh:/,''); const esc=nm.replace(/'/g,"\\'").replace(/</g,'&lt;');
    return `<div class="row"><button class="tiny" onclick="loadRoster('${esc}')">Load</button><span>${nm.replace(/</g,'&lt;')}</span></div>`;}).join('');
  wrap.style.display='block';
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
/* --- Subtyp-Effekte (Marauder-Stämme) --- */
// Core rule: up to 2 close combat weapons (besides the free dagger) + up to 2 missile weapons (a brace of pistols = 1).
export function addUnit(id){
  const def=unitDef(id); const mx=unitMax(def);
  if(mx!==null && modelsOf(id)>=mx) return;
  // Once the warband's leader (e.g. Chieftain) has died, you may not hire a new
  // one — a surviving Hero takes command instead.
  if(def.req && leaderUnitDied() && !HR().hireNewLeader) return;
  S.models.push({uid:nextUid(), uid_def:id, name:def.name, exp:def.exp, qty:def.t==='hen'?1:1, eq:{}, rare:{}, mut:[], adv:{}, skills:[], inj:[], spells:[]});
  if(typeof ensureFreeDagger==='function') ensureFreeDagger(S.models[S.models.length-1]);
  const _new=S.models[S.models.length-1];
  logEvent('recruit',`Recruited ${def.name} (${def.cost||0} gc).`,{uid:_new.uid,name:_new.name,uid_def:id,cost:def.cost||0,grade:def.t==='hero'?'hero':'hench'});
  render();
}
export function removeUnit(u){ const m=S.models.find(x=>x.uid===u);
  if(m){ const def=unitDef(m.uid_def); const hasEq=Object.values(m.eq||{}).some(v=>Number(v)>0)||Object.keys(m.rare||{}).length>0;
    if(hasEq && typeof confirm==='function' && !confirm(`Remove ${m.name||def.name}? This deletes the unit and its equipment for good (there is no undo — use “☠ died” instead if it was killed in a game).`)) return; }
  S.models=S.models.filter(m=>m.uid!==u); render(); }

/* ===================== COST ===================== */
// Nuln-Paarpreise lt. NC-Liste
export function setHeirloom(u,v){ const m=S.models.find(x=>x.uid===u); m.heirloom=v||null; render(); }
/* --- Rare Items / Trading Post (Katalog-gefiltert) --- */
/* --- Waffen-Upgrades (Dark Elf Blade, Dark Venom, Gromril/Ithilmar/Obsidian) --- */


// Flat upgrades (mult 0, e.g. Dark Elf Blade / Dark Venom) are shown INLINE next to the weapon,
// not in the Rare/Trading-Post section. inlineUpgradeActive = flat + warband matches current warband.
export function toggleWeaponUpgrade(uid,de,nm,on){ const m=S.models.find(x=>x.uid===uid); if(!m) return; m.rare=m.rare||{};
  if(on) m.rare[de]={q:1,on:nm,paid:(UPGRADES[de]&&UPGRADES[de].base)||0}; else delete m.rare[de];
  render(); }
/* Startgold der Warband (House-Rule-überschreibbar) */
export function setGoldCurrent(v){ S.stash=S.stash||{wyrd:0,gold:null,items:[]};
  S.stash.gold=Math.max(0,(Number(v)||0))+totalSpent(); render(); }
export function adjGoldCurrent(d){ setGoldCurrent(goldCurrent()+d); }
export function totalRating(){
  /* Rating = 5 per warrior (20 for Large creatures) + all experience,
     summed over the living warband; Hired Swords bring their own rating
     (their 5-per-warrior is already included, per Tuomas FAQ) and Dramatis
     Personae a fixed one. Vehicles are equipment, not warriors — no rating. */
  let r=0;
  S.models.forEach(m=>{
    const def=unitDef(m.uid_def); if(!def||def.vehicle) return;
    const q=def.t==='hen'?m.qty:1;
    r+=modelRating(m)*q;
  });
  r+= (typeof hsRatingTotal==='function'?hsRatingTotal():0);
  r+= (typeof dpRatingTotal==='function'?dpRatingTotal():0);
  return r;
}

/* Warband Worth (gc): the MARKET value of the fighting force — the dimension
   the official Rating deliberately ignores (Rating counts heads and
   experience only, so a naked warband and a gromril-armoured one can rate
   identically; that is exactly the false balance impression this figure is
   for). Every warrior with all his gear, rare items and mutations at LIST
   prices — a found sword or a half-price heirloom cuts just as well as one
   bought at list, so what was paid is irrelevant here (modelMarketValue).
   Henchmen add their veteran premium, 2 gc per XP earned in play per model —
   the price the Trading rules themselves put on a seasoned recruit. Hired
   Swords and Dramatis Personae count at their hire + equipment investment.
   Gold in hand is deliberately EXCLUDED: coins don't fight, and counting them
   would let a rich naked warband look equal to a poor equipped one — the
   Rating problem all over again. Wyrdstone too: no fixed sale price. */
/* Advancement component of Worth — priced by what actually LANDED on the
   profile, not by experience. Raw XP is progress toward power, not power;
   counting it as well as the outcomes would double-count, and "value at this
   exact moment" precision is not the goal (a warrior's Ld, I or BS matter
   whether or not this battle uses them — a stat is a stat). So: each applied
   stat advance is worth WORTH_STAT_PTS, each acquired skill or spell (hero
   privileges, chosen rather than rolled, never wasted on a capped stat)
   double that, and each stat point LOST to a serious injury subtracts the
   same 5 the advance would have added — a hero at −1 Toughness is worth less
   than his gear says. Henchman group advances multiply by group size on their
   own, since Worth is per model × qty: +1 S for three swordsmen is three
   improved warriors on the table. */
export const WORTH_STAT_PTS=5, WORTH_SKILL_PTS=10, WORTH_SPELL_PTS=10;
export function worthAdvOf(m){
  let p=0;
  const adv=(m&&m.adv)||{};
  for(const k in adv) p+=(Number(adv[k])||0)*WORTH_STAT_PTS;
  ((m&&m.inj)||[]).forEach(j=>{ const mod=j.mod||{}; for(const k in mod) p+=(Number(mod[k])||0)*WORTH_STAT_PTS; });
  p+=((m&&m.skills)||[]).length*WORTH_SKILL_PTS;
  p+=((m&&m.spells)||[]).length*WORTH_SPELL_PTS;
  return p;
}
export function warbandWorth(){
  let w=0;
  S.models.forEach(m=>{
    const def=unitDef(m.uid_def); if(!def) return;
    const hen=def.t==='hen'&&!isHeroModel(m);
    const per=modelMarketValue(m)+worthAdvOf(m);
    w+=per*(hen?(Number(m.qty)||1):1);
  });
  w+=(typeof hsHireTotal==='function'?hsHireTotal():0);
  w+=(typeof hsEqTotal==='function'?hsEqTotal():0);
  w+=(typeof dpHireTotal==='function'?dpHireTotal():0);
  (S.hired||[]).forEach(h=>{ w+=worthAdvOf(h); });   // HS track adv/skills/spells the same way
  // Everything above is summed unrounded (backup weapons and shields carry
  // exact halves); one single round at the very end.
  return Math.round(w);
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
  [['hero','Heroes'],['hen','Henchmen'],['vehicle','Vehicles (count as equipment)']].forEach(([t,label])=>{
    const us=wb.units.filter(u=> t==='vehicle' ? !!u.vehicle : (u.t===t && !u.vehicle)); if(!us.length) return;
    html+=`<div class="addgroup"><h2>${label}</h2>`;
    us.forEach(u=>{
      const cnt=modelsOf(u.id); const umx=unitMax(u);
      const leaderGone=!!u.req && leaderUnitDied() && !HR().hireNewLeader;
      const atMax=leaderGone || (umx!==null && cnt>=umx) || (t==='hero' && totalHeroes()>=(Number(HR().heroes)||6));
      const lim=umx===null?'any':(u.req?`=${umx}`:`0–${umx}`);
      html+=`<div class="addrow">
        <span class="nm">${u.name}${cnt?` <span class="rec">×${cnt}</span>`:''}</span>
        <span class="lim" title="${umx===null?'any number':(u.req?('exactly '+umx):('0 to '+umx))}">${lim}</span>
        <span class="cost">${u.cost} gc</span>
        <span class="xp">${u.exp?`${u.exp} xp`:''}</span>
        <button class="tiny blood" ${atMax?'disabled':''} ${leaderGone?'title="The warband leader has been slain — you may not hire a new one; a surviving Hero takes command."':''} onclick="addUnit('${u.id}')">+ recruit</button>
        <div class="desc">${u.vehicle?vehRulesBlock(u):(u.sp||'')}</div>
      </div>`;
    });
    html+='</div>';
  });
  el.innerHTML=html;
}
/* ===================== ITEM-EIGENSCHAFTEN (Tooltip) ===================== */

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
    html+=`<details class="eq" open><summary>Choose equipment (weapons by quantity, e.g. two swords)</summary>`;
    if(S.wb==='kislev'&&def.id==='capt'){
      const owned=Object.keys(m.eq||{}).filter(k=>m.eq[k]>0);
      html+=`<div class="note no-print">Heirloom (founding: one item at half price): <select onchange="setHeirloom(${m.uid},this.value)"><option value="">—</option>${owned.map(nm=>`<option value="${nm}"${m.heirloom===nm?' selected':''}>${nm}</option>`).join('')}</select>${m.heirloom&&heirloomDiscount(m)>0?` −${heirloomDiscount(m)} gc (later replacement: 150%)`:''}</div>`;
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
      const enNm=mutEN(nm); const escEn=enNm.replace(/'/g,"\\'");
      const ii=abilityInfo(enNm)?`<span class="iinfo no-print" tabindex="0" onmouseenter="showItip(this,'${escEn}')" onmouseleave="hideItip()" onfocus="showItip(this,'${escEn}')" onblur="hideItip()" onclick="toggleItip(event,this,'${escEn}')">ⓘ</span>`:'';
      html+=`<label class="eqitem"><input type="checkbox" ${checked}
        onchange="toggleMut(${m.uid},'${nm.replace(/'/g,"\\'")}',this.checked)"><span>${enNm}</span>${ii}<span class="pr">${pr} gc</span></label>`;
    });
    html+=`</div></details>`;
  }
  // ---- Rare Items / Trading Post (only categories the unit may carry) ----
  if(def.eq){
    const _owned=rareDisplayParts(m);
    if(_owned.length) html+=`<div class="eq-rare-summary"><b>Rare / Trading Post:</b> ${_owned.map(x=>String(x).replace(/</g,'&lt;')).join(', ')}</div>`;
    const elig=rareEligibleItems(m);
    const CATLBL={cc:'Melee',missile:'Missile',bp:'Blackpowder',armour:'Armour',misc:'Misc / Trading Post'};
    let opts='';
    ['cc','missile','bp','armour','misc'].forEach(c=>{ const grp=elig.filter(it=>it.cat===c); if(!grp.length) return;
      opts+=`<optgroup label="${CATLBL[c]}">`+grp.map(it=>{ const up=UPGRADES[it.de]; const half=(!up && typeof itemHalfActive==='function' && itemHalfActive(it.en)); const cost=up?up.note:(typeof it.cost==='number'?(half?Math.floor(it.cost*0.5):it.cost)+' gc':it.cost); const rar=(it.rare&&it.rare!=='Common'&&it.rare!=='—')?' · '+it.rare:''; const tag=(up?' ⤴ Upgrade':'')+(half?' · ½ campaign':'');
        return `<option value="${String(it.de).replace(/"/g,'&quot;')}">${it.en}${tag} — ${cost}${rar}</option>`; }).join('')+`</optgroup>`; });
    html+=`<details class="eq" ${m._rareOpen?'open':''} ontoggle="setRareOpen(${m.uid},this.open)"><summary>Rare Items / Trading Post (category-filtered)</summary>`;
    html+=`<div class="note">Only items whose <b>category</b> the unit may carry per its starting equipment list are offered (Misc: Heroes only). Mind warband/rarity restrictions yourself; adjust the price if needed (dice prices like "25+1D6").</div>`;
    html+=`<div class="eqitem"><select class="no-print" style="flex:1;min-width:0" onchange="addRare(${m.uid},this.value);this.selectedIndex=0;"><option value="">+ Add item …</option>${opts}</select></div>`;
    const r=m.rare||{}; const keys=Object.keys(r); const vkeys=keys.filter(de=>!inlineUpgradeActive(de));
    if(vkeys.length){
      html+=`<div class="eqgrid">`;
      keys.forEach(de=>{ if(inlineUpgradeActive(de)) return; const e=r[de]; const it=CATALOG.find(x=>x.de===de); const _rr=(HR().showRarity&&it&&it.rare&&it.rare!=='Common'&&it.rare!=='—')?` <span class="note">(${it.rare})</span>`:''; const nm=(it?it.en:de)+_rr; const esc=de.replace(/'/g,"\\'"); const q=Number(e.q)||1;
        const ii=itemInfo(de)?`<span class="iinfo no-print" tabindex="0" onmouseenter="showItip(this,'${esc}')" onmouseleave="hideItip()" onfocus="showItip(this,'${esc}')" onblur="hideItip()" onclick="toggleItip(event,this,'${esc}')">ⓘ</span>`:'';
        if(isUpgrade(de)){
          const tg=upgradeTargets(m,de); const cur=e.on||(tg[0]&&tg[0].nm)||'';
          const sel=tg.map(w=>`<option value="${w.nm.replace(/"/g,'&quot;')}" ${w.nm===cur?'selected':''}>${enItem(w.nm)}</option>`).join('');
          html+=`<div class="eqitem qty rrow"><span class="eqnm">${nm}${ii} → <select class="no-print" style="max-width:140px" onchange="setRareTarget(${m.uid},'${esc}',this.value)">${sel}</select><span class="stashq-print"> on ${cur?enItem(cur):'—'}</span></span>
            <span class="pr"><input type="number" min="0" value="${Number(e.paid)||0}" class="no-print" style="width:52px" onchange="setRarePaid(${m.uid},'${esc}',this.value)"> gc<span class="stashq-print">${Number(e.paid)||0} gc</span></span>
            <button class="advx no-print" title="remove" onclick="removeRare(${m.uid},'${esc}')">✕</button></div>`;
        } else {
          html+=`<div class="eqitem qty rrow"><span class="eqnm">${nm}${ii}</span>
            <span class="qtyctl"><button class="qbtn no-print" onclick="setRareQty(${m.uid},'${esc}',${q-1})">−</button><span class="qn">${q}</span><button class="qbtn no-print" onclick="setRareQty(${m.uid},'${esc}',${q+1})">+</button></span>
            <span class="pr"><input type="number" min="0" value="${Number(e.paid)||0}" class="no-print" style="width:52px" onchange="setRarePaid(${m.uid},'${esc}',this.value)"> gc<span class="stashq-print">${Number(e.paid)||0} gc</span></span>
            <button class="advx no-print" title="remove" onclick="removeRare(${m.uid},'${esc}')">✕</button></div>`;
        }
      });
      html+=`</div>`;
      const parts=vkeys.map(de=>{ const it=CATALOG.find(x=>x.de===de); const q=Number(r[de].q)||1; const _rr=(HR().showRarity&&it&&it.rare&&it.rare!=='Common'&&it.rare!=='—')?` (${it.rare})`:''; const nm=(it?it.en:de)+_rr;
        if(isUpgrade(de)) return `${nm}${r[de].on?` (on ${enItem(r[de].on)})`:''}`;
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
  const scan = sp+' '+muts.map(mutEN).join(' ');   // innate special rules + mutations/blessings (translated to EN so ABILITYINFO matches; acquired skills are shown separately)
  let found=[]; const seen=new Set();
  for(const [re,info] of ABILITYINFO){ if(abilityMentioned(re,scan) && !seen.has(info.name)){ seen.add(info.name); found.push(info); } }
  if(found.some(f=>f.name==='Fearless')) found=found.filter(f=>f.name!=='Fear'&&f.name!=='Terror');
  if(/immune to fear/i.test(scan) && !/causes? fear|fearsome/i.test(scan)) found=found.filter(f=>f.name!=='Fear');
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
  const adv=m.adv||{}, skills=m.skills||[];
  const spellStart=spellStartCount(def,m); const spellsSel=(m.spells||[]);
  const spellAdv=Math.max(0,spellsSel.length-spellStart)+spellsSel.reduce((a,sp)=>a+(Number(sp.red)||0),0);
  const applied=Object.values(adv).reduce((s,v)=>s+(Number(v)||0),0)+skills.length+spellAdv;
  const due = earned>applied;
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
export function addAdv(u,stat){ const m=S.models.find(x=>x.uid===u); if(!canAdv(m,stat)) return; m.adv=m.adv||{}; m.adv[stat]=(m.adv[stat]||0)+1;
  logEvent('advance',`${m.name||unitDef(m.uid_def).name} advanced +1 ${stat}.`,{uid:m.uid,name:m.name||unitDef(m.uid_def).name,uid_def:m.uid_def,stat,exp:Number(m.exp)||0}); render(); }
export function remAdv(u,stat){ const m=S.models.find(x=>x.uid===u); if(m.adv&&m.adv[stat]){ m.adv[stat]--; if(m.adv[stat]<=0) delete m.adv[stat]; } render(); }
export function addSkill(u){ const m=S.models.find(x=>x.uid===u); const el=document.getElementById('sk-'+u); const v=((el&&el.value)||'').trim(); if(!v) return; m.skills=m.skills||[]; m.skills.push(v);
  logEvent('advance',`${m.name||unitDef(m.uid_def).name} learned ${v}.`,{uid:m.uid,name:m.name||unitDef(m.uid_def).name,uid_def:m.uid_def,skill:v,exp:Number(m.exp)||0}); render(); }
export function remSkill(u,i){ const m=S.models.find(x=>x.uid===u); if(m.skills){ m.skills.splice(i,1); render(); } }
export function setAdvOpen(u,v){ const m=S.models.find(x=>x.uid===u); if(m) m._advOpen=v; }
/* ----- Aufstiegs-Fertigkeiten (Auswahl aus verfügbaren Listen) ----- */

export function skillListsFor(def){ const out=[];
  let cats = (def.skSub && def.skSub[S.subtype]) || def.sk || ['combat','shooting','academic','strength','speed'];
  if(HR().allSkills) cats=['combat','shooting','academic','strength','speed'];
  cats.forEach(c=>{ if(SKILLLISTS[c]) out.push(['['+SKILLLISTS[c].name+']',SKILLLISTS[c].skills]); else if(SKILLSETS[c]) out.push(['['+SKILLSETS[c].name+']',SKILLSETS[c].skills]); });
  const ex=WBEXTRA[S.wb]; if(ex&&ex.skills&&SKILLSETS[ex.skills]&&!def.noWbSkills&&!cats.includes(ex.skills)) out.push(['['+SKILLSETS[ex.skills].name+']',SKILLSETS[ex.skills].skills]);
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
/* ---- Naming individual henchmen ----
   A henchman group is one model with a count: by the rules the members share
   experience, characteristics and equipment, and that stays so. What they did
   not have was identity - "one Verminkin was slain" tells you nothing about
   which of the three it was, and on the tabletop each miniature is a separate
   piece anyway.

   `m.names` holds a name per member, indexed alongside the count. It is sparse
   and optional: a member without an entry falls back to a numbered default, and
   a save written before this simply has no array. The group keeps its own
   `m.name` for the unit as a whole; the two are different things.

   The delicate part is that the array must stay aligned with the count when a
   member dies or is promoted out of the group - which is exactly why death and
   promotion now say WHICH member. */
export function memberCount(m){ return Math.max(1, Number(m&&m.qty)||1); }
export function memberDefaultName(m,i){ const def=unitDef(m.uid_def);
  const base=(def&&def.name)||'Warrior';
  return memberCount(m)>1? `${base} ${i+1}` : base; }
export function memberName(m,i){ const n=(m&&m.names&&m.names[i]||'').trim();
  return n||memberDefaultName(m,i); }
/* True when the member has a name of their own rather than the fallback. */
export function memberNamed(m,i){ return !!(m&&m.names&&(m.names[i]||'').trim()); }
export function memberNames(m){ return Array.from({length:memberCount(m)},(_,i)=>memberName(m,i)); }
export function setMemberName(u,i,v){ const m=S.models.find(x=>x.uid===u); if(!m) return;
  if(!Array.isArray(m.names)) m.names=[];
  while(m.names.length<memberCount(m)) m.names.push('');
  m.names[i]=String(v||'').trim();
  if(m.names.every(x=>!x)) delete m.names;   // keep saves clean when nothing is named
}
/* Remove one member's entry and close the gap, so the remaining names stay with
   the right members. */
function _dropMemberName(m,i){ if(!Array.isArray(m.names)) return;
  m.names.splice(i,1);
  if(!m.names.some(x=>(x||'').trim())) delete m.names; }
export function setMemberOpen(u,v){ const m=S.models.find(x=>x.uid===u); if(m) m._memOpen=!!v; }
/* One named member of a group falls. Index-based, so the right name goes with
   the right death. */
export function killHenchMember(u,i){ const m=S.models.find(x=>x.uid===u); if(!m) return;
  i=Number(i)||0; const who=memberName(m,i);
  const snap=_fallenSnapshot(m); snap.qty=1; delete snap.names;
  // Only a man who was actually given a name is remembered by one; a positional
  // default like "Verminkin 2" says nothing and would clutter the Fallen list.
  if(memberNamed(m,i)) snap.name=who;
  /* The recruit surcharge (xpPaid) belongs to the GROUP: an ordinary death
     leaves it on the group's books, and only when the LAST man falls does the
     remainder go with him, so emptying the group does not hand that gold back.
     The value he was worth is settled against the treasury here, once. */
  const _last=(memberCount(m)-1)<=0;
  snap.xpPaid=_last?(Number(m.xpPaid)||0):0;
  const rec={kind:'hench', uid_def:m.uid_def, exp:Number(m.exp)||0, m:snap, memberIdx:i, lostValue:loseValueOnDeath(snap)};
  if(memberNamed(m,i)) rec.memberName=who;
  S.fallen=S.fallen||[]; S.fallen.push(rec);
  m.qty=memberCount(m)-1;
  _dropMemberName(m,i);
  const _wasPending=!!pendingCasualtyFor(m.uid,who);
  const _cas=noteCasualtyOutcome(m,'dead',null,who);
  if(_cas){ _cas.fallenId=S.fallen.length-1; rec.casualtyId=_cas.id; rec.casFromDeath=!_wasPending; }
  else logEvent('death',`${who} was slain.`,{uid:m.uid,name:who,uid_def:m.uid_def,exp:Number(m.exp)||0,hero:false});
  if(m.qty<=0) S.models=S.models.filter(x=>x.uid!==u);
  render(); }
/* The Lad's Got Talent: one member leaves the group and becomes a Hero. Which
   member matters now - he takes his own name with him, and the names of those
   left behind must not shift onto the wrong men. */
export function promoteHench(u,i){
  const m=S.models.find(x=>x.uid===u); if(!m) return;
  if(totalHeroes()>=(Number(HR().heroes)||6)){ alert('Maximum of '+(Number(HR().heroes)||6)+' Heroes per warband reached.'); return; }
  const def=unitDef(m.uid_def);
  const idx=(i==null? memberCount(m)-1 : Number(i)||0);
  const who=memberName(m,idx);
  const named=memberNamed(m,idx);
  if(memberCount(m)>1){
    m.qty=memberCount(m)-1;
    _dropMemberName(m,idx);
    S.models.push({uid:nextUid(), uid_def:m.uid_def,
      // a man who had a name of his own keeps it; otherwise fall back to the
      // group's name, as before
      name: named? who : (m.name?m.name+' (Hero)':def.name+' (Hero)'),
      exp:Number(m.exp)||0, qty:1,
      eq:JSON.parse(JSON.stringify(m.eq||{})), mut:[...(m.mut||[])], adv:Object.assign({},m.adv||{}),
      skills:[...(m.skills||[])], inj:[...(m.inj||[])], spells:[...(m.spells||[])], miss:Number(m.miss)||0, promoted:true, promoCats:(def.promoCatsFixed?[...def.promoCatsFixed]:[]), _advOpen:true});
  } else {
    m.promoted=true; m.promoCats=(def.promoCatsFixed?[...def.promoCatsFixed]:(m.promoCats||[])); m._advOpen=true;
    if(named && !m.name){ m.name=who; delete m.names; }
  }
  const promoted=S.models[S.models.length-1];
  logEvent('promote',`${who} was promoted to Hero (The Lad's Got Talent).`,
    {uid:(memberCount(m)>0&&promoted&&promoted.promoted)?promoted.uid:m.uid,name:who,uid_def:m.uid_def,exp:Number(m.exp)||0});
  render();
}
export function unpromote(u){ const m=S.models.find(x=>x.uid===u); if(m){ delete m.promoted; render(); } }
/* Wie viele Sprüche/Gebete bringt die Einheit von Haus aus mit? (Rest sind Advances) */
export function addSkillFromSel(u){ const m=S.models.find(x=>x.uid===u); if(!m) return;
  const el=document.getElementById('sksel-'+u); const v=el&&el.value;
  if(!v||v==='\u2014') return;
  m.skills=m.skills||[]; if(m.skills.includes(v)) return;
  m.skills.push(v);
  logEvent('advance',`${m.name||unitDef(m.uid_def).name} learned ${v}.`,{uid:m.uid,name:m.name||unitDef(m.uid_def).name,uid_def:m.uid_def,skill:v,exp:Number(m.exp)||0}); render(); }
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
function _ldOf(m){ const p=effProfile(m); if(!p) return 0; return Number(statNum(p.Ld))||0; }
export function leaderUnitDied(){ const req=(WARBANDS[S.wb].units||[]).find(u=>u.req); if(!req) return false;
  return (S.fallen||[]).some(e=>(e.uid_def||(e.m&&e.m.uid_def))===req.id); }
export function defaultLeaderUid(){ const nat=S.models.find(m=>{ const d=unitDef(m.uid_def); return d&&/\bLeader:/.test(d.sp||''); });
  if(nat) return nat.uid;
  // The natural leader (e.g. Chieftain) is gone. Undead are special: on the
  // Vampire's death the Necromancer specifically must take command.
  if(S.wb==='undead'){ const necro=S.models.find(m=>m.uid_def==='necro'&&canBeLeader(m)); if(necro) return necro.uid; }
  // General rule: the eligible Hero with the highest Leadership takes command;
  // ties broken by most Experience (a remaining D6 tie is left to manual choice).
  const cands=S.models.filter(m=>canBeLeader(m));
  if(!cands.length) return null;
  cands.sort((a,b)=> (_ldOf(b)-_ldOf(a)) || ((Number(b.exp)||0)-(Number(a.exp)||0)) || (a.uid-b.uid));
  return cands[0].uid;
}
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
    + skills.map((sk,i)=>`<span class="advchip skill" title="${skillText(sk).replace(/"/g,'&quot;')}">${String(sk).replace(/</g,'&lt;')}<button class="advx no-print" title="remove" onclick="remSkill(${m.uid},${i})">×</button></span>`).join('');
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
/* ---- Fallen warriors (Dead 11-15) ----
   Fallen units live in S.fallen (a chronological list), NOT in S.models, so
   totals and exports exclude them automatically. Each entry is one death:
     hero:  {kind:'hero', m:<full model snapshot>}
     hench: {kind:'hench', uid_def, exp, m:<snapshot of ONE model>}
   Heroes render as individual read-only cards; henchmen are grouped in the UI
   by type (then by exp+equipment). A single LIFO "undo last death" reverses the
   most recent entry (repeat to walk further back) — no per-unit selection. */
/* A warrior who falls takes his worth with him - himself and everything he was
   carrying. That is taken out of the treasury once, here, and the amount is
   written onto the Fallen record so it can be shown and given back exactly if
   the death is undone. Gold in hand is never derived from the Fallen list:
   doing that made every figure entered by hand silently lose the same amount
   again, and the treasury drifted negative. */
export function loseValueOnDeath(snapshot){
  const lost=lossValueOf(snapshot);
  if(lost>0){ S.stash=S.stash||{wyrd:0,gold:null,items:[]};
    // the treasury may still be the untouched starting sum; make it real first
    S.stash.gold=Math.max(0, goldTreasury()-lost); }
  return lost; }
export function restoreValueOnUndo(rec){
  const back=Number(rec&&rec.lostValue)||0;
  if(back>0){ S.stash=S.stash||{wyrd:0,gold:null,items:[]};
    S.stash.gold=goldTreasury()+back; }
  return back; }
function _fallenSnapshot(m){ return JSON.parse(JSON.stringify(m)); }
export function fallenEqSig(m){ // canonical signature: same type+eq+adv+skills+mut+exp => identical
  const eq={}; for(const k in (m.eq||{})) if(m.eq[k]) eq[k]=m.eq[k];
  const rare={}; for(const k in (m.rare||{})) rare[k]=m.rare[k];
  return JSON.stringify([m.uid_def, Number(m.exp)||0, eq, rare, (m.mut||[]).slice().sort(), (m.skills||[]).slice().sort(), m.adv||{}]);
}
export function killHero(u,msg){ const m=S.models.find(x=>x.uid===u); if(!m) return;
  const snap=_fallenSnapshot(m);
  S.fallen=S.fallen||[]; S.fallen.push({kind:'hero', m:snap, lostValue:loseValueOnDeath(snap)});
  if(m.uid===S.leaderUid) S.leaderUid=null;
  const _cas=noteCasualtyOutcome(m,'dead');
  if(_cas) _cas.fallenId=S.fallen.length-1;   // ties the record to the Fallen entry
  if(msg) logEvent('death',msg,{uid:m.uid,name:m.name||unitDef(m.uid_def).name,uid_def:m.uid_def,exp:Number(m.exp)||0,hero:true});
  else if(!_cas) logEvent('death',`${m.name||unitDef(m.uid_def).name} (${unitDef(m.uid_def).name}) was slain.`,{uid:m.uid,name:m.name||unitDef(m.uid_def).name,uid_def:m.uid_def,exp:Number(m.exp)||0,hero:true});
  S.models=S.models.filter(x=>x.uid!==u); render(); }
/* Without a member given, the last of the group falls - the same behaviour as
   before individual names existed. */
export function killHench(u,i){ const m=S.models.find(x=>x.uid===u); if(!m) return;
  killHenchMember(u, i==null? memberCount(m)-1 : Number(i)||0); }
export function undoFallen(){ if(!S.fallen||!S.fallen.length) return;
  const e=S.fallen[S.fallen.length-1];
  restoreValueOnUndo(e);        // the warrior comes back, and so does his worth
  if(e.kind==='hero'){ S.models.push(e.m); }
  else { // hench: return one model to a matching living group, or recreate it
    const sig=fallenEqSig(e.m);
    const grp=S.models.find(x=>!isHeroModel(x)&&fallenEqSig(x)===sig);
    if(grp){ grp.qty=(Number(grp.qty)||0)+1;
      // Put him back where he stood, under his own name. Without this he
      // returns as a nameless extra at the end of the group and the names of
      // everyone after him are one place out.
      if(e.memberName){ const at=(e.memberIdx==null?memberCount(grp)-1:Math.min(e.memberIdx,memberCount(grp)-1));
        if(!Array.isArray(grp.names)) grp.names=[];
        while(grp.names.length<at) grp.names.push('');
        grp.names.splice(at,0,e.memberName); grp.names.length=memberCount(grp); }
      // The recruit surcharge that died with the last man comes back with him.
      grp.xpPaid=(Number(grp.xpPaid)||0)+(Number(e.m&&e.m.xpPaid)||0);
    }
    else { const nm=_fallenSnapshot(e.m); nm.uid=nextUid(); nm.qty=1;
      if(e.memberName) nm.names=[e.memberName];
      S.models.push(nm); }
  }
  // A death that is taken back must not stay in the chronicle. One that was
  // recorded during the battle goes back to awaiting its injury roll; one the
  // death itself created is dropped entirely.
  if(e.casualtyId!=null){
    const c=campState();
    if(e.casFromDeath){ c.casualties=(c.casualties||[]).filter(r=>r.id!==e.casualtyId);
      c.log=(c.log||[]).filter(x=>!(x.data&&x.data.casualtyId===e.casualtyId)); }
    else { const rec=(c.casualties||[]).find(r=>r.id===e.casualtyId);
      if(rec){ rec.applied=false; delete rec.fallenId; }   // it can be applied again
      resolveCasualty(e.casualtyId,'pending',''); }
  }
  S.fallen.pop(); render(); }
export function removeFallenAt(i){ if(!S.fallen||!S.fallen[i]) return;
  const e=S.fallen[i]; const eq=eqDisplayParts(e.m);
  if(eq.length && typeof confirm==='function' && !confirm('Delete this fallen record permanently? Its equipment record will be lost too. (Undo cannot recover a deleted record.)')) return;
  S.fallen.splice(i,1); render(); }
export function setFallenGroupOpen(k,v){ S._fallenOpen=S._fallenOpen||{}; S._fallenOpen[k]=v; }
/* Aggregate equipment across a set of fallen snapshots into "N× Item" strings,
   marking the free (1st-gratis) dagger so it's clear no gold was lost on it. */
export function fallenEqAgg(models){ const def=models[0]&&unitDef(models[0].uid_def);
  const freeName=def?daggerNameFor(def):null; const freeBase=freeName?freeName.replace(' (1. gratis)',''):null;
  const tally={}; let freeCount=0;
  models.forEach(m=>{ (eqDisplayParts(m)||[]).forEach(part=>{ tally[part]=(tally[part]||0)+1; });
    // count the free dagger this model carried (the 1st dagger is free)
    if(freeName && Number((m.eq||{})[freeName])>0) freeCount++;
  });
  const out=[];
  for(const part in tally){ const n=tally[part];
    if(freeBase && part===enItem(freeBase) && freeCount>0){
      const paid=n-freeCount;
      if(freeCount>0) out.push(`${freeCount>1?freeCount+'× ':''}${part} (free)`);
      if(paid>0) out.push(`${paid>1?paid+'× ':''}${part}`);
    } else out.push(`${n>1?n+'× ':''}${part}`);
  }
  return out; }
/* Gold lost through the fallen: REAL gold only — the man himself, his gear and
   any recruit surcharge actually paid for him (snapshot xpPaid). Experience is
   never priced in here; it is reported separately as XP lost. Recomputed from
   the snapshot so records written by older versions (which folded 2 gc/XP into
   the unit cost) display correctly; the treasury refund on undo still uses the
   recorded lostValue, so undo returns exactly what was deducted. */
export function fallenGoldOf(e){ return (modelUnitCost(e.m)||0)+(Number(e.m&&e.m.xpPaid)||0); }
export function fallenGoldLost(){ return (S.fallen||[]).reduce((s,e)=>s+fallenGoldOf(e),0); }
/* Experience EARNED IN PLAY (beyond the unit's starting exp) that died with the
   fallen. A leader who starts at 20 XP and dies at 23 lost 3 XP, not 23. */
export function fallenExpEarned(e){ const ud=e.uid_def||(e.m&&e.m.uid_def); const def=unitDef(ud);
  return Math.max(0,(Number(e.m&&e.m.exp!=null?e.m.exp:e.exp)||0)-(Number(def&&def.exp)||0)); }
export function fallenExpLost(){ return (S.fallen||[]).reduce((s,e)=>s+fallenExpEarned(e),0); }
/* ---- Gear lost to an injury (Robbed, Sold to the Pits, …) ----
   Removing items normally refunds their price (gold = treasury − spending, and
   the spending just shrank). Stolen gear must NOT do that: the same amount is
   taken out of the treasury in the same breath, so gold in hand stays exactly
   where it was — the gear is gone AND the money stays spent. weaponsOnly
   restricts the theft to weapons & armour (Pit-Fight loss, RAW), otherwise
   everything goes: list equipment, rare/trading-post items and the heirloom. */
export function stripGearSettled(m, weaponsOnly){
  const before=modelUnitCost(m);
  const def=unitDef(m.uid_def);
  if(weaponsOnly){
    const list=def.eq?eqListFor(def):null;
    const armed=new Set();
    if(list) ['Nahkampf','Fernkampf'].forEach(c=>(list[c]||[]).forEach(([nm])=>armed.add(nm)));
    if(list) for(const c in list){ if(/^Rüstung/.test(c)) (list[c]||[]).forEach(([nm])=>armed.add(nm)); }
    for(const nm in (m.eq||{})){ if(armed.has(nm)) delete m.eq[nm]; }
    const r=m.rare||{};
    for(const de in r){ const it=CATALOG.find(x=>x.de===de);
      const cat=it&&it.cat;
      // weapon upgrades ride on a weapon that is gone; weapon/armour items go too
      if(isUpgrade(de) || cat==='cc'||cat==='missile'||cat==='bp'||cat==='armour') delete r[de]; }
    if(m.heirloom && !((m.eq||{})[m.heirloom])) m.heirloom=null;
  } else {
    m.eq={}; m.rare={}; m.heirloom=null;
  }
  const lost=Math.max(0, before-modelUnitCost(m));
  if(lost>0){ S.stash=S.stash||{wyrd:0,gold:null,items:[]};
    S.stash.gold=Math.max(0, goldTreasury()-lost); }
  return lost;
}
export function addInj(u){ const m=S.models.find(x=>x.uid===u); const el=document.getElementById('inj-'+u); const code=el&&el.value; const j=INJURIES.find(i=>i.code===code); if(!j) return;
  const nm=m.name||unitDef(m.uid_def).name;
  if(j.code==='11-15'){ // Dead — route to the right death path for hero vs henchman
    if(el) el.value=INJURIES[0]?INJURIES[0].code:'';
    if(isHeroModel(m)) killHero(u); else killHench(u); return; }
  if(j.code==='36'){ // Robbed — all weapons, armour and equipment lost, NO refund
    if(typeof confirm==='function' && !confirm(`Robbed: ${nm} loses ALL weapons, armour, equipment and rare items. No gold is refunded — the loss is settled against the treasury. Apply?`)) return;
    const lost=stripGearSettled(m,false);
    logEvent('injury',`${nm} was Robbed — all equipment lost (${lost} gc, not refunded).`,{uid_def:m.uid_def});
    m.inj=m.inj||[]; m.inj.push({code:j.code,name:j.name,text:j.text,mod:null});
    flash(`Robbed: equipment worth ${lost} gc removed, gold unchanged.`); render(); return; }
  if(j.code==='65'){ // Sold to the Pits — fight a Pit Fighter (RAW, mordheimer Campaigns)
    const won=typeof confirm==='function' ? confirm(`Sold to the Pits: did ${nm} WIN the pit fight?\nOK = won (+50 gc, +2 XP, keeps all gear)\nCancel = lost (thrown out without weapons & armour; roll 11–35 on this chart separately)`) : true;
    if(won){ S.stash=S.stash||{wyrd:0,gold:null,items:[]}; S.stash.gold=goldTreasury()+50;
      m.exp=(Number(m.exp)||0)+2;
      logEvent('injury',`${nm} won his pit fight — +50 gc, +2 XP.`,{uid_def:m.uid_def});
      flash('Pit fight won: +50 gc, +2 XP.'); }
    else { const lost=stripGearSettled(m,true);
      logEvent('injury',`${nm} lost his pit fight — weapons & armour lost (${lost} gc, not refunded). Roll 11–35 for injuries separately.`,{uid_def:m.uid_def});
      flash(`Pit fight lost: weapons & armour (${lost} gc) removed, no refund. Now roll 11–35 and apply it via + Injury.`); }
    render(); return; }
  if(j.code==='61'){ // Captured — ransom/exchange, or he is not coming back
    const back=typeof confirm==='function' ? confirm(`Captured: is ${nm} coming back (ransomed or exchanged)?\nOK = yes — enter the ransom next (0 for an exchange)\nCancel = no — sold, killed or worse: he and his gear are lost (no refund)`) : true;
    if(back){ let r=0;
      if(typeof prompt==='function'){ r=Math.max(0,Number(prompt('Ransom paid (gc, 0 for an exchange):','0'))||0); }
      if(r>0){ S.stash=S.stash||{wyrd:0,gold:null,items:[]}; S.stash.gold=Math.max(0,goldTreasury()-r); }
      logEvent('injury',`${nm} was Captured and ${r>0?`ransomed for ${r} gc`:'exchanged'}.`,{uid_def:m.uid_def});
      flash(r>0?`Ransom of ${r} gc paid.`:'Exchanged — no gold changed hands.'); render(); return; }
    killHero(u,`${nm} was Captured and never returned — sold, killed or worse. He and his equipment are lost.`);
    return; }
  if(j.code==='35'){ // Deep Wound — misses the next D3 games
    let n=1; if(typeof prompt==='function'){ n=Math.min(3,Math.max(1,Number(prompt('Deep Wound: result of the D3 (games to miss):','1'))||1)); }
    m.miss=(Number(m.miss)||0)+n; flash(`Deep Wound: +${n} game${n>1?'s':''} to miss — tracked at the top of the unit card.`); render(); return; }
  if(j.code==='66'){ // Survives Against the Odds — +1 Experience, one-off
    m.exp=(Number(m.exp)||0)+1;
    logEvent('injury',`${nm} Survives Against the Odds — +1 Experience.`,{uid_def:m.uid_def});
    flash('+1 Experience.'); render(); return; }
  if(j.miss){ m.miss=(Number(m.miss)||0)+j.miss; m.missWhy=j.name||j.code; noteCasualtyOutcome(m,'injured',j.name||j.code); flash(`+${j.miss} game to miss — tracked at the top of the unit card.`); render(); return; }
  m.inj=m.inj||[]; m.inj.push({code:j.code,name:j.name,text:j.text,mod:j.mod||null});
  noteCasualtyOutcome(m,'injured',j.name||j.code); render(); }
export function remInj(u,i){ const m=S.models.find(x=>x.uid===u); if(m.inj){ m.inj.splice(i,1); render(); } }
export function setInjOpen(u,v){ const m=S.models.find(x=>x.uid===u); if(m) m._injOpen=v; }
/* Rare/Trading-Post <details> re-collapsed on every render because its open
   state was never remembered — every add/qty/price change folded it shut. */
export function setRareOpen(u,v){ const m=S.models.find(x=>x.uid===u); if(m) m._rareOpen=v; }
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
/* The members of a henchman group, by name.
   Kept as a plain list rather than hidden behind a dialog: on the tabletop each
   of these is a separate miniature, and when one of them goes down you want to
   say which without hunting for it. It opens by itself once anybody has been
   named, so groups nobody cares to name stay out of the way. */
export function henchMembersBlock(m){
  const n=memberCount(m); const def=unitDef(m.uid_def);
  const anyNamed=Array.from({length:n},(_,i)=>memberNamed(m,i)).some(Boolean);
  const open=(m._memOpen!=null? m._memOpen : anyNamed);
  const canPromote=!def.noPromote && !def.noxp;
  return `<details class="mem-wrap no-print" ${open?'open':''} ontoggle="setMemberOpen(${m.uid},this.open)">
    <summary class="mem-sum">Members \u00b7 ${n}${anyNamed?` \u2014 ${memberNames(m).join(', ').replace(/</g,'&lt;')}`:' (unnamed)'}</summary>
    <div class="mem-body">
      <div class="mem-note">The group shares experience, characteristics and equipment \u2014 these are names only, so you can tell the miniatures apart.</div>
      ${Array.from({length:n},(_,i)=>`<div class="mem-row">
        <span class="mem-idx">${i+1}</span>
        <input class="mem-in" value="${memberNamed(m,i)?String(m.names[i]).replace(/"/g,'&quot;'):''}"
          placeholder="${memberDefaultName(m,i).replace(/"/g,'&quot;')}"
          onchange="setMemberName(${m.uid},${i},this.value);render()">
        ${canPromote?`<button class="tiny ghost" onclick="promoteHench(${m.uid},${i})" title="The Lad's Got Talent \u2014 this member becomes a Hero and keeps his name">\u2605 promote</button>`:''}
        <button class="tiny ghost" onclick="ttsOpenMember(${m.uid},${i})" title="Tabletop Simulator text for this miniature">TTS</button>
        <button class="tiny ghost" onclick="killHenchMember(${m.uid},${i})" title="This member died (Dead 11-15) \u2014 moves him to Fallen">\u2620 died</button>
      </div>`).join('')}
    </div></details>`;
}
export function renderRoster(){
  const el=document.getElementById('roster');
  if(!S.models.length && !hsList().length && !dpList().length && !(S.fallen&&S.fallen.length)){ el.innerHTML=`<div class="empty">No warriors recruited yet.<br>Use “Recruit Warriors” below.</div>`; return; }
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
        <input class="namefld" value="${(m.name||'').replace(/"/g,'&quot;')}" placeholder="${def.name.replace(/"/g,'&quot;')}"
          oninput="setName(${m.uid},this.value)">
        <span class="note">${def.name}${promoted?' \u2014 promoted to Hero':''}</span>
        <span class="missctl"><span class="misslbl no-print" title="Track games this warrior sits out (injuries that say “misses next game”, or unpaid Hired Sword upkeep). ▲ adds a game to miss, ▼ removes one.">⚑ miss games</span>${(Number(m.miss)||0)>0?`<b class="missbadge">out ${m.miss} game${m.miss>1?'s':''}</b>`:''}<button class="tiny ghost no-print" title="one fewer game to miss" ${(Number(m.miss)||0)<=0?'disabled':''} onclick="missAdj(${m.uid},-1)">▼</button><button class="tiny ghost no-print" title="miss one more game" onclick="missAdj(${m.uid},1)">▲</button></span>
        <button class="tiny ghost no-print" onclick="ttsOpen(${m.uid})" title="Description for Tabletop Simulator">⧉ TTS</button>
        ${t==='vehicle'?'':(t==='hen'&&memberCount(m)>1
          ? `<button class="tiny ghost no-print death-btn" onclick="setMemberOpen(${m.uid},true);render()" title="Say which member of the group was slain">☠ a model died…</button>`
          : `<button class="tiny ghost no-print death-btn" onclick="${t==='hen'?`killHenchMember(${m.uid},0)`:`killHero(${m.uid})`}" title="${t==='hen'?'This model died (Dead 11-15) — moves it to Fallen':'This warrior died (Dead 11-15) — moves them to Fallen'}">☠ died</button>`)}
        <button class="tiny ghost no-print" onclick="removeUnit(${m.uid})">remove</button>
      </div><div class="mbody">
        ${def.profile?statTableM(m):''}${attachedSection(def,m)}${vehRulesBlock(def)}
        <div class="ctlrow">
          ${t==='hen'?(hcap<=1
             ? `<span class="note">Single model${def.max!=null?` · max ${def.max} per warband`:''}</span>`
             : `<label>Models in group (1–${hcap}): <input type="number" min="1" max="${hcap}" value="${m.qty}"
             onchange="setQty(${m.uid},this.value)"></label>${hmaxNote}${henchRecruitSurcharge(m)?` <span class="note" title="Veterans cost more to take on: 2 gc for each experience point they bring">one more costs ${henchRecruitCost(m)} gc (+${henchRecruitSurcharge(m)} for experience)</span>`:''}`):''}
          ${def.noxp?'<span class="note">No experience (equipment / animal)</span>':`<label>Experience: <input type="number" min="0" value="${m.exp}" onchange="setExp(${m.uid},this.value)"></label>`}
        </div>
        ${def.desc?`<div class="unit-desc">${String(def.desc).replace(/</g,'&lt;')}</div>`:''}
        ${t==='hen'?henchMembersBlock(m):''}
        ${def.noxp?'':`<div id="xp-${m.uid}" class="xpbar no-print">${xpBar(m)}</div>`}
        ${leaderSection(m)}
        ${def.noxp?'':advSection(m)}
        ${injSection(m)}
        ${spellSection(m)}
        ${eqSection(m)}
        ${abilitySection(def,m)}
        <div class="subtotal">${t==='hen'
          ?`<span title="Current value: 2 gc per experience point earned in play, per model. Gold in hand is still based on what was actually paid (${modelTotalCost(m)} gc).">${q} × ${modelUnitCost(m)+henchRecruitSurcharge(m)} gc = ${(modelUnitCost(m)+henchRecruitSurcharge(m))*q} gc</span>`
          :`${modelTotalCost(m)} gc`}</div>
      </div></div>`;
    });
  });
  // Fallen (Dead 11-15): removed from the active warband, shown here read-only.
  // Collapsed by default; each unit collapsed too. Never exported (PDF/TTS/JSON).
  const fallen=S.fallen||[];
  if(fallen.length){
    html+=`<details class="fallen-wrap no-print"><summary class="fallen-sum">☠ Fallen (${fallen.length}) — removed from the warband, equipment lost · ${fallenGoldLost()} gc lost${fallenExpLost()?` · ${fallenExpLost()} XP earned in play lost`:''}</summary>
      <div class="fallen-tools"><button class="btnsm" onclick="undoFallen()" title="Undo the most recent death (press again to undo the one before, and so on)">↩ Undo last death</button></div>`;
    // Group all fallen by unit type (a type is either all-hero or all-henchman).
    // Group first by grade (hero vs henchman — from the death kind, which
    // respects Lad's-Got-Talent promotion), then by unit type. This keeps a
    // promoted henchman (now a Hero) out of the regular henchman group even
    // though they share a uid_def.
    const byType={}; const typeOrder=[];
    fallen.forEach(e=>{ const ud=e.uid_def||(e.m&&e.m.uid_def); const key=e.kind+'|'+ud;
      if(!byType[key]){ byType[key]=[]; typeOrder.push(key); } byType[key].push(e); });
    typeOrder.forEach(key=>{
      const grp=byType[key]; const uid_def=grp[0].uid_def||grp[0].m.uid_def; const def=unitDef(uid_def);
      const isHero=(grp[0].kind==='hero');
      const totalExp=grp.reduce((s,e)=>s+(Number(e.m&&e.m.exp!=null?e.m.exp:e.exp)||0),0);
      const earnedExp=grp.reduce((s,e)=>s+fallenExpEarned(e),0);
      const goldLost=grp.reduce((s,e)=>s+fallenGoldOf(e),0);
      const eqAll=fallenEqAgg(grp.map(e=>e.m));
      const domKey='t'+grp[0].kind+'_'+uid_def;
      const open=!!(S._fallenOpen&&S._fallenOpen[domKey]);
      let rows;
      if(isHero){ // one row per hero, listed by name (never merged)
        rows=`<table class="fallen-tbl"><tr><th>Name</th><th>Experience</th><th>Equipment lost</th><th>Worth</th></tr>`
          + grp.map(e=>`<tr><td>${(e.m.name||def.name).replace(/</g,'&lt;')}</td><td>${Number(e.m.exp)||0} XP</td><td>${(fallenEqAgg([e.m]).map(x=>String(x).replace(/</g,'&lt;')).join(', '))||'—'}</td><td>${fallenGoldOf(e)} gc</td></tr>`).join('')
          + `</table>`;
      } else { // henchmen
        // Anyone who was given a name is remembered by it; the nameless are
        // merged by experience and equipment, since the count is all there is
        // to say about them.
        const isNamed=e=>{ const n=(e.m.name||'').trim(); return n && n!==def.name; };
        const named=grp.filter(isNamed), plain=grp.filter(e=>!isNamed(e));
        const subs={}; plain.forEach(e=>{ const sig=fallenEqSig(e.m);
          const su=(subs[sig]=subs[sig]||{n:0,ex:e.m,exp:e.exp,val:0}); su.n++; su.val+=fallenGoldOf(e); });
        rows=`<table class="fallen-tbl"><tr><th>${named.length?'Name':'#'}</th><th>Experience</th><th>Equipment lost</th><th>Worth</th></tr>`
          + named.map(e=>`<tr><td>${String(e.m.name).replace(/</g,'&lt;')}</td><td>${Number(e.m.exp)||0} XP</td><td>${(fallenEqAgg([e.m]).map(x=>String(x).replace(/</g,'&lt;')).join(', '))||'—'}</td><td>${fallenGoldOf(e)} gc</td></tr>`).join('')
          + Object.values(subs).map(s=>`<tr><td>${s.n}×</td><td>${Number(s.exp)||0} XP</td><td>${(fallenEqAgg([s.ex]).map(x=>String(x).replace(/</g,'&lt;')).join(', '))||'—'}</td><td>${s.val} gc</td></tr>`).join('')
          + `</table>`;
      }
      html+=`<details class="model fallen" ${open?'open':''} ontoggle="setFallenGroupOpen('${domKey}',this.open)">
        <summary class="mhead fallen-head"><span class="badge fallen-badge">☠ Fallen</span>
          <span class="fallen-name">${grp.length}× ${def.name.replace(/</g,'&lt;')}</span>
          <span class="note">total ${totalExp} XP${earnedExp?` (${earnedExp} earned in play)`:''}${eqAll.length?` · ${eqAll.map(x=>String(x).replace(/</g,'&lt;')).join(', ')}`:''} · ${goldLost} gc lost</span></summary>
        <div class="mbody fallen-body">
          <div class="note">${grp.length} model${grp.length>1?'s':''} of this type died. Records are read-only; equipment was lost with them.</div>
          ${rows}
        </div></details>`;
    });
    html+=`</details>`;
  }
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
  const wEl=document.getElementById('worth'); if(wEl) wEl.textContent=warbandWorth();
  // unit breakdown (aggregated per type; a Lad's-Got-Talent promotion gets its
  // own "Hero <type>" row under Heroes, Vehicles get their own section)
  const counts={}, order=[];
  S.models.forEach(m=>{ const d=unitDef(m.uid_def); if(!d) return;
    const promo=!!m.promoted&&d.t==='hen'&&!d.vehicle;
    const key=(promo?'promo:':'')+d.id;
    if(!(key in counts)){ counts[key]={id:d.id,name:promo?('Hero '+d.name):d.name,promo,n:0}; order.push(key); }
    counts[key].n += (d.t==='hen'&&!promo?(Number(m.qty)||1):1); });
  const ulEl=document.getElementById('unitlist');
  if(ulEl){
    const udef=k=>WARBANDS[S.wb].units.find(u=>u.id===counts[k].id);
    const _listIdx=k=>{ const i=(WARBANDS[S.wb].units||[]).findIndex(u=>u.id===counts[k].id); return i<0?999:i; };
    const _isLead=k=>{ const d=udef(k); return !!(d&&/\bLeader:/.test(d.sp||'')); };
    const heroK=order.filter(k=>{const d=udef(k);return d&&!d.vehicle&&(d.t==='hero'||counts[k].promo);})
      .sort((a,b)=> ((_isLead(a)?0:1)-(_isLead(b)?0:1)) || ((counts[a].promo?1:0)-(counts[b].promo?1:0)) || (_listIdx(a)-_listIdx(b)) );
    const henK =order.filter(k=>{const d=udef(k);return d&&d.t==='hen'&&!d.vehicle&&!counts[k].promo;})
      .sort((a,b)=> _listIdx(a)-_listIdx(b) );
    const vehK =order.filter(k=>{const d=udef(k);return d&&d.vehicle;})
      .sort((a,b)=> _listIdx(a)-_listIdx(b) );
    const urow=(name,n,title,gold)=>`<div class="ulrow"${title?` title="${title}"`:''}><span>${name}</span>${gold!=null?`<span class="ulg">${gold} gc</span>`:''}<span class="uln">×${n}</span></div>`;
    const hsRows=(S.hired||[]).map(h=>{const hs=HIREDSWORDS[h.key];if(!hs)return '';const p=hs.profile;
      const tip=`${hs.name} (${hs.grade}) — ${[p.M,p.WS,p.BS,p.S,p.T,p.W,p.I,p.A,p.Ld].join('/')} · Hire ${hs.hire}, Upkeep ${hsUpkeepFor(h.key)}, Rating +${hs.rating}`;
      return urow((h.name?h.name+' ('+hs.name+')':hs.name),1,tip.replace(/"/g,'&quot;'),(typeof hsHireCost==='function'?hsHireCost(h.key):hs.hire));}).join('');
    const goldOf=k=>S.models.filter(m=>m.uid_def===counts[k].id && (!!m.promoted)===counts[k].promo).reduce((a,m)=>a+modelTotalCost(m),0);
    const heroRows=heroK.map(k=>urow(counts[k].name,counts[k].n,null,goldOf(k))).join('');
    const henRows =henK.map(k=>urow(counts[k].name,counts[k].n,null,goldOf(k))).join('');
    const vehRows =vehK.map(k=>urow(counts[k].name,counts[k].n,null,goldOf(k))).join('');
    const seg=(label,rows)=>rows?`<div class="ulsec">${label}</div>${rows}`:'';
    const dpRows=(S.dp||[]).map(d=>{const dp=DRAMATIS[d.key];if(!dp)return '';const p=dp.profile;
      const tip=`${dp.name} (${dp.grade}) — ${[p.M,p.WS,p.BS,p.S,p.T,p.W,p.I,p.A,p.Ld].join('/')} · Rating +${dp.rating}`;
      return urow((d.name?d.name:dp.name),1,tip.replace(/"/g,'&quot;'),(typeof dpHireCost==='function'?dpHireCost(d.key):dp.hire));}).join('');
    ulEl.innerHTML=(heroRows||hsRows||dpRows||henRows||vehRows)?seg('Heroes',heroRows)+seg('Dramatis Personae',dpRows)+seg('Hired Swords',hsRows)+seg('Henchmen',henRows)+seg('Vehicles',vehRows)+`<div class="ulrow ultot"><span><b>Total spent</b></span><span class="ulg"><b>${totalSpent()} gc</b></span><span class="uln"></span></div>`:'';
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
  const leaderDead=leaderUnitDied();
  if(req && !leaderDead && countOf(req.id)<1) w.push(`A ${req.name} is required.`);
  if(leaderDead){
    if(S.wb==='undead' && !S.models.some(m=>m.uid_def==='necro'))
      w.push('The Vampire is slain and no Necromancer remains to take over — the warband collapses into a pile of bones (you may buy a new Vampire after the next game).');
    else if(['possessed','carnival'].includes(S.wb) && leaderUid())
      w.push(`Leader slain: ${( (S.models.find(m=>m.uid===leaderUid())||{}).name )||'the successor'} takes command and, the first time they would advance, may learn a spell/prayer instead of rolling on the Advance table.`);
    else if(S.wb==='caravans'){
      if(leaderUid())
        w.push(`Merchant slain: ${( (S.models.find(m=>m.uid===leaderUid())||{}).name )||'the successor'} takes command, counts as the Merchant for all purposes and may choose from the Merchant's special skills.`);
      else
        w.push('The Merchant is lost and no model can become the leader — buy an Apprentice as soon as possible (after the next game) to take over as the new Merchant.');
    }
  }
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
export function setSecOpen(which,v){ v=!!v;
  if(which==='hr')hrOpen=v; else if(which==='hs')hsOpen=v; else if(which==='dp')dpOpen=v; else if(which==='camp')campOpen=v; }
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
      else if(k==='hireNewLeader') v = h[k] ? 'allowed (may re-hire a leader after the original is slain)' : null;
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
    return `<label class="hr-row hr-slider">${hrChk(k)}<span class="hl">${label}</span><span class="hv"><input id="hv-${k}" type="number" min="0" max="500" step="1" value="${v}" onchange="setHouseNum('${k}',this.value)">%</span><span class="hc"><input type="range" min="25" max="200" step="1" value="${v}" oninput="HR().${k}=Number(this.value);document.getElementById('hv-${k}').value=this.value;renderSidebar();renderRoster();" onchange="render()"></span></label>`; }
  function bool(k,label){ return `<label class="hr-chk"><input type="checkbox" ${h[k]?'checked':''} onchange="setHouseBool('${k}',this.checked)"> <span>${label}</span>${hrIsDefault(k)?'':'<span class="hr-dev" title="Deviates from the standard \u2014 recorded on export">HR</span>'}</label>`; }
  const active=houseActive();
  box.innerHTML=`<details class="sec-details no-print" ${hrOpen?'open':''} ontoggle="setSecOpen('hr',this.open)"><summary class="sec-sum">⚖ House Rules ${active?'<span class="hr-on">active</span>':''}<button class="tiny ghost no-print" style="float:right" onclick="event.preventDefault();resetHouse()">reset all</button></summary><div class="sec-body">
   <div class="hr-grid no-print">
    <fieldset class="hr-fs"><legend>Warband composition</legend>
      ${num('startGold','Starting gold',0,null,5,'blank = warband default')}
      ${num('min','Min. models',0,null,1,'blank = default')}
      ${num('max','Max. models',0,null,1,'blank = default')}
      ${num('heroes','Max. Heroes',1,12,1,'default 6')}
      ${bool('rangedCapOn','Limit ranged models')}
      ${num('rangedCap','↳ max ranged %',0,100,5,'% of warband (0 = pure melee)')}
    </fieldset>
    <fieldset class="hr-fs"><legend>Leader &amp; advancement</legend>
      ${bool('hireNewLeader','Allow hiring a replacement leader after the original is slain')}
      <div class="hr-note">By the rules a slain leader is replaced by the Hero with the highest Leadership, and no new one may be hired.</div>
      ${bool('allSkills','Heroes may pick any skill list')}
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
    <fieldset class="hr-fs"><legend>Equipment access</legend>
      ${bool('eqLimitOn','Enforce the equipment list (standard — untick to allow anything)')}
      ${bool('freeMarket','Free market (ignore eligibility)')}
      ${bool('miscHench','Misc items available to Henchmen')}
      ${bool('rerollOne','Only one re-roll item / warband')}
    </fieldset>
    <fieldset class="hr-fs"><legend>Hired Swords</legend>
      <label class="hr-row"><span></span><span class="hl">Grades</span><span class="hc">${['1a','1b','1c','2a'].map(g=>`<label class="hr-gbox"><input type="checkbox" ${(h.hsGrades&&h.hsGrades[g]!==false)?'checked':''} onchange="setHsGrade('${g}',this.checked)">${g}</label>`).join('')}</span><span class="hs">tick = included</span></label>
      ${bool('hsEquip','Hired Swords & Dramatis Personae may buy extra equipment')}
      <div class="hr-note">RAW their equipment is fixed \u2014 with this on they may buy from the warband\u2019s Hero equipment chart.</div>
    </fieldset>
    <fieldset class="hr-fs"><legend>Display</legend>
      ${bool('showRarity','Show item rarity on cards')}
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
  // Shrinking the group by hand removes members from the end; their names go
  // with them, or they would reappear on different men later.
  if(Array.isArray(m.names) && m.names.length>q){ m.names=m.names.slice(0,q);
    if(!m.names.some(x=>(x||'').trim())) delete m.names; }
  /* Men joining a blooded group are dearer: two gold crowns for each experience
     point they bring. Charged once, here, and added to what this group has
     already paid - never recalculated from its current experience, so the men
     who earned that experience in play are not revalued behind the player's
     back. Taking the number back down returns the surcharge for the men
     removed, but never more than was actually paid. A warrior who DIES goes
     through the death path instead, where nothing is refunded. */
  const _was=Math.max(1,Number(m.qty)||1);
  if(q>_was) m.xpPaid=(Number(m.xpPaid)||0)+(q-_was)*henchRecruitSurcharge(m);
  else if(q<_was) m.xpPaid=Math.max(0,(Number(m.xpPaid)||0)-(_was-q)*henchRecruitSurcharge(m));
  m.qty=q; render(); }
export function toggleEq(u,nm,on){ const m=S.models.find(x=>x.uid===u); if(on)m.eq[nm]=1; else delete m.eq[nm]; render(); }
export function setEqQty(u,nm,q){
  if(/^Dolch/i.test(nm)){ const _m=S.models.find(x=>x.uid===u); if(_m) _m._noDagger=(Number(q)||0)<=0; } const m=S.models.find(x=>x.uid===u); q=Math.max(0,Math.min(9,Number(q)||0));
  if(q<=0) delete m.eq[nm]; else m.eq[nm]=q; render(); }
export function addRare(u,de){ if(!de) return; const m=S.models.find(x=>x.uid===u); m.rare=m.rare||{};
  if(m.rare[de] && !isUpgrade(de)){ m.rare[de].q=(Number(m.rare[de].q)||1)+1; }
  else if(!m.rare[de]){ const o={q:1,paid:catalogDefaultPaid(CATALOG.find(x=>x.de===de))};
    if(isUpgrade(de)){ const t=upgradeTargets(m,de); o.on=t.length?t[0].nm:null; o.paid=upgradePaid(m,de,o.on); }
    m.rare[de]=o;
    const _it=CATALOG.find(x=>x.de===de);
    logEvent('item',`${m.name||unitDef(m.uid_def).name} acquired ${_it?_it.en:de}${o.paid?` (${o.paid} gc)`:''}.`,{uid:m.uid,name:m.name||unitDef(m.uid_def).name,item:de,itemEn:_it?_it.en:de,paid:o.paid||0}); }
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
/* Every save/export carries goldNow — the gold figure as DISPLAYED at the
   moment of saving. On import it is taken over verbatim (treasury is set so
   the display shows exactly this amount) instead of being re-derived from the
   imported models, so price/data changes between versions can never shift a
   saved warband's gold. We trust the importer's file. */
export function exportState(){ return Object.assign({},S,{goldNow:goldCurrent()}); }
export async function saveRoster(){
  const name=document.getElementById('savename').value.trim()|| (S.name||'roster');
  const data={...exportState(), name:S.name||name, _saved:name};
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
  hideWelcome();
  replaceState({wb:data.wb,subtype:data.subtype,name:data.name||'',budget:data.budget||WARBANDS[data.wb].gold,models:data.models||[],hired:data.hired||[],dp:data.dp||[],leaderUid:data.leaderUid||null,campaign:data.campaign||{on:false,districts:{}},stash:data.stash||{wyrd:0,gold:null,items:[]},fallen:data.fallen||[]});
  S.house=Object.assign(houseDefaults(), data.house||{});
  S.mark=data.mark||'';
  if(!S.stash||typeof S.stash!=='object') S.stash={wyrd:0,gold:0,items:[]};
  if(!Array.isArray(S.stash.items)) S.stash.items=[];
  if(!S.fallen) S.fallen=[];
  campState();   // fills in round/log/battles for saves written before the chronicle
  S.models.forEach(m=>{ if(!m.eq)m.eq={}; if(!m.mut)m.mut=[]; if(!m.adv)m.adv={}; if(!m.skills)m.skills=[]; if(!m.inj)m.inj=[]; if(!m.spells)m.spells=[]; });
  // Saved gold is adopted verbatim: display = goldNow, whatever the imported
  // models would re-price to. (Older saves without goldNow keep the treasury.)
  if(data.goldNow!=null && isFinite(Number(data.goldNow))) S.stash.gold=Number(data.goldNow)+totalSpent();
  resyncUid();
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
/* A file name that says which warband, at what point in the campaign, and when
   it was written - so a folder of exports from several game nights can be told
   apart at a glance. */
export function stampedName(){ const parts=[safeName()];
  const c=(S.campaign&&S.campaign.on)?S.campaign:null;
  if(c) parts.push(Number(c.round)>0?('battle'+Number(c.round)):'setup');
  parts.push((new Date()).toISOString().slice(0,10));
  return parts.join('_'); }
export function rosterName(){ return (document.getElementById('savename')?.value||S.name||'roster'); }
export function dl(content,filename,mime){ const blob=new Blob([content],{type:mime}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); setTimeout(()=>{ try{document.body.removeChild(a); URL.revokeObjectURL(a.href);}catch(e){} },100); }
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
/* Standalone rare/magic items carried by a model (inline weapon upgrades are
   excluded — they already show attached to their base weapon in eqDisplayParts). */
export function rareDisplayParts(m){ const out=[]; const r=m.rare||{};
  for(const de in r){ if(inlineUpgradeActive(de)) continue; const it=CATALOG.find(x=>x.de===de);
    const q=Number(r[de].q)||1; out.push((q>1?q+'× ':'')+(it?it.en:de)); }
  return out;
}

/* ---- schöner Text (BattleScribe-Stil) ---- */
export function buildText(){
  const wb=WARBANDS[S.wb];
  const spent=totalSpent(), rating=totalRating();
  // Promoted henchmen (Lad's Got Talent) file under Heroes; a vehicle is
  // equipment and gets its own section (and, via modelRating, no rating).
  const heroes=S.models.filter(m=>isHeroModel(m)&&!unitDef(m.uid_def).vehicle);
  const hench=S.models.filter(m=>!isHeroModel(m)&&unitDef(m.uid_def).t==='hen'&&!unitDef(m.uid_def).vehicle);
  const vehicles=S.models.filter(m=>unitDef(m.uid_def).vehicle);
  const sum=arr=>({gc:arr.reduce((s,m)=>s+modelTotalCost(m),0), r:arr.reduce((s,m)=>s+modelRating(m)*(isHeroModel(m)?1:m.qty),0)});
  const hS=sum(heroes), nS=sum(hench), vS=sum(vehicles);
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
    const tnm=m.promoted?`Hero ${def.name}`:def.name;
    const nm=(m.name&&m.name!==def.name)?`${tnm} „${m.name}“`:tnm;
    L.push(`${nm} [${modelUnitCost(m)} gc, ${modelRating(m)} Warband Rating]${det(m)}`); });
  L.push(`## Henchmen [${nS.r} Warband Rating, ${nS.gc} gc]`);
  hench.forEach(m=>{ const def=unitDef(m.uid_def);
    const nm=(m.name&&m.name!==def.name)?`${def.name} „${m.name}“`:def.name;
    L.push(`${nm} [${modelTotalCost(m)} gc, ${modelRating(m)*m.qty} Warband Rating]:`);
    L.push(`• ${m.qty}× ${def.name} [${modelUnitCost(m)} gc, ${modelRating(m)} Warband Rating]${det(m)}`); });
  if(vehicles.length){
    L.push(`## Vehicles [${vS.gc} gc]`);
    vehicles.forEach(m=>{ const def=unitDef(m.uid_def);
      const nm=(m.name&&m.name!==def.name)?`${def.name} „${m.name}“`:def.name;
      L.push(`${nm} [${modelTotalCost(m)} gc]${det(m)}`); });
  }
  const st=S.stash||{wyrd:0,gold:0,items:[]};
  if((st.wyrd||0)||(st.gold||0)||(st.items&&st.items.length)){
    L.push(`## Stash / Store`);
    if(st.wyrd) L.push(`• Wyrdstone shards: ${st.wyrd}`);
    if(st.gold) L.push(`• Gold in store: ${st.gold} gc`);
    (st.items||[]).forEach(it=>L.push(`• ${it.qty}× ${it.name}`));
  }
  L.push('');
  L.push('— — — — — — — — — — — — — — — — — — — —');
  L.push('MORDHEIM-DATA: '+JSON.stringify(exportState()));
  return L.join('\n');
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
/* Copying one field at a time matches how TTS is filled in: the name goes in
   one box, the description in another. */
function _copyFrom(id,msg){ const ta=document.getElementById(id); if(!ta) return;
  const txt=ta.value; const ok=()=>flash(msg);
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(ok,()=>{try{ta.select();document.execCommand('copy');ok();}catch(e){}}); }
  else { try{ta.select();document.execCommand('copy');ok();}catch(e){} } }
export function copyTtsName(){ _copyFrom('ttsname','Name copied.'); }
export function copyTtsBoth(){ const n=document.getElementById('ttsname'), t=document.getElementById('ttstext');
  const txt=((n&&n.value)||'')+'\n'+((t&&t.value)||'');
  const ok=()=>flash('Name and description copied.');
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok,ok); else ok(); }
export function openExport(){ if(!S.models.length){ flash('No warriors in the warband yet.'); return; }
  document.getElementById('extextwrap').style.display='none';
  document.getElementById('exportmodal').style.display='flex'; }
export function closeExport(){ document.getElementById('exportmodal').style.display='none'; }
export function exportTool(){ dl(JSON.stringify(exportState(),null,2),safeName()+'.json','application/json'); closeExport(); }
export function exportText(){ const t=buildText(); document.getElementById('extext').value=t; document.getElementById('extextwrap').style.display='block'; }
export function downloadText(){ dl(buildText(),stampedName()+'.txt','text/plain;charset=utf-8'); }
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
try{ if(typeof renderWelcome==='function') renderWelcome(); }catch(e){}


/* ============================================================================
   OFFIZIELLES ROSTER-SHEET (freebooters.org v1.6) — echtes PDF-Overlay.
   Das Original-PDF hat keine Formularfelder; die Werte werden per pdf-lib an
   vermessenen Koordinaten aufgedruckt. HS/DP kommen auf ein eigenes Zusatzblatt
   (die 6 Heldenfelder sind für die max. 6 Helden reserviert).
   ========================================================================== */

export function raceEN(k){ return k?(RACE_EN[k]||k):''; }













/* ---- Globale Bindung ----
   Das Markup nutzt onclick="…"; im Modul-Scope sind Funktionen nicht global.
   Liste wird beim Split automatisch erzeugt. */
Object.assign(window, {
  HR, _modelHasRanged, _stripParen, _svCombine, aDisp, abilityEN,
  abilityInfo, abilitySection, activeDistrictEffects, addAdv, addHsAdv, addHsSkill,
  addHsSpell, addHsSpellFromAdv, addInj, addRare, addSkill, addSkillFromSel,
  addSpell, addSpellFromAdv, addUnit, adjGoldCurrent, adjPrice, advSection,
  applyFreeDaggers, applyState, attachedBlocks, attachedSection, availHeroCats, backToPicker,
  buildText, campDistricts, campShowJSON, campShowText, campToggle,
  campaignJSON, campaignTextReport, canAdv, canBeLeader, casterLore, casterMagic,
  catLabel, catalogDefaultPaid, catalogEligible, chooseWb, closeCampaignIO, closeExport,
  closeImport, closeTts, copyCampaign, copyExport, copyTts, copyTtsName, copyTtsBoth, countOf,
  daggerNameFor, defaultLeaderUid, defaultWarbandName, delHsSkill, delHsSpell, delRoster,
  dispMod, districtState, dl, downloadCampaignJSON, downloadCampaignText, downloadText,
  dpCount, dpEligibility, dpGradeAllowed, dpHireCost, dpHireTotal, dpList,
  dpRatingTotal, dpRosterCards, dpSetName, dpUpkeepTotal, effProfile, enItem,
  enRules, ensureFreeDagger, entryOf, eqCost, eqDisplayParts, eqListFor,
  eqSection, eqSummaryParts, eqWeaponLimit, eqWeaponsOf, exportCampaign,
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
  mutCost, mutEN, mutKindFor, netMod, noteLines, openCampaignIO, openExport, openImport, openLoad,
  passNameFilter, passStatFilter, pickSub, priceMod, promoteHench, promotedSkillLists,
  raceEN, rangedModelCount, rareCost, rareEligibleItems, remAdv, remHsAdv,
  remHsSkillIdx, remInj, remSkill, remSpell2, removeRare, removeUnit,
  killHench, killHenchMember, killHero, removeFallenAt, setFallenGroupOpen, setRareOpen, stripGearSettled, undoFallen,
  memberCount, memberName, memberNamed, memberNames, memberDefaultName, setMemberName, setMemberOpen,
  henchMembersBlock, promoteHench,
  welcomeNew, welcomeImport, renderWelcome, worthAdvOf, abilityMentioned,
  fallenGoldOf, fallenGoldLost, fallenExpEarned, fallenExpLost,
  loseValueOnDeath, restoreValueOnUndo, henchRecruitCost, henchRecruitSurcharge,
  addBattle, addLogNote, advanceRound, campRound, campState, editBattle, editLogText,
  logEvent, removeBattle, removeLogAt, roundLabel, setRound,
  chronicleBlock, districtName, wbName, warbandOptions, setChrOpen,
  postbattleBlock, postbattleState, pbRound, pbStepDone, pbSetStepDone,
  pbExploreDice, pbWonThisRound, pbHeroesOOA, pbSearchingHeroes, pbActiveStep, pbStepBody,
  pbSellWyrd, pbClearWyrd, wyrdPrice, wyrdSizeBand, warbandSize,
  cfGet, cfNew, cfClose, cfSetName, cfSetRound, cfImportWarband, cfRemoveWarband,
  cfAddCurrent, cfExport, cfImportFile, cfMergedLog, cfAllBattles, cfStats,
  cfPickFile, cfPickWarband, cfAddCurrentPrompt, campaignFileBlock,
  cfToggleFoothold, cfClearDistrict, cfXpOverview, cfMergeFrom, cfPickMerge, cfAllBattlesMerged,
  addCasualty, campCasualties, casualtyStats, casualtyText, casualtyType, noteCasualtyOutcome,
  pendingCasualtyFor, removeCasualty, resolveCasualty, resolveCasualtyRoll, setCasNote,
  casualtyRollOptions, casualtyIsHero, casualtyIsOurs, casualtyModel,
  casDraft, casFormBlock, casListBlock, cancelCasForm, openCasForm, saveCasForm, setCasField,
  characterTimeline, characterRoster, campaignAnalysis, narrativeReport,
  xpLedger, grantXp, pendingXp, pendingXpFor, pendingXpTotal, applyPendingXp,
  clearPendingXp, awardBattleXp, diffStages, foundingMembers, xpBarBlock, canEarnXp, modelLabel,
  applyBattleResults, outstandingCasualties, unrolledCasualties,
  snapRows, districtsAt, totalsAt, stampedName, recordSitOuts,
  exportNarrative, exportAnalysis, snapshotStage, stageSnapshots,
  battleFormBlock, cancelBattleForm, cancelNoteForm, noteFormBlock,
  openBattleForm, openNoteForm, saveBattleForm, saveNoteForm,
  setDraftField, setNoteDraft, addDraftSide, remDraftSide, setDraftSide, editBattleForm,
  draftIncludesUs, addDraftSideMe,
  addDraftCas, remDraftCas, setDraftCas, battleDraft,
  render, renderAddMenu, renderCampaign, renderDramatis, renderExtra, renderHiredSwords,
  renderHouse, renderPicker, renderRoster, renderSidebar, renderStash, rerollItemCount,
  resetHouse, rosterName, ruleNameEN, ruleSplitBold, safeName,
  saveRoster, setAdvOpen, setCaster, setDistrict, setDpFilter, setDpGrade,
  cfFootholdsAt, cfControlAt, cfTerritory, districtStatus, claimFoothold,
  loseFoothold, cfSetFoothold, applyBattleTerritory,
  battleSides, sideModels, sideName, sideWb,
  setEqQty, setExp, setExpJump, setGoldCurrent, setHeirloom, setHouseActive, setSecOpen,
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
  totalModels, totalRating, totalSpent, translateTerms, ttsOpen, ttsOpenMember, ttsOpenDP,
  ttsOpenHS, ttsText, ttsTextHS, unhireDP, unhireHS, unitBaseCost,
  unitDef, unitFamilies, unitMax, unpromote, upgradePaid, upgradeTargets,
  vehRules, vehRulesBlock, warbandMax, wbTypeSlug, weaponUpgradesFor, xpBar,
  xpThresholds,
});
