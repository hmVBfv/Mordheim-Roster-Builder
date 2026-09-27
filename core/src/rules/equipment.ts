/* Equipment, mutations, rare items and weapon upgrades of a model
   (legacy engine.js eqCost … rareEligibleItems, app.js catalogEligible). */
import type { CatalogItem, UnitDef, UpgradeDef } from '../data/types.ts';
import type { Model } from '../state/types.ts';
import { houseRules } from '../state/house.ts';
import type { Ctx } from './context.ts';
import { itemHalfActive } from './districts.ts';
import { eqListFor, isUpgrade, itemFamily, stripParen, unitDef, unitFamilies } from './lookup.ts';
import { adjPrice } from './pricing.ts';

const qtyOf = (m: Model, nm: string): number => Number((m.eq ?? {})[nm]) || 0;

/** Close-combat weapons beyond the free dagger, and missile weapons (a brace
    of pistols counts once) a model carries — for the weapon limit. */
export function eqWeaponLimit(ctx: Ctx, m: Model): { cc: number; missile: number } {
  const def = unitDef(ctx, m.uid_def);
  const list = def ? eqListFor(ctx, def) : undefined;
  if (!list) return { cc: 0, missile: 0 };
  let cc = 0, missile = 0;
  (list.Nahkampf ?? []).forEach(([nm]) => { const q = qtyOf(m, nm); if (!q) return; cc += nm.indexOf('1. gratis') >= 0 ? Math.max(0, q - 1) : q; });
  (list.Fernkampf ?? []).forEach(([nm]) => { const q = qtyOf(m, nm); if (!q) return; missile += ctx.data.BRACE_PLURAL[nm] && q >= 2 ? 1 : q; });
  return { cc, missile };
}

/** What a model's equipment cost: the first dagger is free (house rule: all
    daggers), Gunnery School braces are priced as pairs. */
export function eqCost(ctx: Ctx, m: Model): number {
  const def = unitDef(ctx, m.uid_def);
  if (!def || !def.eq) return 0;
  let c = 0;
  const list = eqListFor(ctx, def) ?? {};
  const h = houseRules(ctx.s);
  for (const cat of Object.keys(list)) for (const [nm, pr] of list[cat] ?? []) {
    const qty = qtyOf(m, nm);
    if (!qty) continue;
    const price = adjPrice(ctx, nm, pr);
    const brace = ctx.data.GSN_BRACE[nm];
    if (nm.startsWith('Dolch')) { if (!h.freeDagger) c += Math.max(0, qty - 1) * price; }
    else if (ctx.s.wb === 'gunnery' && brace && qty >= 2) { const pairs = Math.floor(qty / 2); c += pairs * adjPrice(ctx, nm, brace) + (qty % 2) * price; }
    else c += qty * price;
  }
  return c;
}

/** The dagger item a unit may take, if any. Units without a dagger in their
    list (flagellants, animals, …) get no free one — RAW. */
export function daggerNameFor(ctx: Ctx, def: UnitDef | undefined): string | null {
  if (!def || !def.eq) return null;
  const list = eqListFor(ctx, def);
  if (!list) return null;
  for (const cat of Object.keys(list)) for (const it of list[cat] ?? []) if (/^Dolch/i.test(it[0])) return it[0];
  return null;
}

/** The model with its free dagger added, if it may have one and has none.
    Returns the same object when nothing changes. */
export function withFreeDagger(ctx: Ctx, m: Model): Model {
  const nm = daggerNameFor(ctx, unitDef(ctx, m.uid_def));
  if (!nm || m._noDagger) return m;
  if (m.eq && m.eq[nm]) return m;
  return { ...m, eq: { ...(m.eq ?? {}), [nm]: 1 } };
}

export function mutKindFor(ctx: Ctx, m: Model): string | null {
  const def = unitDef(ctx, m.uid_def);
  if (def?.mut) return def.mut;
  if ((m.skills || []).some((sk) => /^mutant\b/i.test(String(sk)))) return 'chaos';
  return null;
}

