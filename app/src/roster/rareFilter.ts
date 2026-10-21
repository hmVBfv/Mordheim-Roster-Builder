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

export interface RareQuery { q?: string; stat?: StatFilter | ''; maxRarity?: number | null }

export function filterRare(items: RareItem[], f: RareQuery): RareItem[] {
  const q = (f.q ?? '').trim().toLowerCase();
  const words = f.stat ? STAT_FILTERS.find(([k]) => k === f.stat)?.[2] : undefined;
  return items.filter((i) =>
    (!q || `${i.name} ${i.text}`.toLowerCase().includes(q))
    && (!words || words.test(i.text))
    && (f.maxRarity == null || i.rarity <= f.maxRarity));
}

/** The first sentence of an item's rules, short enough for a list. */
export function effectLine(text: string, max = 140): string {
  const t = text.replace(/\s+/g, ' ').trim();
  const end = /[.!?](\s|$)/.exec(t);
  const first = end ? t.slice(0, end.index + 1) : t;
  return first.length > max ? `${first.slice(0, max).trimEnd()}…` : first;
}
