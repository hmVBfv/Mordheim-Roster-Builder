/* The warband duties phase (Rob, 14.11.2026): rules that ask for a choice after each battle, with consequences – the Troll's "Always Hungry"
   of the Black Orcs (pay 20 gc, count as two members for 5 gc, or let him leave), of the Orc Mob and the Night Goblins (pay 15 gc, sacrifice
   two Goblins or Cave Squigs, or let him wander off). Counting as two members raises the warband's size for its maximum: at the maximum it is
   not possible – pay, or let someone go first. The rules are data (PB_DUTIES); each choice is recorded with its origin (ADR 0032). */
import type { DutyDef } from '../data/types.ts';
import { ctxOf, type Ctx } from '../rules/context.ts';
import type { Model, WarbandState } from '../state/types.ts';
import { totalModels, warbandMax } from '../rules/costs.ts';
import { unitDef } from '../rules/lookup.ts';
import { memberCount } from '../rules/profile.ts';
import { dismissMan, dismissWarrior } from '../trade/market.ts';
import { update } from '../warband/update.ts';
import { bookGoldOn } from './locationApply.ts';
import { postbattleOn, type Find, type PostBattleState } from './postbattle.ts';

export interface DutyOption { id: 'pay' | 'double' | 'sacrifice' | 'leave'; label: string; gc: number; available: boolean; why?: string; units?: string[]; count?: number }
export interface DutyLine {
  id: string;
  title: string;
  text: string;
  /** The unit it concerns (its uid on the roster). */
  uid: number;
  options: DutyOption[];
  /** What was chosen this round, or null. */
  resolved: { option: string; gc: number } | null;
}

const roundRec = (s: WarbandState, round: number): PostBattleState | undefined =>
  (s.campaign as { postbattle?: Record<string, PostBattleState> } | undefined)?.postbattle?.[round];

/** The men a sacrifice may take: every man of the groups the option names, as (group uid, index). */
export function sacrificeCandidates(ctx: Ctx, units: readonly string[]): { uid: number; i: number; label: string }[] {
  const out: { uid: number; i: number; label: string }[] = [];
  for (const m of ctx.s.models) {
    if (!units.includes(m.uid_def)) continue;
    const name = unitDef(ctx, m.uid_def)?.name ?? m.uid_def;
    for (let i = 0; i < memberCount(m); i++) out.push({ uid: m.uid, i, label: `${name}${memberCount(m) > 1 ? ` ${i + 1}` : ''}` });
  }
  return out;
}

const defsFor = (ctx: Ctx): DutyDef[] => ctx.data.PB_DUTIES.filter((d) => d.wb === ctx.s.wb);

/** The duties due after this battle: one for each rule of the warband whose unit is on the roster. */
export function dutiesDue(ctx: Ctx, round: number): DutyLine[] {
  const resolved = roundRec(ctx.s, round)?.duties?.resolved ?? [];
  const out: DutyLine[] = [];
  for (const d of defsFor(ctx)) {
    const m = ctx.s.models.find((x) => x.uid_def === d.unit);
    if (!m) continue;
    const res = resolved.find((r) => r.id === d.id) ?? null;
    out.push({
      id: d.id, title: d.title, text: d.text, uid: m.uid, resolved: res ? { option: res.option, gc: res.gc } : null,
      options: d.options.map((o) => {
        let available = true, why: string | undefined;
        if (o.id === 'double') {
          // the Troll counts twice for the maximum: no room, no choice
          const room = warbandMax(ctx) - totalModels(ctx) - (m.countsTwo ? 0 : 0);
          if (!m.countsTwo && room < 1) { available = false; why = `The warband is at its maximum (${totalModels(ctx)} of ${warbandMax(ctx)}): counting as two would exceed it. Pay, or let someone go first.`; }
        }
        if (o.id === 'sacrifice' && sacrificeCandidates(ctx, o.units ?? []).length < (o.count ?? 2)) { available = false; why = `There are not two to sacrifice.`; }
        return { id: o.id, label: o.label, gc: o.gc, available, ...(why ? { why } : {}), ...(o.units ? { units: o.units } : {}), ...(o.count ? { count: o.count } : {}) };
      }),
    });
  }
  return out;
}

export interface DutyChoice {
  /** For a sacrifice: the men let go, as (group uid, index). */
  sacrifice?: { uid: number; i: number }[];
}

