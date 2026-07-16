/* Regression test: Blessing of Nurgle / Chaos Mutation names must be the official
   English mordheimer.net names (not blind German->English guesses), and every
   name must resolve to an ABILITYINFO tooltip so it shows up as a chip in the UI. */
import assert from 'assert';
import * as fs from 'fs';

globalThis.fetch = async (u) => {
  const p = decodeURIComponent(new URL(u).pathname);
  return { ok: fs.existsSync(p), json: async () => JSON.parse(fs.readFileSync(p,'utf8')),
           arrayBuffer: async () => fs.readFileSync(p).buffer };
};
const D = await import(new URL('../data/index.js', import.meta.url).href);

const EXPECTED_NURGLE = {
  'Strom der Verderbnis': 'Stream of Corruption',
  "Nurgles Fäule": "Nurgle's Rot",
  'Fliegenschwarm': 'Cloud of Flies',
  'Aufgeblähte Fäulnis': 'Bloated Foulness',
  'Mal des Nurgle': 'Mark of Nurgle',
  'Scheußlich': 'Hideous',
};

for (const [de, en] of Object.entries(EXPECTED_NURGLE)) {
  assert.strictEqual(D.MUTEN[de], en, `MUTEN['${de}'] should be '${en}' (official mordheimer.net Blessing of Nurgle name)`);
}

// Every mutation/blessing sellable in-game (MUTSETS) must have an English name
// that resolves to an ABILITYINFO tooltip, so it renders as a chip with an
// explanation rather than a bare, unexplained label.
function abilityInfo(nm) {
  const s = String(nm);
  for (const [re, info] of D.ABILITYINFO) if (info.name === s) return info;
  for (const [re, info] of D.ABILITYINFO) if (re.test(s)) return info;
  return null;
}

let missing = [];
for (const kind of Object.keys(D.MUTSETS)) {
  for (const [de] of D.MUTSETS[kind]) {
    const en = D.MUTEN[de] || de;
    if (!abilityInfo(en)) missing.push(`${kind}: ${de} -> ${en}`);
  }
}
assert.deepStrictEqual(missing, [], 'Every mutation/blessing must have an ABILITYINFO tooltip:\n' + missing.join('\n'));

console.log(`Blessings/Mutations: OK (${Object.keys(EXPECTED_NURGLE).length} Nurgle names verified, all MUTSETS entries have tooltips)`);
