/* Orc Mob (report #46; mordheimer.net, Orc Mob, "Choice of Warriors"): any
   number of Goblin Warriors, but at most two for each Orc in the warband
   (Orc Heroes included); up to five Cave Squigs, never more than the Goblins.
   The limits are recruiting limits: they refuse a recruit and warn when the
   Orcs are fewer than the Goblins need. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const count = (s: WarbandState, id: string) => core.modelsOf(ctx(s), id);
const status = (s: WarbandState, id: string) => core.recruitStatus(ctx(s), id)!;

/** A Boss with `boyz` Orc Boyz. */
function mob(boyz: number): WarbandState {
  let s = core.addUnit(ctx(core.newWarband(data, 'orcmob')), 'boss');
  if (boyz > 0) {
    s = core.addUnit(ctx(s), 'boyz');
    s = core.setQty(ctx(s), s.models.find((m) => m.uid_def === 'boyz')!.uid, boyz);
  }
  return s;
}
const goblins = (s: WarbandState, n: number) => {
  let t = s.models.some((m) => m.uid_def === 'goblin') ? s : core.addUnit(ctx(s), 'goblin');
  t = core.setQty(ctx(t), t.models.find((m) => m.uid_def === 'goblin')!.uid, n);
  return t;
};

describe('Goblin Warriors: at most two for each Orc', () => {
  it('a Boss alone may have two Goblins', () => {
    const s = mob(0);
    expect(status(s, 'goblin')).toMatchObject({ max: 2, limit: '0–2', atMax: false });
    expect(count(goblins(s, 5), 'goblin')).toBe(2);
  });

  it('every Orc counts, Heroes and Boyz alike; Goblins, Squigs and Trolls do not', () => {
    let s = mob(3);                                    // Boss + 3 Boyz = 4 Orcs
    s = core.addUnit(ctx(s), 'shaman');                // 5
    expect(status(s, 'goblin').max).toBe(10);
    s = core.addUnit(ctx(s), 'troll');
    s = goblins(s, 5);
    expect(status(s, 'goblin').max).toBe(10);
    expect(count(s, 'goblin')).toBe(5);
  });

  it('refuses a recruit at the limit, and offers no new group', () => {
    let s = mob(0);
    s = goblins(s, 2);
    expect(status(s, 'goblin').atMax).toBe(true);
    expect(core.addUnit(ctx(s), 'goblin')).toBe(s);
  });

  it('warns when the Orcs go and leave too many Goblins', () => {
    let s = mob(2);                                    // 3 Orcs, up to 6 Goblins
    s = goblins(s, 5);
    expect(core.warbandWarnings(ctx(s)).some((w) => /Goblin/.test(w))).toBe(false);
    s = core.removeUnit(ctx(s), s.models.find((m) => m.uid_def === 'boyz')!.uid);   // 1 Orc: 2 Goblins
    expect(core.warbandWarnings(ctx(s))).toContain('Too many Goblin (max. 2).');
  });
});

describe('Cave Squigs: up to five, never more than the Goblins', () => {
  it('no Goblin, no Squig', () => {
    const s = mob(4);
    expect(status(s, 'squig')).toMatchObject({ max: 0, atMax: true });
    expect(core.addUnit(ctx(s), 'squig')).toBe(s);
  });

  it('as many as the Goblins, and not past five', () => {
    let s = goblins(mob(4), 3);                       // 5 Orcs, 3 Goblins
    expect(status(s, 'squig').max).toBe(3);
    s = core.addUnit(ctx(s), 'squig');
    s = core.setQty(ctx(s), s.models.find((m) => m.uid_def === 'squig')!.uid, 5);
    expect(count(s, 'squig')).toBe(3);
    s = goblins(s, 5);
    expect(status(s, 'squig').max).toBe(5);
    s = core.setQty(ctx(s), s.models.find((m) => m.uid_def === 'squig')!.uid, 5);
    expect(count(s, 'squig')).toBe(5);
    s = goblins(s, 4);
    s = goblins(s, 4);
    expect(core.warbandWarnings(ctx(s))).toContain('Too many Cave Squig (max. 4).');
  });
});

describe('other warbands and units keep their limits', () => {
  it('Orc Boyz and the Troll are as before', () => {
    const s = mob(2);
    expect(status(s, 'boyz')).toMatchObject({ max: null, limit: 'any' });
    expect(status(s, 'troll')).toMatchObject({ max: 1 });
  });
});
