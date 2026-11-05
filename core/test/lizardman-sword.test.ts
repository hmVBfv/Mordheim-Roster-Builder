/* The Saurus Slayer's Lizardman Sword (report of 5.11.2026): it turns one of his swords into a Lizardman Sword (+1 to wound, poison) for 30 gc, like
   the Dark Elf blade does for a sword or dagger, and is not a weapon of its own. His swords are his fixed gear, so a fixed weapon takes an upgrade. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const DE = 'Echsenschwert';
const slayer = () => {
  const s = core.addUnit(ctx(core.newWarband(data, 'reavers')), 'slayer');
  return { s, uid: s.models[0]!.uid };
};
const held = (s: WarbandState, uid: number) => s.models.find((m) => m.uid === uid)!;

describe('the Lizardman Sword is an upgrade of a sword', () => {
  it('is a flat upgrade of the Reavers for swords, for Heroes, at 30 gc', () => {
    expect(data.UPGRADES[DE]).toMatchObject({ fams: ['sword'], heroesOnly: true, wb: ['reavers'], mult: 0, base: 30 });
  });

  it('takes one of the Slayer\'s swords: two targets, two copies at most, none on his dagger', () => {
    const { s, uid } = slayer();
    const m = held(s, uid);
    expect(core.upgradeTargets(ctx(s), m, DE).map((w) => w.nm)).toEqual(['Sword']);
    expect(core.upgradeFree(ctx(s), m, DE)).toHaveLength(1);
    let t = core.setUpgradeOn(ctx(s), uid, DE, 'Sword', true);
    expect(core.upgradeSlots(held(t, uid), DE)).toEqual([{ on: 'Sword', paid: 30 }]);
    t = core.setUpgradeOn(ctx(t), uid, DE, 'Sword', true); // the second sword
    expect(core.upgradeSlots(held(t, uid), DE)).toHaveLength(2);
    expect(core.setUpgradeOn(ctx(t), uid, DE, 'Sword', true)).toBe(t); // a third copy has no sword to go on
    expect(core.setUpgradeOn(ctx(s), uid, DE, 'Misericordia', true)).toBe(s);
  });

  it('is on his sword in the display, costs 30 gc and is not a weapon of its own', () => {
    const { s, uid } = slayer();
    const before = core.modelUnitCost(ctx(s), held(s, uid));
    const t = core.setUpgradeOn(ctx(s), uid, DE, 'Sword', true);
    expect(core.modelUnitCost(ctx(t), held(t, uid))).toBe(before + 30);
    const labels = core.eqDisplayItems(ctx(t), held(t, uid)).map((x) => x.label);
    expect(labels).toContain('Sword [Lizardman Sword]');
    expect(labels.filter((l) => l === 'Sword')).toHaveLength(1);
    expect(labels).not.toContain('Lizardman Sword');
  });

  it('is offered next to the weapon, not in the list of rare items, and only to the Slayer', () => {
    const { s, uid } = slayer();
    expect(core.weaponUpgradesFor(ctx(s), held(s, uid), 'Sword').map((x) => x.de)).toContain(DE);
    expect(core.rareEligibleItems(ctx(s), held(s, uid)).some((i) => i.de === DE)).toBe(false);
    let w = core.newWarband(data, 'reavers');
    w = core.addUnit(ctx(w), 'conqueror');
    expect(core.weaponUpgradesFor(ctx(w), w.models[0]!, 'Sword').map((x) => x.de)).not.toContain(DE);
  });

  it('goes away with the sword when he sells it', () => {
    const { s, uid } = slayer();
    let t = core.setUpgradeOn(ctx(s), uid, DE, 'Sword', true);
    t = core.setUpgradeOn(ctx(t), uid, DE, 'Sword', false);
    expect(held(t, uid).rare?.[DE]).toBeUndefined();
  });

  it('goes with the sword when it is sold after the first battle', () => {
    const { s, uid } = slayer();
    let t = core.setUpgradeOn(ctx(s), uid, DE, 'Sword', true);
    t = structuredClone(t);
    t.campaign = { ...t.campaign, on: true, round: 1 };
    const one = core.sellStartGear(ctx(t), uid, 'Sword');
    expect(one.reason).toBe('');
    expect(held(one.state, uid).rare?.[DE]).toMatchObject({ on: 'Sword' }); // the other sword still has room for it
    const both = core.sellStartGear(ctx(one.state), uid, 'Sword');
    expect(held(both.state, uid).rare?.[DE]).toBeUndefined(); // no sword left to carry it
  });
});

describe('the Lizardman Sword is not a weapon to buy from his list', () => {
  it('has no row of its own in the Slayer\'s list', () => {
    const rows = Object.values(data.LISTS.lrSlayer!).flatMap((g) => (Array.isArray(g) ? g.map((r) => r[0]) : []));
    expect(rows).not.toContain(DE);
  });
});
