/* The timeline on the server (phase 4a3, part 2; server/src/routes-
   timeline.ts): the protocol of every battle, who fought and how it ended,
   the marks, and where moved blocks stand; the published chapters of the
   chronicle (4a5). Kept on the device, so the timeline shows offline what
   it showed last. */
import { api } from '../account/api.ts';
import type { CasualtyPayload, EventPayload, Outcome } from '../battle/api.ts';
import { ownKey } from '../account/owner.ts';
import { db } from '../db/db.ts';
import type { ChapterKind, ChapterLang } from './chapters.ts';

export type ItemType = 'note' | 'picture' | 'entry' | 'chapter';
export interface Position { itemType: ItemType; itemId: string; segment: string; pos: string; movedBy: string; movedAt: string }
export type TimelineEntry = { id: string; battleId: string; turn: number; author: string; createdAt: string } & ({ kind: 'casualty'; payload: CasualtyPayload } | { kind: 'event'; payload: EventPayload });
export interface TimelineOutcome { battleId: string; warbandId: string; name: string; outcome: Outcome }
export interface TimelineMark { id: string; warbandId: string; warband: string; kind: 'start' | 'after_battle' | 'sat_out'; round: number; battleId: string | null; rev: number; changes: number; unexplained: number; createdAt: string }
/** A published chapter as the timeline lists it (4a5): both languages, without their texts. */
export interface ChapterSummary {
  id: string; refKey: string; kind: ChapterKind; publishedOn: string | null; createdAt: string; updatedAt: string;
  de: (Omit<ChapterLang, 'text'> & { length: number }) | null;
  en: (Omit<ChapterLang, 'text'> & { length: number }) | null;
}
export interface Chapter extends Omit<ChapterSummary, 'de' | 'en'> { de: ChapterLang | null; en: ChapterLang | null }
/** `chapters`: phase 4a5, absent in a timeline kept from before. */
export interface TimelineData { positions: Position[]; entries: TimelineEntry[]; outcomes: TimelineOutcome[]; marks: TimelineMark[]; chapters?: ChapterSummary[] }

const key = (cid: string) => ownKey('timeline:', cid);

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

/** A chapter with its texts: kept on the device once read, asked anew when the timeline lists a newer one. */
export async function getChapter(cid: string, c: Pick<ChapterSummary, 'id' | 'updatedAt'>): Promise<Chapter> {
  const kept = (await db.meta.get(ownKey('chapter:', c.id)))?.value as Chapter | undefined;
  if (kept && kept.updatedAt === c.updatedAt) return kept;
  const r = await api<{ chapter: Chapter }>(`/campaigns/${cid}/chapters/${c.id}`);
  await db.meta.put({ key: ownKey('chapter:', c.id), value: r.chapter });
  return r.chapter;
}
/** Imports a chapter (a leader): its languages and, for a new one or a new place, where it stands in the story. */
export const putChapter = (cid: string, id: string, c: { refKey: string; kind: ChapterKind; publishedOn: string | null; de: ChapterLang | null; en: ChapterLang | null; place?: { segment: string; pos: string } }) =>
  api<{ chapter: ChapterSummary }>(`/campaigns/${cid}/chapters/${id}`, { method: 'PUT', body: c });
export const removeChapter = (cid: string, id: string) => api<{ removed: true }>(`/campaigns/${cid}/chapters/${id}`, { method: 'DELETE' });
