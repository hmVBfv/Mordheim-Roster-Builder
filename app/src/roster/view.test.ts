/* The roster screen shows what core's rules say, for every kind of warband. */
import * as core from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { data, fixtures } from '../test/data.ts';
import { createWarband, editableState, newWarbandChoice, rosterView, STATS } from './view.ts';

describe('roster view', () => {
  it.each(fixtures.filter((_, i) => i % 4 === 0).map((f) => [f.label, f] as const))('%s', (_l, f) => {
    const v = rosterView(data, f.state);
    const ctx = core.ctxOf(data, core.normalizeState(core.ctxOf(data, f.state)));
    expect(v.rating).toBe(core.totalRating(ctx));
    expect(v.gold).toBe(core.goldCurrent(ctx));
    expect(v.warnings).toEqual(core.warbandWarnings(ctx));
    expect(v.heroes.length + v.henchmen.length).toBe(ctx.s.models.length);
    for (const w of [...v.heroes, ...v.henchmen]) {
      expect(w.stats.map((c) => c.key)).toEqual([...STATS]);
      expect(w.name).not.toBe('');
    }
    expect(v.hires.length).toBe((ctx.s.hired ?? []).length + (ctx.s.dp ?? []).length);
  });

  /* Rob, 29.09.2026: experience was a bare number. The Roster Builder frames
     every step of the track, dashes those below the starting experience,
     fills those reached and marks the next one (legacy xpBar); Hired Swords
     follow the Henchmen's steps; Dramatis Personae gain none. */
  it('shows experience as the steps of the track', () => {
    let s = core.newWarband(data, 'merc');
    for (const id of ['capt', 'warr']) s = core.addUnit(core.ctxOf(data, s), id);
    s = core.hireHS(core.ctxOf(data, s), 'ogre');
    s = structuredClone(s);
    s.models[0]!.exp = 25;
    s.models[1]!.exp = 6;
    s.hired![0]!.exp = 5;
    const v = rosterView(data, s);
    const steps = (x: { steps: { at: number; state: string }[] } | null) => x?.steps.map((st) => `${st.at}:${st.state}`).join(' ');
    expect(steps(v.heroes[0]!.xp)).toBe('2:base 4:base 6:base 8:base 11:base 14:base 17:base 20:base 24:on 28:next 32:open 36:open 41:open 46:open 51:open 57:open 63:open 69:open 76:open 83:open 90:open');
    expect(v.heroes[0]!.xp?.next).toBe(28);
    expect(steps(v.henchmen[0]!.xp)).toBe('2:on 5:on 9:next 14:open');
    expect(steps(v.hires[0]!.xp)).toBe('2:on 5:on 9:next 14:open');
    expect(v.hires[0]!.advanceDue).toBe(true);
  });

  it('shows no track where there is no experience', () => {
    const noxp = fixtures.flatMap((f) => {
      const ctx = core.ctxOf(data, f.state);
      return f.state.models.filter((m) => core.unitDef(ctx, m.uid_def)?.noxp).map((m) => [f, m.uid] as const);
    })[0];
    expect(noxp).toBeDefined();
    const w = [...rosterView(data, noxp![0].state).henchmen, ...rosterView(data, noxp![0].state).heroes].find((x) => x.key === String(noxp![1]));
    expect(w?.xp).toBeNull();
    const dp = fixtures.map((f) => rosterView(data, f.state).hires.find((h) => h.kind === 'Dramatis Personae')).find(Boolean);
    expect(dp).toBeDefined();
    expect(dp!.xp).toBeNull();
  });

  it('marks what differs from the unit profile, and a group by its size', () => {
    const f = fixtures.find((x) => x.state.models.some((m) => Object.keys(m.adv ?? {}).length || (m.inj ?? []).some((j) => j.mod))) ?? fixtures[0]!;
    const v = rosterView(data, f.state);
    expect([...v.heroes, ...v.henchmen].some((w) => w.stats.some((c) => c.changed))).toBe(true);
    const g = fixtures.flatMap((x) => rosterView(data, x.state).henchmen).find((w) => w.count > 1);
    expect(g?.count).toBeGreaterThan(1);
  });
});

