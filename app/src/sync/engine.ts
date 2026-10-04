/* The sync of warbands between this device and the campaign server (phase
   3h; docs/architecture.md section 6). Local first: the screens work on the
   device's store; a round of sync first takes what changed on the server
   since the cursor, then sends what waits here. What waits is marked on the
   record itself (db.ts: serverRev, syncedAt, removedAt), so a closed tab or
   a night offline loses nothing.

   - New here → POST /warbands (the device's id; sent twice it is made once).
   - Changed here → the draft (PUT …/autosave). A version is made on purpose
     (the Versions screen), never by the sync.
   - Removed here → after Undo has had its time, DELETE /warbands/:id.
   - Changed there and here → nothing is overwritten: the record gets a
     conflict, and the player decides (conflict.ts).
   - A new epoch (the server was restored from a backup) → everything anew
     from cursor 0; what the server lost and this device still has goes back
     (a new warband, or a version on top of the restored one). */
import * as core from '@mordheim/core';
import type { GameData, WarbandState } from '@mordheim/core';
import { api, ApiError } from '../account/api.ts';
import { db, type StoredWarband } from '../db/db.ts';
import { UNDO_MS } from '../ui/UndoToast.tsx';
import { countPending, isDirty } from './pending.ts';

export interface ServerVersion { rev: number; data: unknown; createdAt: string }
export interface ServerDraft { baseRev: number; data: unknown; device: string; updatedAt: string; seq: number }
export interface ServerWarband {
  id: string; name: string; wbType: string; headRev: number; createdAt: string; updatedAt: string; archivedAt: string | null;
  copiedFrom: { id: string; rev: number } | null;
  head: ServerVersion | null; draft: ServerDraft | null;
}
interface SyncAnswer { epoch: string | null; cursor: number; warbands: ServerWarband[] }
interface SyncMeta { epoch: string | null; cursor: number }

export interface SyncDeps {
  userId: string;
  data: () => Promise<GameData>;
  now?: () => Date;
  appVersion?: string;
  device?: string;
  /** How long a removal waits for its Undo. */
  undoMs?: number;
}

export interface SyncResult {
  /** Records changed from the server. */
  pulled: number;
  /** Requests that sent something. */
  pushed: number;
  /** Still to send (the server did not answer, or a conflict holds it). */
  waiting: number;
  conflicts: number;
  /** The server was restored: this round started over. */
  restored: boolean;
}

export const metaKey = (userId: string) => `sync:${userId}`;
export { isDirty };

/** A stamp later than `prev` (the editor shows the newer of two states). */
function stampAfter(prev: string | undefined, now: Date): string {
  return new Date(Math.max(now.getTime(), (prev ? Date.parse(prev) : 0) + 1)).toISOString();
}

/** A save from the server, as this device keeps it. */
export function readSave(data: GameData, raw: unknown): WarbandState | null {
  const r = core.loadSave(data, raw);
  return r.ok ? r.state : null;
}

/** What goes to the server: the save as the app writes it to a file. */
export const writeSave = (data: GameData, w: StoredWarband, appVersion?: string) => core.writeSave(core.ctxOf(data, w.state), appVersion);

/** The fields of a record that carry a state from the server. */
function fromServer(data: GameData, state: WarbandState, stamp: string): Pick<StoredWarband, 'state' | 'name' | 'wb' | 'wbName' | 'updatedAt' | 'syncedAt'> {
  const wb = data.WARBANDS[state.wb as string];
  return { state, name: state.name || wb?.name || 'Warband', wb: state.wb as string, wbName: wb?.name ?? String(state.wb), updatedAt: stamp, syncedAt: stamp };
}

async function applyRemote(deps: SyncDeps, data: GameData, w: ServerWarband, now: Date): Promise<boolean> {
  return db.transaction('rw', db.warbands, async () => {
    const local = await db.warbands.get(w.id);
    if (local && local.ownerId !== deps.userId) return false;
    if (w.archivedAt || !w.head) {
      if (!local || local.removedAt) return false;
      // removed elsewhere while this device has changes: the player decides
      if (isDirty(local)) { await db.warbands.update(w.id, { conflict: { kind: 'removed' } }); return true; }
      await db.warbands.delete(w.id);
      return true;
    }
    const head = w.head;
    // a draft on an older version is someone's stale work; the version is newer
    const draft = w.draft && w.draft.baseRev === head.rev ? w.draft : null;
    const remote = draft ? draft.data : head.data;
    const seq = w.draft?.seq ?? null;
    if (!local) {
      const state = readSave(data, remote);
      if (!state) return false;
      const stamp = stampAfter(draft?.updatedAt ?? head.createdAt, new Date(0));
      await db.warbands.add({
        id: w.id, ...fromServer(data, state, stamp), format: core.FORMAT, createdAt: w.createdAt,
        ownerId: deps.userId, serverRev: head.rev, draftSeq: seq, origin: 'save',
        ...(w.copiedFrom ? { copiedFrom: w.copiedFrom } : {}),
      });
      return true;
    }
    if (local.removedAt || local.conflict) return false;
    if (local.serverRev === undefined) {
      // made here and there under one id (a send whose answer was lost): build on the server's
      await db.warbands.update(w.id, { serverRev: head.rev, draftSeq: seq });
      return true;
    }
    if (head.rev < local.serverRev) {
      // the server was restored to an older state: this device is ahead and sends its own back
      await db.warbands.update(w.id, { serverRev: head.rev, restore: true, syncedAt: undefined });
      return true;
    }
    if (!isDirty(local)) {
      if (head.rev === local.serverRev && seq === (local.draftSeq ?? null)) return false;
      const state = readSave(data, remote);
      if (!state) return false;
      await db.warbands.update(w.id, { ...fromServer(data, state, stampAfter(local.updatedAt, now)), serverRev: head.rev, draftSeq: seq });
      return true;
    }
    if (head.rev > local.serverRev) {
      // a newer version was saved elsewhere while this device has changes
      await db.warbands.update(w.id, { conflict: { kind: 'behind', headRev: head.rev, data: head.data } });
      return true;
    }
    // a newer draft from another device: sending ours will meet it (draft_conflict)
    return false;
  });
}

