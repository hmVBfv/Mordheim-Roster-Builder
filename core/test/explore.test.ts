/* N5 (docs/plan-postbattle.md): the exploration roll of the post-battle sequence. The dice go in (typed or rolled in the app), the sum gives
   the shards found, a double or better an unusual place. mordheimer.net, Campaigns: Income – "rolling multiples" and the example. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const fresh = (): WarbandState => ({ ...core.newWarband(data, 'merc'), campaign: { on: true, round: 1, districts: {} } } as WarbandState);
const rec = (s: WarbandState) => (s.campaign as { postbattle?: Record<string, { explore?: Record<string, unknown>; finds?: unknown[] }> }).postbattle?.['1'];

describe('the shards found by the total of the dice', () => {
  it('reads the chart: 1–5 one, 6–11 two, 12–17 three, 18–24 four, 25–30 five, 31–35 six, 36+ seven', () => {
    const at = (n: number) => core.exploreShards(data, n);
    expect([1, 5, 6, 11, 12, 17, 18, 24, 25, 30, 31, 35, 36, 99].map(at)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7]);
    expect(at(0)).toBe(0);
  });
});

describe('the unusual place a multiple leads to', () => {
  it('none without two of a number', () => {
    expect(core.exploreMultiple([1, 2, 3, 4, 5, 6])).toBeNull();
    expect(core.exploreMultiple([])).toBeNull();
  });
  it('the example of the rules page: 5, 5, 5, 3 is the three 5s – Market Hall', () => {
    expect(core.exploreMultiple([5, 5, 5, 3])).toEqual({ count: 3, face: 5, key: '5 5 5' });
    expect(data.PB_LOCATIONS.find((l) => l[0] === '5 5 5')?.[1]).toBe('Market hall');
  });
  it('the most numerous multiple counts: a double 3 and a triple 5 is the triple 5', () => {
    expect(core.exploreMultiple([3, 3, 5, 5, 5, 1])).toEqual({ count: 3, face: 5, key: '5 5 5' });
  });
  it('two multiples of one size: the higher result counts (double 1 and double 3 is the double 3)', () => {
    expect(core.exploreMultiple([1, 1, 3, 3, 6])).toEqual({ count: 2, face: 3, key: '3 3' });
  });
  it('up to six of a kind', () => {
    expect(core.exploreMultiple([6, 6, 6, 6, 6, 6])).toEqual({ count: 6, face: 6, key: '6 6 6 6 6 6' });
    expect(core.exploreMultiple([2, 2, 2, 2])).toEqual({ count: 4, face: 2, key: '2 2 2 2' });
  });
  it('every key it can give is a place of the chart', () => {
    const keys = new Set(data.PB_LOCATIONS.map((l) => l[0]));
    for (let face = 1; face <= 6; face++) for (let n = 2; n <= 6; n++) expect(keys.has(core.exploreMultiple(Array(n).fill(face))!.key)).toBe(true);
  });
});

describe('the result of the dice that were kept', () => {
  it('the rules page’s example: 5, 5, 5, 3 → 18 → four shards and the Market Hall', () => {
    expect(core.exploreResult(data, [5, 5, 5, 3])).toEqual({ total: 18, shards: 4, location: '5 5 5' });
  });
});

describe('recording the exploration', () => {
  it('puts the shards into the stash and keeps the roll, the result and a find with its origin', () => {
    const s = core.recordExploration(ctx(fresh()), 1, { rolled: [5, 5, 3, 1], by: 'entered' });
    expect(s.stash?.wyrd).toBe(3); // 14: three shards
    const r = rec(s)!;
    expect(r.explore).toMatchObject({ rolled: { value: [5, 5, 3, 1], by: 'entered' }, kept: [5, 5, 3, 1], total: 14, shards: 3, location: '5 5' });
    expect(r.finds).toEqual([{ id: 1, kind: 'wyrd', source: 'explore', amount: 3, text: expect.stringContaining('3 shards') }]);
  });

  it('shards added to what the stash already holds', () => {
    const base = core.stashAdjust(ctx(fresh()), 'wyrd', 2);
    expect(core.recordExploration(ctx(base), 1, { rolled: [6, 6, 6], by: 'app' }).stash?.wyrd).toBe(2 + 4); // 18: four shards
  });

  it('with more than six dice, six are kept – the best unless the player chose', () => {
    const s = core.recordExploration(ctx(fresh()), 1, { rolled: [1, 1, 6, 6, 5, 5, 4], by: 'app' });
    expect(rec(s)!.explore).toMatchObject({ kept: [6, 6, 5, 5, 4, 1], total: 27 });
    const chosen = core.recordExploration(ctx(fresh()), 1, { rolled: [1, 1, 6, 6, 5, 5, 4], kept: [1, 1, 6, 6, 5, 5], by: 'entered' });
    expect(rec(chosen)!.explore).toMatchObject({ kept: [1, 1, 6, 6, 5, 5], total: 24 });
  });

  it('a second roll replaces the first: its shards leave the stash, the new ones come in, one find stays', () => {
    let s = core.recordExploration(ctx(fresh()), 1, { rolled: [6, 6, 6, 6, 6, 6], by: 'entered' }); // 36 → 7
    expect(s.stash?.wyrd).toBe(7);
    s = core.recordExploration(ctx(s), 1, { rolled: [1, 2], by: 'entered' }); // 3 → 1
    expect(s.stash?.wyrd).toBe(1);
    expect(rec(s)!.finds).toHaveLength(1);
    expect(rec(s)!.explore).toMatchObject({ total: 3, shards: 1, location: null });
  });

  it('refuses dice that are not dice, a kept die that was not rolled, and too many kept', () => {
    const base = fresh();
    for (const bad of [{ rolled: [0, 3] }, { rolled: [7] }, { rolled: [2.5] }, { rolled: [] }, { rolled: [1, 2], kept: [1, 3] }, { rolled: [1, 1, 1, 1, 1, 1, 1], kept: [1, 1, 1, 1, 1, 1, 1] }, { rolled: [1, 2], kept: [] }]) {
      const input = { ...bad, by: 'entered' as const };
      expect(core.explorationProblem(ctx(base), 1, input), JSON.stringify(bad)).toBeTruthy();
      expect(core.recordExploration(ctx(base), 1, input), JSON.stringify(bad)).toBe(base);
    }
  });

  it('a second roll is refused while the first one’s shards are no longer in the stash', () => {
    let s = core.recordExploration(ctx(fresh()), 1, { rolled: [6, 6, 6, 6, 6, 6], by: 'entered' });
    s = core.stashAdjust(ctx(s), 'wyrd', -5);
    expect(core.explorationProblem(ctx(s), 1, { rolled: [1], by: 'entered' })).toMatch(/shards/);
    expect(core.recordExploration(ctx(s), 1, { rolled: [1], by: 'entered' })).toBe(s);
  });

  it('is taken back: the shards leave the stash and the record and the find go', () => {
    const s = core.recordExploration(ctx(core.stashAdjust(ctx(fresh()), 'wyrd', 1)), 1, { rolled: [6, 6, 6], by: 'entered' });
    const back = core.clearExploration(ctx(s), 1);
    expect(back.stash?.wyrd).toBe(1);
    expect(rec(back)!.explore).toBeUndefined();
    expect(rec(back)!.finds ?? []).toEqual([]);
  });

  it('works on a frozen state and leaves it as it was', () => {
    const s = Object.freeze(fresh()) as WarbandState;
    const next = core.recordExploration(ctx(s), 1, { rolled: [4, 4], by: 'app' });
    expect(next).not.toBe(s);
    expect(s.stash?.wyrd ?? 0).toBe(0);
  });
});
