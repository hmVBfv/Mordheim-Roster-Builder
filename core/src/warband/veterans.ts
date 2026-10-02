/* More men for a henchman group, with the veterans roll (phase 3c). New
   logic: the Roster Builder only explained the rule in its post-battle
   helper and left the count to the player.

   Rulebook, Campaigns – New recruits and existing Henchmen groups: "Between
   each battle, roll 2D6: this represents the experience of the warriors
   currently available for hire. You can hire as many warriors as you wish,
   as long as their combined Experience does not exceed your dice roll …
   Disregard any excess Experience points." Each new man arrives with the
   group's experience and costs 2 gc more for each point it adds (core
   henchRecruitSurcharge); post-battle step 5, "Check available veterans".
   While the warband is founded (before its first battle) there is no roll. */
import type { Model, WarbandState } from '../state/types.ts';
import { ctxOf, type Ctx } from '../rules/context.ts';
import { isHeroModel, modelsOf, totalModels, unitMax, warbandMax } from '../rules/costs.ts';
import { unitDef } from '../rules/lookup.ts';
import { memberCount } from '../rules/profile.ts';
import { pbRound, postbattleState } from '../campaign/postbattle.ts';
import { warbandHasFought } from '../rules/equipment.ts';
import { setMemberName } from './advance.ts';
import { setQty } from './roster.ts';
import { campState } from './log.ts';
import { findModel, update, type WarbandDraft } from './update.ts';

/** The veterans roll of this round's post-battle sequence and how much of
    it new men have used. */
export interface Veterans { roll: number; spent: number }

/** The roll of the current sequence, or null if none is entered yet. */
export function veteransOf(ctx: Ctx): Veterans | null {
  const v = postbattleState(ctx).veterans as Veterans | undefined;
  return v && Number.isInteger(v.roll) ? { roll: v.roll, spent: Number(v.spent) || 0 } : null;
}

/** Experience one more man brings into this group: the group's own. */
export function veteranExp(m: Model): number {
  return Math.max(0, Number(m.exp) || 0);
}

/** Does adding men to this group draw on the veterans roll? From the first
    battle on, for a group with experience. */
export function needsVeterans(ctx: Ctx, m: Model): boolean {
  return warbandHasFought(ctx) && veteranExp(m) > 0;
}

/** How many more men the group may take: five to a group, the unit's
    limit, the warband's maximum (the limits of core setQty and the recruit
    list). */
export function moreMenMax(ctx: Ctx, m: Model): number {
  const def = unitDef(ctx, m.uid_def);
  if (!def || def.t !== 'hen' || isHeroModel(ctx, m)) return 0;
  let n = 5 - memberCount(m);
  const umx = unitMax(ctx, def);
  if (umx != null) n = Math.min(n, umx - modelsOf(ctx, def.id));
  n = Math.min(n, warbandMax(ctx) - totalModels(ctx));
  return Math.max(0, n);
}

function veteransOn(d: WarbandDraft, round: number): Veterans | null {
  const pb = ((campState(d) as unknown as { postbattle?: Record<string, Record<string, unknown>> }).postbattle ??= {});
  const st = (pb[round] ??= { done: {}, wyrd: null });
  return (st.veterans as Veterans | undefined) ?? null;
}

/** Enters the 2D6 of this round's veterans roll (2–12). A correction may
    not fall below what new men have already used. */
export function setVeteransRoll(ctx: Ctx, roll: number): WarbandState {
  if (!Number.isInteger(roll) || roll < 2 || roll > 12) return ctx.s;
  const cur = veteransOf(ctx);
  if (cur && (cur.roll === roll || roll < cur.spent)) return ctx.s;
  const round = pbRound(ctx);
  return update(ctx, (d) => {
    veteransOn(d, round);
    const st = (d.campaign as unknown as { postbattle: Record<string, Record<string, unknown>> }).postbattle[round]!;
    st.veterans = { roll, spent: cur?.spent ?? 0 };
  });
}

/** Why `n` more men may not join this group now, or ''. */
export function moreMenProblem(ctx: Ctx, uid: number, n: number): string {
  const m = findModel(ctx.s, uid);
  if (!m) return 'no such group';
  const max = moreMenMax(ctx, m);
  if (!Number.isInteger(n) || n < 1) return 'at least one man';
  if (n > max) return max ? `at most ${max} more` : 'the group is full';
  if (!needsVeterans(ctx, m)) return '';
  const v = veteransOf(ctx);
  if (!v) return 'the veterans roll of this round';
  const bring = n * veteranExp(m);
  const left = v.roll - v.spent;
  return bring > left ? `${n} m${n === 1 ? 'an brings' : 'en bring'} ${bring} experience; ${left} of the roll of ${v.roll} ${left === 1 ? 'is' : 'are'} left` : '';
}

/** Adds `n` men to a henchman group, each with the group's experience and
    equipment, at the price of core setQty (the surcharge for experience
    included); the interface books it. From the first battle on a group with
    experience draws on this round's veterans roll. `names` names the new
    men in order (blank: the fallback name). */
export function addMen(ctx: Ctx, uid: number, n: number, names: readonly string[] = []): WarbandState {
  if (moreMenProblem(ctx, uid, n)) return ctx.s;
  const m0 = findModel(ctx.s, uid)!;
  const q = memberCount(m0);
  let s = setQty(ctx, uid, q + n);
  if (memberCount(findModel(s, uid)!) !== q + n) return ctx.s;
  names.slice(0, n).forEach((nm, i) => {
    if (String(nm ?? '').trim()) s = setMemberName(ctxOf(ctx.data, s), uid, q + i, String(nm).trim());
  });
  if (!needsVeterans(ctx, m0)) return s;
  const round = pbRound(ctx);
  return update(ctxOf(ctx.data, s), (d) => {
    const v = veteransOn(d, round)!;
    v.spent += n * veteranExp(m0);
  });
}
