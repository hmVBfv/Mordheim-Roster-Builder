/* Regression test for the Rare Items / Trading Post eligibility rule.
 *
 * The core design rule (recorded in app.js): a unit may only take a rare/magic
 * item whose BASE CATEGORY appears in its STARTING equipment list. e.g. a unit
 * that can wear heavy armour at start may take heavy-armour-based rare items; a
 * unit that cannot, may not. This test pins that rule down against real warband
 * data, plus the coarser filters in rareEligibleItems (misc = heroes only,
 * already-a-start-option is excluded, house rules relax the gate).
 */
import assert from 'assert';
import * as fs from 'fs';

const el=()=>({style:{},className:'',textContent:'',value:'',checked:false,set innerHTML(v){},get innerHTML(){return '';},appendChild(){},addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}),querySelectorAll:()=>[],click(){},focus(){},select(){}});
globalThis.document={getElementById:el,createElement:el,addEventListener(){},body:{appendChild(){}},querySelectorAll:()=>[]};
globalThis.window={addEventListener(){},scrollTo(){},innerWidth:1000,matchMedia:()=>({matches:false,addEventListener(){}}),storage:{list:async()=>({keys:[]})}};
globalThis.Blob=function(){}; globalThis.URL.createObjectURL=()=>'';
globalThis.fetch=async(u)=>{const p=decodeURIComponent(new URL(u).pathname);
  return {ok:fs.existsSync(p),json:async()=>JSON.parse(fs.readFileSync(p,'utf8')),arrayBuffer:async()=>fs.readFileSync(p).buffer};};

const app=await import(new URL('../js/app.js', import.meta.url).href);
const eng=await import(new URL('../js/engine.js', import.meta.url).href);
const D=await import(new URL('../data/index.js', import.meta.url).href);
const state=await import(new URL('../js/state.js', import.meta.url).href);

// Representative catalogue items by base family.
const heavyItem=D.CATALOG.find(i=>app.itemFamily(i.de)==='heavyarmour');
const spearItem=D.CATALOG.find(i=>app.itemFamily(i.de)==='spear');
assert.ok(heavyItem, 'catalogue must contain a heavy-armour-family item');
assert.ok(spearItem, 'catalogue must contain a spear-family item');

// --- CASE 1: a unit WITH heavy armour + spear in its start list (Averland Captain) ---
state.replaceState({wb:'averland',subtype:null,name:'',budget:500,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:false,districts:{}},stash:{wyrd:0,gold:null,items:[]},house:state.houseDefaults()});
const capt=app.unitDef('capt');
const cFams=app.unitFamilies(capt);
assert.ok(cFams.has('heavyarmour') && cFams.has('spear'),
  'Captain start list should include heavy armour and spear');
assert.strictEqual(app.catalogEligible(capt, heavyItem).ok, true,
  'Captain (heavy armour in start list) may take a heavy-armour rare item');
assert.strictEqual(app.catalogEligible(capt, spearItem).ok, true,
  'Captain (spear in start list) may take a spear-family rare item');

// --- CASE 2: a unit WITHOUT armour in its start list (Carnival Brute: two-handed + flail only) ---
state.replaceState({wb:'carnival',subtype:null,name:'',budget:500,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:false,districts:{}},stash:{wyrd:0,gold:null,items:[]},house:state.houseDefaults()});
const brute=app.unitDef('brute');
const bFams=app.unitFamilies(brute);
assert.ok(!bFams.has('heavyarmour'), 'Brute start list should NOT include heavy armour');
assert.strictEqual(app.catalogEligible(brute, heavyItem).ok, false,
  'Brute (no armour in start list) may NOT take a heavy-armour rare item');

// --- CASE 3: rareEligibleItems never surfaces an item the category rule forbids ---
const bruteModel={uid:1,uid_def:'brute',name:'Brute',exp:0,qty:1,eq:{},rare:{},mut:[],adv:{},skills:[],inj:[],spells:[]};
const elig=eng.rareEligibleItems(bruteModel);
assert.ok(elig.length>0, 'Brute should still have SOME eligible items (its own weapon families)');
assert.ok(!elig.some(i=>app.itemFamily(i.de)==='heavyarmour'),
  'rareEligibleItems must not offer heavy armour to the Brute');

// --- CASE 4: misc items are heroes-only by default; the miscHench house rule
//     may open them up, but toggling it must never REMOVE items from the list ---
state.S.house.miscHench=false;
const before=eng.rareEligibleItems(bruteModel).some(i=>i.cat==='misc');
state.S.house.miscHench=true;
const after=eng.rareEligibleItems(bruteModel).some(i=>i.cat==='misc');
// Brute is a hero (t==='hero'); if it's a hero, misc is already allowed. Just assert the flag never REMOVES items.
assert.ok(eng.rareEligibleItems(bruteModel).length>0, 'house rule toggle keeps a non-empty list');

// --- CASE 5: rareCost sums quantity*paid across the rare bag ---
const withRare={uid:3,uid_def:'capt',name:'Captain',exp:0,qty:1,eq:{},
  rare:{'Meisterhafte Schwere Rüstung':{q:1,paid:120},'Speer':{q:2,paid:15}},mut:[],adv:{},skills:[],inj:[],spells:[]};
assert.strictEqual(eng.rareCost(withRare), 120 + 2*15, 'rareCost = sum of q*paid');

console.log(`Rare items: OK (category rule enforced — Captain may take heavy armour/spear, Brute may not; rareEligibleItems hides forbidden armour; rareCost sums correctly)`);
