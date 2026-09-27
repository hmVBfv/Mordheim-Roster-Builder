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

/** Next id for a log entry or battle. Never reuses an id: the campaign
    remembers the last one handed out (`logSeq`). */
export function nextLogId(d: WarbandDraft): number {
  const c = campState(d);
  const mx = (c.log ?? []).reduce((m, e) => Math.max(m, Number(e.id) || 0), 0);
  const bx = (c.battles ?? []).reduce((m, e) => Math.max(m, Number(e.id) || 0), 0);
  const id = Math.max(Number(c.logSeq) || 0, mx, bx) + 1;
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
