/* Places nest, and groups and factions come from places (report #39): the helpers that read that out of the catalogue. */
import { describe, expect, it } from 'vitest';
import { ancestors, inPlace, placeOptions, type Lore, type LoreEntry } from './lore.ts';

const e = (id: string, kind: LoreEntry['kind'], extra: Partial<LoreEntry> = {}): LoreEntry => ({ id, kind, name: id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()), de: '', status: '', text: '', source: [], ...extra });
const LORE: Lore = {
  sources: {},
  entries: [
    e('old-world', 'region'),
    e('the-empire', 'region', { parent: 'old-world' }),
    e('ostermark', 'region', { parent: 'the-empire' }),
    e('mordheim', 'region', { parent: 'ostermark' }),
    e('the-pit', 'region', { parent: 'mordheim' }),
    e('kislev', 'region', { parent: 'old-world' }),
    e('norsca', 'region'),
    e('witch-hunters', 'group', { regions: ['mordheim'] }),
    e('kislevite-ice-witches', 'group', { regions: ['kislev'] }),
    e('norse-tribes', 'group', { regions: ['norsca'] }),
    e('wanderers', 'faction'),
  ],
};

describe('the places of the lore', () => {
  it('names what contains a place, the widest first', () => {
    expect(ancestors(LORE, 'the-pit').map((x) => x.id)).toEqual(['old-world', 'the-empire', 'ostermark', 'mordheim']);
    expect(ancestors(LORE, 'norsca')).toEqual([]);
    expect(ancestors(LORE, 'nowhere')).toEqual([]);
  });

  it('does not loop on a catalogue that names a place as its own ancestor', () => {
    const loop: Lore = { sources: {}, entries: [e('a', 'region', { parent: 'b' }), e('b', 'region', { parent: 'a' })] };
    expect(ancestors(loop, 'a').length).toBeLessThanOrEqual(2);
  });

  it('lists the places for a choice, every one under what contains it', () => {
    expect(placeOptions(LORE).map((o) => `${'-'.repeat(o.depth)}${o.id}`)).toEqual([
      'norsca', 'old-world', '-kislev', '-the-empire', '--ostermark', '---mordheim', '----the-pit',
    ]);
  });

  it('finds what is in a place: its own, what lies in it, and the groups that come from it or from what lies in it', () => {
    const ids = (place: string) => LORE.entries.filter((x) => inPlace(LORE, x, place)).map((x) => x.id);
    expect(ids('mordheim')).toEqual(['mordheim', 'the-pit', 'witch-hunters']);
    expect(ids('the-empire')).toEqual(['the-empire', 'ostermark', 'mordheim', 'the-pit', 'witch-hunters']);
    expect(ids('old-world')).toEqual(['old-world', 'the-empire', 'ostermark', 'mordheim', 'the-pit', 'kislev', 'witch-hunters', 'kislevite-ice-witches']);
    expect(ids('norsca')).toEqual(['norsca', 'norse-tribes']);
    // no place: everything
    expect(LORE.entries.every((x) => inPlace(LORE, x, ''))).toBe(true);
  });
});
