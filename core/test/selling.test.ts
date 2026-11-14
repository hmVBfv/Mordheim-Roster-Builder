/* N9: selling wyrdstone and treasure. The price depends on the size of the warband; what the data says about that size (Ogres count double,
   mobs as one, the Halfling Cook and Victuals lower it by a band) is applied and shown; the Cathayan Merchant's roll changes the price. Rob,
   14.11.2026: Victuals only for treasure, and it stacks with the Cook there; mobs count as one for the price table. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

function band(wb: string, extra: (s: WarbandState) => WarbandState = (s) => s, add: string[] = []): WarbandState {
  let s = { ...core.newWarband(data, wb), campaign: { on: true, round: 1, districts: {} } } as WarbandState;
  for (const u of data.WARBANDS[wb]!.units.filter((x) => x.req)) s = core.addUnit(ctx(s), u.id);
  for (const id of add) s = core.addUnit(ctx(s), id);
  return extra(s);
}
/** A warband of exactly n warriors: its required heroes and one henchman group of the size that makes up the rest (set directly, so the group limits of the roster do not matter here). */
const plain = (n: number): WarbandState => {
  let s = band('merc');
  const hench = data.WARBANDS.merc!.units.find((u) => u.t === 'hen')!;
  s = core.addUnit(ctx(s), hench.id);
  const others = core.warbandSize(ctx(s)) - 1;
  return { ...s, models: s.models.map((m) => (m.uid_def === hench.id ? { ...m, qty: Math.max(1, n - others) } : m)) };
};

describe('the size for selling', () => {
  it('is the warband’s size, with nothing to adjust', () => {
    const s = plain(7);
    const z = core.sellingSize(ctx(s), { kind: 'wyrd' });
    expect(z).toMatchObject({ base: 7, models: 7, band: 2, lines: [] });
  });

  it('a Maneaters Ogre counts as two models', () => {
    const s = band('maneaters');
    const base = core.warbandSize(ctx(s));
    const z = core.sellingSize(ctx(s), { kind: 'wyrd' });
    const ogres = s.models.filter((m) => data.WARBANDS.maneaters!.units.find((u) => u.id === m.uid_def)?.large).reduce((n, m) => n + (Number(m.qty) || 1), 0);
    expect(ogres).toBeGreaterThan(0);
    expect(z.models).toBe(base + ogres);
    expect(z.lines.map((l) => l.id)).toEqual(['ogres']);
  });

  it('a mob counts as one model, however many are in it', () => {
    const base = band('snotlings');
    const s = { ...base, models: [...base.models, { ...base.models[0]!, uid: 99, uid_def: 'snotlingmo', qty: 5 }] } as WarbandState;
    const mob = s.models.find((m) => m.uid_def === 'snotlingmo')!;
    const z = core.sellingSize(ctx(s), { kind: 'wyrd' });
    expect(core.warbandSize(ctx(s)) - z.models).toBe((Number(mob.qty) || 1) - 1);
    expect(z.lines.map((l) => l.id)).toEqual(['mobs']);
  });

  it('the Halfling Cook, when his D6 is 5+, lowers the band by one – for wyrdstone and treasure', () => {
    const s = band('halflings', (st) => st, ['halflingco']);
    expect(core.chefAvailable(ctx(s))).toBe(true);
    const normal = core.sellingSize(ctx(s), { kind: 'wyrd' });
    const chef = core.sellingSize(ctx(s), { kind: 'wyrd', chef: true });
    expect(chef.band).toBe(Math.max(0, normal.band - 1));
    expect(chef.lines.map((l) => l.id)).toEqual(['chef']);
    expect(core.sellingSize(ctx(s), { kind: 'treasure', chef: true }).band).toBe(chef.band);
    expect(core.chefAvailable(ctx(band('merc')))).toBe(false);
  });

  it('Victuals lower the band for treasure only, one for each used, and stack with the Cook; never below 1–3', () => {
    const s = plain(14); // band 13–15
    expect(core.sellingSize(ctx(s), { kind: 'wyrd', victuals: 2 }).band).toBe(core.sellingSize(ctx(s), { kind: 'wyrd' }).band);
    const t = (v: number, chef = false) => core.sellingSize(ctx(s), { kind: 'treasure', victuals: v, chef }).band;
    expect(t(0)).toBe(4);
    expect(t(1)).toBe(3);
    expect(t(2)).toBe(2);
    const cook = { ...s, models: [...s.models, { ...s.models[0]!, uid: 98, uid_def: 'halflingco' }] } as WarbandState; // a Cook: 15 warriors, still 13–15
    const tc = (v: number) => core.sellingSize(ctx(cook), { kind: 'treasure', victuals: v, chef: true }).band;
    expect(tc(2)).toBe(1); // stacks with the Cook
    expect(tc(9)).toBe(0); // never below 1–3
  });

  it('a manual correction of the size, for what the data does not say', () => {
    const s = plain(7);
    expect(core.sellingSize(ctx(s), { kind: 'wyrd', manual: 3 })).toMatchObject({ models: 10, band: 3 });
    expect(core.sellingSize(ctx(s), { kind: 'wyrd', manual: -5 }).models).toBe(2);
  });

  it('victuals in the stash are counted', () => {
    const s = { ...plain(7), stash: { wyrd: 0, gold: null, items: [{ name: 'Victuals', qty: 3, key: 'Victuals' }] } } as WarbandState;
    expect(core.victualsHeld(ctx(s))).toBe(3);
  });
});

