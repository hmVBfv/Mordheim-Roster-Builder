#!/usr/bin/env node
/* Applies the two remaining fixes to js/app.js on the master branch:
 *
 *   1. Gold was handed back when a warrior died. Gold in hand is worked out as
 *      the treasury less what the warband owns, and the spending is summed over
 *      the living, so a death removed the dead man's cost from the total and the
 *      warband appeared richer for losing him. The loss is now settled once, at
 *      the moment it happens: his worth including everything he carried comes
 *      out of the treasury and is written onto the Fallen record, where it shows
 *      as a Worth column. Nothing afterwards recomputes it from the Fallen list,
 *      so a figure entered by hand stays put and undoing a death returns exactly
 *      what it took.
 *
 *   2. A henchman promoted through The Lad's Got Talent still showed his
 *      henchman unit type beside his name.
 *
 * Run from the repository root:  node fix-app.js
 * It refuses to write anything unless every anchor matches, so a partial patch
 * cannot happen.
 */
const fs = require('fs');
const path = process.argv[2] || 'js/app.js';

if (!fs.existsSync(path)) {
  console.error('Not found: ' + path + '\nRun this from the repository root, or pass the path as an argument.');
  process.exit(1);
}
let s = fs.readFileSync(path, 'utf8');
const done = [];

function patch(label, oldStr, newStr, expectCount) {
  const want = expectCount || 1;
  let n = 0, i = 0;
  while ((i = s.indexOf(oldStr, i)) !== -1) { n++; i += oldStr.length; }
  if (n !== want) {
    console.error('\nFAILED: ' + label);
    console.error('  expected ' + want + ' match(es), found ' + n + '.');
    console.error('  Nothing has been written. The file may already be patched,');
    console.error('  or it differs from the version this script was written for.');
    process.exit(1);
  }
  s = s.split(oldStr).join(newStr);
  done.push(label);
}

/* --- make lossValueOf available (it already lives in engine.js) --- */
patch('import lossValueOf from the engine',
  'isUpgrade, modelRating,',
  'isUpgrade, lossValueOf, modelRating,',
  2);   // once in the import line, once in the re-export line

/* --- settle a warrior's worth at the moment he falls --- */
patch('add loseValueOnDeath / restoreValueOnUndo',
'function _fallenSnapshot(m){ return JSON.parse(JSON.stringify(m)); }',
`/* A warrior who falls takes his worth with him - himself and everything he was
   carrying. That is taken out of the treasury once, here, and the amount is
   written onto the Fallen record so it can be shown and given back exactly if
   the death is undone. Gold in hand is never derived from the Fallen list:
   doing that made every figure entered by hand silently lose the same amount
   again, and the treasury drifted negative. */
export function loseValueOnDeath(snapshot){
  const lost=lossValueOf(snapshot);
  if(lost>0){ S.stash=S.stash||{wyrd:0,gold:null,items:[]};
    // the treasury may still be the untouched starting sum; make it real first
    S.stash.gold=Math.max(0, goldTreasury()-lost); }
  return lost; }
export function restoreValueOnUndo(rec){
  const back=Number(rec&&rec.lostValue)||0;
  if(back>0){ S.stash=S.stash||{wyrd:0,gold:null,items:[]};
    S.stash.gold=goldTreasury()+back; }
  return back; }
function _fallenSnapshot(m){ return JSON.parse(JSON.stringify(m)); }`);

patch('record the loss when a Hero falls',
`export function killHero(u){ const m=S.models.find(x=>x.uid===u); if(!m) return;
  S.fallen=S.fallen||[]; S.fallen.push({kind:'hero', m:_fallenSnapshot(m)});`,
`export function killHero(u){ const m=S.models.find(x=>x.uid===u); if(!m) return;
  const snap=_fallenSnapshot(m);
  S.fallen=S.fallen||[]; S.fallen.push({kind:'hero', m:snap, lostValue:loseValueOnDeath(snap)});`);

patch('record the loss when a Henchman falls',
`  S.fallen=S.fallen||[]; S.fallen.push({kind:'hench', uid_def:m.uid_def, exp:Number(m.exp)||0, m:snap});`,
`  S.fallen=S.fallen||[]; S.fallen.push({kind:'hench', uid_def:m.uid_def, exp:Number(m.exp)||0, m:snap,
    lostValue:loseValueOnDeath(snap)});`);

