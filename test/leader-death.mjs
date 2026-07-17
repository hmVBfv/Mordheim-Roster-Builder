/* Mordheim leader-succession rules (leader slain).
 *
 * When the warband's leader unit (the req unit, e.g. Marauder Chieftain) dies:
 *  - the "a <leader unit> is required" validation no longer applies,
 *  - you may not hire a new one (addUnit is blocked for the req unit),
 *  - the eligible Hero with the highest Leadership takes command (ties -> most
 *    Experience), and for Undead the Necromancer specifically takes over — with
 *    a collapse warning if none remains.
 */
import assert from 'assert';
import * as fs from 'fs';

const el=(id)=>({id,style:{},value:'',set innerHTML(v){this._h=v;},get innerHTML(){return this._h||'';},appendChild(){},addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}),querySelectorAll:()=>[],querySelector:()=>null,click(){},focus(){},select(){}});
const store={};
globalThis.document={getElementById:(id)=>store[id]||(store[id]=el(id)),createElement:el,addEventListener(){},body:{appendChild(){}},querySelectorAll:()=>[],querySelector:()=>null};
globalThis.window={addEventListener(){},scrollTo(){},innerWidth:1000,matchMedia:()=>({matches:false,addEventListener(){}}),storage:{list:async()=>({keys:[]})}};
globalThis.Blob=function(){}; globalThis.URL.createObjectURL=()=>''; globalThis.confirm=()=>true;
globalThis.fetch=async(u)=>{const p=decodeURIComponent(new URL(u).pathname);
  return {ok:fs.existsSync(p),json:async()=>JSON.parse(fs.readFileSync(p,'utf8')),arrayBuffer:async()=>fs.readFileSync(p).buffer};};

const app=await import(new URL('../js/app.js', import.meta.url).href);
const state=await import(new URL('../js/state.js', import.meta.url).href);

function fresh(wb){ state.replaceState({wb,subtype:null,name:'',budget:1000,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:false,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()}); }
function warnings(){ app.renderSidebar(); let h=''; for(const k in store) h+=(store[k].innerHTML||''); return h; }

// --- Marauders: Chieftain dies, Champion succeeds, requirement drops ---
fresh('maraudersofchaos');
app.addUnit('chieftain'); app.addUnit('champion'); app.addUnit('champion');
const chief=state.S.models.find(m=>m.uid_def==='chieftain');
const champs=state.S.models.filter(m=>m.uid_def==='champion');
champs[0].exp=10; champs[1].exp=25;
assert.strictEqual(app.leaderUnitDied(), false, 'leader alive before death');
app.killHero(chief.uid);
assert.strictEqual(app.leaderUnitDied(), true, 'leaderUnitDied true after the Chieftain falls');
const successor=state.S.models.find(m=>m.uid===app.leaderUid());
assert.ok(successor && successor.uid_def==='champion' && successor.exp===25,
  'succession goes to the eligible hero with the highest Leadership, XP breaking the tie');
// requirement no longer fires
assert.ok(!/Chieftain is required/.test(warnings()), 'the "Chieftain required" validation is dropped once the leader has died');
// cannot hire a new Chieftain
const before=state.S.models.filter(m=>m.uid_def==='chieftain').length;
app.addUnit('chieftain');
assert.strictEqual(state.S.models.filter(m=>m.uid_def==='chieftain').length, before,
  'a new leader unit cannot be recruited after the leader has died');

// --- Undead: Vampire dies, collapse warning when no Necromancer ---
fresh('undead');
app.addUnit('vamp'); app.addUnit('dreg');
app.killHero(state.S.models.find(m=>m.uid_def==='vamp').uid);
assert.ok(/collapses/.test(warnings()), 'Undead with no Necromancer collapse when the Vampire dies');

// --- Undead: with a Necromancer, it takes command and there is no collapse ---
fresh('undead');
app.addUnit('vamp'); app.addUnit('necro');
app.killHero(state.S.models.find(m=>m.uid_def==='vamp').uid);
const uLead=state.S.models.find(m=>m.uid===app.leaderUid());
assert.ok(uLead && uLead.uid_def==='necro', 'the Necromancer takes command of an Undead warband');
assert.ok(!/collapses/.test(warnings()), 'no collapse while a Necromancer remains');

console.log('Leader death: OK (highest-Ld succession, requirement dropped, re-hire blocked, Undead Necromancer/collapse)');
