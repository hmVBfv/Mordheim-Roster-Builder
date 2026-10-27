/* The catch-up (wish #77, Rob, 25.10.2026): a warband that joins a running campaign late is not left behind. It comes in
   as a planner – a composition made without limits (rules/planner.ts) – and the campaign says how much of that it may
   have: what the warbands that have fought have by now.

   Rob's rules:
   - The yardstick is the MEDIAN of the warbands that have fought at least one battle, not the mean: one runaway
     warband and one that was nearly wiped out would pull a mean about. Two figures of each: the rating and the value
     (all it owns in gold at list prices, plus the gold in hand).
   - The rating counts 5 per warrior and every point of experience, a Henchmen group's once per man (rules/costs.ts
     totalRating). So the gap in rating is closed with experience, in rating points, and what the others have in gold and
     gear is met by the value.
   - Experience goes out evenly, never all to one: every Henchmen group gets as many points as battles were fought
     (the median of the others), every Hero as many too, the leader half as many again on top (rounded up); what is left
     of the gap is shared evenly among the Heroes. A Hero may be moved off the even share, but none below the battles
     fought or above one and a half times the even share. Where the gap does not cover that, everybody gets less, evenly.
   - Advances are chosen, not rolled: the planner keeps the experience each model needs for its advances, and the
     entry checks it against what the plan gives.
   - A leader may confirm an entry that exceeds the plan: the plan says what it exceeds, it does not forbid. */
import type { Model, WarbandState } from '../state/types.ts';
import type { Ctx } from '../rules/context.ts';
import { startGold, totalRating } from '../rules/costs.ts';
import { expNeeded, isPlanner, plannerValue } from '../rules/planner.ts';
import { isHeroModel } from '../rules/costs.ts';
import { isLeaderModel, memberCount } from '../rules/profile.ts';
import { unitDef } from '../rules/lookup.ts';
import { campState } from '../warband/log.ts';
import { update } from '../warband/update.ts';
import { warbandWarnings } from '../rules/validation.ts';

/** What one warband that has joined the campaign has by now. */
export interface PeerFigures { rating: number; value: number; battles: number }

/** What the catch-up measures by: the medians over the warbands that have fought. */
export interface CatchUpTargets { peers: number; rating: number; value: number; battles: number }

