/* The warband duties phase (Rob, 14.11.2026): rules that ask for a choice after each battle, with consequences – the Troll's "Always Hungry"
   of the Black Orcs, the Orc Mob and the Night Goblins. At the maximum the Troll cannot count as two members: pay, or let someone go first. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

function orcs(wb = 'blackorcs', fill = 0): { s: WarbandState; troll: number } {
  let s = { ...core.newWarband(data, wb), budget: 5000, campaign: { on: true, round: 1, districts: {} } } as WarbandState;
  for (const u of data.WARBANDS[wb]!.units.filter((x) => x.req)) s = core.addUnit(ctx(s), u.id);
  const trollId = data.WARBANDS[wb]!.units.find((u) => /troll/i.test(u.name))!.id;
  s = core.addUnit(ctx(s), trollId);
  // fill the warband up to `fill` models with henchmen (set directly: the group limits of the roster do not matter here)
  if (fill) {
    const boyz = data.WARBANDS[wb]!.units.find((u) => u.t === 'hen' && u.id !== trollId)!;
    s = core.addUnit(ctx(s), boyz.id);
    const others = core.totalModels(ctx(s)) - (s.models.find((m) => m.uid_def === boyz.id)!.qty ?? 1);
    s = { ...s, models: s.models.map((m) => (m.uid_def === boyz.id ? { ...m, qty: Math.max(1, fill - others) } : m)) };
  }
  s = core.openLedger(ctx(s));
  return { s, troll: s.models.find((m) => m.uid_def === trollId)!.uid };
}
const rec = (s: WarbandState) => (s.campaign as { postbattle?: Record<string, { duties?: { resolved: { id: string; option: string; gc: number }[]; done?: boolean }; finds?: { source: string; amount?: number }[] }> }).postbattle?.['1'];

describe('which duties are due', () => {
  it('the Troll of the Black Orcs, with his three ways out', () => {
    const { s, troll } = orcs();
    const [d] = core.dutiesDue(ctx(s), 1);
    expect(d).toMatchObject({ id: 'always-hungry-blackorcs', uid: troll, resolved: null });
    expect(d!.options.map((o) => [o.id, o.gc, o.available])).toEqual([['pay', 20, true], ['double', 5, true], ['leave', 0, true]]);
  });

  it('nothing for a warband without such a rule, or without the Troll', () => {
    expect(core.dutiesDue(ctx(core.newWarband(data, 'merc')), 1)).toEqual([]);
    let s = { ...core.newWarband(data, 'blackorcs'), campaign: { on: true, round: 1, districts: {} } } as WarbandState;
    for (const u of data.WARBANDS.blackorcs!.units.filter((x) => x.req)) s = core.addUnit(ctx(s), u.id);
    expect(core.dutiesDue(ctx(s), 1)).toEqual([]);
  });

  it('the Orc Mob and the Night Goblins: 15 gc, or two Goblins or Cave Squigs are sacrificed, or he wanders off', () => {
    for (const wb of ['orcmob', 'nightgoblins']) {
      const { s } = orcs(wb);
      const d = core.dutiesDue(ctx(s), 1)[0]!;
      expect(d.id, wb).toBe(`always-hungry-${wb}`);
      expect(d.options.map((o) => [o.id, o.gc]), wb).toEqual([['pay', 15], ['sacrifice', 0], ['leave', 0]]);
    }
  });
});

describe('paying', () => {
  it('takes the gold with its origin and records the choice with a find', () => {
    const { s } = orcs();
    const before = core.goldCurrent(ctx(s));
    const t = core.resolveDuty(ctx(s), 1, 'always-hungry-blackorcs', 'pay');
    expect(core.goldCurrent(ctx(t))).toBe(before - 20);
    expect(rec(t)!.duties!.resolved).toEqual([{ id: 'always-hungry-blackorcs', option: 'pay', gc: 20 }]);
    expect(rec(t)!.finds).toEqual([expect.objectContaining({ kind: 'gold', source: 'duty:always-hungry-blackorcs', amount: -20 })]);
    expect(t.ledger!.at(-1)).toMatchObject({ amount: -20, source: 'duty:always-hungry-blackorcs' });
  });

  it('is decided once; taking it back gives the gold back and asks again', () => {
    const { s } = orcs();
    const t = core.resolveDuty(ctx(s), 1, 'always-hungry-blackorcs', 'pay');
    expect(core.resolveDuty(ctx(t), 1, 'always-hungry-blackorcs', 'pay')).toBe(t);
    const back = core.undoDuty(ctx(t), 1, 'always-hungry-blackorcs');
    expect(core.goldCurrent(ctx(back))).toBe(core.goldCurrent(ctx(s)));
    expect(core.dutiesDue(ctx(back), 1)[0]!.resolved).toBeNull();
  });
});

describe('counting as two members', () => {
  it('costs 5 gc and the Troll counts twice for the warband’s maximum from then on', () => {
    const { s, troll } = orcs();
    const n = core.totalModels(ctx(s));
    const t = core.resolveDuty(ctx(s), 1, 'always-hungry-blackorcs', 'double');
    expect(t.models.find((m) => m.uid === troll)!.countsTwo).toBe(true);
    expect(core.totalModels(ctx(t))).toBe(n + 1);
    expect(core.goldCurrent(ctx(t))).toBe(core.goldCurrent(ctx(s)) - 5);
  });

  it('at the maximum it is not available: the warband would exceed it – pay, or let someone go first', () => {
    const { s } = orcs('blackorcs', 12);
    expect(core.totalModels(ctx(s))).toBe(core.warbandMax(ctx(s)));
    const d = core.dutiesDue(ctx(s), 1)[0]!;
    const dbl = d.options.find((o) => o.id === 'double')!;
    expect(dbl.available).toBe(false);
    expect(dbl.why).toMatch(/maximum/i);
    expect(core.resolveDuty(ctx(s), 1, 'always-hungry-blackorcs', 'double')).toBe(s);
    // somebody is let go: now there is room
    const boyz = s.models.find((m) => m.uid_def === 'boyz')!;
    const freed = core.dismissMan(ctx(s), boyz.uid, 0);
    expect(core.dutiesDue(ctx(freed), 1)[0]!.options.find((o) => o.id === 'double')!.available).toBe(true);
  });

  it('taking it back removes the double count', () => {
    const { s, troll } = orcs();
    const t = core.resolveDuty(ctx(s), 1, 'always-hungry-blackorcs', 'double');
    const back = core.undoDuty(ctx(t), 1, 'always-hungry-blackorcs');
    expect(back.models.find((m) => m.uid === troll)!.countsTwo).toBeFalsy();
    expect(core.totalModels(ctx(back))).toBe(core.totalModels(ctx(s)));
  });

  it('is counted when wyrdstone is sold, as the rule says the Troll counts as two members', () => {
    const { s } = orcs();
    const t = core.resolveDuty(ctx(s), 1, 'always-hungry-blackorcs', 'double');
    expect(core.sellingSize(ctx(t), { kind: 'wyrd' }).lines.map((l) => l.id)).toContain('troll');
    expect(core.sellingSize(ctx(t), { kind: 'wyrd' }).models).toBe(core.warbandSize(ctx(t)) + 1);
  });
});

describe('letting him go', () => {
  it('the Troll leaves the roster', () => {
    const { s, troll } = orcs();
    const t = core.resolveDuty(ctx(s), 1, 'always-hungry-blackorcs', 'leave');
    expect(t.models.some((m) => m.uid === troll)).toBe(false);
    expect(rec(t)!.duties!.resolved).toEqual([{ id: 'always-hungry-blackorcs', option: 'leave', gc: 0 }]);
  });
});

describe('sacrificing two', () => {
  it('two Goblins or Cave Squigs of the warband are let go, chosen by the player', () => {
    let { s } = orcs('orcmob');
    s = core.addUnit(ctx(s), 'goblin');
    const gob = s.models.find((m) => m.uid_def === 'goblin')!;
    s = core.setQty(ctx(s), gob.uid, 3);
    const have = s.models.find((m) => m.uid === gob.uid)!.qty!;
    expect(have).toBeGreaterThanOrEqual(2);
    const d = core.dutiesDue(ctx(s), 1)[0]!;
    expect(d.options.find((o) => o.id === 'sacrifice')!.available).toBe(true);
    expect(core.dutyProblem(ctx(s), 1, d.id, 'sacrifice', { sacrifice: [{ uid: gob.uid, i: 0 }] })).toMatch(/two/i);
    const t = core.resolveDuty(ctx(s), 1, d.id, 'sacrifice', { sacrifice: [{ uid: gob.uid, i: 0 }, { uid: gob.uid, i: 1 }] });
    expect(t.models.find((m) => m.uid === gob.uid)?.qty ?? 0).toBe(have - 2);
    expect(rec(t)!.duties!.resolved[0]).toMatchObject({ option: 'sacrifice', gc: 0 });
  });

  it('is not available without two to sacrifice', () => {
    const { s } = orcs('orcmob');
    expect(core.dutiesDue(ctx(s), 1)[0]!.options.find((o) => o.id === 'sacrifice')).toMatchObject({ available: false, why: expect.stringMatching(/two/i) });
  });
});

describe('the phase is done when the duties are settled', () => {
  it('can be marked done and back', () => {
    const { s } = orcs();
    const t = core.setDutiesDone(ctx(s), 1, true);
    expect(rec(t)!.duties!.done).toBe(true);
    expect(rec(core.setDutiesDone(ctx(t), 1, false))!.duties!.done).toBe(false);
  });
});
