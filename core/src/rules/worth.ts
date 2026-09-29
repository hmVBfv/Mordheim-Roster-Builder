/* Warband Worth: the market value of the fighting force (legacy engine.js
   isHandShield … modelMarketValue, app.js worthAdvOf/warbandWorth).
   Gold in hand is deliberately excluded: coins don't fight. */
import type { Model } from '../state/types.ts';
import type { HireRecord } from '../state/types.ts';
import type { Ctx } from './context.ts';
import { isHeroModel } from './costs.ts';
import { mutCost } from './equipment.ts';
import { dpHireTotal, hsEqTotal, hsHireTotal } from './hire.ts';
import { eqListFor, isUpgrade, itemInfo, unitDef } from './lookup.ts';
import { adjPrice, marketRarePrice, unitBaseCost } from './pricing.ts';

export const WORTH_STAT_PTS = 5;
export const WORTH_SKILL_PTS = 10;
export const WORTH_SPELL_PTS = 10;

export function isHandShield(nm: string | undefined | null): boolean {
  return /schild|shield|buckler/i.test(String(nm || ''));
}

/** Two-handed, read from the same rules text the tooltips show. */
export function isTwoHanded(ctx: Ctx, nm: string | undefined | null): boolean {
  if (!nm) return false;
  const inf = itemInfo(ctx.data, String(nm));
  if (!inf) return false;
  return /two-handed|both hands|two hands/i.test(JSON.stringify(inf));
}

export interface MeleeWeapon { p: number; twoH: boolean }

/** The active loadout counts in full — two one-handed or one two-handed melee
    weapon, one missile weapon, a shield if a hand is free — every spare at
    half. Unrounded; warbandWorth rounds once at the end. */
export function loadoutValue(melee: MeleeWeapon[], ranged: number[], shields: number[] = []): number {
  const sumM = melee.reduce((s, w) => s + w.p, 0);
  const one = melee.filter((w) => !w.twoH).map((w) => w.p).sort((a, b) => b - a);
  const two = melee.filter((w) => w.twoH).map((w) => w.p).sort((a, b) => b - a);
  const optA = (one[0] || 0) + (one[1] || 0), optB = two[0] || 0;
  const active = Math.max(optA, optB);
  const slots = optB > optA && two.length ? 2 : Math.min(2, one.length);
  const sh = shields.slice().sort((a, b) => b - a);
  const sumS = sh.reduce((s, p) => s + p, 0);
  const shActive = slots < 2 && sh.length ? (sh[0] as number) : 0;
  const sumR = ranged.reduce((s, p) => s + p, 0);
  const bestR = ranged.length ? Math.max(...ranged) : 0;
  return active + (sumM - active) / 2 + (shActive + (sumS - shActive) / 2) + (bestR + (sumR - bestR) / 2);
}

/** Market value of the equipment list items only (every dagger at list price). */
export function eqMarketValue(ctx: Ctx, m: Model): number {
  const def = unitDef(ctx, m.uid_def);
  if (!def || !def.eq) return 0;
  const list = eqListFor(ctx, def) ?? {};
  let full = 0;
  const melee: MeleeWeapon[] = [], ranged: number[] = [], shields: number[] = [];
  for (const cat of Object.keys(list)) for (const [nm, pr] of list[cat] ?? []) {
    const qty = Number((m.eq ?? {})[nm]) || 0;
    if (!qty) continue;
    const price = adjPrice(ctx, nm, pr);
    if (cat === 'Nahkampf') { const th = isTwoHanded(ctx, nm); for (let i = 0; i < qty; i++) melee.push({ p: price, twoH: th }); }
    else if (cat === 'Fernkampf') { for (let i = 0; i < qty; i++) ranged.push(price); }
    else if (isHandShield(nm)) { for (let i = 0; i < qty; i++) shields.push(price); }
    else full += qty * price;
  }
  return full + loadoutValue(melee, ranged, shields);
}

/** Market value of one model: unit, mutations, equipment and rare items at
    list prices. What was actually paid does not matter here. */
export function modelMarketValue(ctx: Ctx, m: Model): number {
  const def = unitDef(ctx, m.uid_def);
  if (!def) return 0;
  const list = def.eq ? eqListFor(ctx, def) ?? {} : {};
  let full = unitBaseCost(ctx, def) + mutCost(ctx, m);
  const melee: MeleeWeapon[] = [], ranged: number[] = [], shields: number[] = [];
  for (const cat of Object.keys(list)) for (const [nm, pr] of list[cat] ?? []) {
    const qty = Number((m.eq || {})[nm]) || 0;
    if (!qty) continue;
    const price = adjPrice(ctx, nm, pr);
    if (cat === 'Nahkampf') { const th = isTwoHanded(ctx, nm); for (let i = 0; i < qty; i++) melee.push({ p: price, twoH: th }); }
    else if (cat === 'Fernkampf') { for (let i = 0; i < qty; i++) ranged.push(price); }
    else if (isHandShield(nm)) { for (let i = 0; i < qty; i++) shields.push(price); }
    else full += qty * price;
  }
  const r = m.rare || {};
  for (const de of Object.keys(r)) {
    const q = Number(r[de]?.q) || 0;
    if (!q) continue;
    const price = marketRarePrice(ctx, de, r[de]);
    const it = ctx.data.CATALOG.find((x) => x.de === de);
    const cat = it && it.cat;
    if (cat === 'cc' && !isUpgrade(ctx.data, de)) { const th = isTwoHanded(ctx, de) || isTwoHanded(ctx, it && it.en); for (let i = 0; i < q; i++) melee.push({ p: price, twoH: th }); }
    else if ((cat === 'missile' || cat === 'bp') && !isUpgrade(ctx.data, de)) { for (let i = 0; i < q; i++) ranged.push(price); }
    else if (isHandShield(de) || isHandShield(it && it.en)) { for (let i = 0; i < q; i++) shields.push(price); }
    else full += q * price;
  }
  return full + loadoutValue(melee, ranged, shields);
}

/** Advancement priced by what landed on the profile: each stat advance +5,
    each skill or spell +10, each stat point lost to injury −5. */
export function worthAdvOf(m: Model | HireRecord | null | undefined): number {
  let p = 0;
  const adv = (m && m.adv) || {};
  for (const k of Object.keys(adv)) p += (Number((adv as Record<string, unknown>)[k]) || 0) * WORTH_STAT_PTS;
  ((m && m.inj) || []).forEach((j) => { const mod = j.mod || {}; for (const k of Object.keys(mod)) p += (Number((mod as Record<string, unknown>)[k]) || 0) * WORTH_STAT_PTS; });
  p += ((m && m.skills) || []).length * WORTH_SKILL_PTS;
  p += ((m && m.spells) || []).length * WORTH_SPELL_PTS;
  return p;
}

/** Warband Worth, rounded once at the very end. */
export function warbandWorth(ctx: Ctx): number {
  let w = 0;
  ctx.s.models.forEach((m) => {
    const def = unitDef(ctx, m.uid_def);
    if (!def) return;
    const hen = def.t === 'hen' && !isHeroModel(ctx, m);
    const per = modelMarketValue(ctx, m) + worthAdvOf(m);
    w += per * (hen ? Number(m.qty) || 1 : 1);
  });
  w += hsHireTotal(ctx);
  w += hsEqTotal(ctx);
  w += dpHireTotal(ctx);
  (ctx.s.hired ?? []).forEach((h) => { w += worthAdvOf(h); });
  return Math.round(w);
}
