/* Undoing a death, and warriors who sat a battle out.
 *
 * Undo: taking back a death has to put the man back where he stood, under his
 * own name. Restoring only the count returns him as a nameless extra at the end
 * of the group, and everyone after him is one place out. The chronicle must not
 * keep reporting a death that was taken back either.
 *
 * Sit-outs: an Old Battle Wound and the like make a warrior miss the next game.
 * That belongs in the campaign record, and it has a consequence — a warrior who
 * was not in the battle did not survive it, and an absent leader did not lead
 * the warband to victory, so neither earns the post-battle experience.
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

function fresh(){ state.replaceState({wb:'skaven',subtype:null,name:'Klaue',budget:900,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:true,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()}); }

// --- undoing the death of a named man in the middle of a group ---
fresh();
app.addUnit('vermin');
const g=state.S.models.find(m=>m.uid_def==='vermin'); g.qty=4;
['Grik','Skab','Nurk','Vresh'].forEach((n,i)=>app.setMemberName(g.uid,i,n));
app.killHenchMember(g.uid,1);
assert.deepStrictEqual(app.memberNames(g), ['Grik','Nurk','Vresh']);
app.undoFallen();
const back=state.S.models.find(m=>m.uid_def==='vermin');
assert.deepStrictEqual(app.memberNames(back), ['Grik','Skab','Nurk','Vresh'],
  'the man returns under his own name and in his own place');
assert.ok(!state.S.campaign.log.some(e=>e.type==='death'),
  'a death that was taken back leaves no death in the chronicle');
assert.strictEqual(app.campCasualties().length, 0,
  'and the casualty the death created goes with it');

// --- a casualty recorded during the battle goes back to awaiting its roll ---
app.addCasualty({victim:{uid:back.uid,name:'Nurk',wb:'skaven'},attacker:{name:'Klaus',wb:'merc'}});
app.killHenchMember(back.uid,2);
assert.strictEqual(app.campCasualties()[0].result, 'dead');
app.undoFallen();
assert.strictEqual(app.campCasualties()[0].result, 'pending',
  'a casualty noted during the battle survives the undo, awaiting its roll again');
assert.deepStrictEqual(app.memberNames(state.S.models.find(m=>m.uid_def==='vermin')),
  ['Grik','Skab','Nurk','Vresh']);

// --- the last man of a group: the group is recreated with his name ---
const solo=state.S.models.find(m=>m.uid_def==='vermin');
solo.qty=1; solo.names=['Einzelg\u00e4nger'];
app.killHenchMember(solo.uid,0);
assert.ok(!state.S.models.some(m=>m.uid_def==='vermin'), 'the empty group is removed');
app.undoFallen();
assert.deepStrictEqual(app.memberNames(state.S.models.find(m=>m.uid_def==='vermin')),
  ['Einzelg\u00e4nger'], 'a recreated group keeps his name');

// --- sitting a battle out ---
fresh();
app.addUnit('adept'); app.addUnit('black');
const hero=state.S.models.find(m=>m.uid_def==='adept'); hero.name='Skritch';
const other=state.S.models.find(m=>m.uid_def==='black'); other.name='Grik';
app.advanceRound();                       // close Setup

const missInj=D.INJURIES.find(i=>i.miss);
document.getElementById('inj-'+hero.uid).value=missInj.code;
app.addInj(hero.uid);
assert.strictEqual(Number(hero.miss), missInj.miss, 'the warrior owes a game');

const bat=app.addBattle({opponents:[{name:'Klaus',wb:'merc'}],outcome:'Victory'});
app.awardBattleXp(bat.id);
assert.strictEqual(app.pendingXpFor(hero.uid), 0,
  'a warrior who was not in the battle earns nothing for surviving it, nor for leading it');
assert.ok(app.pendingXpFor(other.uid)>0, 'those who fought still earn');

app.advanceRound();
const missed=state.S.campaign.log.filter(e=>e.type==='missed');
assert.strictEqual(missed.length, 1, 'the absence is recorded once');
assert.ok(/Skritch sat out the battle/.test(missed[0].text), 'and names the warrior');
assert.ok(/Arm Wound|misses next game/i.test(missed[0].text), 'with the reason: '+missed[0].text);
assert.strictEqual(Number(hero.miss), missInj.miss-1, 'the game owed is served by the battle');
assert.strictEqual(hero.missWhy, undefined, 'and the reason is cleared once served');

// closing Setup records nothing, since no battle was fought
assert.ok(!state.S.campaign.log.some(e=>e.type==='missed' && e.round===0),
  'no battle, no absences');

console.log('Undo & sit-outs: OK (name and place restored, chronicle reverted, absences recorded, no experience for absentees)');
