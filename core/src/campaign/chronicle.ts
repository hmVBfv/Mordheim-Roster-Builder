/* The chronicle of a warband's campaign: entries written by hand, the
   current stage, and battles (legacy app.js addLogNote, editLogText,
   removeLogAt, setRound, addBattle, editBattle, removeBattle). */
import type { LogEntry, WarbandState } from '../state/types.ts';
import type { Ctx } from '../rules/context.ts';
import { wbName } from '../rules/casualties.ts';
import { campState, logEventAt, nextLogId } from '../warband/log.ts';
import { update } from '../warband/update.ts';
import { districtName } from './territory.ts';

const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/* ---- the chronicle ---- */

/** A note written by hand into the chronicle (current stage unless given). */
export function addLogNote(ctx: Ctx, text: string, round?: number | null): WarbandState {
  return update(ctx, (d) => {
    const c = campState(d);
    const e: LogEntry = { id: nextLogId(d), round: round == null ? (c.round ?? 0) : Number(round) || 0, type: 'note', text: String(text || ''), auto: false };
    (c.log as LogEntry[]).push(e);
  });
}

/** Corrects the text of an entry; it is marked as edited. */
export function editLogText(ctx: Ctx, id: number, text: string): WarbandState {
  if (!(ctx.s.campaign?.log ?? []).some((x) => x.id === Number(id))) return ctx.s;
  return update(ctx, (d) => {
    const e = (campState(d).log as LogEntry[]).find((x) => x.id === Number(id)) as LogEntry;
    e.text = String(text || '');
    e.edited = true;
  });
}

/** Deletes an entry. The interface asks first. */
export function removeLogEntry(ctx: Ctx, id: number): WarbandState {
  const i = (ctx.s.campaign?.log ?? []).findIndex((x) => x.id === Number(id));
  if (i < 0) return ctx.s;
  return update(ctx, (d) => { (campState(d).log as LogEntry[]).splice(i, 1); });
}

/** Sets the current stage (0 = Setup, n = after the n-th battle). */
export function setRound(ctx: Ctx, n: unknown): WarbandState {
  const v = Math.max(0, Number(n) || 0);
  return update(ctx, (d) => {
    const c = campState(d);
    if (v !== c.round) c.round = v;
  });
}

/* ---- battles ---- */

export interface BattleSide { key?: string; name?: string; wb?: string; outcome?: string; [key: string]: unknown }
export interface BattleInput {
  round?: number | null;
  sides?: BattleSide[];
  opponents?: { name?: string; wb?: string }[];
  district?: string;
  outcome?: string;
  notes?: string;
}

/** Records a battle (with every side's outcome) and its chronicle entry. */
export function addBattle(ctx: Ctx, b: BattleInput = {}): WarbandState {
  return update(ctx, (d, c) => {
    const camp = campState(d);
    const bat = {
      id: nextLogId(d), round: b.round == null ? (camp.round ?? 0) : Number(b.round) || 0,
      sides: Array.isArray(b.sides) ? copy(b.sides.filter((x) => x && (x.name || x.wb))) : [],
      opponents: Array.isArray(b.opponents) ? copy(b.opponents.filter((o) => o && (o.name || o.wb))) : [],
      district: b.district || '', outcome: b.outcome || '', notes: b.notes || '',
    };
    (camp.battles as { id: number }[]).push(bat);
    const who = bat.opponents.length ? bat.opponents.map((o) => o.name || wbName(c, o.wb)).join(', ') : 'an unnamed foe';
    logEventAt(d, bat.round, 'battle', `Battle ${bat.round}: fought ${who}${bat.district ? ` at ${districtName(c, bat.district)}` : ''}${bat.outcome ? ` — ${bat.outcome}` : ''}.`, { battleId: bat.id });
  });
}

/** Changes fields of a battle record (its chronicle entry stays as it was). */
export function editBattle(ctx: Ctx, id: number, patch: Partial<BattleInput> & Record<string, unknown>): WarbandState {
  if (!patch || !(ctx.s.campaign?.battles ?? []).some((x) => x.id === Number(id))) return ctx.s;
  return update(ctx, (d) => {
    const b = (campState(d).battles as { id: number }[]).find((x) => x.id === Number(id)) as Record<string, unknown>;
    for (const [k, v] of Object.entries(patch)) b[k] = v === undefined ? undefined : copy(v);
  });
}

/** Deletes a battle and its chronicle entries. The interface asks first. */
export function removeBattle(ctx: Ctx, id: number): WarbandState {
  const i = (ctx.s.campaign?.battles ?? []).findIndex((x) => x.id === Number(id));
  if (i < 0) return ctx.s;
  return update(ctx, (d) => {
    const camp = campState(d);
    const bid = (camp.battles as { id: number }[])[i]!.id;
    (camp.battles as unknown[]).splice(i, 1);
    camp.log = (camp.log ?? []).filter((e) => !(e.data && e.data.battleId === bid));
  });
}
