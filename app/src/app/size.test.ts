/* The first-load budget counts what the page really loads (scripts/size.mjs):
   the entry and every chunk it preloads, not just files named "index". */
import { describe, expect, it } from 'vitest';
import ui from '../../../docs/ui.md?raw';
// @ts-expect-error – a plain Node script without types
import { LIMITS, firstLoad, verdict } from '../../scripts/size.mjs';

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

  it('holds each flavour to its own limit (ADR 0021): the campaign may be larger than the Quick Build', () => {
    const kB = (n: number) => n * 1024;
    expect(Object.keys(LIMITS).sort()).toEqual(['campaign', 'quickbuild']);
    expect(LIMITS.campaign).toBeGreaterThan(LIMITS.quickbuild);
    // 230 kB is fine for the campaign and too much for the Quick Build
    expect(verdict('campaign', kB(230)).over).toBe(false);
    expect(verdict('quickbuild', kB(230)).over).toBe(true);
    // the limit itself still passes, one byte more does not
    expect(verdict('quickbuild', LIMITS.quickbuild).over).toBe(false);
    expect(verdict('campaign', LIMITS.campaign + 1).over).toBe(true);
    expect(verdict('campaign', kB(190)).line).toBe('campaign: JavaScript on first load 190.0 kB gzipped (limit 250 kB)');
    expect(() => verdict('desktop', 1)).toThrow(/no first-load limit/);
  });

  it('is the number docs/ui.md states, for both flavours', () => {
    const row = ui.split('\n').find((l) => l.startsWith('| JavaScript beim ersten Laden'));
    expect(row, 'the "Leistungsgrenzen" table has a first-load row').toBeDefined();
    expect(row).toContain(`Kampagne ≤ ${LIMITS.campaign / 1024} KB`);
    expect(row).toContain(`Quick Build ≤ ${LIMITS.quickbuild / 1024} KB`);
  });
});
