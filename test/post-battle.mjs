/* The post-battle sequence as a guided, ordered checklist. It rolls nothing -
 * the player rolls at the table - so this checks the parts the tool still owns:
 * how many Exploration dice the roster allows (one per Hero not taken out of
 * action, plus one for a win, capped at six), that the steps must be worked in
 * order and cannot be skipped, that the wyrdstone calculator prices a sale from
 * mordheimer's table and pays it into the treasury once, and that all of this
 * is kept per round in the save.
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

app.addUnit('adept');   // Assassin Adept is a Hero
app.addUnit('sorc');    // Sorcerer is a second Hero
const heroes=state.S.models.filter(m=>app.isHeroModel(m));
assert.ok(heroes.length>=2, 'two heroes recruited');

// a battle this round that we won, with one hero taken out of action
const round=app.pbRound();
state.S.campaign.battles.push({id:1, round, sides:[{key:'me',outcome:'Victory'}], outcome:'Victory'});
state.S.campaign.casualties.push({id:1, round, victim:{uid:heroes[0].uid, name:heroes[0].name}, attacker:{name:'The surroundings'}, result:'injured'});

// --- exploration dice: one per searching Hero + one for the win, capped at six ---
let d=app.pbExploreDice(round);
assert.strictEqual(d.survivors, heroes.length-1, 'a Hero taken out of action does not search');
assert.strictEqual(d.winDie, 1, 'a win adds one die');
const searching=app.pbSearchingHeroes(round);
assert.strictEqual(searching.length, heroes.length-1, 'the searching Heroes are named for the checklist');
assert.ok(!searching.includes(heroes[0].name), 'the wounded Hero is not among them');
for(let i=0;i<8;i++) app.addUnit('vermin');   // henchmen add no dice
d=app.pbExploreDice(round);
assert.ok(d.capped<=6, 'never more than six dice');

// --- the steps must be worked in order ---
assert.strictEqual(app.pbActiveStep(round), 0, 'nothing done, the first step is active');
app.pbSetStepDone('exploration', true, round);
assert.strictEqual(app.pbStepDone('exploration', round), false, 'a step cannot be ticked out of turn');
assert.strictEqual(app.pbActiveStep(round), 0);
app.pbSetStepDone('injuries', true, round);
assert.strictEqual(app.pbActiveStep(round), 1, 'the first step done, the second is active');
app.pbSetStepDone('experience', true, round);
app.pbSetStepDone('exploration', true, round);
assert.strictEqual(app.pbActiveStep(round), 3, 'three done, the fourth is active');
app.pbSetStepDone('injuries', false, round);
assert.strictEqual(app.pbStepDone('injuries', round), true, 'cannot un-tick a step with later ones still done');
app.pbSetStepDone('exploration', false, round);
assert.strictEqual(app.pbActiveStep(round), 2, 'un-ticking the last done step steps back');

// --- wyrdstone: mordheimer's table, total gold for the batch, once per sequence ---
assert.strictEqual(app.wyrdPrice(1,3), 45, 'one shard, small warband');
assert.strictEqual(app.wyrdPrice(2,3), 60, 'two shards fetch 60 total, not 90');
assert.strictEqual(app.wyrdPrice(9,3), 155, 'nine or more use the 8+ row');
assert.strictEqual(app.wyrdSizeBand(3),0);
assert.strictEqual(app.wyrdSizeBand(16),5);
assert.strictEqual(app.wyrdPrice(1,16),25, 'a bigger warband earns less for the same shard');

state.S.stash.wyrd=5; app.setGoldCurrent(100);
const sz=app.warbandSize(); const expect=app.wyrdPrice(3,sz);
app.pbSellWyrd(round, 3);
assert.strictEqual(app.goldCurrent(), 100+expect, 'the sale gold goes to the treasury');
assert.strictEqual(Number(state.S.stash.wyrd), 2, 'the sold shards leave the stash');
app.pbSellWyrd(round, 1);
assert.strictEqual(app.goldCurrent(), 100+expect, 'a second sale in the same sequence does nothing');
app.pbClearWyrd(round);
assert.strictEqual(app.goldCurrent(), 100, 'undo returns the gold');
assert.strictEqual(Number(state.S.stash.wyrd), 5, 'and the shards');

// --- everything is kept per round in the save ---
assert.strictEqual(app.pbStepDone('experience', round+1), false, 'a different stage has its own sequence');
const saved=JSON.parse(JSON.stringify(state.S));
assert.ok(saved.campaign.postbattle[round].done.experience, 'progress is part of the save');

// --- the panel renders without error and reflects the gate ---
const html=app.postbattleBlock();
assert.ok(/Post-battle sequence/.test(html), 'the panel renders');
assert.ok(/pb-locked/.test(html), 'later steps are shown locked');
assert.ok(/mordheimer\.net/.test(html), 'each step links to Mordheimer');

console.log('Post-battle sequence: OK (dice count, enforced order, no rolling, wyrdstone table, per-round state)');
