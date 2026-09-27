/* Name and definition lookups (legacy: engine.js unitDef/eqListFor,
   app.js itemFamily/unitFamilies/spellLabel, info.js itemInfo). */
import type { EquipmentList, GameData, ItemInfo, UnitDef, WarbandDef } from '../data/types.ts';
import type { Ctx } from './context.ts';

export function warbandDef(ctx: Ctx): WarbandDef | undefined {
  return ctx.s.wb ? ctx.data.WARBANDS[ctx.s.wb] : undefined;
}

export function unitDef(ctx: Ctx, id: string): UnitDef | undefined {
  return warbandDef(ctx)?.units.find((u) => u.id === id);
}

/** The equipment list a unit buys from. Kurgan marauders may also take a bow. */
export function eqListFor(ctx: Ctx, def: UnitDef | undefined): EquipmentList | undefined {
  if (!def || def.eq == null) return undefined;
  const list = ctx.data.LISTS[def.eq];
  if (!list) return list;
  if (ctx.s.wb === 'maraudersofchaos' && ctx.s.subtype === 'kurgan' && (def.eq === 'marChaosHero' || def.eq === 'marChaosHench')) {
    const copy: EquipmentList = {};
    for (const cat of Object.keys(list)) copy[cat] = (list[cat] ?? []).map((e) => [e[0], e[1]]);
    copy.Fernkampf = copy.Fernkampf ?? [];
    if (!copy.Fernkampf.some((x) => x[0] === 'Bogen')) copy.Fernkampf.push(['Bogen', 10]);
    return copy;
  }
  return list;
}

/** Weapon/armour family of an item name (specific patterns before generic). */
export function itemFamily(data: GameData, name: string): string | null {
  const s = String(name);
  for (const [re, f] of data._FAM) if (re.test(s)) return f;
  return null;
}

/** Families present in a unit's starting equipment list and fixed gear. */
export function unitFamilies(ctx: Ctx, def: UnitDef | undefined): Set<string> {
  const set = new Set<string>();
  const list = def && def.eq ? eqListFor(ctx, def) : undefined;
  if (list) for (const cat of Object.keys(list)) for (const [nm] of list[cat] ?? []) { const f = itemFamily(ctx.data, nm); if (f) set.add(f); }
  if (def && def.gear) def.gear.forEach((nm) => { const f = itemFamily(ctx.data, nm); if (f) set.add(f); });
  return set;
}

export function itemInfo(data: GameData, nm: string): ItemInfo | null {
  const s = String(nm);
  for (const [re, info] of data.ITEMINFO) if (re.test(s)) return info;
  return null;
}

/** A spell name without its difficulty suffix: "Word of Pain (7)" → "Word of Pain". */
export function spellLabel(name: string): string {
  return String(name).replace(/\s*\((\d+|auto)\)\s*$/i, '').trim();
}

export function isUpgrade(data: GameData, de: string): boolean {
  return !!data.UPGRADES[de];
}

/** Removes bracketed parts: "Dolch (1. gratis)" → "Dolch". */
export function stripParen(s: string): string {
  return String(s).replace(/\s*\([^)]*\)\s*/g, ' ').trim();
}
