/* What still waits for the server, counted on the device (light: no rules
   data), so the header can say so even when the server does not answer. */
import { db, type StoredWarband } from '../db/db.ts';

export const isDirty = (w: StoredWarband) => !w.syncedAt || w.updatedAt > w.syncedAt;
export const isWaiting = (w: StoredWarband) => !!w.removedAt || w.serverRev === undefined || !!w.restore || isDirty(w);

/** Warbands waiting, and what the game night gathered (phase 4a2) – one count for the header. */
export async function countPending(userId: string): Promise<{ waiting: number; conflicts: number }> {
  const mine = await db.warbands.filter((w) => w.ownerId === userId).toArray();
  const gathered = await db.outbox.filter((i) => i.userId === userId && !i.refused).count();
  return { waiting: mine.filter(isWaiting).length + gathered, conflicts: mine.filter((w) => w.conflict).length };
}
