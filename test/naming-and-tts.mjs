/* Defaults, the campaign table, export file names, and the TTS fields.
 *
 * Small things, but each of them was a papercut: blank warband names made every
 * export read "warband", unnamed players left indistinguishable blank cells,
 * and a folder of exports from several game nights could not be told apart.
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
const tts=await import(new URL('../js/tts.js', import.meta.url).href);
const D=await import(new URL('../data/index.js', import.meta.url).href);
const state=await import(new URL('../js/state.js', import.meta.url).href);

// --- a new warband is named after its type rather than left blank ---
app.chooseWb('skaven');
assert.strictEqual(state.S.name, D.WARBANDS.skaven.name, 'a new warband takes its type as its name');
assert.strictEqual(store['wbname'].value, D.WARBANDS.skaven.name, 'and the field shows it');

state.replaceState({wb:'skaven',subtype:null,name:'Klaue',budget:600,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:true,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
app.addUnit('adept'); app.addUnit('vermin');
const hero=state.S.models.find(m=>m.uid_def==='adept'); hero.name='Skritch';
const hench=state.S.models.find(m=>m.uid_def==='vermin');

// --- export names carry the campaign stage and the date ---
const atSetup=app.stampedName();
assert.ok(/_setup_\d{4}-\d{2}-\d{2}$/.test(atSetup), 'an export made at setup says so: '+atSetup);
app.advanceRound();
assert.ok(/_battle1_\d{4}-\d{2}-\d{2}$/.test(app.stampedName()), 'and later exports carry the stage');
assert.ok(app.stampedName().startsWith('Klaue'), 'the warband name still leads the file name');

// --- the campaign file gives players a name and shows the rating ---
const wbA=JSON.parse(JSON.stringify(state.S));
app.cfNew('Nights');
app.cfImportWarband(wbA,'');
app.cfImportWarband(Object.assign({},wbA,{name:'Andere'}),'');
const players=app.cfGet().warbands.map(w=>w.player);
assert.deepStrictEqual(players, ['Player 1','Player 2'], 'unnamed players are numbered rather than left blank');
const stats=app.cfStats();
assert.ok(stats.every(x=>typeof x.rating==='number'), 'the table knows each warband rating');
app.renderCampaign();
assert.ok(/<th>Rating<\/th>/.test(store['campaignpanel'].innerHTML), 'the rating column is shown');

// --- TTS: the name is its own copyable field, Heroes in a darker gold ---
tts.ttsOpen(hero.uid);
assert.strictEqual(store['ttsname'].value, '[B8860B]Skritch[-]', 'a Hero name uses the darker gold');
tts.ttsOpen(hench.uid);
assert.ok(/^\[E8C26B\]/.test(store['ttsname'].value), 'the rank and file use the lighter gold');

// --- the stat line carries the permanent save ---
hero.eq={'Schwere R\u00fcstung':1,'Helm':1,'Schild':1};
tts.ttsOpen(hero.uid);
const statline=store['ttstext'].value.split('\n')[0];
assert.ok(/Sv 5\+/.test(statline), 'heavy armour gives a 5+ save: '+statline);
assert.strictEqual(app.svOfModel(hero), 5,
  'the shield is deliberately excluded - the save shown is the one always in force');

hench.eq={};
tts.ttsOpen(hench.uid);
assert.ok(/Sv -/.test(store['ttstext'].value.split('\n')[0]), 'no armour shows no save');

console.log('Defaults, campaign table, export names, TTS name & save: OK');
