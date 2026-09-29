/* Campaign map effects on prices (legacy app.js activeDistrictEffects,
   priceMod, itemHalfActive). A foothold unlocks a district's foothold
   effects; control also unlocks its control effects. */
import type { DistrictEffect } from '../data/types.ts';
import type { Ctx } from './context.ts';

export type ActiveDistrictEffect = DistrictEffect & { district: string };

export function activeDistrictEffects(ctx: Ctx): ActiveDistrictEffect[] {
  const cd = ctx.s.campaign?.districts ?? {};
  const out: ActiveDistrictEffect[] = [];
  for (const d of ctx.data.DISTRICTS) {
    const st = cd[d.id] || 'none';
    if (st === 'none') continue;
    for (const eff of d.effects) {
      if (eff.tier === 'control' && st !== 'control') continue;
      out.push({ district: d.name, ...eff });
    }
  }
  return out;
}

/** Price multiplier for hiring ('hire', key = Hired Sword/Dramatis key) or an
    item ('item', key = item name). Effects stack by taking the lowest. */
export function priceMod(ctx: Ctx, kind: 'hire' | 'item', key: string): number {
  let mult = 1;
  for (const eff of activeDistrictEffects(ctx)) {
    if (kind === 'hire' && eff.kind === 'hireHalf' && (eff.keys ?? []).includes(key)) mult = Math.min(mult, 0.5);
    if (kind === 'item' && eff.kind === 'itemHalf' && (eff.keys ?? []).includes(key)) mult = Math.min(mult, 0.5);
  }
  return mult;
}

/** Is an item (by English name, compared loosely) at half price here? */
export function itemHalfActive(ctx: Ctx, en: string | undefined | null): boolean {
  if (!en) return false;
  const nz = (x: string) => String(x).toLowerCase().replace(/[^a-z0-9]/g, '');
  const t = nz(en);
  for (const eff of activeDistrictEffects(ctx)) {
    if (eff.kind === 'itemHalf') for (const k of eff.keys ?? []) if (nz(k) === t) return true;
  }
  return false;
}

/** Is this Hired Sword or Dramatis Persona at half price here? */
export function hireDiscounted(ctx: Ctx, key: string): boolean {
  const anyTab = ctx.data.HIREDSWORDS[key] || ctx.data.DRAMATIS[key];
  return !!anyTab && priceMod(ctx, 'hire', key) < 1;
}
