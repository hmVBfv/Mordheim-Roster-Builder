/* The lore opening of each warband (data/warbandintro.json): the lore of the page, word for word, one per warband that has a page of its
   own on mordheimer.net, each naming the page it was read on. Offered as the default Prologue text of a warband's Story. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Intro = { text: string; url: string };
const read = <T>(f: string) => JSON.parse(readFileSync(new URL(`../../data/${f}`, import.meta.url), 'utf8')) as T;
const intro = read<{ INTRO: Record<string, Intro> }>('warbandintro.json').INTRO;
const warbands = read<{ WARBANDS: Record<string, unknown> }>('warbands.json').WARBANDS;

describe('the warband openings', () => {
  it('has one for every warband, and none for anything else', () => {
    // the Snotlings' page (2b) has only rules, no lore (Wish 258)
    for (const k of Object.keys(warbands).filter((x) => x !== 'snotlings')) expect(k in intro, `${k}: opening`).toBe(true);
    for (const k of Object.keys(intro)) expect(k in warbands, `${k} is a warband`).toBe(true);
  });

  /* Report of 10.11.2026: the default story of a warband is the original description on its page on mordheimer.net, whole (Rob's decision: word for
     word, an exception to ADR 0024 as for the units' descriptions), without a sentence that only leads into the rules. */
  it('is the lore of the page, word for word and whole, and names its page on mordheimer.net', () => {
    for (const [k, e] of Object.entries(intro)) {
      expect(e.text.length, `${k}: text`).toBeGreaterThan(200);
      expect(e.text.length, `${k}: text`).toBeLessThanOrEqual(20_000);
      expect(e.url, k).toMatch(/^https:\/\/mordheimer\.net\/docs\/warbands\/[a-z0-9-]+\/[a-z0-9-]+(#[a-z0-9-]+)?$/);
      // paragraphs are set apart by an empty line; the lines of the page's own wrapping are one line here
      expect(e.text, `${k}: a paragraph run on from a line break`).not.toMatch(/[^\n]\n[^\n]/);
      expect(e.text, `${k}: ends where a thought ends`).toMatch(/[.!?…"”’]$/);
    }
  });

  it('gives the words of the page, not a summary', () => {
    expect(intro.skaven!.text.startsWith('Unbeknownst to man, for thousands of years he has shared his world with another and altogether different race.')).toBe(true);
    expect(intro.skaven!.text).toContain('ratmen, the mutant spawn of an older age of chaos and mutation.');
    expect(intro.nightgoblins!.text.startsWith('Much of the Old World is infested with')).toBe(true);
    // the whole of a long one
    expect(intro.cavalcade!.text.length).toBeGreaterThan(10_000);
  });

  it('leaves out what only leads into the rules, and takes the lore of the Mercenaries and Ostermark from their page', () => {
    expect(intro.orcmob!.text).not.toMatch(/following special rules/);
    expect(intro.orcmob!.text.endsWith('collect as much treasure as possible!')).toBe(true);
    expect(intro.merc!.text.startsWith('This is a time of unremitting war, civil strife, violence and famine.')).toBe(true);
    expect(intro.merc!.text).not.toMatch(/you must decide which of the three contenders/);
    expect(intro.ostermark!.text.startsWith('Ostermarkers are used to harsh odds and battling alone')).toBe(true);
  });
});
