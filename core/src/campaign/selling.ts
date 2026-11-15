/* Selling wyrdstone and treasure (N9, docs/plan-postbattle.md): the price depends on the size of the warband, and a few rules change that
   size – Ogres of the Maneaters count double, a mob counts as one, the Halfling Cook (a D6 of 5+) and Victuals (for treasure only) lower the
   price band – or the price itself (the Cathayan Merchant). Rob, 14.11.2026. The size is shown with every adjustment so nothing is silent. */
import type { Ctx } from '../rules/context.ts';
import { unitDef } from '../rules/lookup.ts';
import { warbandSize, wyrdSizeBand } from './postbattle.ts';

export interface SizeLine { id: string; text: string }
export interface SellingOpts {
  kind: 'wyrd' | 'treasure';
  /** The Halfling Cook's D6 was 5+. */
  chef?: boolean;
  /** Victuals used (treasure only). */
  victuals?: number;
  /** A correction of the models counted, for what the data does not say. */
  manual?: number;
}
export interface SellingSize {
  /** The warband's size as the roster counts it. */
  base: number;
  /** The models counted for selling. */
  models: number;
  /** The band of the price chart the models give, lowered by the Cook and Victuals; 0 = 1–3 warriors. */
  band: number;
  lines: SizeLine[];
}

/** The Halfling Cook (Master Chef) is in the warband. */
export function chefAvailable(ctx: Ctx): boolean {
  return ctx.s.models.some((m) => m.uid_def === 'halflingco');
}

/** Victuals in the stash. */
export function victualsHeld(ctx: Ctx): number {
  return (ctx.s.stash?.items ?? []).filter((it) => /^victuals$/i.test(String(it.key ?? it.name))).reduce((n, it) => n + (Number(it.qty) || 0), 0);
}

/** The Cathayan Merchant is a Hired Sword of the warband. */
export function merchantPresent(ctx: Ctx): boolean {
  return (ctx.s.hired ?? []).some((h) => h.key === 'cathayanmerchant');
}

/** What the Cathayan Merchant makes of a sale: his D6 (1–2 lose, 3–5 gain, 6 gain more) and the total of the 2D6 (3D6 on a 6) rolled with it. */
export function merchantAdjust(die: number, dice: number): number {
  return die <= 2 ? -dice : dice;
}

/** The size to sell at, with every adjustment in `lines`. */
export function sellingSize(ctx: Ctx, o: SellingOpts): SellingSize {
  const base = warbandSize(ctx);
  const lines: SizeLine[] = [];
  let models = base;
  const wb = ctx.s.wb as string;
  let ogres = 0, mobs = 0;
  for (const m of ctx.s.models) {
    const d = unitDef(ctx, m.uid_def);
    if (!d) continue;
    const count = d.t === 'hen' ? (Number(m.qty) || 1) : 1;
    if (wb === 'maneaters' && d.large) ogres += count;
    if (d.mob) mobs += count - 1;
  }
  if (ogres) { models += ogres; lines.push({ id: 'ogres', text: `${ogres} Ogre${ogres === 1 ? '' : 's'} count double (Gluttony): +${ogres}` }); }
  if (mobs) { models -= mobs; lines.push({ id: 'mobs', text: `A mob counts as one model: −${mobs}` }); }
  if (o.manual) { models += o.manual; lines.push({ id: 'manual', text: `Corrected by hand: ${o.manual > 0 ? '+' : ''}${o.manual}` }); }
  models = Math.max(1, models);
  let lower = 0;
  if (o.chef && chefAvailable(ctx)) { lower += 1; lines.push({ id: 'chef', text: 'The Halfling Cook made the food go far: one band lower' }); }
  if (o.kind === 'treasure' && o.victuals) { lower += o.victuals; lines.push({ id: 'victuals', text: `${o.victuals} Victuals used: ${o.victuals} band${o.victuals === 1 ? '' : 's'} lower (never below 1–3)` }); }
  return { base, models, band: Math.max(0, wyrdSizeBand(models) - lower), lines };
}
