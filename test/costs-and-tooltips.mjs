/* Three faults found in play, all in the pure engine and lookup layers.
 *
 *  - Gold was handed back when a warrior died. The treasury is worked out as
 *    what was raised minus what was spent, and the spending was summed over the
 *    living only, so a death quietly removed his cost from the total and the
 *    warband appeared richer for losing a man. What was paid for him is gone,
 *    and it has to keep counting.
 *
 *  - A Henchman's price ignored his experience. "You must add 2 gold crowns to
 *    their cost for each extra Experience point they add to the warband's
 *    total" (mordheimer, Trading) — a new man joins a group with the group's
 *    experience, so recruiting into a seasoned group costs more than the bare
 *    price on the warband list. Heroes are not priced this way.
 *
 *  - Tooltips were looked up through the ability scanner before the skill
 *    lists. The scanner matches by regular expression, so loose patterns
 *    claimed names they had no business with: the Shooting skill "Nimble"
 *    showed the Barbary Monkey's special rule, and "Skink Hunter" showed the
 *    Hunter skill. An exact name in a curated list beats a fuzzy match.
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

// --- a death does not pay out ---
const goldBefore=eng.goldCurrent();
const spentBefore=eng.totalSpent();
// a man falls: he leaves the group and his snapshot joins the Fallen
const snapshot=JSON.parse(JSON.stringify(group)); snapshot.qty=1;
state.S.fallen.push({kind:'hench', uid_def:group.uid_def, exp:0, m:snapshot});
group.qty=2;
assert.ok(eng.totalSpent()<spentBefore, 'the living cost less, as one of them is gone');
assert.strictEqual(eng.goldCurrent(), goldBefore,
  'but the treasury is unchanged: what was paid for him was not refunded');
assert.ok(eng.fallenSunk()>0, 'his cost is counted as spent and lost');

// taking the death back restores the position exactly
state.S.fallen.pop(); group.qty=3;
assert.strictEqual(eng.goldCurrent(), goldBefore, 'and undoing a death changes nothing either');
assert.strictEqual(eng.fallenSunk(), 0);

// --- a Henchman's experience is worth 2 gold crowns a point ---
const plain=eng.modelUnitCost(group);
group.exp=5;
assert.strictEqual(eng.modelUnitCost(group), plain+10,
  'five points add ten crowns to what one of these men costs');
assert.strictEqual(eng.modelTotalCost(group), eng.modelUnitCost(group)*3,
  'and every man of the group is priced the same, so another recruit costs the higher price');
group.exp=0;
assert.strictEqual(eng.modelUnitCost(group), plain, 'no experience, no surcharge');

// a Hero's experience is his own and does not raise his price
app.addUnit('adept');
const hero=state.S.models.find(m=>m.uid_def==='adept');
const heroPlain=eng.modelUnitCost(hero);
hero.exp=20;
assert.strictEqual(eng.modelUnitCost(hero), heroPlain, 'Heroes are not priced by experience');

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

console.log('Costs & tooltips: OK (no gold from the dead, henchman experience priced, skills beat fuzzy ability matches)');
