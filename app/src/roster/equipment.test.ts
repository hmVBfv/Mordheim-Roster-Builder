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
    // before his first battle no rare item is on offer from the catalogue (#47)
    expect(v.offer).toEqual([]);
  });

  it('a new warband’s heroes have no rare items to search for; only what the warband gives at the start (#47)', () => {
    const { s, capt } = band(0);
    expect(equipmentView(ctx(s), capt)!.offer).toEqual([]);
    // the Dwarf Treasure Hunters start with gromril weapons at the founding price
    let d = createWarband(data, 'dwarftreasure', null, '');
    d = core.addUnit(ctx(d), 'noble');
    const noble = d.models[0]!.uid;
    d = core.toggleEq(ctx(d), noble, 'Schwert', true);
    const dv = equipmentView(ctx(d), noble)!;
    expect(dv.carried.find((r) => r.key === 'Schwert')!.options.map((o) => o.de)).toEqual(['Gromril-Waffe']);
    // the free market opens the catalogue again
    const free = core.setHouseBool(ctx(s), 'freeMarket', true);
    expect(equipmentView(ctx(free), capt)!.offer.length).toBeGreaterThan(20);
    // after the first battle the sheet is gone: the Trading Post takes over
    expect(equipmentView(ctx(band(1).s), band(1).capt)!.offer).toEqual([]);
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
    const item = core.rareEligibleItems(ctx(s), s.models[0]!).find((o) => typeof o.cost === 'number' && !core.isUpgrade(data, o.de))!;
    const withRare = core.addRare(ctx(s), capt, item.de);
    expect(equipmentView(ctx(withRare), capt)!.rare).toEqual([expect.objectContaining({ de: item.de, q: 1, upgrade: false })]);
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

describe('rare items nobody here may carry (#27)', () => {
  // a Reikland warband without a spellcaster: the Familiar is kept for spellcasters
  it('are left out while only what someone here may use is asked for, and listed – marked unusable – when everything is', () => {
    const { s } = band(1);
    expect(rareItems(ctx(s)).some((x) => x.name === 'Familiar')).toBe(false);
    const all = rareItems(ctx(s), true);
    expect(all.find((x) => x.name === 'Familiar')).toMatchObject({ usable: false, rarity: 8 });
    expect(all.find((x) => x.name === 'Barbed whip')).toMatchObject({ usable: false });
    expect(all.length).toBeGreaterThan(rareItems(ctx(s)).length);
    // what can be used is the same either way
    expect(all.filter((x) => x.usable).map((x) => x.de)).toEqual(rareItems(ctx(s)).filter((x) => x.usable).map((x) => x.de));
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

describe('armour is had once (#111)', () => {
  it('the list stops at one helmet, and a rare armour held is neither offered again nor steppable past one', () => {
    const { s, capt } = band(0);
    const one = core.setListQty(ctx(s), capt, 'Helm', 1);
    const row = equipmentView(ctx(one), capt)!.groups.flatMap((g) => g.rows).find((r) => r.key === 'Helm')!;
    expect(row.qty).toBe(1);
    expect(row.more).toBe('one of each kind of armour');
    const rare = core.addRare(ctx(one), capt, 'Gromril-Rüstung');
    const v = equipmentView(ctx(rare), capt)!;
    expect(v.rare.find((r) => r.de === 'Gromril-Rüstung')!.max).toBe(1);
    expect(v.offer.some((o) => o.de === 'Gromril-Rüstung')).toBe(false);
  });
});

describe('weapon upgrades in the sheet (#108, #109, #110, #112, #115)', () => {
  function rangers() {
    let s = createWarband(data, 'dwarfrangers', null, '');
    s = core.addUnit(ctx(s), 'runesmith');
    const uid = s.models[0]!.uid;
    s = core.setEqQty(ctx(s), uid, 'Schwert', 1);
    s = core.setEqQty(ctx(s), uid, 'Dolch (1. gratis)', 2);
    return { s, uid };
  }

  it('every piece he carries has a line of its own, two daggers are two lines, and the free one takes no upgrade (#115)', () => {
    const { s, uid } = rangers();
    const rows = equipmentView(ctx(s), uid)!.carried;
    const daggers = rows.filter((r) => r.key === 'Dolch (1. gratis)');
    expect(daggers).toHaveLength(2);
    expect(daggers[0]).toMatchObject({ free: true, price: 'free', options: [] });
    expect(daggers[1]!.options.map((o) => o.de)).toEqual(['Gromril-Waffe']);
    expect(rows.find((r) => r.key === 'Schwert')!.options).toEqual([{ de: 'Gromril-Waffe', name: 'Gromril weapon', price: 30 }]);
  });

  it('the offer is the price of that weapon, 3× at the founding, not the 4× of later (#108)', () => {
    const { s, uid } = rangers();
    expect(equipmentView(ctx(s), uid)!.carried.find((r) => r.key === 'Dolch (1. gratis)' && !r.free)!.options[0]!.price).toBe(6);
  });

  it('gromril on the sword and on the second dagger: each on its line, the free dagger bare (#110)', () => {
    const { s, uid } = rangers();
    let t = core.setUpgradeOn(ctx(s), uid, 'Gromril-Waffe', 'Schwert', true);
    t = core.setUpgradeOn(ctx(t), uid, 'Gromril-Waffe', 'Dolch (1. gratis)', true);
    const rows = equipmentView(ctx(t), uid)!.carried;
    expect(rows.find((r) => r.key === 'Schwert')!.ups).toMatchObject([{ de: 'Gromril-Waffe', paid: 30 }]);
    const daggers = rows.filter((r) => r.key === 'Dolch (1. gratis)');
    expect(daggers.map((r) => r.ups.length)).toEqual([0, 1]);
    expect(daggers[1]!.ups[0]).toMatchObject({ paid: 6 });
    expect(daggers[1]!.options).toEqual([]);
  });

  it('the Dark Elf blade and Dark venom are on offer on the sword at the founding, the venom as used up (#112)', () => {
    let s = createWarband(data, 'darkelves', null, '');
    s = core.addUnit(ctx(s), 'highborn');
    const uid = s.models[0]!.uid;
    s = core.setEqQty(ctx(s), uid, 'Schwert', 1);
    const sword = equipmentView(ctx(s), uid)!.carried.find((r) => r.key === 'Schwert')!;
    expect(sword.options).toEqual([{ de: 'Dark-Elf-Klinge', name: 'Dark Elf blade', price: 15 }, { de: 'Dunkles Gift', name: 'Dark venom', price: 15 }]);
    const t = core.setUpgradeOn(ctx(s), uid, 'Dunkles Gift', 'Schwert', true);
    expect(equipmentView(ctx(t), uid)!.carried.find((r) => r.key === 'Schwert')!.ups).toMatchObject([{ de: 'Dunkles Gift', once: true, paid: 15 }]);
  });

  it('a weapon put back takes its upgrade with it', () => {
    const { s, uid } = rangers();
    let t = core.setUpgradeOn(ctx(s), uid, 'Gromril-Waffe', 'Schwert', true);
    t = core.setListQty(ctx(t), uid, 'Schwert', 0);
    expect(equipmentView(ctx(t), uid)!.carried.some((r) => r.ups.length > 0)).toBe(false);
  });
});

describe('the free dagger stays (#117)', () => {
  it('its stepper goes no lower than one, and its line in Carried has no way to take it away', () => {
    const { s, capt } = band(0);
    const v = equipmentView(ctx(s), capt)!;
    const row = v.groups.flatMap((g) => g.rows).find((r) => r.key === 'Dolch (1. gratis)')!;
    expect(row).toMatchObject({ qty: 1, min: 1 });
    expect(v.groups.flatMap((g) => g.rows).find((r) => r.key === 'Schwert')!.min).toBe(0);
    expect(v.carried.find((r) => r.key === 'Dolch (1. gratis)')).toMatchObject({ free: true, keep: true });
    const two = core.setListQty(ctx(s), capt, 'Dolch (1. gratis)', 2);
    const daggers = equipmentView(ctx(two), capt)!.carried.filter((r) => r.key === 'Dolch (1. gratis)');
    expect(daggers.map((r) => r.keep)).toEqual([true, false]);
  });
});
