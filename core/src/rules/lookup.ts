/* Name and definition lookups (legacy: engine.js unitDef/eqListFor,
   app.js itemFamily/unitFamilies/spellLabel, info.js itemInfo). */
import type { EquipmentEntry, EquipmentList, GameData, ItemInfo, UnitDef, WarbandDef } from '../data/types.ts';
import type { Ctx } from './context.ts';

export function warbandDef(ctx: Ctx): WarbandDef | undefined {
  return ctx.s.wb ? ctx.data.WARBANDS[ctx.s.wb] : undefined;
}

export function unitDef(ctx: Ctx, id: string): UnitDef | undefined {
  return warbandDef(ctx)?.units.find((u) => u.id === id);
}

/** The equipment list a unit buys from. Kurgan marauders may also take a
    bow; rows marked for other variants (`sub`) are left out. */
export function eqListFor(ctx: Ctx, def: UnitDef | undefined): EquipmentList | undefined {
  if (!def || def.eq == null) return undefined;
  let list = ctx.data.LISTS[def.eq];
  if (!list) return list;
  if (ctx.s.wb === 'maraudersofchaos' && ctx.s.subtype === 'kurgan' && (def.eq === 'marChaosHero' || def.eq === 'marChaosHench')) {
    const copy: EquipmentList = {};
    for (const cat of Object.keys(list)) copy[cat] = (list[cat] ?? []).map((e): EquipmentEntry => [...e]);
    copy.Fernkampf = copy.Fernkampf ?? [];
    if (!copy.Fernkampf.some((x) => x[0] === 'Bogen')) copy.Fernkampf.push(['Bogen', 10]);
    list = copy;
  }
  // rows for one variant only (Middenheim's Wolfcloak, the Hung's warhorses)
  const other = (r: EquipmentEntry): boolean => !!r[2]?.sub && r[2].sub.indexOf(ctx.s.subtype ?? '') < 0;
  const src = list;
  if (Object.keys(src).some((c) => (src[c] ?? []).some(other))) {
    const out: EquipmentList = {};
    for (const c of Object.keys(src)) { const rs = (src[c] ?? []).filter((r) => !other(r)); if (rs.length) out[c] = rs; }
    list = out;
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
