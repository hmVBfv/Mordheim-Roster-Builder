/* Letting one man of a henchman group go (new in the app; the Roster
   Builder could only shrink a group from its end). */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { Model, WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

/** A Reikland warband with one group of `n` Warriors; `exp` above a fresh recruit's. */
function group(n: number, names?: string[], exp = 0): { s: WarbandState; uid: number } {
  let s = core.addUnit(ctx(core.newWarband(data, 'merc')), 'warr');
  const uid = s.models[0]!.uid;
  s = core.setModelExp(ctx(s), uid, exp);
  s = core.setQty(ctx(s), uid, n);
  names?.forEach((nm, i) => { s = core.setMemberName(ctx(s), uid, i, nm); });
  return { s, uid };
}
const model = (s: WarbandState, uid: number) => s.models.find((m) => m.uid === uid) as Model;

describe('dismissMember', () => {
  it('takes the chosen man and his name; the others keep theirs', () => {
    const { s, uid } = group(3, ['Anton', 'Bruno', 'Carl']);
    const after = core.dismissMember(ctx(s), uid, 1);
    expect(model(after, uid).qty).toBe(2);
    expect(core.memberNames(ctx(after), model(after, uid))).toEqual(['Anton', 'Carl']);
  });

  it('an unnamed man goes without touching the names of the others', () => {
    const { s, uid } = group(4, ['Anton', 'Bruno']);
    const after = core.dismissMember(ctx(s), uid, 3);
    const m = model(after, uid);
    expect(m.qty).toBe(3);
    expect([0, 1, 2].map((i) => core.memberNamed(m, i))).toEqual([true, true, false]);
    expect(core.memberNames(ctx(after), m).slice(0, 2)).toEqual(['Anton', 'Bruno']);
  });

  it('refunds the experience surcharge for one man, as making the group smaller does', () => {
    const { s, uid } = group(3, undefined, 4);
    const paid = Number(model(s, uid).xpPaid);
    expect(paid).toBe(2 * 2 * 4); // two men joined a group with 4 experience: 2 gc per point each
    const after = core.dismissMember(ctx(s), uid, 0);
    expect(model(after, uid).xpPaid).toBe(paid - 2 * 4);
    expect(core.goldCurrent(ctx(after))).toBe(core.goldCurrent(ctx(core.setQty(ctx(s), uid, 2))));
  });

  it('does nothing for the last man, a hero, or an index outside the group', () => {
    const one = group(1);
    expect(core.dismissMember(ctx(one.s), one.uid, 0)).toBe(one.s);
    const three = group(3);
    expect(core.dismissMember(ctx(three.s), three.uid, 3)).toBe(three.s);
    expect(core.dismissMember(ctx(three.s), three.uid, -1)).toBe(three.s);
    expect(core.dismissMember(ctx(three.s), 999, 0)).toBe(three.s);
    const hero = core.addUnit(ctx(core.newWarband(data, 'merc')), 'capt');
    expect(core.dismissMember(ctx(hero), hero.models[0]!.uid, 0)).toBe(hero);
  });

  it('leaves its input untouched', () => {
    const { s, uid } = group(3, ['Anton', 'Bruno', 'Carl']);
    const before = JSON.stringify(s);
    core.dismissMember(ctx(s), uid, 0);
    expect(JSON.stringify(s)).toBe(before);
  });
});
