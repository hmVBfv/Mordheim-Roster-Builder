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

  it('marks what differs from the unit profile, and a group by its size', () => {
    const f = fixtures.find((x) => x.state.models.some((m) => Object.keys(m.adv ?? {}).length || (m.inj ?? []).some((j) => j.mod))) ?? fixtures[0]!;
    const v = rosterView(data, f.state);
    expect([...v.heroes, ...v.henchmen].some((w) => w.stats.some((c) => c.changed))).toBe(true);
    const g = fixtures.flatMap((x) => rosterView(data, x.state).henchmen).find((w) => w.count > 1);
    expect(g?.count).toBeGreaterThan(1);
  });
});
