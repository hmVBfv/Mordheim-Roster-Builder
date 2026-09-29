/* Prices after house rules and campaign effects (legacy engine.js adjPrice,
   hireCostOf, unitBaseCost, catalogDefaultPaid, marketRarePrice). */
import type { CatalogItem, HireEntry, UnitDef } from '../data/types.ts';
import type { RareHolding } from '../state/types.ts';
import { houseRules } from '../state/house.ts';
import type { Ctx } from './context.ts';
import { activeDistrictEffects, itemHalfActive, priceMod } from './districts.ts';
import { itemFamily } from './lookup.ts';

const BLACKPOWDER = ['pistol', 'longgun', 'swivel'];
const MISSILE = ['bow', 'crossbow', 'sling', 'thrown', 'blowpipe', 'sunweapon'];
const BODY_ARMOUR = ['lightarmour', 'heavyarmour', 'toughenedleathers', 'gromrilarmour', 'ithilmararmour', 'chaosarmour', 'barding'];
const OTHER_ARMOUR = ['shield', 'buckler', 'helmet'];

/** Price of an equipment-list item after the house-rule price adjustments,
    club and sling surcharges, and a half-price campaign effect. */
export function adjPrice(ctx: Ctx, nm: string, pr: number): number {
  const h = houseRules(ctx.s);
  const fam = itemFamily(ctx.data, nm) ?? '';
  let mult = (Number(h.priceAll) || 100) / 100;
  if (BLACKPOWDER.includes(fam)) mult *= (Number(h.priceBP) || 100) / 100;
  else if (MISSILE.includes(fam)) mult *= (Number(h.priceMissile) || 100) / 100;
  else if (BODY_ARMOUR.includes(fam)) mult *= (Number(h.priceArmour) || 100) / 100;
  else if (OTHER_ARMOUR.includes(fam) && !h.armourBodyOnly) mult *= (Number(h.priceArmour) || 100) / 100;
  let p = Math.round(pr * mult);
  if (fam === 'blunt') p += Number(h.clubSurcharge) || 0;
  if (fam === 'sling') p += Number(h.slingSurcharge) || 0;
  if (p > 0 && itemHalfActive(ctx, nm)) p = Math.floor(p * 0.5);
  return Math.max(0, p);
}

export function hireCostOf(ctx: Ctx, table: Record<string, HireEntry>, key: string): number {
  const e = table[key];
  if (!e) return 0;
  return Math.floor((e.hire || 0) * priceMod(ctx, 'hire', key));
}

export function hsHireCost(ctx: Ctx, key: string): number {
  return hireCostOf(ctx, ctx.data.HIREDSWORDS, key);
}

export function dpHireCost(ctx: Ctx, key: string): number {
  return hireCostOf(ctx, ctx.data.DRAMATIS, key);
}

/** A unit's hire price, possibly replaced by a district effect. */
export function unitBaseCost(ctx: Ctx, def: UnitDef): number {
  let c = def.cost;
  for (const eff of activeDistrictEffects(ctx)) {
    if (eff.kind === 'unitCost' && eff.map && eff.map[def.id] != null) c = eff.map[def.id] as number;
  }
  return c;
}

/** What a catalogue item costs by default when bought: fixed prices as they
    are, dice prices at their base, multiplier prices at 0 (set by hand). */
export function catalogDefaultPaid(ctx: Ctx, item: CatalogItem | undefined): number {
  if (!item) return 0;
  let v: number;
  if (typeof item.cost === 'number') v = item.cost;
  else {
    const s = String(item.cost);
    if (/×|x\s*Preis|Preis/i.test(s)) v = 0;
    else { const mt = s.match(/\d+/); v = mt ? Number(mt[0]) : 0; }
  }
  if (v > 0 && itemHalfActive(ctx, item.en)) v = Math.floor(v * 0.5);
  return v;
}

/** Market value of a rare item: its catalogue price, dice at their expected
    value; prices that depend on the host weapon fall back to what was paid. */
export function marketRarePrice(ctx: Ctx, de: string, entry: RareHolding | undefined): number {
  const it = ctx.data.CATALOG.find((x) => x.de === de);
  const fallback = Number(entry && entry.paid) || 0;
  if (!it) return fallback;
  if (typeof it.cost === 'number') return it.cost;
  const s = String(it.cost).replace(/\([^)]*\)/g, '').trim();
  const mt = s.match(/^(\d+)(?:\s*\+\s*(\d*)\s*[dD](\d+))?$/);
  if (mt) {
    const base = Number(mt[1]);
    if (!mt[3]) return base;
    const n = Number(mt[2] || 1), faces = Number(mt[3]);
    return Math.round(base + (n * (faces + 1)) / 2);
  }
  return fallback;
}
