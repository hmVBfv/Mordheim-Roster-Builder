/* Regression tests for the master-branch fixes:
 *   - Fallen "gc lost" is REAL gold (unit + gear + paid surcharge), never a
 *     revaluation of experience; earned XP is reported separately and never
 *     includes the unit's starting experience.
 *   - The group's paid experience surcharge (xpPaid) leaves the books only
 *     when the LAST man of the group dies; undo restores it.
 *   - Sidebar unit list: promoted henchmen ("Hero <type>") under Heroes,
 *     Vehicles as their own section.
 *   - Warband rating: modelRating * qty per warrior, vehicles excluded.
 *   - Export carries goldNow; import adopts it verbatim.
 *   - Rare/Trading-Post <details> open state is remembered across renders.
 */
import assert from 'assert';
import * as fs from 'fs';

const el=(id)=>{ const e={id,style:{},className:'',_html:'',value:'',checked:false,
  set innerHTML(v){this._html=v;}, get innerHTML(){return this._html;},
  set textContent(v){this._txt=String(v);}, get textContent(){return this._txt||'';},
  appendChild(){}, addEventListener(){}, getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}),
  querySelectorAll:()=>[], querySelector:()=>null, click(){}, focus(){}, select(){}, setAttribute(){}, removeAttribute(){}, remove(){}, closest:()=>null }; return e; };
const store={};
globalThis.document={getElementById:(id)=>store[id]||(store[id]=el(id)),createElement:el,addEventListener(){},body:{appendChild(){}},querySelectorAll:()=>[],querySelector:()=>null};
globalThis.window={addEventListener(){},scrollTo(){},innerWidth:1000,matchMedia:()=>({matches:false,addEventListener(){}}),storage:{list:async()=>({keys:[]})}};
globalThis.Blob=function(){ this.parts=arguments; }; globalThis.URL.createObjectURL=()=>'blob:x';
globalThis.confirm=()=>true;
globalThis.fetch=async(u)=>{const p=decodeURIComponent(new URL(u).pathname);
  return {ok:fs.existsSync(p),json:async()=>JSON.parse(fs.readFileSync(p,'utf8')),arrayBuffer:async()=>fs.readFileSync(p).buffer};};

const pdflibSrc=fs.readFileSync(new URL('../vendor/pdf-lib.min.js', import.meta.url),'utf8');
new Function('self','window',pdflibSrc)(globalThis, globalThis);

const app=await import(new URL('../js/app.js', import.meta.url).href);
const eng=await import(new URL('../js/engine.js', import.meta.url).href);
const state=await import(new URL('../js/state.js', import.meta.url).href);

