/* A campaign's notes (phase 4a3; server/src/routes-notes.ts). What a note
   shows is decided on the server for the one who asks: a sealed note of
   someone else's comes as a placeholder without its words until its
   battle is closed; a leaders' note never reaches a player. The last list
   is kept on the device, so the notes are there offline. */
import { api } from '../account/api.ts';
import { ownKey } from '../account/owner.ts';
import { db, type OutboxItem } from '../db/db.ts';

export type Kind = 'general' | 'scene' | 'quote' | 'dice' | 'hook';
export type Visibility = 'public' | 'sealed' | 'leader';
export const KIND_NAMES: Record<Kind, string> = { general: 'Note', scene: 'Scene', quote: 'Quote', dice: 'Dice moment', hook: 'Open thread' };
export interface Mention { warbandId: string; uid: number; name: string }
export interface NoteBody { battleId: string | null; turn: number | null; kind: Kind; text: string; visibility: Visibility; mentions: Mention[] }
export interface FullNote extends NoteBody {
  id: string; authorId: string; author: string; lang: string; sealedUntil: string | null; opened: boolean;
  protocolEntryId: string | null; createdAt: string; updatedAt: string; edited: boolean;
}
export interface SealedNote { id: string; battleId: string | null; authorId: string; author: string; visibility: 'sealed'; sealedUntil: string; sealed: true; createdAt: string }
export type Note = FullNote | SealedNote;
export const isSealed = (n: Note): n is SealedNote => 'sealed' in n;

const key = (cid: string) => ownKey('notes:', cid);
interface Kept { notes: Note[]; seq: number }

export async function cachedNotes(cid: string): Promise<Kept | null> {
  return ((await db.meta.get(key(cid)))?.value as Kept | undefined) ?? null;
}

/** The notes; with what was seen last, the server says only whether anything is newer. */
export async function getNotes(cid: string): Promise<Kept> {
  const cur = await cachedNotes(cid);
  const r = await api<Kept | { unchanged: true; seq: number }>(`/campaigns/${cid}/notes${cur ? `?since=${cur.seq}` : ''}`);
  if ('unchanged' in r) return cur!;
  await db.meta.put({ key: key(cid), value: r });
  return r;
}

/** The notes as shown here: the server's, with what this device has not sent yet laid over them. */
export function mergeNotes(notes: Note[], outbox: OutboxItem[], me: { id: string; displayName: string }): (Note & { pending?: boolean; refused?: string })[] {
  const out = new Map<string, Note & { pending?: boolean; refused?: string }>(notes.map((n) => [n.id, n]));
  for (const i of outbox) {
    if (i.op === 'note.delete' && !i.refused) out.delete(i.targetId);
    if (i.op !== 'note.put') continue;
    const cur = out.get(i.targetId);
    const body = i.body as NoteBody;
    out.set(i.targetId, {
      ...(cur && !isSealed(cur) ? cur : { id: i.targetId, authorId: me.id, author: me.displayName, lang: '', opened: false, protocolEntryId: null, createdAt: i.at, edited: false }),
      ...body, sealedUntil: body.visibility === 'sealed' ? body.battleId : null, updatedAt: i.at,
      pending: !i.refused, ...(i.refused ? { refused: i.refused } : {}),
    } as FullNote & { pending?: boolean; refused?: string });
  }
  return [...out.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
