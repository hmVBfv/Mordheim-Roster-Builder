/* roster-cli (docs/architecture.md, server/): run inside the container,
   e.g. `docker exec roster-app roster-cli backup --label nightly`.

     backup [--label L]   snapshot of the running database into
                          <DATA_DIR>/snapshots/; prints the file name
     schema-version       the database's schema version (0: no database)
     info                 version, epoch, schema, snapshots as JSON
     epoch renew          a new epoch: every device syncs anew. Only needed
                          after restoring a copy that roster-cli did not make

   It never migrates and never creates a database; like the server it refuses
   to run without the marker file on the SSD. Invitations, reset links and
   bug work arrive with the features in phase 3. */
import { existsSync, statSync } from 'node:fs';
import { listSnapshots, snapshot } from './backup.ts';
import { readConfig } from './config.ts';
import { dbPath, getMeta, openDb, renewEpoch } from './db.ts';
import { currentVersion, loadMigrations } from './migrations.ts';
import { assertVolume } from './volume.ts';

export const USAGE = `usage: roster-cli <command>
  backup [--label <label>]   snapshot the database into DATA_DIR/snapshots, print its file name
  schema-version             print the database's schema version (0: no database yet)
  info                       version, epoch, schema and snapshots as JSON
  epoch renew                start a new epoch (devices sync anew)`;

export interface CliIO {
  out(line: string): void;
  err(line: string): void;
}

export function runCli(argv: string[], env: NodeJS.ProcessEnv, io: CliIO, now: () => Date = () => new Date()): number {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    io.out(USAGE);
    return cmd ? 0 : 2;
  }
  const known = ['backup', 'schema-version', 'info', 'epoch'];
  if (!known.includes(cmd)) {
    io.err(`roster-cli: unknown command "${cmd}"\n${USAGE}`);
    return 2;
  }
  try {
    const config = readConfig(env);
    assertVolume(config.dataDir);
    const file = dbPath(config.dataDir);
    const exists = existsSync(file);
    switch (cmd) {
      case 'schema-version': {
        if (!exists) {
          io.out('0');
          return 0;
        }
        const db = openDb(file, { mustExist: true });
        try {
          io.out(String(currentVersion(db)));
        } finally {
          db.close();
        }
        return 0;
      }
      case 'info': {
        const expected = loadMigrations().length;
        let schema = 0;
        let epoch: string | null = null;
        if (exists) {
          const db = openDb(file, { mustExist: true });
          try {
            schema = currentVersion(db);
            epoch = getMeta(db, 'epoch');
          } finally {
            db.close();
          }
        }
        io.out(JSON.stringify({
          version: config.version,
          database: exists ? { bytes: statSync(file).size, schema, expected, epoch } : null,
          snapshots: listSnapshots(config.dataDir),
        }));
        return 0;
      }
      case 'backup': {
        let label = 'manual';
        for (let i = 0; i < rest.length; i++) {
          if (rest[i] === '--label' && rest[i + 1]) label = rest[++i]!;
          else {
            io.err(`roster-cli backup: unexpected "${rest[i]}"`);
            return 2;
          }
        }
        if (!exists) {
          io.err('roster-cli backup: there is no database yet');
          return 3;
        }
        const db = openDb(file, { mustExist: true });
        try {
          io.out(snapshot(db, config.dataDir, label, now));
        } finally {
          db.close();
        }
        return 0;
      }
      case 'epoch': {
        if (rest[0] !== 'renew' || rest.length !== 1) {
          io.err('usage: roster-cli epoch renew');
          return 2;
        }
        if (!exists) {
          io.err('roster-cli epoch: there is no database yet');
          return 3;
        }
        const db = openDb(file, { mustExist: true });
        try {
          if (getMeta(db, 'epoch') === null) {
            io.err('roster-cli epoch: the database has no epoch yet (the server sets the first one)');
            return 3;
          }
          io.out(renewEpoch(db));
        } finally {
          db.close();
        }
        return 0;
      }
    }
    return 2;
  } catch (err) {
    io.err(`roster-cli ${cmd}: ${(err as Error).message}`);
    return 1;
  }
}
