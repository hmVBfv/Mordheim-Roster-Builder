/* Campaign chronicle.
 *
 * The tool records what happens as it happens, stamped with the campaign stage
 * that is current at the time (0 = Setup, 1 = after the 1st battle, …), so the
 * campaign can be replayed in order afterwards. Entries can also be written or
 * corrected by hand. Battles carry their opponents (there may be several), the
 * map location, the outcome and the player's own account.
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

function fresh(on){ state.replaceState({wb:'skaven',subtype:null,name:'Klaue',budget:1000,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:!!on,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()}); }

// --- plain roster editing must NOT fill the chronicle when the campaign is off ---
fresh(false);
app.addUnit('adept');
assert.strictEqual(app.campState().log.length, 0, 'nothing is recorded while the campaign layer is off');

// --- with the campaign on, the tool records as it goes ---
fresh(true);
assert.strictEqual(app.campRound(), 0, 'a campaign starts at Setup');
assert.strictEqual(app.roundLabel(0), 'Setup');
assert.strictEqual(app.roundLabel(2), 'After battle 2');

app.addUnit('adept'); app.addUnit('vermin');
const vg=state.S.models.find(m=>m.uid_def==='vermin'); vg.qty=3;
assert.strictEqual(app.campState().log.filter(e=>e.type==='recruit').length, 2, 'recruitment is recorded');
assert.ok(app.campState().log.every(e=>e.round===0), 'setup events are stamped with the Setup stage');

// --- a battle: several opponents, location, outcome, account ---
app.addBattle({opponents:[{name:'Klaus',wb:'reikland'},{name:'Ulf',wb:'middenheim'}],
  outcome:'Victory', notes:'Ambush at the bridge.'});
const bats=app.campState().battles;
assert.strictEqual(bats.length, 1, 'the battle is stored');
assert.strictEqual(bats[0].opponents.length, 2, 'several opponents are kept');
assert.strictEqual(bats[0].notes, 'Ambush at the bridge.', 'the player account is kept for the narrative');
const batEv=app.campState().log.find(e=>e.type==='battle');
assert.ok(/Klaus/.test(batEv.text) && /Ulf/.test(batEv.text), 'the battle entry names every opponent');

// --- stage advances, later events are stamped with the new stage ---
app.advanceRound();
assert.strictEqual(app.campRound(), 1, 'the campaign moves on a stage');
app.killHench(vg.uid);
const adept=state.S.models.find(m=>m.uid_def==='adept');
app.addAdv(adept.uid,'WS');
const r1=app.campState().log.filter(e=>e.round===1);
assert.ok(r1.some(e=>e.type==='death'), 'a death is recorded under the current stage');
assert.ok(r1.some(e=>e.type==='advance'), 'an advance is recorded under the current stage');

// --- manual entry, correction and deletion ---
const note=app.addLogNote('Rats fled into the sewers.');
assert.strictEqual(note.auto, false, 'a hand-written entry is marked as such');
app.editLogText(note.id,'Rats fled into the sewers, cackling.');
assert.strictEqual(app.campState().log.find(e=>e.id===note.id).edited, true, 'a corrected entry is flagged');
const before=app.campState().log.length;
app.removeLogAt(note.id);
assert.strictEqual(app.campState().log.length, before-1, 'an entry can be removed');

// --- removing a battle also drops its chronicle entry ---
app.removeBattle(bats[0].id);
assert.strictEqual(app.campState().battles.length, 0, 'the battle is removed');
assert.ok(!app.campState().log.some(e=>e.type==='battle'), 'its chronicle entry goes with it');

// --- it renders ---
app.renderCampaign();
const html=store['campaignpanel'].innerHTML;
assert.ok(/Chronicle/.test(html), 'the chronicle is rendered');
assert.ok(/After battle 1/.test(html), 'stages are shown');

// --- old saves without a chronicle still load and gain empty defaults ---
app.applyState({wb:'skaven',subtype:null,name:'Alt',budget:500,
  models:[{uid:1,uid_def:'adept',name:'A',exp:20,qty:1,eq:{},mut:[],adv:{},skills:[],inj:[],spells:[]}],
  hired:[],dp:[],leaderUid:1,campaign:{on:true,districts:{}},stash:{wyrd:0,gold:0,items:[]},house:{}});
assert.strictEqual(app.campRound(), 0, 'a campaign without a stage defaults to Setup');
assert.deepStrictEqual(app.campState().log, [], 'a campaign without a log gets an empty one');
assert.deepStrictEqual(app.campState().battles, [], 'a campaign without battles gets an empty list');

console.log('Campaign chronicle: OK (stages, automatic events, battles with several opponents, manual entries, old saves)');
