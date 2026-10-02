/* The equipment a card shows, with the items each entry stands for, so the
   new roster can explain the words in a bubble (docs/ui.md §5). The labels
   are the Roster Builder's (eqDisplayParts, rareDisplayParts; the parity
   suite compares them); these tests state the items behind them. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

function champion() {
  let s = core.newWarband(data, 'merc');
  s = core.addUnit(ctx(s), 'champ');
  return { s, uid: s.models[0]!.uid };
}

describe('equipment with its items', () => {
  it('the free dagger is the dagger', () => {
    const { s } = champion();
    expect(core.eqDisplayItems(ctx(s), s.models[0]!)).toEqual([{ label: 'Dagger', items: ['Dolch'] }]);
  });

  it('a brace of pistols is the pistol, and so is a third one', () => {
    const { s: s0, uid } = champion();
    let s = core.setEqQty(ctx(s0), uid, 'Pistole', 2);
    expect(core.eqDisplayItems(ctx(s), s.models[0]!)).toContainEqual({ label: 'Brace of Pistols', items: ['Pistole'] });
    s = core.setEqQty(ctx(s), uid, 'Pistole', 3);
    const items = core.eqDisplayItems(ctx(s), s.models[0]!);
    expect(items).toContainEqual({ label: 'Brace of Pistols', items: ['Pistole'] });
    expect(items).toContainEqual({ label: '1× Pistol', items: ['Pistole'] });
  });

  it('a weapon with an upgrade stands for both', () => {
    // Dark Elves: the blade is fitted to a weapon and shown on it
    let s = core.newWarband(data, 'darkelves');
    s = core.addUnit(ctx(s), 'highborn');
    const uid = s.models[0]!.uid;
    s = core.setEqQty(ctx(s), uid, 'Schwert', 1);
    s = core.addRare(ctx(s), uid, 'Dark-Elf-Klinge');
    s = core.setRareTarget(ctx(s), uid, 'Dark-Elf-Klinge', 'Schwert');
    expect(core.eqDisplayItems(ctx(s), s.models[0]!)).toContainEqual({ label: 'Sword [Dark Elf blade]', items: ['Schwert', 'Dark-Elf-Klinge'] });
    // the blade is on the weapon, not carried on its own
    expect(core.rareDisplayItems(ctx(s), s.models[0]!)).toEqual([]);
  });

  it('a rare item carried on its own is that item', () => {
    const { s: s0, uid } = champion();
    const s = core.addRare(ctx(s0), uid, 'Glücksbringer');
    expect(core.rareDisplayItems(ctx(s), s.models[0]!)).toEqual([{ label: 'Lucky charm', items: ['Glücksbringer'] }]);
  });

  it('the labels are those of the Roster Builder', () => {
    const { s: s0, uid } = champion();
    let s = core.setEqQty(ctx(s0), uid, 'Pistole', 3);
    s = core.addRare(ctx(s), uid, 'Glücksbringer');
    const m = s.models[0]!;
    expect(core.eqDisplayParts(ctx(s), m)).toEqual(core.eqDisplayItems(ctx(s), m).map((x) => x.label));
    expect(core.rareDisplayParts(ctx(s), m)).toEqual(core.rareDisplayItems(ctx(s), m).map((x) => x.label));
  });
});
