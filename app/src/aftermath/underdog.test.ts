/* The underdog bonus from the frozen ratings of a battle: pairwise, the largest gap to a higher-rated opponent. */
import { describe, expect, it } from 'vitest';
import type { BattleView } from '../battle/api.ts';
import { data } from '../test/data.ts';
import { underdogOf } from './underdog.ts';

const totals = (rating: number) => ({ rating, spent: 0, models: 0, heroes: 0, gold: 0, fallen: 0 });
const view = (ratings: Record<string, number | null>): BattleView => ({
  participants: Object.entries(ratings).map(([id, r]) => ({ warbandId: id, name: `W-${id}`, beforeTotals: r == null ? undefined : totals(r) })),
} as unknown as BattleView);

describe('underdogOf', () => {
  it('against one higher-rated opponent: the gap, the bonus, and the row that decides', () => {
    const u = underdogOf(data, view({ me: 200, a: 290 }), 'me');
    expect(u).toMatchObject({ own: 200, bonus: 2, decides: 0, incomplete: false });
    expect(u.rows).toEqual([{ name: 'W-a', rating: 290, gap: 90, bonus: 2 }]);
  });

  it('against several: each is compared on its own and the largest gap counts', () => {
    const u = underdogOf(data, view({ me: 300, a: 350, b: 420, c: 250 }), 'me');
    expect(u.rows.map((r) => [r.name, r.gap, r.bonus])).toEqual([['W-a', 50, 0], ['W-b', 120, 3], ['W-c', -50, 0]]);
    expect(u).toMatchObject({ bonus: 3, decides: 1 });
  });

  it('nothing when nobody is higher-rated', () => {
    expect(underdogOf(data, view({ me: 300, a: 300, b: 100 }), 'me')).toMatchObject({ bonus: 0, decides: null, incomplete: false });
  });

  it('a rating that was never frozen makes it incomplete, so the player types the bonus', () => {
    expect(underdogOf(data, view({ me: 300, a: null }), 'me')).toMatchObject({ bonus: 0, incomplete: true });
    expect(underdogOf(data, view({ me: null, a: 400 }), 'me')).toMatchObject({ own: null, bonus: 0, incomplete: true });
  });
});
