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
  s = core.setEqQty(ctx(s), uid, 'Dolch (1. gratis)', 2);
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

describe('Dark Elf blade, and Dark venom as a poison (#112, #118)', () => {
  function elf() {
    let s = core.newWarband(data, 'darkelves');
    s = core.addUnit(ctx(s), 'highborn');
    const uid = s.models[0]!.uid;
    s = core.setEqQty(ctx(s), uid, 'Schwert', 1);
    return { s, uid };
  }

  it('the blade carries a founding price; the venom is no upgrade at all, but a poison on the list', () => {
    const { s, uid } = elf();
    expect(core.upgradeStart(ctx(s), 'Dark-Elf-Klinge')?.base).toBe(15);
    expect(core.isUpgrade(data, 'Dunkles Gift')).toBe(false);
    expect(core.itemGroup(ctx(s), 'Dunkles Gift')).toBe('Poisons and Drugs');
    expect(core.isConsumable(ctx(s), 'Dunkles Gift')).toBe(true);
    expect(core.isConsumable(ctx(s), 'Schwert')).toBe(false);
    // on the list of the Dark Elf Heroes at 15 gc, not on the Corsairs' or the Shades'
    const list = core.eqListFor(ctx(s), core.unitDef(ctx(s), 'highborn'))!;
    expect(list.Besonderes!.find((r) => r[0] === 'Dunkles Gift')).toEqual(['Dunkles Gift', 15, { heroes: true }]);
    const t = core.setListQty(ctx(s), uid, 'Dunkles Gift', 1);
    expect(held(t, uid).eq?.['Dunkles Gift']).toBe(1);
    expect(core.eqCost(ctx(t), held(t, uid))).toBeGreaterThanOrEqual(15);
  });

  it('used up is taking it off the list again, at its price back', () => {
    const { s, uid } = elf();
    const before = core.eqCost(ctx(s), held(s, uid));
    let t = core.setListQty(ctx(s), uid, 'Dunkles Gift', 1);
    t = core.setListQty(ctx(t), uid, 'Dunkles Gift', 0);
    expect(held(t, uid).eq?.['Dunkles Gift']).toBeUndefined();
    expect(core.eqCost(ctx(t), held(t, uid))).toBe(before);
  });

  it('the blade goes on the sword at the founding price', () => {
    const { s, uid } = elf();
    const t = core.addRare(ctx(s), uid, 'Dark-Elf-Klinge');
    expect(core.rareCost(held(t, uid))).toBe(15);
  });
});

describe('one upgrade on the weapon you choose, never on the free dagger (#115)', () => {
  it('the free dagger takes none; the second one does', () => {
    const { s, uid } = rangers();
    let one = core.setEqQty(ctx(s), uid, 'Dolch (1. gratis)', 1);
    expect(core.upgradeFree(ctx(one), held(one, uid), 'Gromril-Waffe').map((w) => w.nm)).toEqual(['Schwert']);
    expect(core.upgradeFree(ctx(s), held(s, uid), 'Gromril-Waffe').map((w) => w.nm).sort()).toEqual(['Dolch (1. gratis)', 'Schwert']);
    // two daggers: one is the free one, so one can be upgraded – and only one
    const t = core.setUpgradeOn(ctx(s), uid, 'Gromril-Waffe', 'Dolch (1. gratis)', true);
    expect(core.upgradeSlots(held(t, uid), 'Gromril-Waffe')).toEqual([{ on: 'Dolch (1. gratis)', paid: 6 }]);
    expect(core.setUpgradeOn(ctx(t), uid, 'Gromril-Waffe', 'Dolch (1. gratis)', true)).toBe(t);
    one = core.setUpgradeOn(ctx(one), uid, 'Gromril-Waffe', 'Dolch (1. gratis)', true);
    expect(held(one, uid).rare?.['Gromril-Waffe']).toBeUndefined();
  });

  it('puts one on a chosen weapon and takes one off it again', () => {
    const { s, uid } = rangers();
    let t = core.setUpgradeOn(ctx(s), uid, 'Gromril-Waffe', 'Schwert', true);
    t = core.setUpgradeOn(ctx(t), uid, 'Gromril-Waffe', 'Dolch (1. gratis)', true);
    expect(core.upgradeSlots(held(t, uid), 'Gromril-Waffe').map((x) => x.on)).toEqual(['Schwert', 'Dolch (1. gratis)']);
    t = core.setUpgradeOn(ctx(t), uid, 'Gromril-Waffe', 'Schwert', false);
    expect(core.upgradeSlots(held(t, uid), 'Gromril-Waffe')).toEqual([{ on: 'Dolch (1. gratis)', paid: 6 }]);
    expect(held(t, uid).rare!['Gromril-Waffe']!.q).toBe(1);
  });

  it('a flat upgrade goes the same way', () => {
    let s = core.newWarband(data, 'darkelves');
    s = core.addUnit(ctx(s), 'highborn');
    const uid = s.models[0]!.uid;
    s = core.setEqQty(ctx(s), uid, 'Schwert', 1);
    s = core.setUpgradeOn(ctx(s), uid, 'Dark-Elf-Klinge', 'Schwert', true);
    expect(core.upgradeSlots(held(s, uid), 'Dark-Elf-Klinge')).toEqual([{ on: 'Schwert', paid: 15 }]);
  });
});

describe('taking a weapon away takes its upgrade with it (#115)', () => {
  it('through the list: the copy on a weapon that is no longer carried goes, the others stay', () => {
    const { s, uid } = rangers();
    let t = core.setUpgradeOn(ctx(s), uid, 'Gromril-Waffe', 'Schwert', true);
    t = core.setUpgradeOn(ctx(t), uid, 'Gromril-Waffe', 'Dolch (1. gratis)', true);
    t = core.setListQty(ctx(t), uid, 'Schwert', 0);
    expect(core.upgradeSlots(held(t, uid), 'Gromril-Waffe').map((x) => x.on)).toEqual(['Dolch (1. gratis)']);
    // the second dagger goes: the one upgraded went with it, the free one cannot carry it
    t = core.setListQty(ctx(t), uid, 'Dolch (1. gratis)', 1);
    expect(held(t, uid).rare?.['Gromril-Waffe']).toBeUndefined();
  });
});
