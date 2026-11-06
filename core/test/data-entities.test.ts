/* Report of 6.11.2026: the rules of the Chaos Dwarfs showed "&amp;". The data is plain text with <b> and <br> – the app draws it as text, so
   an HTML entity in it would show as it is written. No string of any data file may carry one. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = join(import.meta.dirname, '..', '..', 'data');

function strings(v: unknown, path: string, out: [string, string][]): void {
  if (typeof v === 'string') out.push([path, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => strings(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) strings(x, `${path}.${k}`, out);
}

describe('the text of the data files', () => {
  it('has no HTML entity in any string', () => {
    const found: string[] = [];
    for (const f of readdirSync(DIR).filter((n) => n.endsWith('.json'))) {
      const all: [string, string][] = [];
      strings(JSON.parse(readFileSync(join(DIR, f), 'utf8')), f, all);
      for (const [path, s] of all) for (const m of s.matchAll(/&(?:[a-z]+|#\d+|#x[0-9a-f]+);/gi)) found.push(`${path}: ${m[0]}`);
    }
    expect(found).toEqual([]);
  });
});
