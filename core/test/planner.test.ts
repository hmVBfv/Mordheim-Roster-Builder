/* The planner (wish #77, Rob, 25.10.2026): a warband kept to see what a strong late-game composition looks like.
   Nothing limits its gold – only the value is shown – and its advances are free: instead the experience each model
   would need for them is kept. It never plays a battle and never enters a campaign by itself. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

/** A Reikland Captain and a band of Warriors, more than 500 gc of it. */
function band(planner: boolean) {
  let s = core.newWarband(data, 'merc');
  if (planner) s = core.asPlanner(ctx(s));
  s = core.addUnit(ctx(s), 'capt');
  s = core.addUnit(ctx(s), 'champ');
  s = core.addUnit(ctx(s), 'warr');
  return s;
}

describe('the planner', () => {
  it('is a warband that says so; an ordinary one is not', () => {
    expect(core.isPlanner(band(false))).toBe(false);
    expect(core.isPlanner(band(true))).toBe(true);
  });

  it('is never told it has too little gold, an ordinary warband is', () => {
    let plain = band(false);
    let plan = band(true);
    for (const uid of plain.models.map((m) => m.uid)) { plain = core.setEqQty(ctx(plain), uid, 'Schwert', 1); }
    plain = { ...plain, stash: { ...plain.stash!, gold: 10 } };
    plan = { ...plan, stash: { ...plan.stash!, gold: 10 } };
    expect(core.goldCurrent(ctx(plain))).toBeLessThan(0);
    expect(core.warbandWarnings(ctx(plain)).some((w) => /Not enough gold/.test(w))).toBe(true);
    expect(core.warbandWarnings(ctx(plan)).some((w) => /Not enough gold/.test(w))).toBe(false);
  });

  it('keeps the experience a model needs for the advances it has: a Hero by the Hero thresholds, a group by its own', () => {
    let s = band(true);
    const [capt, champ, warr] = s.models.map((m) => m.uid) as [number, number, number];
    const start = (uid: number) => core.advanceStatus(ctx(s), s.models.find((m) => m.uid === uid)!)!.start;
    // no advance: the experience he starts with
    expect(core.expNeeded(ctx(s), s.models.find((m) => m.uid === capt)!)).toBe(start(capt));
    s = core.addAdvance(ctx(s), champ, 'S');
    s = core.addAdvance(ctx(s), champ, 'T');
    s = core.addAdvance(ctx(s), champ, 'W');
    // three advances of a Hero: the third threshold above the start (2, 4, 6 …)
    const th = core.xpThresholds(true).filter((t) => t > start(champ));
    expect(core.expNeeded(ctx(s), s.models.find((m) => m.uid === champ)!)).toBe(th[2]);
    // a group of Henchmen: 2, 5, 9, 14
    s = core.addAdvance(ctx(s), warr, 'WS');
    expect(core.expNeeded(ctx(s), s.models.find((m) => m.uid === warr)!)).toBe(core.xpThresholds(false).filter((t) => t > start(warr))[0]);
  });

  it('shows its value: all it owns, in gold, whatever the starting gold', () => {
    const s = band(true);
    expect(core.plannerValue(ctx(s))).toBe(core.totalSpent(ctx(s)));
    expect(core.plannerValue(ctx(s))).toBeGreaterThan(0);
  });

  it('survives a save: the flag is written and read, and an ordinary warband gains none', () => {
    const saved = core.writeSave(ctx(band(true)));
    expect(saved.planner).toBe(true);
    const back = core.loadSave(data, JSON.parse(JSON.stringify(saved)));
    expect(back.ok && core.isPlanner(back.state)).toBe(true);
    const plain = core.loadSave(data, JSON.parse(JSON.stringify(core.writeSave(ctx(band(false))))));
    expect(plain.ok && 'planner' in plain.state).toBe(false);
  });
});
