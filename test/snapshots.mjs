/* Stage snapshots hold the whole warband state.
 *
 * The warband export already contains everything there is, so that is what a
 * snapshot should be — no guessing in advance which fields an analysis might
 * later want.
 *
 * With one necessary cut: the campaign RECORDS (log, battles, casualties,
 * experience ledger and the snapshots themselves) are left out. They live
 * centrally and only once. Including them would nest every earlier snapshot
 * inside each new one, doubling the file with every stage — measured at exactly
 * 2x per stage, which turns 3 KB into tens of megabytes over a campaign.
 *
 * The districts stay in, so who held what at a given stage is preserved, and
 * computed totals are stored as they stood rather than recomputed later: if the
 * data files change (an FAQ re-costs a unit), recomputing would silently
 * rewrite history.
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

state.replaceState({wb:'skaven',subtype:null,name:'Klaue',budget:600,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:true,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
['adept','black','vermin','rat'].forEach(u=>app.addUnit(u));
const hero=state.S.models.find(m=>m.uid_def==='adept'); hero.name='Skritch';
const rat=state.S.models.find(m=>m.uid_def==='rat');
const someDistrict=D.DISTRICTS[0].id;
state.S.campaign.districts={[someDistrict]:'control'};

app.advanceRound();                                   // closes stage 0
hero.skills.push('Step Aside'); hero.adv={WS:1}; hero.exp=(Number(hero.exp)||0)+10;
app.killHench(rat.uid);
app.advanceRound();                                   // closes stage 1
app.advanceRound();                                   // closes stage 2

const snap=app.stageSnapshots()['1'];

// --- the whole state is there ---
assert.ok(snap.state && snap.state.models, 'the models are kept in full');
assert.ok(snap.state.house, 'the house rules in force at the time are kept');
assert.ok(snap.state.stash, 'the stash is kept');
assert.ok(snap.state.fallen, 'the fallen are kept');
assert.strictEqual(snap.state.wb, 'skaven', 'the warband type is kept');

// --- but the campaign records are not nested, or the file would double per stage ---
assert.ok(!snap.state.campaign.snapshots, 'snapshots are not nested inside snapshots');
assert.ok(!snap.state.campaign.log, 'the chronicle is not duplicated into every stage');
assert.ok(!snap.state.campaign.battles, 'battles are not duplicated into every stage');

// --- districts are, so territory over time is answerable ---
const held=app.districtsAt(1);
assert.strictEqual(held.length, 1, 'the districts held at that stage are recorded');
assert.strictEqual(held[0].state, 'control');

// --- totals are stored as they stood, not recomputed later ---
const t=app.totalsAt(1);
assert.ok(t && typeof t.rating==='number' && typeof t.gold==='number',
  'the rating and gold of that moment are preserved');

// --- working state of the interface has no place in a record ---
const asText=JSON.stringify(snap);
assert.ok(!/"_/.test(asText), 'transient interface state is stripped out');

// --- and the diff still derives everything from it ---
const d=app.diffStages(0,1);
const ch=d.changed.find(c=>c.uid===hero.uid);
assert.ok(ch, 'the warrior who changed is found');
assert.strictEqual(ch.exp.gained, 10, 'experience gained in that stage is derived');
assert.deepStrictEqual(ch.stats, {WS:1}, 'which characteristic went up is derived');
assert.deepStrictEqual(ch.skills, ['Step Aside'], 'the skill learned is derived');
assert.ok(d.died.some(x=>x.uid===rat.uid), 'the warrior who fell in that stage is derived');

// --- growth stays linear ---
const before=JSON.stringify(state.S).length;
app.advanceRound(); app.advanceRound(); app.advanceRound();
const after=JSON.stringify(state.S).length;
assert.ok(after < before*2.5, 'three more stages must not multiply the save');

console.log('Full-state snapshots: OK (whole state kept, records not nested, districts and totals preserved, diffs derived, linear growth)');
