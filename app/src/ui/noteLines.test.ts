/* Report of 10.11.2026: the note under a unit's story stood after its text with a dot instead of on a line of its own. A note that explains something
   (a sentence, not a fact like "Mercenaries" or "leader") is a line of its own wherever it stands: no "· " in front of words that run on from the
   text before it. Read from the sources, so a new one cannot bring it back. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? files(p) : p.endsWith('.tsx') && !p.endsWith('.test.tsx') ? [p] : [];
});

/** Lines of facts joined by dots, which are meant to be one line: a warband's row (type · planner · only on this device) and an item's (name · source · nobody here may use it). */
const META = ['src/routes/WarbandList.tsx', 'src/routes/RareLine.tsx'];
const WORDS = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

describe('notes next to a text', () => {
  it('are on a line of their own: no "· " before a sentence of four words or more', () => {
    const bad: string[] = [];
    for (const f of files('src').filter((x) => !META.includes(x.replace(/\\/g, '/')))) {
      const t = readFileSync(f, 'utf8');
      // a <small> that begins with the dot and runs on in words
      for (const m of t.matchAll(/<small[^>]*>\s*· ([^<{]*)</g)) if (WORDS(m[1] ?? '') >= 4) bad.push(`${f}: <small> · ${(m[1] ?? '').slice(0, 50)}`);
      // a string that begins with the dot and runs on in words, put after a text (` · not a warband of the rulebook …`)
      for (const m of t.matchAll(/['`]\s·\s([a-z][^'`${}]*)['`]/g)) if (WORDS(m[1] ?? '') >= 4) bad.push(`${f}: ' · ${(m[1] ?? '').slice(0, 50)}`);
    }
    expect(bad).toEqual([]);
  });
});