/* Phase 3a: what the screen needs to change a roster. */
describe('editing a roster', () => {
  const ctx = (s: core.WarbandState) => core.ctxOf(data, s);
  const fresh = () => createWarband(data, 'merc', null, 'The Grey Company');

  it('starts a warband as the Roster Builder does: name, variant and its gold', () => {
    const s = fresh();
    expect(s.name).toBe('The Grey Company');
    expect(rosterView(data, s).gold).toBe(data.WARBANDS.merc!.gold);
    const t = createWarband(data, 'tileans', 'trantio', '  ');
    expect(t.subtype).toBe('trantio');
    expect(t.name).toBe(data.WARBANDS.tileans!.name);
    const trantio = data.WARBANDS.tileans!.subtypes!.find((x) => x.key === 'trantio')!;
    expect(rosterView(data, t).gold).toBe(trantio.gold);
    expect(newWarbandChoice(data, 'merc')?.subtypes.map((x) => x.key)).toEqual(['reik', 'midd', 'mari']);
    expect(newWarbandChoice(data, 'nope')).toBeNull();
  });

  it('lists the units to recruit, grouped, with limits, prices and why not', () => {
    let s = fresh();
    const unit = (id: string) => rosterView(data, s).recruit.flatMap((g) => g.units).find((u) => u.id === id)!;
    expect(rosterView(data, s).recruit.map((g) => g.label)).toEqual(['Heroes', 'Henchmen']);
    expect(unit('capt')).toMatchObject({ limit: '=1', cost: core.unitBaseCost(ctx(s), core.unitDef(ctx(s), 'capt')!), why: null });
    s = core.addUnit(ctx(s), 'capt');
    expect(unit('capt').why).toBe('the warband has its leader');
    s = core.addUnit(ctx(s), 'champ');
    s = core.addUnit(ctx(s), 'champ');
    expect(unit('champ').why).toBe('the warband has all 2 it may have');
    s = core.setHouseNum(ctx(s), 'heroes', 3);
    expect(unit('young').why).toBe('the warband has its 3 Heroes');
    expect(unit('warr').why).toBeNull();
  });

  it('offers another man at his price, until the group or the unit is full', () => {
    let s = core.addUnit(ctx(fresh()), 'warr');
    const uid = s.models[0]!.uid;
    s = core.setModelExp(ctx(s), uid, 3);
    const group = () => rosterView(data, s).henchmen[0]!;
    expect(group().addMan).toEqual({ cost: core.henchRecruitCost(ctx(s), s.models[0]!) });
    s = core.setQty(ctx(s), uid, 5);
    expect(group().addMan).toEqual({ why: 'the group is full with 5 men' });
    expect(group().men.map((m) => m.name)).toEqual(core.memberNames(ctx(s), s.models[0]!));
    s = core.setMemberName(ctx(s), uid, 1, 'Bruno');
    expect(group().men.map((m) => m.named)).toEqual([false, true, false, false, false]);
    // a unit with a maximum: Marksmen, at most 7 in a Reikland warband
    let m = core.addUnit(ctx(fresh()), 'mark');
    const max = core.unitMax(ctx(m), core.unitDef(ctx(m), 'mark')!)!;
    m = core.setQty(ctx(m), m.models[0]!.uid, 5);
    m = core.addUnit(ctx(m), 'mark');
    m = core.setQty(ctx(m), m.models[1]!.uid, max - 5);
    expect(rosterView(data, m).henchmen[1]!.addMan).toEqual({ why: `the warband has all ${max} it may have` });
  });

  it('bounds the experience stepper: not below the start, a Hired Sword not past 14', () => {
    let s = core.addUnit(ctx(fresh()), 'capt');
    s = core.hireHS(ctx(s), 'ogre');
    const v = rosterView(data, s);
    expect(v.heroes[0]!.xp).toMatchObject({ value: 20, min: 20, max: null });
    expect(v.hires[0]!.xp).toMatchObject({ value: 0, min: 0, max: 14 });
    // a warrior below his starting experience (an old save) is not trapped
    s = core.setModelExp(ctx(s), s.models[0]!.uid, 5);
    expect(rosterView(data, s).heroes[0]!.xp).toMatchObject({ value: 5, min: 5 });
  });

  it('knows who may lead: a Hero who may, and does not yet', () => {
    let s = core.addUnit(ctx(fresh()), 'capt');
    s = core.addUnit(ctx(s), 'champ');
    const [capt, champ] = rosterView(data, s).heroes;
    expect(capt).toMatchObject({ leader: true, canLead: false });
    expect(champ).toMatchObject({ leader: false, canLead: true });
    expect(rosterView(data, core.setLeader(ctx(s), champ!.uid)).heroes.map((w) => w.leader)).toEqual([false, true]);
  });

  it('shows the worth of the warband', () => {
    const f = fixtures.find((x) => x.state.models.length > 3)!;
    expect(rosterView(data, f.state).worth).toBe(core.warbandWorth(core.ctxOf(data, editableState(data, f.state))));
  });
});
