/* Trading after the first battle and the gold ledger (V4–V7,
   docs/behaviour-changes.md). New logic: no legacy counterpart, so these
   tests state the rules directly. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { Model, WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const gold = (s: WarbandState) => core.goldCurrent(ctx(s));
const model = (s: WarbandState, uid: number) => s.models.find((m) => m.uid === uid) as Model;
const common = (key: string): core.Goods => ({ key, rare: false });

/** A Reikland warband: Captain with a sword, Champion, three Warriors with
    maces; `round` 1 = after its first battle. */
function band(round = 1, subtype?: string): { s: WarbandState; capt: number; champ: number; warr: number } {
  let s = core.newWarband(data, 'merc');
  if (subtype) s = core.pickSubtype(ctx(s), subtype);
  for (const id of ['capt', 'champ', 'warr']) s = core.addUnit(ctx(s), id);
  const [capt, champ, warr] = s.models.map((m) => m.uid) as [number, number, number];
  s = core.toggleEq(ctx(s), capt, 'Schwert', true);
  s = core.setQty(ctx(s), warr, 3);
  s = core.toggleEq(ctx(s), warr, 'Streitkolben', true);
  s = structuredClone(s);
  s.campaign = { ...s.campaign, on: round > 0, round };
  return { s, capt, champ, warr };
}

/** A rare catalogue item a Captain may carry, with a plain price. */
function rareFor(s: WarbandState, uid: number) {
  return core.rareEligibleItems(ctx(s), model(s, uid)).find((it) => typeof it.cost === 'number' && /Rare \d/.test(it.rare) && !core.isUpgrade(data, it.de))!;
}

describe('the ledger (V7)', () => {
  it('is not kept while the warband is founded', () => {
    const { s } = band(0);
    expect(core.tradeLocked(ctx(s))).toBe(false);
    expect(core.ensureLedger(ctx(s))).toBe(s);
    expect(core.settle(ctx(s), core.addUnit(ctx(s), 'young'), { text: 'x' }).ledger).toBeUndefined();
  });

  it('opens with gold in hand as it stands, once', () => {
    const { s } = band();
    const before = gold(s);
    const l = core.openLedger(ctx(s));
    expect(l.ledger).toEqual([{ id: 1, kind: 'open', amount: before, text: 'Gold in hand when the ledger began', round: 1 }]);
    expect(gold(l)).toBe(before);
    expect(core.openLedger(ctx(l))).toBe(l);
    expect(core.ensureLedger(ctx(s)).ledger).toHaveLength(1);
  });

  it('books what a Roster Builder action cost, with its cause', () => {
    const l = core.openLedger(ctx(band().s));
    const recruited = core.settle(ctx(l), core.addUnit(ctx(l), 'young'), { text: 'Recruited Youngblood' });
    const young = data.WARBANDS.merc!.units.find((u) => u.id === 'young')!;
    expect(recruited.ledger!.at(-1)).toMatchObject({ kind: 'roster', amount: -young.cost, text: 'Recruited Youngblood', round: 1 });
    expect(gold(recruited)).toBe(gold(l) - young.cost);
    expect(core.ledgerBalance(recruited)).toBe(gold(recruited));
    // nothing to book: nothing is added
    expect(core.settle(ctx(l), l, { text: 'nothing' })).toBe(l);
  });

  it('a change of prices no longer moves gold in hand', () => {
    const { s } = band();
    const priced = core.setHouseNum(ctx(s), 'priceAll', 200);
    expect(gold(priced)).not.toBe(gold(s)); // the Roster Builder's formula jumps
    const l = core.openLedger(ctx(s));
    const kept = core.keepGold(ctx(l), core.setHouseNum(ctx(l), 'priceAll', 200));
    expect(gold(kept)).toBe(gold(l));
    expect(kept.ledger).toEqual(l.ledger);
  });

  it('books income and corrections of their own', () => {
    const { s } = band();
    const paid = core.bookGold(ctx(s), 35, { text: 'Income after battle 1' }, 'adjust');
    expect(gold(paid)).toBe(gold(s) + 35);
    expect(paid.ledger!.map((e) => e.kind)).toEqual(['open', 'adjust']);
    expect(core.bookGold(ctx(band(0).s), 5, { text: 'x' })).toEqual(band(0).s);
  });

  it('survives a save, and the Roster Builder still reads the same gold without it', () => {
    const b = band();
    let s = b.s;
    const { capt } = b;
    s = core.buyItem(ctx(s), capt, 'Helm').state;
    const saved = JSON.parse(JSON.stringify(core.exportState(ctx(s)))) as Record<string, unknown>;
    const back = core.loadSave(data, saved);
    expect(back.ok && back.state.ledger).toEqual(s.ledger);
    expect(back.ok && back.notes).toEqual([]);
    expect(back.ok && gold(back.state)).toBe(gold(s));
    const legacy = { ...saved };
    delete legacy.ledger;
    const old = core.loadSave(data, legacy);
    expect(old.ok && gold(old.state)).toBe(gold(s));
  });
});

