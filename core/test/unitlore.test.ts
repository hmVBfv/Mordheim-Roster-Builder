/* Wish of 7.11.2026: the description each unit has on its page on mordheimer.net is the default of its story, word for word (Rob's decision,
   an exception to ADR 0024 for this one purpose). data/unitlore.json holds them, read with curl. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STORY_LIMITS } from '../src/index.ts';

const read = <T>(f: string) => JSON.parse(readFileSync(new URL(`../../data/${f}`, import.meta.url), 'utf8')) as T;
const lore = read<{ LORE: Record<string, Record<string, string>> }>('unitlore.json').LORE;
const warbands = read<{ WARBANDS: Record<string, { units: { id: string; name: string }[] }> }>('warbands.json').WARBANDS;

describe('the descriptions of the units', () => {
  it('belong to units of the warband they stand under, and fit the story field', () => {
    const bad: string[] = [];
    for (const [wb, units] of Object.entries(lore)) {
      if (!warbands[wb]) { bad.push(`${wb}: no such warband`); continue; }
      for (const [id, text] of Object.entries(units)) {
        if (!warbands[wb]!.units.some((u) => u.id === id)) bad.push(`${wb}/${id}: no such unit`);
        if (text.length < 40 || text.length > STORY_LIMITS.text) bad.push(`${wb}/${id}: ${text.length} characters`);
        if (/<[^>]+>|\n/.test(text)) bad.push(`${wb}/${id}: markup or a line break`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('are given word for word, not summarised', () => {
    expect(lore.sos!.augur).toBe('The blind Augurs of the Sisterhood are blessed beyond their comrades. By giving up their sight they have gained something far more, second sight – a gift from their patron god. Only a very few are marked this way, and they are greatly revered by the Sisterhood. Unlike the rest of the priestesses, they shave their heads, save for a single long braid.');
  });

  it('cover almost every unit; the few without one have no description on their page', () => {
    const without = Object.entries(warbands).flatMap(([wb, w]) => w.units.filter((u) => !lore[wb]?.[u.id]).map((u) => `${wb}/${u.id}`));
    expect(without.length).toBeLessThan(15);
    // the core warbands are all there but for what their pages leave out
    for (const wb of ['merc', 'possessed', 'wh', 'sos', 'undead', 'skaven']) expect(Object.keys(lore[wb] ?? {}).length, wb).toBeGreaterThan(3);
  });
});
