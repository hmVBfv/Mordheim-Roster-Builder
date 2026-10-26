/* Hidden NPC warbands on the server (server/src/routes-npc-warbands.ts): the game master's reference and Tabletop Simulator data.
   Leaders' own – read and written by leaders with the authenticator; for everyone else there is no such thing. Every change
   needs the connection; nothing is kept on the device. */
import * as core from '@mordheim/core';
import { api, ApiError } from '../account/api.ts';

export interface NpcSummary { value: number; exp: number; rating: number; models: number; kind: string }
export interface NpcListed { id: string; name: string; summary: NpcSummary; updatedBy: string; createdAt: string; updatedAt: string; seq: number }
export interface NpcWarband extends NpcListed { save: Record<string, unknown> }

export const listNpcWarbands = (cid: string) => api<{ warbands: NpcListed[]; seq: number }>(`/campaigns/${cid}/npc-warbands`).then((r) => r.warbands);
export const getNpcWarband = (cid: string, id: string) => api<{ warband: NpcWarband }>(`/campaigns/${cid}/npc-warbands/${id}`).then((r) => r.warband);

/** The three figures a planner is tracked by, with what the list shows beside them. */
export function summaryOf(ctx: core.Ctx, kind: string): NpcSummary {
  const f = core.plannerFigures(ctx);
  return { value: f.value, exp: f.exp, rating: f.rating, models: core.totalModels(ctx), kind };
}

export async function putNpcWarband(cid: string, id: string, body: { name: string; save: Record<string, unknown>; summary: NpcSummary }, baseSeq: number): Promise<NpcWarband> {
  return (await api<{ warband: NpcWarband }>(`/campaigns/${cid}/npc-warbands/${id}`, { method: 'PUT', body: { ...body, baseSeq } })).warband;
}

export const removeNpcWarband = (cid: string, id: string) => api<{ removed: boolean }>(`/campaigns/${cid}/npc-warbands/${id}`, { method: 'DELETE' }).then(() => undefined);

/** What stands on the server now, when another leader changed it first (409 `stale`). */
export const staleOf = (e: unknown): NpcWarband | null => (e instanceof ApiError && e.status === 409 && e.code === 'stale' ? ((e.body as { current?: NpcWarband } | undefined)?.current ?? null) : null);
