/* Snapshots: consistent copies while the server runs, marked as snapshots,
   the newest KEEP kept. */
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BackupError, KEEP, listSnapshots, snapshot, stamp } from '../src/backup.ts';
import { getMeta, openDb } from '../src/db.ts';
import { currentVersion } from '../src/migrations.ts';
import { clock, SCHEMA, startServer } from './helpers.ts';

describe('snapshots', () => {
  it('are named by time and label, and are complete databases', async () => {
    const c = clock();
    const s = await startServer({ now: c.now });
    s.db.exec("INSERT INTO meta (key, value) VALUES ('probe', 'written before the snapshot')");
    const name = snapshot(s.db, s.data, 'pre-deploy-9cfc4ab', c.now);
    expect(name).toBe('20260930T120000Z-pre-deploy-9cfc4ab.sqlite');
    const copy = openDb(join(s.data, 'snapshots', name), { mustExist: true });
    expect(copy.pragma('integrity_check', { simple: true })).toBe('ok');
    expect(currentVersion(copy)).toBe(SCHEMA);
    expect(getMeta(copy, 'probe')).toBe('written before the snapshot');
    expect(getMeta(copy, 'epoch')).toBe(getMeta(s.db, 'epoch'));
    expect(JSON.parse(getMeta(copy, 'restored_from')!)).toEqual({ label: 'pre-deploy-9cfc4ab', at: '2026-09-30T12:00:00.000Z' });
    copy.close();
    // no temporary files stay behind
    expect(readdirSync(join(s.data, 'snapshots'))).toEqual([name]);
  });

  it('keep the newest five', async () => {
    const c = clock();
    const s = await startServer({ now: c.now });
    const names: string[] = [];
    for (let i = 0; i < KEEP + 3; i++) {
      names.push(snapshot(s.db, s.data, `n${i}`, c.now));
      c.advance(60_000);
    }
    expect(listSnapshots(s.data)).toEqual(names.slice(-KEEP));
  });

  it('clear what an interrupted snapshot left', async () => {
    const s = await startServer();
    snapshot(s.db, s.data, 'first', () => new Date('2026-09-30T01:00:00Z'));
    writeFileSync(join(s.data, 'snapshots', 'x.sqlite.tmp'), 'half');
    writeFileSync(join(s.data, 'snapshots', 'x.sqlite.tmp-wal'), 'half');
    snapshot(s.db, s.data, 'second', () => new Date('2026-09-30T02:00:00Z'));
    expect(readdirSync(join(s.data, 'snapshots')).sort()).toEqual(['20260930T010000Z-first.sqlite', '20260930T020000Z-second.sqlite']);
  });

  it('refuse labels that are no plain file name part', async () => {
    const s = await startServer();
    for (const bad of ['', '../x', 'a/b', 'Nightly', '-x', 'a b', 'x'.repeat(65)]) {
      expect(() => snapshot(s.db, s.data, bad, () => new Date()), bad).toThrow(BackupError);
    }
  });

  it('stamp is sortable UTC', () => {
    expect(stamp(new Date('2026-01-02T03:04:05.678Z'))).toBe('20260102T030405Z');
  });
});
