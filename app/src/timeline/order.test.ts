/* Keys of the story's order: between two there is always another. */
import { describe, expect, it } from 'vitest';
import { between, defaultKey } from './order.ts';

describe('the order of the story', () => {
  it('a key between any two, in the order strings sort', () => {
    const cases: [string | null, string | null][] = [[null, null], [null, '5'], ['5', null], ['5', '6'], ['5', '51'], ['09', '1'], ['99', null], [null, '0001'], ['1234', '1235'], [defaultKey('2026-10-05T20:00:00.000Z', 2), defaultKey('2026-10-05T20:00:01.000Z', 2)]];
    for (const [a, b] of cases) {
      const k = between(a, b);
      expect(k).toMatch(/^[0-9]*[1-9]$/);
      if (a !== null) expect(k > a, `${k} > ${a}`).toBe(true);
      if (b !== null) expect(k < b, `${k} < ${b}`).toBe(true);
    }
  });

  it('moving again and again between the same two never runs out', () => {
    let lo = '5', hi = '6';
    for (let i = 0; i < 200; i++) {
      const k = between(lo, hi);
      expect(k > lo && k < hi).toBe(true);
      if (i % 2) lo = k; else hi = k;
    }
  });

  it('a block never moved: by turn, then by when it was recorded; equal neighbours still get a place after', () => {
    expect(defaultKey('2026-10-05T20:00:00.000Z', 3)).toBe('0320261005200000000');
    expect(defaultKey('2026-10-05T20:00:00.000Z', 2) < defaultKey('2026-10-05T19:00:00.000Z', 3)).toBe(true);
    const a = defaultKey('2026-10-05T20:00:00.000Z');
    expect(between(a, a) > a).toBe(true);
  });
});
