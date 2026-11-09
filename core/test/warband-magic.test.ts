/* Wish of 8.11.2026: New warband shows the spell school of each warband, filters by it, and says where there is none. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const facts = core.warbandFacts(data);
const fact = (k: string) => facts.find((f) => f.key === k)!;

describe('the schools in the facts of a warband', () => {
  it('are the schools of its own casters', () => {
    expect(fact('nightgoblins').schools).toEqual(['waaagh']);
    expect(fact('sos').schools).toEqual(['prayersSigmar']);
    expect(fact('restless').schools).toEqual(['necromancyRD']);
  });

  it('are none for a warband that has no caster of its own', () => {
    expect(fact('merc').schools).toEqual([]);
    expect(fact('pirates').schools).toEqual([]);
  });

  it('agree with the box of spells and prayers of a new warband, for every warband', () => {
    const bad: string[] = [];
    for (const f of facts) {
      const boxed = core.warbandSpells(core.ctxOf(data, core.newWarband(data, f.key))).filter((s) => s.label === null).flatMap((s) => s.schools.map((x) => x.key));
      if (JSON.stringify(boxed) !== JSON.stringify(f.schools)) bad.push(`${f.key}: ${f.schools} vs ${boxed}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('the filter by school', () => {
  it('passes the warbands of a school, or those with none', () => {
    const waaagh = core.filterWarbands(facts, { magic: 'waaagh' }).map((f) => f.key).sort();
    expect(waaagh).toEqual(['nightgoblins', 'orcmob']);
    const none = core.filterWarbands(facts, { magic: 'none' });
    expect(none.every((f) => f.schools.length === 0)).toBe(true);
    expect(none.map((f) => f.key)).toContain('merc');
    expect(core.filterWarbands(facts, { magic: '' })).toHaveLength(facts.length);
  });
});
