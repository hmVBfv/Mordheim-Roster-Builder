/* GET /api/v1/health (docs/architecture.md): version, the database's state
   and the migration state. roster-deploy waits for it after a deploy, the
   container's healthcheck asks every 30 s, roster-alive every 5 min from the
   outside. So it must be cheap: the integrity check runs fully at start and
   then, as a quick check, at most every INTEGRITY_TTL. Failures are logged
   in detail; the answer only says that something failed. */
import type { FastifyBaseLogger } from 'fastify';
import { getMeta, type DB } from './db.ts';
import { currentVersion } from './migrations.ts';

export const INTEGRITY_TTL = 15 * 60 * 1000;

export type Integrity = 'ok' | 'failed' | 'unreadable';

export interface HealthReport {
  status: 'ok' | 'error';
  version: string;
  startedAt: string;
  epoch: string | null;
  db: { integrity: Integrity; checkedAt: string | null };
  migrations: { current: number | null; expected: number };
}

export class Health {
  private integrity: { result: Integrity; at: Date } | null = null;

  constructor(
    /** null: the file could not even be opened as a database. */
    private readonly db: DB | null,
    private readonly opts: { version: string; expected: number; startedAt: Date; now: () => Date; log: FastifyBaseLogger },
  ) {}

  /** Runs the integrity check now: `integrity_check` (full) or `quick_check`. */
  check(full: boolean): Integrity {
    let result: Integrity;
    try {
      if (!this.db) throw new Error('the database could not be opened');
      const rows = this.db.pragma(full ? 'integrity_check' : 'quick_check') as Record<string, string>[];
      const lines = rows.map((r) => Object.values(r)[0]);
      result = lines.length === 1 && lines[0] === 'ok' ? 'ok' : 'failed';
      if (result === 'failed') this.opts.log.error({ event: 'db_integrity_failed', lines: lines.slice(0, 20) }, 'database integrity check failed');
    } catch (err) {
      result = 'unreadable';
      this.opts.log.error({ event: 'db_unreadable', err }, 'database could not be read');
    }
    this.integrity = { result, at: this.opts.now() };
    return result;
  }

  report(): HealthReport {
    const now = this.opts.now();
    if (!this.integrity || now.getTime() - this.integrity.at.getTime() > INTEGRITY_TTL) this.check(false);
    let epoch: string | null = null;
    let current: number | null = null;
    try {
      if (!this.db) throw new Error('the database could not be opened');
      epoch = getMeta(this.db, 'epoch');
      current = currentVersion(this.db);
    } catch (err) {
      if (this.db) this.opts.log.error({ event: 'db_unreadable', err }, 'database could not be read');
      this.integrity = { result: 'unreadable', at: now };
    }
    const integrity = this.integrity!;
    const ok = integrity.result === 'ok' && current === this.opts.expected && epoch !== null;
    return {
      status: ok ? 'ok' : 'error',
      version: this.opts.version,
      startedAt: this.opts.startedAt.toISOString(),
      epoch,
      db: { integrity: integrity.result, checkedAt: integrity.at.toISOString() },
      migrations: { current, expected: this.opts.expected },
    };
  }
}
