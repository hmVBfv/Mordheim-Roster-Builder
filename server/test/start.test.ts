/* Starting: the marker file (SSD drill), the first start, a restart, and a
   start on a restored snapshot (the epoch). */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { snapshot } from '../src/backup.ts';
import { DB_FILE, dbPath, getMeta, openDb } from '../src/db.ts';
import { start } from '../src/start.ts';
import { VolumeError } from '../src/volume.ts';
import { clock, dataDir, startServer, tmpDir } from './helpers.ts';

describe('the marker file on the SSD', () => {
  it('without it the server does not start and creates no database', async () => {
    const empty = tmpDir();
    await expect(start({ env: { DATA_DIR: empty, PORT: '0', HOST: '127.0.0.1', STATIC_DIR: '' } })).rejects.toBeInstanceOf(VolumeError);
    expect(readdirSync(empty)).toEqual([]);
  });

  it('a directory of that name is not the marker', async () => {
    const dir = tmpDir();
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(dir, '.roster-volume'));
    await expect(start({ env: { DATA_DIR: dir, PORT: '0', HOST: '127.0.0.1', STATIC_DIR: '' } })).rejects.toBeInstanceOf(VolumeError);
    expect(existsSync(join(dir, DB_FILE))).toBe(false);
  });
});

describe('first start and restart', () => {
  it('creates the database, migrates it and gives it an epoch', async () => {
    const c = clock();
    const s = await startServer({ now: c.now });
    expect(s.ready).toBe(true);
    expect(existsSync(join(s.data, DB_FILE))).toBe(true);
    expect(getMeta(s.db, 'epoch')).toMatch(/^[0-9a-f-]{36}$/);
    expect(getMeta(s.db, 'created_at')).toBe('2026-09-30T12:00:00.000Z');
    expect(s.log.entries().map((e) => e.event)).toEqual(expect.arrayContaining(['migrated', 'db_created', 'started']));
    // a new database needs no snapshot before its first migrations
    expect(existsSync(join(s.data, 'snapshots'))).toBe(false);
  });

  it('a restart keeps the epoch', async () => {
    const data = dataDir();
    const a = await startServer({ data });
    const epoch = getMeta(a.db, 'epoch');
    await a.close();
    const b = await startServer({ data });
    expect(getMeta(b.db, 'epoch')).toBe(epoch);
    expect(b.log.entries().some((e) => e.event === 'restored' || e.event === 'db_created')).toBe(false);
  });
});

describe('the epoch after a restore', () => {
  it('a server started on a snapshot copy takes a new epoch, once', async () => {
    const c = clock();
    const live = await startServer({ now: c.now });
    const epoch = getMeta(live.db, 'epoch')!;
    const name = snapshot(live.db, live.data, 'nightly', c.now);
    await live.close();

    // restore: the snapshot becomes the database of another data directory
    const restored = dataDir();
    const { copyFileSync } = await import('node:fs');
    copyFileSync(join(live.data, 'snapshots', name), dbPath(restored));
    const r = await startServer({ data: restored, now: c.now });
    const renewed = getMeta(r.db, 'epoch')!;
    expect(renewed).not.toBe(epoch);
    expect(getMeta(r.db, 'restored_from')).toBeNull();
    const entry = r.log.entries().find((e) => e.event === 'restored')!;
    expect(entry.from).toBe(JSON.stringify({ label: 'nightly', at: '2026-09-30T12:00:00.000Z' }));
    await r.close();

    // started again on the same (now live) file: the epoch stays
    const again = await startServer({ data: restored });
    expect(getMeta(again.db, 'epoch')).toBe(renewed);
  });

  it('the same snapshot restored twice gives two different epochs', async () => {
    const live = await startServer();
    const name = snapshot(live.db, live.data, 'pre-deploy-abc1234', () => new Date());
    await live.close();
    const { copyFileSync } = await import('node:fs');
    const epochs: string[] = [];
    for (let i = 0; i < 2; i++) {
      const d = dataDir();
      copyFileSync(join(live.data, 'snapshots', name), dbPath(d));
      const r = await startServer({ data: d });
      epochs.push(getMeta(r.db, 'epoch')!);
      await r.close();
    }
    expect(epochs[0]).not.toBe(epochs[1]);
  });

  it('the live database never carries the mark', async () => {
    const live = await startServer();
    snapshot(live.db, live.data, 'nightly', () => new Date());
    expect(getMeta(live.db, 'restored_from')).toBeNull();
    const db = openDb(dbPath(live.data), { mustExist: true });
    expect(getMeta(db, 'restored_from')).toBeNull();
    db.close();
  });
});
