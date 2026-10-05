/* Sending a copy and taking one (Rob, 05.10.2026): the save as the app
   writes it to a file goes up; a copy taken is kept on this device at once. */
import * as core from '@mordheim/core';
import type { GameData, WarbandState } from '@mordheim/core';
import { api } from '../account/api.ts';
import { db } from '../db/db.ts';
import { newId } from '../db/ids.ts';
import { readSave } from '../sync/engine.ts';
import { currentUserId } from '../sync/local.ts';
import type { Taken } from './shares.ts';

const saveOf = (data: GameData, state: WarbandState) => core.writeSave(core.ctxOf(data, state), __APP_VERSION__);

export function sendCopy(data: GameData, state: WarbandState, to: string, warbandId?: string) {
  return api<{ id: string }>('/shares', { body: { data: saveOf(data, state), to, ...(warbandId ? { warbandId } : {}) } });
}

export function makeCode(data: GameData, state: WarbandState, warbandId?: string) {
  return api<{ id: string; code: string; expiresAt: string }>('/shares', { body: { data: saveOf(data, state), ...(warbandId ? { warbandId } : {}) } });
}

/** The copy, kept on this device at once (the sync would bring it a moment later). */
async function keep(data: GameData, t: Taken): Promise<string> {
  const state = readSave(data, t.head.data);
  if (!state) throw new Error('The shared warband could not be read.');
  const wb = data.WARBANDS[state.wb as string];
  const stamp = new Date().toISOString();
  await db.warbands.put({
    id: t.warband.id, name: state.name || wb?.name || 'Warband', wb: state.wb as string, wbName: wb?.name ?? String(state.wb),
    state, format: core.FORMAT, createdAt: t.warband.createdAt, updatedAt: stamp, syncedAt: stamp,
    ownerId: currentUserId(), serverRev: t.head.rev, draftSeq: null, origin: 'import',
  });
  return t.warband.id;
}

export async function redeemCode(data: GameData, code: string): Promise<string> {
  return keep(data, await api<Taken>('/shares/redeem', { body: { code, warbandId: newId() } }));
}

export async function acceptShare(data: GameData, id: string): Promise<string> {
  return keep(data, await api<Taken>(`/shares/${id}/accept`, { body: { warbandId: newId() } }));
}
