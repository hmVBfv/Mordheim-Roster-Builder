/* What the game night gathered and still has to send (phase 4a2): protocol
   entries, their removals, corrections. Kept on the device first, so a
   battle at a table without a connection loses nothing (concept.md 4.5),
   and sent in order once the server answers – by the game night itself and
   by every round of the sync. Each carries the id the server keeps it
   under: sent twice, it is there once. */
import { useLiveQuery } from 'dexie-react-hooks';
import { api, ApiError, errorText } from '../account/api.ts';
import { db, type OutboxItem } from '../db/db.ts';

export async function enqueue(item: Omit<OutboxItem, 'at'>): Promise<void> {
  await db.outbox.put({ ...item, at: new Date().toISOString() });
}

const pathOf = (i: OutboxItem) => {
  const base = `/campaigns/${i.campaignId}/battles/${i.battleId}`;
  return i.op === 'proposal.put' ? `${base}/proposals/${i.targetId}` : `${base}/protocol/${i.targetId}`;
};

let flushing: Promise<number> | null = null;

/** Sends what waits, oldest first; stops when the server does not answer. Returns how many went. */
export function flushOutbox(userId: string): Promise<number> {
  flushing ??= (async () => {
    let sent = 0;
    try {
      const items = (await db.outbox.orderBy('at').toArray()).filter((i) => i.userId === userId && !i.refused);
      for (const i of items) {
        try {
          await api(pathOf(i), i.op === 'entry.delete' ? { method: 'DELETE' } : { method: 'PUT', body: i.body });
          await db.outbox.delete(i.key);
          sent++;
        } catch (e) {
          if (e instanceof ApiError && e.unreachable) break;
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
export function useOutbox(battleId: string): OutboxItem[] {
  return useLiveQuery(() => db.outbox.where('battleId').equals(battleId).sortBy('at'), [battleId]) ?? [];
}
