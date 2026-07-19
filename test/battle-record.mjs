/* Recording a battle: who fought, who felled whom, and what it won.
 *
 * Participants come from the campaign file when one is open, so attacker and
 * victim are picked from real rosters rather than typed — and henchmen are
 * listed man by man, since knowing which one went down is the point. A warband
 * not in the file can still be entered as free text.
 *
 * Territory follows one rule: winning at a location gives a foothold there, and
 * a warband controls a location when it is the ONLY one holding a foothold.
 * Control is therefore derived from the whole campaign, not something a warband
 * sets for itself — which also means our own warband has to be counted, not
 * only those in the file.
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

// --- the opponent's warband, as imported into the campaign file ---
state.replaceState({wb:'merc',subtype:'reik',name:'Klaus Truppe',budget:600,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:true,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
app.addUnit('capt'); app.addUnit('warr');
state.S.models.find(m=>m.uid_def==='capt').name='Klaus';
const theirGroup=state.S.models.find(m=>m.uid_def==='warr'); theirGroup.qty=2;
app.setMemberName(theirGroup.uid,0,'Hans'); app.setMemberName(theirGroup.uid,1,'Dieter');
const wbB=JSON.parse(JSON.stringify(state.S));

// --- our own warband ---
state.replaceState({wb:'skaven',subtype:null,name:'Klaue',budget:600,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:true,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
app.addUnit('adept'); app.addUnit('vermin');
const skritch=state.S.models.find(m=>m.uid_def==='adept'); skritch.name='Skritch';
const ourGroup=state.S.models.find(m=>m.uid_def==='vermin'); ourGroup.qty=2;
app.setMemberName(ourGroup.uid,0,'Grik');

app.cfNew('Nights');
app.cfImportWarband(wbB,'Klaus');

// --- participants and their models come from the campaign ---
const sides=app.battleSides();
assert.deepStrictEqual(sides.map(s=>s.name), ['Klaue','Klaus Truppe'],
  'our warband plus everyone in the campaign file');
const theirModels=app.sideModels('cf1').map(o=>o.label);
assert.ok(theirModels.includes('Hans') && theirModels.includes('Dieter'),
  'their henchmen are offered man by man: '+theirModels.join(', '));
assert.ok(theirModels.includes('Klaus'), 'and their heroes by name');

// --- fill in the battle ---
app.openBattleForm();
assert.strictEqual(app.battleDraft().sides.length, 1, 'we are always a participant');
app.addDraftSide('cf1');
app.setDraftSide(0,'outcome','Victory');
app.setDraftSide(1,'outcome','Defeat');
app.setDraftField('district', PIT);
app.setDraftField('notes','Rooftop ambush at dusk.');

const hans=app.sideModels('cf1').find(o=>o.label==='Hans');
app.addDraftCas();
app.setDraftCas(0,'vSide',1); app.setDraftCas(0,'vPick',`${hans.uid}:${hans.idx}`);
app.setDraftCas(0,'aSide',0); app.setDraftCas(0,'aPick',`${skritch.uid}:0`);
// the surroundings claim one of ours
app.addDraftCas();
app.setDraftCas(1,'vSide',0); app.setDraftCas(1,'vPick',`${ourGroup.uid}:0`);
app.setDraftCas(1,'aSide','env'); app.setDraftCas(1,'note','fell from a rooftop');
app.saveBattleForm();

// --- what was recorded ---
const bat=state.S.campaign.battles[0];
assert.deepStrictEqual(bat.sides.map(s=>[s.name,s.outcome]),
  [['Klaue','Victory'],['Klaus Truppe','Defeat']], 'each side keeps its own outcome');
assert.strictEqual(bat.opponents.length, 1, 'the older opponent shape is still filled in');

const cas=app.campCasualties();
assert.strictEqual(cas.length, 2);
assert.ok(/Hans .*by Skritch/.test(app.casualtyText(cas[0])), 'the kill names both men');
assert.strictEqual(cas[0].victim.grade, 'hench', 'and knows what rank the victim was');
assert.ok(/Grik .*by The surroundings/.test(app.casualtyText(cas[1])),
  'a fall is recorded without inventing a culprit');
assert.strictEqual(cas[1].victim.uid, ourGroup.uid, 'our own man is linked to the roster');

// --- experience follows the rules: the Hero earns, the surroundings do not ---
assert.strictEqual(app.pendingXpFor(skritch.uid), 1, 'our Hero earns for the enemy he felled');
assert.strictEqual(app.pendingXpTotal(), 1, 'nobody earns for a warrior the terrain claimed');

// --- winning gives a foothold; sole holder means control ---
assert.strictEqual(app.campDistricts()[PIT], 'foothold', 'the victory gained a foothold');
const ctl=app.cfControlAt(PIT);
assert.ok(ctl && ctl.mine, 'as the only holder we control the location');
assert.strictEqual(app.districtStatus(PIT), 'control');

// --- once someone else holds one there too, nobody controls it ---
wbB.campaign.districts[PIT]='foothold';
app.cfImportWarband(wbB,'Klaus');
assert.strictEqual(app.cfControlAt(PIT), null, 'two holders means the location is contested');
assert.strictEqual(app.districtStatus(PIT), 'foothold', 'we are back to a mere foothold');
const terr=app.cfTerritory();
assert.strictEqual(terr.length, 1);
assert.strictEqual(terr[0].holders.length, 2, 'both holders are listed');
assert.strictEqual(terr[0].control, null);

// --- and it renders ---
app.renderCampaign();
const html=store['campaignpanel'].innerHTML;
assert.ok(/Territory/.test(html), 'the territory table is shown');
assert.ok(/contested/.test(html), 'a contested location says so');

// --- a defeat costs the foothold, which can hand control to whoever is left ---
app.campDistricts()[PIT]='foothold';
app.applyBattleTerritory([{key:'me',outcome:'Defeat'}], PIT);
assert.strictEqual(app.campDistricts()[PIT], 'none', 'the defeated warband loses its foothold');
assert.ok(state.S.campaign.log.some(e=>e.type==='district' && /Lost the foothold/.test(e.text)),
  'and the map change is recorded');
// with us gone, the other holder is now alone there and controls it
const soleHolder=app.cfControlAt(PIT);
assert.ok(soleHolder && !soleHolder.mine, 'the remaining holder now controls the location');

app.applyBattleTerritory([{key:'me',outcome:'Victory'}], PIT);
assert.strictEqual(app.campDistricts()[PIT], 'foothold', 'winning there gains it back');

// --- the fallen must remain attributable ---
// Saying who killed a warrior is exactly the moment he has left the roster, so
// leaving the fallen out of the pickers made the attribution impossible for the
// deaths that matter most.
state.replaceState({wb:'skaven',subtype:null,name:'Klaue',budget:600,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:true,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
app.addUnit('adept'); app.addUnit('vermin');
const hero2=state.S.models.find(m=>m.uid_def==='adept'); hero2.name='Skritch';
const grp2=state.S.models.find(m=>m.uid_def==='vermin'); grp2.qty=2;
app.setMemberName(grp2.uid,0,'Dieter');

app.killHenchMember(grp2.uid,0);                 // dies before anyone says by whom
const pickable=app.sideModels('me');
const deadOne=pickable.find(o=>o.dead);
assert.ok(deadOne && deadOne.label==='Dieter', 'a fallen warrior can still be picked: '
  +pickable.map(o=>o.label).join(', '));

app.openCasForm();
app.setCasField('vSideKey','me');
app.setCasField('vPick', `f${deadOne.fallenIdx}`);
app.setCasField('aName','Klaus');
app.saveCasForm();
const last=app.campCasualties().slice(-1)[0];
assert.ok(/Dieter was slain by Klaus/.test(app.casualtyText(last)),
  'the death can be attributed after the fact');
assert.strictEqual(last.result, 'dead', 'a warrior already among the Fallen plainly did not survive');
assert.strictEqual(last.fallenId, deadOne.fallenIdx, 'the casualty points at the Fallen entry');
assert.strictEqual(state.S.fallen[deadOne.fallenIdx].casualtyId, last.id,
  'and the Fallen entry points back, so the two are linked both ways');

console.log('Battle record & territory: OK (participants, per-side outcome, named victims, environment, foothold gained and lost, derived control, fallen attributable)');
