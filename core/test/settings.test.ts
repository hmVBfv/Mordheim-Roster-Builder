/* Wishes #164, #165 (Rob, 30.10.2026): the campaign settings of mordheimer.net are kept as data, and the items can be told apart by
   them, so a campaign that plays in one area can later leave out what was released for another. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const item = (en: string) => data.CATALOG.find((x) => x.en === en)!;
const sourcesOf = (i: core.CatalogItem) => core.itemSources(i);
/** Items by where they were released. */
const only = (k: string) => data.CATALOG.filter((i) => sourcesOf(i).every((s) => s === k));
const rulebook = data.CATALOG.find((i) => !(i.settings ?? []).length)!;
const warbandOwn = data.CATALOG.find((i) => (i.settings ?? []).some((s) => s.startsWith('warband:')))!;
const shared = data.CATALOG.find((i) => sourcesOf(i).includes('core') && sourcesOf(i).includes('khemri'))!;

describe('the settings as data (#164)', () => {
  it('lists every setting of mordheimer.net with its name, its page and a summary, the core rules first', () => {
    expect(data.SETTINGS.map((s) => s.id)).toEqual(['core', 'border-town-burning', 'empire-in-flames', 'khemri', 'lustria', 'albion', 'the-nemesis-crown', 'the-procession-of-morr']);
    for (const s of data.SETTINGS) {
      expect(s.name, s.id).toMatch(/\S/);
      expect(s.summary.length, s.id).toBeGreaterThan(40);
      expect(s.url, s.id).toMatch(/^https:\/\/mordheimer\.net\/docs\//);
      if (s.id !== 'core') expect(s.url, s.id).toMatch(new RegExp(`/campaign-settings/${s.id}$`));
    }
    expect(new Set(data.SETTINGS.map((s) => s.id)).size).toBe(data.SETTINGS.length);
  });

  it('names every setting an item says it was released with, and every page an item was read from', () => {
    const ids = new Set(data.SETTINGS.map((s) => s.id));
    for (const i of data.CATALOG) {
      for (const s of i.settings ?? []) if (!s.startsWith('warband:')) expect(ids.has(s), `${i.en}: ${s}`).toBe(true);
      for (const u of i.source ?? []) {
        const slug = /\/campaign-settings\/([^/]+)\//.exec(u)?.[1];
        if (slug) expect(i.settings ?? [], `${i.en} was read on the page of ${slug}`).toContain(slug);
      }
    }
  });
});

describe('the items of a setting (#165)', () => {
  it('says where an item was released: the core chart where no setting is named, a warband for its own items', () => {
    expect(core.itemSources(rulebook)).toEqual(['core']);
    expect(core.itemSources(item('Magic gourd'))).toEqual(['core', 'khemri']);
    expect(core.itemSources(item('Trade Wagon'))).toEqual(['warband']);
    expect(core.itemSources(warbandOwn)).toEqual(['warband']);
  });

  it('leaves out what was released only for another setting – a Mordheim campaign gets none of Border Town Burning', () => {
    const btb = only('border-town-burning');
    expect(btb.length).toBeGreaterThan(5);
    for (const i of btb) {
      expect(core.itemInSettings(i, ['core']), i.en).toBe(false);
      expect(core.itemInSettings(i, ['khemri', 'lustria']), i.en).toBe(false);
      expect(core.itemInSettings(i, ['border-town-burning']), i.en).toBe(true);
      expect(core.itemInSettings(i, ['core', 'border-town-burning']), i.en).toBe(true);
    }
    expect(only('empire-in-flames').length).toBeGreaterThan(0);
  });

  it('keeps what the core chart lists and what a warband brings, whatever the campaign plays in', () => {
    for (const played of [[], ['core'], ['khemri'], ['lustria', 'albion']]) {
      expect(core.itemInSettings(rulebook, played)).toBe(true);
      expect(core.itemInSettings(shared, played), `${shared.en} in ${played.join(',')}`).toBe(true);
      expect(core.itemInSettings(warbandOwn, played)).toBe(true);
    }
  });

  it('filters the catalogue, and a campaign that plays everywhere keeps all of it', () => {
    const all = data.SETTINGS.map((s) => s.id);
    expect(core.catalogIn(data, all)).toHaveLength(data.CATALOG.length);
    const mordheim = core.catalogIn(data, ['core']);
    expect(mordheim.length).toBeLessThan(data.CATALOG.length);
    expect(mordheim.every((i) => sourcesOf(i).some((k) => k === 'core' || k === 'warband'))).toBe(true);
  });

  it('names a setting by its id, and knows only the settings of the data', () => {
    expect(core.settingName(data, 'khemri')).toBe('Khemri');
    expect(core.settingName(data, 'warband')).toBe('A warband\'s own item');
    expect(core.settingName(data, 'somewhere-else')).toBe('Somewhere Else');
  });
});
