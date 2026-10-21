/* The search mask of "What can be found" (wish #22): by name or effect, by the characteristic an item touches, by rarity. */
import { describe, expect, it } from 'vitest';
import type { RareItem } from './equipment.ts';
import { effectLine, filterRare, STAT_FILTERS } from './rareFilter.ts';

const item = (name: string, text: string, rarity = 8, kind: RareItem['kind'] = 'misc'): RareItem => ({ de: name, name, kind, rarity, price: '25 gc', avg: null, fixed: 25, text, usable: true });

const ITEMS = [
  item('Lucky charm', 'Once per battle the wearer may re-roll one failed to-hit roll.', 6),
  item('Elven boots', 'The wearer gains +1 Movement and may sneak past enemies.', 10),
  item('Gromril armour', 'Heavy armour: a 4+ save. Reduces Movement by 1.', 11, 'armour'),
  item('Potion of strength', 'Drunk before a battle: Strength +1 for that battle.', 9),
  item('Banner', 'Allies within 6" use the leader\'s Leadership for rout tests.', 7),
];
const names = (l: RareItem[]) => l.map((i) => i.name);

describe('filterRare', () => {
  it('finds by name or by what the item does, ignoring case', () => {
    expect(names(filterRare(ITEMS, { q: 'lucky' }))).toEqual(['Lucky charm']);
    expect(names(filterRare(ITEMS, { q: 're-ROLL' }))).toEqual(['Lucky charm']);
    expect(names(filterRare(ITEMS, { q: '  ' }))).toHaveLength(5);
  });
  it('narrows by the characteristic an item touches', () => {
    expect(names(filterRare(ITEMS, { stat: 'M' }))).toEqual(['Elven boots', 'Gromril armour']);
    expect(names(filterRare(ITEMS, { stat: 'S' }))).toEqual(['Potion of strength']);
    expect(names(filterRare(ITEMS, { stat: 'Ld' }))).toEqual(['Banner']);
    expect(names(filterRare(ITEMS, { stat: 'Sv' }))).toEqual(['Gromril armour']);
  });
  it('narrows by the highest rarity wanted', () => {
    expect(names(filterRare(ITEMS, { maxRarity: 8 }))).toEqual(['Lucky charm', 'Banner']);
  });
  it('all together', () => {
    expect(names(filterRare(ITEMS, { q: 'wearer', stat: 'M', maxRarity: 10 }))).toEqual(['Elven boots']);
  });
  it('offers every characteristic once', () => {
    expect(STAT_FILTERS.map(([k]) => k)).toEqual(['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld', 'Sv']);
  });
});

describe('effectLine', () => {
  it('is the first sentence, short enough for a list', () => {
    expect(effectLine('Once per battle a re-roll. And more words after it.')).toBe('Once per battle a re-roll.');
    const long = `${'word '.repeat(60)}end.`;
    expect(effectLine(long).length).toBeLessThanOrEqual(141);
    expect(effectLine(long).endsWith('…')).toBe(true);
    expect(effectLine('')).toBe('');
  });
});
