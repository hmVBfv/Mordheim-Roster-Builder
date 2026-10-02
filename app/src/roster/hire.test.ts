/* The Hire screen's view (phase 3d): the lists with fee, upkeep and why
   not, the filters, and the sheet of one character. */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { data } from '../test/data.ts';
import { filterRows, gradesOf, hireDetail, hireFigures, hireRows } from './hire.ts';

const ctx = (s: WarbandState) => core.ctxOf(data, s);
const merc = () => core.newWarband(data, 'merc');

describe('the lists', () => {
  it('every Hired Sword, each with fee, upkeep and whether he may join', () => {
    const rows = hireRows(ctx(merc()), 'hs');
    expect(rows).toHaveLength(Object.keys(data.HIREDSWORDS).length);
    expect(rows.find((r) => r.key === 'warlock')).toMatchObject({ name: 'Warlock', fee: 30, baseFee: 30, upkeep: 15, why: '', hired: false });
    // a choice still to be made is no reason not to join
    expect(rows.find((r) => r.key === 'ogre')!.why).toBe('');
    const no = core.hireEligibility(ctx(merc())).blocked[0]!;
    expect(rows.find((r) => r.key === no.key)!.why).toBe(no.reason);
  });

  it('a hired one is marked, and may not join twice', () => {
    const s = core.hire(ctx(merc()), 'hs', 'warlock');
    expect(hireRows(ctx(s), 'hs').find((r) => r.key === 'warlock')).toMatchObject({ hired: true, why: 'already with the warband: one of each Hired Sword' });
    expect(hireFigures(ctx(s))).toMatchObject({ upkeep: 15, hired: 1, gold: 470, locked: false });
    // still on the list of those who may be hired, marked
    const shown = filterRows(hireRows(ctx(s), 'hs'), { q: 'warlock', grades: new Set(gradesOf(ctx(s), 'hs')), only: true, order: 'name' });
    expect(shown.map((r) => r.key)).toEqual(['warlock']);
  });

  it('Dramatis Personae: the wanderers are marked', () => {
    const rows = hireRows(ctx(merc()), 'dp');
    expect(rows).toHaveLength(Object.keys(data.DRAMATIS).length);
    expect(rows.find((r) => r.key === 'aenur')!.wanderer).toBe(true);
  });

  it('found by name or race, by grade, by who may join; ordered', () => {
    const c = ctx(merc());
    const rows = hireRows(c, 'hs');
    const grades = new Set(gradesOf(c, 'hs'));
    expect([...grades]).toEqual(expect.arrayContaining(['1a', '1b']));
    const f = (x: Partial<Parameters<typeof filterRows>[1]>) => filterRows(rows, { q: '', grades, only: true, order: 'name', ...x });
    expect(f({ q: 'ogre' }).map((r) => r.key)).toContain('ogre');
    expect(f({ q: 'dwarf' }).every((r) => /dwarf/i.test(`${r.name} ${r.race}`))).toBe(true);
    expect(f({}).every((r) => !r.why || r.hired)).toBe(true);
    expect(f({ only: false })).toHaveLength(rows.length);
    expect(f({ grades: new Set(['1a']) }).every((r) => r.grade === '1a')).toBe(true);
    // a characteristic, as the Roster Builder filters: Strength 4 or more
    const strong = f({ only: false, stat: { stat: 'S', op: '>=', val: '4' } });
    expect(strong.map((r) => r.key)).toContain('ogre');
    expect(strong.every((r) => Number(r.entry.profile!.S) >= 4 || Number((r.entry.profile2 as { p?: { S?: number } } | undefined)?.p?.S) >= 4)).toBe(true);
    expect(f({ only: false, stat: { stat: 'S', op: '>=', val: '' } })).toHaveLength(rows.length);
    const byFee = f({ order: 'fee' }).map((r) => r.fee);
    expect(byFee).toEqual([...byFee].sort((a, b) => a - b));
  });
});

describe('the sheet of one', () => {
  it('the Ogre: his weapons to choose, his rules with their texts', () => {
    const c = ctx(merc());
    const d = hireDetail(c, 'hs', 'ogre')!;
    expect(d.choices!.label).toBe('Weapons');
    expect(d.rules.map((f) => f.label)).toEqual(expect.arrayContaining(['Fear', 'Large Target']));
    expect(d.stats.map((x) => x.value).join(' ')).toBe('6 3 2 4 4 3 3 2 7');
    const chosen = d.choices!.choices[1]!;
    expect(hireDetail(c, 'hs', 'ogre', chosen)!.equipment).toContain(chosen);
  });

  it('a Halfling lets the warband have one more; a Priest of Morr takes a Hero’s place', () => {
    expect(hireDetail(ctx(merc()), 'hs', 'halfling')!.sizeBonus).toBe(1);
    expect(hireDetail(ctx(merc()), 'hs', 'priestofmorr')!.slot).toBe(true);
  });

  it('a pair hired together shows both', () => {
    const d = hireDetail(ctx(merc()), 'dp', 'ulli_marquand')!;
    expect(d.first).toBe('Ulli');
    expect(d.second!.name).toBe('Marquand');
  });

  it('a district that halves his fee is named', () => {
    const s = structuredClone(merc());
    s.campaign = { ...s.campaign, on: true, round: 1, districts: { steinhardt: 'foothold' } };
    const d = hireDetail(ctx(s), 'hs', 'freelancer')!;
    expect(d.row.fee).toBe(d.row.baseFee / 2);
    expect(d.discount).toBe("Count Steinhardt's Palace");
  });

  it('nobody for an unknown key', () => {
    expect(hireDetail(ctx(merc()), 'hs', 'nobody')).toBe(null);
  });
});
