/* Hired Swords and Dramatis Personae: eligibility, totals, equipment
   (legacy app.js "HIRED SWORDS" and "DRAMATIS PERSONAE" sections). */
import type { EquipmentList, HireEntry, Persona, WarbandHireInfo } from '../data/types.ts';
import type { HireRecord } from '../state/types.ts';
import { houseRules } from '../state/house.ts';
import type { Ctx } from './context.ts';
import { eqListFor, warbandDef } from './lookup.ts';
import { adjPrice, dpHireCost, hsHireCost } from './pricing.ts';

/** Hired Swords gain experience like henchmen: advances at these totals. */
export const HS_ADV = [2, 5, 9, 14] as const;
export const HS_XP_MAX = 14;

type HireWarband = WarbandHireInfo & { key: string | null; subtype?: string | null };

function hireWarband(ctx: Ctx, wbKey: string | null): HireWarband {
  return { key: wbKey, subtype: ctx.s.subtype ?? null, ...(wbKey ? ctx.data.WBHIRE[wbKey] ?? { align: 'neutral' } : { align: 'neutral' }) } as HireWarband;
}

export function hsGradeIdx(ctx: Ctx, g: string): number {
  const i = ctx.data.HS_GRADE_ORDER.indexOf(g);
  return i < 0 ? 99 : i;
}

export function hsGradeAllowed(ctx: Ctx, g: string): boolean {
  const hg = houseRules(ctx.s).hsGrades;
  return hg ? hg[g] !== false : true;
}

export function dpGradeAllowed(ctx: Ctx, g: string): boolean {
  const dg = houseRules(ctx.s).dpGrades;
  return dg ? dg[g] !== false : true;
}

export function hsList(ctx: Ctx): HireRecord[] { return ctx.s.hired ?? []; }
export function dpList(ctx: Ctx): HireRecord[] { return ctx.s.dp ?? []; }
export function hsCount(ctx: Ctx, key: string): number { return hsList(ctx).filter((h) => h.key === key).length; }
export function dpCount(ctx: Ctx, key: string): number { return dpList(ctx).filter((d) => d.key === key).length; }

/** Upkeep of a Hired Sword; some cost more to warbands they hold a grudge against. */
export function hsUpkeepFor(ctx: Ctx, key: string): number {
  const hs = ctx.data.HIREDSWORDS[key];
  if (!hs) return 0;
  let up = hs.upkeep || 0;
  const wb = hireWarband(ctx, ctx.s.wb) as Record<string, unknown>;
  if (hs.grudge && wb[hs.grudge.tag]) up = hs.grudge.upkeep;
  return up;
}

/** A Hired Sword's experience, clamped to 0..14. */
export function hsExp(rec: HireRecord): number {
  return Math.max(0, Math.min(HS_XP_MAX, Number(rec.exp) || 0));
}

export function hsAdvancesDue(rec: HireRecord): number {
  const x = hsExp(rec);
  return HS_ADV.filter((t) => x >= t).length;
}

export function hsHireTotal(ctx: Ctx): number { return hsList(ctx).reduce((s, h) => s + hsHireCost(ctx, h.key), 0); }
export function hsRatingTotal(ctx: Ctx): number {
  return hsList(ctx).reduce((s, h) => s + (ctx.data.HIREDSWORDS[h.key]?.rating || 0) + hsExp(h), 0);
}
export function hsUpkeepTotal(ctx: Ctx): number { return hsList(ctx).reduce((s, h) => s + hsUpkeepFor(ctx, h.key), 0); }
export function hsSizeBonus(ctx: Ctx): number {
  return hsList(ctx).reduce((s, h) => s + (ctx.data.HIREDSWORDS[h.key]?.sizeBonus || 0), 0);
}

export function dpHireTotal(ctx: Ctx): number { return dpList(ctx).reduce((s, d) => s + dpHireCost(ctx, d.key), 0); }
export function dpUpkeepTotal(ctx: Ctx): number { return dpList(ctx).reduce((s, d) => s + (ctx.data.DRAMATIS[d.key]?.upkeep || 0), 0); }
export function dpRatingTotal(ctx: Ctx): number { return dpList(ctx).reduce((s, d) => s + (ctx.data.DRAMATIS[d.key]?.rating || 0), 0); }

/* House rule "hsEquip": RAW a Hired Sword's equipment is fixed. When the rule
   is on, he may buy from the warband's Hero equipment chart. */