async function push(deps: SyncDeps, data: GameData, now: Date): Promise<number> {
  const undoMs = deps.undoMs ?? UNDO_MS + 1000;
  const mine = await db.warbands.filter((w) => w.ownerId === deps.userId).toArray();
  let pushed = 0;
  for (const w of mine) {
    if (w.conflict) continue;
    try {
      if (w.removedAt) {
        if (now.getTime() - Date.parse(w.removedAt) < undoMs) continue;
        if (w.serverRev !== undefined) {
          await api(`/warbands/${w.id}`, { method: 'DELETE' }).catch((e: unknown) => { if (!(e instanceof ApiError && e.status === 404)) throw e; });
          pushed++;
        }
        await db.warbands.delete(w.id);
        continue;
      }
      if (w.serverRev === undefined) {
        const sent = w.updatedAt;
        try {
          await api('/warbands', { body: { id: w.id, data: writeSave(data, w, deps.appVersion), source: w.origin ?? 'save', ...(w.origin === 'copy' && w.copiedFrom ? { copiedFrom: w.copiedFrom } : {}), appVersion: deps.appVersion ?? '' } });
          await db.warbands.update(w.id, { serverRev: 1, syncedAt: sent, draftSeq: null });
        } catch (e) {
          if (!(e instanceof ApiError && e.code === 'exists')) throw e;
          // the id is taken – by this account (the server knows it already) or by nobody we may see
          const there = await api<{ warband: { headRev: number } }>(`/warbands/${w.id}`).catch(() => null);
          if (there) await db.warbands.update(w.id, { serverRev: there.warband.headRev });
          else await db.transaction('rw', db.warbands, async () => { await db.warbands.delete(w.id); await db.warbands.add({ ...w, id: crypto.randomUUID() }); });
        }
        pushed++;
        continue;
      }
      if (w.restore) {
        const sent = w.updatedAt;
        const r = await api<{ rev: number }>(`/warbands/${w.id}/versions`, { body: { baseRev: w.serverRev, data: writeSave(data, w, deps.appVersion), source: 'restore', note: 'from a device, after the server was restored', appVersion: deps.appVersion ?? '' } });
        await db.warbands.update(w.id, { serverRev: r.rev, restore: undefined, syncedAt: sent, draftSeq: null });
        pushed++;
        continue;
      }
      if (isDirty(w)) {
        const sent = w.updatedAt;
        try {
          const r = await api<{ seq: number }>(`/warbands/${w.id}/autosave`, { method: 'PUT', body: { baseRev: w.serverRev, data: writeSave(data, w, deps.appVersion), device: deps.device ?? '', afterSeq: w.draftSeq ?? null } });
          await db.warbands.update(w.id, { syncedAt: sent, draftSeq: r.seq });
        } catch (e) {
          if (!(e instanceof ApiError) || e.unreachable) throw e;
          if (e.code === 'draft_conflict') {
            const draft = (e.body as { draft: ServerDraft }).draft;
            await db.warbands.update(w.id, { conflict: { kind: 'draft', draft } });
          } else if (e.code === 'archived') {
            await db.warbands.update(w.id, { conflict: { kind: 'removed' } });
          } else if (e.status === 404) {
            // gone from the account: it stays on this device
            await db.warbands.update(w.id, { ownerId: undefined, serverRev: undefined, syncedAt: undefined, draftSeq: undefined });
          } else throw e;
        }
        pushed++;
      }
    } catch (e) {
      // no server: the rest waits as well; anything else is this warband's problem only
      if (e instanceof ApiError && e.unreachable) break;
      console.error('sync: could not send', w.id, e);
    }
  }
  return pushed;
}

/** One round: take, then send. Throws ApiError when the server cannot be reached. */
export async function syncOnce(deps: SyncDeps): Promise<SyncResult> {
  const now = deps.now ?? (() => new Date());
  const key = metaKey(deps.userId);
  const meta = (await db.meta.get(key))?.value as SyncMeta | undefined;
  let answer = await api<SyncAnswer>(`/sync?cursor=${meta?.cursor ?? 0}`);
  const restored = !!meta?.epoch && answer.epoch !== meta.epoch;
  if (restored && meta!.cursor > 0) answer = await api<SyncAnswer>('/sync?cursor=0');
  const mine = await db.warbands.filter((w) => w.ownerId === deps.userId).toArray();
  const data = answer.warbands.length || mine.length ? await deps.data() : null;
  let pulled = 0;
  if (data) for (const w of answer.warbands) if (await applyRemote(deps, data, w, now())) pulled++;
  if (restored) {
    // what the restored server does not know at all goes back as new
    const known = new Set(answer.warbands.map((w) => w.id));
    for (const w of mine) if (w.serverRev !== undefined && !known.has(w.id) && !w.removedAt) await db.warbands.update(w.id, { serverRev: undefined, syncedAt: undefined, draftSeq: null });
  }
  await db.meta.put({ key, value: { epoch: answer.epoch, cursor: answer.cursor } satisfies SyncMeta });
  const pushed = data ? await push(deps, data, now()) : 0;
  return { pulled, pushed, restored, ...(await countPending(deps.userId)) };
}