patch('give the worth back when a death is undone',
`export function undoFallen(){ if(!S.fallen||!S.fallen.length) return;
  const e=S.fallen[S.fallen.length-1];`,
`export function undoFallen(){ if(!S.fallen||!S.fallen.length) return;
  const e=S.fallen[S.fallen.length-1];
  restoreValueOnUndo(e);        // the warrior comes back, and so does his worth`);

/* Prefer the figure recorded at the time of death; older records fall back to
   recalculating it, so saves written before this still show a sensible total. */
patch('total lost prefers the recorded figure',
'export function fallenGoldLost(){ return (S.fallen||[]).reduce((s,e)=> s + (modelUnitCost(e.m)||0), 0); }',
'export function fallenGoldLost(){ return (S.fallen||[]).reduce((s,e)=>\n  s + (e.lostValue!=null?Number(e.lostValue)||0:(modelUnitCost(e.m)||0)), 0); }');

/* --- show the recorded worth in the Fallen tables --- */
patch('Worth column for fallen Heroes',
'<table class="fallen-tbl"><tr><th>Name</th><th>Experience</th><th>Equipment lost</th></tr>`\n          + grp.map(e=>`<tr><td>${(e.m.name||def.name).replace(/</g,\'&lt;\')}</td><td>${Number(e.m.exp)||0} XP</td><td>${(fallenEqAgg([e.m]).map(x=>String(x).replace(/</g,\'&lt;\')).join(\', \'))||\'—\'}</td></tr>`).join(\'\')',
'<table class="fallen-tbl"><tr><th>Name</th><th>Experience</th><th>Equipment lost</th><th>Worth</th></tr>`\n          + grp.map(e=>`<tr><td>${(e.m.name||def.name).replace(/</g,\'&lt;\')}</td><td>${Number(e.m.exp)||0} XP</td><td>${(fallenEqAgg([e.m]).map(x=>String(x).replace(/</g,\'&lt;\')).join(\', \'))||\'—\'}</td><td>${e.lostValue!=null?e.lostValue+\' gc\':\'—\'}</td></tr>`).join(\'\')');

patch('carry the worth into the henchman grouping',
'const subs={}; grp.forEach(e=>{ const sig=fallenEqSig(e.m); (subs[sig]=subs[sig]||{n:0,ex:e.m,exp:e.exp}).n++; });',
'const subs={}; grp.forEach(e=>{ const sig=fallenEqSig(e.m);\n          (subs[sig]=subs[sig]||{n:0,ex:e.m,exp:e.exp,val:e.lostValue}).n++; });');

patch('Worth column for fallen Henchmen',
'<table class="fallen-tbl"><tr><th>#</th><th>Experience</th><th>Equipment lost</th></tr>`\n          + Object.values(subs).map(s=>`<tr><td>${s.n}×</td><td>${Number(s.exp)||0} XP</td><td>${(fallenEqAgg([s.ex]).map(x=>String(x).replace(/</g,\'&lt;\')).join(\', \'))||\'—\'}</td></tr>`).join(\'\')',
'<table class="fallen-tbl"><tr><th>#</th><th>Experience</th><th>Equipment lost</th><th>Worth</th></tr>`\n          + Object.values(subs).map(s=>`<tr><td>${s.n}×</td><td>${Number(s.exp)||0} XP</td><td>${(fallenEqAgg([s.ex]).map(x=>String(x).replace(/</g,\'&lt;\')).join(\', \'))||\'—\'}</td><td>${s.val!=null?s.val+\' gc\':\'—\'}</td></tr>`).join(\'\')');

/* --- a promoted henchman says so beside his name --- */
patch('label a promoted henchman as a Hero',
'        <span class="note">${def.name}</span>',
"        <span class=\"note\">${def.name}${promoted?' \\u2014 promoted to Hero':''}</span>");

/* --- expose the two new functions to the inline handlers --- */
patch('window bindings',
'  killHench, killHero, removeFallenAt, setFallenGroupOpen, undoFallen,',
'  killHench, killHero, removeFallenAt, setFallenGroupOpen, undoFallen,\n  loseValueOnDeath, restoreValueOnUndo,');

fs.writeFileSync(path, s, 'utf8');
console.log('Patched ' + path + ':');
done.forEach(d => console.log('  \u2713 ' + d));
console.log('\nNow run:  node --check ' + path + '  &&  node test/run.mjs');
