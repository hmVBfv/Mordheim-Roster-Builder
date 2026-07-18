/* The campaign file.
 *
 * A campaign lives in its own document, separate from any single warband: one
 * person collects the other players' warband exports into it and passes the
 * updated file on. No server is involved — GitHub Pages serves static files
 * only — so the exchange is the file itself.
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

// --- build two players' warbands, each with some campaign history ---
state.replaceState({wb:'skaven',subtype:null,name:'Klaue',budget:500,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:true,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
app.addUnit('adept'); app.addUnit('vermin');
const vg=state.S.models.find(m=>m.uid_def==='vermin'); vg.qty=3;
app.addBattle({opponents:[{name:'Klaus',wb:'merc'}],outcome:'Victory',notes:'Bridge ambush.'});
app.advanceRound(); app.killHench(vg.uid);
const wbA=JSON.parse(JSON.stringify(state.S));

state.replaceState({wb:'merc',subtype:'reik',name:'Klaus Truppe',budget:500,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:true,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
app.addUnit('capt');
app.addBattle({opponents:[{name:'Klaue',wb:'skaven'}],outcome:'Defeat',notes:'Rats everywhere.'});
const wbB=JSON.parse(JSON.stringify(state.S));

// --- collecting them into one campaign file ---
app.cfNew('Mordheim Nights');
assert.strictEqual(app.cfGet().name, 'Mordheim Nights');
assert.ok(app.cfImportWarband(wbA,'Rob').ok, 'a warband export can be taken into the campaign');
assert.ok(app.cfImportWarband(wbB,'Klaus').ok);
assert.strictEqual(app.cfGet().warbands.length, 2, 'both warbands are in the file');

// re-importing after a game night updates the player instead of duplicating them
const again=app.cfImportWarband(wbA,'Rob');
assert.strictEqual(again.updated, true, 're-importing a warband updates it in place');
assert.strictEqual(app.cfGet().warbands.length, 2, 'no duplicate player is created');

// a warband file is not a campaign file
assert.strictEqual(app.cfImportFile(JSON.stringify(wbA)).ok, false, 'a warband export is rejected as a campaign file');

// --- the campaign-wide chronicle merges every warband's own log ---
const merged=app.cfMergedLog();
assert.strictEqual(new Set(merged.map(e=>e.who)).size, 2, 'the merged history covers both warbands');
assert.ok(merged.every((e,i,a)=>i===0||a[i-1].round<=e.round), 'the merged history is ordered by stage');

// --- battles are kept as each side recorded them ---
const bats=app.cfAllBattles();
assert.strictEqual(bats.length, 2, 'both accounts of the evening are kept');
assert.ok(bats.some(b=>b.outcome==='Victory') && bats.some(b=>b.outcome==='Defeat'),
  'each side keeps its own outcome');

// --- tallies for evaluation ---
const stats=app.cfStats();
const rob=stats.find(s=>s.name==='Klaue');
assert.strictEqual(rob.player, 'Rob');
assert.strictEqual(rob.fallen, 1, 'fallen warriors are counted per warband');
assert.strictEqual(rob.battles, 1);
assert.strictEqual(rob.wins, 1, 'victories are counted');

// --- the file survives being passed on and reopened ---
const onDisk=JSON.stringify(app.cfGet());
app.cfClose();
assert.strictEqual(app.cfGet(), null, 'the file can be closed');
assert.ok(app.cfImportFile(onDisk).ok, 'the campaign file reopens');
assert.strictEqual(app.cfGet().warbands.length, 2, 'nothing is lost in the round trip');

// --- it renders ---
app.renderCampaign();
const html=store['campaignpanel'].innerHTML;
assert.ok(/Rob/.test(html) && /Klaus/.test(html), 'the panel lists the players');
assert.ok(/Campaign history/.test(html), 'the merged history is shown');

console.log('Campaign file: OK (collects warbands, updates in place, merged history, tallies, round trip)');
