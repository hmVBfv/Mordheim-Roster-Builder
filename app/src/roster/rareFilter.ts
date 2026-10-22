/* The search mask of the Trading Post's rare items (wish #22), as the Hired Swords have one: by name or effect, by the
   characteristic an item touches, by the highest rarity wanted. The items carry their rules as text, so a
   characteristic is found by the words that name it. Pure, so it can be tested. */
import type { RareItem } from './equipment.ts';

/** Characteristics, and the words of an item's rules that name each. */
export const STAT_FILTERS = [
  ['M', 'Movement', /\bmovement\b|\bmoves?\b/i],
  ['WS', 'Weapon Skill', /\bweapon skill\b|\bWS\b/i],
  ['BS', 'Ballistic Skill', /\bballistic skill\b|\bBS\b/i],
  ['S', 'Strength', /\bstrength\b/i],
  ['T', 'Toughness', /\btoughness\b/i],
  ['W', 'Wounds', /\bwounds?\b/i],
  ['I', 'Initiative', /\binitiative\b/i],
  ['A', 'Attacks', /\battacks?\b/i],
  ['Ld', 'Leadership', /\bleadership\b|\bLd\b/i],
  ['Sv', 'Armour save', /\bsaves?\b|\bsaving throws?\b|\bSv\b/i],
] as const;

export type StatFilter = (typeof STAT_FILTERS)[number][0];

export interface RareQuery { q?: string; stat?: StatFilter | ''; maxRarity?: number | null; /** a source key, see sourceKeys */ from?: string; /** a grade of the warband an item belongs to */ grade?: string }

/* Where an item comes from (Rob, 22.10.2026: every item of mordheimer.net, with a choice by the campaign it was released with): the
   core rules, a campaign setting whose price chart lists it, or a warband's own list. */
const SOURCE_NAMES: Readonly<Record<string, string>> = {
  core: 'Core rules', 'empire-in-flames': 'Empire in Flames', 'border-town-burning': 'Border Town Burning', khemri: 'Khemri', lustria: 'Lustria', warband: 'A warband\'s own item',
};
export const GRADE_NAMES: Readonly<Record<string, string>> = { core: 'Core warbands', '1a': 'Grade 1a', '1b': 'Grade 1b', '1c': 'Grade 1c', '2a': 'Grade 2a' };

const titled = (slug: string) => slug.split('-').map((w) => (w.length > 2 ? w[0]!.toUpperCase() + w.slice(1) : w)).join(' ');
export const sourceName = (key: string) => SOURCE_NAMES[key] ?? titled(key);

/** The sources of an item: the settings that list it, 'warband' for a warband's own, and 'core' for what the core chart has (an item no setting
    names is the core chart's). */
export function sourceKeys(i: Pick<RareItem, 'settings'>): string[] {
  if (!i.settings.length) return ['core'];
  const out = new Set<string>();
  for (const s of i.settings) out.add(s.startsWith('warband:') ? 'warband' : s);
  return [...out];
}

/** What to show next to an item that is not the core chart's: where it was released. */
export function releasedWith(i: Pick<RareItem, 'settings'>): string[] {
  const keys = sourceKeys(i);
  return keys.includes('core') ? [] : keys.map(sourceName);
}

const ORDER = ['core', 'empire-in-flames', 'border-town-burning', 'khemri', 'lustria'];
/** The choices of the "From" list: those that some item has, the core chart first. */
export function sourceOptions(items: readonly Pick<RareItem, 'settings'>[]): [string, string][] {
  const have = new Set(items.flatMap((i) => sourceKeys(i)));
  const rank = (k: string) => (ORDER.includes(k) ? ORDER.indexOf(k) : k === 'warband' ? 100 : 50);
  return [...have].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map((k) => [k, sourceName(k)]);
}

export function gradeOptions(items: readonly Pick<RareItem, 'grade'>[]): [string, string][] {
  const have = new Set(items.map((i) => i.grade).filter((g): g is string => !!g));
  return Object.keys(GRADE_NAMES).filter((g) => have.has(g)).map((g) => [g, GRADE_NAMES[g]!]);
}

export function filterRare(items: RareItem[], f: RareQuery): RareItem[] {
  const q = (f.q ?? '').trim().toLowerCase();
  const words = f.stat ? STAT_FILTERS.find(([k]) => k === f.stat)?.[2] : undefined;
  return items.filter((i) =>
    (!q || `${i.name} ${i.text}`.toLowerCase().includes(q))
    && (!words || words.test(i.text))
    && (!f.from || sourceKeys(i).includes(f.from))
    && (!f.grade || i.grade === f.grade)
    && (f.maxRarity == null || i.rarity <= f.maxRarity));
}

/** The first sentence of an item's rules, short enough for a list. */
export function effectLine(text: string, max = 140): string {
  const t = text.replace(/\s+/g, ' ').trim();
  const end = /[.!?](\s|$)/.exec(t);
  const first = end ? t.slice(0, end.index + 1) : t;
  return first.length > max ? `${first.slice(0, max).trimEnd()}…` : first;
}

export const SORT_ORDERS = [
  ['name', 'Name, A to Z'],
  ['rarity-asc', 'Rarity, easiest first'],
  ['rarity-desc', 'Rarity, hardest first'],
  ['price-asc', 'Price, cheapest first'],
  ['price-desc', 'Price, dearest first'],
] as const;
export type SortOrder = (typeof SORT_ORDERS)[number][0];

/** What an item costs for ordering: its price, or what a dice price comes to on average; null where the price is no number. */
const priceValue = (i: RareItem): number | null => i.fixed ?? i.avg;

/** A sorted copy (wish #25). Ties go by name; an item whose price is no number goes last, whichever way the prices run. */
export function sortRare(items: RareItem[], order: SortOrder): RareItem[] {
  const byName = (a: RareItem, b: RareItem) => a.name.localeCompare(b.name);
  const dir = order.endsWith('desc') ? -1 : 1;
  return [...items].sort((a, b) => {
    if (order === 'name') return byName(a, b);
    if (order.startsWith('rarity')) return dir * (a.rarity - b.rarity) || byName(a, b);
    const pa = priceValue(a), pb = priceValue(b);
    if (pa == null || pb == null) return pa == null && pb == null ? byName(a, b) : pa == null ? 1 : -1;
    return dir * (pa - pb) || byName(a, b);
  });
}
