/* The lore opening of each warband (data/warbandintro.json): summarised in our own words, one per warband that has a page of its
   own on mordheimer.net, each naming the page it was read on. Offered as the default Prologue text of a warband's Story. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Intro = { text: string; url: string };
const read = <T>(f: string) => JSON.parse(readFileSync(new URL(`../../data/${f}`, import.meta.url), 'utf8')) as T;
const intro = read<{ INTRO: Record<string, Intro> }>('warbandintro.json').INTRO;
const warbands = read<{ WARBANDS: Record<string, unknown> }>('warbands.json').WARBANDS;
/** A warband that is only a section of the Mercenaries page has no opening of its own. */
const WITHOUT_PAGE = ['ostermark'];

describe('the warband openings', () => {
  it('has one for every warband with a page of its own, and none for anything else', () => {
    for (const k of Object.keys(warbands)) expect(k in intro || WITHOUT_PAGE.includes(k), `${k}: opening`).toBe(true);
    for (const k of Object.keys(intro)) expect(k in warbands, `${k} is a warband`).toBe(true);
  });

  it('is short, in our own words, and names its page on mordheimer.net', () => {
    for (const [k, e] of Object.entries(intro)) {
      expect(e.text.length, `${k}: text`).toBeGreaterThan(80);
      expect(e.text.length, `${k}: text`).toBeLessThan(500);
      expect(e.url, k).toMatch(/^https:\/\/mordheimer\.net\/docs\/warbands\/[a-z0-9-]+\/[a-z0-9-]+$/);
    }
  });
});