/** Why this choice cannot be made (null if it can). */
export function dutyProblem(ctx: Ctx, round: number, dutyId: string, option: string, choice: DutyChoice = {}): string | null {
  const d = dutiesDue(ctx, round).find((x) => x.id === dutyId);
  if (!d) return 'There is no such duty.';
  if (d.resolved) return 'This duty is settled: take it back first.';
  const o = d.options.find((x) => x.id === option);
  if (!o) return 'There is no such choice.';
  if (!o.available) return o.why ?? 'Not possible.';
  if (option === 'sacrifice') {
    const want = o.count ?? 2, pick = choice.sacrifice ?? [];
    const ok = new Set(sacrificeCandidates(ctx, o.units ?? []).map((c) => `${c.uid}:${c.i}`));
    if (pick.length !== want) return `Choose two to sacrifice (now ${pick.length}).`;
    if (new Set(pick.map((p) => `${p.uid}:${p.i}`)).size !== pick.length || pick.some((p) => !ok.has(`${p.uid}:${p.i}`))) return 'Those cannot be sacrificed.';
  }
  return null;
}

/** Lets one man go: a man of a group (core dismissMan), or a lone warrior (dismissWarrior). */
function letGo(ctx: Ctx, m: Model, i: number): WarbandState {
  return memberCount(m) > 1 ? dismissMan(ctx, m.uid, i) : dismissWarrior(ctx, m.uid);
}

/** Settles a duty with the choice made: gold paid (a booking naming the origin), the double count set, men let go. Recorded in the round with a
    find. A choice that cannot be made leaves the state as it was. */
export function resolveDuty(ctx: Ctx, round: number, dutyId: string, option: string, choice: DutyChoice = {}): WarbandState {
  if (dutyProblem(ctx, round, dutyId, option, choice)) return ctx.s;
  const d = dutiesDue(ctx, round).find((x) => x.id === dutyId)!;
  const o = d.options.find((x) => x.id === option)!;
  let s = ctx.s;
  const source = `duty:${dutyId}`;
  if (option === 'leave') s = dismissWarrior(ctx, d.uid);
  if (option === 'sacrifice') {
    // the highest index first, so that the indexes of the others stay what they were
    const picks = [...(choice.sacrifice ?? [])].sort((a, b) => (a.uid === b.uid ? b.i - a.i : a.uid - b.uid));
    for (const p of picks) { const m = s.models.find((x) => x.uid === p.uid); if (m) s = letGo(ctxOf(ctx.data, s), m, p.i); }
  }
  return update(ctxOf(ctx.data, s), (dr, c) => {
    const rec = postbattleOn(dr, c, round);
    if (o.gc) bookGoldOn(dr, c, -o.gc, `${d.title}: ${o.label}`, source);
    if (option === 'double') { const m = (dr.models as Model[]).find((x) => x.uid === d.uid); if (m) m.countsTwo = true; }
    else { const m = (dr.models as Model[]).find((x) => x.uid === d.uid); if (m) delete m.countsTwo; }
    const duties = rec.duties ?? { resolved: [] };
    duties.resolved.push({ id: dutyId, option, gc: o.gc });
    rec.duties = duties;
    const finds = rec.finds ?? [];
    finds.push({ id: finds.reduce((n, f) => Math.max(n, f.id), 0) + 1, kind: o.gc ? 'gold' : 'note', source, ...(o.gc ? { amount: -o.gc } : {}), text: `${d.title}: ${o.label}.` } satisfies Find);
    rec.finds = finds;
  });
}

/** Takes a paid or double-counted choice back: the gold returns, the double count goes, the duty is asked again. A man let go or a Troll who left
    is not brought back here (the editor's Undo does that). */
export function undoDuty(ctx: Ctx, round: number, dutyId: string): WarbandState {
  const rec = roundRec(ctx.s, round);
  const r = rec?.duties?.resolved.find((x) => x.id === dutyId);
  if (!r || r.option === 'leave' || r.option === 'sacrifice') return ctx.s;
  const d = defsFor(ctx).find((x) => x.id === dutyId);
  return update(ctx, (dr, c) => {
    const rr = postbattleOn(dr, c, round);
    if (r.gc) bookGoldOn(dr, c, r.gc, `${d?.title ?? dutyId}: taken back`, `duty:${dutyId}`);
    const m = (dr.models as Model[]).find((x) => x.uid_def === d?.unit);
    if (m) delete m.countsTwo;
    rr.duties = { ...rr.duties!, resolved: rr.duties!.resolved.filter((x) => x.id !== dutyId) };
    rr.finds = (rr.finds ?? []).filter((f) => f.source !== `duty:${dutyId}`);
  });
}

/** Marks the duties phase done (or open again). */
export function setDutiesDone(ctx: Ctx, round: number, on: boolean): WarbandState {
  return update(ctx, (d, c) => {
    const rec = postbattleOn(d, c, round);
    rec.duties = { resolved: rec.duties?.resolved ?? [], done: on };
  });
}
