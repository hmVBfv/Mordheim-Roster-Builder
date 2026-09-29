/* What a unit may not take, found in the audit against mordheimer.net
 * (29.09.2026):
 * - List rows for Heroes only (Lizardmen): the Saurus list is shared by the
 *   Saurus Totem Warrior (a Hero) and the Saurus Braves (a Henchman group),
 *   but only a Hero may take a sacred marking. Such a row is marked
 *   {heroes: true}; for a Henchman it is shown but cannot be ticked.
 * - Skills a warband may never learn: Dwarf Rangers never take Arcane Lore.
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

state.replaceState({wb:'lizardmen',subtype:null,name:'',budget:500,models:[],hired:[],dp:[],leaderUid:null,
  campaign:{on:false,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
app.addUnit('saurustotem'); app.addUnit('saurusbrave');
const [hero,hench]=state.S.models;
/* The checkbox of a row, from the drawn equipment panel. */
const box=(m,nm)=>{ const html=app.eqSection(m); const i=html.indexOf(`toggleEq(${m.uid},'${nm}'`); assert.ok(i>0, `row ${nm} drawn`);
  return html.slice(html.lastIndexOf('<input',i), i); };
assert.ok(!/disabled/.test(box(hero,'Übergroße Kiefer')), 'the Saurus Totem Warrior may take Oversized Jaws');
assert.ok(/disabled/.test(box(hench,'Übergroße Kiefer')), 'Saurus Braves may not');
assert.ok(!/disabled/.test(box(hench,'Schild')), 'an ordinary row stays open for them');

// --- Dwarf Rangers and Arcane Lore ---
state.replaceState({wb:'dwarfrangers',subtype:null,name:'',budget:500,models:[],hired:[],dp:[],leaderUid:null,
  campaign:{on:false,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
const names=app.skillListsFor(app.unitDef('runesmith')).flatMap(([,sk])=>sk.map(s=>s[0]));
assert.ok(names.includes('Battle Tongue'), 'the Runesmith keeps the Academic list');
assert.ok(!names.includes('Arcane Lore'), 'but never Arcane Lore');

// --- rows for one variant only ---
const rows=(wb,sub,id)=>{ state.replaceState({wb,subtype:sub,name:'',budget:500,models:[],hired:[],dp:[],leaderUid:null,
  campaign:{on:false,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
  return Object.values(app.eqListFor(app.unitDef(id))).flat().map(r=>r[0]); };
assert.ok(rows('merc','midd','capt').includes('Wolfsumhang'), 'a Middenheim Captain may buy a Wolfcloak from his list');
assert.ok(!rows('merc','reik','capt').includes('Wolfsumhang'), 'a Reikland Captain may not');
assert.ok(rows('maraudersofchaos','hung','chieftain').includes('Warhorse'), 'Hung Heroes buy warhorses from their list');
assert.ok(!rows('maraudersofchaos','norse','chieftain').includes('Warhorse'), 'Norse do not');

console.log('Unit limits: OK (sacred markings for Heroes only, no Arcane Lore for Dwarf Rangers, variant rows)');
