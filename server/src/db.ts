/* The database: one SQLite file on the SSD in WAL mode (ADR 0007), and the
   small `meta` table the server keeps about itself (docs/data-model.md). */
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import Database from 'better-sqlite3';

export type DB = Database.Database;

export const DB_FILE = 'roster.sqlite';

export const dbPath = (dataDir: string) => join(dataDir, DB_FILE);

/** Opens (or, unless `mustExist`, creates) the database with the settings every connection needs. */
export function openDb(file: string, opts: { mustExist?: boolean } = {}): DB {
  const db = new Database(file, { fileMustExist: opts.mustExist ?? false });
  db.pragma('journal_mode = WAL');
  // WAL + NORMAL: a power cut may lose the last commits, never corrupt the file
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}

const hasMeta = (db: DB) =>
  !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'").get();

export function getMeta(db: DB, key: string): string | null {
  if (!hasMeta(db)) return null;
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setMeta(db: DB, key: string, value: string): void {
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function deleteMeta(db: DB, key: string): void {
  db.prepare('DELETE FROM meta WHERE key = ?').run(key);
}

/* The epoch (docs/architecture.md, Synchronisation): an ID that changes
   whenever the database is restored from a backup. A device that sees a new
   epoch syncs everything anew and offers what the server does not know, so
   entries made after the backup are not lost. */

/** Marks a snapshot copy (backup.ts): whoever starts on it has been restored. */
export const RESTORED_FROM = 'restored_from';

export function renewEpoch(db: DB): string {
  const epoch = randomUUID();
  setMeta(db, 'epoch', epoch);
  return epoch;
}

/**
 * Called once at start, after the migrations: a new database gets its first
 * epoch; a database that is a snapshot copy – restored by hand, by the
 * nightly restore test or by a rollback – gets a new one and loses the mark.
 * Returns what happened, for the log.
 */
export function settleEpoch(db: DB, now: () => Date): { epoch: string; restoredFrom: string | null; created: boolean } {
  return db.transaction(() => {
    const restoredFrom = getMeta(db, RESTORED_FROM);
    let epoch = getMeta(db, 'epoch');
    const created = epoch === null;
    if (created) setMeta(db, 'created_at', now().toISOString());
    if (created || restoredFrom !== null) epoch = renewEpoch(db);
    if (restoredFrom !== null) deleteMeta(db, RESTORED_FROM);
    return { epoch: epoch!, restoredFrom, created };
  })();
}
