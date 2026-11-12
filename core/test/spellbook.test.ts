/* Wish of 8.11.2026: a box on the warband screen lists the spells or prayers the warband can learn – the schools its own units cast from –
   with the lore line of each spell as the page on mordheimer.net words it. A Hired Sword's or Dramatis Personae's school is listed only while
   he is on the roster, under his name. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: core.WarbandState) => core.ctxOf(data, s);
const band = (wb: string, ...units: string[]) => {
  let s = core.newWarband(data, wb);
  for (const u of units) s = core.addUnit(ctx(s), u);
  return s;
};
const schoolsOf = (s: core.WarbandState) => core.warbandSpells(ctx(s)).map((x) => [x.label, x.schools.map((y) => y.key)]);

describe('the spells of a warband', () => {
  it('are the school its casters cast from, with difficulty, effect and the lore line', () => {
    const s = band('nightgoblins');
    expect(schoolsOf(s)).toEqual([[null, ['waaagh']]]);
    const ledz = core.warbandSpells(ctx(s))[0]!.schools[0]!.spells[0]!;
    expect(ledz).toMatchObject({ name: "Led'z go", difficulty: '9', lore: 'The Shaman’s howling invigorates the ladz to fight even harder for Gork and Mork.' });
    expect(ledz.text).toMatch(/Any Orc or Goblin within 4" of the Shaman will automatically strike first in hand-to-hand combat/); // the page's own wording (bug 256)
  });

  it('are listed whether or not the caster is on the roster yet: it is what the warband can learn', () => {
    expect(schoolsOf(band('orcmob'))).toEqual([[null, ['waaagh']]]);
    expect(schoolsOf(band('sos'))).toEqual([[null, ['prayersSigmar']]]);
  });

  it('are none for a warband without a caster of its own (the Mercenaries have only what they hire)', () => {
    expect(schoolsOf(band('merc', 'capt'))).toEqual([]);
  });

  it('add the school of a Hired Sword while he is hired, under his name, and take it away with him', () => {
    let s = band('merc', 'capt');
    s = { ...s, hired: [{ key: 'warlock', uid: 'h1' }] };
    expect(schoolsOf(s)).toEqual([['Warlock · Hired Sword', ['lesserMagic']]]);
    s = { ...s, hired: [] };
    expect(schoolsOf(s)).toEqual([]);
  });

  it('do the same for Dramatis Personae, and keep the warband\'s own school apart from them', () => {
    let s = band('sos');
    s = { ...s, dp: [{ key: 'bertha', uid: 'd1' }], hired: [{ key: 'warlock', uid: 'h1' }] };
    expect(schoolsOf(s).map((x) => x[0])).toEqual([null, 'Warlock · Hired Sword', `${data.DRAMATIS.bertha!.name} · Dramatis Personae`]);
    expect(schoolsOf({ ...s, dp: [] }).map((x) => x[0])).toEqual([null, 'Warlock · Hired Sword']);
  });

  it('follow the Mark of a Marauders of Chaos warband', () => {
    const s = { ...band('maraudersofchaos', 'seer'), mark: 'eagle' };
    expect(schoolsOf(s)).toEqual([[null, [data.MARAUDER_MARKS.find((m) => m[0] === 'eagle')![2]]]]);
  });

  it('give the lore lines word for word where the page has them, and none where it has none', () => {
    const hammer = data.SPELLS.prayersSigmar!.lore!['Hammer of Sigmar']!;
    expect(hammer).toBe('This weapon of the faithful glows with a golden light, imbued as it is with the righteous power of Sigmar.');
    const ladys = core.warbandSpells(ctx(band('bretchapel')))[0]!.schools[0]!;
    expect(ladys.key).toBe('ladysPrayers');
    expect(ladys.spells.every((x) => x.lore === null)).toBe(true);
  });

  it('keep every lore line to a spell of its own school', () => {
    const bad: string[] = [];
    for (const [k, school] of Object.entries(data.SPELLS)) {
      const names = new Set(school.spells.map(([n]) => n.replace(/\s*\([^)]*\)\s*$/, '')));
      for (const n of Object.keys(school.lore ?? {})) if (!names.has(n)) bad.push(`${k}: ${n}`);
    }
    expect(bad).toEqual([]);
  });
});
