/* The sync between this device and the campaign server (phase 3h), against
   a stand-in server with the real one's rules: new warbands go up once,
   changes go as the draft, the other devices' changes come down, nothing is
   overwritten when both changed, removals wait for Undo, offline nothing is
   lost, and after a restore of the server this device gives back what it
   has. */
import { FORMAT, writeSave, ctxOf } from '@mordheim/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, type StoredWarband } from '../db/db.ts';
import { data, sampleSave } from '../test/data.ts';
import { keepMine, takeTheirs } from './conflict.ts';
import { isDirty, syncOnce, type SyncDeps } from './engine.ts';
import { fakeSyncServer } from './fakeServer.ts';
import { ApiError } from '../account/api.ts';

const ME = 'user-kai';
const deps = (over: Partial<SyncDeps> = {}): SyncDeps => ({ userId: ME, data: async () => data, appVersion: 'test', device: 'Phone', undoMs: 0, ...over });
const T0 = '2026-10-04T10:00:00.000Z';

function record(over: Partial<StoredWarband> = {}): StoredWarband {
  const s = sampleSave();
  return { id: crypto.randomUUID(), name: s.name!, wb: s.wb as string, wbName: 'Mercenaries', state: s, format: FORMAT, createdAt: T0, updatedAt: T0, ownerId: ME, origin: 'save', ...over };
}
/** An edit on this device, as the editor makes it. */
async function edit(id: string, name: string) {
  const w = (await db.warbands.get(id))!;
  await db.warbands.update(id, { state: { ...w.state, name }, name, updatedAt: new Date(Date.parse(w.updatedAt) + 1000).toISOString() });
}
const saveOf = (name: string) => writeSave(ctxOf(data, { ...sampleSave(), name }));

beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); });
afterEach(async () => { await db.warbands.clear(); await db.meta.clear(); });

describe('sending', () => {
  it('a new warband goes up once; then a change goes as the draft', async () => {
    const srv = fakeSyncServer();
    const w = record();
    await db.warbands.add(w);
    expect(await syncOnce(deps())).toMatchObject({ pushed: 1, waiting: 0, conflicts: 0 });
    expect(srv.state.warbands.get(w.id)).toMatchObject({ headRev: 1, versions: [{ source: 'save' }] });
    expect((await db.warbands.get(w.id))).toMatchObject({ serverRev: 1, syncedAt: T0 });
    expect(await syncOnce(deps())).toMatchObject({ pushed: 0 });

    await edit(w.id, 'Renamed here');
    expect(await syncOnce(deps())).toMatchObject({ pushed: 1, waiting: 0 });
    const there = srv.state.warbands.get(w.id)!;
    expect(there.headRev).toBe(1);
    expect(there.draft).toMatchObject({ baseRev: 1, device: 'Phone', data: { name: 'Renamed here' } });
    const local = (await db.warbands.get(w.id))!;
    expect(isDirty(local)).toBe(false);
    expect(local.draftSeq).toBe(there.draft!.seq);
  });

  it('only the signed-in user’s warbands; the device’s own and other accounts’ stay', async () => {
    const srv = fakeSyncServer();
    await db.warbands.bulkAdd([record({ id: crypto.randomUUID(), ownerId: undefined }), record({ id: crypto.randomUUID(), ownerId: 'user-ben' })]);
    await syncOnce(deps());
    expect(srv.state.warbands.size).toBe(0);
  });

  it('offline nothing is lost: the round fails, the change waits and goes later', async () => {
    const srv = fakeSyncServer();
    const w = record();
    await db.warbands.add(w);
    srv.state.down = true;
    const e = await syncOnce(deps()).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).unreachable).toBe(true);
    expect((await db.warbands.get(w.id))!.serverRev).toBeUndefined();
    srv.state.down = false;
    expect(await syncOnce(deps())).toMatchObject({ pushed: 1, waiting: 0 });
  });
});

describe('taking', () => {
  it('a new device takes the account’s warbands, the draft where there is one', async () => {
    const srv = fakeSyncServer();
    const id = crypto.randomUUID();
    srv.state.warbands.set(id, { id, headRev: 2, versions: [{ rev: 1, data: saveOf('First'), createdAt: T0, source: 'save' }, { rev: 2, data: saveOf('Second'), createdAt: T0, source: 'save' }], archivedAt: null, seq: 3, draft: { baseRev: 2, data: saveOf('Drafted'), device: 'Laptop', updatedAt: T0, seq: 4 }, copiedFrom: null, createdAt: T0 });
    srv.state.seq = 4;
    expect(await syncOnce(deps())).toMatchObject({ pulled: 1, pushed: 0, waiting: 0 });
    const local = (await db.warbands.get(id))!;
    expect(local).toMatchObject({ name: 'Drafted', ownerId: ME, serverRev: 2, draftSeq: 4, wbName: 'Mercenaries' });
    expect(local.state.models.length).toBeGreaterThan(0);
    expect(isDirty(local)).toBe(false);
  });

  it('a change on another device comes down where this one has none', async () => {
    const srv = fakeSyncServer();
    const w = record();
    await db.warbands.add(w);
    await syncOnce(deps());
    srv.draftElsewhere(w.id, saveOf('From the laptop'));
    expect(await syncOnce(deps())).toMatchObject({ pulled: 1 });
    expect((await db.warbands.get(w.id))!.name).toBe('From the laptop');
    srv.versionElsewhere(w.id, saveOf('Saved on the laptop'));
    await syncOnce(deps());
    expect((await db.warbands.get(w.id))).toMatchObject({ name: 'Saved on the laptop', serverRev: 2, draftSeq: null });
  });
});

