/* A campaign's house rules against a warband's own (phase 4a4): only the
   rules count, as they act. */
import { describe, expect, it } from 'vitest';
import { effectiveHouse, HOUSE_RULE_KEYS, houseDefaults, houseDifferences } from '../src/index.ts';

describe('house rules of a campaign and of a warband', () => {
  it('the same rules, written differently, do not differ', () => {
    expect(houseDifferences({}, houseDefaults())).toEqual([]);
    expect(houseDifferences(undefined, { notes: 'Ours', showRarity: true })).toEqual([]);
    // a grade left out is played; a number as text is the number
    expect(houseDifferences({ hsGrades: { '1a': true } }, { priceAll: '100' })).toEqual([]);
    // a value without its switch does nothing
    expect(houseDifferences({ rangedCap: 50, rangedCapOn: false }, {})).toEqual([]);
    expect(houseDifferences({ armourBodyOnly: true }, {})).toEqual([]);
  });

  it('names every rule that differs', () => {
    expect(houseDifferences({ priceArmour: 80, freeDagger: true }, { freeDagger: true })).toEqual(['priceArmour']);
    expect(houseDifferences({ hsGrades: { '2a': false } }, {})).toEqual(['hsGrades']);
    expect(houseDifferences({ rangedCapOn: true, rangedCap: 50 }, { rangedCapOn: true, rangedCap: 40 })).toEqual(['rangedCap']);
    expect(houseDifferences({ startGold: 600, eqLimitOn: false }, {})).toEqual(['startGold', 'eqLimitOn']);
  });

  it('the rules are every house rule but the notes and the display setting', () => {
    expect(HOUSE_RULE_KEYS).not.toContain('notes');
    expect(HOUSE_RULE_KEYS).not.toContain('showRarity');
    expect(HOUSE_RULE_KEYS.length).toBe(Object.keys(houseDefaults()).length - 2);
    expect(effectiveHouse(null)).toEqual(houseDefaults());
  });
});
