/* Counts, costs, gold and rating of a warband (legacy engine.js countOf …
   totalHeroes, modelRating; app.js totalRating). */
import type { UnitDef } from '../data/types.ts';
import type { Model } from '../state/types.ts';
import { houseRules } from '../state/house.ts';
import type { Ctx } from './context.ts';
import { eqCost, heirloomDiscount, mutCost, rareCost } from './equipment.ts';
import { dpHireTotal, dpRatingTotal, hsEqTotal, hsHireTotal, hsRatingTotal, hsSizeBonus } from './hire.ts';
import { unitDef, warbandDef } from './lookup.ts';
import { unitBaseCost } from './pricing.ts';

/** 2 gc per extra experience point for a man joining a blooded henchman group. */
export const HENCH_XP_GC = 2;

export function countOf(ctx: Ctx, id: string): number {
  return ctx.s.models.filter((m) => m.uid_def === id).length;
}

/** Heroes: entries; henchmen: men in the groups (promoted men excluded). */
export function modelsOf(ctx: Ctx, id: string): number {
  const def = unitDef(ctx, id);
  if (def?.t === 'hero') return countOf(ctx, id);
  return ctx.s.models.filter((m) => m.uid_def === id && !m.promoted).reduce((s, m) => s + (m.qty || 1), 0);
}

/** Maximum of a unit type; Kurgan marauders may take any number of warhounds. */
export function unitMax(ctx: Ctx, def: UnitDef): number | null | undefined {
  if (ctx.s.wb === 'maraudersofchaos' && ctx.s.subtype === 'kurgan' && def.id === 'warhound') return null;
  return def.max;
}

export function warbandMax(ctx: Ctx): number {
  const h = houseRules(ctx.s);
  if (h.max !== '' && h.max != null) return Number(h.max);
  const wb = warbandDef(ctx);
  if (!wb) return 0;
  if (ctx.s.wb === 'maraudersofchaos' && ctx.s.subtype === 'hung') return 12;
  let mx = wb.max;
  if (ctx.s.wb === 'carnival' && ctx.s.models.some((m) => m.uid_def === 'cart')) mx += 2;
  mx += hsSizeBonus(ctx);
  return mx;
}

export function isHeroModel(ctx: Ctx, m: Model): boolean {
  const def = unitDef(ctx, m.uid_def);
  return (!!def && def.t === 'hero') || !!m.promoted;
}

/** Rating of one model: 5 (20 if Large) plus experience; vehicles count 0. */
export function modelRating(ctx: Ctx, m: Model): number {
  const def = unitDef(ctx, m.uid_def);
  if (!def || def.vehicle) return 0;
  return (def.large ? 20 : 5) + Number(m.exp || 0);
}

/** Cost of ONE model of this entry: unit, equipment, mutations, rare items,
    less the Kislev heirloom discount. */
export function modelUnitCost(ctx: Ctx, m: Model): number {
  const def = unitDef(ctx, m.uid_def);
  if (!def) return 0;
  return unitBaseCost(ctx, def) + eqCost(ctx, m) + mutCost(ctx, m) + rareCost(m) - heirloomDiscount(ctx, m);
}

/** What ANOTHER man costs to join this henchman group: 2 gc per experience
    point above a fresh recruit's. Never a revaluation of the men already
    there, so it is not part of modelUnitCost. */
export function henchRecruitSurcharge(ctx: Ctx, m: Model): number {
  const def = unitDef(ctx, m.uid_def);
  if (!def || def.t !== 'hen' || isHeroModel(ctx, m)) return 0;
  return HENCH_XP_GC * Math.max(0, (Number(m.exp) || 0) - (Number(def.exp) || 0));
}

export function henchRecruitCost(ctx: Ctx, m: Model): number {
  return modelUnitCost(ctx, m) + henchRecruitSurcharge(ctx, m);
}

/** Cost of the whole entry (a henchman group counts every man) plus the
    experience surcharge actually paid when veterans joined. */
export function modelTotalCost(ctx: Ctx, m: Model): number {
  const def = unitDef(ctx, m.uid_def);
  const q = def?.t === 'hen' ? Number(m.qty) : 1;
  return modelUnitCost(ctx, m) * q + (Number(m.xpPaid) || 0);
}

/** What a fallen warrior was worth in real gold: himself, his gear and any
    surcharge paid for his experience. Experience itself is never priced. */
export function lossValueOf(ctx: Ctx, m: Model | null | undefined): number {
  if (!m) return 0;
  return modelUnitCost(ctx, { ...m, qty: 1 }) + (Number(m.xpPaid) || 0);
}

export function startGold(ctx: Ctx): number {
  const h = houseRules(ctx.s);
  if (h && h.startGold !== '' && h.startGold != null && !isNaN(Number(h.startGold))) return Number(h.startGold);
  const wb = warbandDef(ctx);
  if (!wb) return 500;
  const sub = ctx.s.subtype && wb.subtypes ? wb.subtypes.find((x) => x.key === ctx.s.subtype) : undefined;
  return sub && sub.gold != null ? sub.gold : wb.gold || 500;
}

/** The treasury as stored; empty means starting gold. */
export function goldTreasury(ctx: Ctx): number {
  const g = ctx.s.stash?.gold;
  return g == null || g === '' ? startGold(ctx) : Number(g) || 0;
}

/** Everything the warband currently owns, in gold. */
export function totalSpent(ctx: Ctx): number {
  return ctx.s.models.reduce((s, m) => s + modelTotalCost(ctx, m), 0) + hsHireTotal(ctx) + dpHireTotal(ctx) + hsEqTotal(ctx);
}

/** Gold in hand: the treasury less what the warband owns. Losses are settled
    once, when they happen, not derived from the Fallen list. */
export function goldCurrent(ctx: Ctx): number {
  return goldTreasury(ctx) - totalSpent(ctx);
}

/** Large creatures, by the unit's `large` flag (never by rules text). */
export function totalLarge(ctx: Ctx): number {
  return ctx.s.models.reduce((s, m) => {
    const d = unitDef(ctx, m.uid_def);
    if (!d || !d.large || d.vehicle) return s;
    return s + (d.t === 'hen' ? Number(m.qty) || 1 : 1);
  }, 0);
}

export function totalModels(ctx: Ctx): number {
  return ctx.s.models.reduce((s, m) => {
    const d = unitDef(ctx, m.uid_def);
    if (d && d.vehicle) return s;
    return s + (d && d.t === 'hen' ? Number(m.qty) : 1);
  }, 0);
}

/** Heroes, promoted henchmen included, plus Hired Swords that take a hero slot. */
export function totalHeroes(ctx: Ctx): number {
  return ctx.s.models.filter((m) => isHeroModel(ctx, m)).length + (ctx.s.hired ?? []).filter((h) => ctx.data.HIREDSWORDS[h.key]?.slot).length;
}

/** The official Warband Rating: 5 per warrior (20 for Large creatures) plus
    all experience; Hired Swords and Dramatis Personae add their own rating;
    vehicles add nothing. */
export function totalRating(ctx: Ctx): number {
  let r = 0;
  ctx.s.models.forEach((m) => {
    const def = unitDef(ctx, m.uid_def);
    if (!def || def.vehicle) return;
    const q = def.t === 'hen' ? Number(m.qty) : 1;
    r += modelRating(ctx, m) * q;
  });
  r += hsRatingTotal(ctx);
  r += dpRatingTotal(ctx);
  return r;
}
