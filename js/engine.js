/* ===================== ENGINE =====================
 * Pure rules & cost calculation for the roster: unit lookup, equipment/
 * mutation/rare-item costs, weapon-upgrade pricing, warband totals, gold and
 * rating. No DOM, no rendering — every function here is a pure read over the
 * state object S (plus the game data), so it can be unit-tested directly and
 * called from anywhere.
 *
 * Split out of app.js as step 2 of breaking up the monolith (after state.js).
 * engine.js imports a handful of helpers back from app.js (itemFamily,
 * itemHalfActive, catalogEligible, priceMod, activeDistrictEffects) and the
 * Hired-Sword/Dramatis total helpers — the same circular-import arrangement
 * already used across app.js/pdf.js/tts.js. It is safe because none of those
 * are called at module-evaluation time, only from inside function bodies.
 */
import { ARMOUR_SV, BRACE_PLURAL, CATALOG, DRAMATIS, GSN_BRACE, HIREDSWORDS, LISTS, MUTATIONS, MUTSETS, SV_SKILL_BASE, SV_SKILL_BONUS, UPGRADES, WARBANDS } from '../data/index.js';
import { S, HR } from './state.js';
import { activeDistrictEffects, catalogEligible, dpHireTotal, hsChosenEq, hsEqParts, hsEqTotal, hsEquipOn, hsHireTotal, hsSizeBonus, itemFamily, itemHalfActive, priceMod } from './app.js';

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

export function hireCostOf(TABLE,key){ const e=TABLE[key]; if(!e) return 0; return Math.floor((e.hire||0)*priceMod('hire',key)); }

export function hsHireCost(key){ return hireCostOf(HIREDSWORDS,key); }

export function dpHireCost(key){ return hireCostOf(DRAMATIS,key); }

export function unitDef(id){return WARBANDS[S.wb].units.find(u=>u.id===id);}

export function countOf(id){return S.models.filter(m=>m.uid_def===id).length;}

export function modelsOf(id){const def=unitDef(id); if(def.t==='hero') return countOf(id);
  return S.models.filter(m=>m.uid_def===id&&!m.promoted).reduce((s,m)=>s+(m.qty||1),0);}

export function unitMax(def){ if(S.wb==='maraudersofchaos'&&S.subtype==='kurgan'&&def.id==='warhound') return null; return def.max; }

export function warbandMax(){ const h=HR(); if(h.max!==''&&h.max!=null) return Number(h.max); const wb=WARBANDS[S.wb]; if(S.wb==='maraudersofchaos'&&S.subtype==='hung') return 12; let mx=wb.max; if(S.wb==='carnival'&&(S.models||[]).some(m=>m.uid_def==='cart')) mx+=2; mx+= (typeof hsSizeBonus==='function'?hsSizeBonus():0); return mx; }

export function eqListFor(def){ let list=LISTS[def.eq]; if(!list) return list;
  if(S.wb==='maraudersofchaos'&&S.subtype==='kurgan'&&(def.eq==='marChaosHero'||def.eq==='marChaosHench')){
    list=JSON.parse(JSON.stringify(list)); list.Fernkampf=list.Fernkampf||[];
    if(!list.Fernkampf.some(x=>x[0]==='Bogen')) list.Fernkampf.push(['Bogen',10]);
  } return list; }

export function eqWeaponLimit(m){ const def=unitDef(m.uid_def); const list=def?eqListFor(def):null; if(!list) return {cc:0,missile:0};
  let cc=0,missile=0;
  (list.Nahkampf||[]).forEach(([nm])=>{ const q=Number(m.eq[nm])||0; if(!q) return; cc += (nm.indexOf('1. gratis')>=0)?Math.max(0,q-1):q; });
  (list.Fernkampf||[]).forEach(([nm])=>{ const q=Number(m.eq[nm])||0; if(!q) return; missile += (BRACE_PLURAL[nm]&&q>=2)?1:q; });
  return {cc,missile}; }

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

/* Experience a Henchman group has earned raises what one of its men is worth:
   "you must add 2 gold crowns to their cost for each extra Experience point
   they add to the warband's total" (mordheimer, Trading). A new man joins with
   the group's experience, so recruiting into a seasoned group costs that much
   more than the bare price on the warband list.
   Heroes are not priced this way - their experience is their own. */
