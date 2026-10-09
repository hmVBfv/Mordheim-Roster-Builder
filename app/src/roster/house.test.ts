/* A warband's house rules on the screen (phase 3e): off is the rules as
   written, a rule switched on starts at a sensible value and moves in
   steps, and every export declares what is on. */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { data } from '../test/data.ts';
import { adoptHouse, campaignHouseState, declaration, differingRules, houseView, setBodyOnly, setGrade, setRule, stepRule } from './house.ts';

const ctx = (s: WarbandState) => core.ctxOf(data, s);
const rule = (s: WarbandState, key: string) => houseView(data, s).groups.flatMap((g) => g.rules).find((r) => r.key === key)!;

describe('house rules', () => {
  it('a new warband plays everything as written', () => {
    const s = core.newWarband(data, 'merc');
    const v = houseView(data, s);
    expect(v.count).toBe(0);
    expect(v.groups.flatMap((g) => g.rules).every((r) => !r.on)).toBe(true);
    expect(rule(s, 'startGold').std).toBe('the warband’s own: 500 gc');
    expect(rule(s, 'max').std).toBe('the warband’s own: 15');
    expect(declaration(ctx(s))).toBe('');
  });

  it('a price: on at 80 %, in steps of 5, back to 100 % when off', () => {
    let s = core.newWarband(data, 'merc');
    s = setRule(ctx(s), 'priceArmour', true);
    expect(rule(s, 'priceArmour')).toMatchObject({ on: true, value: '80 %', bodyOnly: false });
    s = stepRule(ctx(s), 'priceArmour', 1);
    expect(core.houseRules(s).priceArmour).toBe(85);
    s = setBodyOnly(ctx(s), true);
    expect(declaration(ctx(s))).toContain('Armour price: 85');
    s = setRule(ctx(s), 'priceArmour', false);
    expect(core.houseRules(s)).toMatchObject({ priceArmour: 100, armourBodyOnly: false });
    expect(houseView(data, s).count).toBe(0);
  });

  it('prices change what a founding warband spent', () => {
    let s = core.newWarband(data, 'merc');
    s = core.addUnit(ctx(s), 'capt');
    s = core.setEqQty(ctx(s), s.models[0]!.uid, 'Schwert', 1);
    const before = core.goldCurrent(ctx(s));
    s = setRule(ctx(s), 'priceAll', true);
    expect(core.goldCurrent(ctx(s))).toBeGreaterThan(before);
  });

  it('"Enforce equipment list" is offered the other way round', () => {
    let s = core.newWarband(data, 'merc');
    expect(rule(s, 'anyEq').on).toBe(false);
    s = setRule(ctx(s), 'anyEq', true);
    expect(core.houseRules(s).eqLimitOn).toBe(false);
    expect(rule(s, 'anyEq').on).toBe(true);
  });

  it('numbers without a fixed start begin next to the warband’s own', () => {
    let s = core.newWarband(data, 'merc');
    s = setRule(ctx(s), 'startGold', true);
    expect(core.houseRules(s).startGold).toBe(600);
    s = setRule(ctx(s), 'max', true);
    expect(core.warbandMax(ctx(s))).toBe(14);
    s = setRule(ctx(s), 'max', false);
    expect(core.houseRules(s).max).toBe('');
    // steps stay within bounds
    s = setRule(ctx(s), 'rangedCap', true);
    for (let i = 0; i < 30; i++) s = stepRule(ctx(s), 'rangedCap', 1);
    expect(core.houseRules(s)).toMatchObject({ rangedCapOn: true, rangedCap: 100 });
    expect(rule(s, 'rangedCap').canMore).toBe(false);
  });

  it('grades of Hired Swords and Dramatis Personae', () => {
    let s = core.newWarband(data, 'merc');
    s = setGrade(ctx(s), 'hsGrades', '2a', false);
    expect(rule(s, 'hsGrades')).toMatchObject({ on: true });
    expect(rule(s, 'hsGrades').grades.find((g) => g.grade === '2a')!.played).toBe(false);
    expect(declaration(ctx(s))).toContain('excluded: 2a');
    s = setGrade(ctx(s), 'hsGrades', '2a', true);
    expect(rule(s, 'hsGrades').on).toBe(false);
  });

  it('a switch on its own: on and off', () => {
    let s = setRule(ctx(core.newWarband(data, 'merc')), 'freeDagger', true);
    expect(houseView(data, s).count).toBe(1);
    expect(declaration(ctx(s))).toBe('House rules: All daggers free: on');
    s = setRule(ctx(s), 'freeDagger', false);
    expect(houseView(data, s).count).toBe(0);
  });
});

describe('a campaign’s house rules (phase 4a4)', () => {
  const CAMPAIGN = { freeDagger: true, priceArmour: 80, armourBodyOnly: true, hsGrades: { '2a': false }, rangedCapOn: true, rangedCap: 40, notes: 'Daggers are on the house.' };

  it('shown for every warband: as written is each warband’s own; the display setting is the player’s', () => {
    const v = houseView(data, campaignHouseState(data, CAMPAIGN), { campaign: true });
    expect(v.count).toBe(4);
    const rules = v.groups.flatMap((g) => g.rules);
    expect(rules.find((r) => r.key === 'startGold')!.std).toBe('each warband’s own');
    expect(rules.some((r) => r.key === 'showRarity')).toBe(false);
  });

  it('a warband names where its own rules differ, and takes the campaign’s over with core’s own switches', () => {
    let s: WarbandState = core.newWarband(data, 'merc');
    s = setRule(ctx(s), 'priceAll', true);
    s = core.setHouseBool(ctx(s), 'showRarity', true);
    expect(differingRules(CAMPAIGN, s.house)).toEqual(['All equipment', 'Armour', 'Armour: body armour only', 'All daggers free', 'Limit models with ranged weapons', 'Hired Sword grades played']);
    s = adoptHouse(ctx(s), CAMPAIGN);
    expect(differingRules(CAMPAIGN, s.house)).toEqual([]);
    expect(core.houseRules(s)).toMatchObject({ priceAll: 100, priceArmour: 80, armourBodyOnly: true, freeDagger: true, rangedCapOn: true, rangedCap: 40, notes: 'Daggers are on the house.', showRarity: true });
    expect(core.houseRules(s).hsGrades).toMatchObject({ '1a': true, '2a': false });
    // nothing to take over: the same warband
    expect(adoptHouse(ctx(s), CAMPAIGN)).toBe(s);
  });
});
