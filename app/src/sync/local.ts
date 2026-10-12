/* What the screens do to warbands with the server in mind (phase 3h): whose
   a new warband is, removing with Undo, the device's own warbands into the
   account, and which warbands a list shows. Light: no rules data. */
import { useLiveQuery } from 'dexie-react-hooks';
import { getSession, knownUser, useSession } from '../account/session.ts';
import { db, type StoredWarband } from '../db/db.ts';
import { FLAVOUR } from '../flavour.ts';
import { requestSync } from './runner.ts';

/** The signed-in user's id – also while the server is out of reach, or not asked yet – or undefined. */
export function currentUserId(): string | undefined {
  if (FLAVOUR !== 'campaign') return undefined;
  const s = getSession();
  return s.status === 'in' ? s.user.id : s.status === 'unreachable' ? (s.user?.id ?? undefined) : s.status === 'loading' ? (knownUser()?.id ?? undefined) : undefined;
}

/** What a new warband carries: its owner, when someone is signed in. */
export function newOwnership(origin: 'save' | 'import' | 'copy', copiedFrom?: { id: string; rev: number }): Partial<StoredWarband> {
  const ownerId = currentUserId();
  return ownerId ? { ownerId, origin, ...(copiedFrom ? { copiedFrom } : {}) } : {};
}

/** A list shows what is not removed, and not another account's (a shared device) – signed out, only the device's own
    warbands: an account's warband is its owner's to read and change (security review CLIENT-2). */
export function shown(w: StoredWarband, me: string | undefined): boolean {
  return !w.removedAt && (!w.ownerId || w.ownerId === me);
}

/** The account the lists are for: signed in, out of reach, or not asked yet (the last one known here). */
function useMe(): string | undefined {
  const session = useSession();
  if (FLAVOUR !== 'campaign') return undefined;
  return session.status === 'in' ? session.user.id : session.status === 'unreachable' ? session.user?.id : session.status === 'loading' ? knownUser()?.id : undefined;
}

/** One warband of the device, for a screen: null when it is not there – or not this account's to open. */
export function useWarbandRecord(id: string): StoredWarband | null | undefined {
  const me = useMe();
  return useLiveQuery(async () => {
    const w = await db.warbands.get(id);
    return w && (!w.ownerId || w.ownerId === me) ? w : null;
  }, [id, me]);
}

export function useWarbands(limit?: number): StoredWarband[] | undefined {
  const me = useMe();
  return useLiveQuery(async () => {
    const all = await db.warbands.orderBy('updatedAt').reverse().toArray();
    const list = all.filter((w) => shown(w, me));
    return limit ? list.slice(0, limit) : list;
  }, [me, limit]);
}

/** Removes a warband: from the device at once if the server never had it, otherwise marked until Undo has had its time. */
export async function removeWarband(rec: StoredWarband): Promise<void> {
  if (rec.serverRev === undefined) await db.warbands.delete(rec.id);
  else { await db.warbands.update(rec.id, { removedAt: new Date().toISOString() }); requestSync(8000); }
}

/** Undo of a removal. */
export async function restoreWarband(rec: StoredWarband): Promise<void> {
  const there = await db.warbands.get(rec.id);
  if (there) await db.warbands.update(rec.id, { removedAt: undefined });
  else await db.warbands.add({ ...rec, removedAt: undefined });
  requestSync();
}

/** The device's own warbands (made while nobody was signed in) into the account. */
export async function keepInAccount(ids: string[]): Promise<number> {
  const me = currentUserId();
  if (!me) return 0;
  let n = 0;
  await db.transaction('rw', db.warbands, async () => {
    for (const id of ids) {
      const w = await db.warbands.get(id);
      if (!w || w.ownerId) continue;
      await db.warbands.update(id, { ownerId: me, origin: w.origin ?? 'save', serverRev: undefined, syncedAt: undefined });
      n++;
    }
  });
  requestSync(0);
  return n;
}
