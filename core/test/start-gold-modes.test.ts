/* The Starting gold house rule in three forms (report #36): the same for everybody, so much more for everybody, or so many
   percent more, each from what the warband starts with. New logic: legacy knows only the first. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const withHouse = (key: string, v: number | '', wb = 'merc') => core.setHouseNum(ctx(core.newWarband(data, wb)), key as 'startGold', v);
const own = (wb: string) => core.startGold(ctx(core.newWarband(data, wb)));

describe('the starting gold rule', () => {
  it('is off by default: each warband has its own', () => {
    expect(own('merc')).toBe(500);
    expect(core.houseRules(core.newWarband(data, 'merc'))).toMatchObject({ startGold: '', startGoldPlus: '', startGoldPct: '' });
  });

  it('can be the same for everybody (as before)', () => {
    for (const wb of ['merc', 'undead', 'skaven']) expect(core.startGold(ctx(withHouse('startGold', 600, wb)))).toBe(600);
  });

  it('can be so much more for everybody, from what each starts with', () => {
    const base = (wb: string) => own(wb);
    for (const wb of ['merc', 'undead', 'skaven']) expect(core.startGold(ctx(withHouse('startGoldPlus', 100, wb)))).toBe(base(wb) + 100);
  });

  it('can be so many percent more, from what each starts with, rounded up to the next full gc', () => {
    for (const wb of ['merc', 'undead', 'skaven']) {
      const base = own(wb);
      expect(core.startGold(ctx(withHouse('startGoldPct', 20, wb)))).toBe(Math.ceil((base * 120) / 100));
    }
    expect(core.startGold(ctx(withHouse('startGoldPct', 10)))).toBe(550);
    // a figure that is not whole is rounded up, and the sum is made in whole numbers: 500 gc and 10 % is 550, not 551
    for (const pct of [1, 5, 7, 15, 33]) expect(core.startGold(ctx(withHouse('startGoldPct', pct)))).toBe(Math.ceil((500 * (100 + pct)) / 100));
  });

  it('counts the subtype\'s own gold as the start, and the treasury follows', () => {
    const s = withHouse('startGoldPlus', 50);
    expect(core.goldTreasury(ctx(s))).toBe(core.startGold(ctx(s)));
  });

  it('the fixed amount wins if several are set (the app lets only one stay on)', () => {
    let s = withHouse('startGold', 700);
    s = core.setHouseNum(ctx(s), 'startGoldPlus', 100);
    s = core.setHouseNum(ctx(s), 'startGoldPct', 50);
    expect(core.startGold(ctx(s))).toBe(700);
    s = core.setHouseNum(ctx(s), 'startGold', '');
    expect(core.startGold(ctx(s))).toBe(600);
  });

  it('is part of the house rules a campaign sets and a warband is compared with', () => {
    expect(core.houseDifferences({ startGoldPlus: 100 }, {})).toEqual(['startGoldPlus']);
    expect(core.houseDifferences({ startGoldPct: 20 }, { startGoldPct: '20' })).toEqual([]);
    expect(core.HOUSE_RULE_KEYS).toEqual(expect.arrayContaining(['startGoldPlus', 'startGoldPct']));
  });

  it('is declared on an export with its meaning', () => {
    const plus = core.houseDeviations(ctx(withHouse('startGoldPlus', 100))).find((d) => d.key === 'startGoldPlus');
    const pct = core.houseDeviations(ctx(withHouse('startGoldPct', 20))).find((d) => d.key === 'startGoldPct');
    expect(plus).toMatchObject({ label: 'Starting gold: extra for every warband', value: '+100 gc' });
    expect(pct).toMatchObject({ label: 'Starting gold: raised for every warband', value: '+20 % (rounded up)' });
  });
});
