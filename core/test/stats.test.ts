/* Plan P14: the numbers a statistics chart plots, computed from a warband's state alone. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

function warband(): WarbandState {
  let s = core.newWarband(data, 'mastersofhorror');
  for (const u of data.WARBANDS.mastersofhorror!.units.filter((x) => x.req)) s = core.addUnit(ctx(s), u.id);
  return s;
}
const edit = (s: WarbandState, f: (d: WarbandState) => void): WarbandState => { const d = structuredClone(s); f(d); return d; };

describe('stageMetrics', () => {
  it('agrees with the existing totals and starts without losses, income or wyrdstone', () => {
    const s = warband(); const m = core.stageMetrics(ctx(s));
    expect(m.value).toBe(core.warbandWorth(ctx(s)));
    expect(m.gold).toBe(core.goldCurrent(ctx(s)));
    expect(m.wealth).toBe(core.goldTreasury(ctx(s)));
    expect(m).toMatchObject({ stash: 0, lost: 0, wyrd: 0, wyrdFound: 0, income: 0 });
    expect(m.exp).toBe(m.heroExp); // a hero starts with experience, a fresh warband has no henchmen yet
  });

  it('counts experience of the whole warband and of its heroes, the dead included', () => {
    const s = warband(); const hero = s.models.find((x) => core.isHeroModel(ctx(s), x))!;
    const t = edit(s, (d) => { d.models.find((x) => x.uid === hero.uid)!.exp = 12; });
    expect(core.stageMetrics(ctx(t))).toMatchObject({ heroExp: 12 });
    const before = core.stageMetrics(ctx(t)).exp;
    const dead = edit(t, (d) => { d.fallen = [{ kind: 'hero', m: { ...hero, exp: 5 }, lostValue: 30 }]; });
    expect(core.stageMetrics(ctx(dead))).toMatchObject({ heroExp: 12, lost: 30 });
    expect(core.stageMetrics(ctx(dead)).exp).toBe(before + 5);
  });

  it('adds the stash to wealth, and sold wyrdstone to what was found and earned', () => {
    const s = edit(warband(), (d) => {
      d.stash = { wyrd: 2, gold: null, items: [{ name: 'Sword', qty: 2, paid: 10 }] };
      d.campaign = { on: true, postbattle: { 1: { done: {}, wyrd: { done: true, shards: 3, gc: 90, size: 5 } } } } as WarbandState['campaign'];
    });
    const m = core.stageMetrics(ctx(s));
    expect(m).toMatchObject({ stash: 20, wyrd: 2, wyrdFound: 5, income: 90 });
    expect(m.wealth).toBe(core.goldTreasury(ctx(s)) + 20);
  });
});
