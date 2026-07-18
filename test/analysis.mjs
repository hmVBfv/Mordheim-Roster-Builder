/* Analysis and narrative.
 *
 * The same record serves two purposes: a written account complete enough to be
 * turned into a story afterwards, and figures to analyse — who was present
 * when, what they gained and when, whom they defeated, and how they developed.
 *
 * The demanding part is per-character history, which needs a stable identity on
 * every event: two warriors of the same type, or a renamed one, must stay
 * distinguishable.
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
const state=await import(new URL('../js/state.js', import.meta.url).href);

state.replaceState({wb:'skaven',subtype:null,name:'Klaue von Skryre',budget:500,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:true,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});

// --- Setup ---
app.addUnit('adept'); app.addUnit('black');
const skritch=state.S.models.find(m=>m.uid_def==='adept'); skritch.name='Skritch';
const grik=state.S.models.find(m=>m.uid_def==='black'); grik.name='Grik';

// events must carry the model identity, or no per-character history is possible
const rec=state.S.campaign.log.filter(e=>e.type==='recruit');
assert.ok(rec.every(e=>e.data&&e.data.uid!=null), 'recruitment records which warrior it was');

// --- Battle 1: Skritch kills a hero and a henchman ---
app.advanceRound();
app.addBattle({opponents:[{name:'Klaus',wb:'merc'}],outcome:'Victory',notes:'We struck from the rooftops.'});
app.addCasualty({victim:{name:'Hans',wb:'merc',grade:'hero',value:60},attacker:{uid:skritch.uid,name:'Skritch'},result:'dead'});
app.addCasualty({victim:{name:'Dieter',wb:'merc',grade:'hench',value:25},attacker:{uid:skritch.uid,name:'Skritch'},result:'dead'});
skritch.exp=26; app.addAdv(skritch.uid,'WS');

// a battle belongs to the stage it is fought in, not the next one
assert.strictEqual(state.S.campaign.battles[0].round, 1, 'a battle sits in the stage it was fought in');

// --- Battle 2: Grik is slain ---
app.advanceRound();
app.addBattle({opponents:[{name:'Klaus',wb:'merc'}],outcome:'Defeat',notes:'Ambushed at the well.'});
app.addCasualty({victim:{uid:grik.uid,name:'Grik'},attacker:{name:'Klaus',wb:'merc'}});
document.getElementById('inj-'+grik.uid).value='11-15';
app.addInj(grik.uid);

// --- per-character history ---
const t=app.characterTimeline(skritch.uid);
assert.strictEqual(t.name, 'Skritch');
assert.strictEqual(t.alive, true);
assert.strictEqual(t.joined, 0, 'joined during Setup');
assert.strictEqual(t.kills, 2, 'kills are counted');
assert.deepStrictEqual(t.killsByGrade, {hero:1,hench:1}, 'kills are split into heroes and henchmen');
assert.strictEqual(t.goldDestroyed, 85, 'the worth of slain enemies is summed');
assert.ok(t.curve.length>=2, 'an experience curve is recorded per stage');
assert.strictEqual(t.curve[0].exp, 20, 'the curve starts at the starting experience');
assert.ok(t.curve[1].exp>t.curve[0].exp, 'the curve follows the experience gained');

const g=app.characterTimeline(grik.uid);
assert.strictEqual(g.alive, false, 'a slain warrior is marked as such');
assert.strictEqual(g.died, 2, 'the stage of death is recorded');

// --- campaign-wide figures ---
const a=app.campaignAnalysis();
assert.strictEqual(a.battles, 2);
assert.strictEqual(a.wins, 1);
assert.strictEqual(a.losses, 1);
assert.strictEqual(a.fallen, 1);
assert.strictEqual(a.killsInflicted, 2);
assert.strictEqual(a.goldDestroyed, 85, 'enemy gold destroyed is totalled');
assert.ok(a.goldLost>0, 'our own losses are valued too');
assert.ok(a.characters.some(c=>c.name==='Skritch'), 'every warrior appears in the analysis');

// --- the written account ---
const txt=app.narrativeReport();
assert.ok(/CAMPAIGN CHRONICLE/.test(txt));
assert.ok(/## Setup/.test(txt) && /## After battle 1/.test(txt), 'the account is ordered by stage');
assert.ok(/We struck from the rooftops/.test(txt), "the player's own account is carried through");
assert.ok(/Hans .*was slain by Skritch/.test(txt), 'kills name both sides');
assert.ok(/Grik .*slain in after battle 2/.test(txt), 'each warrior gets their fate');
assert.ok(!/Campaign moved to/.test(txt), 'bookkeeping entries stay out of the account');
assert.strictEqual((txt.match(/Battle against Klaus/g)||[]).length, 2, 'each battle is written once, not twice');

console.log('Analysis & narrative: OK (per-character history, kills by grade and worth, experience curves, stage-ordered account)');
