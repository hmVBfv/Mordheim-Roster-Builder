/* Reading casualties, the Fallen and held experience (legacy app.js
   casualtyText … casualtyStats, fallenEqSig … fallenExpLost, modelLabel …
   unrolledCasualties). The actions that change them are in
   warband/casualties.ts and warband/xp.ts. */
import type { Casualty, FallenRecord, Model, XpEntry } from '../state/types.ts';
import type { Ctx } from './context.ts';
import { isHeroModel, modelUnitCost } from './costs.ts';
import { unitDef } from './lookup.ts';

/** Henchmen roll their own D6 after a battle: 1–2 the man is gone for good,
    3–6 he fights on as normal (mordheimer, Tools). */
export const HENCH_INJ: readonly { code: string; name: string; dead?: true; ok?: true }[] = [
  { code: '1-2', name: 'Dead', dead: true },
  { code: '3-6', name: 'Okay - fights on as normal', ok: true },
];

export function wbName(ctx: Ctx, key: string | null | undefined): string {
  return (key && ctx.data.WARBANDS[key]?.name) || key || 'unknown warband';
}

export function roundLabel(n: unknown): string {
  const v = Number(n) || 0;
  return v === 0 ? 'Setup' : `After battle ${v}`;
}

/* ---- casualties ---- */

export function casualties(ctx: Ctx): Casualty[] {
  return ctx.s.campaign?.casualties ?? [];
}

export function casualtyById(ctx: Ctx, id: unknown): Casualty | undefined {
  return casualties(ctx).find((x) => x.id === Number(id));
}

export function casualtyText(ctx: Ctx, r: Casualty): string {
  const v = r.victim.name || 'a warrior';
  const a = r.attacker.name;
  const by = a ? `${a}${r.attacker.wb ? ` (${wbName(ctx, r.attacker.wb)})` : ''}` : 'an unknown hand';
  const what = ({ pending: 'was put out of action', recovered: 'recovered fully', injured: 'was wounded', dead: 'was slain' } as Record<string, string>)[r.result] || 'was put out of action';
  return `${v}${(r.victim.wb && r.victim.uid == null) ? ` (${wbName(ctx, r.victim.wb)})` : ''} ${what} by ${by}${r.detail ? ` — ${r.detail}` : ''}.`;
}

export function casualtyType(r: Casualty): string {
  return r.result === 'dead' ? 'death' : (r.result === 'injured' ? 'injury' : 'casualty');
}

export function casualtyIsOurs(r: Casualty | null | undefined): boolean {
  return !!(r && r.victim && r.victim.uid != null);
}

export function casualtyModel(ctx: Ctx, r: Casualty): Model | null {
  if (!casualtyIsOurs(r)) return null;
  return ctx.s.models.find((x) => x.uid === r.victim.uid) ?? null;
}

export function casualtyIsHero(ctx: Ctx, r: Casualty): boolean {
  const m = casualtyModel(ctx, r);
  if (m) return isHeroModel(ctx, m);
  if (r.victim.grade) return r.victim.grade === 'hero';
  const fe = r.fallenId == null ? undefined : (ctx.s.fallen ?? [])[r.fallenId];
  return fe ? fe.kind === 'hero' : false;
}

/** The options for one casualty, from the table that actually applies. */
export function casualtyRollOptions(ctx: Ctx, r: Casualty): { code: string; label: string }[] {
  if (casualtyIsHero(ctx, r)) return ctx.data.INJURIES.map((j) => ({ code: j.code, label: `${j.code} · ${ctx.data.INJEN[j.code] || j.name}` }));
  return HENCH_INJ.map((j) => ({ code: j.code, label: `${j.code} · ${j.name}` }));
}

/** An unresolved casualty for one of our models. With a henchman group
    several men can be down at once, so a name narrows it to the right record;
    without one, the oldest still open. */
export function pendingCasualtyFor(ctx: Ctx, uid: number, who?: string | null): Casualty | null {
  const list = casualties(ctx);
  if (who) {
    const exact = list.find((r) => r.victim.uid === uid && r.result === 'pending' && r.victim.name === who);
    if (exact) return exact;
  }
  return list.find((r) => r.victim.uid === uid && r.result === 'pending') ?? null;
}

