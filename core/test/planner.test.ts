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

describe('the planner can open the Trading Post (#89)', () => {
  it('a planner is founded without it, and opens it by choice; any other warband cannot', () => {
    const plan = band(true);
    expect(core.tradeLocked(ctx(plan))).toBe(false);
    const open = core.setPlannerTrade(ctx(plan), true);
    expect(core.tradeLocked(ctx(open))).toBe(true);
    expect(core.tradeLocked(ctx(core.setPlannerTrade(ctx(open), false)))).toBe(false);
    const plain = core.setPlannerTrade(ctx(band(false)), true);
    expect(plain.plannerTrade).toBeUndefined();
    expect(core.tradeLocked(ctx(plain))).toBe(false);
  });

  it('a rare item found there is booked at the price given, and counts to the value', () => {
    let s = core.setPlannerTrade(ctx(band(true)), true);
    const hero = s.models.find((m) => m.uid_def === 'capt')!.uid;
    const before = core.plannerValue(ctx(s));
    const rare = data.CATALOG.find((x) => typeof x.cost === 'number' && core.rarityOf(ctx(s), x.de) != null && core.canReceive(ctx(s), hero, { key: x.de, rare: true }).ok)!;
    const t = core.recordSearch(ctx(s), hero, rare.de, { found: true, paid: Number(rare.cost), to: hero });
    expect(t.ok).toBe(true);
    s = t.state;
    expect(core.plannerValue(ctx(s))).toBe(before + Number(rare.cost));
  });

  it('the mark survives saving and reading', () => {
    const s = core.setPlannerTrade(ctx(band(true)), true);
    const back = core.loadSave(data, JSON.parse(JSON.stringify(core.writeSave(ctx(s)))));
    expect(back.ok && back.state.plannerTrade).toBe(true);
  });
});

describe('what a planner is tracked by (#79)', () => {
  it('its value, the experience its advances would need, and its rating – with no rule on how the experience is spread', () => {
    let s = band(true);
    const f0 = core.plannerFigures(ctx(s));
    expect(f0.value).toBe(core.totalSpent(ctx(s)));
    expect(f0.rating).toBe(core.totalRating(ctx(s)));
    const hero = s.models.find((m) => m.uid_def === 'champ')!;
    // all the advances on one Hero, none on the others: allowed, and the experience shows it
    for (let i = 0; i < 4; i++) s = core.addAdvance(ctx(s), hero.uid, 'WS');
    const f1 = core.plannerFigures(ctx(s));
    expect(f1.exp).toBeGreaterThan(f0.exp);
    expect(f1.exp).toBe(s.models.reduce((n, m) => n + core.expNeeded(ctx(s), m), 0));
  });
});

describe('the planner\'s starting list stays open with the Trading Post (#107)', () => {
  /** A planner with a Marksman, its Trading Post open. */
  function trading() {
    let s = core.asPlanner(ctx(core.newWarband(data, 'merc')));
    s = core.addUnit(ctx(s), 'capt');
    s = core.addUnit(ctx(s), 'mark');
    s = core.setPlannerTrade(ctx(s), true);
    return { s, mark: s.models.find((m) => m.uid_def === 'mark')!.uid };
  }

  it('a rare item of the Marksman\'s list is bought from it at the list price', () => {
    const { s, mark } = trading();
    expect(core.tradeKind(ctx(s), 'Jagdgewehr').kind).toBe('rare');
    expect(core.isNewRecruit(ctx(s), s.models.find((m) => m.uid === mark)!)).toBe(false);
    expect(core.listProblem(ctx(s), mark, 'Jagdgewehr', 1)).toBe('');
    const t = core.setListQty(ctx(s), mark, 'Jagdgewehr', 1);
    expect(t.models.find((m) => m.uid === mark)!.eq?.Jagdgewehr).toBe(1);
  });

  it('the founding price of an upgrade holds, open Trading Post or not', () => {
    let s = core.asPlanner(ctx(core.newWarband(data, 'dwarftreasure')));
    expect(core.upgradeStart(ctx(s), 'Gromril-Waffe')).not.toBeNull();
    s = core.setPlannerTrade(ctx(s), true);
    expect(core.upgradeStart(ctx(s), 'Gromril-Waffe')).not.toBeNull();
  });

  it('the Trading Post stays open beside the list: a search is booked at the price given', () => {
    const { s } = trading();
    expect(core.tradeLocked(ctx(s))).toBe(true);
    const capt = s.models.find((m) => m.uid_def === 'capt')!.uid;
    const rare = data.CATALOG.find((x) => typeof x.cost === 'number' && core.rarityOf(ctx(s), x.de) != null && core.canReceive(ctx(s), capt, { key: x.de, rare: true }).ok)!;
    const t = core.recordSearch(ctx(s), capt, rare.de, { found: true, paid: 77, to: capt });
    expect(t.ok).toBe(true);
    expect(t.state.ledger!.at(-1)!.amount).toBe(-77);
  });

  it('entering a campaign makes it an ordinary warband: the flag is gone and a later recruit is held to the rules', () => {
    const { s } = trading();
    const plan = { grants: [], allowedValue: 0 } as never;
    const joined = core.applyCatchUp(ctx(s), plan, {}, 3);
    expect(joined.planner).toBeUndefined();
    expect(joined.plannerTrade).toBeUndefined();
    const running = { ...joined, campaign: { ...joined.campaign, on: true, round: 3 } } as WarbandState;
    const hired = core.recruitUnit(ctx(running), 'mark');
    const recruit = hired.models.find((m) => !s.models.some((o) => o.uid === m.uid))!;
    expect(core.isNewRecruit(ctx(hired), recruit)).toBe(true);
    expect(core.listProblem(ctx(hired), recruit.uid, 'Jagdgewehr', 1)).toBe('rare: only through a search at the Trading Post');
  });
});
