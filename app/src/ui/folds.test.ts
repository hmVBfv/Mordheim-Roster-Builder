/* Every fold-out (<details>) shows that it opens: its <summary> carries the `fold` class of ui.module.css, which draws a chevron.
   A summary that is styled as a flex row loses the browser's own triangle, and then nothing says it can be tapped (the report
   form's "What goes along", and the same in a dozen other places). */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? files(p) : p.endsWith('.tsx') && !p.endsWith('.test.tsx') ? [p] : [];
});

describe('fold-outs', () => {
  it('every <summary> has the fold class', () => {
    const bad: string[] = [];
    for (const f of files('src')) {
      for (const m of readFileSync(f, 'utf8').matchAll(/<summary\b([^>]*)>/g)) {
        if (!/\bfold\b/.test(m[1] ?? '')) bad.push(`${f}: <summary${m[1]}>`);
      }
    }
    expect(bad).toEqual([]);
  });
});
