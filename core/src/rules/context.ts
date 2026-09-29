import type { GameData } from '../data/types.ts';
import type { WarbandState } from '../state/types.ts';

/**
 * Everything a rule needs: the game data and the warband it is asked about.
 * Rules never modify either. Where the legacy app read the global `S`, core
 * functions take a Ctx.
 */
export interface Ctx {
  readonly data: GameData;
  readonly s: WarbandState;
}

export function ctxOf(data: GameData, s: WarbandState): Ctx {
  return { data, s };
}
