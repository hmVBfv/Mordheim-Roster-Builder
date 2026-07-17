/* Guards several playtest bugs:
 *  - TTS skill lines showed "[object Object]" (skillInfo returns an object;
 *    the text field must be used).
 *  - Standalone rare/magic items were missing from the TTS equipment line.
 *  - "Advance due!" fired whenever XP sat on a threshold, even after the
 *    advance had been applied — it must compare earned vs applied.
 */
import assert from 'assert';
import * as fs from 'fs';

const el=(id)=>({id,style:{},value:'',set innerHTML(v){this._h=v;},get innerHTML(){return this._h||'';},appendChild(){},addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}),querySelectorAll:()=>[],querySelector:()=>null,click(){},focus(){},select(){}});
const store={};
globalThis.document={getElementById:(id)=>store[id]||(store[id]=el(id)),createElement:el,addEventListener(){},body:{appendChild(){}},querySelectorAll:()=>[],querySelector:()=>null};
globalThis.window={addEventListener(){},scrollTo(){},innerWidth:1000,matchMedia:()=>({matches:false,addEventListener(){}}),storage:{list:async()=>({keys:[]})}};
globalThis.Blob=function(){}; globalThis.URL.createObjectURL=()=>''; globalThis.confirm=()=>true;
globalThis.fetch=async(u)=>{const p=decodeURIComponent(new URL(u).pathname);
  return {ok:fs.existsSync(p),json:async()=>JSON.parse(fs.readFileSync(p,'utf8')),arrayBuffer:async()=>fs.readFileSync(p).buffer};};

const app=await import(new URL('../js/app.js', import.meta.url).href);
const tts=await import(new URL('../js/tts.js', import.meta.url).href);
const state=await import(new URL('../js/state.js', import.meta.url).href);

state.replaceState({wb:'skaven',subtype:null,name:'',budget:2000,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:false,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
app.addUnit('adept'); const m=state.S.models.find(x=>x.uid_def==='adept');

// --- TTS skill text (no [object Object]) ---
m.skills=['Haggle'];
tts.ttsOpen(m.uid);
let card=''; for(const k in store){ const h=store[k].innerHTML; if(h.includes('Special Rules')||h.includes('Haggle')) card+=h; }
assert.ok(card.includes('Haggle') && !card.includes('[object Object]'), 'TTS shows the skill text, not [object Object]');

// --- Standalone rare item appears in TTS equipment ---
const elig=app.rareEligibleItems(m).filter(it=>it.cat!=='cc'||true);
const item=elig.find(it=>it.en);
if(item){ app.addRare(m.uid, item.de);
  tts.ttsOpen(m.uid);
  let c2=''; for(const k in store){ const h=store[k].innerHTML; if(h.includes('Equipment')) c2+=h; }
  assert.ok(c2.includes(item.en), 'standalone rare item is listed in the TTS equipment line');
  assert.ok(app.rareDisplayParts(m).length>=1, 'rareDisplayParts lists the standalone item');
}

// --- Advance due reflects applied vs earned ---
const m2=(app.addUnit('runner'), state.S.models.find(x=>x.uid_def==='runner'));
m2.exp=6; m2.skills=[]; m2.adv={};   // start 0 -> earned 3 at exp 6
assert.ok(/Advance due!/.test(app.xpBar(m2)), 'advance is due when earned but not applied');
m2.skills=['Testskill'];   // apply one advance
// at exp 6 a hero earned advances at 2,4,6 = 3; applying only 1 still leaves due
m2.adv={'WS':1}; m2.skills=['a','b'];   // 1 stat + 2 skills = 3 applied = earned
assert.ok(!/Advance due!/.test(app.xpBar(m2)), 'no "Advance due!" once all earned advances are applied');

console.log('TTS & advancement: OK (skill text, rare items in TTS, advance-due earned vs applied)');