/** Mutations: the most expensive at its price, every further one doubled. */
export function mutCost(ctx: Ctx, m: Model): number {
  const kind = mutKindFor(ctx, m);
  if (!kind || !m.mut || !m.mut.length) return 0;
  const set = ctx.data.MUTSETS[kind] || ctx.data.MUTATIONS;
  const prices = m.mut.map((nm) => { const e = set.find((x) => x[0] === nm); return e ? e[1] : 0; }).sort((a, b) => b - a);
  let c = prices[0] || 0;
  for (let i = 1; i < prices.length; i++) c += (prices[i] ?? 0) * 2;
  return c;
}

/** Kislev: the Captain's heirloom is bought at half price. */
export function heirloomDiscount(ctx: Ctx, m: Model): number {
  if (ctx.s.wb !== 'kislev') return 0;
  const def = unitDef(ctx, m.uid_def);
  if (!def || def.id !== 'capt') return 0;
  const nm = m.heirloom;
  if (!nm || !(m.eq && Number(m.eq[nm]) > 0)) return 0;
  const L = eqListFor(ctx, def) ?? {};
  for (const c of Object.keys(L)) { const it = (L[c] ?? []).find((x) => x[0] === nm); if (it) return Math.floor(it[1] / 2); }
  return 0;
}

export function rareCost(m: Model): number {
  const r = m.rare || {};
  let c = 0;
  for (const de of Object.keys(r)) c += (Number(r[de]?.q) || 0) * (Number(r[de]?.paid) || 0);
  return c;
}

export interface WeaponRef { nm: string; price: number; fam: string | null }

/** Close-combat weapons a model carries (for upgrades). */
export function eqWeaponsOf(ctx: Ctx, m: Model): WeaponRef[] {
  const def = unitDef(ctx, m.uid_def);
  if (!def || !def.eq) return [];
  const list = eqListFor(ctx, def);
  const out: WeaponRef[] = [];
  if (list?.Nahkampf) for (const [nm, pr] of list.Nahkampf) if (qtyOf(m, nm) > 0) out.push({ nm, price: pr, fam: itemFamily(ctx.data, nm) });
  return out;
}

export function upgradeTargets(ctx: Ctx, m: Model, de: string): WeaponRef[] {
  const u = ctx.data.UPGRADES[de];
  if (!u) return [];
  return eqWeaponsOf(ctx, m).filter((w) => w.fam != null && u.fams.includes(w.fam));
}

/** Price of an upgrade on a given weapon: material upgrades multiply the
    weapon's price (Gromril ×3 for dwarfs), flat ones have a base price. */
export function upgradePaid(ctx: Ctx, m: Model, de: string, targetNm: string): number {
  const u = ctx.data.UPGRADES[de];
  if (!u) return 0;
  let paid: number;
  if (u.mult) {
    const w = eqWeaponsOf(ctx, m).find((x) => x.nm === targetNm);
    let mu = u.mult;
    if (de === 'Gromril-Waffe' && (ctx.s.wb === 'dwarftreasure' || ctx.s.wb === 'dwarfrangers')) mu = 3;
    paid = w ? mu * w.price : 0;
  } else paid = u.base ?? 0;
  if (paid > 0 && itemHalfActive(ctx, de)) paid = Math.floor(paid * 0.5);
  return paid;
}

/** Flat upgrades of the current warband are offered next to the weapon. */
export function inlineUpgradeActive(ctx: Ctx, de: string): boolean {
  const u = ctx.data.UPGRADES[de];
  return !!(u && !u.mult && (!u.wb || u.wb.indexOf(ctx.s.wb ?? '') >= 0));
}

export function weaponUpgradesFor(ctx: Ctx, m: Model, nm: string): { de: string; u: UpgradeDef }[] {
  const def = unitDef(ctx, m.uid_def);
  if (!def) return [];
  const isHero = def.t === 'hero' || !!m.promoted;
  const fam = itemFamily(ctx.data, nm);
  const out: { de: string; u: UpgradeDef }[] = [];
  for (const de of Object.keys(ctx.data.UPGRADES)) {
    const u = ctx.data.UPGRADES[de] as UpgradeDef;
    if (u.mult) continue;
    if (u.heroesOnly && !isHero) continue;
    if (u.wb && u.wb.indexOf(ctx.s.wb ?? '') < 0) continue;
    if (u.fams.indexOf(fam as string) < 0) continue;
    out.push({ de, u });
  }
  return out;
}

