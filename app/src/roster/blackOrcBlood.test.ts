/* Report of 7.11.2026: Black Orc Blood – one Young'un may be upgraded for 10 gc and then take Proven Warrior – was only text. The card of a
   Young'un offers the upgrade, the advance sheet offers Proven Warrior to the man who has it and to no other. */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { data } from '../test/data.ts';
import { advanceView } from './advance.ts';
import { createWarband, rosterView } from './view.ts';

const ctx = (s: WarbandState) => core.ctxOf(data, s);

function band() {
  let s = createWarband(data, 'blackorcs', null, '');
  for (const id of ['bboss', 'young', 'young']) s = core.addUnit(ctx(s), id);
  const [boss, a, b] = s.models.map((m) => m.uid) as [number, number, number];
  return { s, boss, a, b };
}
const proven = (s: WarbandState, uid: number) => advanceView(ctx(s), uid)!.skills.flatMap((g) => g.items).some((i) => i.name === 'Proven Warrior');

describe('the Black Orc Blood upgrade on a card', () => {
  it('is offered on the Young\'uns, for 10 gc, until one has it', () => {
    const { s: s0, boss, a, b } = band();
    const s = core.setModelExp(ctx(s0), a, 25);
    const offer = (t: WarbandState, uid: number) => rosterView(data, t).heroes.find((h) => h.uid === uid)!.upgrade;
    expect(offer(s, boss)).toBeNull();
    expect(offer(s, a)).toMatchObject({ name: 'Black Orc Blood', cost: 10, on: false });
    const t = core.setUnitUpgrade(ctx(s), a, true);
    expect(offer(t, a)).toMatchObject({ name: 'Black Orc Blood', cost: 10, on: true, block: null });
    expect(offer(t, b)).toBeNull(); // only one in the warband
  });

  it('opens Proven Warrior on the advance sheet of the upgraded Young\'un only', () => {
    const { s: s0, a, b } = band();
    const s = core.setModelExp(ctx(s0), a, 25);
    expect(proven(s, a)).toBe(false);
    const t = core.setUnitUpgrade(ctx(s), a, true);
    expect(proven(t, a)).toBe(true);
    expect(proven(t, b)).toBe(false);
  });

  /* Rob, 7.11.2026: the upgrade waits for the 25 experience of the skill's text, greyed out, with the rule of Proven Warrior beside it. */
  it('waits for 25 experience, and carries the rule of Proven Warrior to read until then', () => {
    const { s, a } = band();
    const offer = rosterView(data, s).heroes.find((h) => h.uid === a)!.upgrade!;
    expect(offer.block).toMatch(/25 experience \(he has 0\)/);
    expect(offer.tips[0]!.name).toBe('Proven Warrior');
    expect(offer.tips[0]!.text).toMatch(/may only be taken by a Young.un with the Black Orc blood ability and 25 experience/);
    expect(offer.tips[0]!.text).toMatch(/yet still retains the title of Young.un/);
    expect(rosterView(data, core.setModelExp(ctx(s), a, 25)).heroes.find((h) => h.uid === a)!.upgrade!.block).toBeNull();
  });

  /* "... considered a full Black Orc Warrior (yet still retains the title of Young'un)" */
  it('is still called a Young\'un on the card once he has Proven Warrior, with the rules of a Black Orc', () => {
    const { s: s0, a } = band();
    const t = core.addSkillFromList(ctx(core.setUnitUpgrade(ctx(core.setModelExp(ctx(s0), a, 25)), a, true)), a, 'Proven Warrior');
    const w = rosterView(data, t).heroes.find((h) => h.uid === a)!;
    expect(w.type).toBe('Young\'un');
    expect(w.rules.map((r) => r.label)).toContain('Black Orc save (6+)');
  });
});
