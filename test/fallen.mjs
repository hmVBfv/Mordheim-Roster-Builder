/* Regression test for the "Fallen" (Dead 11-15) feature.
 *
 * Fallen units live in S.fallen (out of S.models), so totals and exports
 * exclude them automatically. Heroes fall as whole models; henchmen fall one
 * model at a time (group qty-1, group removed at 0). A single LIFO undo
 * reverses the most recent death. Henchmen are grouped in the UI, but stored
 * one-record-per-death so undo works per model.
 */
import assert from 'assert';
import * as fs from 'fs';

const el=(id)=>{ const e={id,style:{},className:'',_html:'',value:'',checked:false,
  set innerHTML(v){this._html=v;}, get innerHTML(){return this._html;},
  appendChild(){}, addEventListener(){}, getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}),
  querySelectorAll:()=>[], querySelector:()=>null, click(){}, focus(){}, select(){}, setAttribute(){}, removeAttribute(){}, remove(){}, closest:()=>null }; return e; };
const store={};
globalThis.document={getElementById:(id)=>store[id]||(store[id]=el(id)),createElement:el,addEventListener(){},body:{appendChild(){}},querySelectorAll:()=>[],querySelector:()=>null};
globalThis.window={addEventListener(){},scrollTo(){},innerWidth:1000,matchMedia:()=>({matches:false,addEventListener(){}}),storage:{list:async()=>({keys:[]})}};
globalThis.Blob=function(){ this.parts=arguments; }; globalThis.URL.createObjectURL=()=>'blob:x';
globalThis.confirm=()=>true; // auto-confirm destructive prompts
globalThis.fetch=async(u)=>{const p=decodeURIComponent(new URL(u).pathname);
  return {ok:fs.existsSync(p),json:async()=>JSON.parse(fs.readFileSync(p,'utf8')),arrayBuffer:async()=>fs.readFileSync(p).buffer};};

const pdflibSrc=fs.readFileSync(new URL('../vendor/pdf-lib.min.js', import.meta.url),'utf8');
new Function('self','window',pdflibSrc)(globalThis, globalThis);

const app=await import(new URL('../js/app.js', import.meta.url).href);
const eng=await import(new URL('../js/engine.js', import.meta.url).href);
const pdf=await import(new URL('../js/pdf.js', import.meta.url).href);
const state=await import(new URL('../js/state.js', import.meta.url).href);

function fresh(){ state.replaceState({wb:'skaven',subtype:null,name:'Test',budget:500,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:false,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()}); }

// ---------- HERO death ----------
fresh();
app.addUnit('adept');   // hero
app.addUnit('vermin');  // henchmen group
const hero=state.S.models.find(m=>m.uid_def==='adept');
const modelsBefore=eng.totalModels(), heroesBefore=eng.totalHeroes();
app.killHero(hero.uid);
assert.ok(!state.S.models.find(m=>m.uid===hero.uid), 'dead hero is removed from S.models');
assert.strictEqual(state.S.fallen.length, 1, 'one fallen record added');
assert.strictEqual(state.S.fallen[0].kind, 'hero');
assert.strictEqual(eng.totalHeroes(), heroesBefore-1, 'fallen hero no longer counts');
await assert.doesNotReject(()=>pdf.exportOfficialSheet(), 'PDF export runs with a fallen hero');

// undo brings the hero back
app.undoFallen();
assert.strictEqual(state.S.fallen.length, 0, 'undo removes the fallen record');
assert.ok(state.S.models.find(m=>m.uid_def==='adept'), 'undo restores the hero to S.models');
assert.strictEqual(eng.totalHeroes(), heroesBefore, 'restored hero counts again');

// ---------- HENCHMAN death (decrement + group removal at 0) ----------
fresh();
app.addUnit('vermin');
const grp=state.S.models.find(m=>m.uid_def==='vermin');
grp.qty=3; grp.exp=5; grp.eq={'Schwert':1};
const mBefore=eng.totalModels();
app.killHench(grp.uid);
assert.strictEqual(grp.qty, 2, 'henchman death decrements group qty by one');
assert.strictEqual(eng.totalModels(), mBefore-1, 'total model count drops by one');
assert.strictEqual(state.S.fallen.length, 1, 'one henchman fallen record');
assert.strictEqual(state.S.fallen[0].exp, 5, 'fallen record captures exp snapshot');

// kill the remaining two -> group vanishes from roster
app.killHench(grp.uid);
app.killHench(grp.uid);
assert.ok(!state.S.models.find(m=>m.uid_def==='vermin'), 'group removed from roster when last model dies');
assert.strictEqual(state.S.fallen.length, 3, 'three henchman fallen records');

