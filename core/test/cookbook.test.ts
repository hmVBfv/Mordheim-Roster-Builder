/* The Halfling cookbook (report #82; Rob, 26.10.2026, from the rare list): +1 to the warband's
   maximum size, not cumulative, on top of a Halfling Scout (+2 together), kept when its carrier
   dies, and not for the Undead and the Carnival of Chaos. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const BOOK = 'Halbling-Kochbuch';

function witchHunters(): WarbandState {
  let s = core.addUnit(ctx(core.newWarband(data, 'wh')), 'capt');
  s = core.addUnit(ctx(s), 'hunter');
  return s;
}
const give = (s: WarbandState, uid: number) => core.addRare(ctx(s), uid, BOOK);

describe('the Halfling cookbook raises the maximum size', () => {
  it('by one, shown as a bonus', () => {
    const s = witchHunters();
    expect(core.warbandMax(ctx(s))).toBe(12);
    const t = give(s, s.models[0]!.uid);
    expect(core.warbandMax(ctx(t))).toBe(13);
    expect(core.warbandMaxBonus(ctx(t))).toBe(1);
  });

  it('not cumulatively: a second book, or one on another warrior, adds nothing', () => {
    let s = witchHunters();
    s = give(give(s, s.models[0]!.uid), s.models[0]!.uid);
    s = give(s, s.models[1]!.uid);
    expect(core.warbandMax(ctx(s))).toBe(13);
  });

  it('together with a Halfling Scout: +2', () => {
    const s0 = witchHunters();
    let s = give(s0, s0.models[0]!.uid);
    s = core.hireHS(ctx(s), 'halfling');
    expect(core.warbandMax(ctx(s))).toBe(14);
    expect(core.warbandMaxBonus(ctx(s))).toBe(2);
  });

  it('is kept when the hero who carried it dies', () => {
    const s0 = witchHunters();
    let s = give(s0, s0.models[1]!.uid);
    s = core.killHero(ctx(s), s.models[1]!.uid);
    expect(s.models.some((m) => m.uid_def === 'hunter')).toBe(false);
    expect(core.warbandMax(ctx(s))).toBe(13);
  });

  it('and when it lies in the stash', () => {
    const s = core.stashAddItem(ctx(witchHunters()), 'Halfling cookbook', 1);
    expect(core.warbandMax(ctx(s))).toBe(13);
  });

  it('but not for the Undead and the Carnival of Chaos', () => {
    for (const [wb, unit] of [['undead', 'vamp'], ['carnival', 'master']] as const) {
      let s = core.addUnit(ctx(core.newWarband(data, wb)), unit);
      const base = core.warbandMax(ctx(s));
      s = core.stashAddItem(ctx(s), 'Halfling cookbook', 1);
      s = give(s, s.models[0]!.uid);
      expect(core.warbandMax(ctx(s))).toBe(base);
    }
  });

  it('a house rule that sets the maximum names no bonus', () => {
    const s0 = witchHunters();
    let s = give(s0, s0.models[0]!.uid);
    s = core.setHouseNum(ctx(s), 'max', 10);
    expect(core.warbandMax(ctx(s))).toBe(10);
  });
});
