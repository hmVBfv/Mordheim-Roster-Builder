/* What the "More men" sheet shows (phase 3c; mockup roster.html "More
   men"): the price of one more man of a group, how many may join, and the
   veterans roll they draw on after the first battle. Worked out by core. */
import * as core from '@mordheim/core';

export interface MoreMenView {
  uid: number;
  name: string;
  unit: string;
  /** How many may join now (0: none). */
  max: number;
  /** One man: his unit with the group's gear, and 2 gc per point of the
      group's experience. */
  base: number;
  exp: number;
  /** Gold per point of experience (rulebook: 2). */
  perExp: number;
  surcharge: number;
  each: number;
  /** The fallback names of the next men, in order. */
  fallbacks: string[];
  /** After the first battle, for a group with experience: this round's
      roll (null: not yet entered) and what it has given out. */
  veterans: { roll: number | null; spent: number } | null;
  gold: number;
  /** Gold is real from the first battle on: no more men than it pays for. */
  goldBinds: boolean;
}

export function moreMenView(ctx: core.Ctx, uid: number): MoreMenView | null {
  const m = ctx.s.models.find((x) => x.uid === uid);
  const def = m ? core.unitDef(ctx, m.uid_def) : null;
  if (!m || !def || def.t !== 'hen' || core.isHeroModel(ctx, m)) return null;
  const max = core.moreMenMax(ctx, m);
  const q = core.memberCount(m);
  const v = core.needsVeterans(ctx, m) ? core.veteransOf(ctx) : undefined;
  const surcharge = core.henchRecruitSurcharge(ctx, m);
  const base = core.modelUnitCost(ctx, m);
  return {
    uid, name: m.name || def.name, unit: def.name, max,
    base, exp: core.veteranExp(m), perExp: core.HENCH_XP_GC, surcharge, each: base + surcharge,
    fallbacks: Array.from({ length: max }, (_, i) => core.memberDefaultName(ctx, m, q + i)),
    veterans: v === undefined ? null : { roll: v?.roll ?? null, spent: v?.spent ?? 0 },
    gold: core.goldCurrent(ctx),
    goldBinds: core.tradeLocked(ctx),
  };
}

/** Why `n` men may not join with this roll, or '' (the sheet's verdict). */
export function moreMenVerdict(v: MoreMenView, n: number, roll: number | null): string {
  if (v.max < 1) return 'No more men fit in this group.';
  if (v.veterans) {
    if (roll == null || !(roll >= 2 && roll <= 12)) return 'Enter the veterans roll, 2–12.';
    if (roll < v.veterans.spent) return `New men have already brought ${v.veterans.spent} experience this round.`;
    const left = roll - v.veterans.spent;
    if (n * v.exp > left) return `${n} m${n === 1 ? 'an brings' : 'en bring'} ${n * v.exp} experience; ${left} of the roll ${left === 1 ? 'is' : 'are'} left.`;
  }
  if (v.goldBinds && n * v.each > v.gold) return `Not enough gold: ${v.gold} gc in hand.`;
  return '';
}
