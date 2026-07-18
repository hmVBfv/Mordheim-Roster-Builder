/* Casualties — who took out whom, and what became of them.
 *
 * A casualty has two stages, as the rules do: during the battle only the fact
 * of going out of action and the culprit are known; the injury roll in the
 * post-battle sequence decides between death, a lasting injury and a full
 * recovery. Applying that roll to one of our own warriors must resolve the
 * existing record rather than create a second one, and a death must tie to the
 * Fallen entry so the two can be cross-referenced.
 */
import assert from 'assert';
import * as fs from 'fs';

const el=(id)=>({id,style:{},value:'',checked:false,set innerHTML(v){this._h=v;},get innerHTML(){return this._h||'';},
  appendChild(){},addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}),
  querySelectorAll:()=>[],querySelector:()=>null,click(){},focus(){},select(){},setAttribute(){},removeAttribute(){},remove(){}});
const store={};
globalThis.document={getElementById:(id)=>store[id]||(store[id]=el(id)),createElement:el,addEventListener(){},body:{appendChild(){}},querySelectorAll:()=>[],querySelector:()=>null};
globalThis.window={addEventListener(){},scrollTo(){},innerWidth:1000,matchMedia:()=>({matches:false,addEventListener(){}}),storage:{list:async()=>({keys:[]})}};
globalThis.Blob=function(){}; globalThis.URL.createObjectURL=()=>''; globalThis.confirm=()=>true; globalThis.alert=()=>{};
globalThis.fetch=async(u)=>{const p=decodeURIComponent(new URL(u).pathname);
  return {ok:fs.existsSync(p),json:async()=>JSON.parse(fs.readFileSync(p,'utf8')),arrayBuffer:async()=>fs.readFileSync(p).buffer};};

const app=await import(new URL('../js/app.js', import.meta.url).href);
const D=await import(new URL('../data/index.js', import.meta.url).href);
const state=await import(new URL('../js/state.js', import.meta.url).href);

state.replaceState({wb:'skaven',subtype:null,name:'Klaue',budget:500,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:true,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
app.addUnit('adept'); app.addUnit('black');
const adept=state.S.models.find(m=>m.uid_def==='adept'); adept.name='Skritch';
const black=state.S.models.find(m=>m.uid_def==='black'); black.name='Grik';

// --- during the battle: only "out of action, by whom" is known ---
app.addBattle({opponents:[{name:'Klaus',wb:'merc'}],outcome:'Victory'});
const c1=app.addCasualty({victim:{uid:adept.uid,name:'Skritch',wb:'skaven'},attacker:{name:'Klaus',wb:'merc'}});
const c2=app.addCasualty({victim:{uid:black.uid,name:'Grik',wb:'skaven'},attacker:{name:'Klaus',wb:'merc'}});
const c3=app.addCasualty({victim:{name:'Hans',wb:'merc'},attacker:{uid:adept.uid,name:'Skritch',wb:'skaven'}});
assert.strictEqual(app.campCasualties().filter(r=>r.result==='pending').length, 3,
  'casualties start unresolved until the injury roll');
assert.ok(/put out of action by Klaus/.test(app.casualtyText(c1)), 'the record reads as an out-of-action, not a death');

// --- post-battle: the Dead result resolves the record and ties to Fallen ---
document.getElementById('inj-'+adept.uid).value='11-15';
app.addInj(adept.uid);
const r1=app.campCasualties().find(r=>r.id===c1.id);
assert.strictEqual(r1.result, 'dead', 'the injury roll resolves the pending record');
assert.strictEqual(app.campCasualties().length, 3, 'no duplicate casualty is created');
assert.strictEqual(state.S.fallen.length, 1, 'the warrior moved to Fallen');
assert.strictEqual(r1.fallenId, 0, 'the casualty is tied to its Fallen entry');
const ev=state.S.campaign.log.find(e=>e.data&&e.data.casualtyId===c1.id);
assert.strictEqual(ev.type, 'death', 'the chronicle entry is retyped as a death');
assert.ok(/was slain by Klaus/.test(ev.text), 'and now reads as a death');

// --- a lasting injury resolves too, and matches the roster ---
const inj=D.INJURIES.find(i=>!i.miss && i.code!=='11-15');
document.getElementById('inj-'+black.uid).value=inj.code;
app.addInj(black.uid);
const r2=app.campCasualties().find(r=>r.id===c2.id);
assert.strictEqual(r2.result, 'injured', 'a lasting injury resolves the record');
assert.ok(r2.detail, 'the injury is named on the record');
assert.strictEqual(black.inj.length, 1, 'the same injury sits on the roster model');

// --- an enemy casualty is resolved by hand ---
app.resolveCasualty(c3.id,'dead','felled from the rooftop');
assert.strictEqual(app.campCasualties().find(r=>r.id===c3.id).result, 'dead');

// --- tallies: what our warriors dealt out and suffered ---
const st=app.casualtyStats();
assert.deepStrictEqual(st.inflicted['Skritch'], {ooa:1,kills:1}, 'kills are credited to our warrior');
assert.strictEqual(st.suffered['Skritch'].deaths, 1, 'our losses are counted');
assert.strictEqual(st.suffered['Grik'].injuries, 1, 'our injuries are counted');

// --- old saves without casualties still load ---
app.applyState({wb:'skaven',subtype:null,name:'Alt',budget:500,
  models:[{uid:1,uid_def:'adept',name:'A',exp:20,qty:1,eq:{},mut:[],adv:{},skills:[],inj:[],spells:[]}],
  hired:[],dp:[],leaderUid:1,campaign:{on:true,districts:{}},stash:{wyrd:0,gold:0,items:[]},house:{}});
assert.deepStrictEqual(app.campCasualties(), [], 'a campaign without casualties gets an empty list');

console.log('Casualties: OK (two-stage record, injury roll resolves it, tied to Fallen, tallies, old saves)');
