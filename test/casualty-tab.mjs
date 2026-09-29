/* The casualty tab.
 *
 * Three faults this guards against, all found in play:
 *  - the standalone casualty form knew nothing about the campaign, so it
 *    offered "an enemy" and a list of every warband in the game rather than the
 *    warriors who were actually there;
 *  - the injury roll appeared to be set to the first entry of the chart without
 *    anything having been rolled: an empty description matched every entry when
 *    the roll was worked back out of the description text, so two options were
 *    marked as chosen and the browser showed the last of them;
 *  - editing a battle showed no casualties at all, since the form was rebuilt
 *    without them.
 *
 * The roll is now kept as itself rather than inferred, and a casualty carries a
 * short note of its own.
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

// an opponent held in the campaign file
state.replaceState({wb:'merc',subtype:'reik',name:'Klaus Truppe',budget:600,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:true,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
app.addUnit('capt'); state.S.models.find(m=>m.uid_def==='capt').name='Klaus';
const theirs=JSON.parse(JSON.stringify(state.S));

state.replaceState({wb:'skaven',subtype:null,name:'Klaue',budget:600,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:true,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
app.addUnit('adept'); app.addUnit('vermin');
const hero=state.S.models.find(m=>m.uid_def==='adept'); hero.name='Skritch';
const group=state.S.models.find(m=>m.uid_def==='vermin'); group.qty=2;
app.cfNew('Nights'); app.cfImportWarband(theirs,'Klaus');
app.advanceRound();

// --- the form draws on the campaign, not on a list of every warband ---
app.openCasForm();
const form=app.casFormBlock();
assert.ok(/Klaue/.test(form) && /Klaus Truppe/.test(form),
  'both warbands of the campaign are offered as sides');
assert.ok(!/an enemy/.test(form), 'the old "an enemy" placeholder is gone');

app.setCasField('vSideKey','me');
assert.ok(/Skritch/.test(app.casFormBlock()), 'choosing our side offers our warriors by name');
app.setCasField('aSideKey','cf1');
assert.ok(/Klaus/.test(app.casFormBlock()), 'choosing theirs offers theirs');

const enemy=app.sideModels('cf1')[0];
app.setCasField('vPick', `${hero.uid}:0`);
app.setCasField('aPick', `${enemy.uid}:${enemy.idx}`);
app.setCasField('detail','pinned in the doorway');
app.saveCasForm();

const cas=app.campCasualties()[0];
assert.ok(/Skritch was put out of action by Klaus/.test(app.casualtyText(cas)),
  'both sides are named from the rosters: '+app.casualtyText(cas));
assert.strictEqual(cas.note, 'pinned in the doorway', 'the note is kept');

// --- nothing is preselected until something is rolled ---
const listHtml=app.casListBlock(app.campRound());
const opts=[...listHtml.matchAll(/<option value="([^"]*)"( selected)?>/g)].map(m=>[m[1],!!m[2]]);
assert.strictEqual(opts.filter(o=>o[1]).length, 1, 'exactly one option is marked as chosen');
assert.strictEqual(opts.find(o=>o[1])[0], '', 'and it is "not yet rolled"');
assert.strictEqual(app.unrolledCasualties().length, 1, 'so it counts as still to be rolled');

app.resolveCasualtyRoll(cas.id,'11-15');
assert.strictEqual(cas.code, '11-15', 'the roll is kept as itself');
assert.strictEqual(cas.result, 'dead');
assert.strictEqual(app.unrolledCasualties().length, 0, 'and no longer counts as outstanding');
const after=[...app.casListBlock(app.campRound()).matchAll(/<option value="([^"]*)"( selected)?>/g)]
  .map(m=>[m[1],!!m[2]]);
assert.strictEqual(after.find(o=>o[1])[0], '11-15', 'the list shows what was rolled');

// --- editing a battle brings its casualties back ---
app.openBattleForm();
app.addDraftSide('cf1');
app.setDraftSide(0,'outcome','Victory'); app.setDraftSide(1,'outcome','Defeat');
app.addDraftCas();
app.setDraftCas(0,'vSide',0); app.setDraftCas(0,'vPick',`${group.uid}:0`);
app.setDraftCas(0,'aSide',1);
app.saveBattleForm();

const bat=state.S.campaign.battles[0];
assert.strictEqual(app.campCasualties().filter(x=>x.battleId===bat.id).length, 1,
  'the battle carries its casualty');

app.editBattleForm(bat.id);
const draft=app.battleDraft();
assert.strictEqual(draft.cas.length, 1, 'editing shows the casualties again, not an empty list');
assert.ok(draft.cas.every(r=>r.id!=null), 'each is tied to the record it came from');

draft.cas[0].note='dragged off by the tail';
app.saveBattleForm();
const kept=app.campCasualties().filter(x=>x.battleId===bat.id);
assert.strictEqual(kept.length, 1, 'saving corrects the casualty instead of writing a second one');
assert.strictEqual(kept[0].note, 'dragged off by the tail');

console.log('Casualty tab: OK (drawn from the campaign, roll kept as itself, casualties survive an edit)');
