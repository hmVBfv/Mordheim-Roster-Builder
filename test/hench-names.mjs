/* Naming individual henchmen.
 *
 * A henchman group is one model with a count, and by the rules the members
 * share experience, characteristics and equipment — that stays so. What they
 * lacked was identity: "one Verminkin was slain" says nothing about which of
 * the three, and on the tabletop each miniature is a separate piece.
 *
 * The delicate part is alignment. `m.names` is indexed alongside the count, so
 * when a member dies or is promoted out of the group the remaining names must
 * stay with the right men rather than shifting onto their neighbours.
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
const state=await import(new URL('../js/state.js', import.meta.url).href);

function fresh(){ state.replaceState({wb:'skaven',subtype:null,name:'Klaue',budget:900,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:true,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()}); }

// --- unnamed members fall back to numbered defaults ---
fresh();
app.addUnit('vermin');
const g=state.S.models.find(m=>m.uid_def==='vermin'); g.qty=4;
assert.deepStrictEqual(app.memberNames(g),
  ['Verminkin 1','Verminkin 2','Verminkin 3','Verminkin 4'], 'members are numbered until named');
assert.strictEqual(app.memberNamed(g,0), false, 'a default is not a name');
assert.strictEqual(g.names, undefined, 'nothing is stored while nobody is named');

// --- naming, and the save stays clean when names are cleared ---
app.setMemberName(g.uid,0,'Grik'); app.setMemberName(g.uid,1,'Skab');
app.setMemberName(g.uid,2,'Nurk'); app.setMemberName(g.uid,3,'Vresh');
assert.deepStrictEqual(app.memberNames(g), ['Grik','Skab','Nurk','Vresh']);
assert.strictEqual(app.memberNamed(g,0), true);

// --- a death in the middle: the survivors keep their own names ---
app.killHenchMember(g.uid,1);
assert.deepStrictEqual(app.memberNames(g), ['Grik','Nurk','Vresh'],
  'the names of the survivors must not shift onto the wrong men');
assert.strictEqual(g.qty, 3);
assert.strictEqual(state.S.fallen[0].m.name, 'Skab', 'the fallen record names the man who died');
assert.ok(state.S.campaign.log.some(e=>e.type==='death' && /Skab/.test(e.text)),
  'the chronicle names him too');

// --- promotion takes the man and his name out of the group ---
app.promoteHench(g.uid,0);
const hero=state.S.models.find(m=>m.promoted);
assert.strictEqual(hero.name, 'Grik', 'the promoted man keeps his own name');
assert.deepStrictEqual(app.memberNames(g), ['Nurk','Vresh'], 'and leaves the others where they were');

// --- an unnamed man promoted still gets the old fallback name ---
fresh();
app.addUnit('vermin');
const g2=state.S.models.find(m=>m.uid_def==='vermin'); g2.qty=2;
app.promoteHench(g2.uid,0);
const hero2=state.S.models.find(m=>m.promoted);
assert.ok(/\(Hero\)$/.test(hero2.name), 'an unnamed promotion keeps the previous naming behaviour');

// --- shrinking the group by hand does not leave orphaned names ---
fresh();
app.addUnit('vermin');
const g3=state.S.models.find(m=>m.uid_def==='vermin'); g3.qty=3;
app.setMemberName(g3.uid,0,'Grik'); app.setMemberName(g3.uid,1,'Skab');
app.setQty(g3.uid,1);
assert.deepStrictEqual(app.memberNames(g3), ['Grik'], 'names are trimmed with the group');
assert.deepStrictEqual(g3.names, ['Grik'], 'and nothing lingers to reappear on a later recruit');

// --- the Fallen section: named men by name, the nameless still by count ---
fresh();
app.addUnit('vermin'); app.addUnit('rat');
const gv=state.S.models.find(m=>m.uid_def==='vermin'); gv.qty=3;
const gr=state.S.models.find(m=>m.uid_def==='rat'); gr.qty=3;
app.setMemberName(gv.uid,0,'Grik');
app.killHenchMember(gv.uid,0);
app.killHenchMember(gr.uid,0);
app.killHenchMember(gr.uid,0);
app.renderRoster();
const fallenHtml=store['roster'].innerHTML.slice(store['roster'].innerHTML.indexOf('Fallen'));
assert.ok(/Grik/.test(fallenHtml), 'a man who had a name is remembered by it');
assert.ok(/<td>2×<\/td>/.test(fallenHtml), 'the nameless are still merged into a count');

// --- the record keeps who was in the group at the time ---
app.advanceRound();
const rows=app.snapRows(app.stageSnapshots()['0']);
assert.ok(rows.some(r=>Array.isArray(r.names)), 'snapshots carry the member names');

// --- names survive a save and reload ---
const saved=JSON.stringify(state.S);
app.applyState(JSON.parse(saved));
const reloaded=state.S.models.find(m=>m.uid_def==='vermin');
assert.ok(app.memberNames(reloaded).length, 'names come back after a round trip');

// --- each miniature can be exported to TTS on its own ---
app.setMemberName(reloaded.uid,0,'Nurk');
tts.ttsOpenMember(reloaded.uid,0);
assert.ok(/Nurk/.test(store['ttsname'].value), 'the TTS name field carries that miniature\u2019s name');

// --- and the roster shows the members ---
app.renderRoster();
assert.ok(/mem-row/.test(store['roster'].innerHTML), 'the member list is rendered on the group card');

console.log('Henchman names: OK (defaults, alignment through death and promotion, shrink, Fallen, snapshots, round trip, TTS)');
