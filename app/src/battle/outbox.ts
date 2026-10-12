/* What the game night gathered and still has to send (phase 4a2): protocol
   entries, their removals, corrections; notes (4a3) and pictures with
   their bytes (4a3, part 2) too. Kept on the device first, so a
   battle at a table without a connection loses nothing (concept.md 4.5),
   and sent in order once the server answers – by the game night itself and
   by every round of the sync. Each carries the id the server keeps it
   under: sent twice, it is there once. */
import { useLiveQuery } from 'dexie-react-hooks';
import { api, apiBytes, ApiError, errorText } from '../account/api.ts';
import { db, type OutboxItem } from '../db/db.ts';

export async function enqueue(item: Omit<OutboxItem, 'at'>): Promise<void> {
  await db.outbox.put({ ...item, at: new Date().toISOString() });
}

const pathOf = (i: OutboxItem) => {
  if (i.op === 'note.put' || i.op === 'note.delete') return `/campaigns/${i.campaignId}/notes/${i.targetId}`;
  if (i.op === 'attachment.put' || i.op === 'attachment.delete') return `/campaigns/${i.campaignId}/attachments/${i.targetId}`;
  const base = `/campaigns/${i.campaignId}/battles/${i.battleId}`;
  return i.op === 'proposal.put' ? `${base}/proposals/${i.targetId}` : `${base}/protocol/${i.targetId}`;
};
const DELETES: ReadonlySet<OutboxItem['op']> = new Set(['entry.delete', 'note.delete', 'attachment.delete']);

/** A picture waiting: what it is, and its bytes (already shrunk on the device). */
export interface PictureItem { meta: { mime: string } & Record<string, unknown>; bytes: ArrayBuffer }

/** One item to the server, sent for its author: if the device's cookie belongs to somebody else by now, the server refuses it
    (other_user) and it waits – never goes as another account's (independent review of CLIENT-1). A picture first says what it
    is, then sends its bytes. */
async function send(i: OutboxItem): Promise<void> {
  const as = i.userId;
  if (i.op === 'attachment.put') {
    const b = i.body as PictureItem;
    await api(pathOf(i), { method: 'PUT', body: b.meta, as });
    await apiBytes(`${pathOf(i)}/file`, b.bytes, b.meta.mime, as);
    return;
  }
  await api(pathOf(i), DELETES.has(i.op) ? { method: 'DELETE', as } : { method: 'PUT', body: i.body, as });
}

let flushing: Promise<number> | null = null;
let queued: Promise<number> | null = null;

/** Sends what waits, oldest first; stops when the server does not answer. Returns how many went.
    Called while a round runs, it waits for that one and runs once more – what was queued meanwhile goes too. */
export function flushOutbox(userId: string): Promise<number> {
  if (flushing) {
    queued ??= flushing.then(() => { queued = null; return flushOutbox(userId); });
    return queued;
  }
  flushing = (async () => {
    let sent = 0;
    try {
      const items = (await db.outbox.orderBy('at').toArray()).filter((i) => i.userId === userId && !i.refused);
      for (const i of items) {
        try {
          await send(i);
          await db.outbox.delete(i.key);
          sent++;
        } catch (e) {
          // not there, the device belongs to another account now, or its author was signed out elsewhere: it waits for its author
          if (e instanceof ApiError && (e.unreachable || e.code === 'other_user' || e.code === 'sign_in')) break;
          // refused for good (the battle closed, a check failed): kept and shown, not sent again
          await db.outbox.update(i.key, { refused: errorText(e) });
        }
      }
    } finally {
      flushing = null;
    }
    return sent;
  })();
  return flushing;
}

export const countOutbox = (userId: string) => db.outbox.filter((i) => i.userId === userId).count();

/** What still waits for this battle, live. */
export function useOutbox(battleId: string, userId: string): OutboxItem[] {
  // filtered after the query, not in it: a plain range query is one Dexie updates at once, without a new round (no flicker)
  return useLiveQuery(() => db.outbox.where('battleId').equals(battleId).sortBy('at').then((all) => all.filter((i) => i.userId === userId)), [battleId, userId]) ?? [];
}

/** The notes of a campaign that still wait, live. */
export function useNoteOutbox(campaignId: string, userId: string): OutboxItem[] {
  return useLiveQuery(() => db.outbox.filter((i) => i.userId === userId && i.campaignId === campaignId && (i.op === 'note.put' || i.op === 'note.delete')).sortBy('at'), [campaignId, userId]) ?? [];
}

/** The pictures of a campaign that still wait, live. */
export function usePictureOutbox(campaignId: string, userId: string): OutboxItem[] {
  return useLiveQuery(() => db.outbox.filter((i) => i.userId === userId && i.campaignId === campaignId && (i.op === 'attachment.put' || i.op === 'attachment.delete')).sortBy('at'), [campaignId, userId]) ?? [];
}