function fresh(wb='skaven'){ state.replaceState({wb,subtype:null,name:'Test',budget:500,models:[],hired:[],dp:[],
  leaderUid:null,campaign:{on:false,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()}); }

/* ---------- 1) Fallen: real gold only, earned XP shown separately ---------- */
fresh();
app.addUnit('adept');                                  // Skaven leader-type hero
const hero=state.S.models.find(m=>m.uid_def==='adept');
const heroDef=eng.unitDef('adept');
const startExp=Number(heroDef.exp)||0;
hero.exp=startExp+3;                                   // earned 3 XP in play
const heroCost=eng.modelUnitCost(hero);
app.killHero(hero.uid);
const rec=state.S.fallen[0];
assert.strictEqual(app.fallenGoldOf(rec), heroCost, 'gc lost = real gold, no exp priced in');
assert.strictEqual(app.fallenExpEarned(rec), 3, 'earned XP lost excludes starting experience');
assert.strictEqual(app.fallenExpLost(), 3, 'total earned XP lost');
assert.strictEqual(app.fallenGoldLost(), heroCost, 'fallen gold total = real gold');

/* ---------- 2) Henchman xpPaid settles only with the last man ---------- */
fresh();
app.addUnit('vermin');
const grp=state.S.models.find(m=>m.uid_def==='vermin');
grp.exp=(Number(eng.unitDef('vermin').exp)||0)+2;      // 2 earned XP -> surcharge 4 gc/new man
app.setQty(grp.uid, 3);                                // +2 veterans join
assert.strictEqual(Number(grp.xpPaid)||0, 8, 'surcharge charged once when the group grows');
state.S.stash.gold=eng.goldTreasury();                 // pin the treasury to a real number
const goldBefore=eng.goldCurrent();
app.killHench(grp.uid);                                // 3 -> 2
assert.strictEqual(Number(grp.xpPaid)||0, 8, 'ordinary death leaves xpPaid on the group');
assert.strictEqual(state.S.fallen[0].m.xpPaid, 0, 'snapshot of an ordinary death carries no xpPaid');
assert.strictEqual(eng.goldCurrent(), goldBefore, 'death never changes gold in hand');
app.killHench(grp.uid);                                // 2 -> 1
app.killHench(grp.uid);                                // 1 -> 0, group removed
assert.ok(!state.S.models.find(m=>m.uid_def==='vermin'), 'group removed');
const last=state.S.fallen[state.S.fallen.length-1];
assert.strictEqual(Number(last.m.xpPaid)||0, 8, 'last death takes the remaining xpPaid with it');
assert.strictEqual(eng.goldCurrent(), goldBefore, 'gold unchanged even when the group empties (no silent surcharge refund)');
app.undoFallen();                                      // recreate group qty 1
const back=state.S.models.find(m=>m.uid_def==='vermin');
assert.ok(back && back.qty===1 && (Number(back.xpPaid)||0)===8, 'undo restores model AND its xpPaid');
assert.strictEqual(eng.goldCurrent(), goldBefore, 'undo is gold-neutral too');

/* ---------- 3) Rating: modelRating × qty, vehicles excluded ---------- */
fresh();
app.addUnit('adept'); app.addUnit('vermin');
const g2=state.S.models.find(m=>m.uid_def==='vermin'); g2.qty=3; g2.exp=2;
const h2=state.S.models.find(m=>m.uid_def==='adept');
const expect=eng.modelRating(h2)+eng.modelRating(g2)*3;
assert.strictEqual(app.totalRating(), expect, 'rating = per-model rating × qty');
fresh('caravans');
app.addUnit('wagon');
const wag=state.S.models.find(m=>m.uid_def==='wagon');
assert.strictEqual(eng.modelRating(wag), 0, 'a vehicle has no rating');
assert.strictEqual(app.totalRating(), 0, 'vehicles are excluded from warband rating');

/* ---------- 4) Sidebar: promoted under Heroes as "Hero <type>", Vehicles own section ---------- */
fresh();
app.addUnit('adept'); app.addUnit('vermin');
const g3=state.S.models.find(m=>m.uid_def==='vermin'); g3.qty=2; g3.exp=8;
app.promoteHench(g3.uid);                              // splits one model off as Hero
app.renderSidebar();
const ul=store['unitlist']._html;
assert.ok(/Hero Verminkin/.test(ul), 'promoted henchman listed as "Hero <type>"');
const heroesSec=ul.split('Henchmen')[0];
assert.ok(/Hero Verminkin/.test(heroesSec), 'promoted row sits in the Heroes section');
fresh('caravans');
app.addUnit('wagon');
app.renderSidebar();
assert.ok(/Vehicles/.test(store['unitlist']._html), 'Vehicles get their own sidebar section');

/* ---------- 5) Export carries goldNow; import adopts it verbatim ---------- */
fresh();
app.addUnit('vermin');
app.setGoldCurrent(123);
const dump=JSON.parse(JSON.stringify(app.exportState()));
assert.strictEqual(dump.goldNow, 123, 'export records the displayed gold');
dump.goldNow=77;                                       // simulate a hand-kept file
app.applyState(dump);
assert.strictEqual(eng.goldCurrent(), 77, 'import sets the displayed gold verbatim');

/* ---------- 6) Rare/Trading-Post details remembers its open state ---------- */
fresh();
app.addUnit('adept');
const h3=state.S.models.find(m=>m.uid_def==='adept');
app.setRareOpen(h3.uid,true);
const html=app.eqSection(h3);
assert.ok(/<details class="eq" open ontoggle="setRareOpen/.test(html), 'rare section renders open after a change');

/* ---------- 7) Text export files promoted units under Heroes ---------- */
fresh();
app.addUnit('adept'); app.addUnit('vermin');
const g4=state.S.models.find(m=>m.uid_def==='vermin'); g4.qty=2; g4.exp=6;
app.promoteHench(g4.uid);
const txt=app.buildText();
const heroBlock=txt.split('## Henchmen')[0];
assert.ok(/Hero Verminkin/.test(heroBlock), 'text export lists the promotion under ## Heroes as "Hero <type>"');
assert.ok(!/## Henchmen[\s\S]*Hero Verminkin/.test(txt), 'promotion no longer listed under ## Henchmen');
fresh('caravans');
app.addUnit('wagon');
const txt2=app.buildText();
assert.ok(/## Vehicles/.test(txt2), 'text export gives vehicles their own section');
assert.ok(!/## Henchmen[\s\S]*Trade Wagon/.test(txt2.split('## Vehicles')[0]), 'wagon not under Henchmen');

/* ---------- 8) Injury automations are gold-neutral / correct ---------- */
globalThis.prompt=(msg,dflt)=>('2');           // D3 = 2, ransom = 2
fresh();
app.addUnit('adept');
const h5=state.S.models.find(m=>m.uid_def==='adept');
h5.eq={'Schwert':1,'Helm':1};                  // paid gear
state.S.stash.gold=eng.goldTreasury();         // pin treasury
const gBefore=eng.goldCurrent();
const gearValue=eng.modelUnitCost(h5)-eng.unitBaseCost(eng.unitDef('adept'));
assert.ok(gearValue>0, 'test hero carries paid gear');
// Robbed (36): everything gone, gold unchanged
store['inj-'+h5.uid]={value:'36'};
app.addInj(h5.uid);
assert.strictEqual(Object.keys(h5.eq).length, 0, 'Robbed strips all equipment');
assert.strictEqual(eng.goldCurrent(), gBefore, 'Robbed refunds NOTHING — gold in hand unchanged');
assert.ok((h5.inj||[]).some(j=>j.code==='36'), 'Robbed chip recorded');
// Survives Against the Odds (66): +1 XP
const xpB=Number(h5.exp)||0;
store['inj-'+h5.uid]={value:'66'};
app.addInj(h5.uid);
assert.strictEqual(Number(h5.exp), xpB+1, 'Survives Against the Odds grants +1 XP');
// Deep Wound (35): prompt D3 -> miss counter
store['inj-'+h5.uid]={value:'35'};
app.addInj(h5.uid);
assert.strictEqual(Number(h5.miss), 2, 'Deep Wound adds the rolled D3 to games missed');
// Sold to the Pits (65), lost: weapons & armour stripped, misc kept, no refund
fresh();
app.addUnit('adept');
const h6=state.S.models.find(m=>m.uid_def==='adept');
h6.eq={'Schwert':1,'Helm':1};
state.S.stash.gold=eng.goldTreasury();
const gB2=eng.goldCurrent();
globalThis.confirm=()=>false;                  // "lost the fight"
store['inj-'+h6.uid]={value:'65'};
app.addInj(h6.uid);
assert.ok(!h6.eq['Schwert'] && !h6.eq['Helm'], 'pit-fight loss strips weapons & armour');
assert.strictEqual(eng.goldCurrent(), gB2, 'pit-fight loss refunds nothing');
// Sold to the Pits, won: +50 gc, +2 XP
fresh();
app.addUnit('adept');
const h7=state.S.models.find(m=>m.uid_def==='adept');
state.S.stash.gold=eng.goldTreasury();
const gB3=eng.goldCurrent(), xB3=Number(h7.exp)||0;
globalThis.confirm=()=>true;                   // "won"
store['inj-'+h7.uid]={value:'65'};
app.addInj(h7.uid);
assert.strictEqual(eng.goldCurrent(), gB3+50, 'pit-fight win pays 50 gc');
assert.strictEqual(Number(h7.exp), xB3+2, 'pit-fight win grants +2 XP');
// Captured (61), ransomed for 2 gc (prompt stub)
fresh();
app.addUnit('adept');
const h8=state.S.models.find(m=>m.uid_def==='adept');
state.S.stash.gold=eng.goldTreasury();
const gB4=eng.goldCurrent();
store['inj-'+h8.uid]={value:'61'};
app.addInj(h8.uid);
assert.strictEqual(eng.goldCurrent(), gB4-2, 'ransom is deducted from the treasury');
assert.ok(state.S.models.find(m=>m.uid===h8.uid), 'ransomed hero stays on the roster');
// Captured, not coming back -> settled fallen, gold-neutral
fresh();
app.addUnit('adept');
const h9=state.S.models.find(m=>m.uid_def==='adept');
h9.eq={'Schwert':1};
state.S.stash.gold=eng.goldTreasury();
const gB5=eng.goldCurrent();
globalThis.confirm=()=>false;                  // "not coming back"
store['inj-'+h9.uid]={value:'61'};
app.addInj(h9.uid);
assert.ok(!state.S.models.find(m=>m.uid===h9.uid), 'lost captive removed from roster');
assert.strictEqual(state.S.fallen.length, 1, 'lost captive lands in Fallen');
assert.strictEqual(eng.goldCurrent(), gB5, 'losing a captive is gold-neutral (no refund)');
globalThis.confirm=()=>true;

/* ---------- 9) Warband Worth includes equipment; Rating does not ---------- */
fresh();
app.addUnit('adept');
const hA=state.S.models.find(m=>m.uid_def==='adept');
state.S.stash.gold=eng.goldTreasury();
const r0=app.totalRating(), w0=app.warbandWorth();
hA.eq={'Schwert':1};                           // buy gear: rating unchanged, worth unchanged (gold moved into gear)
assert.strictEqual(app.totalRating(), r0, 'equipment never changes the Rating');
assert.strictEqual(app.warbandWorth(), w0, 'buying gear moves gold into equipment — worth is conserved');
hA.exp=(Number(hA.exp)||0)+2;                  // XP raises both
assert.strictEqual(app.totalRating(), r0+2, 'XP raises the Rating');
fresh('caravans');
app.addUnit('wagon');
state.S.stash.gold=eng.goldTreasury();
assert.strictEqual(app.totalRating(), 0, 'vehicles still excluded from Rating');
assert.ok(app.warbandWorth()>0, 'vehicles DO count toward Warband Worth');

console.log('Master fixes: OK (fallen real-gold + earned XP, xpPaid settlement, rating, sidebar sections, goldNow roundtrip, rare-details open state)');
