/* The search mask of "What can be found" (wish #22): by name or effect, by the characteristic an item touches, by rarity. */
import { describe, expect, it } from 'vitest';
import type { RareItem } from './equipment.ts';
import { effectLine, filterRare, gradeOptions, releasedWith, sortRare, sourceKeys, sourceName, sourceOptions, STAT_FILTERS, type SortOrder } from './rareFilter.ts';

const item = (name: string, text: string, rarity = 8, kind: RareItem['kind'] = 'misc'): RareItem => ({ de: name, name, kind, rarity, price: '25 gc', avg: null, range: null, fixed: 25, text, usable: true, settings: [], grade: null });

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

describe('sortRare (wish #25)', () => {
  const rows = [
    { ...item('Banner', 'x', 5), fixed: 10, avg: null },
    { ...item('Black lotus', 'x', 9), fixed: null, avg: 13.5 },
    { ...item('Arrows', 'x', 8), fixed: null, avg: null },        // a price without a number
    { ...item('Crossbow pistol', 'x', 9), fixed: 35, avg: null },
  ];
  const order = (o: SortOrder) => sortRare(rows, o).map((i) => i.name);
  it('by name, A to Z', () => expect(order('name')).toEqual(['Arrows', 'Banner', 'Black lotus', 'Crossbow pistol']));
  it('by rarity, the easier or the harder to find first, a tie by name', () => {
    expect(order('rarity-asc')).toEqual(['Banner', 'Arrows', 'Black lotus', 'Crossbow pistol']);
    expect(order('rarity-desc')).toEqual(['Black lotus', 'Crossbow pistol', 'Arrows', 'Banner']);
  });
  it('by price – a dice price by its average – and the ones without a number last either way', () => {
    expect(order('price-asc')).toEqual(['Banner', 'Black lotus', 'Crossbow pistol', 'Arrows']);
    expect(order('price-desc')).toEqual(['Crossbow pistol', 'Black lotus', 'Banner', 'Arrows']);
  });
  it('does not change the list it is given', () => {
    const before = rows.map((i) => i.name);
    sortRare(rows, 'rarity-desc');
    expect(rows.map((i) => i.name)).toEqual(before);
  });
});

/* Rob, 22.10.2026: every item of mordheimer.net, with a choice by the campaign it was released with. */
describe('the choice by where an item was released', () => {
  const at = (name: string, settings: string[], grade: string | null = null): RareItem => ({ ...item(name, 'x'), settings, grade });
  const MIXED = [
    at('Sword of the core chart', []),
    at('Javelins', ['core', 'khemri', 'lustria']),
    at('Mule', ['border-town-burning', 'empire-in-flames']),
    at('Wardog', ['core'], 'core'),
    at('Trade Wagon', ['warband:merchant-caravans'], '1c'),
    at('Snotling Pump Wagon', ['warband:snotlings'], '2a'),
  ];

  it('knows the core chart, the campaign settings and a warband\'s own', () => {
    expect(sourceKeys(MIXED[0]!)).toEqual(['core']);
    expect(sourceKeys(MIXED[1]!)).toEqual(['core', 'khemri', 'lustria']);
    expect(sourceKeys(MIXED[4]!)).toEqual(['warband']);
    expect(sourceName('border-town-burning')).toBe('Border Town Burning');
    expect(sourceName('some-new-setting')).toBe('Some New Setting');
  });

  it('offers only what some item has, the core chart first and the warbands last', () => {
    expect(sourceOptions(MIXED).map(([k]) => k)).toEqual(['core', 'empire-in-flames', 'border-town-burning', 'khemri', 'lustria', 'warband']);
    expect(sourceOptions([MIXED[2]!]).map(([k]) => k)).toEqual(['empire-in-flames', 'border-town-burning']);
    expect(gradeOptions(MIXED).map(([k]) => k)).toEqual(['core', '1c', '2a']);
  });

  it('narrows the list to a campaign or a grade', () => {
    const names = (f: Parameters<typeof filterRare>[1]) => filterRare(MIXED, f).map((i) => i.name);
    expect(names({ from: 'khemri' })).toEqual(['Javelins']);
    expect(names({ from: 'core' })).toEqual(['Sword of the core chart', 'Javelins', 'Wardog']);
    expect(names({ from: 'empire-in-flames' })).toEqual(['Mule']);
    expect(names({ from: 'warband' })).toEqual(['Trade Wagon', 'Snotling Pump Wagon']);
    expect(names({ grade: '2a' })).toEqual(['Snotling Pump Wagon']);
    expect(names({ from: 'warband', grade: '1c' })).toEqual(['Trade Wagon']);
    expect(names({})).toHaveLength(6);
  });

  it('names where an item that is not the core chart\'s was released', () => {
    expect(releasedWith(MIXED[0]!)).toEqual([]);
    expect(releasedWith(MIXED[1]!)).toEqual([]);
    expect(releasedWith(MIXED[2]!)).toEqual(['Border Town Burning', 'Empire in Flames']);
    expect(releasedWith(MIXED[4]!)).toEqual(['A warband\'s own item']);
  });
});
