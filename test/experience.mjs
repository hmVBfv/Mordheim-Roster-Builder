/* Experience earned, and stage-to-stage differences.
 *
 * Mordheim awards experience after the battle: +1 to a Hero for each enemy he
 * puts out of action, +1 to every Hero and Henchman group that survives, and +1
 * to the leader of the winning warband. Scenarios vary the amounts, and NPCs
 * count as enemies where the scenario says so (the Necromancer's Tower counts
 * its Zombies). Only Heroes earn the per-enemy point.
 *
 * Earned points are held rather than written straight onto the roster, so a
 * whole battle can be tallied and applied in one step — and so the reason a
 * warrior earned each point survives.
 *
 * Separately: the difference between two stage snapshots is what the analysis
 * is built from. Who is present at one stage and dead at the next fell in that
 * battle; whose characteristic is higher gained it then.
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

state.replaceState({wb:'skaven',subtype:null,name:'Klaue',budget:600,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:true,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
app.addUnit('adept'); app.addUnit('vermin');
const hero=state.S.models.find(m=>m.uid_def==='adept'); hero.name='Skritch';
const hench=state.S.models.find(m=>m.uid_def==='vermin'); hench.qty=3;
const startExp=hero.exp;

app.advanceRound();                       // closes Setup, snapshotting it
const bat=app.addBattle({opponents:[{name:'Klaus',wb:'merc'}],outcome:'Victory'});

// --- +1 per enemy put out of action, Heroes only ---
app.addCasualty({victim:{name:'Hans',wb:'merc',grade:'hero',value:60},attacker:{uid:hero.uid,name:'Skritch'}});
app.addCasualty({victim:{name:'Wolf',grade:'hench',value:0},attacker:{uid:hero.uid,name:'Skritch'}});
assert.strictEqual(app.pendingXpFor(hero.uid), 2, 'a Hero earns a point per enemy out of action, NPCs included');
app.addCasualty({victim:{name:'Otto',wb:'merc'},attacker:{uid:hench.uid,name:'Verminkin'}});
assert.strictEqual(app.pendingXpFor(hench.uid), 0, 'Henchmen earn no per-enemy point');

// --- post-battle: +1 survives for everyone, +1 for the winning leader ---
app.awardBattleXp(bat.id);
assert.strictEqual(app.pendingXpFor(hero.uid), 4, 'the Hero adds surviving and leading the winning warband');
assert.strictEqual(app.pendingXpFor(hench.uid), 1, 'the Henchman group earns for surviving');
assert.strictEqual(app.pendingXpTotal(), 5);

// scenarios that award differently
const before=app.pendingXpTotal();
app.awardBattleXp(bat.id,{survives:5, winningLeader:5});
assert.strictEqual(app.pendingXpTotal(), before+5+5+5, 'scenario amounts can differ from the rulebook default');

// --- nothing touches the roster until it is applied ---
assert.strictEqual(hero.exp, startExp, 'earned experience is held, not written straight to the roster');
const applied=app.applyPendingXp();
assert.ok(applied>0);
assert.strictEqual(hero.exp, startExp+14, 'applying writes the total onto the warrior');
assert.strictEqual(app.pendingXpTotal(), 0, 'nothing is left waiting');
assert.ok(app.xpLedger().some(x=>/out of action/.test(x.reason)), 'the reason for each point is kept');

// --- stage differences carry the analysis ---
app.advanceRound();
const d=app.diffStages(0,1);
const heroChange=d.changed.find(c=>c.uid===hero.uid);
assert.ok(heroChange && heroChange.exp.gained===14, 'the diff shows what a warrior gained in that stage');

app.killHench(hench.uid);
app.advanceRound();
const d2=app.diffStages(1,2);
assert.ok(d2.died.some(x=>x.uid===hench.uid) || d2.changed.some(c=>c.uid===hench.uid&&c.qty),
  'a warrior present at one stage and gone at the next is visible in the diff');

// --- who was there from the outset ---
const founders=app.foundingMembers().map(x=>x.name);
assert.ok(founders.includes('Skritch'), 'the founding members come from the first snapshot');

console.log('Experience & stage diff: OK (per-enemy for Heroes only, survives, winning leader, scenario amounts, held until applied, diffs)');
