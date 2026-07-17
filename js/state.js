/* ===================== STATE =====================
 * Central mutable warband state (S) and the model-id counter (uid).
 *
 * Split out of app.js as step 1 of breaking the monolith into
 * state / engine / render. `S` is reassigned wholesale in a couple of
 * places (choosing a warband, loading a saved roster) — because ES module
 * imports are live but read-only bindings, that reassignment has to happen
 * *inside this module* (via replaceState()), not in the modules that import
 * S. Everywhere else, code just mutates properties on S directly
 * (`S.foo = …`), which works fine through the live binding.
 *
 * `render` is imported back from app.js — this is the same kind of circular
 * import already used between app.js/pdf.js/tts.js, and it's safe for the
 * same reason: `render` is only ever called from inside a function body
 * (never at module-evaluation time), so by the time it's actually invoked
 * app.js has already finished loading and exporting it.
 */
import { render } from './app.js';

export let S = { wb: null, subtype: null, name: "", budget: 500, models: [] };
export let uid = 1;

/** Hand out the next model id and advance the counter. */
export function nextUid() { return uid++; }

/** Re-sync the counter after loading a roster whose models already have ids. */
export function resyncUid() { uid = Math.max(1, ...S.models.map(m => m.uid)) + 1; }

/** Replace the *contents* of S with a new state object, keeping the same
 *  reference alive for every module that imported S. Do NOT do `S = x`
 *  outside this module — that throws (assignment to an imported binding). */
export function replaceState(newState) {
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, newState);
}

/* ===================== HAUSREGELN (House Rules) ===================== */
export function houseDefaults(){ return {startGold:'',min:'',max:'',heroes:6,priceAll:100,priceArmour:100,priceBP:100,priceMissile:100,clubSurcharge:0,slingSurcharge:0,armourBodyOnly:false,freeDagger:false,miscHench:false,freeMarket:false,allSkills:false,showRarity:false,rangedCapOn:false,rangedCap:0,rerollOne:false,eqLimitOn:true,hireNewLeader:false,hsGrades:{'1a':true,'1b':true,'1c':true,'2a':true},dpGrades:{core:true,'1a':true,'1b':true,'1c':true,'2a':true},hsEquip:false,notes:''}; }
export function HR(){ if(!S.house) S.house=houseDefaults(); else for(const k in houseDefaults()) if(!(k in S.house)) S.house[k]=houseDefaults()[k]; return S.house; }
export function houseActive(){ const h=HR(),d=houseDefaults(); for(const k in d){ if(String(h[k])!==String(d[k])) return true; } return false; }
export function setHouseNum(k,v){ HR()[k]=(v===''||v==null)?'':Math.max(0,Number(v)||0); render(); }
export function setHouseBool(k,v){ HR()[k]=!!v; render(); }
export function setHouseStr(k,v){ HR()[k]=v||''; render(); }
export function setHouseNotes(v){ HR().notes=String(v); const el=document.getElementById('notesprint'); if(el){ el.textContent=v?('House rules / notes: '+v):''; el.style.display=v?'':'none'; } }
export function resetHouse(){ S.house=houseDefaults(); render(); }

/* Dev-console convenience: `window.S = {...}` in devtools still works, it
 * just goes through replaceState() instead of a raw reassignment. */
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'S', { get: () => S, set: v => replaceState(v), configurable: true });
}
