/* Hiring and managing Hired Swords and Dramatis Personae (legacy app.js
   hireHS … dpSetName, setHsGrade, setDpGrade). */
import type { HireRecord, WarbandState } from '../state/types.ts';
import { houseDefaults, houseRules } from '../state/house.ts';
import type { Ctx } from '../rules/context.ts';
import { dpCount, dpEligibility, dpGradeAllowed, hireEligibility, hsCount, hsGradeAllowed, hsPersonasAllowed, HS_XP_MAX } from '../rules/hire.ts';
import { update, type WarbandDraft } from './update.ts';

/** A record id for a hire: `hs1`, `hs2`, … (`dp…` for Dramatis Personae),
    unique within the warband. */
function nextHireUid(d: WarbandDraft, prefix: 'hs' | 'dp'): string {
  let mx = 0;
  for (const r of [...(d.hired ?? []), ...(d.dp ?? [])]) {
    const m = String(r.uid).match(/^(?:hs|dp)(\d+)$/);
    if (m) mx = Math.max(mx, Number(m[1]));
  }
  return `${prefix}${mx + 1}`;
}

/** Characters with personas start on the first persona this warband may take. */
function initialPersona(ctx: Ctx, key: string): string | undefined {
  const e = ctx.data.HIREDSWORDS[key] ?? ctx.data.DRAMATIS[key];
  if (!e?.personas) return undefined;
  return hsPersonasAllowed(ctx, e)[0]?.name;
}

/** Hires a Hired Sword: allowed by grade house rule and eligibility, one of
    each type (FAQ p.147). */
export function hireHS(ctx: Ctx, key: string, uid?: string): WarbandState {
  const hs = ctx.data.HIREDSWORDS[key];
  if (!hs) return ctx.s;
  if (!hsGradeAllowed(ctx, hs.grade)) return ctx.s;
  if (!hireEligibility(ctx).allowed.some((a) => a.key === key)) return ctx.s;
  if (hsCount(ctx, key) >= 1) return ctx.s;
  return update(ctx, (d) => {
    const rec: HireRecord = { key, uid: uid ?? nextHireUid(d, 'hs'), exp: 0, skills: [] };
    const opt = initialPersona(ctx, key);
    if (opt !== undefined) rec.opt = opt;
    (d.hired = d.hired ?? []).push(rec);
  });
}

export function unhireHS(ctx: Ctx, uid: string): WarbandState {
  return update(ctx, (d) => { d.hired = (d.hired ?? []).filter((h) => h.uid !== uid); });
}

/** Hires a Dramatis Personae: allowed by grade house rule and eligibility,
    unique. */
export function hireDP(ctx: Ctx, key: string, uid?: string): WarbandState {
  const dp = ctx.data.DRAMATIS[key];
  if (!dp) return ctx.s;
  if (!dpGradeAllowed(ctx, dp.grade)) return ctx.s;
  if (!dpEligibility(ctx).allowed.some((a) => a.key === key)) return ctx.s;
  if (dpCount(ctx, key) >= 1) return ctx.s;
  return update(ctx, (d) => {
    const rec: HireRecord = { key, uid: uid ?? nextHireUid(d, 'dp') };
    const opt = initialPersona(ctx, key);
    if (opt !== undefined) rec.opt = opt;
    (d.dp = d.dp ?? []).push(rec);
  });
}

export function unhireDP(ctx: Ctx, uid: string): WarbandState {
  return update(ctx, (d) => { d.dp = (d.dp ?? []).filter((x) => x.uid !== uid); });
}

const inHired = (d: WarbandDraft, uid: string) => (d.hired ?? []).find((h) => h.uid === uid);
const inAny = (d: WarbandDraft, uid: string) => inHired(d, uid) ?? (d.dp ?? []).find((x) => x.uid === uid);

/** A Hired Sword's experience, 0–14. */
export function setHsExp(ctx: Ctx, uid: string, v: unknown): WarbandState {
  return update(ctx, (d) => { const r = inHired(d, uid); if (r) r.exp = Math.max(0, Math.min(HS_XP_MAX, Number(v) || 0)); });
}

export function addHsSkill(ctx: Ctx, uid: string, skill: string): WarbandState {
  if (!skill || skill === '—') return ctx.s;
  return update(ctx, (d) => {
    const r = inAny(d, uid);
    if (!r) return;
    if (!r.skills) r.skills = [];
    if (!r.skills.includes(skill)) r.skills.push(skill);
  });
}

export function removeHsSkill(ctx: Ctx, uid: string, skill: string): WarbandState {
  return update(ctx, (d) => { const r = inHired(d, uid); if (r) r.skills = (r.skills || []).filter((x) => x !== skill); });
}

/** The chosen option or persona. */
export function setHsOption(ctx: Ctx, uid: string, v: string): WarbandState {
  return update(ctx, (d) => { const r = inAny(d, uid); if (r) r.opt = v; });
}

/** House rule "hsEquip": extra equipment from the Hero list, 0–9 each. */
export function setHsEq(ctx: Ctx, uid: string, nm: string, qty: unknown): WarbandState {
  return update(ctx, (d) => {
    const r = inAny(d, uid);
    if (!r) return;
    if (!r.eq) r.eq = {};
    const q = Math.max(0, Math.min(9, Number(qty) || 0));
    if (q <= 0) delete r.eq[nm]; else r.eq[nm] = q;
  });
}

export function setHsName(ctx: Ctx, uid: string, name: string): WarbandState {
  return update(ctx, (d) => { const r = inHired(d, uid); if (r) r.name = name; });
}

export function setDpName(ctx: Ctx, uid: string, name: string): WarbandState {
  return update(ctx, (d) => { const r = (d.dp ?? []).find((x) => x.uid === uid); if (r) r.name = name; });
}

/** House rule: which Hired Sword grades may be hired. */
export function setHsGrade(ctx: Ctx, grade: string, on: boolean): WarbandState {
  return update(ctx, (d) => {
    const h = (d.house = { ...houseRules(d as WarbandState) });
    h.hsGrades = { ...(h.hsGrades ?? houseDefaults().hsGrades), [grade]: !!on };
  });
}

/** House rule: which Dramatis Personae grades may be hired. */
export function setDpGrade(ctx: Ctx, grade: string, on: boolean): WarbandState {
  return update(ctx, (d) => {
    const h = (d.house = { ...houseRules(d as WarbandState) });
    h.dpGrades = { ...(h.dpGrades ?? houseDefaults().dpGrades), [grade]: !!on };
  });
}
