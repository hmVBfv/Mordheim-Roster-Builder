/* The search of the Rules tab. A word is cut down to its stem, so "hide" finds "hiding" and "hiding" finds "hide"; a block
   matches when it holds every word of the query. Plain text and no index: the rules are some 70 KB. */
import type { Block } from './data.ts';

/** The lower-case words of a text; anything that is not a letter or digit separates them. */
export const words = (text: string): string[] => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** A light English stem: -ies becomes -y; -ing, -ed, -es, -s and a final -e go; a stem keeps at least three letters. */
export function stem(word: string): string {
  let w = word.toLowerCase();
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  for (const end of ['ing', 'ed', 'es', 's']) {
    if (w.length - end.length >= 3 && w.endsWith(end)) { w = w.slice(0, -end.length); break; }
  }
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}

/** Two stems are the same word when one starts with the other (hid, hidden); a stem under three letters only matches itself. */
const same = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a)));

export const textOf = (b: Block): string => (b.t === 'table' ? [...b.head, ...b.rows.flat()].join(' ') : b.text);

export interface Hit { index: number }

/** The blocks that hold every word of the query. A query needs a word of two letters or more. */
export function searchBlocks(blocks: Block[], query: string): Hit[] {
  const q = words(query).filter((w) => w.length >= 2).map(stem);
  if (!q.length) return [];
  const hits: Hit[] = [];
  blocks.forEach((b, index) => {
    const have = words(textOf(b)).map(stem);
    if (q.every((s) => have.some((h) => same(h, s)))) hits.push({ index });
  });
  return hits;
}

/** A text cut into pieces, the words that match the query marked. */
export function mark(text: string, query: string): { text: string; hit: boolean }[] {
  const q = words(query).filter((w) => w.length >= 2).map(stem);
  return text.split(/([\p{L}\p{N}]+)/u).filter((s) => s !== '').map((s) => ({ text: s, hit: /^[\p{L}\p{N}]+$/u.test(s) && q.some((x) => same(stem(s), x)) }));
}
