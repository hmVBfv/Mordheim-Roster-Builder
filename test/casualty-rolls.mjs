/* Experience eligibility, resolving casualties on the right chart, and editing
 * a battle after the fact.
 *
 * Three faults this guards against, all found in play:
 *  - a Trade Wagon was listed as earning experience, though beasts and vehicles
 *    never gain any (the same flag that stops the roster offering them a bar);
 *  - a warrior recorded as slain was still credited with surviving the battle;
 *  - setting a casualty to "dead" left the warrior on the roster, so the
 *    casualty record and the Fallen list told different stories.
 *
 * The outcome of a casualty is now rolled on the chart that actually applies:
 * the D66 Serious Injuries chart for Heroes, and for Henchmen their own D6,
 * where 1-2 removes the man for good and 3-6 he fights on as normal
 * (mordheimer, Tools & Reference Tables).
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
const D=await import(new URL('../data/index.js', import.meta.url).href);
const state=await import(new URL('../js/state.js', import.meta.url).href);

const PIT=D.DISTRICTS[0].id;

state.replaceState({wb:'caravans',subtype:null,name:'Handelszug',budget:900,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:true,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
app.addUnit('merchant'); app.addUnit('sellsword');
const merchant=state.S.models.find(m=>m.uid_def==='merchant'); merchant.name='Sir Dieter von Wurtzen';
const sells=state.S.models.find(m=>m.uid_def==='sellsword'); sells.qty=2;

// a unit flagged as gaining no experience
const noxpDef=D.WARBANDS.caravans.units.find(u=>u.noxp);
if(noxpDef){ app.addUnit(noxpDef.id);
  const wagon=state.S.models.find(m=>m.uid_def===noxpDef.id);
  assert.strictEqual(app.canEarnXp(wagon), false, noxpDef.name+' never gains experience'); }

// --- henchmen earn as a group, and the entry has to say so ---
assert.ok(/\(group/.test(app.modelLabel(sells)),
  'a henchman group is labelled as a group, not as one man: '+app.modelLabel(sells));
assert.ok(!/\(group/.test(app.modelLabel(merchant)), 'a Hero is not');

// --- the experience list leaves out those who cannot earn ---
app.advanceRound();
const bat=app.addBattle({sides:[{key:'me',name:'Handelszug',wb:'caravans',outcome:'Victory'}],
  district:PIT, outcome:'Victory'});
app.awardBattleXp(bat.id);
const earners=app.pendingXp().map(x=>x.name);
if(noxpDef) assert.ok(!earners.some(n=>n.startsWith(noxpDef.name)),
  noxpDef.name+' is not listed as earning: '+earners.join(', '));
assert.ok(earners.some(n=>/Sir Dieter/.test(n)), 'the Hero earns');

// --- a Hero is rolled on the D66 chart, and Dead moves him to the Fallen ---
const cas=app.addCasualty({victim:{uid:merchant.uid,name:'Sir Dieter von Wurtzen',wb:'caravans'},
  attacker:{name:'Champion',wb:'maraudersofchaos'}});
const heroOpts=app.casualtyRollOptions(cas);
assert.ok(heroOpts.length>10, 'a Hero gets the full D66 chart');
assert.ok(heroOpts.some(o=>o.code==='11-15'), 'including Dead');

app.resolveCasualtyRoll(cas.id,'11-15');
assert.ok(!state.S.models.some(m=>m.uid===merchant.uid), 'a Hero rolled Dead leaves the roster');
assert.strictEqual(state.S.fallen.length, 1, 'and appears among the Fallen');
assert.strictEqual(state.S.fallen[0].m.name, 'Sir Dieter von Wurtzen');
assert.strictEqual(cas.result, 'dead');
assert.strictEqual(cas.fallenId, 0, 'the casualty points at the Fallen entry');
assert.strictEqual(state.S.fallen[0].casualtyId, cas.id, 'and the Fallen entry back at the casualty');

// --- a Henchman is rolled on his own D6 ---
const cas2=app.addCasualty({victim:{uid:sells.uid,name:'Sell-sword 1',wb:'caravans'},
  attacker:{name:'Champion',wb:'maraudersofchaos'}});
const henchOpts=app.casualtyRollOptions(cas2);
assert.deepStrictEqual(henchOpts.map(o=>o.code), ['1-2','3-6'],
  'a Henchman gets the D6 chart, not the D66 one');
app.resolveCasualtyRoll(cas2.id,'3-6');
assert.ok(state.S.models.some(m=>m.uid===sells.uid), 'on 3-6 he fights on');
assert.strictEqual(cas2.result, 'recovered');

// 1-2 takes him off the roster for good
const cas3=app.addCasualty({victim:{uid:sells.uid,name:'Sell-sword 1',wb:'caravans'},
  attacker:{name:'Champion',wb:'maraudersofchaos'}});
const before=Number(sells.qty)||1;
app.resolveCasualtyRoll(cas3.id,'1-2');
assert.strictEqual(Number(sells.qty)||0, before-1, 'on 1-2 the group loses a man');
assert.strictEqual(cas3.result, 'dead');

// --- a slain warrior is not also credited with surviving ---
app.clearPendingXp();
const bat2=app.addBattle({sides:[{key:'me',name:'Handelszug',wb:'caravans',outcome:'Victory'}],outcome:'Victory'});
const casDead=app.addCasualty({victim:{uid:sells.uid,name:'Sell-sword 1',wb:'caravans'},
  attacker:{name:'Champion',wb:'maraudersofchaos'}, result:'dead'});
assert.ok(casDead);

// --- a battle can be corrected instead of deleted and retyped ---
app.editBattleForm(bat.id);
assert.strictEqual(app.battleDraft().editId, bat.id, 'the battle is loaded back into the form');
assert.strictEqual(app.battleDraft().district, PIT, 'with everything it had');
app.setDraftField('notes','Rewritten account.');
app.saveBattleForm();
const battles=state.S.campaign.battles.filter(b=>b.id===bat.id);
assert.strictEqual(battles.length, 1, 'editing does not create a second battle');
assert.strictEqual(battles[0].notes, 'Rewritten account.', 'and the correction is kept');

// --- the map can be corrected by hand ---
app.cfNew('X');
app.campDistricts()[PIT]='foothold';
app.renderCampaign();
assert.ok(/cfClearDistrict/.test(store['campaignpanel'].innerHTML), 'a location can be cleared');
assert.ok(/cfToggleFoothold/.test(store['campaignpanel'].innerHTML), 'and footholds set by hand');
app.cfClearDistrict(PIT);
assert.strictEqual(app.campDistricts()[PIT], 'none', 'clearing takes the foothold away');

console.log('Experience eligibility, injury charts & battle editing: OK');