/** What each of our warriors dealt out and suffered. */
export function casualtyStats(ctx: Ctx): {
  inflicted: Record<string, { ooa: number; kills: number }>;
  suffered: Record<string, { ooa: number; deaths: number; injuries: number }>;
} {
  const out = { inflicted: {} as Record<string, { ooa: number; kills: number }>, suffered: {} as Record<string, { ooa: number; deaths: number; injuries: number }> };
  for (const r of casualties(ctx)) {
    if (r.attacker.uid != null) {
      const k = r.attacker.name || ('#' + r.attacker.uid);
      const t = out.inflicted[k] = out.inflicted[k] ?? { ooa: 0, kills: 0 };
      t.ooa++; if (r.result === 'dead') t.kills++;
    }
    if (r.victim.uid != null) {
      const k = r.victim.name || ('#' + r.victim.uid);
      const t = out.suffered[k] = out.suffered[k] ?? { ooa: 0, deaths: 0, injuries: 0 };
      t.ooa++;
      if (r.result === 'dead') t.deaths++;
      if (r.result === 'injured') t.injuries++;
    }
  }
  return out;
}

/** Deaths of this round that are still on the roster. */
export function outstandingCasualties(ctx: Ctx, round?: number): Casualty[] {
  const r = round ?? (ctx.s.campaign?.round ?? 0);
  return casualties(ctx).filter((c) => c.round === r && c.result === 'dead' && !c.applied
    && c.victim.uid != null && ctx.s.models.some((m) => m.uid === c.victim.uid));
}

/** Casualties of this round nobody has rolled for yet. */
export function unrolledCasualties(ctx: Ctx, round?: number): Casualty[] {
  const r = round ?? (ctx.s.campaign?.round ?? 0);
  return casualties(ctx).filter((c) => c.round === r && c.result === 'pending');
}

/* ---- experience held until applied ---- */

export function xpLedger(ctx: Ctx): XpEntry[] {
  return ctx.s.campaign?.xp ?? [];
}

/** Henchmen earn experience as a group, so their entries say so. */
export function modelLabel(ctx: Ctx, m: Model | null | undefined): string {
  if (!m) return '';
  const def = unitDef(ctx, m.uid_def);
  const base = m.name || def?.name || m.uid_def;
  const qty = Number(m.qty) || 1;
  return isHeroModel(ctx, m) ? base : `${base} (group${qty > 1 ? ` of ${qty}` : ''})`;
}

/** Beasts, wagons and the like never gain experience. */
export function canEarnXp(ctx: Ctx, m: Model | null | undefined): boolean {
  if (!m) return false;
  return !unitDef(ctx, m.uid_def)?.noxp;
}

export function pendingXp(ctx: Ctx): XpEntry[] {
  return xpLedger(ctx).filter((x) => !x.applied);
}

export function pendingXpFor(ctx: Ctx, uid: unknown): number {
  return pendingXp(ctx).filter((x) => x.uid === Number(uid)).reduce((a, x) => a + x.amount, 0);
}

export function pendingXpTotal(ctx: Ctx): number {
  return pendingXp(ctx).reduce((a, x) => a + x.amount, 0);
}

/* ---- the Fallen ---- */

/** Same type, equipment, advances, skills, mutations and experience: two
    fallen henchmen with the same signature are interchangeable. */
export function fallenEqSig(m: Model): string {
  const eq: Record<string, unknown> = {};
  for (const k in (m.eq ?? {})) if (m.eq![k]) eq[k] = m.eq![k];
  const rare: Record<string, unknown> = {};
  for (const k in (m.rare ?? {})) rare[k] = m.rare![k];
  return JSON.stringify([m.uid_def, Number(m.exp) || 0, eq, rare, (m.mut ?? []).slice().sort(), (m.skills ?? []).slice().sort(), m.adv ?? {}]);
}

/** Real gold lost with one fallen: the man, his gear and any recruit
    surcharge paid for him. Experience is never priced in. */
export function fallenGoldOf(ctx: Ctx, e: FallenRecord): number {
  return (modelUnitCost(ctx, e.m) || 0) + (Number(e.m && e.m.xpPaid) || 0);
}

export function fallenGoldLost(ctx: Ctx): number {
  return (ctx.s.fallen ?? []).reduce((s, e) => s + fallenGoldOf(ctx, e), 0);
}

/** Experience earned in play (beyond the unit's starting experience) that
    died with him: a leader who starts at 20 and dies at 23 lost 3. */
export function fallenExpEarned(ctx: Ctx, e: FallenRecord): number {
  const ud = e.uid_def || (e.m && e.m.uid_def);
  const def = ud ? unitDef(ctx, ud) : undefined;
  return Math.max(0, (Number(e.m && e.m.exp != null ? e.m.exp : e.exp) || 0) - (Number(def && def.exp) || 0));
}

export function fallenExpLost(ctx: Ctx): number {
  return (ctx.s.fallen ?? []).reduce((s, e) => s + fallenExpEarned(ctx, e), 0);
}
