/* What the Sell list shows of a stash typed in by hand (report #31). */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { data } from '../test/data.ts';
import { holdings } from './equipment.ts';
import { createWarband } from './view.ts';

const ctx = (s: WarbandState) => core.ctxOf(data, s);

function band(round: number) {
  let s = createWarband(data, 'merc', null, 'The Grey Company');
  s = core.addUnit(ctx(s), 'capt');
  s = structuredClone(s);
  s.campaign = { ...s.campaign, on: round > 0, round };
  return { s };
}

describe('what the stash holds that was typed in by hand', () => {
  const typed = (items: { name: string; qty: number }[]) => {
    const t = structuredClone(band(1).s);
    t.stash = { wyrd: 0, gold: 0, ...t.stash, items };
    return t;
  };

  it('is on the Sell list, priced like the item it turns out to be', () => {
    const s = typed([{ name: 'Sword', qty: 2 }]);
    const h = holdings(ctx(s)).filter((x) => x.from === 'stash');
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ name: 'Sword', pieces: 2, goods: { key: 'Schwert', rare: false }, unpriced: false });
    expect(h[0]!.sell).toBeGreaterThan(0);
  });

  it('is on the list without a price when the catalogue does not know it', () => {
    const s = typed([{ name: 'Moonstone', qty: 1 }]);
    expect(holdings(ctx(s)).find((x) => x.from === 'stash')).toMatchObject({ name: 'Moonstone', pieces: 1, unpriced: true, sell: 0 });
  });
});
