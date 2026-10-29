/* The Sea dragon cloak (report #137, Rob, 29.10.2026): it improves armour saves (+2 against shooting, +1 in close combat,
   combines with armour), so the Sv shown on a card counts the worse one, +1, and carries an asterisk. The legacy Sv
   (`svOfModel`, which the exports and the parity suite use) is left alone. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: core.WarbandState) => core.ctxOf(data, s);

function band(armour: string | null, cloak: boolean) {
  let s = core.newWarband(data, 'merc');
  s = core.addUnit(ctx(s), 'capt');
  const uid = s.models[0]!.uid;
  if (armour) s = core.setEqQty(ctx(s), uid, armour, 1);
  if (cloak) s = core.addRare(ctx(s), uid, 'Seedrachen-Umhang');
  return { s, m: s.models[0]! };
}

describe('the Sea dragon cloak and the Sv on a card (#137)', () => {
  it('improves the save by one and marks it, on top of armour', () => {
    const { s, m } = band('Leichte Rüstung', true);
    expect(core.svShown(ctx(s), m)).toEqual({ value: 5, starred: true });
    expect(core.svShownLabel(ctx(s), m)).toBe('5+*');
  });

  it('gives a model without armour 6+ (a cloak is a modifier, as a shield is)', () => {
    const { s, m } = band(null, true);
    expect(core.svShownLabel(ctx(s), m)).toBe('6+*');
  });

  it('counts a better armour one step better', () => {
    const { s, m } = band('Gromril-Rüstung', true);
    expect(core.svShownLabel(ctx(s), m)).toBe('3+*');
    const two = core.svShown(ctx(s), { ...m, skills: ['Well ’Ard'] });
    expect(two.value).toBeGreaterThanOrEqual(2);
  });

  it('is the old Sv, unmarked, without the cloak; and the legacy Sv ignores the cloak', () => {
    const { s, m } = band('Leichte Rüstung', false);
    expect(core.svShownLabel(ctx(s), m)).toBe('6+');
    const withCloak = band('Leichte Rüstung', true);
    expect(core.svOfModel(ctx(withCloak.s), withCloak.m)).toBe(6);
  });
});