/** The middle of the list; of an even one the mean of the two in the middle, half up. */
export function median(list: readonly number[]): number {
  if (!list.length) return 0;
  const s = [...list].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

/** The yardstick of a campaign, or null while no warband has fought a battle (then nothing is added to what a warband starts with). */
export function catchUpTargets(peers: readonly PeerFigures[]): CatchUpTargets | null {
  const fought = peers.filter((p) => p.battles >= 1);
  if (!fought.length) return null;
  return { peers: fought.length, rating: median(fought.map((p) => p.rating)), value: median(fought.map((p) => p.value)), battles: median(fought.map((p) => p.battles)) };
}

/** What one model of the warband is given, in experience beyond what it starts with. */
export interface CatchUpGrant {
  uid: number; name: string; hero: boolean; leader: boolean;
  /** Men: a Henchmen group's experience counts once per man in the rating. */
  count: number;
  /** The even share (Heroes, the leader's bonus included), or the fixed amount (a group). */
  exp: number;
  /** Heroes may be moved between each other within these bounds; a group has min = max = exp. */
  min: number; max: number;
}

export interface CatchUpPlan {
  targets: CatchUpTargets | null;
  /** The rating with every model at the experience it starts with. */
  startRating: number;
  /** What is left to close, in rating points. */
  gap: number;
  /** The most the warband may own, in gold at list prices (and so its gold in hand once entered). */
  allowedValue: number;
  grants: CatchUpGrant[];
  /** The gap did not cover the experience of the battles: everybody got less. */
  shrunk: boolean;
}

const startOf = (ctx: Ctx, m: Model): number => Number(unitDef(ctx, m.uid_def)?.exp) || 0;

/** The rating of the warband with every model at the experience it starts with. */
function ratingAtStart(ctx: Ctx): number {
  const models = ctx.s.models.map((m) => ({ ...m, exp: startOf(ctx, m) }));
  return totalRating({ ...ctx, s: { ...ctx.s, models } });
}

const label = (ctx: Ctx, m: Model): string => m.name || unitDef(ctx, m.uid_def)?.name || m.uid_def;

export function catchUpPlan(ctx: Ctx, targets: CatchUpTargets | null): CatchUpPlan {
  const startRating = ratingAtStart(ctx);
  const own = startGold(ctx);
  const models = ctx.s.models.filter((m) => !unitDef(ctx, m.uid_def)?.vehicle);
  const heroes = models.filter((m) => isHeroModel(ctx, m));
  const groups = models.filter((m) => !isHeroModel(ctx, m));
  // the leader first, then the others as the roster lists them
  const order = [...heroes].sort((a, b) => Number(isLeaderModel(ctx, b)) - Number(isLeaderModel(ctx, a)));
  const grant = (m: Model, exp: number, min: number, max: number): CatchUpGrant => ({
    uid: m.uid, name: label(ctx, m), hero: isHeroModel(ctx, m), leader: isLeaderModel(ctx, m) && isHeroModel(ctx, m),
    count: isHeroModel(ctx, m) ? 1 : memberCount(m), exp, min, max,
  });
  if (!targets) {
    return { targets: null, startRating, gap: 0, allowedValue: own, shrunk: false, grants: models.map((m) => grant(m, 0, 0, 0)) };
  }
  const gap = Math.max(0, targets.rating - startRating);
  const B = Math.max(0, targets.battles);
  const H = heroes.length;
  const hasLeader = heroes.some((m) => isLeaderModel(ctx, m));
  const bonus = hasLeader ? Math.ceil(B / 2) : 0;
  const men = groups.reduce((n, m) => n + memberCount(m), 0);
  const base = B * men + B * H + bonus;
  const exps = new Map<number, number>();
  let shrunk = false;
  let baseHero = B;
  let leaderBonus = bonus;
  let groupExp = B;
  let share: number; // the even share of a Hero, before the leader's bonus
  if (gap >= base) {
    const rest = gap - base;
    const per = H ? Math.floor(rest / H) : 0;
    let rem = H ? rest % H : 0;
    for (const m of order) {
      const extra = rem > 0 ? 1 : 0;
      rem -= extra;
      exps.set(m.uid, B + per + extra + (isLeaderModel(ctx, m) ? bonus : 0));
    }
    share = H ? B + rest / H : 0;
  } else {
    shrunk = true;
    const f = base ? gap / base : 0;
    groupExp = Math.floor(B * f);
    baseHero = Math.floor(B * f);
    leaderBonus = Math.floor(bonus * f);
    let left = gap - groupExp * men - H * baseHero - (hasLeader ? leaderBonus : 0);
    for (const m of order) exps.set(m.uid, baseHero + (isLeaderModel(ctx, m) ? leaderBonus : 0));
    // what rounding left over goes to the Heroes, one point at a time, the leader first
    for (let i = 0; left > 0 && H > 0; i = (i + 1) % H) { const m = order[i]!; exps.set(m.uid, exps.get(m.uid)! + 1); left--; }
    share = H ? [...exps.entries()].reduce((n, [, v]) => n + v, 0) / H - (hasLeader ? leaderBonus / H : 0) : 0;
  }
  const cap = Math.floor(1.5 * share);
  const grants = models.map((m) => {
    if (!isHeroModel(ctx, m)) return grant(m, groupExp, groupExp, groupExp);
    const e = exps.get(m.uid)!;
    const bonusOf = isLeaderModel(ctx, m) ? leaderBonus : 0;
    return grant(m, e, baseHero, Math.max(e, cap + bonusOf));
  });
  return { targets, startRating, gap, allowedValue: Math.max(own, targets.value), grants, shrunk };
}

/** The experience chosen for each model, beyond what it starts with: by uid. */
export type CatchUpChoice = Record<number, number>;

/** What the entry exceeds, in words for the player and for the leader who confirms it; empty when it fits. */
export function catchUpProblems(ctx: Ctx, plan: CatchUpPlan, choice: CatchUpChoice): string[] {
  const out: string[] = [];
  const value = plannerValue(ctx);
  if (value > plan.allowedValue) out.push(`Its value is ${value} gc; the catch-up allows ${plan.allowedValue} gc.`);
  let given = 0, planned = 0;
  for (const g of plan.grants) {
    const m = ctx.s.models.find((x) => x.uid === g.uid);
    if (!m) continue;
    const exp = choice[g.uid] ?? g.exp;
    const have = startOf(ctx, m) + exp;
    const need = expNeeded(ctx, m);
    if (need > have) out.push(`${g.name} needs ${need} exp for its advances; the catch-up gives ${have}.`);
    if (g.hero) {
      given += exp;
      planned += g.exp;
      if (exp > g.max) out.push(`${g.name} may have at most ${g.max} experience from the catch-up (now ${exp}).`);
      if (exp < g.min) out.push(`${g.name} may have at least ${g.min} experience from the catch-up (now ${exp}).`);
    } else if (exp !== g.exp) {
      out.push(`${g.name} gets exactly ${g.exp} experience from the catch-up, as a group.`);
    }
  }
  if (given !== planned) out.push(`The experience of the Heroes must add up to ${planned} (now ${given}).`);
  // the rest of the rules, as the entered warband will be read
  out.push(...warbandWarnings(ctxAfter(ctx, plan, choice)));
  return out;
}

const ctxAfter = (ctx: Ctx, plan: CatchUpPlan, choice: CatchUpChoice): Ctx => ({ ...ctx, s: applyCatchUp(ctx, plan, choice, 0) });

/** The planner as the warband it enters as: no longer a planner, the experience given, the gold of the allowance, and a record of
    why (`campaign.catchUp`, read by the leader who confirms it) – with what the entry exceeds, if it does (`over`). */
export function applyCatchUp(ctx: Ctx, plan: CatchUpPlan, choice: CatchUpChoice, round: number, over: readonly string[] = []): WarbandState {
  if (!isPlanner(ctx.s)) return ctx.s;
  return update(ctx, (d, c) => {
    delete d.planner;
    delete d.plannerTrade;
    let total = 0;
    for (const m of d.models) {
      const g = plan.grants.find((x) => x.uid === m.uid);
      const extra = g ? choice[g.uid] ?? g.exp : 0;
      m.exp = startOf(c, m) + extra;
      total += extra * (g?.count ?? 1);
    }
    d.stash = { ...(d.stash ?? { wyrd: 0, items: [] }), gold: plan.allowedValue };
    const t = plan.targets;
    campState(d).catchUp = { round, peers: t?.peers ?? 0, rating: t?.rating ?? 0, value: t?.value ?? 0, battles: t?.battles ?? 0, gold: plan.allowedValue, exp: total, ...(over.length ? { over: over.slice(0, 12).map((x) => x.slice(0, 200)) } : {}) };
  });
}
