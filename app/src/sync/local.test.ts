/* What the screens do with the server in mind: whose a new warband is,
   what a list shows, removing with Undo, the device's warbands into the
   account, and what the header says. */
import { FORMAT } from '@mordheim/core';
import { afterEach, describe, expect, it } from 'vitest';
import { resetSession, signedIn, signedOut } from '../account/session.ts';
import { ME as KAI } from '../account/testServer.ts';
import { syncWords } from '../app/SyncState.tsx';
import { db, type StoredWarband } from '../db/db.ts';
import { sampleSave } from '../test/data.ts';
import { keepInAccount, newOwnership, removeWarband, restoreWarband, shown } from './local.ts';

const rec = (over: Partial<StoredWarband> = {}): StoredWarband => {
  const s = sampleSave();
  return { id: crypto.randomUUID(), name: 'W', wb: s.wb as string, wbName: 'Mercenaries', state: s, format: FORMAT, createdAt: '2026-10-04T10:00:00Z', updatedAt: '2026-10-04T10:00:00Z', ...over };
};

afterEach(async () => { resetSession(); localStorage.clear(); await db.warbands.clear(); });

describe('whose a warband is', () => {
  it('a new one belongs to the signed-in user; without one it stays on the device', () => {
    expect(newOwnership('save')).toEqual({});
    signedIn({ stage: 'full', user: KAI });
    expect(newOwnership('import')).toEqual({ ownerId: KAI.id, origin: 'import' });
    expect(newOwnership('copy', { id: 'w1', rev: 3 })).toEqual({ ownerId: KAI.id, origin: 'copy', copiedFrom: { id: 'w1', rev: 3 } });
    signedOut();
    expect(newOwnership('save')).toEqual({});
  });

  it('a list shows the device’s own and the user’s – not removed ones, not another account’s', () => {
    expect(shown(rec(), KAI.id)).toBe(true);
    expect(shown(rec({ ownerId: KAI.id }), KAI.id)).toBe(true);
    expect(shown(rec({ ownerId: 'ben' }), KAI.id)).toBe(false);
    expect(shown(rec({ ownerId: 'ben' }), undefined)).toBe(true);
    expect(shown(rec({ removedAt: '2026-10-04T10:00:00Z' }), undefined)).toBe(false);
  });
});

describe('removing with Undo', () => {
  it('a warband the server never had goes at once; one it has is marked until the sync tells the server', async () => {
    const local = rec();
    const synced = rec({ ownerId: KAI.id, serverRev: 2 });
    await db.warbands.bulkAdd([local, synced]);
    await removeWarband(local);
    await removeWarband(synced);
    expect(await db.warbands.get(local.id)).toBeUndefined();
    expect((await db.warbands.get(synced.id))!.removedAt).toBeTruthy();
    await restoreWarband(local);
    await restoreWarband(synced);
    expect(await db.warbands.get(local.id)).toBeTruthy();
    expect((await db.warbands.get(synced.id))!.removedAt).toBeUndefined();
  });
});

describe('into the account', () => {
  it('the device’s own warbands join the account; another account’s stay as they are', async () => {
    signedIn({ stage: 'full', user: KAI });
    const mine = rec();
    const bens = rec({ ownerId: 'ben' });
    await db.warbands.bulkAdd([mine, bens]);
    expect(await keepInAccount([mine.id, bens.id])).toBe(1);
    expect(await db.warbands.get(mine.id)).toMatchObject({ ownerId: KAI.id, origin: 'save' });
    expect((await db.warbands.get(bens.id))!.ownerId).toBe('ben');
  });
});

describe('the header', () => {
  it('says where the data stands', () => {
    expect(syncWords({ state: 'off' }, true)).toMatchObject({ word: 'Saved', more: ' on this device', title: 'Saved on this device' });
    expect(syncWords({ state: 'idle', waiting: 0, conflicts: 0, at: '' }, true)).toMatchObject({ mark: '✓', more: ' and synced' });
    expect(syncWords({ state: 'idle', waiting: 2, conflicts: 0, at: '' }, true).word).toBe('2 waiting');
    expect(syncWords({ state: 'idle', waiting: 0, conflicts: 1, at: '' }, true)).toMatchObject({ mark: '!', word: 'Check', bad: true });
    expect(syncWords({ state: 'offline', waiting: 3, conflicts: 0 }, false)).toMatchObject({ word: '3 waiting', bad: true });
    expect(syncWords({ state: 'error', waiting: 0, conflicts: 0, message: 'boom' }, true).title).toMatch(/boom/);
  });
});
