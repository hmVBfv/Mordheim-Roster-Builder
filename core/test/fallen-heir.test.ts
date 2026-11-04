/* The gear of a fallen Hero whom a Prospect replaced is not lost: it went on. Only the Hero himself is (report of 4.11.2026). */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const model = (s: WarbandState, id: string) => s.models.find((m) => m.uid_def === id)!;

function band() {
  let s = core.newWarband(data, 'reavers');
  for (const id of ['conqueror', 'prospect']) s = core.addUnit(ctx(s), id);
  s = core.setEqQty(ctx(s), model(s, 'conqueror').uid, 'Schwert', 1);
  s = core.killHero(ctx(s), model(s, 'conqueror').uid);
  return s;
}

describe('what a fallen Hero cost the warband when a Prospect took his place', () => {
  it('counts gear that was handed on as not lost: the Hero himself stays lost, his gear does not', () => {
    const dead = band();
    const before = core.fallenGoldLost(ctx(dead));
    const price = core.unitBaseCost(ctx(dead), core.unitDef(ctx(dead), 'conqueror')!);
    expect(before).toBeGreaterThan(price); // the sword he bought is in it while nobody took it
    const s = core.promoteProspect(ctx(dead), model(dead, 'prospect').uid, dead.fallen![0]!.id!);
    expect(core.fallenGoldOf(ctx(s), s.fallen![0]!)).toBe(price);
    expect(core.fallenGoldLost(ctx(s))).toBe(price);
  });
});
