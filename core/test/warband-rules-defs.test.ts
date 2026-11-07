/* Report of 7.11.2026: the Black Orcs' Animosity showed as a rule named "Annual 2002 version" – a colon inside the text of a rule was read as the heading of
   another. The rules a warband's text gives, as the roster reads them, are exactly its headings, one after the other, in every warband. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();

describe('the rules of every warband, as the roster reads them', () => {
  it('are its headings, no more and no fewer (a colon inside a text starts no rule)', () => {
    const bad: string[] = [];
    for (const [wb, w] of Object.entries(data.WARBANDS)) {
      const headings = [...String(w.rules).matchAll(/<b>([^<]*?):<\/b>/g)].map((m) => m[1]);
      const read = core.ruleDefs(w.rules, 'x').map((d) => d.name);
      if (JSON.stringify(read) !== JSON.stringify(headings)) bad.push(`${wb}: headings ${JSON.stringify(headings)}, read ${JSON.stringify(read)}`);
    }
    expect(bad).toEqual([]);
  });

  it('give the Black Orcs\' Animosity as a rule of its own, in the words of their page', () => {
    const d = core.ruleDefs(data.WARBANDS.blackorcs!.rules, 'x').find((r) => r.name === 'Animosity')!;
    expect(d.text).toMatch(/roll a D6 for each Orc or Goblin Henchman/);
    expect(d.text).toMatch(/2002 Annual/);
    expect(d.text).toMatch(/no Leadership test/i);
    expect(d.text).toMatch(/roll of 1 on a D6/);
  });
});