describe('the Trading Post (V5, V6)', () => {
  it('opens after the first battle; before it the warband buys from its lists', () => {
    const { s, capt } = band(0);
    expect(core.buyItem(ctx(s), capt, 'Helm')).toMatchObject({ ok: false, reason: 'before its first battle the warband buys from its lists' });
    expect(core.sellItem(ctx(s), capt, common('Schwert')).ok).toBe(false);
  });

  it('buys a common item for a Hero, for every man of a group, or for the stash', () => {
    const { s, capt, warr } = band();
    const helm = core.commonPrice(ctx(s), 'Helm')!;
    const hero = core.buyItem(ctx(s), capt, 'Helm');
    expect(model(hero.state, capt).eq!.Helm).toBe(1);
    expect(gold(hero.state)).toBe(gold(s) - helm);
    expect(hero.state.ledger!.at(-1)).toMatchObject({ kind: 'buy', amount: -helm, text: 'Bought Helmet', uid: capt, item: 'Helm', qty: 1 });
    const group = core.buyItem(ctx(s), warr, 'Schild');
    expect(model(group.state, warr).eq!.Schild).toBe(1);
    expect(gold(group.state)).toBe(gold(s) - 3 * core.commonPrice(ctx(s), 'Schild')!);
    const stash = core.buyItem(ctx(s), 'stash', 'Schwert', { qty: 2, price: 9 });
    expect(stash.state.stash!.items).toContainEqual({ name: 'Sword', qty: 2, key: 'Schwert', paid: 9 });
    expect(gold(stash.state)).toBe(gold(s) - 18);
  });

  it('says why a warrior may not carry an item', () => {
    const { s, warr, capt } = band(1, 'midd');
    expect(core.canReceive(ctx(s), warr, common('Langbogen'))).toEqual({ ok: false, reason: 'not in the equipment list of a Warrior' });
    expect(core.canReceive(ctx(s), warr, common('Wolfsumhang'))).toEqual({ ok: false, reason: 'for Heroes only' });
    expect(core.canReceive(ctx(s), capt, common('Wolfsumhang')).ok).toBe(true);
    const reik = band(1, 'reik');
    // the list of a Reikland warband has no wolf cloak at all (it is for Middenheim)
    expect(core.canReceive(ctx(reik.s), reik.capt, common('Wolfsumhang'))).toEqual({ ok: false, reason: 'not in the equipment list of a Mercenary Captain' });
    expect(core.canReceive(ctx(s), 999, common('Helm'))).toEqual({ ok: false, reason: 'not in the roster' });
    expect(core.canReceive(ctx(s), capt, { key: 'Gromril', rare: true }).ok).toBe(false);
  });

  it('sells at half the price that applies now, rounded down, at least 1 gc, a group all together', () => {
    const { s, capt, warr } = band();
    expect(core.sellPrice(ctx(s), common('Schwert'), 1)).toBe(5);
    const mace = core.commonPrice(ctx(s), 'Streitkolben')!;
    expect(mace).toBe(3);
    expect(core.sellPrice(ctx(s), common('Streitkolben'), 1)).toBe(1);
    expect(core.sellPrice(ctx(s), common('Streitkolben'), 3)).toBe(4); // 9 / 2, not 1 + 1 + 1
    const doubled = core.setHouseNum(ctx(s), 'priceAll', 200);
    expect(core.sellPrice(ctx(doubled), common('Schwert'), 1)).toBe(10);
    const sold = core.sellItem(ctx(s), warr, common('Streitkolben'));
    expect(model(sold.state, warr).eq!.Streitkolben).toBeUndefined();
    expect(gold(sold.state)).toBe(gold(s) + 4);
    expect(sold.state.ledger!.at(-1)).toMatchObject({ kind: 'sell', amount: 4, text: 'Sold Mace ×3', qty: 3 });
    const haggled = core.sellItem(ctx(s), capt, common('Schwert'), { price: 7 });
    expect(gold(haggled.state)).toBe(gold(s) + 7);
  });

  it('a warrior keeps his free dagger', () => {
    const { s, capt } = band();
    expect(core.piecesHeld(ctx(s), capt, common('Dolch (1. gratis)'))).toBe(0);
    expect(core.sellItem(ctx(s), capt, common('Dolch (1. gratis)')).ok).toBe(false);
    const two = core.buyItem(ctx(s), capt, 'Dolch (1. gratis)').state;
    expect(core.piecesHeld(ctx(two), capt, common('Dolch (1. gratis)'))).toBe(1);
    const sold = core.sellItem(ctx(two), capt, common('Dolch (1. gratis)')).state;
    expect(model(sold, capt).eq!['Dolch (1. gratis)']).toBe(1);
  });
});

