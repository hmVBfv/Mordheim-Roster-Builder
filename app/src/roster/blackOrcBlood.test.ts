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
    const { s, boss, a, b } = band();
    const offer = (t: WarbandState, uid: number) => rosterView(data, t).heroes.find((h) => h.uid === uid)!.upgrade;
    expect(offer(s, boss)).toBeNull();
    expect(offer(s, a)).toEqual({ name: 'Black Orc Blood', cost: 10, on: false });
    const t = core.setUnitUpgrade(ctx(s), a, true);
    expect(offer(t, a)).toEqual({ name: 'Black Orc Blood', cost: 10, on: true });
    expect(offer(t, b)).toBeNull(); // only one in the warband
  });

  it('opens Proven Warrior on the advance sheet of the upgraded Young\'un only', () => {
    const { s, a, b } = band();
    expect(proven(s, a)).toBe(false);
    const t = core.setUnitUpgrade(ctx(s), a, true);
    expect(proven(t, a)).toBe(true);
    expect(proven(t, b)).toBe(false);
  });
});
