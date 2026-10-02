/* What the "More men" sheet offers (phase 3c, veterans roll). */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { data } from '../test/data.ts';
import { moreMenVerdict, moreMenView } from './men.ts';
import { createWarband } from './view.ts';

const ctx = (s: WarbandState) => core.ctxOf(data, s);

function band(round: number, exp = 3) {
  let s = createWarband(data, 'merc', null, '');
  for (const id of ['capt', 'warr']) s = core.addUnit(ctx(s), id);
  const warr = s.models[1]!.uid;
  s = core.setQty(ctx(s), warr, 2);
  s = core.setModelExp(ctx(s), warr, exp);
  s = structuredClone(s);
  s.campaign = { ...s.campaign, on: true, round };
  return { s: core.ensureLedger(ctx(s)), warr };
}

describe('more men', () => {
  it('price: the unit with the group\'s gear, and 2 gc per point of experience', () => {
    const { s, warr } = band(0);
    const v = moreMenView(ctx(s), warr)!;
    expect(v).toMatchObject({ max: 3, exp: 3, perExp: 2, surcharge: 6, each: v.base + 6, veterans: null, goldBinds: false });
    expect(v.fallbacks).toEqual(['Warrior 3', 'Warrior 4', 'Warrior 5']);
    expect(moreMenVerdict(v, 3, null)).toBe('');
  });

  it('after the first battle: the veterans roll bounds what new men bring', () => {
    const { s, warr } = band(1);
    const v = moreMenView(ctx(s), warr)!;
    expect(v.veterans).toEqual({ roll: null, spent: 0 });
    expect(moreMenVerdict(v, 1, null)).toBe('Enter the veterans roll, 2–12.');
    expect(moreMenVerdict(v, 2, 5)).toBe('2 men bring 6 experience; 5 of the roll are left.');
    expect(moreMenVerdict(v, 1, 5)).toBe('');
    const used = core.addMen(ctx(core.setVeteransRoll(ctx(s), 8)), warr, 2);
    const w = moreMenView(ctx(used), warr)!;
    expect(w.veterans).toEqual({ roll: 8, spent: 6 });
    expect(moreMenVerdict(w, 1, 5)).toBe('New men have already brought 6 experience this round.');
  });

  it('a fresh group needs no roll; gold binds after the first battle', () => {
    const { s, warr } = band(1, 0);
    const v = moreMenView(ctx(s), warr)!;
    expect(v.veterans).toBe(null);
    expect(moreMenVerdict({ ...v, gold: v.each - 1 }, 1, null)).toBe(`Not enough gold: ${v.each - 1} gc in hand.`);
  });
});
