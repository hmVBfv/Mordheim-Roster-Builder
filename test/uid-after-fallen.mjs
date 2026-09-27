/* A warrior's uid must stay his even after he has fallen and the roster has
 * been saved and loaded again.
 *
 * On loading, the uid counter was set past the highest uid among the living
 * models only. When the warrior with the highest uid had fallen, the next
 * unit hired after loading got his uid - and undoing his death then put two
 * models with the same uid on the roster, so edits to one landed on the
 * other. Found while porting the Fallen to core, which counts the Fallen too.
 */
import assert from 'assert';
import * as fs from 'fs';

const el=()=>({style:{},className:'',textContent:'',value:'',checked:false,set innerHTML(v){},get innerHTML(){return '';},
  appendChild(){},addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}),querySelectorAll:()=>[],click(){},focus(){},select(){},remove(){}});
globalThis.document={getElementById:el,createElement:el,addEventListener(){},body:{appendChild(){}},querySelectorAll:()=>[]};
globalThis.window={addEventListener(){},scrollTo(){},innerWidth:1000,matchMedia:()=>({matches:false,addEventListener(){}}),storage:{list:async()=>({keys:[]})}};
globalThis.Blob=function(){}; globalThis.URL.createObjectURL=()=>''; globalThis.confirm=()=>true; globalThis.alert=()=>{};
globalThis.fetch=async(u)=>{const p=decodeURIComponent(new URL(u).pathname);
  return {ok:fs.existsSync(p),json:async()=>JSON.parse(fs.readFileSync(p,'utf8')),arrayBuffer:async()=>fs.readFileSync(p).buffer};};

const app=await import(new URL('../js/app.js', import.meta.url).href);
const state=await import(new URL('../js/state.js', import.meta.url).href);

const uniqueUids=()=>{ const u=state.S.models.map(m=>m.uid); return new Set(u).size===u.length; };

// A Hero falls: the champion, the last model hired, so his uid is the highest.
app.chooseWb('merc');
app.addUnit('capt');
app.addUnit('champ');
const champ=state.S.models.find(m=>m.uid_def==='champ');
app.killHero(champ.uid);
assert.ok(state.S.fallen.some(e=>e.m.uid===champ.uid), 'the champion is among the Fallen');

// Save and load again, then hire.
app.applyState(JSON.parse(JSON.stringify(app.exportState())));
app.addUnit('champ');
const recruit=state.S.models.find(m=>m.uid_def==='champ');
assert.notStrictEqual(recruit.uid, champ.uid, 'a new recruit never gets the uid of a fallen warrior');

// Taking the death back must not create a twin.
app.undoFallen();
assert.ok(uniqueUids(), 'after undoing the death every model has its own uid');

// The same for a henchman group whose last man fell.
app.chooseWb('merc');
app.addUnit('capt');
app.addUnit('warr');
const warr=state.S.models.find(m=>m.uid_def==='warr');
app.killHench(warr.uid);
app.applyState(JSON.parse(JSON.stringify(app.exportState())));
app.addUnit('mark');
assert.notStrictEqual(state.S.models.find(m=>m.uid_def==='mark').uid, warr.uid, 'nor the uid of a fallen group');
console.log('Fallen warriors keep their uid across save and load: OK');
