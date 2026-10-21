import { describe, expect, it } from 'vitest';
import { equipmentWords } from './equipmentWords.ts';

const tips = [{ name: 'Sword', text: 'Close combat — Parry' }, { name: 'Light armour', text: 'Armour — save 6+' }, { name: 'Crossbow', text: 'Missile — 30"' }];

describe('the words of an NPC’s equipment', () => {
  it('splits the line into items and gives each the tooltip of its name', () => {
    const r = equipmentWords('Sword, Light armour, Boat hook', tips);
    expect(r.items.map((i) => [i.label, i.tip?.text ?? null])).toEqual([['Sword', 'Close combat — Parry'], ['Light armour', 'Armour — save 6+'], ['Boat hook', null]]);
  });

  it('knows an item by its name however it is written: case, accents, a count, a note', () => {
    const r = equipmentWords('sword; 2x Light Armour (rusty)\nCrossbow x2', tips);
    expect(r.items.map((i) => [i.label, i.tip?.name ?? null])).toEqual([['sword', 'Sword'], ['2x Light Armour (rusty)', 'Light armour'], ['Crossbow x2', 'Crossbow']]);
  });

  it('a tooltip no item names stays in the rest, so it is not lost', () => {
    const r = equipmentWords('Sword', tips);
    expect(r.rest.map((t) => t.name)).toEqual(['Light armour', 'Crossbow']);
    expect(equipmentWords('', tips).items).toEqual([]);
    expect(equipmentWords('', tips).rest).toHaveLength(3);
  });
});
