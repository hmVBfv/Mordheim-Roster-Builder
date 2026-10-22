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

/** A unit limited by the size of others: at most `per` for each man of `of`
    (mordheimer.net, the warband pages; report #46). Heroes count one each, a
    promoted henchman one, a group its men. */
interface Ratio { unit: string; of: string[]; per: number }

/** Orcs of an Orc Mob: Heroes and Boyz, not Goblins, Squigs or the Troll. */
const ORCS = ['boss', 'shaman', 'bigun', 'boyz'];
const RATIOS: Record<string, Ratio[]> = {
  orcmob: [{ unit: 'goblin', of: ORCS, per: 2 }, { unit: 'squig', of: ['goblin'], per: 1 }], // 2 Goblins for each Orc; never more Squigs than Goblins
  nightgoblins: [{ unit: 'squig', of: ['nightgob'], per: 1 }], // never more Cave Squigs than Night Goblins
  blackorcs: [{ unit: 'shootaz', of: ['boyz'], per: 1 }], // only as many Shootaz as Boyz
  bretonnian: [{ unit: 'squire', of: ['paladin', 'errant'], per: 1 }], // no more Squires than Knights
  lizardmen: [{ unit: 'saurusbrave', of: ['skinkbrave'], per: 1 }], // never more Saurus Braves than Skink Braves
  pirates: [{ unit: 'swabbie', of: ['crew'], per: 1 }], // never more Swabbies than Crew
};

/** The units of a warband whose limit hangs on others (their ids). */
export const ratioUnitIds = (wb: string | null | undefined): string[] => (RATIOS[wb ?? ''] ?? []).map((r) => r.unit);

/** Maximum of a unit type; Kurgan marauders may take any number of warhounds.
    A unit that hangs on others (see RATIOS) has the smaller of its own
    maximum and what they allow. */
export function unitMax(ctx: Ctx, def: UnitDef): number | null | undefined {
  if (ctx.s.wb === 'maraudersofchaos' && ctx.s.subtype === 'kurgan' && def.id === 'warhound') return null;
  const r = (RATIOS[ctx.s.wb ?? ''] ?? []).find((x) => x.unit === def.id);
  if (!r) return def.max;
  const men = ctx.s.models.filter((m) => r.of.includes(m.uid_def)).reduce((n, m) => n + (m.promoted ? 1 : (m.qty || 1)), 0);
  return Math.min(def.max ?? Infinity, r.per * men);
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

/** What a warband starts with by the rules: its own gold, its subtype's if it has one. */
function ownStartGold(ctx: Ctx): number {
  const wb = warbandDef(ctx);
  if (!wb) return 500;
  const sub = ctx.s.subtype && wb.subtypes ? wb.subtypes.find((x) => x.key === ctx.s.subtype) : undefined;
  return sub && sub.gold != null ? sub.gold : wb.gold || 500;
}

const given = (v: unknown): v is number | string => v !== '' && v != null && !isNaN(Number(v));

/** The starting gold. The house rule has three forms (report #36, Rob 22.10.2026): the same for everybody (`startGold`, as in the
    Roster Builder), so much more for everybody (`startGoldPlus`), or so many percent more (`startGoldPct`, rounded up to the next
    full gc) – the last two from what each warband starts with. The app keeps only one of them on; if several are set, the first
    of these wins. */
export function startGold(ctx: Ctx): number {
  const h = houseRules(ctx.s);
  if (h && given(h.startGold)) return Number(h.startGold);
  const base = ownStartGold(ctx);
  if (h && given(h.startGoldPlus)) return base + Number(h.startGoldPlus);
  // whole numbers until the division, so that 500 gc and 10 % is 550 and not 550.0000000000001 rounded up
  if (h && given(h.startGoldPct)) return Math.ceil((base * (100 + Number(h.startGoldPct))) / 100);
  return base;
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
