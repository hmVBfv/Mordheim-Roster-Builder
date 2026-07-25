#!/usr/bin/env node
/* Corrects the Henchman experience surcharge.
 *
 * It was folded into modelUnitCost, which meant every man in a group was
 * repriced as the group earned experience. Since gold in hand is the treasury
 * less what the warband owns, five Verminkin picking up 4 experience each
 * silently pushed the gold into the red - and nudging the figure by 5 put it
 * back, because setting it by hand re-syncs the treasury.
 *
 * Two gold crowns per experience point is the price of taking ANOTHER man on:
 * raw recruits are easy to find, gnarled veterans are not. It is not a
 * revaluation of men already in the group. So the surcharge is charged once,
 * when the group grows, and recorded on the group as m.xpPaid; it is never
 * re-derived from the group's current experience.
 *
 * Run from the repository root:  node fix-xp.js
 * Nothing is written unless every anchor matches.
 */
const fs = require('fs');
const done = [];

function edit(file, label, oldStr, newStr, expectCount) {
  const want = expectCount || 1;
  if (!fs.existsSync(file)) { fail(label, 'file not found: ' + file); }
  let s = fs.readFileSync(file, 'utf8');
  let n = 0, i = 0;
  while ((i = s.indexOf(oldStr, i)) !== -1) { n++; i += oldStr.length; }
  if (n !== want) fail(label, 'expected ' + want + ' match(es) in ' + file + ', found ' + n);
  fs.writeFileSync(file, s.split(oldStr).join(newStr), 'utf8');
  done.push(label);
}
function fail(label, why) {
  console.error('\nFAILED: ' + label + '\n  ' + why);
  console.error('  The file may already be patched, or it differs from the version');
  console.error('  this script was written for. Check with: git diff');
  process.exit(1);
}

/* ---- engine.js: the surcharge leaves the standing unit cost ---- */
edit('js/engine.js', 'take the surcharge out of modelUnitCost',
`export const HENCH_XP_GC=2;
export function henchXpCost(m){ const def=unitDef(m.uid_def);
  if(!def || def.t!=='hen' || (typeof isHeroModel==='function' && isHeroModel(m))) return 0;
  return HENCH_XP_GC*Math.max(0, Number(m.exp)||0); }
export function modelUnitCost(m){ // cost for ONE model of this entry
  const def=unitDef(m.uid_def);
  return unitBaseCost(def) + henchXpCost(m) + eqCost(m) + mutCost(m) + rareCost(m) - heirloomDiscount(m);
}`,
`export const HENCH_XP_GC=2;
/* "You must add 2 gold crowns to their cost for each extra Experience point
   they add to the warband's total" (mordheimer, Trading). This is what ANOTHER
   man costs to take into a group that has already been blooded - raw recruits
   are easy to find, gnarled veterans are not. It is emphatically NOT a
   revaluation of the men already there: warriors who earned their experience in
   play must not become dearer in hindsight, or the gold already spent would
   move under the player's feet. Hence it never enters modelUnitCost.
   "Extra" is measured against what a fresh recruit of this type brings, so a
   unit that starts with experience carries no surcharge for it.
   Heroes are not recruited into groups and are unaffected. */
export function henchRecruitSurcharge(m){ const def=unitDef(m.uid_def);
  if(!def || def.t!=='hen' || (typeof isHeroModel==='function' && isHeroModel(m))) return 0;
  return HENCH_XP_GC*Math.max(0, (Number(m.exp)||0)-(Number(def.exp)||0)); }
export function modelUnitCost(m){ // cost for ONE model of this entry
  const def=unitDef(m.uid_def);
  return unitBaseCost(def) + eqCost(m) + mutCost(m) + rareCost(m) - heirloomDiscount(m);
}
/* What one more man of this group costs today. */
export function henchRecruitCost(m){ return modelUnitCost(m)+henchRecruitSurcharge(m); }`);

