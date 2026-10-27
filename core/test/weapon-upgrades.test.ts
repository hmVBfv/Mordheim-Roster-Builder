/* Weapon upgrades on more than one weapon (reports #109, #110, #112): a Dwarf Ranger Hero may upgrade his sword and his dagger to
   gromril, each at its own price, and the unit shows which weapon is which ("Dagger (Gromril)"). The Dark Elf blade and Dark venom
   are bought at the founding like them; Dark venom is used up. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

function rangers() {
  let s = core.newWarband(data, 'dwarfrangers');
  s = core.addUnit(ctx(s), 'runesmith');
  const uid = s.models[0]!.uid;
  s = core.setEqQty(ctx(s), uid, 'Schwert', 1);
  s = core.setEqQty(ctx(s), uid, 'Dolch (1. gratis)', 1);
  return { s, uid };
}
const held = (s: WarbandState, uid: number) => s.models.find((m) => m.uid === uid)!;

describe('gromril on more than one weapon (#110)', () => {
  it('a second gromril weapon goes on the next weapon, each at the founding price of its own', () => {
    const { s, uid } = rangers();
    let t = core.addRare(ctx(s), uid, 'Gromril-Waffe');
    t = core.addRare(ctx(t), uid, 'Gromril-Waffe');
    const slots = core.upgradeSlots(held(t, uid), 'Gromril-Waffe');
    expect(slots.map((x) => x.on).sort()).toEqual(['Dolch (1. gratis)', 'Schwert']);
    expect(slots.map((x) => x.paid).sort((a, b) => a - b)).toEqual([6, 30]);
    expect(held(t, uid).rare!['Gromril-Waffe']!.q).toBe(2);
    expect(core.rareCost(held(t, uid))).toBe(36);
  });

  it('a third one finds no weapon left', () => {
    const { s, uid } = rangers();
    let t = core.addRare(ctx(s), uid, 'Gromril-Waffe');
    t = core.addRare(ctx(t), uid, 'Gromril-Waffe');
    expect(core.upgradeFree(ctx(t), held(t, uid), 'Gromril-Waffe')).toEqual([]);
    expect(core.addRare(ctx(t), uid, 'Gromril-Waffe')).toBe(t);
  });

  it('moving one to another weapon reprices it; removing one keeps the other', () => {
    const { s, uid } = rangers();
    let t = core.addRare(ctx(s), uid, 'Gromril-Waffe');
    const first = core.upgradeSlots(held(t, uid), 'Gromril-Waffe')[0]!;
    const other = first.on === 'Schwert' ? 'Dolch (1. gratis)' : 'Schwert';
    t = core.setRareTarget(ctx(t), uid, 'Gromril-Waffe', other, 0);
    expect(core.upgradeSlots(held(t, uid), 'Gromril-Waffe')[0]).toMatchObject({ on: other, paid: other === 'Schwert' ? 30 : 6 });
    t = core.addRare(ctx(t), uid, 'Gromril-Waffe');
    t = core.removeUpgradeSlot(ctx(t), uid, 'Gromril-Waffe', 0);
    const rest = core.upgradeSlots(held(t, uid), 'Gromril-Waffe');
    expect(rest).toHaveLength(1);
    expect(rest[0]!.on).toBe(first.on);
    expect(held(t, uid).rare!['Gromril-Waffe']!.q).toBe(1);
    expect(core.removeUpgradeSlot(ctx(t), uid, 'Gromril-Waffe', 0).models[0]!.rare).toEqual({});
  });
});

describe('the unit shows the weapon (#109)', () => {
  it('"Dagger (Gromril)" and "Sword (Gromril)", not just "Gromril weapon"', () => {
    const { s, uid } = rangers();
    let t = core.addRare(ctx(s), uid, 'Gromril-Waffe');
    t = core.addRare(ctx(t), uid, 'Gromril-Waffe');
    const parts = core.rareDisplayParts(ctx(t), held(t, uid));
    expect(parts.sort()).toEqual(['Dagger (Gromril)', 'Sword (Gromril)']);
  });
});

describe('Dark Elf upgrades at the founding (#112)', () => {
  function elf() {
    let s = core.newWarband(data, 'darkelves');
    s = core.addUnit(ctx(s), 'highborn');
    const uid = s.models[0]!.uid;
    s = core.setEqQty(ctx(s), uid, 'Schwert', 1);
    return { s, uid };
  }

  it('the blade and the venom both carry a founding price', () => {
    const { s } = elf();
    expect(core.upgradeStart(ctx(s), 'Dark-Elf-Klinge')?.base).toBe(15);
    expect(core.upgradeStart(ctx(s), 'Dunkles Gift')?.base).toBe(15);
  });

  it('both can sit on the sword; the venom is used up (taken off) by removing it', () => {
    const { s, uid } = elf();
    let t = core.addRare(ctx(s), uid, 'Dark-Elf-Klinge');
    t = core.addRare(ctx(t), uid, 'Dunkles Gift');
    expect(core.rareCost(held(t, uid))).toBe(30);
    expect(core.upgradeOnce(ctx(t), 'Dunkles Gift')).toBe(true);
    expect(core.upgradeOnce(ctx(t), 'Dark-Elf-Klinge')).toBe(false);
    t = core.removeUpgradeSlot(ctx(t), uid, 'Dunkles Gift', 0);
    expect(Object.keys(held(t, uid).rare!)).toEqual(['Dark-Elf-Klinge']);
  });
});
