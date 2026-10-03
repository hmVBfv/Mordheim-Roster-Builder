/* GET /api/v1/health: what roster-deploy, the container healthcheck and
   roster-alive rely on. */
import { writeFileSync, openSync, writeSync, closeSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dbPath } from '../src/db.ts';
import { INTEGRITY_TTL, type HealthReport } from '../src/health.ts';
import { clock, dataDir, SCHEMA, startServer } from './helpers.ts';

const get = async (url: string) => {
  const res = await fetch(`${url}/api/v1/health`);
  return { status: res.status, headers: res.headers, body: (await res.json()) as HealthReport };
};

describe('health', () => {
  it('reports version, epoch, integrity and migrations', async () => {
    const c = clock();
    const s = await startServer({ now: c.now });
    const { status, headers, body } = await get(s.url);
    expect(status).toBe(200);
    expect(headers.get('cache-control')).toBe('no-store');
    expect(body).toEqual({
      status: 'ok',
      version: 'test-version',
      startedAt: '2026-09-30T12:00:00.000Z',
      epoch: expect.stringMatching(/^[0-9a-f-]{36}$/),
      db: { integrity: 'ok', checkedAt: '2026-09-30T12:00:00.000Z' },
      migrations: { current: SCHEMA, expected: SCHEMA },
    });
  });

  it('is not logged when fine (every 30 s from the container)', async () => {
    const s = await startServer();
    await get(s.url);
    expect(s.log.entries().filter((e) => e.event === 'request')).toEqual([]);
  });

  it('checks the integrity again only after a while', async () => {
    const c = clock();
    const s = await startServer({ now: c.now });
    c.advance(INTEGRITY_TTL - 1);
    expect((await get(s.url)).body.db.checkedAt).toBe('2026-09-30T12:00:00.000Z');
    c.advance(2);
    expect((await get(s.url)).body.db.checkedAt).toBe(new Date(new Date('2026-09-30T12:00:00.000Z').getTime() + INTEGRITY_TTL + 1).toISOString());
  });

  it('a damaged database: 503, not migrated, reason only in the log', async () => {
    const data = dataDir();
    const first = await startServer({ data });
    first.db.exec('CREATE TABLE filler (x TEXT); ' + Array.from({ length: 200 }, (_, i) => `INSERT INTO filler VALUES ('${'x'.repeat(500)}${i}');`).join(''));
    first.db.pragma('wal_checkpoint(TRUNCATE)');
    await first.close();
    // overwrite a page in the middle of the file
    const file = dbPath(data);
    const fd = openSync(file, 'r+');
    writeSync(fd, Buffer.alloc(4096, 0xab), 0, 4096, Math.floor(statSync(file).size / 2 / 4096) * 4096);
    closeSync(fd);
    const s = await startServer({ data });
    expect(s.ready).toBe(false);
    const { status, body } = await get(s.url);
    expect(status).toBe(503);
    expect(body.status).toBe('error');
    expect(['failed', 'unreadable']).toContain(body.db.integrity);
    expect(JSON.stringify(body)).not.toMatch(/page|btree|corrupt/i);
    expect(s.log.entries().some((e) => e.event === 'db_integrity_failed' || e.event === 'db_unreadable')).toBe(true);
  });

  it('a file that is no database at all: 503', async () => {
    const data = dataDir();
    writeFileSync(dbPath(data), 'this is not a database, it is a shopping list');
    const s = await startServer({ data });
    const { status, body } = await get(s.url);
    expect(status).toBe(503);
    expect(body.db.integrity).toBe('unreadable');
  });
});
