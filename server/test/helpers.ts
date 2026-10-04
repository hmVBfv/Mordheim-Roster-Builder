import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pino, { type Logger } from 'pino';
import { afterEach } from 'vitest';
import type { DB } from '../src/db.ts';
import { loggerOptions } from '../src/log.ts';
import { loadMigrations } from '../src/migrations.ts';
import { start, type Started, type StartOptions } from '../src/start.ts';
import { MARKER } from '../src/volume.ts';

/** The schema version of the repository's migrations. */
export const SCHEMA = loadMigrations().length;

const cleanup: (() => unknown)[] = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()!();
});

export function tmpDir(prefix = 'roster-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** A data directory as on the SSD: with the marker file. */
export function dataDir(): string {
  const dir = tmpDir('roster-data-');
  writeFileSync(join(dir, MARKER), '');
  return dir;
}

/** A small stand-in for app/dist/campaign. */
export function staticDir(): string {
  const dir = tmpDir('roster-static-');
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Mordheim Campaign</title>');
  writeFileSync(join(dir, 'sw.js'), 'self.addEventListener("fetch", () => {});');
  writeFileSync(join(dir, 'manifest.webmanifest'), '{"name":"Mordheim Campaign"}');
  writeFileSync(join(dir, 'assets', 'index-abc123.js'), 'console.log("app");');
  writeFileSync(join(dir, 'assets', 'font-latin-400.woff2'), 'wOF2');
  writeFileSync(join(dir, 'notes.xyz'), 'not a served type');
  return dir;
}

export interface LogCapture {
  logger: Logger;
  lines: string[];
  entries(): Record<string, unknown>[];
}

export function captureLog(level = 'debug'): LogCapture {
  const lines: string[] = [];
  const logger = pino(loggerOptions(level), { write: (s: string) => void lines.push(s.trimEnd()) });
  return { logger, lines, entries: () => lines.map((l) => JSON.parse(l) as Record<string, unknown>) };
}

export interface TestServerOptions extends Omit<StartOptions, 'env'> {
  data?: string;
  env?: NodeJS.ProcessEnv;
}

/** Starts the real server on a free port of 127.0.0.1. */
export async function startServer(opts: TestServerOptions = {}): Promise<Omit<Started, 'db'> & { db: DB; url: string; data: string; log: LogCapture }> {
  const data = opts.data ?? dataDir();
  const log = captureLog();
  const s = await start({
    logger: log.logger,
    ...opts,
    env: { DATA_DIR: data, PORT: '0', HOST: '127.0.0.1', STATIC_DIR: '', ROSTER_VERSION: 'test-version', ...opts.env },
  });
  cleanup.push(() => s.close());
  const addr = s.app.server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  // db is null only where a test broke the file on purpose, and those do not use it
  return { ...s, db: s.db as DB, url: `http://127.0.0.1:${port}`, data, log };
}

/** A clock for tests: starts at a fixed time and moves only when told. */
export function clock(start = '2026-09-30T12:00:00.000Z') {
  let t = new Date(start).getTime();
  return {
    now: () => new Date(t),
    advance: (ms: number) => void (t += ms),
  };
}
