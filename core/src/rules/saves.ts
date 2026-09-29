/* Armour saves (legacy engine.js statNum … svLabel). */
import type { HireEntry } from '../data/types.ts';
import type { HireRecord, Model } from '../state/types.ts';
import type { Ctx } from './context.ts';
import { hsChosenEq, hsEqParts, hsEquipOn } from './hire.ts';
import { unitDef } from './lookup.ts';

/** Numeric value of a profile entry: "3(4)" → 4 (the bracket is effective),
    "D6" → 6, "—" → null. */
export function statNum(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v);
  const par = s.match(/\((\d+)\)/);
  if (par) return Number(par[1]);
  const m = s.match(/\d+/);
  return m ? Number(m[0]) : null;
}

const ARMOUR_IN_TEXT: [RegExp, number][] = [
  [/gromril\s*armour/i, 4], [/chaos\s*armour/i, 4], [/ithilmar\s*armour/i, 5],
  [/heavy\s*armour/i, 5], [/light\s*armour/i, 6], [/toughened\s*leathers|hardened\s*leathers/i, 6],
];
const SAVE_PATTERNS = [
  /\b([2-6])\+\s*(?:armour\s*)?save\b/i, /\bsave\s*(?:of\s*)?([2-6])\+/i,
  /\bscaly(?:\s*skin)?\s*([2-6])\+/i, /\bhide[^.]{0,20}?([2-6])\+\s*save/i,
];

/** The best armour save named in a text: armour pieces, natural armour or an
    explicit save. Ignores saves against being stunned and injury effects. */
export function svFromText(t: string | null | undefined): number | null {
  if (!t) return null;
  let best: number | null = null;
  ARMOUR_IN_TEXT.forEach(([re, v]) => { if (re.test(t) && (best == null || v < best)) best = v; });
  const clean = String(t).replace(/[^.]*?(?:avoid being stunned|against being stunned|to avoid|out of action on)[^.]*\.?/gi, ' ');
  SAVE_PATTERNS.forEach((re) => { const m = re.exec(clean); if (m) { const v = Number(m[1]); if (best == null || v < best) best = v; } });
  return best;
}

/** Combines two saves that stack: the better one improved by one, 2+ at best. */
export function svCombine(a: number | null, b: number | null): number | null {
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(2, Math.min(a, b) - 1);
}

/** The permanent armour save of a model: armour, natural armour, and learned
    skills (Well 'Ard +1, Shaggy Hide 6+ combinable). Shields excluded. */
export function svOfModel(ctx: Ctx, m: Model): number | null {
  const def = unitDef(ctx, m.uid_def);
  let eqSv: number | null = null;
  const eq = m.eq || {};
  for (const nm of Object.keys(eq)) {
    if (!eq[nm]) continue;
    const v = ctx.data.ARMOUR_SV[nm];
    if (v != null && (eqSv == null || v < eqSv)) eqSv = v;
  }
  const innate = svFromText(def && def.sp);
  const combinable = /combines?\s*with\s*armour|combined with o/i.test((def && def.sp) || '');
  let best = combinable ? svCombine(eqSv, innate) : eqSv == null ? innate : innate == null ? eqSv : Math.min(eqSv, innate);
  if (def && def.sv != null && (best == null || def.sv < best)) best = def.sv;
  const sk = (m && m.skills) || [];
  let bonus = 0, base: number | null = null;
  sk.forEach((n) => {
    const b = ctx.data.SV_SKILL_BONUS[n];
    if (b) bonus += b;
    const bs = ctx.data.SV_SKILL_BASE[n];
    if (bs != null && (base == null || bs < base)) base = bs;
  });
  if (base != null) best = svCombine(best, base);
  if (best != null && bonus) best = Math.max(2, best - bonus);
  return best;
}

/** The armour save of a Hired Sword or Dramatis Personae entry. */
export function svOfEntry(ctx: Ctx, e: HireEntry | null | undefined, rec?: HireRecord | null): number | null {
  let best = svFromText(rec ? hsChosenEq(ctx, rec, e) : e && e.eq);
  const t = svFromText(e && e.sp);
  if (t != null && (best == null || t < best)) best = t;
  if (rec && hsEquipOn(ctx)) {
    const ex = svFromText(hsEqParts(ctx, rec).join(', '));
    if (ex != null && (best == null || ex < best)) best = ex;
  }
  const sk = (rec && rec.skills) || [];
  let bonus = 0;
  sk.forEach((n) => { const b = ctx.data.SV_SKILL_BONUS[n]; if (b) bonus += b; });
  if (best != null && bonus) best = Math.max(2, best - bonus);
  return best;
}

export function svLabel(v: number | null | undefined): string {
  return v == null ? '—' : v + '+';
}