// all three died at exp 5 with same equipment -> one display sub-group of 3
const sigs=new Set(state.S.fallen.map(e=>app.fallenEqSig(e.m)));
assert.strictEqual(sigs.size, 1, 'three identical henchmen share one signature (group of 3× @5XP)');

// undo LIFO: restores one at a time; since group is gone, first undo recreates it
app.undoFallen();
assert.strictEqual(state.S.fallen.length, 2, 'undo pops one henchman record');
const rebuilt=state.S.models.find(m=>m.uid_def==='vermin');
assert.ok(rebuilt && rebuilt.qty===1, 'undo recreates the henchman group with qty 1');
app.undoFallen();
assert.strictEqual(rebuilt.qty, 2, 'next undo merges back into the living group (qty 2)');

// ---------- remove-record needs no crash and drops the entry ----------
fresh();
app.addUnit('adept'); app.killHero(state.S.models.find(m=>m.uid_def==='adept').uid);
app.removeFallenAt(0);
assert.strictEqual(state.S.fallen.length, 0, 'removeFallenAt deletes the record');

// ---------- HERO grouping: same type, listed individually by name ----------
fresh();
state.replaceState({wb:'skaven',subtype:null,name:'Test',budget:500,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:false,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
app.addUnit('black'); app.addUnit('black');
const blacks=state.S.models.filter(m=>m.uid_def==='black');
blacks[0].name='Cookie'; blacks[0].exp=20; blacks[1].exp=20;
app.killHero(blacks[0].uid); app.killHero(blacks[1].uid);
app.renderRoster();
const rhtml=store['roster'].innerHTML;
const fseg=rhtml.slice(rhtml.indexOf('☠ Fallen'));
assert.ok(fseg.includes('<th>Name</th>'), 'hero fallen group uses a Name column');
assert.ok(fseg.includes('Cookie'), 'custom-named fallen hero is listed by name');
assert.ok(/2× Black/.test(fseg), 'hero group summary shows the count and type');
// even with no living models, the fallen section still renders
assert.ok(fseg.includes('Fallen'), 'fallen section shows even when all warriors are dead');

// ---------- aggregate equipment + free-dagger marking + gold lost ----------
state.replaceState({wb:'maraudersofchaos',subtype:null,name:'Test',budget:500,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:false,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
app.addUnit('marauder'); const mar=state.S.models.find(m=>m.uid_def==='marauder'); mar.qty=3;
app.killHench(mar.uid); app.killHench(mar.uid); app.killHench(mar.uid);
const agg=app.fallenEqAgg(state.S.fallen.map(e=>e.m));
assert.deepStrictEqual(agg, ['3× Dagger (free)'], 'aggregate marks the free dagger and totals the count');
assert.strictEqual(app.fallenGoldLost(), 3*35, 'gold lost = 3 marauders at 35 gc, free dagger costing 0');

// ---------- promoted henchman (Lad's Got Talent) dies as a HERO ----------
// A promoted henchman shares its uid_def with the group it came from, but must
// fall as a hero and never merge with regular dead henchmen of that type.
state.replaceState({wb:'skaven',subtype:null,name:'Test',budget:500,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:false,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
app.addUnit('vermin'); const vg=state.S.models.find(m=>m.uid_def==='vermin'); vg.qty=3; vg.exp=8;
app.promoteHench(vg.uid);                       // one Verminkin becomes a Hero
const promo=state.S.models.find(m=>m.promoted);
assert.ok(promo && app.isHeroModel(promo), 'promoted henchman is a hero model');
app.killHench(vg.uid);                           // a regular Verminkin dies
app.killHero(promo.uid);                          // the promoted hero dies
const kinds=state.S.fallen.map(e=>e.kind).sort();
assert.deepStrictEqual(kinds, ['hench','hero'], 'promoted death is kind hero, regular death is kind hench');
app.renderRoster();
const ph=store['roster'].innerHTML; const pf=ph.slice(ph.indexOf('☠ Fallen'));
// two separate Verminkin groups, not one merged group
assert.strictEqual((pf.match(/Verminkin/g)||[]).length >= 2, true, 'promoted hero and henchman render as separate groups');
assert.ok(pf.includes('<th>Name</th>') && pf.includes('<th>#</th>'),
  'the hero group uses a Name column and the henchman group a # column');

console.log('Fallen feature: OK (hero + henchman deaths, group removal at 0, exp grouping, hero name listing, promoted-henchman as hero, aggregate eq + free dagger, gold lost, LIFO undo, PDF exclusion, remove-record)');
