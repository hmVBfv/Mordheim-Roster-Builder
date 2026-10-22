/* Selling from the stash what was typed in by hand (report #31). */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const gold = (s: WarbandState) => core.goldCurrent(ctx(s));

/** A Reikland warband after its first battle. */
function band(): { s: WarbandState } {
  let s = core.newWarband(data, 'merc');
  for (const id of ['capt', 'champ', 'warr']) s = core.addUnit(ctx(s), id);
  s = structuredClone(s);
  s.campaign = { ...s.campaign, on: true, round: 1 };
  return { s };
}

describe('selling from the stash what was typed in by hand', () => {
  /** A band whose stash holds items typed in by name, with no key. */
  function withStash(items: { name: string; qty: number }[]) {
    const { s } = band();
    const t = structuredClone(core.ensureLedger(ctx(s)));
    t.stash = { wyrd: 0, gold: 0, ...t.stash, items };
    return t;
  }

  it('finds an item of the price chart or the lists by its name', () => {
    const s = withStash([{ name: 'Sword', qty: 2 }, { name: 'Familiar', qty: 1 }, { name: 'Moonstone', qty: 1 }]);
    const [sword, familiar, moon] = s.stash!.items!.map((it) => core.stashGoods(ctx(s), it));
    expect(sword).toMatchObject({ key: 'Schwert', rare: false });
    expect(familiar).toMatchObject({ key: 'Vertrauter', rare: true });
    expect(moon).toMatchObject({ key: 'Moonstone', rare: false });
    expect(core.piecesHeld(ctx(s), 'stash', sword!)).toBe(2);
  });

  it('sells at half the price of the item it turns out to be', () => {
    const s = withStash([{ name: 'Sword', qty: 2 }]);
    const g = core.stashGoods(ctx(s), s.stash!.items![0]!);
    const price = core.commonPrice(ctx(s), 'Schwert')!;
    expect(core.sellPrice(ctx(s), g, 2)).toBe(Math.floor((price * 2) / 2));
    const sold = core.sellItem(ctx(s), 'stash', g, { qty: 1 });
    expect(sold.ok).toBe(true);
    expect(sold.state.stash!.items!.reduce((n, it) => n + it.qty, 0)).toBe(1);
    expect(gold(sold.state)).toBe(gold(s) + Math.floor(price / 2));
  });

  it('sells an item the catalogue does not know only for a price that was named', () => {
    const s = withStash([{ name: 'Moonstone', qty: 1 }]);
    const g = core.stashGoods(ctx(s), s.stash!.items![0]!);
    expect(core.sellItem(ctx(s), 'stash', g)).toMatchObject({ ok: false, reason: 'no price is known for it' });
    const sold = core.sellItem(ctx(s), 'stash', g, { price: 12 });
    expect(sold.ok).toBe(true);
    expect(sold.state.stash!.items).toHaveLength(0);
    expect(gold(sold.state)).toBe(gold(s) + 12);
  });
});
