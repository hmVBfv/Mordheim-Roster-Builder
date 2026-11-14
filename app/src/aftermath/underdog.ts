/* The underdog bonus of the battle for one warband, from the ratings frozen when each warband confirmed its version (N4). Each opponent is
   compared on its own; the warband takes the largest gap to a higher-rated one (Rob, 13.11.2026). */
import * as core from '@mordheim/core';
import type { GameData } from '@mordheim/core';
import type { BattleView } from '../battle/api.ts';
import { readTotals } from '../battle/Versions.tsx';

export interface UnderdogRow { name: string; rating: number | null; gap: number | null; bonus: number }
export interface UnderdogView {
  /** Our rating before the battle, null if it was not frozen. */
  own: number | null;
  rows: UnderdogRow[];
  /** What the rule gives; 0 when no opponent is higher-rated, or a rating is missing. */
  bonus: number;
  /** The row that decides (the largest), by index into `rows`, or null. */
  decides: number | null;
  /** A rating is missing: the bonus cannot be worked out, the player types it. */
  incomplete: boolean;
}

export function underdogOf(data: GameData, view: BattleView, warbandId: string): UnderdogView {
  const rating = (p: BattleView['participants'][number]) => readTotals(p.beforeTotals)?.rating ?? null;
  const me = view.participants.find((p) => p.warbandId === warbandId);
  const own = me ? rating(me) : null;
  const rows: UnderdogRow[] = view.participants.filter((p) => p.warbandId !== warbandId).map((p) => {
    const r = rating(p);
    const gap = own != null && r != null ? r - own : null;
    return { name: p.name, rating: r, gap, bonus: gap != null ? core.underdogBonus(data, gap) : 0 };
  });
  let decides: number | null = null;
  rows.forEach((r, i) => { if (r.bonus > 0 && (decides == null || r.bonus > rows[decides]!.bonus)) decides = i; });
  const bonus = own == null ? 0 : core.underdogAgainst(data, own, rows.flatMap((r) => (r.rating == null ? [] : [r.rating])));
  return { own, rows, bonus, decides, incomplete: own == null || rows.some((r) => r.rating == null) };
}
