/* The House Rules panel.
 *
 * Guards two things that broke in play:
 *  - Rows were misaligned because a four-item row was rendered into a
 *    three-column grid, and the value field was clipped by a too-narrow column.
 *    Every row must therefore keep a consistent, complete structure.
 *  - Regrouping the fieldsets must never silently drop a rule: every key in
 *    houseDefaults() has to appear somewhere in the panel.
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

state.replaceState({wb:'skaven',subtype:null,name:'',budget:500,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:false,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
app.renderHouse();
const html=store['houserules'].innerHTML;

// --- no rule may be lost when the fieldsets are regrouped ---
const keys=Object.keys(state.houseDefaults()).filter(k=>!['notes','hsGrades','dpGrades'].includes(k));
const missing=keys.filter(k=>!html.includes(`'${k}'`));
assert.deepStrictEqual(missing, [], 'every house rule must still be rendered in the panel');

// --- rows keep a complete structure (label + control present) ---
const rows=html.match(/<label class="hr-row[^"]*">[\s\S]*?<\/label>/g)||[];
assert.ok(rows.length>=8, 'the panel renders its rule rows');
rows.forEach(r=>{
  assert.ok(/class="hl"/.test(r), 'each row has a label cell');
  assert.ok(/class="(hc|hv)"/.test(r), 'each row has a control cell');
});

// --- price rows use the full-width slider layout ---
assert.strictEqual((html.match(/hr-row hr-slider/g)||[]).length, 4,
  'the four price rows use the wide slider layout');

// --- the panel is grouped into subject fieldsets ---
const legends=[...html.matchAll(/<legend>([^<]+)<\/legend>/g)].map(m=>m[1]);
assert.ok(legends.length>=5, 'rules are grouped into subject fieldsets');
assert.ok(legends.some(l=>/composition/i.test(l)) && legends.some(l=>/Equipment costs/i.test(l)),
  'the expected subject groups exist');

console.log('House Rules panel: OK (no rule lost, rows complete, sliders full width, grouped by subject)');
