/* Plan P14: the numbers a statistics chart plots, computed from a warband's state alone. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

function warband(): WarbandState {
  let s = core.newWarband(data, 'mastersofhorror');
  for (const u of data.WARBANDS.mastersofhorror!.units.filter((x) => x.req)) s = core.addUnit(ctx(s), u.id);
  return s;
}
const edit = (s: WarbandState, f: (d: WarbandState) => void): WarbandState => { const d = structuredClone(s); f(d); return d; };

describe('stageMetrics', () => {
  it('agrees with the existing totals and starts without losses, income or wyrdstone', () => {
    const s = warband(); const m = core.stageMetrics(ctx(s));
    expect(m.value).toBe(core.warbandWorth(ctx(s)));
    expect(m.gold).toBe(core.goldCurrent(ctx(s)));
    expect(m.wealth).toBe(core.goldTreasury(ctx(s)));
    expect(m).toMatchObject({ stash: 0, lost: 0, wyrd: 0, wyrdFound: 0, income: 0 });
    expect(m.exp).toBe(m.heroExp); // a hero starts with experience, a fresh warband has no henchmen yet
  });

  it('counts experience of the whole warband and of its heroes, the dead included', () => {
    const s = warband(); const hero = s.models.find((x) => core.isHeroModel(ctx(s), x))!;
    const t = edit(s, (d) => { d.models.find((x) => x.uid === hero.uid)!.exp = 12; });
    expect(core.stageMetrics(ctx(t))).toMatchObject({ heroExp: 12 });
    const before = core.stageMetrics(ctx(t)).exp;
    const dead = edit(t, (d) => { d.fallen = [{ kind: 'hero', m: { ...hero, exp: 5 }, lostValue: 30 }]; });
    expect(core.stageMetrics(ctx(dead))).toMatchObject({ heroExp: 12, lost: 30 });
    expect(core.stageMetrics(ctx(dead)).exp).toBe(before + 5);
  });

  it('adds the stash to wealth, and sold wyrdstone to what was found and earned', () => {
    const s = edit(warband(), (d) => {
      d.stash = { wyrd: 2, gold: null, items: [{ name: 'Sword', qty: 2, paid: 10 }, { name: 'Ghost Dust', qty: 1, rare: true, paid: 40 }] };
      d.ledger = [{ id: 1, kind: 'sell', amount: 25, text: 'x' }, { id: 2, kind: 'adjust', amount: 15, text: 'y' }, { id: 3, kind: 'buy', amount: -30, text: 'z' }, { id: 4, kind: 'search', amount: -10, text: 'w' }];
      d.campaign = { on: true, postbattle: { 1: { done: {}, wyrd: { done: true, shards: 3, gc: 90, size: 5 } } } } as WarbandState['campaign'];
    });
    const m = core.stageMetrics(ctx(s));
    expect(m).toMatchObject({ stash: 60, stashItems: 3, rareStash: 1, wyrd: 2, wyrdFound: 5, income: 130, incomeWyrd: 90, incomeGoods: 25, incomeOther: 15, spentBuy: 30, spentSearch: 10 });
    expect(m.wealth).toBe(core.goldTreasury(ctx(s)) + 60);
  });
});

describe('stageMetrics with the post-battle record (N14)', () => {
  function played(): WarbandState {
    let s = { ...warband(), campaign: { on: true, round: 1, districts: {} } } as WarbandState;
    s = core.openLedger(ctx(s));
    s = { ...s, hired: [{ key: 'elfranger', uid: 'hs0' }] } as WarbandState;
    s = core.stashAdjust(ctx(s), 'wyrd', 3);
    s = core.sellWyrdstone(ctx(s), 1, 3);
    s = core.payUpkeep(ctx(s), 1, ['hs0']);
    // a place: Market Hall, gold 9
    s = core.applyLocation(ctx(s), 1, { key: '5 5 5', answers: { 's.0.d.0': 9 } });
    return s;
  }

  it('splits the income by source from the finds, and keeps the places’ gold out of “other”', () => {
    const s = played();
    const m = core.stageMetrics(ctx(s));
    const sale = (s.campaign as { postbattle: Record<string, { wyrd: { gc: number } }> }).postbattle['1']!.wyrd.gc;
    expect(m).toMatchObject({ incomeWyrd: sale, incomeLocations: 9, incomeScenario: 0, incomeGoods: 0, incomeOther: 0 });
    expect(m.income).toBe(sale + 9);
    expect(m.upkeepPaid).toBe(core.hsUpkeepFor(ctx(s), 'elfranger'));
  });

  it('the worth of what was found is the list price of the items', () => {
    let s = { ...warband(), campaign: { on: true, round: 1, districts: {} } } as WarbandState;
    s = core.applyLocation(ctx(s), 1, { key: '2 2 2', answers: { 's.0': 1 } });
    const m = core.stageMetrics(ctx(s));
    expect(m.lootValue).toBe(data.CATALOG.find((c) => c.en === 'Sword')!.cost);
  });

  it('a round without a record (an older one) is read from its sale alone, as before', () => {
    const s = edit(warband(), (d) => { d.campaign = { on: true, postbattle: { 1: { done: {}, wyrd: { done: true, shards: 2, gc: 60, size: 5 } } } } as WarbandState['campaign']; });
    expect(core.stageMetrics(ctx(s))).toMatchObject({ incomeWyrd: 60, incomeLocations: 0, upkeepPaid: 0, lootValue: 0, income: 60 });
  });
});

describe('warriorMetrics', () => {
  it('lists the experience of each roster entry and counts the dead by unit', () => {
    const s = warband(); const hero = s.models.find((x) => core.isHeroModel(ctx(s), x))!;
    const t = edit(s, (d) => {
      d.models.find((x) => x.uid === hero.uid)!.exp = 12;
      d.fallen = [{ kind: 'hero', m: { ...hero, exp: 5 } }, { kind: 'hero', m: { ...hero, exp: 9 } }];
    });
    const w = core.warriorMetrics(ctx(t));
    expect(w.warriors.find((x) => x.uid === hero.uid)).toMatchObject({ exp: 12, hero: true });
    expect(w.warriors.length).toBe(s.models.length);
    expect(w.fallen).toEqual([{ unit: core.unitDef(ctx(t), hero.uid_def)!.name, count: 2 }]);
  });

  it('is empty for a warband without deaths and does not change the state', () => {
    const s = warband(); const frozen = JSON.stringify(s);
    expect(core.warriorMetrics(ctx(s)).fallen).toEqual([]);
    expect(JSON.stringify(s)).toBe(frozen);
  });
});

describe('gold lost without a death, and won in the Pits', () => {
  const campaign = (s: WarbandState): WarbandState => edit(s, (d) => { d.campaign = { ...d.campaign, on: true, round: 1, districts: {} } as WarbandState['campaign']; });
  const hero = (s: WarbandState) => s.models.find((x) => core.isHeroModel(ctx(s), x))!;

  it('counts the gear a Robbed hero loses, and says nothing about it when nobody was robbed', () => {
    const s = edit(campaign(warband()), (d) => { d.models.find((x) => core.isHeroModel(ctx(d), x))!.eq = { Schwert: 1, Dolch: 1 }; });
    expect(core.stageMetrics(ctx(s))).toMatchObject({ lostGear: 0, lostRansom: 0, lostLocations: 0, lostTotal: 0, incomePit: 0 });
    const t = core.addInjury(ctx(s), hero(s).uid, '36');
    const m = core.stageMetrics(ctx(t));
    expect(m.lostGear).toBe((t.campaign!.log as { data?: { gold?: number } }[]).filter((e) => e.data?.gold).reduce((n, e) => n - Number(e.data!.gold), 0));
    expect(m.lostGear).toBeGreaterThan(0);
    expect(m.lostTotal).toBe(m.lost + m.lostGear);
    expect(m.lost).toBe(0);
  });

  it('counts a ransom, a won pit fight (as income) and a lost one (as gear lost)', () => {
    const s = campaign(warband());
    const won = core.stageMetrics(ctx(core.addInjury(ctx(s), hero(s).uid, '65', { pitWon: true })));
    expect(won).toMatchObject({ incomePit: 50, lostGear: 0 });
    expect(won.income).toBe(50);
    const ransomed = core.stageMetrics(ctx(core.addInjury(ctx(s), hero(s).uid, '61', { ransom: 35 })));
    expect(ransomed).toMatchObject({ lostRansom: 35, lostTotal: 35 });
  });

  it('counts the losses of a place on the Exploration chart', () => {
    const s = edit(campaign(warband()), (d) => {
      (d.campaign as { postbattle?: unknown }).postbattle = { 1: { finds: [{ id: 1, kind: 'gold', source: 'location:x', amount: -20, text: 'x' }, { id: 2, kind: 'gold', source: 'location:y', amount: 30, text: 'y' }] } };
    });
    expect(core.stageMetrics(ctx(s))).toMatchObject({ lostLocations: 20, incomeLocations: 30, lostTotal: 20 });
  });
});
