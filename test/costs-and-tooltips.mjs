/* The pure engine and lookup layers: what things cost and what tooltips say.
 *
 * Gold in hand is the treasury less what the warband currently owns, and
 * nothing else. The Fallen list is deliberately not part of that sum: an
 * earlier attempt derived it from the Fallen, and because the figure was only
 * subtracted when reading and not added back when writing, every gold amount
 * entered by hand silently lost that much again and the treasury drifted
 * negative. What a fallen warrior was worth is recorded once, when he falls,
 * and `lossValueOf` is the figure used for it.
 *
 * A Henchman's price has to include his experience: "you must add 2 gold crowns
 * to their cost for each extra Experience point they add to the warband's
 * total" (mordheimer, Trading). A recruit joins a group with the group's
 * experience, so recruiting into a seasoned group costs more than the bare
 * price on the warband list. Heroes are not priced this way.
 *
 * Tooltips were looked up through the ability scanner before the skill lists.
 * The scanner matches by regular expression, so loose patterns claimed names
 * they had no business with: the Shooting skill "Nimble" showed the Barbary
 * Monkey's special rule, and "Skink Hunter" showed the Hunter skill. An exact
 * name in a curated list beats a fuzzy match.
 *
 * What happens to the treasury at the moment of a death is roster behaviour and
 * belongs to the Fallen test, not here.
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
const eng=await import(new URL('../js/engine.js', import.meta.url).href);
const info=await import(new URL('../js/info.js', import.meta.url).href);
const state=await import(new URL('../js/state.js', import.meta.url).href);

state.replaceState({wb:'skaven',subtype:null,name:'Klaue',budget:500,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:false,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
app.addUnit('vermin');
const group=state.S.models.find(m=>m.uid_def==='vermin'); group.qty=3;

// --- gold in hand is the treasury less what the warband owns, and nothing else ---
// The Fallen list is deliberately not part of this sum. Deriving it from the
// Fallen made every hand-set figure silently lose that amount again, which is
// how the treasury drifted negative.
assert.strictEqual(eng.goldCurrent(), eng.goldTreasury()-eng.totalSpent(),
  'gold in hand is exactly treasury minus what is owned');

app.setGoldCurrent(100);
assert.strictEqual(eng.goldCurrent(), 100, 'a figure entered by hand reads back unchanged');
state.S.fallen.push({kind:'hench', uid_def:group.uid_def, exp:0,
  m:Object.assign({}, JSON.parse(JSON.stringify(group)), {qty:1})});
assert.strictEqual(eng.goldCurrent(), 100,
  'and an entry in the Fallen list does not move it');
state.S.fallen.pop();
app.setGoldCurrent(0);

// --- what a warrior is worth, himself and everything he carries ---
// This is the figure recorded when he falls, so a loss can be shown and taken
// back exactly rather than recalculated later.
const worth=eng.lossValueOf(group);
assert.ok(worth>0, 'a warrior is worth something');
assert.strictEqual(worth, eng.modelUnitCost(Object.assign({},group,{qty:1})),
  'it is the cost of one man of the group, equipment included');
assert.strictEqual(eng.lossValueOf(Object.assign({},group,{qty:3})), worth,
  'and it is one man\u2019s worth however many the group holds');

// --- the experience surcharge falls on NEW recruits only ---
// Two gold crowns per experience point is what a veteran costs to take on. It
// is not a revaluation of the men already in the group: warriors who earned
// their experience in play must not become dearer in hindsight, or the gold
// already spent would move under the player's feet.
const plain=eng.modelUnitCost(group);
group.exp=5;
assert.strictEqual(eng.modelUnitCost(group), plain,
  'men already in the group are not repriced when they earn experience');
assert.strictEqual(eng.henchRecruitSurcharge(group), 10,
  'but five points add ten crowns to the price of taking on another man');
assert.strictEqual(eng.henchRecruitCost(group), plain+10,
  'so one more of these costs the plain price plus that surcharge');
group.exp=0;
assert.strictEqual(eng.henchRecruitSurcharge(group), 0, 'raw recruits carry no surcharge');

// what was actually handed over is recorded, and stays put
group.exp=5;
group.xpPaid=10;
assert.strictEqual(eng.modelTotalCost(group), plain*3+10,
  'the surcharge paid is added to the group total');
group.exp=40;
assert.strictEqual(eng.modelTotalCost(group), plain*3+10,
  'and later experience does not change what was paid');
group.exp=0; group.xpPaid=0;

// a Hero's experience is his own; he is never recruited into a group
app.addUnit('adept');
const hero=state.S.models.find(m=>m.uid_def==='adept');
const heroPlain=eng.modelUnitCost(hero);
hero.exp=20;
assert.strictEqual(eng.modelUnitCost(hero), heroPlain, 'Heroes are not priced by experience');
assert.strictEqual(eng.henchRecruitSurcharge(hero), 0);

// --- tooltips resolve to the skill that was actually taken ---
const nimble=info.itipBuild('Nimble');
assert.ok(nimble, 'Nimble has a tooltip');
assert.ok(/move and fire/i.test(nimble),
  'the Shooting skill Nimble explains moving and firing: '+nimble.replace(/<[^>]+>/g,' '));
assert.ok(!/Barbary Monkey/i.test(nimble), 'not the Barbary Monkey\u2019s special rule');

const skink=info.itipBuild('Skink Hunter');
assert.ok(skink && /Skink Hunter/.test(skink),
  'a skill with a name containing another skill keeps its own text');
const wyrd=info.itipBuild('Wyrdstone Hunter');
assert.ok(wyrd && /Wyrdstone Hunter/.test(wyrd));

// abilities that are not skills still resolve through the scanner
const fear=info.itipBuild('Fear');
assert.ok(fear, 'abilities are still found');

console.log('Costs & tooltips: OK (gold independent of the Fallen, loss value, henchman experience priced, skills beat fuzzy ability matches)');
