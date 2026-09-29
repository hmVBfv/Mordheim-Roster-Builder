/* Running the campaign without being in every battle, merging what the other
 * players send in, and writing a battle onto the roster in one go.
 *
 * Four faults this guards against, all found in play:
 *  - the form assumed our own warband fought, though whoever keeps the campaign
 *    also records battles between two other players;
 *  - a henchman group still read "(group of 3)" after one of the three had died,
 *    because the label was frozen when the point was earned rather than read
 *    from the roster as it now stands;
 *  - applying the battle added experience but left deaths off the sheet, so the
 *    chronicle and the roster told different stories;
 *  - and applying twice killed the same man twice, because "is he still on the
 *    roster" cannot answer that for a group, which survives its own dead.
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

state.replaceState({wb:'caravans',subtype:null,name:'Zug',budget:900,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:true,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
app.addUnit('merchant'); app.addUnit('sellsword');
const group=state.S.models.find(m=>m.uid_def==='sellsword'); group.qty=3;
app.advanceRound();
app.cfNew('Nights');

// --- a battle between two other players, recorded by whoever keeps the campaign ---
app.openBattleForm();
app.addDraftSide(''); app.setDraftSide(1,'name','Klaus'); app.setDraftSide(1,'wb','merc');   app.setDraftSide(1,'outcome','Victory');
app.addDraftSide(''); app.setDraftSide(2,'name','Ulf');   app.setDraftSide(2,'wb','middenheim'); app.setDraftSide(2,'outcome','Defeat');
app.remDraftSide(0);                                   // we were not there
assert.strictEqual(app.draftIncludesUs(app.battleDraft()), false, 'our warband can be taken out');
app.setDraftField('district', PIT);
app.saveBattleForm();

assert.strictEqual(state.S.campaign.battles.length, 0,
  'a battle we did not fight in stays out of our own chronicle');
assert.strictEqual(app.cfGet().battles.length, 1, 'and is filed in the shared campaign file');
assert.ok(!app.campDistricts()[PIT] || app.campDistricts()[PIT]==='none',
  'their battle does not hand us a foothold');

// the last side standing cannot be removed
app.openBattleForm();
app.remDraftSide(0);
assert.strictEqual(app.battleDraft().sides.length, 1, 'a battle needs at least one side');
app.cancelBattleForm();

// --- a henchman group is counted as it stands now ---
const bat=app.addBattle({sides:[{key:'me',name:'Zug',wb:'caravans',outcome:'Victory'}],outcome:'Victory'});
app.awardBattleXp(bat.id);
assert.ok(/group of 3/.test(app.xpBarBlock()), 'three men at the time of the battle');

const cas=app.addCasualty({victim:{uid:group.uid,name:'Sell-sword 3',wb:'caravans',grade:'hench',memberIdx:2},
  attacker:{name:'Champion',wb:'maraudersofchaos'}});
app.resolveCasualtyRoll(cas.id,'1-2');
assert.strictEqual(Number(group.qty), 2, 'the group loses the man');
assert.ok(/group of 2/.test(app.xpBarBlock()),
  'and the experience list says two, not the count from when the point was earned');
assert.ok(!/group of 3/.test(app.xpBarBlock()));

// --- and the record keeps saying he was slain, not merely knocked down ---
assert.ok(/was slain/.test(app.casualtyText(cas)), app.casualtyText(cas));
assert.ok(state.S.campaign.log.some(e=>e.data&&e.data.casualtyId===cas.id&&/was slain/.test(e.text)),
  'the chronicle entry is retyped along with it');

// --- applying the battle writes deaths onto the sheet, not only experience ---
const cas2=app.addCasualty({victim:{uid:group.uid,name:'Sell-sword 1',wb:'caravans',grade:'hench',memberIdx:0},
  attacker:{name:'Marauder',wb:'maraudersofchaos'}});
cas2.result='dead';                       // rolled at the table, not yet on the sheet
assert.strictEqual(app.outstandingCasualties().length, 1,
  'the death already carried out is not counted again');

const before=state.S.fallen.length;
const res=app.applyBattleResults();
assert.strictEqual(res.died, 1, 'the outstanding death is applied');
assert.strictEqual(state.S.fallen.length, before+1, 'and the man joins the Fallen');
assert.strictEqual(Number(group.qty), 1);
assert.ok(res.xp>0, 'experience is applied in the same step');

// applying again must not kill anybody a second time
const after=state.S.fallen.length, qty=Number(group.qty);
app.applyBattleResults();
assert.strictEqual(state.S.fallen.length, after, 'applying twice changes nothing');
assert.strictEqual(Number(group.qty), qty);

// --- merging another player's file ---
const theirs={type:'mordheim-campaign-file', version:1, name:'Nights', round:1, warbands:[], log:[], battles:[
  // the one we already recorded above - the same battle, not a second one
  {id:9, round:1, district:PIT, opponents:[],
   sides:[{name:'Klaus',wb:'merc',outcome:'Victory'},{name:'Ulf',wb:'middenheim',outcome:'Defeat'}]},
  // and one we had not heard about
  {id:10, round:1, district:'', opponents:[],
   sides:[{name:'Ulf',wb:'middenheim',outcome:'Victory'},{name:'Greta',wb:'sos',outcome:'Defeat'}]}
]};
const merged=app.cfMergeFrom(theirs);
assert.strictEqual(merged.ok, true);
assert.strictEqual(merged.added, 1, 'only the battle we did not have is added');
assert.strictEqual(app.cfMergeFrom(theirs).added, 0, 'merging the same file again adds nothing');

const all=app.cfAllBattlesMerged();
assert.ok(all.some(b=>b.mine), 'the campaign-wide list holds our own battles');
assert.ok(all.some(b=>!b.mine), 'and those only the others were in');

// a plain warband file works as a source too
const theirWarband={wb:'merc', subtype:'reik', name:'Klaus Truppe', models:[], fallen:[],
  campaign:{on:true, round:1, districts:{}, battles:[
    {id:1, round:2, district:'', opponents:[], sides:[{name:'Klaus Truppe',wb:'merc',outcome:'Victory'},{name:'Greta',wb:'sos',outcome:'Defeat'}]}
  ]}};
const w=app.cfMergeFrom(theirWarband);
assert.strictEqual(w.ok, true);
assert.strictEqual(w.added, 1, 'a battle out of a warband file is taken too');
assert.strictEqual(w.warbands, 1, 'and the warband itself is imported');

console.log('Campaign keeping: OK (battles without us, merging other players, live group counts, battle results applied once)');
