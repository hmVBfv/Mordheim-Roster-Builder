/* Regression test for the app.js -> engine.js split.
 *
 * engine.js holds the pure rules/cost calculations. This verifies:
 *  1. app.js re-exports the same engine functions (so the two modules agree
 *     on one implementation, not two divergent copies).
 *  2. The core cost pipeline produces the expected numbers for a known
 *     warband/unit, exercising unitDef -> eqCost -> modelUnitCost -> totals
 *     end to end through the live state object.
 */
import assert from 'assert';
import * as fs from 'fs';

const el = () => ({ style:{}, className:'', textContent:'', value:'', checked:false,
  set innerHTML(v){}, get innerHTML(){return '';}, appendChild(){}, addEventListener(){},
  getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}), querySelectorAll:()=>[], click(){}, focus(){}, select(){} });
globalThis.document = { getElementById: el, createElement: el, addEventListener(){}, body:{appendChild(){}}, querySelectorAll:()=>[] };
globalThis.window = { addEventListener(){}, scrollTo(){}, innerWidth:1000,
  matchMedia:()=>({matches:false,addEventListener(){}}), storage:{ list:async()=>({keys:[]}) } };
globalThis.Blob = function(){}; globalThis.URL.createObjectURL = ()=>'';
globalThis.fetch = async (u) => {
  const p = decodeURIComponent(new URL(u).pathname);
  return { ok: fs.existsSync(p), json: async () => JSON.parse(fs.readFileSync(p,'utf8')),
           arrayBuffer: async () => fs.readFileSync(p).buffer };
};

const engine = await import(new URL('../js/engine.js', import.meta.url).href);
const app = await import(new URL('../js/app.js', import.meta.url).href);
const state = await import(new URL('../js/state.js', import.meta.url).href);

// 1) app.js must re-export the *same* function objects engine.js defines.
for (const fn of ['unitDef','eqCost','mutCost','modelTotalCost','totalModels','goldCurrent','isHeroModel']) {
  assert.strictEqual(app[fn], engine[fn], `app.${fn} must be the same function object as engine.${fn}`);
}

// 2) End-to-end cost pipeline on a known setup.
//    Cult of the Possessed, one Magister (70 gc base) with a free dagger.
state.replaceState({ wb:'possessed', subtype:null, name:'', budget:500,
  models:[], hired:[], dp:[], leaderUid:null, campaign:{on:false,districts:{}},
  stash:{wyrd:0,gold:null,items:[]}, house:state.houseDefaults() });

const mag = engine.unitDef('mag');
assert.ok(mag, 'unitDef must resolve the Magister');
assert.strictEqual(engine.unitBaseCost(mag), mag.cost, 'base cost matches the data');

state.S.models.push({ uid:1, uid_def:'mag', name:'Magister', exp:0, qty:1,
  eq:{}, rare:{}, mut:[], adv:{}, skills:[], inj:[], spells:[] });
engine.ensureFreeDagger(state.S.models[0]);

// A lone Magister with only the free dagger costs exactly its base hire.
assert.strictEqual(engine.modelUnitCost(state.S.models[0]), mag.cost,
  'a Magister with only the free dagger costs its base hire');
assert.strictEqual(engine.totalModels(), 1, 'totalModels counts the Magister');
assert.strictEqual(engine.isHeroModel(state.S.models[0]), true, 'Magister is a hero');

console.log(`Engine split: OK (re-exports identical, Magister base cost ${mag.cost} gc verified end-to-end)`);
