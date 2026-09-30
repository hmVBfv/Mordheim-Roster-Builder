/* Items the catalogue keeps for certain warbands or warriors (29.09.2026).
 * The Trading Post offered them to anyone whose starting list had the same
 * kind of weapon: a Mercenary could find the Dwarf axe, the Pestilens censer,
 * the Amazons' Starblade or the Pit Fighters' trident. The restriction stood
 * in the catalogue only as text ("Dwarfs only"); now it is also data
 * (`only` on the catalogue item) and the Trading Post keeps to it.
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

/* The names of the catalogue items a new unit may look for. */
function offered(wb, subtype, unit, eq=[]){
  state.replaceState({wb,subtype,name:'',budget:900,models:[],hired:[],dp:[],leaderUid:null,
    campaign:{on:true,districts:{},round:3,log:[],battles:[]},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
  app.addUnit(unit);
  const m=S().models[S().models.length-1];
  for(const e of eq) app.setEqQty(m.uid, e, 1);
  return new Set(app.rareEligibleItems(m).map(x=>x.en));
}

// --- a Reikland Mercenary Captain with a sword: nothing of other warbands ---
{ const o=offered('merc','reik','capt',['Schwert']);
  for(const x of ['Dwarf axe','Censer','Disease dagger','Starblade','Starsword','Trident','Pike','Main gauche','Weeping blades','Fighting claws','Great axe','Zharr obsidian weapon','Obsidian weapon'])
    assert.ok(!o.has(x), `a Mercenary is not offered the ${x}`);
  assert.ok(o.has('Rapier'), 'Reiklanders may look for the rapier');
  assert.ok(o.has('Sword breaker'), 'unrestricted items stay on offer');
}
// --- the rapier is for Reiklanders, Marienburgers, Tileans and Hochland ---
assert.ok(!offered('merc','midd','capt',['Schwert']).has('Rapier'), 'not for Middenheimers');
assert.ok(offered('merc','mari','capt',['Schwert']).has('Rapier'), 'for Marienburgers');
// --- the warbands the items belong to still find them (items not already in their own list) ---
assert.ok(offered('hochland',null,'prince').has('Main gauche'), 'Hochland Bandits find the main gauche');
assert.ok(offered('skaven',null,'runner').has('Weeping blades'), 'Skaven find the weeping blades');
// --- items for one kind of warrior ---
{ const hero=offered('kislev',null,'capt');
  const hench=offered('kislev',null,'warrior');
  assert.ok(hero.has('Vodka'), 'a Kislevite Hero may look for vodka');
  assert.ok(!hench.has('Vodka'), 'a Kislevite Henchman may not'); }
// --- "not for": Undead do not buy garlic ---
assert.ok(!offered('undead',null,'vamp',['Schwert']).has('Garlic'), 'no garlic for the Undead');

console.log('Rare restrictions: OK (items of other warbands kept out, their own warbands still find them, Heroes-only items, "not for")');
