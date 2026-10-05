/* A warband changed on another device and here (phase 3h): nothing is
   overwritten until the player says which to keep (ADR 0003). */
import type { GameData } from '@mordheim/core';
import { api } from '../account/api.ts';
import { db, type StoredWarband } from '../db/db.ts';
import { readSave } from './engine.ts';
import { requestSync } from './runner.ts';

const stampAfter = (prev: string) => new Date(Math.max(Date.now(), Date.parse(prev) + 1)).toISOString();

/** What the conflict says, for the banner on the roster. */
export function conflictText(w: StoredWarband): string {
  const c = w.conflict;
  if (!c) return '';
  if (c.kind === 'draft') return `Changed on another device as well (${c.draft.device || 'another device'}). Which one do you keep?`;
  if (c.kind === 'behind') return 'A newer version was saved on another device while this one had changes. Which one do you keep?';
  return 'Removed on another device while this one had changes. Keep it?';
}

/** The other device's state wins; this device's changes go. */
export async function takeTheirs(data: GameData, w: StoredWarband): Promise<void> {
  const c = w.conflict;
  if (!c) return;
  if (c.kind === 'removed') { await db.warbands.delete(w.id); return; }
  const raw = c.kind === 'draft' ? c.draft.data : c.data;
  const state = readSave(data, raw);
  if (!state) throw new Error('The other state could not be read.');
  const stamp = stampAfter(w.updatedAt);
  const wb = data.WARBANDS[state.wb as string];
  await db.warbands.update(w.id, {
    state, name: state.name || wb?.name || 'Warband', updatedAt: stamp, syncedAt: stamp, conflict: undefined,
    ...(c.kind === 'draft' ? { draftSeq: c.draft.seq } : { serverRev: c.headRev, draftSeq: null }),
  });
  requestSync(0);
}

/** This device's state wins: it is sent on top of the other (which stays in the history). */
export async function keepMine(w: StoredWarband): Promise<void> {
  const c = w.conflict;
  if (!c) return;
  if (c.kind === 'removed') await api(`/warbands/${w.id}/unarchive`, { body: {} });
  await db.warbands.update(w.id, {
    conflict: undefined,
    ...(c.kind === 'draft' ? { draftSeq: c.draft.seq } : c.kind === 'behind' ? { serverRev: c.headRev } : {}),
  });
  requestSync(0);
}
