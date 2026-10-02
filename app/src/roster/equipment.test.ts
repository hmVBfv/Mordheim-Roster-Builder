/* What the equipment screens show (phase 3b), and how an edit reaches the
   gold ledger after the first battle. */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { data } from '../test/data.ts';
import { buyRecipients, equipmentView, giveRecipients, holdings, ledgerLines, rareItems, searchers, shopItems } from './equipment.ts';
import { applyEdit } from './useEditor.ts';
import { createWarband } from './view.ts';

const ctx = (s: WarbandState) => core.ctxOf(data, s);

/** A Reikland warband: Captain with a sword, a group of three Warriors;
    `round` 1 = after its first battle. */
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

describe('a warrior\'s list while the warband is founded', () => {
  it('shows every item of his list with its price and how many he has', () => {
    const { s, capt } = band(0);
    const v = equipmentView(ctx(s), capt)!;
    expect(v.groups.map((g) => g.label)).toEqual(['Close combat', 'Missile weapons', 'Armour']);
    const sword = v.groups[0]!.rows.find((r) => r.key === 'Schwert')!;
    expect(sword).toMatchObject({ name: 'Sword', price: 10, qty: 1, free: false });
    expect(v.groups[0]!.rows.find((r) => r.free)).toMatchObject({ key: 'Dolch (1. gratis)', qty: 1 });
    expect(v.men).toBe(1);
    expect(v.offer.length).toBeGreaterThan(0);
    expect(v.offer.every((o) => o.name)).toBe(true);
  });

  it('a group pays for every man, and sees no Heroes-only items', () => {
    let s = createWarband(data, 'merc', 'midd', '');
    s = core.addUnit(ctx(s), 'capt');
    s = core.addUnit(ctx(s), 'warr');
    s = core.setQty(ctx(s), s.models[1]!.uid, 2);
    const captList = equipmentView(ctx(s), s.models[0]!.uid)!.groups.flatMap((g) => g.rows.map((r) => r.key));
    const warrList = equipmentView(ctx(s), s.models[1]!.uid)!.groups.flatMap((g) => g.rows.map((r) => r.key));
    expect(captList).toContain('Wolfsumhang');
    expect(warrList).not.toContain('Wolfsumhang');
    expect(equipmentView(ctx(s), s.models[1]!.uid)!.men).toBe(2);
  });

  it('lists rare items held, with what was paid', () => {
    const { s, capt } = band(0);
    const offer = equipmentView(ctx(s), capt)!.offer.find((o) => /gc$/.test(o.price))!;
    const withRare = core.addRare(ctx(s), capt, offer.de);
    expect(equipmentView(ctx(withRare), capt)!.rare).toEqual([expect.objectContaining({ de: offer.de, q: 1, upgrade: false })]);
  });
});

describe('the Trading Post', () => {
  it('sells common items of the warband\'s lists, each once, at today\'s price', () => {
    const { s } = band(1);
    const shop = shopItems(ctx(s));
    expect(shop.find((x) => x.key === 'Schwert')).toMatchObject({ name: 'Sword', price: 10, kind: 'cc' });
    expect(new Set(shop.map((x) => x.key)).size).toBe(shop.length);
    // rare items of the lists are found by searching, also where the list names them differently
    expect(shop.map((x) => x.key)).not.toContain('Pistole');
    expect(shop.map((x) => x.key)).not.toContain('Jagdgewehr');
    expect(shop.every((x) => !x.unlisted)).toBe(true);
    const doubled = core.setHouseNum(ctx(s), 'priceAll', 200);
    expect(shopItems(ctx(doubled)).find((x) => x.key === 'Schwert')!.price).toBe(20);
  });

  it('tells who may take what, and what a group pays', () => {
    const { s, capt, warr } = band(1);
    const rec = buyRecipients(ctx(s), 'Schild', 5);
    expect(rec[0]).toMatchObject({ to: 'stash', ok: true });
    expect(rec.find((r) => r.to === capt)).toMatchObject({ ok: true, cost: 5 });
    expect(rec.find((r) => r.to === warr)).toMatchObject({ ok: true, cost: 15, note: '3 men: 15 gc' });
    expect(buyRecipients(ctx(s), 'Langbogen', 15).find((r) => r.to === warr)).toMatchObject({ ok: false, note: 'not in the equipment list of a Warrior' });
  });

  it('lists what can be sold or given, the free dagger not', () => {
    const { s, capt } = band(1);
    const h = holdings(ctx(s));
    expect(h.map((x) => `${x.owner}:${x.name}:${x.pieces}:${x.sell}`)).toEqual(['Mercenary Captain:Sword:1:5']);
    const rec = giveRecipients(ctx(s), h[0]!);
    expect(rec[0]).toMatchObject({ to: 'stash', ok: true });
    // the group would need three swords
    expect(rec.find((r) => r.to !== 'stash' && r.to !== capt)).toMatchObject({ ok: false, note: 'the group needs 3, one for each man – only 1 here' });
  });

  it('shows who may search, and after a search what came of it', () => {
    const { s, capt } = band(1);
    expect(searchers(ctx(s))).toEqual([{ uid: capt, name: 'Mercenary Captain', why: null, last: null }]);
    const item = rareItems(ctx(s)).find((x) => x.usable && x.fixed != null)!;
    const looked = core.recordSearch(ctx(s), capt, item.de, { found: false }).state;
    expect(searchers(ctx(looked))[0]).toMatchObject({ why: 'he has searched after this battle already', last: `Mercenary Captain looked for ${item.name} – not found` });
    expect(ledgerLines(looked).map((l) => [l.amount, l.when])).toEqual([[core.goldCurrent(ctx(s)), 'After battle 1'], [0, 'After battle 1']]);
  });

  it('offers the rare items this warband may find', () => {
    const { s } = band(1);
    const items = rareItems(ctx(s));
    expect(items.length).toBeGreaterThan(20);
    expect(items.every((x) => x.rarity >= 2)).toBe(true);
    // kept for another warband: not offered
    expect(items.some((x) => x.name === 'Barbed whip')).toBe(false);
  });
});

describe('an edit after the first battle', () => {
  it('before it: the Roster Builder\'s action alone, no ledger', () => {
    const { s } = band(0);
    const next = applyEdit(data, s, (c) => core.addUnit(c, 'young'), 'Recruited Youngblood');
    expect(next.ledger).toBeUndefined();
    expect(applyEdit(data, s, (c) => c.s)).toBe(s);
  });

  it('afterwards: the ledger opens and the cost is booked under the notice', () => {
    const { s } = band(1);
    const next = applyEdit(data, s, (c) => core.addUnit(c, 'young'), 'Recruited Youngblood (15 gc).');
    expect(next.ledger!.map((e) => [e.kind, e.amount, e.text])).toEqual([
      ['open', core.goldCurrent(ctx(s)), 'Gold in hand when the ledger began'],
      ['roster', -15, 'Recruited Youngblood (15 gc).'],
    ]);
    // a price house rule keeps gold in hand
    const priced = applyEdit(data, next, (c) => core.setHouseNum(c, 'priceAll', 200), undefined, { gold: 'keep' });
    expect(core.goldCurrent(ctx(priced))).toBe(core.goldCurrent(ctx(next)));
    // nothing changed: nothing opened, nothing saved
    expect(applyEdit(data, s, (c) => c.s)).toBe(s);
  });
});
