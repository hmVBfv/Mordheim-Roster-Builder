/* Mutations, Blessings of Nurgle and the Marks of Chaos (phase 3c). */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { data } from '../test/data.ts';
import { markRole, markView, mutationView } from './chaos.ts';
import { createWarband } from './view.ts';

const ctx = (s: WarbandState) => core.ctxOf(data, s);
const band = (wb: string, ...units: string[]) => {
  let s = createWarband(data, wb, null, '');
  for (const u of units) s = core.addUnit(ctx(s), u);
  return s;
};

describe('mutations', () => {
  it('a Mutant must have one; the dearest costs its price, every further one double', () => {
    let s = band('possessed', 'mut');
    const uid = s.models[0]!.uid;
    const v = mutationView(ctx(s), uid)!;
    expect(v).toMatchObject({ label: 'Mutations', one: 'mutation', required: true, viaSkill: false, cost: 0, locked: false });
    expect(v.items.find((i) => i.key === 'Große Klaue')).toMatchObject({ name: 'Great Claw', price: 50, on: false });
    expect(v.items.every((i) => i.text)).toBe(true);
    expect(core.warbandWarnings(ctx(s)).some((w) => /needs at least 1 mutation/.test(w))).toBe(true);
    s = core.toggleMutation(ctx(s), uid, 'Große Klaue', true);
    s = core.toggleMutation(ctx(s), uid, 'Gespaltene Hufe', true);
    expect(mutationView(ctx(s), uid)!.cost).toBe(50 + 2 * 40);
  });

  it('a Tainted One takes Blessings of Nurgle', () => {
    const s = band('carnival', 'tainted');
    expect(mutationView(ctx(s), s.models[0]!.uid)).toMatchObject({ label: 'Blessings of Nurgle', one: 'blessing', required: true });
  });

  it('a Hero with the Mutant skill may have them; others not', () => {
    let s = band('beastmen', 'chief');
    const uid = s.models[0]!.uid;
    expect(mutationView(ctx(s), uid)).toBe(null);
    s = core.addSkillFromList(ctx(s), uid, 'Mutant');
    expect(mutationView(ctx(s), uid)).toMatchObject({ viaSkill: true, label: 'Mutations' });
  });
});

describe('the Mark of Chaos', () => {
  it('only Marauders have one; the Seer chooses it, the Chieftain may take it', () => {
    expect(markView(ctx(band('merc')))).toBe(null);
    let s = band('maraudersofchaos', 'chieftain', 'seer');
    const [chief, seer] = s.models.map((m) => m.uid) as [number, number];
    expect(markRole(ctx(s), seer)).toBe('seer');
    expect(markRole(ctx(s), chief)).toBe('chief');
    expect(markView(ctx(s))!.options.map((o) => o.key)).toEqual(['eagle', 'serpent', 'crow', 'undivided', 'khorne']);
    expect(markView(ctx(s))!.options.find((o) => o.key === 'khorne')!.magic).toBe(false);
    s = core.setMark(ctx(s), 'eagle');
    expect(markView(ctx(s))!.seerRules.map(([n]) => n)).toEqual(['Sorcerer of Tchar']);
    expect(core.markRulesFor(ctx(s), s.models[1]!).length).toBe(1);
    expect(core.markRulesFor(ctx(s), s.models[0]!)).toEqual([]);
    s = core.setCaster(ctx(s), chief, true);
    expect(core.markRulesFor(ctx(s), s.models[0]!).map(([n]) => n)).toEqual(['Touched by Tchar']);
  });
});
