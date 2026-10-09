/* The timeline on the server (phase 4a3, part 2; server/src/routes-
   timeline.ts): the protocol of every battle, who fought and how it ended,
   the marks, and where moved blocks stand. Kept on the device, so the
   timeline shows offline what it showed last. */
import { api } from '../account/api.ts';
import type { CasualtyPayload, EventPayload, Outcome } from '../battle/api.ts';
import { db } from '../db/db.ts';

export type ItemType = 'note' | 'picture' | 'entry';
export interface Position { itemType: ItemType; itemId: string; segment: string; pos: string; movedBy: string; movedAt: string }
export type TimelineEntry = { id: string; battleId: string; turn: number; author: string; createdAt: string } & ({ kind: 'casualty'; payload: CasualtyPayload } | { kind: 'event'; payload: EventPayload });
export interface TimelineOutcome { battleId: string; warbandId: string; name: string; outcome: Outcome }
export interface TimelineMark { id: string; warbandId: string; warband: string; kind: 'start' | 'after_battle' | 'sat_out'; round: number; battleId: string | null; rev: number; changes: number; unexplained: number; createdAt: string }
export interface TimelineData { positions: Position[]; entries: TimelineEntry[]; outcomes: TimelineOutcome[]; marks: TimelineMark[] }

const key = (cid: string) => `timeline:${cid}`;

export async function cachedTimeline(cid: string): Promise<TimelineData | null> {
  return ((await db.meta.get(key(cid)))?.value as TimelineData | undefined) ?? null;
}

export async function getTimeline(cid: string): Promise<TimelineData> {
  const r = await api<TimelineData>(`/campaigns/${cid}/timeline`);
  await db.meta.put({ key: key(cid), value: r });
  return r;
}

export const moveBlock = (cid: string, type: ItemType, id: string, to: { segment: string; pos: string }) =>
  api<{ position: Position }>(`/campaigns/${cid}/timeline/${type}/${id}`, { method: 'PUT', body: to });
