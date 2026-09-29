/* Founding prices versus the Trading Post (Rob, 29.09.2026, answers C2, C3,
 * C7 in docs/rules-audit.md). Some list rows and upgrades have a special
 * price that holds only while the warband is founded; after its first battle
 * the item is found at the Trading Post at the price there. Before this test
 * the Nightmare cost 95 gc in the Aristocrat's list and could not be found at
 * the Trading Post at all, and the Dwarfs paid three times the price for
 * gromril weapons at any time. Also: saves written before an item was
 * renamed load with the new name.
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
const state=await import(new URL('../js/state.js', import.meta.url).href);
const S=()=>state.S;

/* A fresh warband with one unit; stage null = outside the campaign. */
function band(wb,unit,stage){
  state.replaceState({wb,subtype:null,name:'',budget:500,models:[],hired:[],dp:[],leaderUid:null,
    campaign:{on:stage!=null,districts:{},round:stage||0,log:[],battles:[]},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
  app.addUnit(unit);
  return S().models[S().models.length-1];
}

// --- has the warband fought? ---
band('merc','capt',null); assert.strictEqual(app.warbandHasFought(), false, 'outside the campaign: founding');
band('merc','capt',0);    assert.strictEqual(app.warbandHasFought(), false, 'stage Setup: founding');
band('merc','capt',1);    assert.strictEqual(app.warbandHasFought(), true,  'after battle 1: fought');

// --- gromril weapons: 3x for Dwarfs at the founding, 4x later and for everyone else ---
for(const [stage,mult] of [[0,3],[1,4]]){
  const m=band('dwarftreasure','noble',stage); app.setEqQty(m.uid,'Axt',1);
  assert.strictEqual(app.upgradePaid(m,'Gromril-Waffe','Axt'), 5*mult, `gromril axe at stage ${stage}`);
}
{ const m=band('merc','capt',0); app.setEqQty(m.uid,'Axt',1);
  assert.strictEqual(app.upgradePaid(m,'Gromril-Waffe','Axt'), 20, 'a Mercenary pays 4x at any time'); }
{ const m=band('pitfighters','trollslayer',1); app.setEqQty(m.uid,'Axt',1);
  assert.strictEqual(app.upgradePaid(m,'Gromril-Waffe','Axt'), 15, 'the Pit Fighters\' Troll Slayer pays 3x at any time'); }

// --- Dark Elf blade: +15 at the founding, +20 later ---
for(const [stage,price] of [[0,15],[1,20]]){
  const m=band('darkelves','highborn',stage); app.setEqQty(m.uid,'Schwert',1);
  assert.strictEqual(app.upgradeBase('Dark-Elf-Klinge'), price, `blade at stage ${stage}`);
  app.toggleWeaponUpgrade(m.uid,'Dark-Elf-Klinge','Schwert',true);
  assert.strictEqual(S().models[0].rare['Dark-Elf-Klinge'].paid, price, `blade paid at stage ${stage}`);
}

// --- list rows with a founding price ---
{ const m=band('cavalcade','aristocrat',1); const def=app.unitDef('aristocrat');
  const st=app.startOnlyRow(def,'Nightmare');
  assert.ok(st && st.start && st.later && st.later.cost===95, 'the Nightmare row is a founding price; 95 gc later');
  assert.strictEqual(app.startOnlyRow(def,'Schwert'), null, 'an ordinary row is not');
  assert.ok(app.rareEligibleItems(m).some(x=>x.de==='Nightmare'), 'the Nightmare can be found at the Trading Post');
  app.addRare(m.uid,'Nightmare');
  assert.strictEqual(S().models[0].rare.Nightmare.paid, 95, 'at the Trading Post price');
}
{ const m=band('merc','capt',1);
  assert.ok(!app.rareEligibleItems(m).some(x=>x.de==='Schwert'), 'list items at their normal price stay out of the Trading Post'); }

// --- saves written before an item was renamed ---
{ band('sonsofhashut','sorcerer',null);
  const save=JSON.parse(JSON.stringify(S())); save.models[0].eq={'Dolch (1. gratis)':1, Obsidianwaffe:1};
  app.applyState(save);
  assert.deepStrictEqual(S().models[0].eq, {'Dolch (1. gratis)':1, 'Zharr-Obsidianwaffe':1}, 'the Sons of Hashut weapon loads as the Zharr obsidian weapon'); }
{ band('shadowwarriors','shadowmaster',null);
  const save=JSON.parse(JSON.stringify(S())); save.models[0].eq={'Ithilmar-Waffe':1};
  save.models[0].rare={'Banner von Nagarythe':{q:1,paid:80}, 'Ithilmar-Waffe':{q:1,on:'Schwert',paid:30}};
  app.applyState(save);
  assert.deepStrictEqual(S().models[0].eq, {'Ithilmar-Schwert':1}, 'the old Ithilmar row loads as the Ithilmar sword');
  assert.deepStrictEqual(S().models[0].rare, {'Standarte von Nagarythe':{q:1,paid:80}, 'Ithilmar-Waffe':{q:1,on:'Schwert',paid:30}}, 'the Trading Post upgrade keeps its name'); }
{ band('merc','capt',null);
  const save=JSON.parse(JSON.stringify(S())); save.models[0].rare={Obsidianwaffe:{q:1,on:'Schwert',paid:40}};
  app.applyState(save);
  assert.deepStrictEqual(S().models[0].rare, {Obsidianwaffe:{q:1,on:'Schwert',paid:40}}, 'elsewhere it is the Border Town Burning upgrade'); }

console.log('Founding prices: OK (stage decides, gromril 3x/4x, Dark Elf blade 15/20, founding rows on offer at the Trading Post, renamed items load)');
