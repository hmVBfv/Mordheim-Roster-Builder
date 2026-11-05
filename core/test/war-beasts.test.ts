/* War Beasts of the Lustrian Reavers' Beastmaster (report of 5.11.2026, Rob's answers): an own section in his equipment, with each beast's stats and
   abilities and the limits on their number – up to two together, only with a Beastmaster, and each beast's own maximum. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const IDS = ['warhound', 'monkey', 'hawk'];
const band = (withMaster = true) => {
  const s = core.newWarband(data, 'reavers');
  return withMaster ? core.addUnit(ctx(s), 'beastmaster') : core.addUnit(ctx(s), 'conqueror');
};
const max = (s: WarbandState, id: string) => core.unitMax(ctx(s), core.unitDef(ctx(s), id)!);

describe('the Beastmaster\'s War Beasts are named and limited by data', () => {
  it('names the beasts it takes, and its rule text names them too', () => {
    const def = core.unitDef(ctx(band()), 'beastmaster')!;
    expect(def.beasts).toEqual(IDS);
    expect(def.beastMax).toBe(2);
    expect(def.sp).not.toMatch(/\(below\)/);
    for (const n of ['Warhound', 'Monkey', 'Hawk']) expect(def.sp).toContain(n);
  });

  it('are no beast without a Beastmaster, and two together with one', () => {
    for (const id of IDS) expect(max(band(false), id), id).toBe(0);
    expect(max(band(), 'warhound')).toBe(2);
    expect(max(band(), 'monkey')).toBe(1);
    expect(max(band(), 'hawk')).toBe(1);
  });

  it('count together: two hounds fill the place of two, a hound and a hawk too', () => {
    let s = band();
    s = core.addBeast(ctx(s), 'warhound');
    expect(max(s, 'monkey')).toBe(1);
    s = core.addBeast(ctx(s), 'hawk');
    expect(core.recruitStatus(ctx(s), 'monkey')!.atMax).toBe(true);
    expect(core.recruitStatus(ctx(s), 'warhound')!.atMax).toBe(true); // one hound and one hawk are the two
  });

  it('refuses a third beast and warns about one that is there without room', () => {
    let s = band();
    s = core.addBeast(ctx(s), 'warhound');
    s = core.addBeast(ctx(s), 'warhound');
    expect(core.addBeast(ctx(s), 'monkey')).toBe(s);
    expect(core.addBeast(ctx(s), 'warhound')).toBe(s);
    const t = core.removeUnit(ctx(s), s.models.find((m) => m.uid_def === 'beastmaster')!.uid);
    expect(core.warbandWarnings(ctx(t)).join('\n')).toMatch(/Too many Estalian Warhound/);
  });

  it('adds and drops a beast: a group grows and shrinks by one, the last one leaves', () => {
    let s = band();
    s = core.addBeast(ctx(s), 'warhound');
    s = core.addBeast(ctx(s), 'warhound');
    expect(core.modelsOf(ctx(s), 'warhound')).toBe(2);
    s = core.dropBeast(ctx(s), 'warhound');
    expect(core.modelsOf(ctx(s), 'warhound')).toBe(1);
    s = core.dropBeast(ctx(s), 'warhound');
    expect(s.models.some((m) => m.uid_def === 'warhound')).toBe(false);
    expect(core.dropBeast(ctx(s), 'warhound')).toBe(s);
  });

  it('are bought for their price: the warband pays it', () => {
    const s = band();
    const t = core.addBeast(ctx(s), 'hawk');
    expect(core.goldCurrent(ctx(t))).toBe(core.goldCurrent(ctx(s)) - core.unitBaseCost(ctx(t), core.unitDef(ctx(t), 'hawk')!));
  });
});
