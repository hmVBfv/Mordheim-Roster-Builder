/* Every item name a player reads is English (report of 2.11.2026: the buy lists showed "Purpurschatten"). The data keeps German keys; `enItem`
   must turn each one that a list, the catalogue, a unit's gear or a kit can show into an English name. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const clean = (s: string) => s.replace(' (1. gratis)', '').trim();
const GERMAN_LETTERS = /[äöüßÄÖÜ]/;

function names(): string[] {
  const out = new Set<string>();
  for (const lists of Object.values(data.LISTS)) for (const group of Object.values(lists as Record<string, unknown>)) {
    if (!Array.isArray(group)) continue;
    for (const row of group) if (typeof row[0] === 'string') out.add(clean(row[0]));
  }
  for (const w of Object.values(data.WARBANDS)) for (const u of (w as { units?: { gear?: string[] }[] }).units ?? []) for (const g of u.gear ?? []) out.add(g);
  return [...out];
}

describe('item names are English', () => {
  it('turns every list, catalogue and gear name into its catalogue English name', () => {
    const wrong: string[] = [];
    for (const n of names()) {
      const en = core.enItem(data, n);
      const cat = data.CATALOG.find((c) => c.de === n);
      if (en === n && cat?.en && !cat.en.toLowerCase().startsWith(n.toLowerCase())) wrong.push(`${n} (catalogue: ${cat.en})`);
      else if (GERMAN_LETTERS.test(en)) wrong.push(`${n} -> ${en}`);
    }
    expect(wrong).toEqual([]);
  });
});
