/* Snapshots of the running database (docs/operations.md, Backups): before
   every deploy, nightly before restic, before migrations, and (phase 4a)
   after every battle. `VACUUM INTO` writes a consistent copy while the
   server keeps running. The copy carries a `restored_from` mark, so a server
   that is ever started on it takes a new epoch (db.ts). Only the newest
   KEEP raw snapshots stay on disk; restic keeps the history. */
import { closeSync, fsyncSync, mkdirSync, openSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { RESTORED_FROM, type DB } from './db.ts';

export const KEEP = 5;
export const SNAPSHOT_DIR = 'snapshots';

const LABEL = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export class BackupError extends Error {
  override name = 'BackupError';
}

/** 20260930T143012Z */
export const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

function fsyncPath(path: string) {
  const fd = openSync(path, 'r');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** Writes <dataDir>/snapshots/<stamp>-<label>.sqlite and returns its file name. */
export function snapshot(db: DB, dataDir: string, label: string, now: () => Date): string {
  if (!LABEL.test(label)) throw new BackupError(`label "${label}": lower-case letters, digits, dot, dash, underscore; at most 64`);
  const dir = join(dataDir, SNAPSHOT_DIR);
  mkdirSync(dir, { recursive: true, mode: 0o750 });
  // left over from an interrupted snapshot
  for (const f of readdirSync(dir)) if (/\.tmp(-wal|-shm|-journal)?$/.test(f)) rmSync(join(dir, f), { force: true });
  const at = now();
  const name = `${stamp(at)}-${label}.sqlite`;
  const tmp = join(dir, `${name}.tmp`);
  db.prepare('VACUUM INTO ?').run(tmp);
  const copy = new Database(tmp);
  try {
    const hasMeta = copy.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'").get();
    if (hasMeta) {
      copy.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value')
        .run(RESTORED_FROM, JSON.stringify({ label, at: at.toISOString() }));
    }
  } finally {
    copy.close();
  }
  fsyncPath(tmp);
  renameSync(tmp, join(dir, name));
  fsyncPath(dir);
  prune(dir);
  return name;
}

/** Snapshot file names, oldest first. */
export function listSnapshots(dataDir: string): string[] {
  try {
    return readdirSync(join(dataDir, SNAPSHOT_DIR)).filter((f) => f.endsWith('.sqlite')).sort();
  } catch {
    return [];
  }
}

function prune(dir: string) {
  const all = readdirSync(dir).filter((f) => f.endsWith('.sqlite')).sort();
  for (const f of all.slice(0, Math.max(0, all.length - KEEP))) rmSync(join(dir, f), { force: true });
}