export function hsEquipOn(ctx: Ctx): boolean { return !!houseRules(ctx.s).hsEquip; }

/** The equipment list of the warband's first Hero with one. */
export function heroEqList(ctx: Ctx): EquipmentList | null {
  const wb = warbandDef(ctx);
  if (!wb) return null;
  const hero = (wb.units || []).find((u) => u.t === 'hero' && u.eq);
  return hero ? eqListFor(ctx, hero) ?? null : null;
}

export function entryOf(ctx: Ctx, rec: HireRecord): HireEntry | null {
  return ctx.data.HIREDSWORDS[rec.key] || ctx.data.DRAMATIS[rec.key] || null;
}

export function hsEqCost(ctx: Ctx, rec: HireRecord): number {
  const list = heroEqList(ctx);
  if (!list || !rec.eq) return 0;
  let c = 0;
  for (const cat of Object.keys(list)) for (const [nm, pr] of list[cat] ?? []) {
    const q = Number(rec.eq[nm]) || 0;
    if (!q) continue;
    c += q * adjPrice(ctx, nm, pr);
  }
  return c;
}

export function hsEqTotal(ctx: Ctx): number {
  if (!hsEquipOn(ctx)) return 0;
  return [...(ctx.s.hired ?? []), ...(ctx.s.dp ?? [])].reduce((t, r) => t + hsEqCost(ctx, r), 0);
}

export function hsEqParts(ctx: Ctx, rec: HireRecord): string[] {
  const list = heroEqList(ctx);
  const out: string[] = [];
  if (!list || !rec.eq) return out;
  for (const cat of Object.keys(list)) for (const [nm] of list[cat] ?? []) {
    const q = Number(rec.eq[nm]) || 0;
    if (q > 0) out.push(q > 1 ? `${nm} ×${q}` : nm);
  }
  return out;
}

/** Does a hire rule allow this warband? */
export function hsHireRuleAllows(hs: { rule?: HireEntry['rule'] }, wb: HireWarband): boolean {
  const r = hs.rule;
  if (!r) return true;
  const tags = wb.tags || [];
  const flag = (f: string) => !!(wb as Record<string, unknown>)[f];
  switch (r.type) {
    case 'any': return true;
    case 'good': return wb.align === 'good' && !(r.except || []).some((t) => tags.includes(t));
    case 'evil': return wb.align === 'evil';
    case 'chaos': return !!wb.chaos;
    case 'nonEvil': return wb.align !== 'evil';
    case 'human': return !!wb.human;
    case 'nonChaosHuman': return !!wb.human && !wb.chaos && !(r.except || []).some((t) => tags.includes(t));
    case 'humanOrDwarf': return (!!wb.human || !!wb.dwarf) && (!r.noChaos || !wb.chaos) && !(r.except || []).some((t) => tags.includes(t)) && !(r.xsub || []).some((x) => wb.key === x[0] && wb.subtype === x[1]);
    case 'nonGood': return wb.align !== 'good' || (r.wbs || []).some((w) => w === wb.key || tags.includes(w));
    case 'humanOrHighElf': return (!!wb.human || wb.key === 'shadowwarriors') && wb.align !== 'evil';
    case 'onlyWb': return (r.wbs || []).includes(wb.key ?? '') && (!r.subtype || wb.subtype === r.subtype);
    case 'except': return !(r.tags || []).some((t) => tags.includes(t)) && !(r.flags || []).some(flag) && !(r.wbs || []).includes(wb.key ?? '') && !(r.xsub || []).some((x) => wb.key === x[0] && wb.subtype === x[1]);
    case 'only': {
      if ((r.xsub || []).some((x) => wb.key === x[0] && wb.subtype === x[1])) return false;
      return ((r.tags || []).some((t) => tags.includes(t) || t === wb.key) || (r.wbs || []).includes(wb.key ?? '') || (r.flags || []).some(flag)) && !(r.xwbs || []).includes(wb.key ?? '');
    }
    default: return true;
  }
}

export interface HireOption { key: string; name: string; src?: string; hire?: number; upkeep?: number; rating?: number; note?: string; conflict?: unknown }
export interface HireBlocked { key: string; name: string; reason: string }
export interface HireEligibility { allowed: HireOption[]; blocked: HireBlocked[] }

