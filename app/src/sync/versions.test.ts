/* Versions made on purpose, an older one brought back, a copy as the
   blueprint for a campaign start, and a warband from the Quick Build – on
   the device and against the stand-in server. */
import { FORMAT, ctxOf, writeSave } from '@mordheim/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetSession, signedIn } from '../account/session.ts';
import { ME as KAI } from '../account/testServer.ts';
import { db, type StoredWarband } from '../db/db.ts';
import { cleanServer, decodeSave, encodeSave, importLink } from '../share/link.ts';
import { data, sampleSave } from '../test/data.ts';
import { syncOnce } from './engine.ts';
import { fakeSyncServer } from './fakeServer.ts';
import { importAsVersion, listVersions, makeCopy, restoreVersion, saveVersion } from './versions.ts';

const T0 = '2026-10-04T10:00:00.000Z';
const deps = { userId: KAI.id, data: async () => data, undoMs: 0 };
const record = (over: Partial<StoredWarband> = {}): StoredWarband => {
  const s = sampleSave();
  return { id: crypto.randomUUID(), name: s.name!, wb: s.wb as string, wbName: 'Mercenaries', state: s, format: FORMAT, createdAt: T0, updatedAt: T0, ownerId: KAI.id, origin: 'save', ...over };
};
const named = (name: string) => ({ ...sampleSave(), name });

beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); signedIn({ stage: 'full', user: KAI }); });
afterEach(async () => { resetSession(); localStorage.clear(); await db.warbands.clear(); await db.meta.clear(); });

describe('versions', () => {
  it('saved on purpose with a note; one built on an older is refused and says which is newer', async () => {
    const srv = fakeSyncServer();
    const w = record();
    await db.warbands.add(w);
    await syncOnce(deps);
    let local = (await db.warbands.get(w.id))!;
    expect(await saveVersion(data, local, ' before the Docks ')).toEqual({ ok: true, rev: 2 });
    expect(srv.state.warbands.get(w.id)!.versions[1]).toMatchObject({ rev: 2, note: 'before the Docks', source: 'save' });
    local = (await db.warbands.get(w.id))!;
    expect(local).toMatchObject({ serverRev: 2, draftSeq: null });
    expect((await listVersions(w.id)).map((v) => v.rev)).toEqual([2, 1]);

    srv.versionElsewhere(w.id, writeSave(ctxOf(data, named('Laptop'))));
    expect(await saveVersion(data, local, '')).toEqual({ ok: false, headRev: 3 });
  });

  it('an older version becomes the newest as a new version; the history stays', async () => {
    const srv = fakeSyncServer();
    const w = record();
    await db.warbands.add(w);
    await syncOnce(deps);
    srv.versionElsewhere(w.id, writeSave(ctxOf(data, named('Later'))));
    await syncOnce(deps);
    const local = (await db.warbands.get(w.id))!;
    expect(local.name).toBe('Later');
    expect(await restoreVersion(data, local, 1)).toEqual({ ok: true, rev: 3 });
    expect(srv.state.warbands.get(w.id)!.versions.map((v) => [v.rev, v.source, v.note ?? ''])).toEqual([[1, 'save', ''], [2, 'save', ''], [3, 'restore', 'back to version 1']]);
    expect((await db.warbands.get(w.id))).toMatchObject({ name: 'The Silver Caravan', serverRev: 3 });
  });
});

describe('a copy: the blueprint for a campaign start', () => {
  it('a new warband of its own, named as a copy, remembering its source; the server records it', async () => {
    const srv = fakeSyncServer();
    const w = record();
    await db.warbands.add(w);
    await syncOnce(deps);
    const id = await makeCopy((await db.warbands.get(w.id))!);
    expect(await db.warbands.get(id)).toMatchObject({ name: 'The Silver Caravan (copy)', origin: 'copy', copiedFrom: { id: w.id, rev: 1 }, ownerId: KAI.id });
    expect((await db.warbands.get(id))!.state.name).toBe('The Silver Caravan (copy)');
    await syncOnce(deps);
    expect(srv.state.warbands.get(id)).toMatchObject({ copiedFrom: { id: w.id, rev: 1 }, versions: [{ source: 'copy' }] });
    expect(srv.state.warbands.get(w.id)!.headRev).toBe(1);
  });

  it('a copy of a warband only on this device goes up as an ordinary warband', async () => {
    const srv = fakeSyncServer();
    const local = record({ ownerId: undefined, origin: undefined });
    await db.warbands.add(local);
    const id = await makeCopy(local);
    expect((await db.warbands.get(id))!.copiedFrom).toBeUndefined();
    await syncOnce(deps);
    expect(srv.state.warbands.get(id)).toMatchObject({ copiedFrom: null, versions: [{ source: 'save' }] });
  });
});

describe('from the Quick Build', () => {
  it('the link carries the save in its fragment, compressed, and reads back', async () => {
    const save = writeSave(ctxOf(data, sampleSave()));
    const fragment = await encodeSave(save);
    expect(fragment).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
    expect(fragment.length).toBeLessThan(JSON.stringify(save).length);
    expect(await decodeSave(`#${fragment}`)).toEqual(save);
    expect(await decodeSave('v1.not-deflate')).toBeNull();
    expect(await decodeSave('something')).toBeNull();
    expect(importLink('https://mordheim.example.org', fragment)).toBe(`https://mordheim.example.org/import#${fragment}`);
  });

  it('the server address: an origin, https unless given', () => {
    expect(cleanServer('mordheim.example.org/')).toBe('https://mordheim.example.org');
    expect(cleanServer('http://192.168.1.20:8081/whatever')).toBe('http://192.168.1.20:8081');
    expect(cleanServer('  ')).toBe('');
    expect(cleanServer('ftp://x')).toBe('');
    expect(cleanServer('not a url at all')).toBe('');
  });

  it('as the next version of a warband of the account', async () => {
    const srv = fakeSyncServer();
    const w = record();
    await db.warbands.add(w);
    await syncOnce(deps);
    expect(await importAsVersion(data, (await db.warbands.get(w.id))!, named('Planned in the Quick Build'))).toEqual({ ok: true, rev: 2 });
    expect(srv.state.warbands.get(w.id)!.versions[1]).toMatchObject({ source: 'import', note: 'from the Quick Build' });
    expect((await db.warbands.get(w.id))!.name).toBe('Planned in the Quick Build');
  });
});
