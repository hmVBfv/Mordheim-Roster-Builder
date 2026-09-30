/* Schema migrations: numbered SQL files in server/migrations/, forward only
   (docs/architecture.md). `0001_meta.sql`, `0002_users.sql`, … – numbered
   without gaps. A migration that has shipped is never edited; a correction is
   the next number. Each file runs in one transaction together with its row in
   schema_migrations, so a failing migration leaves the database as it was. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from './db.ts';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));

const FILE = /^(\d{4})_([a-z0-9_]+)\.sql$/;

export class MigrationError extends Error {
  override name = 'MigrationError';
}

export function loadMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  const files = readdirSync(dir).filter((f) => !f.startsWith('.')).sort();
  const out: Migration[] = [];
  for (const f of files) {
    const m = FILE.exec(f);
    if (!m) throw new MigrationError(`${f}: a migration is named NNNN_name.sql`);
    const version = Number(m[1]);
    if (version !== out.length + 1) throw new MigrationError(`${f}: expected number ${String(out.length + 1).padStart(4, '0')} (numbers start at 1, without gaps)`);
    out.push({ version, name: m[2]!, sql: readFileSync(join(dir, f), 'utf8') });
  }
  return out;
}

function ensureTable(db: DB) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at TEXT NOT NULL
  ) STRICT`);
}

/** The highest applied version; 0 for a new database. Does not change the database. */
export function currentVersion(db: DB): number {
  const t = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'").get();
  if (!t) return 0;
  const row = db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as { v: number | null };
  return row.v ?? 0;
}

export function pending(db: DB, migrations: Migration[]): Migration[] {
  const current = currentVersion(db);
  if (current > migrations.length) {
    throw new MigrationError(
      `the database is at schema ${current}, this version knows only ${migrations.length}: ` +
        'it was written by a newer version. Restore the backup taken before that deploy (roster-deploy does so on rollback).',
    );
  }
  return migrations.slice(current);
}

/** Applies what is pending; returns the versions applied. */
export function migrate(db: DB, migrations: Migration[], now: () => Date): number[] {
  ensureTable(db);
  const done: number[] = [];
  for (const m of pending(db, migrations)) {
    db.transaction(() => {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(m.version, m.name, now().toISOString());
    })();
    done.push(m.version);
  }
  return done;
}
