/* The planner (wish #77, Rob, 25.10.2026): a warband kept to see what a strong late-game composition looks like – which
   rares are worth having, how a good end state is put together. Nothing limits its gold: only what it owns is shown
   (`plannerValue`). Its advances are free: what is kept instead is the experience each model would need for them
   (`expNeeded`). It never plays a battle; entering a campaign is a step of its own (the catch-up). */
import type { Model, WarbandState } from '../state/types.ts';
import type { Ctx } from './context.ts';
import { totalRating, totalSpent } from './costs.ts';
import { advanceStatus } from './profile.ts';
import { update } from '../warband/update.ts';

export const isPlanner = (s: WarbandState): boolean => s.planner === true;

/** The warband as a planner. Meant for a new one; there is no way back, a planner is a kind of warband of its own. */
export function asPlanner(ctx: Ctx): WarbandState {
  return update(ctx, (d) => { d.planner = true; });
}

/** Opens or closes a planner's Trading Post (wish #89, Rob, 26.10.2026): open, it trades as a warband does after its first battle –
    common items bought, rare ones found, selling at half price – while its gold stays no limit. Any other warband is left as it is. */
export function setPlannerTrade(ctx: Ctx, on: boolean): WarbandState {
  if (!isPlanner(ctx.s)) return ctx.s;
  return update(ctx, (d) => { if (on) d.plannerTrade = true; else delete d.plannerTrade; });
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

/** What a planner is tracked by (wish #79): what it owns (`plannerValue`), the experience all its advances would need, and its rating. No limit and no rule
    about how the experience is spread – the figures are only kept. */
export function plannerFigures(ctx: Ctx): { value: number; exp: number; rating: number } {
  return { value: plannerValue(ctx), exp: ctx.s.models.reduce((n, m) => n + expNeeded(ctx, m), 0), rating: totalRating(ctx) };
}
