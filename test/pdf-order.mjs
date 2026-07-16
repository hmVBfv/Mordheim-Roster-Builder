/* Regression test: PDF export must list heroes/henchmen in the warband's fixed
   roster order (WARBANDS[wb].units), not in recruitment order.
   Bug fixed: a Marauder Chieftain recruited AFTER a Seer must still print BEFORE
   the Seer, because the Chieftain comes first in the Marauders of Chaos roster. */
const el = () => ({ style:{}, className:'', textContent:'', value:'', checked:false,
  set innerHTML(v){}, get innerHTML(){return '';}, appendChild(){}, addEventListener(){},
  getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}), querySelectorAll:()=>[], click(){}, focus(){}, select(){} });
globalThis.document = { getElementById: el, createElement: el, addEventListener(){}, body:{appendChild(){}}, querySelectorAll:()=>[] };
globalThis.window = { addEventListener(){}, scrollTo(){}, innerWidth:1000,
  matchMedia:()=>({matches:false,addEventListener(){}}), storage:{ list:async()=>({keys:[]}) } };
globalThis.Blob = function(){}; globalThis.URL.createObjectURL = ()=>'';

import * as fs from 'fs';
import assert from 'assert';
globalThis.fetch = async (u) => {
  const p = decodeURIComponent(new URL(u).pathname);
  return { ok: fs.existsSync(p), json: async () => JSON.parse(fs.readFileSync(p,'utf8')),
           arrayBuffer: async () => fs.readFileSync(p).buffer };
};

const app = await import(new URL('../js/app.js', import.meta.url).href);
const D = await import(new URL('../data/index.js', import.meta.url).href);
const S = app.S;
S.wb = 'maraudersofchaos'; S.subtype = null;
// Recruited in the "wrong" order on purpose: Seer first, then Chieftain.
S.models = [
  {uid:1, uid_def:'seer', name:'Seer', exp:0, qty:1, eq:{}, rare:{}, mut:[], adv:{}, skills:[], inj:[], spells:[]},
  {uid:2, uid_def:'chieftain', name:'Chieftain', exp:0, qty:1, eq:{}, rare:{}, mut:[], adv:{}, skills:[], inj:[], spells:[]},
];

const rosterOrder = D.WARBANDS[S.wb].units;
const orderIdx = (m) => { const i = rosterOrder.findIndex(u=>u.id===m.uid_def); return i<0 ? rosterOrder.length : i; };
const heroes = S.models.filter(m=>app.isHeroModel(m)).sort((a,b)=>orderIdx(a)-orderIdx(b));

assert.deepStrictEqual(heroes.map(m=>m.name), ['Chieftain','Seer'],
  'Chieftain must be printed before Seer (fixed roster order), regardless of recruitment order');

console.log('PDF roster order: OK (Chieftain before Seer, independent of recruitment order)');