edit('js/engine.js', 'count the surcharge actually paid',
`export function modelTotalCost(m){
  const def=unitDef(m.uid_def);
  const q=def.t==='hen'?m.qty:1;
  return modelUnitCost(m)*q;
}`,
`export function modelTotalCost(m){
  const def=unitDef(m.uid_def);
  const q=def.t==='hen'?m.qty:1;
  // m.xpPaid: the experience surcharge actually handed over for veterans taken
  // into this group. A recorded sum, so later experience cannot change it.
  return modelUnitCost(m)*q + (Number(m.xpPaid)||0);
}`);

/* ---- app.js: charge it when the group actually grows ---- */
edit('js/app.js', 'import the two helpers',
'isUpgrade, lossValueOf, modelRating,',
'isUpgrade, henchRecruitCost, henchRecruitSurcharge, lossValueOf, modelRating,',
2);   // the import line and the re-export line

edit('js/app.js', 'charge the surcharge in setQty',
`export function setQty(u,v){ const m=S.models.find(x=>x.uid===u); const def=unitDef(m.uid_def);
  let q=Math.min(5,Math.max(1,Number(v)||1)); const umx=unitMax(def);
  if(umx!==null){ const others=S.models.filter(x=>x.uid_def===m.uid_def&&x.uid!==m.uid).reduce((s,x)=>s+(x.qty||1),0);
    q=Math.max(1,Math.min(q, umx-others)); }
  m.qty=q; render(); }`,
`export function setQty(u,v){ const m=S.models.find(x=>x.uid===u); const def=unitDef(m.uid_def);
  let q=Math.min(5,Math.max(1,Number(v)||1)); const umx=unitMax(def);
  if(umx!==null){ const others=S.models.filter(x=>x.uid_def===m.uid_def&&x.uid!==m.uid).reduce((s,x)=>s+(x.qty||1),0);
    q=Math.max(1,Math.min(q, umx-others)); }
  /* Men joining a blooded group are dearer: two gold crowns for each experience
     point they bring. Charged once, here, and added to what this group has
     already paid - never recalculated from its current experience, so the men
     who earned that experience in play are not revalued behind the player's
     back. Taking the number back down returns the surcharge for the men
     removed, but never more than was actually paid. A warrior who DIES goes
     through the death path instead, where nothing is refunded. */
  const _was=Math.max(1,Number(m.qty)||1);
  if(q>_was) m.xpPaid=(Number(m.xpPaid)||0)+(q-_was)*henchRecruitSurcharge(m);
  else if(q<_was) m.xpPaid=Math.max(0,(Number(m.xpPaid)||0)-(_was-q)*henchRecruitSurcharge(m));
  m.qty=q; render(); }`);

/* ---- show what one more man would cost ---- */
edit('js/app.js', 'show the recruit price on the group control',
"             : `<label>Models in group (1\u2013${hcap}): <input type=\"number\" min=\"1\" max=\"${hcap}\" value=\"${m.qty}\"\n             onchange=\"setQty(${m.uid},this.value)\"></label>${hmaxNote}`):''}",
"             : `<label>Models in group (1\u2013${hcap}): <input type=\"number\" min=\"1\" max=\"${hcap}\" value=\"${m.qty}\"\n             onchange=\"setQty(${m.uid},this.value)\"></label>${hmaxNote}${henchRecruitSurcharge(m)?` <span class=\"note\" title=\"Veterans cost more to take on: 2 gc for each experience point they bring\">one more costs ${henchRecruitCost(m)} gc (+${henchRecruitSurcharge(m)} for experience)</span>`:''}`):''}",
);

/* ---- expose to inline handlers ---- */
edit('js/app.js', 'window bindings',
'  loseValueOnDeath, restoreValueOnUndo,',
'  loseValueOnDeath, restoreValueOnUndo, henchRecruitCost, henchRecruitSurcharge,');

console.log('Patched:');
done.forEach(d => console.log('  \u2713 ' + d));
console.log('\nNow run:  node --check js/engine.js && node --check js/app.js && node test/run.mjs');
console.log('\nNote: any Henchman group already carrying experience keeps its current');
console.log('cost. If your gold reads wrong from the earlier version, set it once by');
console.log('hand to the figure that applies at the table.');
