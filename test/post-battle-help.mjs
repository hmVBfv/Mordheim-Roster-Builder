/* The post-battle helper (Rob, 29.09.2026): the ten steps after a battle,
 * each with the tables needed at the table, and what the roster knows about
 * this warband - who searches, how many dice, whose advance is due, which of
 * its rules and skills change a step. It must work without the campaign
 * mode, since the group plays with it off.
 */
import assert from 'assert';
import * as fs from 'fs';

const el=()=>({style:{},className:'',textContent:'',value:'',checked:false,set innerHTML(v){this._h=v;},get innerHTML(){return this._h||'';},appendChild(){},addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}),querySelectorAll:()=>[],click(){},focus(){},select(){}});
globalThis.document={getElementById:el,createElement:el,addEventListener(){},body:{appendChild(){}},querySelectorAll:()=>[]};
globalThis.window={addEventListener(){},scrollTo(){},innerWidth:1000,matchMedia:()=>({matches:false,addEventListener(){}}),storage:{list:async()=>({keys:[]})}};
globalThis.Blob=function(){}; globalThis.URL.createObjectURL=()=>'';
globalThis.fetch=async(u)=>{const p=decodeURIComponent(new URL(u).pathname);
  return {ok:fs.existsSync(p),json:async()=>JSON.parse(fs.readFileSync(p,'utf8')),arrayBuffer:async()=>fs.readFileSync(p).buffer};};

const app=await import(new URL('../js/app.js', import.meta.url).href);
const state=await import(new URL('../js/state.js', import.meta.url).href);
const D=await import(new URL('../data/index.js', import.meta.url).href);
const S=()=>state.S;

function band(wb,subtype,units){
  state.replaceState({wb,subtype,name:'',budget:500,models:[],hired:[],dp:[],leaderUid:null,
    campaign:{on:false,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
  units.forEach(u=>app.addUnit(u));
}
const text=(h)=>h.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');

// --- all ten steps, in the rulebook's order, each with its content ---
band('merc','mari',['capt','champ','young','warr']);
const all=app.postBattleHelp();
['Injuries','Experience','Exploration','Sell wyrdstone','Available veterans','Rare items','Dramatis Personae','Recruits & common items','Reallocate equipment','Warband rating']
  .forEach((t,i)=>assert.ok(all.includes(`<span class="pb-num">${i+1}</span> ${t.replace('&','&amp;')}`)||all.includes(`<span class="pb-num">${i+1}</span> ${t}`), `step ${i+1}: ${t}`));

// --- the tables ---
const inj=text(app.pbHelpStep('injuries'));
assert.ok(D.INJURIES.every(j=>inj.includes(j.name)), 'every Serious Injury is listed');
assert.ok(/1–2 Dead/.test(inj) && /3–6 Recovers/.test(inj), 'the Henchmen D6');
const xp=text(app.pbHelpStep('experience'));
assert.ok(xp.includes("The lad's got talent") && xp.includes('+1 S or +1 A'), 'both advance tables');
assert.ok(xp.includes('2, 4, 6, 8, 11') && xp.includes('2, 5, 9, 14'), 'the thresholds of Heroes and Henchmen');
const ex=text(app.pbHelpStep('exploration'));
assert.ok(ex.includes('36+') && D.PB_LOCATIONS.every(l=>ex.includes(l[1])), 'shards and all 30 locations');
assert.strictEqual(D.PB_LOCATIONS.length, 30, 'doubles to six of a kind, six each');
assert.ok(/3 dice/.test(ex), 'one die per Hero on the roster (Captain, Champion, Youngblood)');

// --- what the roster knows ---
const rare=text(app.pbHelpStep('rare'));
assert.ok(/Marienburg: .*rare items/i.test(rare), 'Marienburg\'s +1 to find rare items is named');
band('tombguardians',null,['tomblord','lichepriest']);
assert.ok(/Home Ground: \+1 die in the Exploration phase/.test(text(app.pbHelpStep('exploration'))), 'Tomb Guardians\' extra exploration die is named');
band('merc','reik',['capt','warr']);
S().models[1].exp=2;
assert.ok(/Advance due: Warrior/.test(text(app.pbHelpStep('experience'))), 'an advance due is named');
S().models[1].adv={WS:1};
assert.ok(/No advance due/.test(text(app.pbHelpStep('experience'))), 'once applied it is not');
const wy=app.pbHelpStep('wyrdstone');
assert.ok(/<span class="pbhere">1–3<\/span>/.test(wy), 'the warband\'s size column is marked');
const rt=text(app.pbHelpStep('rating'));
assert.ok(rt.includes(`Rating ${app.totalRating()}`), 'the rating as the sidebar has it');

// --- names are text, never markup ---
S().models[0].name='<img src=x onerror=alert(1)>';
assert.ok(!app.pbHelpStep('rare').includes('<img'), 'a warrior\'s name is escaped');

console.log('Post-battle helper: OK (ten steps, all tables, dice and searchers from the roster, warband rules named, rating, names escaped)');
