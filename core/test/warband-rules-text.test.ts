/* The rules text of a warband is read by heading: "<b>Name:</b> what it says". A heading that is not closed, or a list of rules run into one
   heading, makes one rule of several (report of 6.11.2026: the Dwarfs' "Dwarf rules", and the Treasure Hunters' list that never closed its tag). */
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();

describe('the rules text of every warband', () => {
  it('opens and closes each heading before the next', () => {
    const bad: string[] = [];
    for (const [k, w] of Object.entries(data.WARBANDS)) {
      const tags = String(w.rules ?? '').match(/<\/?b>/g) ?? [];
      if (tags.some((t, i) => t !== (i % 2 ? '</b>' : '<b>')) || tags.length % 2) bad.push(k);
    }
    expect(bad).toEqual([]);
  });

  it('runs no list of rules into one heading', () => {
    const bad: string[] = [];
    for (const [k, w] of Object.entries(data.WARBANDS)) {
      for (const m of String(w.rules ?? '').matchAll(/<b>([^<]*?):?<\/b>([^<]*)/g)) if (/ · /.test(m[2] as string)) bad.push(`${k}: ${m[1]}`);
    }
    expect(bad).toEqual([]);
  });
});
