/* Units that start with fixed equipment (report of 2.11.2026, Rob's answer: "the cost is already in the price of the unit"): the five Heroes
   of the Lustrian Reavers. They carry it from the start – shown, in the exports, counted in the kinds of gear they may carry and look for –
   and it costs nothing on top. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const IDS = ['conqueror', 'slayer', 'beastmaster', 'shadow', 'trapmaster'];
const band = () => IDS.reduce((s, id) => core.addUnit(ctx(s), id), core.newWarband(data, 'reavers'));
const model = (s: WarbandState, id: string) => s.models.find((m) => m.uid_def === id)!;
const labels = (s: WarbandState, id: string) => core.eqDisplayItems(ctx(s), model(s, id)).map((x) => x.label);

describe('what the Reavers\' Heroes start with', () => {
  it('is named for each of them, as the unit\'s own text says it', () => {
    for (const id of IDS) {
      const d = data.WARBANDS.reavers!.units.find((u) => u.id === id)!;
      expect(d.gear?.length, id).toBeGreaterThan(0);
      // every piece the text names is there: the text and the data say the same
      const words = (d.gear ?? []).join(' ').toLowerCase();
      for (const w of /^Starts with ([^.]*)\./.exec(d.sp ?? '')![1]!.toLowerCase().replace(/ and /g, ', ').split(/,\s*/)) {
        const piece = w.replace(/^(a|an|two)\s+/, '').replace(/\(.*\)/, '').trim().replace(/s$/, '');
        expect(words, `${id}: ${piece}`).toContain(piece.split(' ')[0]!);
      }
    }
  });

  it('is on the Conqueror\'s card, and not bought', () => {
    const s = band();
    expect(labels(s, 'conqueror')).toEqual(expect.arrayContaining(['Masterwork Heavy Armour', 'Bec de Corbin', 'Helmet']));
    expect(labels(s, 'trapmaster')).toEqual(expect.arrayContaining(['Firepots']));
    // the unit's price is all there is: the warband costs what its men cost
    const cost = IDS.reduce((n, id) => n + (data.WARBANDS.reavers!.units.find((u) => u.id === id)!.cost), 0);
    expect(core.totalSpent(ctx(s))).toBe(cost);
  });

  it('counts for the kinds of gear he may carry and look for: the Conqueror has heavy armour, so he may find it', () => {
    const s = band();
    const conq = model(s, 'conqueror');
    expect(core.unitFamilies(ctx(s), core.unitDef(ctx(s), 'conqueror')).has('heavyarmour')).toBe(true);
    const onlyList = core.unitFamilies(ctx(core.newWarband(data, 'reavers')), core.unitDef(ctx(s), 'shadow'));
    expect(onlyList.has('heavyarmour')).toBe(false);
    expect(core.rareEligibleItems(ctx(s), conq).some((i) => /Gromril|Ithilmar|Schwere/i.test(i.de))).toBe(true);
  });

  it('puts a ranged weapon in the hand of the Shadow and the Trapmaster', () => {
    const s = band();
    expect(core.modelHasRanged(ctx(s), model(s, 'shadow'))).toBe(true);
    expect(core.modelHasRanged(ctx(s), model(s, 'trapmaster'))).toBe(true);
    expect(core.modelHasRanged(ctx(s), model(s, 'conqueror'))).toBe(false);
  });
});