export const HENCH_XP_GC=2;
export function henchXpCost(m){ const def=unitDef(m.uid_def);
  if(!def || def.t!=='hen' || (typeof isHeroModel==='function' && isHeroModel(m))) return 0;
  return HENCH_XP_GC*Math.max(0, Number(m.exp)||0); }
export function modelUnitCost(m){ // cost for ONE model of this entry
  const def=unitDef(m.uid_def);
  return unitBaseCost(def) + henchXpCost(m) + eqCost(m) + mutCost(m) + rareCost(m) - heirloomDiscount(m);
}

export function _stripParen(s){ return String(s).replace(/\s*\([^)]*\)\s*/g,' ').trim(); }

export function rareCost(m){ const r=m.rare||{}; let c=0; for(const de in r){ c+=(Number(r[de].q)||0)*(Number(r[de].paid)||0); } return c; }

export function catalogDefaultPaid(item){ if(!item) return 0; let v;
  if(typeof item.cost==='number') v=item.cost;
  else { const s=String(item.cost); if(/×|x\s*Preis|Preis/i.test(s)) v=0; else { const mt=s.match(/\d+/); v=mt?Number(mt[0]):0; } }
  if(v>0 && typeof itemHalfActive==='function' && itemHalfActive(item.en)) v=Math.floor(v*0.5);
  return v; }

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

export function startGold(){ const h=HR();
  if(h && h.startGold!=='' && h.startGold!=null && !isNaN(Number(h.startGold))) return Number(h.startGold);
  const wb=WARBANDS[S.wb]; if(!wb) return 500;
  const sub=(S.subtype&&wb.subtypes)?wb.subtypes.find(x=>x.key===S.subtype):null;
  return (sub&&sub.gold!=null)?sub.gold:(wb.gold||500); }
/* EIN Gold-Wert: das aktuelle Gold der Warband. Intern liegt im Stash die
   "Kasse" (treasury); angezeigt wird überall treasury minus Ausgaben. Kauft man
   etwas, sinkt der Wert sofort - oben im Warband-Panel wie unten im Stash. */

export function goldTreasury(){ const g=(S.stash&&S.stash.gold); return (g==null||g==='')?startGold():(Number(g)||0); }

/* What was spent on warriors who have since been killed. Their cost is gone -
   the gold was paid and their equipment went with them - so it must keep
   counting against the treasury. Without this, a death removed the warrior from
   the spending and the warband appeared to be handed his cost back in gold. */
export function fallenSunk(){ return (S.fallen||[]).reduce((s,e)=>{
  if(!e||!e.m) return s;
  const snap=Object.assign({},e.m,{qty:1});   // one man, whatever the group held
  return s+modelUnitCost(snap); },0); }
export function goldCurrent(){ return goldTreasury()-totalSpent()-fallenSunk(); }

export function goldAvailable(){ return goldTreasury(); }

export function totalSpent(){ return S.models.reduce((s,m)=>s+modelTotalCost(m),0)+ (typeof hsHireTotal==='function'?hsHireTotal():0)+ (typeof dpHireTotal==='function'?dpHireTotal():0)+ (typeof hsEqTotal==='function'?hsEqTotal():0); }

export function totalModels(){ return S.models.reduce((s,m)=>{const d=unitDef(m.uid_def); if(d&&d.vehicle) return s; return s+(d&&d.t==='hen'?m.qty:1);},0); }

export function isHeroModel(m){ const def=unitDef(m.uid_def); return (def&&def.t==='hero')||!!m.promoted; }

export function totalHeroes(){ return S.models.filter(m=>isHeroModel(m)).length + ((S.hired||[]).filter(h=>HIREDSWORDS[h.key]&&HIREDSWORDS[h.key].slot).length); }

export function modelRating(m){ const def=unitDef(m.uid_def); return (def.large?20:5)+Number(m.exp||0); }

/* ---- Save-value & stat helpers (moved from app.js; pure armour-save maths) ---- */
/* Profilwerte können "3(4)", "D6", "—" sein: numerisch auswerten (Klammerwert = effektiv) */
export function statNum(v){ if(v==null) return null;
  const s=String(v); const par=s.match(/\((\d+)\)/); if(par) return Number(par[1]);
  const m=s.match(/\d+/); return m?Number(m[0]):null; }
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
