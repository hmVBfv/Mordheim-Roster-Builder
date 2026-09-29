/* Founding prices versus the Trading Post (Rob, 29.09.2026, answers C2, C3,
   C7): some warband lists give an item a special price that holds only when
   the warband is founded; after its first battle the item is found at the
   Trading Post like any rare item, at the price there. The same holds for the
   Dwarfs' gromril weapons (3× instead of 4×) and the Dark Elf blade (+15
   instead of +20). docs/rules-audit.md, section C. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { Model, WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const last = (s: WarbandState): Model => s.models[s.models.length - 1]!;

/** A fresh warband with one unit, in the campaign at the given stage. */
function band(wb: string, unit: string, stage: number | null): WarbandState {
  let s = core.addUnit(ctx(core.newWarband(data, wb)), unit);
  if (stage != null) {
    s = core.setCampaignOn(ctx(s), true);
    s = core.setRound(ctx(s), stage);
  }
  return s;
}

describe('has the warband fought?', () => {
  it('not while it is being founded, nor outside the campaign', () => {
    expect(core.warbandHasFought(ctx(band('merc', 'capt', null)))).toBe(false);
    expect(core.warbandHasFought(ctx(band('merc', 'capt', 0)))).toBe(false);
    const off = core.setCampaignOn(ctx(band('merc', 'capt', 2)), false);
    expect(core.warbandHasFought(ctx(off))).toBe(false);
  });
  it('from the stage after its first battle', () => {
    expect(core.warbandHasFought(ctx(band('merc', 'capt', 1)))).toBe(true);
  });
});

describe('upgrades with a founding price', () => {
  it('gromril weapons cost Dwarfs three times the price at the founding, four times later', () => {
    for (const [stage, mult] of [[0, 3], [1, 4]] as const) {
      let s = band('dwarftreasure', 'noble', stage);
      s = core.setEqQty(ctx(s), last(s).uid, 'Axt', 1);
      expect(core.upgradePaid(ctx(s), last(s), 'Gromril-Waffe', 'Axt'), `stage ${stage}`).toBe(5 * mult);
    }
  });
  it('other warbands pay four times the price at any time', () => {
    let s = band('merc', 'capt', 0);
    s = core.setEqQty(ctx(s), last(s).uid, 'Axt', 1);
    expect(core.upgradePaid(ctx(s), last(s), 'Gromril-Waffe', 'Axt')).toBe(20);
  });
  it('the Dark Elf blade costs +15 gc at the founding, +20 gc later', () => {
    for (const [stage, price] of [[0, 15], [1, 20]] as const) {
      let s = band('darkelves', 'highborn', stage);
      s = core.setEqQty(ctx(s), last(s).uid, 'Schwert', 1);
      expect(core.upgradeBase(ctx(s), 'Dark-Elf-Klinge'), `stage ${stage}`).toBe(price);
      s = core.toggleWeaponUpgrade(ctx(s), last(s).uid, 'Dark-Elf-Klinge', 'Schwert', true);
      expect(last(s).rare?.['Dark-Elf-Klinge']?.paid).toBe(price);
    }
  });
});

describe('list items with a founding price', () => {
  it('are marked, and name what they cost at the Trading Post', () => {
    const aristocrat = core.unitDef(ctx(band('cavalcade', 'aristocrat', 0)), 'aristocrat');
    expect(core.startOnlyRow(ctx(band('cavalcade', 'aristocrat', 0)), aristocrat, 'Nightmare')).toMatchObject({ start: true, later: { de: 'Nightmare', cost: 95, rare: 'Rare 11' } });
    expect(core.startOnlyRow(ctx(band('cavalcade', 'aristocrat', 0)), aristocrat, 'Schwert')).toBeNull();
    const sw = band('shadowwarriors', 'shadowmaster', 0);
    expect(core.startOnlyRow(ctx(sw), core.unitDef(ctx(sw), 'shadowmaster'), 'Ithilmar-Schwert')?.later?.de).toBe('Ithilmar-Waffe');
  });
  it('can also be bought at the Trading Post, at its price there', () => {
    const s = band('cavalcade', 'aristocrat', 1);
    const offered = core.rareEligibleItems(ctx(s), last(s)).map((x) => x.de);
    expect(offered).toContain('Nightmare');
    const bd = band('blackdwarfs', 'sorcerer', 1);
    expect(core.rareEligibleItems(ctx(bd), last(bd)).map((x) => x.de)).toEqual(expect.arrayContaining(['Mechanischer Anzug', 'Engine of Chaos']));
    const s2 = core.addRare(ctx(s), last(s).uid, 'Nightmare');
    expect(last(s2).rare?.Nightmare?.paid).toBe(95);
  });
  it('items at their normal list price stay out of the Trading Post, as before', () => {
    const s = band('merc', 'capt', 1);
    expect(core.rareEligibleItems(ctx(s), last(s)).map((x) => x.de)).not.toContain('Schwert');
  });
});

describe('saves written before an item was renamed', () => {
  it('load with the new name', () => {
    const soh = band('sonsofhashut', 'sorcerer', null);
    const old = JSON.parse(JSON.stringify(soh)) as WarbandState;
    last(old).eq = { 'Dolch (1. gratis)': 1, Obsidianwaffe: 1 };
    const r = core.loadSave(data, old);
    expect(r.ok && last(r.state).eq).toEqual({ 'Dolch (1. gratis)': 1, 'Zharr-Obsidianwaffe': 1 });

    const sw = JSON.parse(JSON.stringify(band('shadowwarriors', 'shadowmaster', null))) as WarbandState;
    last(sw).eq = { 'Ithilmar-Waffe': 1 };
    last(sw).rare = { 'Banner von Nagarythe': { q: 1, paid: 80 }, 'Ithilmar-Waffe': { q: 1, on: 'Schwert', paid: 30 } };
    const r2 = core.loadSave(data, sw);
    expect(r2.ok && last(r2.state).eq).toEqual({ 'Ithilmar-Schwert': 1 });
    // the Trading Post upgrade of the same old name stays what it is
    expect(r2.ok && last(r2.state).rare).toEqual({ 'Standarte von Nagarythe': { q: 1, paid: 80 }, 'Ithilmar-Waffe': { q: 1, on: 'Schwert', paid: 30 } });
  });
  it('other warbands keep the old name: it is the Border Town Burning upgrade there', () => {
    const merc = JSON.parse(JSON.stringify(band('merc', 'capt', null))) as WarbandState;
    last(merc).rare = { Obsidianwaffe: { q: 1, on: 'Schwert', paid: 40 } };
    const r = core.loadSave(data, merc);
    expect(r.ok && last(r.state).rare).toEqual({ Obsidianwaffe: { q: 1, on: 'Schwert', paid: 40 } });
  });
});
