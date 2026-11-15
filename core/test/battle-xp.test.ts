/* N4 (docs/plan-postbattle.md): the experience of a battle with the underdog bonus and the scenario's points. Rob, 13.11.2026: the underdog
   bonus is a pairwise comparison; against several warbands each warband takes the largest gap to a higher-rated one. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { Casualty, WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

/** A campaign warband with its required heroes and a henchman group; the first hero leads. */
function warband() {
  let s = core.newWarband(data, 'merc');
  const units = data.WARBANDS.merc!.units;
  for (const u of units.filter((x) => x.req)) s = core.addUnit(ctx(s), u.id);
  const hench = units.find((x) => x.t === 'hen')!;
  s = core.addUnit(ctx(s), hench.id);
  s = { ...s, campaign: { on: true, round: 1, districts: {}, battles: [{ id: 1, round: 1, outcome: 'Victory', sides: [{ key: 'me', name: 'Us', wb: 'merc', outcome: 'Victory' }] }] } as WarbandState['campaign'] };
  const leader = s.models.find((m) => core.isHeroModel(ctx(s), m))!;
  const group = s.models.find((m) => !core.isHeroModel(ctx(s), m))!;
  return { s, leader: leader.uid, group: group.uid };
}
const held = (s: WarbandState) => (s.campaign?.xp ?? []).filter((x) => !x.applied);
const of = (s: WarbandState, uid: number) => held(s).filter((x) => x.uid === uid).map((x) => [x.amount, x.reason]);

describe('underdogAgainst: each warband takes its largest gap to a higher-rated opponent', () => {
  it('one opponent: the gap decides', () => {
    expect(core.underdogAgainst(data, 100, [150])).toBe(0); // 50: none
    expect(core.underdogAgainst(data, 100, [151])).toBe(1); // 51
    expect(core.underdogAgainst(data, 100, [250])).toBe(3); // 150
    expect(core.underdogAgainst(data, 100, [500])).toBe(5); // 400
  });
  it('several opponents: the largest gap to a higher-rated one counts', () => {
    expect(core.underdogAgainst(data, 300, [350, 420])).toBe(3); // gaps 50 and 120 → 120
    expect(core.underdogAgainst(data, 300, [250, 380])).toBe(2); // 250 is lower: only 80 counts
  });
  it('nothing against equals or weaker warbands, or with nobody to compare', () => {
    expect(core.underdogAgainst(data, 300, [300, 200])).toBe(0);
    expect(core.underdogAgainst(data, 300, [])).toBe(0);
  });
});

describe('awardBattleXp with the underdog bonus and the scenario', () => {
  it('without options it holds what it always held: survived and the winning leader', () => {
    const { s, leader, group } = warband();
    const t = core.awardBattleXp(ctx(s), 1);
    expect(of(t, leader)).toEqual([[1, 'survived the battle'], [1, 'led the winning warband']]);
    expect(of(t, group)).toEqual([[1, 'survived the battle']]);
    expect((t.campaign as { postbattle?: unknown }).postbattle).toBeUndefined();
  });

  it('the underdog bonus goes to everyone who fought, once each, and is recorded in the round', () => {
    const { s, leader, group } = warband();
    const t = core.awardBattleXp(ctx(s), 1, { underdog: 2 });
    expect(of(t, leader)).toContainEqual([2, 'underdog (+2)']);
    expect(of(t, group)).toContainEqual([2, 'underdog (+2)']);
    expect((t.campaign as { postbattle: Record<string, { xp: unknown }> }).postbattle['1']!.xp).toEqual({ underdog: 2, scenario: [] });
  });

  it('one who sat the battle out or was slain gets no underdog bonus, as no survival point', () => {
    const { s, leader, group } = warband();
    const out = { ...s, models: s.models.map((m) => (m.uid === group ? { ...m, miss: 1 } : m)) };
    const t = core.awardBattleXp(ctx(out), 1, { underdog: 3 });
    expect(of(t, group)).toEqual([]);
    expect(of(t, leader)).toContainEqual([3, 'underdog (+3)']);
  });

  it('the scenario’s points go to the warrior named, with the reason given', () => {
    const { s, leader, group } = warband();
    const t = core.awardBattleXp(ctx(s), 1, { scenario: [{ uid: group, amount: 2, reason: 'carried the wyrdstone off' }] });
    expect(of(t, group)).toContainEqual([2, 'carried the wyrdstone off']);
    expect(of(t, leader)).not.toContainEqual([2, 'carried the wyrdstone off']);
    expect((t.campaign as { postbattle: Record<string, { xp: { scenario: unknown[] } }> }).postbattle['1']!.xp.scenario).toEqual([{ uid: group, amount: 2, reason: 'carried the wyrdstone off' }]);
  });

  it('a zero bonus and an empty list change nothing', () => {
    const { s } = warband();
    expect(held(core.awardBattleXp(ctx(s), 1, { underdog: 0, scenario: [] })).map((x) => [x.uid, x.amount, x.reason]))
      .toEqual(held(core.awardBattleXp(ctx(s), 1)).map((x) => [x.uid, x.amount, x.reason]));
  });
});

describe('battleXpPlan: what the table shows is what awardBattleXp then holds', () => {
  it('one row for each warrior: survived, leader, kills, underdog, scenario and the sum', () => {
    const { s, leader, group } = warband();
    const withKill = core.addCasualty(ctx(s), { victim: { name: 'Clanrat', wb: 'skaven' }, attacker: { uid: leader, name: 'Captain' } });
    const opts = { underdog: 1, scenario: [{ uid: group, amount: 1, reason: 'objective' }] };
    const plan = core.battleXpPlan(ctx(withKill), 1, opts);
    const row = (uid: number) => plan.find((r) => r.uid === uid)!;
    expect(row(leader)).toMatchObject({ survives: 1, leader: 1, kills: 1, underdog: 1, scenario: 0, total: 4 });
    expect(row(group)).toMatchObject({ survives: 1, leader: 0, kills: 0, underdog: 1, scenario: 1, total: 3 });
    const after = core.awardBattleXp(ctx(withKill), 1, opts);
    for (const r of plan) expect(held(after).filter((x) => x.uid === r.uid).reduce((n, x) => n + x.amount, 0), `row of ${r.name}`).toBe(r.total);
  });

  it('a warrior who sits it out or was slain has no points and is marked', () => {
    const { s, group } = warband();
    const sat = { ...s, models: s.models.map((m) => (m.uid === group ? { ...m, miss: 1 } : m)) };
    expect(core.battleXpPlan(ctx(sat), 1, { underdog: 2 }).find((r) => r.uid === group)).toMatchObject({ sitsOut: true, total: 0 });
    const dead = core.addCasualty(ctx(s), { victim: { uid: group, name: 'Hans', wb: 'merc' } });
    const died = core.resolveCasualty(ctx(dead), (dead.campaign!.casualties as Casualty[]).at(-1)!.id, 'dead', 'Dead');
    expect(core.battleXpPlan(ctx(died), 1, {}).find((r) => r.uid === group)).toMatchObject({ dead: true, total: 0 });
  });
});
