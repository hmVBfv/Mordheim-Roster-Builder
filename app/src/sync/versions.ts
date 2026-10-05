/* Versions of a warband on the campaign server (phase 3h; ADR 0003): made
   on purpose – "Save a version" – never by the sync; an older one can
   become the newest again (a new version, nothing is rewritten) or the
   start of a copy. A copy (concept.md 4.1) is a new warband of its own that
   remembers where it came from: the blueprint for a campaign start. */
import * as core from '@mordheim/core';
import type { GameData, WarbandState } from '@mordheim/core';
import { api, ApiError } from '../account/api.ts';
import { db, type StoredWarband } from '../db/db.ts';
import { newId } from '../db/ids.ts';
import { readSave, writeSave } from './engine.ts';
import { newOwnership } from './local.ts';
import { requestSync } from './runner.ts';

export interface VersionInfo { rev: number; format: number; appVersion: string; source: 'save' | 'import' | 'copy' | 'restore' | 'migration'; createdBy: string | null; createdAt: string; note: string; bytes: number }

const stampAfter = (prev: string) => new Date(Math.max(Date.now(), Date.parse(prev) + 1)).toISOString();

/** The warband with a state from the server, as the device keeps it. */
function adopt(data: GameData, rec: StoredWarband, state: WarbandState, rev: number): Partial<StoredWarband> {
  const stamp = stampAfter(rec.updatedAt);
  const wb = data.WARBANDS[state.wb as string];
  return { state, name: state.name || wb?.name || 'Warband', wb: state.wb as string, wbName: wb?.name ?? rec.wbName, updatedAt: stamp, syncedAt: stamp, serverRev: rev, draftSeq: null, conflict: undefined };
}

export const listVersions = (id: string) => api<{ versions: VersionInfo[] }>(`/warbands/${id}/versions`).then((r) => r.versions);

export type SaveOutcome = { ok: true; rev: number } | { ok: false; headRev: number };

/** "Save a version": the state as it is now, on top of the version it builds on. */
export async function saveVersion(data: GameData, rec: StoredWarband, note: string, source: 'save' | 'import' = 'save'): Promise<SaveOutcome> {
  if (rec.serverRev === undefined) throw new Error('This warband is not on the server yet.');
  const sent = rec.updatedAt;
  try {
    const r = await api<{ rev: number }>(`/warbands/${rec.id}/versions`, { body: { baseRev: rec.serverRev, data: writeSave(data, rec, __APP_VERSION__), source, note: note.trim(), appVersion: __APP_VERSION__ } });
    // the draft is the version now; a change made meanwhile still waits
    await db.warbands.update(rec.id, { serverRev: r.rev, draftSeq: null, ...((await db.warbands.get(rec.id))?.updatedAt === sent ? { syncedAt: sent } : {}) });
    return { ok: true, rev: r.rev };
  } catch (e) {
    if (e instanceof ApiError && e.code === 'stale') return { ok: false, headRev: Number(e.body?.headRev) };
    throw e;
  }
}

/** Takes the server's newest version (this device's changes go). */
export async function loadNewest(data: GameData, rec: StoredWarband): Promise<void> {
  const r = await api<{ head: { rev: number; data: unknown } }>(`/warbands/${rec.id}`);
  const state = readSave(data, r.head.data);
  if (!state) throw new Error('The newest version could not be read.');
  await db.warbands.update(rec.id, adopt(data, rec, state, r.head.rev));
}

/** An older version becomes the newest – as a new version; the history stays as it was. */
export async function restoreVersion(data: GameData, rec: StoredWarband, rev: number): Promise<SaveOutcome> {
  const v = (await api<{ version: { data: unknown } }>(`/warbands/${rec.id}/versions/${rev}`)).version;
  const state = readSave(data, v.data);
  if (!state) throw new Error('That version could not be read.');
  try {
    const r = await api<{ rev: number }>(`/warbands/${rec.id}/versions`, { body: { baseRev: rec.serverRev, data: core.writeSave(core.ctxOf(data, state), __APP_VERSION__), source: 'restore', note: `back to version ${rev}`, appVersion: __APP_VERSION__ } });
    await db.warbands.update(rec.id, adopt(data, rec, state, r.rev));
    return { ok: true, rev: r.rev };
  } catch (e) {
    if (e instanceof ApiError && e.code === 'stale') return { ok: false, headRev: Number(e.body?.headRev) };
    throw e;
  }
}

/** A version as a warband state (for a copy of it). */
export async function versionState(data: GameData, id: string, rev: number): Promise<WarbandState> {
  const v = (await api<{ version: { data: unknown } }>(`/warbands/${id}/versions/${rev}`)).version;
  const state = readSave(data, v.data);
  if (!state) throw new Error('That version could not be read.');
  return state;
}

/** A new warband from this one (or one of its versions): the blueprint's copy. Works offline and without an account. */
export async function makeCopy(rec: StoredWarband, state: WarbandState = rec.state, rev?: number, now = new Date()): Promise<string> {
  const id = newId();
  const name = `${state.name || rec.name} (copy)`.slice(0, 80);
  const from = rec.serverRev !== undefined ? { id: rec.id, rev: rev ?? rec.serverRev } : undefined;
  const stamp = now.toISOString();
  await db.warbands.add({
    id, name, wb: rec.wb, wbName: rec.wbName, state: { ...structuredClone(state), name }, format: core.FORMAT,
    createdAt: stamp, updatedAt: stamp, ...newOwnership('copy', from),
  });
  requestSync();
  return id;
}

/** A save from elsewhere (the Quick Build) as the next version of a warband of the account. */
export async function importAsVersion(data: GameData, rec: StoredWarband, state: WarbandState): Promise<SaveOutcome> {
  if (rec.serverRev === undefined) {
    // only on this device: the state is simply replaced
    const stamp = stampAfter(rec.updatedAt);
    const wb = data.WARBANDS[state.wb as string];
    await db.warbands.update(rec.id, { state, name: state.name || wb?.name || rec.name, updatedAt: stamp });
    requestSync();
    return { ok: true, rev: 0 };
  }
  try {
    const r = await api<{ rev: number }>(`/warbands/${rec.id}/versions`, { body: { baseRev: rec.serverRev, data: core.writeSave(core.ctxOf(data, state), __APP_VERSION__), source: 'import', note: 'from the Quick Build', appVersion: __APP_VERSION__ } });
    await db.warbands.update(rec.id, adopt(data, rec, state, r.rev));
    return { ok: true, rev: r.rev };
  } catch (e) {
    if (e instanceof ApiError && e.code === 'stale') return { ok: false, headRev: Number(e.body?.headRev) };
    throw e;
  }
}
