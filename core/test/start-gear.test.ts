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

/* Rob, 2.11.2026: the masterwork armour is not ordinary heavy armour – 4+ on the card, in the export and for the Tabletop Simulator; the
   Reavers may sell what they start with, for half the price (it only was in the price of the man), and what they start with sets the
   classes of weapon and armour they may carry and look for. */
describe('the Conqueror\'s masterwork armour', () => {
  it('saves on 4+, on the card and in the exports and the Tabletop Simulator text', () => {
    const s = band();
    const c = model(s, 'conqueror');
    expect(core.svOfModel(ctx(s), c)).toBe(4);
    expect(core.svShown(ctx(s), c).value).toBe(4);
    expect(core.ttsText(ctx(s), c)).toContain('Sv 4+');
    // the others keep the heavy armour of their own text
    expect(core.svOfModel(ctx(s), model(s, 'slayer'))).toBe(5);
  });
});

describe('what the Reavers start with can be sold (Rob, 2.11.2026)', () => {
  const afterBattle = () => { const s = structuredClone(band()); s.campaign = { ...s.campaign, on: true, round: 1 }; return s; };
  const uid = (s: WarbandState, id: string) => model(s, id).uid;

  it('after the first battle, for half its price, and then the man no longer carries it', () => {
    let s = afterBattle();
    const gold = core.goldCurrent(ctx(s));
    const t = core.sellStartGear(ctx(s), uid(s, 'conqueror'), 'Masterwork Heavy Armour');
    expect(t.reason).toBe('');
    s = t.state;
    // half of the 50 gc of the catalogue
    expect(core.goldCurrent(ctx(s))).toBe(gold + 25);
    expect(labels(s, 'conqueror')).not.toContain('Masterwork Heavy Armour');
    expect(labels(s, 'conqueror')).toEqual(expect.arrayContaining(['Bec de Corbin', 'Helmet']));
    // the save was the armour's
    expect(core.svOfModel(ctx(s), model(s, 'conqueror'))).toBeGreaterThan(4);
    // his sort of gear stays what his rules start him with: he still may look for heavy armour
    expect(core.unitFamilies(ctx(s), core.unitDef(ctx(s), 'conqueror')).has('heavyarmour')).toBe(true);
  });

  it('only once, per piece he has: two swords can be sold twice', () => {
    let s = afterBattle();
    const slayer = uid(s, 'slayer');
    for (let i = 0; i < 2; i++) { const t = core.sellStartGear(ctx(s), slayer, 'Sword'); expect(t.reason, `sword ${i}`).toBe(''); s = t.state; }
    expect(core.sellStartGear(ctx(s), slayer, 'Sword').ok).toBe(false);
    expect(labels(s, 'slayer').filter((l) => l === 'Sword')).toEqual([]);
  });

  it('not before the first battle, and not a piece the catalogue has no price for unless the player names one', () => {
    const early = band();
    expect(core.sellStartGear(ctx(early), uid(early, 'conqueror'), 'Helmet').ok).toBe(false);
    const s = afterBattle();
    const trap = uid(s, 'trapmaster');
    expect(core.sellStartGear(ctx(s), trap, 'Firepots').reason).toMatch(/no price/i);
    const named = core.sellStartGear(ctx(s), trap, 'Firepots', { price: 7 });
    expect(named.ok).toBe(true);
    expect(core.goldCurrent(ctx(named.state))).toBe(core.goldCurrent(ctx(s)) + 7);
    expect(core.sellStartGear(ctx(s), trap, 'Sword of Doom').ok).toBe(false);
  });

  it('is shown no more in the exports, and a ranged weapon sold is no ranged weapon any more', () => {
    let s = afterBattle();
    const shadow = uid(s, 'shadow');
    expect(core.modelHasRanged(ctx(s), model(s, 'shadow'))).toBe(true);
    s = core.sellStartGear(ctx(s), shadow, 'Javelins').state;
    expect(core.modelHasRanged(ctx(s), model(s, 'shadow'))).toBe(false);
    expect(core.eqSummaryParts(ctx(s), model(s, 'shadow'))).not.toContain('Javelins');
  });
});

describe('the classes of weapon and armour that what they start with sets', () => {
  it('the Bec de Corbin is a two-handed weapon, the Misericordia a dagger, the rifle a long gun', () => {
    expect(core.itemFamily(data, 'Bec de Corbin')).toBe('twohanded');
    expect(core.itemFamily(data, 'Misericordia')).toBe('dagger');
    expect(core.itemFamily(data, 'Tilean Hunting Rifle (treat as a Hochland Long Rifle)')).toBe('longgun');
  });

  it('every piece that has a class of weapon or armour puts it among the classes of the man', () => {
    const s = band();
    for (const id of IDS) {
      const d = core.unitDef(ctx(s), id)!;
      const fam = core.unitFamilies(ctx(s), d);
      for (const g of d.gear ?? []) { const f = core.itemFamily(data, g); if (f) expect(fam.has(f), `${id}: ${g} (${f})`).toBe(true); }
    }
  });
});
