/* A campaign's background on the server (phase 4b1; server/src/routes-
   background.ts): the leaders' side of the story. Only a leader with the
   authenticator gets it; the last list is kept on the device (under the
   account's own key, like the notes), so it can be read at the table
   without a connection. Writing needs the connection: a change is made
   from the state the device saw (`baseSeq`), and another leader who got in
   first is told so instead of being overwritten. */
import { api, ApiError } from '../account/api.ts';
import { asker, ownKey } from '../account/owner.ts';
import { db } from '../db/db.ts';

export const KINDS = ['thread', 'figure', 'place', 'scenario', 'gm_note'] as const;
export type Kind = (typeof KINDS)[number];
export const KIND_NAMES: Record<Kind, string> = { thread: 'Threads', figure: 'People', place: 'Places', scenario: 'Scenarios', gm_note: 'GM notes' };
export const KIND_ONE: Record<Kind, string> = { thread: 'Thread', figure: 'Person', place: 'Place', scenario: 'Scenario', gm_note: 'GM note' };
export type Status = 'planned' | 'active' | 'resolved';
export type Level = 'hidden' | 'hint' | 'revealed';
export const LEVEL_NAMES: Record<Level, string> = { hidden: 'Hidden', hint: 'Hint', revealed: 'Revealed' };
export const LEVEL_TEXT: Record<Level, string> = {
  hidden: 'Nothing, not even a hint.',
  hint: 'Traces are allowed, within the limit written down.',
  revealed: 'Public from a battle on; the chronicle may tell it.',
};
export interface Ref { kind: 'battle' | 'faction' | 'npc' | 'entry' | 'warrior' | 'note' | 'text'; id: string; label: string }
export interface EntryBody {
  kind: Kind; title: string; truth: string; playersKnow: string; status: Status; reveal: Level; hintLimits: string;
  revealFromBattle: string | null; refs: Ref[]; battleId: string | null;
}
export interface LastReveal { by: string; at: string; noteId: string; battleId: string | null; level: 'hint' | 'revealed' }
export interface Entry extends EntryBody { id: string; updatedBy: string; createdAt: string; updatedAt: string; seq: number; lastReveal: LastReveal | null }
export interface Revision { snapshot: Partial<EntryBody>; editedBy: string; editedAt: string }
export interface Detail { entry: Entry; revisions: Revision[]; reveals: { noteId: string; battleId: string | null; level: string; at: string; by: string }[] }

const key = (cid: string) => ownKey('background:', cid);
interface Kept { entries: Entry[]; seq: number }

export async function cachedBackground(cid: string): Promise<Kept | null> {
  return ((await db.meta.get(key(cid)))?.value as Kept | undefined) ?? null;
}

/** The entries; with what was seen last, the server says only whether anything is newer. */
export async function getBackground(cid: string): Promise<Kept> {
  const who = asker();
  const cur = await cachedBackground(cid);
  const r = await api<Kept | { unchanged: true; seq: number }>(`/campaigns/${cid}/background${cur ? `?since=${cur.seq}` : ''}`);
  if ('unchanged' in r) return cur!;
  await who.keep('background:', cid, r);
  return r;
}

export const getEntry = (cid: string, id: string) => api<Detail>(`/campaigns/${cid}/background/${id}`);

/** Writes an entry; `baseSeq` is the state the device edited from (0 for a new one). */
export const putEntry = (cid: string, id: string, body: EntryBody, baseSeq: number) =>
  api<{ entry: Entry; seq: number }>(`/campaigns/${cid}/background/${id}`, { method: 'PUT', body: { ...body, baseSeq } });
export const removeEntry = (cid: string, id: string) => api<{ removed: true; seq: number }>(`/campaigns/${cid}/background/${id}`, { method: 'DELETE' });

export interface RevealBody { noteId: string; text: string; lang: '' | 'de' | 'en'; battleId: string | null; place: { segment: string; pos: string } | null; level: 'hint' | 'revealed' }
export const revealEntry = (cid: string, id: string, body: RevealBody) =>
  api<{ entry: Entry; note: string; seq: number }>(`/campaigns/${cid}/background/${id}/reveal`, { body });

/** The entry as it stands now, when another leader changed it first (the server's 409 `stale`). */
export function staleEntry(e: unknown): Entry | null {
  return e instanceof ApiError && e.status === 409 && e.code === 'stale' ? ((e.body as { current?: Entry } | undefined)?.current ?? null) : null;
}

/** Where a revealed note may stand in the story: one place per segment, from the timeline's own anchors. A key near the end of the segment: later reveals stand after earlier ones. */
export const endOfSegment = (now: number) => `9${String(now).padStart(13, '0')}1`;
