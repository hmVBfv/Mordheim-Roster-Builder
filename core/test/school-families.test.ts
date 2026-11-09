/* Report of 9.11.2026: spell schools made for one warband (the Marauders' Chaos Magic, the Restless Dead's Necromancy) count under the school they belong
   to in the list on New warband. Prayers stay schools of their own: the Prayers of Sigmar are nothing like the Prayers of Taal. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const facts = core.warbandFacts(data);
const fact = (k: string) => facts.find((f) => f.key === k)!;

describe('the school a warband is listed under', () => {
  it('is the parent school where its own is made for the warband', () => {
    expect(fact('maraudersofchaos').families).toEqual(['chaosRituals']);
    expect(fact('carnival').families).toEqual(['chaosRituals']);
    expect(fact('restless').families).toEqual(['necromancy']);
    expect(fact('undead').families).toEqual(['necromancy']);
    expect(fact('forestgoblins').families).toEqual(['waaagh']);
    expect(fact('nightgoblins').families).toEqual(['waaagh']);
  });

  it('keeps the true school in the facts: the box of spells still names it', () => {
    expect(fact('restless').schools).toEqual(['necromancyRD']);
    expect(fact('maraudersofchaos').schools).toEqual(['marauderChaos']);
  });

  it('keeps every prayer a school of its own', () => {
    expect(fact('sos').families).toEqual(['prayersSigmar']);
    expect(fact('ostlander').families).toEqual(['prayersTaal']);
    expect(fact('bretchapel').families).toEqual(['ladysPrayers']);
  });

  it('follows no loop and ends in a school that exists', () => {
    for (const [k, s] of Object.entries(data.SPELLS)) {
      const root = core.schoolRoot(data, k);
      expect(data.SPELLS[root], k).toBeTruthy();
      expect(data.SPELLS[root]!.family, `${k} → ${root}`).toBeUndefined();
      expect(s.family === undefined || data.SPELLS[s.family] !== undefined, k).toBe(true);
    }
  });

  it('filters by the parent school: Necromancy finds both necromancer warbands', () => {
    const keys = core.filterWarbands(facts, { magic: 'necromancy' }).map((f) => f.key).sort();
    expect(keys).toEqual(['restless', 'undead']);
    expect(core.filterWarbands(facts, { magic: 'marauderChaos' })).toEqual([]);
  });
});