describe('giving equipment (V4)', () => {
  it('moves an item between warriors and the stash without gold', () => {
    const { s, capt, champ } = band();
    const l = core.openLedger(ctx(s));
    const stashed = core.giveItem(ctx(l), capt, 'stash', common('Schwert'));
    expect(stashed.ok).toBe(true);
    expect(model(stashed.state, capt).eq!.Schwert).toBeUndefined();
    expect(stashed.state.stash!.items).toContainEqual({ name: 'Sword', qty: 1, key: 'Schwert', paid: 10 });
    expect(gold(stashed.state)).toBe(gold(l));
    const given = core.giveItem(ctx(stashed.state), 'stash', champ, common('Schwert'));
    expect(model(given.state, champ).eq!.Schwert).toBe(1);
    expect(given.state.stash!.items!.some((it) => it.key === 'Schwert')).toBe(false);
    expect(gold(given.state)).toBe(gold(l));
    expect(given.state.ledger).toEqual(l.ledger);
  });

  it('a rare item keeps what was paid for it', () => {
    const b = band();
    let s = b.s;
    const { capt, champ } = b;
    // an item both Heroes may carry
    const it = core.rareEligibleItems(ctx(s), model(s, capt)).find((x) => /Rare \d/.test(x.rare) && !core.isUpgrade(data, x.de)
      && core.rareEligibleItems(ctx(s), model(s, champ)).some((y) => y.de === x.de))!;
    s = core.recordSearch(ctx(s), capt, it.de, { found: true, paid: 37, to: capt }).state;
    expect(model(s, capt).rare![it.de]).toMatchObject({ q: 1, paid: 37 });
    const before = gold(s);
    const given = core.giveItem(ctx(s), capt, champ, { key: it.de, rare: true });
    expect(given.ok).toBe(true);
    expect(model(given.state, champ).rare![it.de]).toMatchObject({ q: 1, paid: 37 });
    expect(gold(given.state)).toBe(before);
    const stashed = core.giveItem(ctx(s), capt, 'stash', { key: it.de, rare: true }).state;
    expect(stashed.stash!.items).toContainEqual({ name: it.en, qty: 1, key: it.de, rare: true, paid: 37 });
    expect(gold(stashed)).toBe(before);
  });

  it('a group takes an item only with one for each man, and gives it up for all', () => {
    const b = band();
    let s = b.s;
    const { capt, warr } = b;
    s = core.buyItem(ctx(s), 'stash', 'Schild', { qty: 2 }).state;
    expect(core.giveItem(ctx(s), 'stash', warr, common('Schild'))).toMatchObject({ ok: false, reason: 'the group needs 3, one for each man; the stash has 2' });
    s = core.buyItem(ctx(s), 'stash', 'Schild').state;
    s = core.giveItem(ctx(s), 'stash', warr, common('Schild')).state;
    expect(model(s, warr).eq!.Schild).toBe(1);
    expect(core.piecesHeld(ctx(s), 'stash', common('Schild'))).toBe(0);
    // from the group to the Captain: all three come off, he takes one, two go to the stash
    const before = gold(s);
    s = core.giveItem(ctx(s), warr, capt, common('Schild')).state;
    expect(model(s, warr).eq!.Schild).toBeUndefined();
    expect(model(s, capt).eq!.Schild).toBe(1);
    expect(core.piecesHeld(ctx(s), 'stash', common('Schild'))).toBe(2);
    expect(gold(s)).toBe(before);
  });

  it('refuses before the first battle, and to whom may not carry it', () => {
    const f = band(0);
    expect(core.giveItem(ctx(f.s), f.capt, f.champ, common('Schwert')).ok).toBe(false);
    const { s, capt, warr } = band();
    expect(core.giveItem(ctx(s), capt, warr, common('Langbogen')).ok).toBe(false);
    expect(core.giveItem(ctx(s), capt, capt, common('Schwert'))).toMatchObject({ ok: false, reason: 'it is there already' });
  });
});

