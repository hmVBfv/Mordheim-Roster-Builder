/* The roster screen shows what core's rules say, for every kind of warband. */
import * as core from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { data, fixtures } from '../test/data.ts';
import { rosterView, STATS } from './view.ts';

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