describe('changed here and there: nothing is overwritten (ADR 0003)', () => {
  it('a draft of another device: the player keeps this one, or takes the other', async () => {
    const srv = fakeSyncServer();
    const w = record();
    await db.warbands.add(w);
    await syncOnce(deps());
    srv.draftElsewhere(w.id, saveOf('Laptop'));
    await edit(w.id, 'Phone');
    expect(await syncOnce(deps())).toMatchObject({ conflicts: 1 });
    let local = (await db.warbands.get(w.id))!;
    expect(local.conflict).toMatchObject({ kind: 'draft', draft: { device: 'Laptop' } });
    expect(local.name).toBe('Phone');
    expect(srv.state.warbands.get(w.id)!.draft!.data).toMatchObject({ name: 'Laptop' });
    // held: the next round sends nothing for it
    await syncOnce(deps());
    expect(srv.state.warbands.get(w.id)!.draft!.data).toMatchObject({ name: 'Laptop' });

    await keepMine(local);
    expect(await syncOnce(deps())).toMatchObject({ conflicts: 0, waiting: 0 });
    expect(srv.state.warbands.get(w.id)!.draft!.data).toMatchObject({ name: 'Phone' });

    srv.draftElsewhere(w.id, saveOf('Laptop again'));
    await edit(w.id, 'Phone again');
    await syncOnce(deps());
    local = (await db.warbands.get(w.id))!;
    await takeTheirs(data, local);
    local = (await db.warbands.get(w.id))!;
    expect(local.name).toBe('Laptop again');
    expect(local.conflict).toBeUndefined();
    expect(isDirty(local)).toBe(false);
  });

  it('a newer version elsewhere while this device has changes', async () => {
    const srv = fakeSyncServer();
    const w = record();
    await db.warbands.add(w);
    await syncOnce(deps());
    await edit(w.id, 'Mine');
    srv.versionElsewhere(w.id, saveOf('Theirs'));
    await syncOnce(deps());
    const local = (await db.warbands.get(w.id))!;
    expect(local.conflict).toMatchObject({ kind: 'behind', headRev: 2 });
    await keepMine(local);
    await syncOnce(deps());
    // the newer version stays; this device's state is the draft on top of it
    expect(srv.state.warbands.get(w.id)).toMatchObject({ headRev: 2, draft: { baseRev: 2, data: { name: 'Mine' } } });
  });
});

describe('removing', () => {
  it('waits for Undo, then the server learns it and the device forgets it', async () => {
    const srv = fakeSyncServer();
    const w = record();
    await db.warbands.add(w);
    await syncOnce(deps());
    await db.warbands.update(w.id, { removedAt: new Date().toISOString() });
    await syncOnce(deps({ undoMs: 60_000 }));
    expect(srv.state.warbands.get(w.id)!.archivedAt).toBeNull();
    expect(await db.warbands.get(w.id)).toBeTruthy();
    await syncOnce(deps({ undoMs: 0 }));
    expect(srv.state.warbands.get(w.id)!.archivedAt).not.toBeNull();
    expect(await db.warbands.get(w.id)).toBeUndefined();
  });

  it('removed on another device: gone here – unless this device has changes, then the player decides', async () => {
    const srv = fakeSyncServer();
    const a = record({ id: crypto.randomUUID() });
    const b = record({ id: crypto.randomUUID() });
    await db.warbands.bulkAdd([a, b]);
    await syncOnce(deps());
    for (const w of [a, b]) { const x = srv.state.warbands.get(w.id)!; x.archivedAt = T0; x.seq = ++srv.state.seq; }
    await edit(b.id, 'Still mine');
    await syncOnce(deps());
    expect(await db.warbands.get(a.id)).toBeUndefined();
    const kept = (await db.warbands.get(b.id))!;
    expect(kept.conflict).toEqual({ kind: 'removed' });
    await keepMine(kept);
    await syncOnce(deps());
    expect(srv.state.warbands.get(b.id)).toMatchObject({ archivedAt: null, draft: { data: { name: 'Still mine' } } });
  });
});

describe('after the server was restored from a backup (a new epoch)', () => {
  it('everything anew: what the server lost comes back from this device', async () => {
    const srv = fakeSyncServer();
    const lost = record({ id: crypto.randomUUID() });
    const older = record({ id: crypto.randomUUID() });
    await db.warbands.bulkAdd([lost, older]);
    await syncOnce(deps());
    srv.versionElsewhere(older.id, saveOf('Version 2'));
    await syncOnce(deps());
    expect((await db.warbands.get(older.id))!.serverRev).toBe(2);

    // the restore: a backup from before – one warband unknown, the other at version 1
    srv.state.epoch = 'epoch-2';
    srv.state.warbands.delete(lost.id);
    const o = srv.state.warbands.get(older.id)!;
    o.versions = o.versions.slice(0, 1);
    o.headRev = 1;
    o.seq = 1;
    srv.state.seq = 5;

    expect(await syncOnce(deps())).toMatchObject({ restored: true, waiting: 0 });
    expect(srv.state.warbands.get(lost.id)).toMatchObject({ headRev: 1 });
    expect(srv.state.warbands.get(older.id)).toMatchObject({ headRev: 2, versions: [{ rev: 1 }, { rev: 2, source: 'restore', data: { name: 'Version 2' } }] });
  });
});
