/* The migration frame: numbered SQL files, forward only, one transaction
   each, a snapshot before migrating a database that already has a schema. */
import { copyFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDb } from '../src/db.ts';
import { currentVersion, loadMigrations, migrate, MigrationError, MIGRATIONS_DIR, pending } from '../src/migrations.ts';
import { clock, startServer, tmpDir } from './helpers.ts';

function migrationsDir(files: Record<string, string>): string {
  const dir = tmpDir('roster-mig-');
  for (const [f, sql] of Object.entries(files)) writeFileSync(join(dir, f), sql);
  return dir;
}

/** The real migrations, plus more. */
function withExtra(extra: Record<string, string>): string {
  const dir = tmpDir('roster-mig-');
  for (const f of readdirSync(MIGRATIONS_DIR)) copyFileSync(join(MIGRATIONS_DIR, f), join(dir, f));
  for (const [f, sql] of Object.entries(extra)) writeFileSync(join(dir, f), sql);
  return dir;
}

describe('migration files', () => {
  it('the repository\'s migrations are numbered from 1 without gaps', () => {
    const m = loadMigrations();
    expect(m.length).toBeGreaterThan(0);
    expect(m.map((x) => x.version)).toEqual(m.map((_, i) => i + 1));
    expect(m[0]!.name).toBe('meta');
  });

  it('a gap, a double number or a wrong name is refused', () => {
    expect(() => loadMigrations(migrationsDir({ '0001_a.sql': '', '0003_c.sql': '' }))).toThrow(/expected number 0002/);
    expect(() => loadMigrations(migrationsDir({ '0001_a.sql': '', '0001_b.sql': '' }))).toThrow(/expected number 0002/);
    expect(() => loadMigrations(migrationsDir({ '1_a.sql': '' }))).toThrow(/NNNN_name\.sql/);
    expect(() => loadMigrations(migrationsDir({ '0001_A.sql': '' }))).toThrow(/NNNN_name\.sql/);
  });
});

describe('migrating', () => {
  const now = clock().now;

  it('applies what is pending, in order, and records it', () => {
    const db = openDb(':memory:');
    const m = loadMigrations(migrationsDir({ '0001_a.sql': 'CREATE TABLE a (x INTEGER) STRICT;', '0002_b.sql': 'INSERT INTO a VALUES (7);' }));
    expect(migrate(db, m, now)).toEqual([1, 2]);
    expect(migrate(db, m, now)).toEqual([]);
    expect(currentVersion(db)).toBe(2);
    expect(db.prepare('SELECT x FROM a').all()).toEqual([{ x: 7 }]);
    expect(db.prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version').all()).toEqual([
      { version: 1, name: 'a', applied_at: '2026-09-30T12:00:00.000Z' },
      { version: 2, name: 'b', applied_at: '2026-09-30T12:00:00.000Z' },
    ]);
  });

  it('a failing migration leaves no trace of itself', () => {
    const db = openDb(':memory:');
    const m = loadMigrations(migrationsDir({
      '0001_a.sql': 'CREATE TABLE a (x INTEGER) STRICT;',
      '0002_b.sql': 'CREATE TABLE b (y INTEGER); INSERT INTO nowhere VALUES (1);',
    }));
    expect(() => migrate(db, m, now)).toThrow(/no such table: nowhere/);
    expect(currentVersion(db)).toBe(1);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'b'").get()).toBeUndefined();
  });

  it('a database newer than the code is not touched', () => {
    const db = openDb(':memory:');
    migrate(db, loadMigrations(migrationsDir({ '0001_a.sql': '', '0002_b.sql': '' })), now);
    const older = loadMigrations(migrationsDir({ '0001_a.sql': '' }));
    expect(() => pending(db, older)).toThrow(MigrationError);
    expect(() => migrate(db, older, now)).toThrow(/schema 2, this version knows only 1/);
  });
});

describe('migrating at start', () => {
  it('takes a snapshot before migrating an existing database', async () => {
    const first = await startServer();
    await first.close();
    const next = withExtra({ '0002_more.sql': 'CREATE TABLE more (x INTEGER) STRICT;' });
    const s = await startServer({ data: first.data, migrationsDir: next });
    expect(s.ready).toBe(true);
    const snaps = readdirSync(join(s.data, 'snapshots'));
    expect(snaps).toHaveLength(1);
    expect(snaps[0]).toMatch(/-pre-migrate-v1-v2\.sqlite$/);
    // the snapshot is the database before the migration
    const before = openDb(join(s.data, 'snapshots', snaps[0]!), { mustExist: true });
    expect(currentVersion(before)).toBe(1);
    before.close();
    expect(currentVersion(s.db)).toBe(2);
  });

  it('when a migration fails the server answers health with 503 and stays unmigrated', async () => {
    const first = await startServer();
    await first.close();
    const broken = withExtra({ '0002_broken.sql': 'INSERT INTO nowhere VALUES (1);' });
    const s = await startServer({ data: first.data, migrationsDir: broken });
    expect(s.ready).toBe(false);
    const res = await fetch(`${s.url}/api/v1/health`);
    expect(res.status).toBe(503);
    const body = await res.json() as { status: string; migrations: { current: number; expected: number } };
    expect(body.status).toBe('error');
    expect(body.migrations).toEqual({ current: 1, expected: 2 });
    expect(s.log.entries().some((e) => e.event === 'migration_failed')).toBe(true);
  });

  it('an older version on a newer database does not start the data side (rollback without restore)', async () => {
    const newer = withExtra({ '0002_more.sql': 'CREATE TABLE more (x INTEGER) STRICT;' });
    const a = await startServer({ migrationsDir: newer });
    await a.close();
    const old = await startServer({ data: a.data });
    expect(old.ready).toBe(false);
    const res = await fetch(`${old.url}/api/v1/health`);
    expect(res.status).toBe(503);
    expect(((await res.json()) as { migrations: unknown }).migrations).toEqual({ current: 2, expected: 1 });
  });
});