export interface Eligibility { ok: boolean; reason: string }

/** The catalogue rule: a unit may only take an item whose category appears
    in its starting equipment. Miscellaneous items are free for heroes. */
export function catalogEligible(ctx: Ctx, def: UnitDef | undefined, item: CatalogItem | undefined): Eligibility {
  if (!item) return { ok: false, reason: 'unbekannter Gegenstand' };
  if (item.cat === 'misc') return { ok: true, reason: 'Sonstige Ausrüstung – für Helden frei kaufbar (keine Kategorie-Schranke)' };
  const fam = itemFamily(ctx.data, item.de);
  const have = unitFamilies(ctx, def);
  if (fam === 'upgrade') {
    const ok = ctx.data._CCFAM.some((f) => have.has(f));
    return ok ? { ok: true, reason: 'Aufwertung einer vorhandenen Nahkampfwaffe' } : { ok: false, reason: 'keine aufwertbare Nahkampfwaffe in der Startliste' };
  }
  if (fam === 'gromrilarmour' || fam === 'ithilmararmour' || fam === 'chaosarmour') {
    const ok = have.has('lightarmour') || have.has('heavyarmour');
    return ok ? { ok: true, reason: 'Spezialrüstung – Einheit darf Körperrüstung tragen' } : { ok: false, reason: 'Einheit darf keine Körperrüstung tragen' };
  }
  if (!fam) {
    const list = def && def.eq ? eqListFor(ctx, def) : undefined;
    let found = false;
    if (list) for (const cat of Object.keys(list)) for (const [nm] of list[cat] ?? []) if (nm === item.de || nm.includes(item.de) || item.de.includes(nm)) found = true;
    return found ? { ok: true, reason: 'bereits Bestandteil der Startliste' } : { ok: false, reason: 'einzigartige Kategorie – nicht in der Startausrüstung dieser Einheit' };
  }
  return have.has(fam) ? { ok: true, reason: 'Kategorie in der Startausrüstung vorhanden' } : { ok: false, reason: 'Kategorie nicht in der Startausrüstung' };
}

/** Catalogue items this model may buy in the Rare / Trading Post section. */
export function rareEligibleItems(ctx: Ctx, m: Model): CatalogItem[] {
  const def = unitDef(ctx, m.uid_def);
  if (!def || !def.eq) return [];
  const list = eqListFor(ctx, def);
  const have = new Set<string>();
  const h = houseRules(ctx.s);
  if (list) for (const cat of Object.keys(list)) for (const [nm] of list[cat] ?? []) have.add(stripParen(nm).toLowerCase());
  const isHero = def.t === 'hero' || !!m.promoted;
  return ctx.data.CATALOG.filter((it) => {
    if (def.noArmour && it.cat === 'armour') return false;
    if (def.noMissile && (it.cat === 'missile' || it.cat === 'bp')) return false;
    if (def.noHeavy && itemFamily(ctx.data, it.de) === 'heavyarmour') return false;
    if (isUpgrade(ctx.data, it.de)) {
      const u = ctx.data.UPGRADES[it.de] as UpgradeDef;
      // flat upgrades of this warband are shown inline next to the weapon
      if (!u.mult && inlineUpgradeActive(ctx, it.de)) { if ((!u.heroesOnly || isHero) && upgradeTargets(ctx, m, it.de).length > 0) return false; }
      if (u.heroesOnly && !isHero) return false;
      return upgradeTargets(ctx, m, it.de).length > 0;
    }
    if (it.cat === 'misc' && !isHero && !h.miscHench && !h.freeMarket) return false;
    if (h.freeMarket) return true;
    if (have.has(stripParen(it.de).toLowerCase())) return false;
    return catalogEligible(ctx, def, it).ok;
  });
}
