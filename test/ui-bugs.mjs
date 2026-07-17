/* Regression tests for three UI bugs found in play:
 *  1. Warband special-skill list appeared twice for units whose own `sk` list
 *     already named the warband skill set (it was appended again via WBEXTRA).
 *  2. Adding a skill to a hero threw a ReferenceError (skillText called with an
 *     undefined `e`), which aborted render() — the UI appeared to "freeze".
 *  3. The official-sheet PDF export threw "Assignment to constant variable"
 *     because pdf.js imported _sheetBytes from app.js (a read-only binding) and
 *     then assigned to it; the export silently did nothing.
 */
import assert from 'assert';
import * as fs from 'fs';

const el=(id)=>{ const e={id,style:{},className:'',_html:'',value:'',checked:false,
  set innerHTML(v){this._html=v;}, get innerHTML(){return this._html;},
  appendChild(){}, addEventListener(){}, getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}),
  querySelectorAll:()=>[], querySelector:()=>null, click(){}, focus(){}, select(){}, setAttribute(){}, removeAttribute(){}, remove(){}, closest:()=>null }; return e; };
const store={};
globalThis.document={getElementById:(id)=>store[id]||(store[id]=el(id)),createElement:el,addEventListener(){},body:{appendChild(){}},querySelectorAll:()=>[],querySelector:()=>null};
globalThis.window={addEventListener(){},scrollTo(){},innerWidth:1000,matchMedia:()=>({matches:false,addEventListener(){}}),storage:{list:async()=>({keys:[]})}};
globalThis.Blob=function(){ this.parts=arguments; }; globalThis.URL.createObjectURL=()=>'blob:x';
globalThis.fetch=async(u)=>{const p=decodeURIComponent(new URL(u).pathname);
  return {ok:fs.existsSync(p),json:async()=>JSON.parse(fs.readFileSync(p,'utf8')),arrayBuffer:async()=>fs.readFileSync(p).buffer};};

// pdf.js needs PDFLib on the global for the export test.
const pdflibSrc=fs.readFileSync(new URL('../vendor/pdf-lib.min.js', import.meta.url),'utf8');
new Function('self','window',pdflibSrc)(globalThis, globalThis);

const app=await import(new URL('../js/app.js', import.meta.url).href);
const pdf=await import(new URL('../js/pdf.js', import.meta.url).href);
const state=await import(new URL('../js/state.js', import.meta.url).href);

function fresh(wb){ state.replaceState({wb,subtype:null,name:'Test',budget:500,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:false,districts:{}},stash:{wyrd:0,gold:null,items:[]},house:state.houseDefaults()}); }

// --- Bug 1: no duplicate warband special-skill list ---
fresh('skaven');
const adept=app.unitDef('adept'); // sk includes 'skavenSkills'; WBEXTRA.skaven.skills === 'skavenSkills'
const labels=app.skillListsFor(adept).map(l=>l[0]);
const counts={}; labels.forEach(l=>counts[l]=(counts[l]||0)+1);
const dupes=Object.entries(counts).filter(([,n])=>n>1);
assert.strictEqual(dupes.length, 0, 'skill lists must not contain duplicates: '+JSON.stringify(dupes));

// --- Bug 2: adding a skill doesn't break render() ---
fresh('skaven');
app.addUnit('adept');
const m=state.S.models[0];
app.render(); // baseline
m.skills=['Sprint'];
assert.doesNotThrow(()=>app.render(), 'render() must not throw after a skill is added');

// --- Bug 3: official-sheet PDF export runs without throwing ---
fresh('skaven');
app.addUnit('adept'); app.addUnit('runner');
state.S.models[0].skills=['Sprint'];
await assert.doesNotReject(() => pdf.exportOfficialSheet(),
  'exportOfficialSheet() must not reject (was: Assignment to constant variable on _sheetBytes)');

console.log('UI bugs: OK (no duplicate skill lists; render survives skill add; PDF export runs)');
