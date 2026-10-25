/* The planner (wish #77, Rob, 25.10.2026): a warband kept to see what a strong late-game composition looks like – which
   rares are worth having, how a good end state is put together. Nothing limits its gold: only what it owns is shown
   (`plannerValue`). Its advances are free: what is kept instead is the experience each model would need for them
   (`expNeeded`). It never plays a battle; entering a campaign is a step of its own (the catch-up). */
import type { Model, WarbandState } from '../state/types.ts';
import type { Ctx } from './context.ts';
import { totalSpent } from './costs.ts';
import { advanceStatus } from './profile.ts';
import { update } from '../warband/update.ts';

export const isPlanner = (s: WarbandState): boolean => s.planner === true;

/** The warband as a planner. Meant for a new one; there is no way back, a planner is a kind of warband of its own. */
export function asPlanner(ctx: Ctx): WarbandState {
  return update(ctx, (d) => { d.planner = true; });
}

/** Everything the planner owns, in gold at the list prices: the figure shown in place of the gold in hand. */
export const plannerValue = (ctx: Ctx): number => totalSpent(ctx);

/** The experience a model needs for the advances it has: the one it starts with when it has none, else the threshold
    of the last one. A group of Henchmen counts once (the experience is the group's). A track that runs out (more
    advances than thresholds) stays at its last step. Units that earn no experience need none. */
export function expNeeded(ctx: Ctx, m: Model): number {
  const st = advanceStatus(ctx, m);
  if (!st || st.noxp) return 0;
  const steps = st.thresholds.filter((t) => t > st.start);
  if (st.applied <= 0) return st.start;
  return steps[Math.min(st.applied, steps.length) - 1] ?? st.start;
}
