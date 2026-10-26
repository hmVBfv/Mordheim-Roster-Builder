/* The catch-up (wish #77, Rob, 25.10.2026): a warband that joins a running campaign late starts with what the others
   have by then – measured by the MEDIAN of the warbands that have fought, not the mean: one runaway warband and one
   that was nearly wiped out would pull a mean about. Experience is counted in rating points (a Henchmen group's counts
   once per man), every group gets one experience per battle fought, every Hero too, the leader gets half as much again
   on top, and what is left is shared evenly among the Heroes, none above one and a half times the even share. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

/** A planner: a leader, two Heroes, a group of three Warriors and one of two Marksmen. */
function planner() {
  let s = core.asPlanner(ctx(core.newWarband(data, 'merc')));
  s = core.addUnit(ctx(s), 'capt');
  s = core.addUnit(ctx(s), 'champ');
  s = core.addUnit(ctx(s), 'champ');
  s = core.addUnit(ctx(s), 'warr');
  s = core.setQty(ctx(s), s.models.find((m) => m.uid_def === 'warr')!.uid, 3);
  s = core.addUnit(ctx(s), 'mark');
  s = core.setQty(ctx(s), s.models.find((m) => m.uid_def === 'mark')!.uid, 2);
  return s;
}
const peers = (list: [number, number, number][]): core.PeerFigures[] => list.map(([rating, value, battles]) => ({ rating, value, battles }));

describe('the figures of the others', () => {
  it('the median, half up', () => {
    expect(core.median([90, 100, 110])).toBe(100);
    expect(core.median([90, 100])).toBe(95);
    expect(core.median([1, 2])).toBe(2);
    expect(core.median([7])).toBe(7);
  });

  it('are the medians of the warbands that have fought; the others do not count', () => {
    const t = core.catchUpTargets(peers([[100, 700, 3], [140, 900, 3], [400, 3000, 4], [60, 520, 0]]))!;
    // 100, 140, 400 → 140; 700, 900, 3000 → 900; 3, 3, 4 → 3; the one without a battle is left out
    expect(t).toEqual({ peers: 3, rating: 140, value: 900, battles: 3 });
    expect(core.catchUpTargets(peers([[60, 520, 0]]))).toBeNull();
    expect(core.catchUpTargets([])).toBeNull();
  });
});

describe('the plan', () => {
  const targets = (rating: number, value = 900, battles = 3): core.CatchUpTargets => ({ peers: 3, rating, value, battles });

  it('gives every group one experience per battle (counted once per man) and every Hero as many, the leader half as many on top', () => {
    const s = planner();
    const start = core.catchUpPlan(ctx(s), targets(0)).startRating;
    const p = core.catchUpPlan(ctx(s), targets(start + 200));
    const group = (id: string) => p.grants.find((g) => g.uid === s.models.find((m) => m.uid_def === id)!.uid)!;
    expect(group('warr')).toMatchObject({ hero: false, count: 3, exp: 3, min: 3, max: 3 });
    expect(group('mark')).toMatchObject({ hero: false, count: 2, exp: 3 });
    const heroes = p.grants.filter((g) => g.hero);
    expect(heroes).toHaveLength(3);
    const leader = heroes.find((g) => g.leader)!;
    const others = heroes.filter((g) => !g.leader);
    // the rest (200 − 3·5 for the men − 3·3 Heroes − 2 for the leader = 174) shared evenly: 58 each, the leader 2 more
    expect(others.map((g) => g.exp)).toEqual([61, 61]);
    expect(leader.exp).toBe(63);
    expect(p.shrunk).toBe(false);
  });

  it('adds up to the gap exactly, in rating points', () => {
    const s = planner();
    const start = core.catchUpPlan(ctx(s), targets(0)).startRating;
    for (const gap of [40, 77, 200, 333]) {
      const p = core.catchUpPlan(ctx(s), targets(start + gap));
      const spent = p.grants.reduce((n, g) => n + g.exp * g.count, 0);
      expect(spent, `gap ${gap}`).toBe(gap);
    }
  });

  it('is smaller, evenly, when the gap does not cover the experience of the battles; and says so', () => {
    const s = planner();
    const start = core.catchUpPlan(ctx(s), targets(0)).startRating;
    const p = core.catchUpPlan(ctx(s), targets(start + 20, 900, 6));
    expect(p.shrunk).toBe(true);
    expect(p.grants.reduce((n, g) => n + g.exp * g.count, 0)).toBeLessThanOrEqual(20);
    // the groups are never given more than the Heroes
    const heroMin = Math.min(...p.grants.filter((g) => g.hero).map((g) => g.min));
    expect(Math.max(...p.grants.filter((g) => !g.hero).map((g) => g.exp))).toBeLessThanOrEqual(Math.max(heroMin, 6));
  });

  it('gives nothing when the others are not ahead', () => {
    const s = planner();
    const p = core.catchUpPlan(ctx(s), targets(1));
    expect(p.gap).toBe(0);
    expect(p.grants.every((g) => g.exp === 0)).toBe(true);
  });

  it('keeps every Hero within one and a half times the even share', () => {
    const s = planner();
    const start = core.catchUpPlan(ctx(s), targets(0)).startRating;
    const p = core.catchUpPlan(ctx(s), targets(start + 200));
    const others = p.grants.filter((g) => g.hero && !g.leader);
    expect(others[0]!.max).toBe(Math.floor(others[0]!.exp * 1.5));
    expect(others[0]!.min).toBe(3);
  });

  it('allows the median value, never less than the warband starts with', () => {
    const s = planner();
    expect(core.catchUpPlan(ctx(s), targets(100, 900)).allowedValue).toBe(900);
    expect(core.catchUpPlan(ctx(s), targets(100, 300)).allowedValue).toBe(core.startGold(ctx(s)));
    expect(core.catchUpPlan(ctx(s), null).allowedValue).toBe(core.startGold(ctx(s)));
  });
});