describe('searching for rare items (V5)', () => {
  it('needs the rarity on 2D6, less the modifiers', () => {
    expect(core.chance2d6(2)).toBe(1);
    expect(core.chance2d6(7)).toBeCloseTo(21 / 36);
    expect(core.chance2d6(12)).toBeCloseTo(1 / 36);
    expect(core.chance2d6(13)).toBe(0);
    const b = band(1, 'mari');
    let s = b.s;
    const { capt } = b;
    const it = rareFor(s, capt);
    const r = core.rarityOf(ctx(s), it.de)!;
    expect(core.searchOdds(ctx(s), capt, it.de)).toMatchObject({ rarity: r, target: r - 1, modifiers: [{ label: 'Marienburg', value: 1 }] });
    s = core.addSkill(ctx(s), capt, 'Streetwise');
    expect(core.searchOdds(ctx(s), capt, it.de, 1)!.target).toBe(r - 4);
    expect(core.searchOdds(ctx(s), capt, 'Schwert')).toBeNull();
  });

  it('Kurgan are difficult customers – except for a Great Axe', () => {
    let s = core.newWarband(data, 'maraudersofchaos');
    s = core.pickSubtype(ctx(s), 'kurgan');
    s = core.addUnit(ctx(s), data.WARBANDS.maraudersofchaos!.units[0]!.id);
    const uid = s.models[0]!.uid;
    const whip = core.searchModifiers(ctx(s), uid, 'Barbed Whip');
    expect(whip).toEqual([]);
    const other = data.CATALOG.find((x) => /Rare/.test(x.rare) && x.en !== 'Great axe' && x.en !== 'Barbed whip')!;
    expect(core.searchModifiers(ctx(s), uid, other.de).map((x) => x.value)).toEqual([-1]);
  });

  it('one roll per Hero after a battle; a find is paid and stored', () => {
    const { s, capt, warr } = band();
    const it = rareFor(s, capt);
    expect(core.searchBlock(ctx(s), warr)).toBe('only Heroes search for rare items');
    const miss = core.recordSearch(ctx(s), capt, it.de, { found: false });
    expect(miss.state.ledger!.at(-1)).toMatchObject({ kind: 'search', amount: 0, found: false, uid: capt });
    expect(gold(miss.state)).toBe(gold(s));
    expect(core.searchBlock(ctx(miss.state), capt)).toBe('he has searched after this battle already');
    const next = structuredClone(miss.state);
    next.campaign!.round = 2;
    expect(core.searchBlock(ctx(next), capt)).toBeNull();
    const found = core.recordSearch(ctx(s), capt, it.de, { found: true, paid: 40 });
    expect(found.state.stash!.items).toContainEqual({ name: it.en, qty: 1, key: it.de, rare: true, paid: 40 });
    expect(gold(found.state)).toBe(gold(s) - 40);
  });
});

