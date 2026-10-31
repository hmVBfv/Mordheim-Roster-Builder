/* The rulebook chapters of the Rules tab (data/rulesref.json): the eight chapters of the Core rules, each with its page on
   mordheimer.net, in blocks the app can show. The text is the rulebook's, word for word (Rob, 31.10.2026), so these checks
   only guard the shape: nothing empty, no marker of the site's own notes left in. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Block = { t: 'h'; l: number; id: string; text: string } | { t: 'p'; text: string } | { t: 'table'; head: string[]; rows: string[][] };
const doc = JSON.parse(readFileSync(new URL('../../data/rulesref.json', import.meta.url), 'utf8')) as { CHAPTERS: { id: string; title: string; url: string; blocks: Block[] }[] };

describe('the rules reference', () => {
  it('has the eight chapters of the Core rules, in the rulebook’s order, each with its page', () => {
    expect(doc.CHAPTERS.map((c) => c.id)).toEqual(['characteristics', 'the-turn', 'movement', 'shooting', 'close-combat', 'wounds-and-injuries', 'recovery', 'leadership-psychology']);
    for (const c of doc.CHAPTERS) {
      expect(c.title.trim(), c.id).not.toBe('');
      expect(c.url, c.id).toBe(`https://mordheimer.net/docs/rules/${c.id}`);
      expect(c.blocks.length, c.id).toBeGreaterThan(2);
    }
  });

  it('has no empty block and none of the site’s tooltip marks', () => {
    for (const c of doc.CHAPTERS) {
      for (const b of c.blocks) {
        const text = b.t === 'table' ? [...b.head, ...b.rows.flat()].join(' ') : b.text;
        expect(text.trim(), `${c.id}: empty block`).not.toBe('');
        expect(text, `${c.id}: site mark`).not.toMatch(/[\u2753\u270f\u200b]/u);
        if (b.t === 'table') {
          expect(b.rows.length, `${c.id}: table without rows`).toBeGreaterThan(0);
          if (b.head.length) for (const r of b.rows) expect(r.length, `${c.id}: ragged table`).toBe(b.head.length);
        }
      }
    }
  });
});
