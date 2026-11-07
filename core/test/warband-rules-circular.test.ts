/* Report of 7.11.2026: a warband rule read "Animosity: The warband is subject to Animosity." – the rule explained itself by its own name.
   A rule of a warband says what it does; where a page only points to a rule defined elsewhere, the warband's text carries that rule's words. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
/** "The warband is subject to X." under the heading X says nothing */
const CIRCULAR = /^\W*(the warband |all \w+ )?(is |are )?subject to (the (special )?rules (for|of) )?\W*$/i;

describe('the rules of every warband', () => {
  it('never explain themselves by their own name alone', () => {
    const bad: string[] = [];
    for (const [wb, w] of Object.entries(data.WARBANDS)) {
      for (const d of core.ruleDefs(w.rules, 'x')) {
        if (CIRCULAR.test(d.text.replace(d.name, ''))) bad.push(`${wb}: ${d.name}: ${d.text}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('give the Orc Mob and the Forest Goblins the Animosity of their pages, in full', () => {
    for (const wb of ['orcmob', 'forestgoblins']) {
      const d = core.ruleDefs(data.WARBANDS[wb]!.rules, 'x').find((r) => r.name === 'Animosity')!;
      expect(d.text, wb).toMatch(/roll a D6 for each Henchman who is either an Orc or a Goblin/);
      expect(d.text, wb).toMatch(/not roll for models that are engaged in hand-to-hand combat/);
      expect(d.text, wb).toMatch(/consult the Animosity chart/);
    }
  });
});
