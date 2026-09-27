/* The campaign chronicle as warband actions write to it (legacy app.js
   campState, nextLogId, logEvent). */
import type { CampaignState, LogEntry } from '../state/types.ts';
import type { WarbandDraft } from './update.ts';

/** The campaign part of the state with every list present (legacy campState). */
export function campState(d: WarbandDraft): CampaignState {
  if (!d.campaign) d.campaign = { on: false, districts: {} };
  const c = d.campaign as CampaignState;
  if (!c.districts) c.districts = {};
  if (c.round == null) c.round = 0;
  if (!Array.isArray(c.log)) c.log = [];
  if (!Array.isArray(c.battles)) c.battles = [];
  if (!Array.isArray(c.casualties)) c.casualties = [];
  return c;
}

/** Next id for a log entry, battle, casualty or experience entry — they
    share one sequence. Never reuses an id: the campaign remembers the last
    one handed out (`logSeq`). A save without it continues after the highest
    id in any of the four lists; legacy looked at the log and the battles
    only, so an old save could hand out a casualty's id a second time. */
export function nextLogId(d: WarbandDraft): number {
  const c = campState(d);
  const top = (xs: { id?: unknown }[] | undefined) => (xs ?? []).reduce((m, e) => Math.max(m, Number(e.id) || 0), 0);
  const id = Math.max(Number(c.logSeq) || 0, top(c.log), top(c.battles), top(c.casualties), top(c.xp)) + 1;
  c.logSeq = id;
  return id;
}

/** Records an event — only while the campaign is switched on, so plain roster
    editing does not fill the chronicle with noise. */
export function logEvent(d: WarbandDraft, type: string, text: string, data?: Record<string, unknown>): LogEntry | null {
  const c = campState(d);
  if (!c.on) return null;
  const e: LogEntry = { id: nextLogId(d), round: c.round ?? 0, type: String(type), text: String(text), auto: true };
  if (data) e.data = data;
  (c.log as LogEntry[]).push(e);
  return e;
}

/** Like logEvent, but stamped with a given round (a battle records itself
    under the round it belongs to, which may be ahead of the current one). */
export function logEventAt(d: WarbandDraft, round: unknown, type: string, text: string, data?: Record<string, unknown>): LogEntry | null {
  const c = campState(d);
  if (!c.on) return null;
  const e: LogEntry = { id: nextLogId(d), round: Number(round) || 0, type: String(type), text: String(text), auto: true };
  if (data) e.data = data;
  (c.log as LogEntry[]).push(e);
  return e;
}
