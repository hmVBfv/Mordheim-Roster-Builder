/* Rob, 13.11.2026: an item of an equipment list with dice in its price (the Masters of Horror's Chainsaw Sword, 15 + D6 gc) takes the total paid for
   each piece – only within what the dice allow – or a roll; until it is entered it counts at its base price, as the old app counts it. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const SWORD = 'Chainsaw Sword', PISTOL = 'Repeater Pistol (Masters of Horror)';

function hero() {
  let s = core.newWarband(data, 'mastersofhorror');
  for (const u of data.WARBANDS.mastersofhorror!.units.filter((x) => x.req)) s = core.addUnit(ctx(s), u.id);
  const m = s.models.find((x) => x.uid_def === data.WARBANDS.mastersofhorror!.units.find((x) => x.req)!.id)!;
  return { s, uid: m.uid };
}
const cost = (s: WarbandState, uid: number) => core.eqCost(ctx(s), s.models.find((m) => m.uid === uid)!);
const paid = (s: WarbandState, uid: number, nm: string) => s.models.find((m) => m.uid === uid)!.eqPaid?.[nm];

describe('dice prices in an equipment list', () => {
  it('knows the range of a row: the base and what the dice add', () => {
    expect(core.dicePrice(15, { dice: 'D6' })).toEqual({ dice: 1, min: 16, max: 21 });
    expect(core.dicePrice(25, { dice: '3D6' })).toEqual({ dice: 3, min: 28, max: 43 });
    expect(core.dicePrice(15, {})).toBeNull();
    expect(core.dicePrice(15, { dice: 'D8' })).toBeNull();
  });

  it('counts a piece at its base price until a price is entered', () => {
    const h = hero(); const uid = h.uid; let s = h.s;
    s = core.setEqQty(ctx(s), uid, SWORD, 1);
    expect(cost(s, uid)).toBe(15);
    s = core.setListPaid(ctx(s), uid, SWORD, 0, 19);
    expect(cost(s, uid)).toBe(19);
    expect(paid(s, uid, SWORD)).toEqual([19]);
  });

  it('takes only a total the dice allow: a lower or higher one is brought into the range, and a roll is the interface’s number', () => {
    const h = hero(); const uid = h.uid; let s = h.s;
    s = core.setEqQty(ctx(s), uid, SWORD, 1);
    expect(paid(core.setListPaid(ctx(s), uid, SWORD, 0, 3), uid, SWORD)).toEqual([16]);
    expect(paid(core.setListPaid(ctx(s), uid, SWORD, 0, 99), uid, SWORD)).toEqual([21]);
    expect(paid(core.setListPaid(ctx(s), uid, SWORD, 0, '17.4'), uid, SWORD)).toEqual([17]);
    s = core.setEqQty(ctx(s), uid, PISTOL, 1);
    expect(paid(core.setListPaid(ctx(s), uid, PISTOL, 0, 40), uid, PISTOL)).toEqual([40]);
    expect(paid(core.setListPaid(ctx(s), uid, PISTOL, 0, 10), uid, PISTOL)).toEqual([28]);
  });

  it('keeps the price with its piece: a second piece comes at the base price, a lost one takes its price with it', () => {
    const h = hero(); const uid = h.uid; let s = h.s;
    s = core.setEqQty(ctx(s), uid, SWORD, 2);
    s = core.setListPaid(ctx(s), uid, SWORD, 1, 20);
    // the first piece had no price: it is fixed at its base so that the number stays with the second
    expect(paid(s, uid, SWORD)).toEqual([15, 20]);
    expect(cost(s, uid)).toBe(35);
    s = core.setEqQty(ctx(s), uid, SWORD, 1);
    expect(paid(s, uid, SWORD)).toEqual([15]);
    s = core.setEqQty(ctx(s), uid, SWORD, 0);
    expect(paid(s, uid, SWORD)).toBeUndefined();
    expect(s.models.find((m) => m.uid === uid)!.eqPaid).toBeUndefined();
  });

  it('refuses what is not there: a piece that does not exist, an item without dice, an item the unit has not', () => {
    const h = hero(); const uid = h.uid; let s = h.s;
    s = core.setEqQty(ctx(s), uid, SWORD, 1);
    s = core.setEqQty(ctx(s), uid, 'Schwert', 1);
    for (const [nm, i] of [[SWORD, 1], [SWORD, -1], [SWORD, 0.5], ['Schwert', 0], ['Nonsense', 0], [PISTOL, 0]] as [string, number][]) {
      expect(core.setListPaid(ctx(s), uid, nm, i, 18)).toBe(s);
    }
    expect(core.setListPaid(ctx(s), 9999, SWORD, 0, 18)).toBe(s);
  });

  it('is saved and loaded with the model', () => {
    const h = hero(); const uid = h.uid; let s = h.s;
    s = core.setEqQty(ctx(s), uid, SWORD, 1);
    s = core.setListPaid(ctx(s), uid, SWORD, 0, 18);
    const back = core.loadSave(data, JSON.parse(JSON.stringify(s)));
    expect(back.ok).toBe(true);
    if (back.ok) expect(paid(back.state, uid, SWORD)).toEqual([18]);
  });
});
