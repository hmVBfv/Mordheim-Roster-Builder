/* The post-battle sequence, checked against the rulebook (mordheimer, Income
 * and Tools): the number of Exploration dice, the shards-found table, the
 * multiples-to-location reading, the 2D6 veteran pool, and that the whole
 * sequence is tracked once per round and rides along in the save.
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

state.replaceState({wb:'skaven',subtype:null,name:'Klaue',budget:500,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:true,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});

// --- the shards-found table (mordheimer, Income) ---
[[1,1],[5,1],[6,2],[11,2],[12,3],[17,3],[18,4],[24,4],[25,5],[30,5],[31,6],[35,6],[36,7],[50,7]]
  .forEach(([total,sh])=>assert.strictEqual(app.pbShardsFor(total), sh, `total ${total} -> ${sh} shards`));

// --- multiples read the most numerous set, ties to the highest face ---
assert.strictEqual(app.pbExploreMultiple([5,5,5,3]).name, 'Market Hall', 'triple 5 is the Market Hall');
assert.strictEqual(app.pbExploreMultiple([3,3,5,5]).name, 'Overturned Cart', 'double 3 and double 5 -> the higher, double 5');
assert.strictEqual(app.pbExploreMultiple([1,2,3,4]), null, 'no multiple, no location');
assert.strictEqual(app.pbExploreMultiple([6,6]).name, 'Ruined Hovels');
assert.strictEqual(app.pbExploreMultiple([2,2,2,2]).name, 'Shrine', 'four 2s -> Shrine');

// --- exploration dice: one per surviving Hero not out of action, +1 for a win ---
app.addUnit('adept');    // Assassin Adept is a Hero
app.addUnit('sorc');     // Sorcerer is a second Hero
const heroes=state.S.models.filter(m=>app.isHeroModel(m));
assert.ok(heroes.length>=2, 'two heroes recruited');
// no battle recorded yet: no win die
let d=app.pbExploreDice(0);
assert.strictEqual(d.survivors, heroes.length, 'every hero surviving searches');
assert.strictEqual(d.winDie, 0, 'no win, no extra die');

// record a battle this round that we won, and take one hero out of action
const round=app.pbRound();
state.S.campaign.battles.push({id:1, round, sides:[{key:'me',outcome:'Victory'}], outcome:'Victory'});
state.S.campaign.casualties.push({id:1, round, victim:{uid:heroes[0].uid, name:heroes[0].name}, attacker:{name:'The surroundings'}, result:'injured'});
d=app.pbExploreDice(round);
assert.strictEqual(d.winDie, 1, 'a win adds one die');
assert.strictEqual(d.survivors, heroes.length-1, 'a hero taken out of action does not search');
assert.strictEqual(d.capped, Math.min(6, d.base), 'never more than six dice');

// the cap holds even with many heroes
for(let i=0;i<8;i++){ app.addUnit('vermin'); }    // henchmen do not add dice
d=app.pbExploreDice(round);
assert.ok(d.capped<=6, 'still capped at six');

// --- veteran pool is 2D6 and sticks once rolled ---
app.pbRollVeterans(round);
const v=state.S.campaign.postbattle[round].veterans;
assert.ok(v && v.pool>=2 && v.pool<=12, 'the pool is a 2D6 result');
const first=v.pool; app.pbRollVeterans(round);
assert.strictEqual(state.S.campaign.postbattle[round].veterans.pool, first, 'rolling again does not re-roll a settled pool');

// --- rolling exploration stores dice, total, shards and any location ---
app.pbRollExplore(round);
const e=state.S.campaign.postbattle[round].explore;
assert.ok(Array.isArray(e.dice) && e.dice.length===d.capped, 'rolled the allowed number of dice');
assert.strictEqual(e.shards, app.pbShardsFor(e.total), 'shards follow the table');
// taking the shards moves them into the stash, once
const before=Number(state.S.stash.wyrd)||0;
app.pbTakeShards(round);
assert.strictEqual(Number(state.S.stash.wyrd)||0, before+e.shards, 'found shards go into the stash');
app.pbTakeShards(round);
assert.strictEqual(Number(state.S.stash.wyrd)||0, before+e.shards, 'and only once');

// --- step ticks are per round and survive a save round-trip ---
app.pbSetStepDone('exploration', true, round);
assert.strictEqual(app.pbStepDone('exploration', round), true);
assert.strictEqual(app.pbStepDone('exploration', round+1), false, 'a different stage has its own sequence');
const saved=JSON.parse(JSON.stringify(state.S));
assert.ok(saved.campaign.postbattle[round].done.exploration, 'the sequence is part of the save');

// --- selling wyrdstone reads mordheimer's table (total gold, not per shard) ---
// small warband (<=3): 1 shard 45, 2 together 60, 8+ 155
assert.strictEqual(app.wyrdPrice(1, 3), 45, 'one shard, small warband');
assert.strictEqual(app.wyrdPrice(2, 3), 60, 'two shards fetch 60 total, not 90');
assert.strictEqual(app.wyrdPrice(8, 3), 155);
assert.strictEqual(app.wyrdPrice(9, 3), 155, 'nine or more use the 8+ row');
// size bands fall as the warband grows
assert.strictEqual(app.wyrdSizeBand(3), 0);
assert.strictEqual(app.wyrdSizeBand(4), 1);
assert.strictEqual(app.wyrdSizeBand(16), 5);
assert.strictEqual(app.wyrdSizeBand(99), 5);
assert.strictEqual(app.wyrdPrice(1, 16), 25, 'a big warband earns less for the same shard');

// selling moves gold to the treasury and shards out of the stash, once
state.S.stash.wyrd=5; app.setGoldCurrent(100);
const sz=app.warbandSize();
const expect=app.wyrdPrice(3, sz);
app.pbSellWyrd(round, 3);
assert.strictEqual(app.goldCurrent(), 100+expect, 'the sale gold is added to the treasury');
assert.strictEqual(Number(state.S.stash.wyrd), 2, 'the sold shards leave the stash');
app.pbSellWyrd(round, 1);
assert.strictEqual(app.goldCurrent(), 100+expect, 'a second sale in the same sequence does nothing');
// undo returns exactly what the sale took
app.pbClearWyrd(round);
assert.strictEqual(app.goldCurrent(), 100, 'undoing the sale returns the gold');
assert.strictEqual(Number(state.S.stash.wyrd), 5, 'and the shards');

console.log('Post-battle sequence: OK (dice, shards, multiples, veterans, wyrdstone sale table, per-round state)');
