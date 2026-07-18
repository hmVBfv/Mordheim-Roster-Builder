/* Backward compatibility of the save format.
 *
 * Save files are the user's data and must keep loading across versions. This
 * test pins a FROZEN old-format save (written before the fallen list, rare
 * items and the newer house rules existed) and asserts it still loads cleanly.
 *
 * Rules for changing the save format:
 *  - Only ADD keys, never rename or remove existing ones.
 *  - Every new key must have a default in applyState (`data.x||…`) or in
 *    houseDefaults(), so old files without it still work.
 *  - Do not edit OLD_SAVE below. It represents files already on disk out there.
 */
import assert from 'assert';
import * as fs from 'fs';

const el=(id)=>({id,style:{},value:'',checked:false,set innerHTML(v){this._h=v;},get innerHTML(){return this._h||'';},
  appendChild(){},addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}),
  querySelectorAll:()=>[],querySelector:()=>null,click(){},focus(){},select(){},setAttribute(){},removeAttribute(){},remove(){},closest:()=>null});
const store={};
globalThis.document={getElementById:(id)=>store[id]||(store[id]=el(id)),createElement:el,addEventListener(){},body:{appendChild(){}},querySelectorAll:()=>[],querySelector:()=>null};
globalThis.window={addEventListener(){},scrollTo(){},innerWidth:1000,matchMedia:()=>({matches:false,addEventListener(){}}),storage:{list:async()=>({keys:[]})}};
globalThis.Blob=function(){}; globalThis.URL.createObjectURL=()=>''; globalThis.confirm=()=>true; globalThis.alert=()=>{};
globalThis.fetch=async(u)=>{const p=decodeURIComponent(new URL(u).pathname);
  return {ok:fs.existsSync(p),json:async()=>JSON.parse(fs.readFileSync(p,'utf8')),arrayBuffer:async()=>fs.readFileSync(p).buffer};};

const app=await import(new URL('../js/app.js', import.meta.url).href);
const eng=await import(new URL('../js/engine.js', import.meta.url).href);
const state=await import(new URL('../js/state.js', import.meta.url).href);

/* FROZEN — do not edit. An export from before fallen/rare/hireNewLeader. */
const OLD_SAVE={
  wb:'skaven', subtype:null, name:'Alte Bande', budget:500,
  models:[
    {uid:1, uid_def:'adept', name:'Assassin Adept', exp:20, qty:1,
     eq:{'Schwert':1}, mut:[], adv:{}, skills:[], inj:[], spells:[]},
    {uid:2, uid_def:'vermin', name:'Verminkin', exp:5, qty:3,
     eq:{'Dolch (1. gratis)':1}, mut:[], adv:{}, skills:[], inj:[], spells:[]}
  ],
  hired:[], dp:[], leaderUid:1,
  campaign:{on:false, districts:{}},
  stash:{wyrd:0, gold:120, items:[]},
  house:{startGold:'', min:'', max:'', heroes:6, priceAll:100}   // partial, old key set
  // deliberately absent: fallen, models[].rare, house.hireNewLeader, house.eqLimitOn
};

// --- an old save still loads ---
app.applyState(JSON.parse(JSON.stringify(OLD_SAVE)));
assert.strictEqual(state.S.models.length, 2, 'old save keeps its models');
assert.ok(Array.isArray(state.S.fallen) && state.S.fallen.length===0, 'missing `fallen` defaults to an empty list');
assert.strictEqual(state.S.house.hireNewLeader, false, 'a house rule absent from the file falls back to its default');
assert.strictEqual(state.S.house.priceAll, 100, 'house values present in the file are preserved');
assert.strictEqual(state.S.stash.gold, 120, 'stash gold is preserved');
assert.strictEqual(eng.totalModels(), 4, 'totals compute from an old save (1 hero + 3 henchmen)');

// --- the new code paths tolerate models without the newer fields ---
assert.deepStrictEqual(app.rareDisplayParts(state.S.models[0]), [], 'rare display is safe on a model without `rare`');
assert.strictEqual(typeof app.xpBar(state.S.models[0]), 'string', 'xpBar is safe on an old model');
assert.doesNotThrow(()=>{ app.renderRoster(); app.renderSidebar(); }, 'an old save renders without throwing');

// --- round trip: export -> import keeps everything ---
app.applyState(JSON.parse(JSON.stringify(state.S)));
assert.strictEqual(state.S.models.length, 2, 'a re-imported save keeps its models');

// --- the readable-text export carries the data and survives a round trip ---
app.killHench(state.S.models.find(m=>m.uid_def==='vermin').uid);
const txt=app.buildText();
assert.ok(!/Fallen/i.test(txt.split('MORDHEIM-DATA')[0]), 'fallen warriors stay out of the readable text');
app.importText(txt);
assert.strictEqual(state.S.fallen.length, 1, 'the text export round-trips the fallen list');
assert.strictEqual(state.S.models.length, 2, 'the text export round-trips the living models');

// --- old readable-text (no fallen key) still imports ---
app.importText('Roster text\nMORDHEIM-DATA: '+JSON.stringify(OLD_SAVE));
assert.strictEqual(state.S.models.length, 2, 'an old readable-text export still imports');
assert.ok(Array.isArray(state.S.fallen), 'fallen is initialised for an old text import');

// --- new saves stay readable by older builds: legacy keys must all survive ---
const fresh=JSON.parse(JSON.stringify(state.S));
['wb','subtype','name','budget','models','hired','dp','leaderUid','campaign','stash','house']
  .forEach(k=>assert.ok(k in fresh, `legacy top-level key "${k}" must still be written`));
['uid','uid_def','name','exp','qty','eq','mut','adv','skills','inj','spells']
  .forEach(k=>assert.ok(k in fresh.models[0], `legacy model key "${k}" must still be written`));
assert.ok(Array.isArray(fresh.fallen), 'new keys are additive (fallen), not replacements');

console.log('Save-format compatibility: OK (old save loads, defaults fill in, round trips, legacy keys preserved)');
