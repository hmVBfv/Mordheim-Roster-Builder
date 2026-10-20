/* The equipment catalogue an NPC is armed from (Rob, 20.10.2026): every weapon, armour and piece of equipment the game lists, each with the
   tooltip the rules give it – the part a leader can keep from the players while the item itself is seen. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();

describe('the equipment catalogue', () => {
  const list = core.equipmentCatalog(data);
  const find = (name: string) => list.find((g) => g.name === name)!;

  it('lists everything the game lists, once each, by its English name, with the kind of it', () => {
    expect(list.length).toBeGreaterThanOrEqual(240);
    expect(new Set(list.map((g) => g.name)).size).toBe(list.length);
    expect(find('Axe').categoryName).toBe('Close combat');
    expect(find('Bow').categoryName).toBe('Missile');
    expect(find('Handgun').categoryName).toBe('Blackpowder');
    expect(find('Light armour').categoryName).toBe('Armour');
    expect(find('Lucky charm').categoryName).toBe('Equipment');
    for (const g of list) expect(g.name.trim(), JSON.stringify(g)).not.toBe('');
  });

  it('carries the tooltip: what the item does, without its price or who may buy it', () => {
    expect(find('Handgun').tip).toMatch(/Range 24".*Strength 4/);
    expect(find('Handgun').tip).toMatch(/Move or fire/);
    expect(find('Sword breaker').tip).toMatch(/^Close combat — Parry/); // the line of the item, then its rules
    // the line of an item carries no price or rarity (a rule's own text may talk about them)
    for (const g of list) expect(g.tip.split(' — ')[0], g.name).not.toMatch(/\b\d+ gc\b|\bRare \d/);
    expect(find('Disease dagger').tip).not.toMatch(/Pestilens only/);
    expect(list.filter((g) => g.tip).length).toBeGreaterThan(230);
  });

  it('finds an item by its words in the name, the kind or the German name, the name first', () => {
    expect(core.searchEquipment(list, 'sword')[0]!.name).toBe('Sword');
    expect(core.searchEquipment(list, 'sword').every((g) => /sword/i.test(`${g.name} ${g.de} ${g.categoryName}`))).toBe(true);
    expect(core.searchEquipment(list, 'armour', 'armour').every((g) => g.category === 'armour')).toBe(true);
    expect(core.searchEquipment(list, '', 'bp').map((g) => g.category)).toEqual(Array(core.searchEquipment(list, '', 'bp').length).fill('bp'));
    expect(core.searchEquipment(list, 'schwertbrecher').map((g) => g.name)).toContain('Sword breaker');
    expect(core.searchEquipment(list, 'zzzz')).toEqual([]);
  });
});
