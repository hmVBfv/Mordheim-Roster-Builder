/* The first-load budget counts what the page really loads (scripts/size.mjs):
   the entry and every chunk it preloads, not just files named "index". */
import { describe, expect, it } from 'vitest';
// @ts-expect-error – a plain Node script without types
import { firstLoad } from '../../scripts/size.mjs';

describe('the first-load budget', () => {
  it('counts the entry and every preloaded chunk, once', () => {
    const html = `<!doctype html><head>
      <script type="module" crossorigin src="/assets/index-abc.js"></script>
      <link rel="modulepreload" crossorigin href="/assets/db-123.js">
      <link rel="modulepreload" crossorigin href="/assets/api-456.js">
      <link rel="modulepreload" crossorigin href="/assets/db-123.js">
      <link rel="stylesheet" href="/assets/index.css">
      <script src="/theme-boot.js"></script></head>`;
    expect(firstLoad(html)).toEqual(['/assets/index-abc.js', '/assets/db-123.js', '/assets/api-456.js']);
  });
});