describe('leaving the warband', () => {
  it('before the first battle a dismissed warrior brings his gold back', () => {
    const { s, capt } = band(0);
    const out = core.dismissWarrior(ctx(s), capt);
    expect(gold(out)).toBe(gold(core.removeUnit(ctx(s), capt)));
    expect(gold(out)).toBeGreaterThan(gold(s));
  });

  it('afterwards his equipment goes to the stash and nothing is refunded', () => {
    const { s, capt } = band();
    const l = core.openLedger(ctx(s));
    const out = core.dismissWarrior(ctx(l), capt);
    expect(out.models.some((m) => m.uid === capt)).toBe(false);
    expect(out.stash!.items).toContainEqual({ name: 'Sword', qty: 1, key: 'Schwert', paid: 10 });
    expect(gold(out)).toBe(gold(l));
  });

  it('a man who leaves a group leaves his share of its equipment', () => {
    const { s, warr } = band();
    const l = core.openLedger(ctx(s));
    const out = core.dismissMan(ctx(l), warr, 0);
    expect(model(out, warr).qty).toBe(2);
    expect(out.stash!.items).toContainEqual({ name: 'Mace', qty: 1, key: 'Streitkolben', paid: 3 });
    expect(gold(out)).toBe(gold(l));
  });

  it('a dismissed Hired Sword takes his fee with him', () => {
    let { s } = band(0);
    s = core.hireHS(ctx(s), 'ogre');
    s = structuredClone(s);
    s.campaign = { ...s.campaign, on: true, round: 1 };
    const uid = s.hired![0]!.uid;
    const l = core.openLedger(ctx(s));
    const out = core.dismissHire(ctx(l), uid, 'hs');
    expect(out.hired).toEqual([]);
    expect(gold(out)).toBe(gold(l));
  });
});

describe('purity', () => {
  it('leaves frozen inputs untouched', () => {
    const { s, capt, warr } = band();
    const frozen = structuredClone(s);
    const deepFreeze = (v: unknown): void => { if (v && typeof v === 'object') { Object.freeze(v); for (const x of Object.values(v)) deepFreeze(x); } };
    deepFreeze(frozen);
    const it = rareFor(s, capt);
    expect(() => {
      core.buyItem(ctx(frozen), capt, 'Helm');
      core.sellItem(ctx(frozen), warr, common('Streitkolben'));
      core.giveItem(ctx(frozen), capt, 'stash', common('Schwert'));
      core.recordSearch(ctx(frozen), capt, it.de, { found: true, paid: 30 });
      core.dismissWarrior(ctx(frozen), capt);
      core.dismissMan(ctx(frozen), warr, 1);
      core.keepGold(ctx(frozen), core.setHouseNum(ctx(frozen), 'priceAll', 150));
    }).not.toThrow();
  });
});
