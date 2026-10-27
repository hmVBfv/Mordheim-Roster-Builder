/* The house rule "no racial maximums" (wish #106, Rob, 27.10.2026): a human may be advanced past Strength 4. Off by default,
   declared on export; only the limit of the race goes, a Henchman still raises each characteristic once. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

function band(on: boolean) {
  let s = core.newWarband(data, 'merc');
  s = core.addUnit(ctx(s), 'capt');
  s = core.addUnit(ctx(s), 'warr');
  if (on) s = core.setHouseBool(ctx(s), 'noRacialMax', true);
  return { s, capt: s.models.find((m) => m.uid_def === 'capt')!.uid, warr: s.models.find((m) => m.uid_def === 'warr')!.uid };
}

/** Raises Strength until the race stops it (or ten times). */
function strengthUp(s: WarbandState, uid: number): WarbandState {
  for (let i = 0; i < 10; i++) s = core.addAdvance(ctx(s), uid, 'S');
  return s;
}

describe('no racial maximums', () => {
  it('is off by default, and a human stops at Strength 4', () => {
    const { s, capt } = band(false);
    expect(core.houseRules(s).noRacialMax).toBe(false);
    const up = strengthUp(s, capt);
    expect(core.effProfile(ctx(up), up.models.find((m) => m.uid === capt)!)!.S).toBe(4);
  });

  it('on, he goes past it', () => {
    const { s, capt } = band(true);
    const up = strengthUp(s, capt);
    expect(Number(core.effProfile(ctx(up), up.models.find((m) => m.uid === capt)!)!.S)).toBeGreaterThan(4);
    expect(core.canAdv(ctx(up), up.models.find((m) => m.uid === capt)!, 'S')).toBe(true);
  });

  it('a Henchman still raises each characteristic once', () => {
    const { s, warr } = band(true);
    const up = strengthUp(s, warr);
    expect(up.models.find((m) => m.uid === warr)!.adv?.S).toBe(1);
  });

  it('is declared on export', () => {
    const { s } = band(true);
    expect(core.houseDeviations(ctx(s)).map((d) => d.key)).toContain('noRacialMax');
    expect(core.HOUSE_RULE_KEYS).toContain('noRacialMax');
    expect(core.houseDeviations(ctx(band(false).s)).map((d) => d.key)).not.toContain('noRacialMax');
  });
});