describe('the price the size gives', () => {
  it('a model count and a lowered band give the price of the band', () => {
    const s = plain(14);
    expect(core.priceAt(ctx(s), 3, { models: 14, band: 4 })).toBe(core.WYRD_PRICE[2]![4]);
    expect(core.priceAt(ctx(s), 3, { models: 14, band: 3 })).toBe(core.WYRD_PRICE[2]![3]);
    expect(core.priceAt(ctx(s), 12, { models: 14, band: 0 })).toBe(core.WYRD_PRICE[7]![0]); // 8 and more
  });
});

describe('the Cathayan Merchant refines wyrdstone before it is sold', () => {
  it('1–2 lose 2D6 gc, 3–5 gain 2D6, 6 gain 3D6', () => {
    expect(core.merchantAdjust(1, 7)).toBe(-7);
    expect(core.merchantAdjust(2, 12)).toBe(-12);
    expect(core.merchantAdjust(3, 9)).toBe(9);
    expect(core.merchantAdjust(5, 4)).toBe(4);
    expect(core.merchantAdjust(6, 14)).toBe(14);
  });
  it('is on the roster as a hired sword', () => {
    expect(core.merchantPresent(ctx(band('merc', (s) => ({ ...s, hired: [{ key: 'cathayanmerchant', uid: 'hs1' }] }) as WarbandState)))).toBe(true);
    expect(core.merchantPresent(ctx(band('merc')))).toBe(false);
  });
});

describe('selling with the size and the merchant', () => {
  it('uses the size given, adds the merchant’s change, and records the sale with its origin', () => {
    let s = core.stashAdjust(ctx(plain(14)), 'wyrd', 3);
    const price = core.priceAt(ctx(s), 3, { models: 14, band: 3 });
    s = core.sellWyrdstone(ctx(s), 1, 3, { size: { models: 14, band: 3 }, adjust: { gc: 9, text: 'Cathayan Merchant: +9 gc' } });
    expect(s.stash?.wyrd).toBe(0);
    const pb = (s.campaign as { postbattle: Record<string, { wyrd: core.WyrdSale; finds: { source: string; kind: string; amount: number }[] }> }).postbattle['1']!;
    expect(pb.wyrd).toMatchObject({ done: true, shards: 3, gc: price + 9 });
    expect(pb.finds).toEqual([expect.objectContaining({ kind: 'gold', source: 'wyrdstone', amount: price + 9 })]);
  });

  it('without options it sells as it always did', () => {
    const s0 = core.stashAdjust(ctx(plain(7)), 'wyrd', 2);
    const s = core.sellWyrdstone(ctx(s0), 1, 2);
    expect((s.campaign as { postbattle: Record<string, { wyrd: core.WyrdSale }> }).postbattle['1']!.wyrd.gc).toBe(core.wyrdPrice(ctx(s0), 2));
  });

  it('with the ledger kept the sale is a booking that names its origin; taking it back cancels it', () => {
    let s = core.openLedger(ctx(core.stashAdjust(ctx(plain(7)), 'wyrd', 2)));
    const gold0 = core.goldCurrent(ctx(s));
    s = core.sellWyrdstone(ctx(s), 1, 2);
    expect(core.goldCurrent(ctx(s))).toBe(gold0 + core.wyrdPrice(ctx(s), 2));
    expect(s.ledger!.at(-1)).toMatchObject({ kind: 'adjust', source: 'wyrdstone' });
    const back = core.undoWyrdstoneSale(ctx(s), 1);
    expect(core.goldCurrent(ctx(back))).toBe(gold0);
    expect(core.ledgerBalance(back)).toBe(core.goldCurrent(ctx(back)));
    const pb = (back.campaign as { postbattle: Record<string, { finds?: unknown[] }> }).postbattle['1']!;
    expect(pb.finds ?? []).toEqual([]);
  });
});