/** Which Hired Swords may this warband hire? A warband-side "only" list is the
    more specific rule and overrides the generic "May be hired". */
export function hireEligibility(ctx: Ctx, wbKey: string | null = ctx.s.wb, table: Record<string, HireEntry> = ctx.data.HIREDSWORDS): HireEligibility {
  const wb = hireWarband(ctx, wbKey);
  const out: HireEligibility = { allowed: [], blocked: [] };
  for (const key of Object.keys(table)) {
    const hs = table[key] as HireEntry;
    let ok = true, reason = '';
    if (wb.none) { ok = false; reason = 'warband hires no Hired Swords'; }
    else if (wb.only) {
      const named = !!hs.rule && (hs.rule.type === 'onlyWb' || hs.rule.type === 'only') && (hs.rule.wbs || []).includes(wb.key ?? '');
      if (!wb.only.includes(key) && !named) { ok = false; reason = 'not on this warband’s hire list'; }
    }
    else if (wb.except && wb.except.includes(key)) { ok = false; reason = 'excluded by warband rule'; }
    else if (wb.noElfHS && key === 'elfranger') { ok = false; reason = 'Grudgebearers: no Elven Hired Swords'; }
    else if (wb.noChaosHS && hs.rule && hs.rule.type === 'evil') { ok = false; reason = 'may not hire Chaos/evil Hired Swords'; }
    else if (!hsHireRuleAllows(hs, wb)) { ok = false; reason = 'not available to this warband type'; }
    if (!ok) { out.blocked.push({ key, name: hs.name, reason }); continue; }
    let up = hs.upkeep, note = '';
    if (hs.grudge && (wb as Record<string, unknown>)[hs.grudge.tag]) { up = hs.grudge.upkeep; note = hs.grudge.note ?? ''; }
    out.allowed.push({ key, name: hs.name, src: hs.src, hire: hs.hire, upkeep: up, rating: hs.rating, note, conflict: hs.conflict || null });
  }
  return out;
}

/** Which Dramatis Personae will join this warband? */
export function dpEligibility(ctx: Ctx, wbKey: string | null = ctx.s.wb): HireEligibility {
  const wb = hireWarband(ctx, wbKey);
  const out: HireEligibility = { allowed: [], blocked: [] };
  for (const key of Object.keys(ctx.data.DRAMATIS)) {
    const dp = ctx.data.DRAMATIS[key] as HireEntry;
    let ok = true, reason = '';
    const named = !!dp.rule && (dp.rule.type === 'onlyWb' || dp.rule.type === 'only') && (dp.rule.wbs || []).includes(wb.key ?? '');
    if (wb.none && !named) { ok = false; reason = 'warband cannot recruit special characters'; }
    else if (!hsHireRuleAllows(dp, wb)) { ok = false; reason = 'not available to this warband'; }
    if (!ok) { out.blocked.push({ key, name: dp.name, reason }); continue; }
    out.allowed.push({ key, name: dp.name, hire: dp.hire, upkeep: dp.upkeep, rating: dp.rating });
  }
  return out;
}

export function hsPersonasAllowed(ctx: Ctx, e: HireEntry): Persona[] {
  if (!e.personas) return [];
  const wb = hireWarband(ctx, ctx.s.wb);
  return e.personas.filter((p) => !p.rule || hsHireRuleAllows({ rule: p.rule }, wb));
}

/** The persona a record has chosen, among those this warband may take. */
export function hsPersona(ctx: Ctx, rec: HireRecord | null | undefined, e: HireEntry | null | undefined): Persona | null {
  if (!e || !e.personas) return null;
  let list = e.personas;
  if (ctx.s.wb) { const av = hsPersonasAllowed(ctx, e); if (av.length) list = av; }
  const nm = (rec && rec.opt) || '';
  return list.find((p) => p.name === nm) || list[0] || null;
}

/** The equipment line of a Hired Sword or Dramatis Personae, after options. */
export function hsChosenEq(ctx: Ctx, rec: HireRecord, e: HireEntry | null | undefined): string {
  if (!e) return '';
  if (e.personas) { const p = hsPersona(ctx, rec, e); return (p && p.eq) || e.eq || ''; }
  if (!e.opts) return e.eq || '';
  const cur = rec.opt != null && rec.opt !== '' ? rec.opt : e.opts.choices[0];
  return cur + (e.eqBase ? ', ' + e.eqBase : '');
}
