/* The cards of the Give board (wish #32). */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { data } from '../test/data.ts';
import { giveCards, holdings, stashPaid } from './equipment.ts';
import { createWarband } from './view.ts';

const ctx = (s: WarbandState) => core.ctxOf(data, s);

/** A Reikland warband after its first battle: Captain with a sword, a group of three Warriors. */
function band(round: number) {
  let s = createWarband(data, 'merc', null, 'The Grey Company');
  s = core.addUnit(ctx(s), 'capt');
  s = core.addUnit(ctx(s), 'warr');
  const [capt, warr] = s.models.map((m) => m.uid) as [number, number];
  s = core.toggleEq(ctx(s), capt, 'Schwert', true);
  s = core.setQty(ctx(s), warr, 3);
  s = structuredClone(s);
  s.campaign = { ...s.campaign, on: round > 0, round };
  return { s, capt, warr };
}

describe('the Give board\'s cards (wish #32)', () => {
  it('has a card for every warrior and the stash, with his profile, his rules and what he holds', () => {
    const { s, capt, warr } = band(1);
    const cards = giveCards(ctx(s));
    expect(cards.map((c) => c.holder)).toEqual([capt, warr, 'stash']);
    const captain = cards[0]!;
    expect(captain.type).toBe('Mercenary Captain');
    expect(captain.stats.map((x) => x.key)).toEqual(['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld']);
    expect(captain.rules.length).toBeGreaterThan(0);
    expect(captain.items.map((h) => h.goods.key)).toContain('Schwert');
    expect(cards[1]!.men).toBe(3);
    expect(cards[2]!).toMatchObject({ name: 'Stash', items: [] });
  });

  it('lists the free dagger of a warrior, one per man, marked as free and apart from what can be given (#52)', () => {
    const { s, capt, warr } = band(1);
    const cards = giveCards(ctx(s));
    const free = (uid: number) => cards.find((c) => c.holder === uid)!.items.filter((h) => h.free);
    expect(free(capt).map((h) => [h.name, h.pieces])).toEqual([['Dagger (free)', 1]]);
    expect(free(warr).map((h) => [h.name, h.pieces])).toEqual([['Dagger (free)', 3]]);
    // the tradable holdings do not contain it
    expect(holdings(ctx(s)).some((h) => h.goods.key.includes('gratis'))).toBe(false);
  });
});

describe('what a stash line says it cost (#62)', () => {
  it('shows a price paid, and nothing for an item that cost nothing or has no price', () => {
    expect(stashPaid(37)).toBe('37 gc each');
    expect(stashPaid(0)).toBe('');
    expect(stashPaid(undefined)).toBe('');
  });
});