describe('what the plan allows', () => {
  const exps = (p: core.CatchUpPlan) => Object.fromEntries(p.grants.map((g) => [g.uid, g.exp]));

  it('a planner within the plan has no problem; the experience it needs is there from the start', () => {
    const s = planner();
    const start = core.catchUpPlan(ctx(s), { peers: 3, rating: 0, value: 900, battles: 3 }).startRating;
    const p = core.catchUpPlan(ctx(s), { peers: 3, rating: start + 200, value: 2000, battles: 3 });
    expect(core.catchUpProblems(ctx(s), p, exps(p))).toEqual([]);
  });

  it('says what exceeds it: the value, the experience a model needs, the share of a Hero', () => {
    let s = planner();
    const champ = s.models.find((m) => m.uid_def === 'champ')!.uid;
    for (const st of ['S', 'T', 'W', 'I', 'A', 'Ld', 'WS', 'BS'] as const) s = core.addAdvance(ctx(s), champ, st);
    const start = core.catchUpPlan(ctx(s), { peers: 3, rating: 0, value: 900, battles: 3 }).startRating;
    const p = core.catchUpPlan(ctx(s), { peers: 3, rating: start + 30, value: 100, battles: 3 });
    // a planner worth more than the allowance (the allowance can never be below the starting gold, so it is lowered here)
    const problems = core.catchUpProblems(ctx(s), { ...p, allowedValue: 100 }, exps(p));
    expect(problems.some((x) => /value is \d+ gc; the catch-up allows \d+ gc/.test(x))).toBe(true);
    expect(problems.some((x) => /needs \d+ exp for its advances; the catch-up gives \d+/.test(x))).toBe(true);
    // a Hero given more than the plan allows, and the total of the Heroes off
    const heroes = p.grants.filter((g) => g.hero);
    const e = exps(p);
    e[heroes[0]!.uid] = heroes[0]!.max + 5;
    expect(core.catchUpProblems(ctx(s), p, e).some((x) => /may have at most \d+/.test(x))).toBe(true);
    expect(core.catchUpProblems(ctx(s), p, e).some((x) => /Heroes must add up to/.test(x))).toBe(true);
  });
});

describe('entering', () => {
  it('turns the planner into an ordinary warband: the gold of the median, the experience given, a record of why', () => {
    const s = planner();
    const t: core.CatchUpTargets = { peers: 3, rating: 0, value: 2000, battles: 3 };
    const start = core.catchUpPlan(ctx(s), t).startRating;
    const target = { ...t, rating: start + 200 };
    const p = core.catchUpPlan(ctx(s), target);
    const e = Object.fromEntries(p.grants.map((g) => [g.uid, g.exp]));
    const entered = core.applyCatchUp(ctx(s), p, e, 4);
    expect(core.isPlanner(entered)).toBe(false);
    expect('planner' in entered).toBe(false);
    expect(core.totalRating(ctx(entered))).toBe(target.rating);
    // the gold in hand is what the allowance leaves after what the warband owns
    expect(core.goldTreasury(ctx(entered))).toBe(p.allowedValue);
    expect(core.goldCurrent(ctx(entered))).toBe(p.allowedValue - core.totalSpent(ctx(entered)));
    expect(entered.campaign?.catchUp).toMatchObject({ peers: 3, rating: target.rating, value: 2000, battles: 3, round: 4, gold: p.allowedValue });
    // what an entry exceeds is kept in the record, for the leader
    expect(core.applyCatchUp(ctx(s), p, e, 4, ['Its value is 900 gc; the catch-up allows 500 gc.']).campaign?.catchUp).toMatchObject({ over: ['Its value is 900 gc; the catch-up allows 500 gc.'] });
    expect((entered.campaign?.catchUp as { over?: string[] }).over).toBeUndefined();
    // nothing else changed for the models: same units, the experience of the start plus the grant
    expect(entered.models.map((m) => m.uid_def)).toEqual(s.models.map((m) => m.uid_def));
  });
});
