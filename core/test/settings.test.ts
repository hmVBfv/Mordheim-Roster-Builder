/* Wishes #164, #165 (Rob, 30.10.2026): the campaign settings of mordheimer.net are kept as data, and the items can be told apart by
   them, so a campaign that plays in one area can later leave out what was released for another. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const item = (en: string) => data.CATALOG.find((x) => x.en === en)!;
const sourcesOf = (i: core.CatalogItem) => core.itemSources(i);
/** Items by where they were released. */
const only = (k: string) => data.CATALOG.filter((i) => sourcesOf(i).length > 0 && sourcesOf(i).every((s) => s === k));
const rulebook = data.CATALOG.find((i) => i.en === 'Axe')!;
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
  it('says where an item was released: the rulebook for its items, the settings whose chart lists it, a warband for its own, none where the data traces it nowhere', () => {
    expect(core.itemSources(rulebook)).toContain('core');
    expect(core.itemSources(data.CATALOG.find((i) => !i.vanilla && !(i.settings ?? []).length)!)).toEqual([]);
    expect(core.itemSources(item('Magic gourd'))).toEqual(['khemri']);
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
    expect(mordheim.every((i) => !sourcesOf(i).length || sourcesOf(i).some((k) => k === 'core' || k === 'warband'))).toBe(true);
  });

  it('names a setting by its id, and knows only the settings of the data', () => {
    expect(core.settingName(data, 'khemri')).toBe('Khemri');
    expect(core.settingName(data, 'warband')).toBe('A warband\'s own item');
    expect(core.settingName(data, 'somewhere-else')).toBe('Somewhere Else');
  });
});

/* The audit of Rob's order of 30.10.2026: every item of the catalogue checked against mordheimer.net – an item is vanilla when the
   rulebook has it ("Mordheim Rulebook (core)" on the weapons, armour and equipment pages, or the core price chart). */
describe('the vanilla items (#165, audit of 30.10.2026)', () => {
  const vanilla = data.CATALOG.filter((i) => core.itemIsVanilla(i));

  it('are the items of the rulebook: weapons, armour and equipment of its pages and its price chart', () => {
    expect(vanilla.length).toBe(69);
    for (const en of ['Axe', 'Dagger', 'Bow', 'Handgun', 'Buckler', 'Garlic', 'Bugman\'s Ale', 'Elven Cloak', 'Lantern', 'Rope & Hook', 'Warhorse', 'Wardog', 'Riding/Draft Horse']) {
      expect(core.itemIsVanilla(data.CATALOG.find((i) => i.en.toLowerCase() === en.toLowerCase())!), en).toBe(true);
    }
  });

  it('are not the items of a setting or a Town Cryer: the Magic Gourd, the Pike, the Torch, the Sea dragon cloak', () => {
    for (const en of ['Magic gourd', 'Pike', 'Torch', 'Sea dragon cloak', 'Lamp of the Djinn', 'Wheelbarrow']) {
      expect(core.itemIsVanilla(item(en)), en).toBe(false);
    }
  });

  it('are what `core` stands for: no item carries `core` in its settings without being in the rulebook', () => {
    const wrong = data.CATALOG.filter((i) => (i.settings ?? []).includes('core') && !i.vanilla).map((i) => i.en);
    expect(wrong).toEqual([]);
    const rest = data.CATALOG.filter((i) => i.vanilla && (i.settings ?? []).length && !(i.settings ?? []).includes('core') && !(i.settings ?? []).every((s) => s.startsWith('warband:'))).map((i) => i.en);
    expect(rest).toEqual([]);
  });

  it('make the vanilla catalogue: all of them, nothing else, and none of Khemri', () => {
    const v = core.catalogVanilla(data);
    expect(v).toHaveLength(69);
    expect(v.every((i) => i.vanilla === true)).toBe(true);
    expect(v.some((i) => i.en === 'Magic gourd')).toBe(false);
    expect(v.some((i) => core.itemSources(i).includes('khemri') && !core.itemSources(i).includes('core'))).toBe(false);
  });

  it('say how the skills stand: every skill of the five lists is the rulebook\'s, so the vanilla skill lists are those', () => {
    expect(data.VANILLA.skillLists).toEqual(Object.keys(data.SKILLLISTS));
    expect(data.VANILLA.skillLists).toEqual(['combat', 'shooting', 'academic', 'strength', 'speed']);
    for (const k of data.VANILLA.skillLists) expect(core.isVanillaSkillList(data, k), k).toBe(true);
    expect(core.isVanillaSkillList(data, 'sneaky')).toBe(false);
  });

  it('keeps vanilla off by default: a standard campaign has every item and every skill to choose from', () => {
    expect(data.VANILLA.default).toBe(false);
    expect(data.VANILLA.name).toBe('Vanilla Mordheim');
    expect(core.catalogForCampaign(data, { vanilla: false })).toHaveLength(data.CATALOG.length);
    expect(core.catalogForCampaign(data, {})).toHaveLength(data.CATALOG.length);
    expect(core.catalogForCampaign(data, { vanilla: true })).toHaveLength(69);
  });

  it('has the rulebook\'s Riding/Draft Horse (core price chart: 40 gc, Rare 8, humans only), beside the variants of the settings', () => {
    const horse = data.CATALOG.find((i) => i.en === 'Riding/Draft Horse')!;
    expect(horse).toMatchObject({ cost: 40, rare: 'Rare 8', vanilla: true, grade: 'core', only: { human: true }, settings: ['core'] });
    expect(horse.source).toEqual(['https://mordheimer.net/docs/trading-post']);
    expect(core.itemInfo(data, 'Riding/Draft Horse')?.name).toBe('Riding/Draft Horse');
    expect(core.catalogVanilla(data).map((i) => i.en)).toContain('Riding/Draft Horse');
    // the variants of the settings stay what they are: not the rulebook's
    expect(core.itemIsVanilla(item('Riding/Draft Horse (Empire in Flames)'))).toBe(false);
  });

  it('knows the warbands of the rulebook: the six of grade core, and no other', () => {
    const rulebook = Object.keys(data.WARBANDS).filter((k) => core.isVanillaWarband(data, k)).sort();
    expect(rulebook).toEqual(['merc', 'possessed', 'skaven', 'sos', 'undead', 'wh']);
    expect(core.isVanillaWarband(data, 'caravans')).toBe(false);
    expect(core.isVanillaWarband(data, 'nothing')).toBe(false);
    expect(core.isVanillaWarband(data, undefined)).toBe(false);
  });
});
