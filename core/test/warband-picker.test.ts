/* Finding a warband to start (wish #116, Rob, 28.10.2026): what the list of warbands knows about each – grade, race, gold, the most
   models, how many Heroes it may start with, whether it has a big creature – and a filter and a sort over it. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const facts = core.warbandFacts(data);
const get = (key: string) => facts.find((f) => f.key === key)!;

describe('what the picker knows of a warband', () => {
  it('every warband, with grade, race, gold and size from the data', () => {
    expect(facts).toHaveLength(Object.keys(data.WARBANDS).length);
    expect(get('merc')).toMatchObject({ name: 'Mercenaries', grade: 'core', race: 'Human', gold: 500, goldMax: 600, min: 3, max: 15 });
  });

  it('the Heroes it may start with: the most its hero units allow, six at the most', () => {
    expect(get('merc').heroes).toBe(5);
    const counts = new Set(facts.map((f) => f.heroes));
    expect([...counts].sort()).toEqual([4, 5, 6]);
    for (const f of facts) expect(f.heroes).toBeLessThanOrEqual(6);
  });

  it('a big creature where the data marks one (Kroxigor, Minotaur)', () => {
    expect(get('lizardmen').large).toBe(true);
    expect(get('beastmen').large).toBe(true);
    expect(get('merc').large).toBe(false);
  });
});

describe('the filter and the sort', () => {
  it('by name, race, grade, Heroes, creature, gold and size – all of them together', () => {
    expect(core.filterWarbands(facts, { q: 'merc' }).map((f) => f.key)).toContain('merc');
    expect(core.filterWarbands(facts, { race: 'Human' }).every((f) => f.race === 'Human')).toBe(true);
    expect(core.filterWarbands(facts, { grade: '1b' }).every((f) => f.grade === '1b')).toBe(true);
    expect(core.filterWarbands(facts, { heroes: 6 }).every((f) => f.heroes === 6)).toBe(true);
    expect(core.filterWarbands(facts, { heroes: 6 }).length).toBeGreaterThan(0);
    expect(core.filterWarbands(facts, { large: 'with' }).map((f) => f.key)).toEqual(expect.arrayContaining(['lizardmen', 'beastmen']));
    expect(core.filterWarbands(facts, { large: 'without' }).some((f) => f.large)).toBe(false);
    const rich = core.filterWarbands(facts, { goldFrom: 600 });
    expect(rich.every((f) => f.goldMax >= 600)).toBe(true);
    const big = core.filterWarbands(facts, { sizeFrom: 15, sizeTo: 15 });
    expect(big.every((f) => f.max === 15)).toBe(true);
    const both = core.filterWarbands(facts, { race: 'Human', heroes: 5, large: 'without' });
    expect(both.every((f) => f.race === 'Human' && f.heroes === 5 && !f.large)).toBe(true);
    expect(core.filterWarbands(facts, {})).toEqual(facts);
  });

  it('sorts by name, gold, size and Heroes without changing what is in the list', () => {
    const names = core.sortWarbands(facts, 'name').map((f) => f.name);
    expect(names).toEqual([...names].sort((a, b) => a.replace(/^the\s+/i, '').localeCompare(b.replace(/^the\s+/i, ''))));
    const gold = core.sortWarbands(facts, 'gold-desc').map((f) => f.goldMax);
    expect(gold).toEqual([...gold].sort((a, b) => b - a));
    const size = core.sortWarbands(facts, 'size-desc').map((f) => f.max);
    expect(size).toEqual([...size].sort((a, b) => b - a));
    const heroes = core.sortWarbands(facts, 'heroes-desc').map((f) => f.heroes);
    expect(heroes).toEqual([...heroes].sort((a, b) => b - a));
    expect(core.sortWarbands(facts, 'grade').map((f) => f.key).sort()).toEqual(facts.map((f) => f.key).sort());
  });
});
