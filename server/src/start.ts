/* Starting the server, in this order (docs/architecture.md, server/):
   1. the marker file on the SSD – without it, stop before touching anything;
   2. open the database and check its integrity fully;
   3. pending migrations: snapshot first (a database that already has a
      schema), then migrate;
   4. settle the epoch (new database, or started on a restored snapshot);
   5. listen.
   If 2 or 3 fail the server still listens, and health answers 503 with the
   reason's category, so roster-deploy rolls back and roster-alive reports.
   The data endpoints (accounts and everything after) stay closed then. */
import pino, { type Logger } from 'pino';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.ts';
import { snapshot } from './backup.ts';
import { readConfig, type Config } from './config.ts';
import { dbPath, openDb, settleEpoch, type DB } from './db.ts';
import { Health } from './health.ts';
import { loggerOptions } from './log.ts';
import type { HashCost } from './passwords.ts';
import { currentVersion, loadMigrations, migrate, pending, MIGRATIONS_DIR } from './migrations.ts';
import { trustedProxies } from './net.ts';
import { loadStatic } from './static.ts';
import { assertVolume } from './volume.ts';

export interface Started {
  app: FastifyInstance;
  /** null if the file could not be opened as a database (health answers 503). */
  db: DB | null;
  config: Config;
  /** Whether the database is ready for the data endpoints (integrity and schema fine). */
  ready: boolean;
  close(): Promise<void>;
}

export interface StartOptions {
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  logger?: Logger;
  migrationsDir?: string;
  /** Proxy routing table, for tests. */
  readRoutes?: () => string;
  /** scrypt's cost, for tests. */
  hashCost?: HashCost;
}

/** Starts the server; throws (VolumeError, ConfigError) only when it must not run at all. */
export async function start(opts: StartOptions = {}): Promise<Started> {
  const now = opts.now ?? (() => new Date());
  const config = readConfig(opts.env ?? process.env);
  const log = opts.logger ?? pino(loggerOptions(config.logLevel));
  assertVolume(config.dataDir);

  let db: DB | null = null;
  try {
    db = openDb(dbPath(config.dataDir));
  } catch (err) {
    log.error({ event: 'db_unreadable', err }, 'the database file could not be opened');
  }
  const migrations = loadMigrations(opts.migrationsDir ?? MIGRATIONS_DIR);
  const health = new Health(db, { version: config.version, expected: migrations.length, startedAt: now(), now, log });
  let ready = false;
  if (db && health.check(true) === 'ok') {
    try {
      const from = currentVersion(db);
      if (pending(db, migrations).length && from > 0) {
        const file = snapshot(db, config.dataDir, `pre-migrate-v${from}-v${migrations.length}`, now);
        log.info({ event: 'snapshot', file }, 'snapshot before migrating');
      }
      const applied = migrate(db, migrations, now);
      if (applied.length) log.info({ event: 'migrated', from, to: migrations.length }, 'schema migrated');
      const epoch = settleEpoch(db, now);
      if (epoch.created) log.info({ event: 'db_created', epoch: epoch.epoch }, 'new database');
      if (epoch.restoredFrom) log.warn({ event: 'restored', from: epoch.restoredFrom, epoch: epoch.epoch }, 'started on a restored snapshot: new epoch, devices will sync anew');
      ready = true;
    } catch (err) {
      log.error({ event: 'migration_failed', err }, 'schema not ready; only health is answered');
    }
  } else {
    log.error({ event: 'db_not_ready' }, 'database damaged or unreadable; not migrating, only health is answered');
  }

  const files = loadStatic(config.staticDir);
  if (!files.index) log.warn({ event: 'static_missing', dir: config.staticDir }, 'no app build to serve');
  if (!config.totpKey) log.warn({ event: 'totp_key_missing' }, 'no TOTP_KEY: nobody can set up an authenticator, and an admin can only look after the own account');
  const app = buildApp({
    config, health, files, trustProxy: trustedProxies(config.trustProxy, opts.readRoutes), logger: log,
    db: ready ? db : null, now, totpKey: config.totpKey, hashCost: opts.hashCost,
  });
  await app.listen({ host: config.host, port: config.port });
  log.info({ event: 'started', version: config.version, ready, files: files.count }, 'server started');

  let closed = false;
  return {
    app,
    db,
    config,
    ready,
    async close() {
      if (closed) return;
      closed = true;
      await app.close();
      db?.close();
    },
  };
}
