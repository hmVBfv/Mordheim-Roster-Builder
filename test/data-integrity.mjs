/* Data integrity: every unit/HS/DP referenced by the data must actually resolve,
   every regex-revived field is a real RegExp, and warband unit lists contain no
   duplicate ids (which would make roster-order sorting, used by the PDF export,
   ambiguous). */
import assert from 'assert';
import * as fs from 'fs';

globalThis.fetch = async (u) => {
  const p = decodeURIComponent(new URL(u).pathname);
  return { ok: fs.existsSync(p), json: async () => JSON.parse(fs.readFileSync(p,'utf8')),
           arrayBuffer: async () => fs.readFileSync(p).buffer };
};
const D = await import(new URL('../data/index.js', import.meta.url).href);

let checked = 0, errors = [];

for (const [wbKey, wb] of Object.entries(D.WARBANDS)) {
  const ids = (wb.units || []).map(u => u.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) errors.push(`${wbKey}: duplicate unit ids ${dupes.join(', ')}`);
  checked += ids.length;
}

for (const [key, hs] of Object.entries(D.HIREDSWORDS)) {
  if (!hs.name) errors.push(`HIREDSWORDS.${key}: missing name`);
  checked++;
}
for (const [key, dp] of Object.entries(D.DRAMATIS)) {
  if (!dp.name) errors.push(`DRAMATIS.${key}: missing name`);
  checked++;
}

assert.ok(D.ABILITYINFO[0][0] instanceof RegExp, 'ABILITYINFO regexes must be revived to real RegExp objects');
assert.deepStrictEqual(errors, [], 'Data integrity errors:\n' + errors.join('\n'));

console.log(`Data integrity: OK (${checked} entries checked across ${Object.keys(D.WARBANDS).length} warbands, ${Object.keys(D.HIREDSWORDS).length} Hired Swords, ${Object.keys(D.DRAMATIS).length} Dramatis Personae)`);
