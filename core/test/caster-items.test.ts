/* Items for spellcasters only (report #30): a Wizard of the warband may take the Familiar, a fighter may not. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { Model, WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const model = (s: WarbandState, uid: number) => s.models.find((m) => m.uid === uid) as Model;

describe('items for spellcasters only', () => {
  function possessed() {
    let s = core.newWarband(data, 'possessed');
    for (const id of ['mag', 'poss', 'mut']) s = core.addUnit(ctx(s), id);
    const [mag, , mut] = s.models.map((m) => m.uid) as [number, number, number];
    s = structuredClone(s);
    s.campaign = { ...s.campaign, on: true, round: 1 };
    return { s, mag, mut };
  }
  const familiar = { key: 'Vertrauter', rare: true };

  it('a Wizard of the warband may take the Familiar, a fighter may not', () => {
    const { s, mag, mut } = possessed();
    expect(core.canReceive(ctx(s), mag, familiar).ok).toBe(true);
    expect(core.canReceive(ctx(s), mut, familiar)).toMatchObject({ ok: false, reason: 'kept for other warbands or warriors' });
  });

  it('is on the Wizard\'s list of rare items, not on the fighter\'s', () => {
    const { s, mag, mut } = possessed();
    const has = (uid: number) => core.rareEligibleItems(ctx(s), model(s, uid)).some((it) => it.de === 'Vertrauter');
    expect(has(mag)).toBe(true);
    expect(has(mut)).toBe(false);
  });

  it('a warrior who was made a caster by hand may take it as well', () => {
    const { s, mut } = possessed();
    const caster = structuredClone(s);
    model(caster, mut).caster = true;
    expect(core.canReceive(ctx(caster), mut, familiar).ok).toBe(true);
  });
});
