/* A promoted Hero must not share objects with the group he left.
 *
 * The Lad's Got Talent copies the group's profile onto the new Hero. The
 * injuries and spells were copied shallowly, so both kept pointing at the
 * same objects: lowering the Hero's spell difficulty lowered the group's too.
 * Found by the core/ parity walk.
 */
import assert from 'assert';
import * as fs from 'fs';

const el=()=>({style:{},className:'',textContent:'',value:'',checked:false,set innerHTML(v){},get innerHTML(){return '';},
  appendChild(){},addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}),querySelectorAll:()=>[],click(){},focus(){},select(){}});
globalThis.document={getElementById:el,createElement:el,addEventListener(){},body:{appendChild(){}},querySelectorAll:()=>[]};
globalThis.window={addEventListener(){},scrollTo(){},innerWidth:1000,matchMedia:()=>({matches:false,addEventListener(){}}),storage:{list:async()=>({keys:[]})}};
globalThis.Blob=function(){}; globalThis.URL.createObjectURL=()=>''; globalThis.confirm=()=>true; globalThis.alert=()=>{};
globalThis.fetch=async(u)=>{const p=decodeURIComponent(new URL(u).pathname);
  return {ok:fs.existsSync(p),json:async()=>JSON.parse(fs.readFileSync(p,'utf8')),arrayBuffer:async()=>fs.readFileSync(p).buffer};};

const app=await import(new URL('../js/app.js', import.meta.url).href);
const state=await import(new URL('../js/state.js', import.meta.url).href);

state.replaceState({wb:'merc',subtype:'reik',name:'T',budget:500,models:[],hired:[],dp:[],leaderUid:null,
  campaign:{on:false,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
app.addUnit('mark');
const group=state.S.models[0];
app.setQty(group.uid,3);
group.spells=[{name:'Spell (7)',red:0}];
group.inj=[{name:'Old Battle Wound',mod:{I:-1}}];
app.promoteHench(group.uid,0);
const hero=state.S.models.find(m=>m.promoted);
assert.ok(hero && hero.uid!==group.uid, 'a man left the group as a new Hero');

app.spellRed(hero.uid,0,1);
assert.strictEqual(hero.spells[0].red,1,'the Hero’s spell got easier');
assert.strictEqual(group.spells[0].red,0,'the group’s spell is unchanged');
hero.inj[0].mod.I=-2;
assert.strictEqual(group.inj[0].mod.I,-1,'the group’s injury is its own');
console.log('Promoted Hero is independent of his old group: OK');
