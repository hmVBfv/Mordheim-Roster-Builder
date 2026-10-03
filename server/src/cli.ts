/* roster-cli (docs/architecture.md, server/): run inside the container,
   e.g. `docker exec roster-app roster-cli backup --label nightly`.

     backup [--label L]   snapshot of the running database into
                          <DATA_DIR>/snapshots/; prints the file name
     schema-version       the database's schema version (0: no database)
     info                 version, epoch, schema, snapshots as JSON
     epoch renew          a new epoch: every device syncs anew. Only needed
                          after restoring a copy that roster-cli did not make
     invite [--admin] [--note N]
                          a link to register (7 days); --admin makes the
                          account an admin – the first admin comes from here
     reset <username>     a link to set a new password (24 hours)
     totp-reset <username>
                          removes the authenticator and signs the account out
                          everywhere – the way back for an admin who lost it
     sign-out <username>  ends every session of the account (taken over?)
     users                the accounts, one per line

   It never migrates and never creates a database; like the server it refuses
   to run without the marker file on the SSD. Links are printed once; only
   their hashes are stored. Bug work arrives in phase 4c. */
import { existsSync, statSync } from 'node:fs';
import { audit, createInvite, listUsers, revokeUserSessions, userByName } from './accounts.ts';
import { listSnapshots, snapshot } from './backup.ts';
import { readConfig } from './config.ts';
import { dbPath, getMeta, openDb, renewEpoch, type DB } from './db.ts';
import { currentVersion, loadMigrations } from './migrations.ts';
import { assertVolume } from './volume.ts';

export const USAGE = `usage: roster-cli <command>
  backup [--label <label>]   snapshot the database into DATA_DIR/snapshots, print its file name
  schema-version             print the database's schema version (0: no database yet)
  info                       version, epoch, schema and snapshots as JSON
  epoch renew                start a new epoch (devices sync anew)
  invite [--admin] [--note <text>]
                             print a link to register (7 days; --admin: an admin account)
  reset <username>           print a link to set a new password (24 hours)
  totp-reset <username>      remove the authenticator, sign the account out everywhere
  sign-out <username>        end every session of the account
  users                      list the accounts`;

/** The accounts arrived with this schema version (migrations/0002_accounts.sql). */
const ACCOUNTS_SCHEMA = 2;

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
  const known = ['backup', 'schema-version', 'info', 'epoch', 'invite', 'reset', 'totp-reset', 'sign-out', 'users'];
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
      case 'invite':
      case 'reset':
      case 'totp-reset':
      case 'sign-out':
      case 'users': {
        if (!exists) {
          io.err(`roster-cli ${cmd}: there is no database yet`);
          return 3;
        }
        const db = openDb(file, { mustExist: true });
        try {
          if (currentVersion(db) < ACCOUNTS_SCHEMA) {
            io.err(`roster-cli ${cmd}: the database has no accounts yet – start the new version of the server first`);
            return 3;
          }
          return accounts(cmd, rest, db, config.publicOrigin, io, now());
        } finally {
          db.close();
        }
      }
    }
    return 2;
  } catch (err) {
    io.err(`roster-cli ${cmd}: ${(err as Error).message}`);
    return 1;
  }
}

function accounts(cmd: 'invite' | 'reset' | 'totp-reset' | 'sign-out' | 'users', rest: string[], db: DB, origin: string | null, io: CliIO, now: Date): number {
  // the token rides in the fragment, which never reaches a server's log
  const link = (path: string, token: string) => `${origin ?? '<PUBLIC_ORIGIN>'}/${path}#${token}`;
  const via = { via: 'roster-cli' };
  switch (cmd) {
    case 'invite': {
      let admin = false;
      let note = '';
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '--admin') admin = true;
        else if (rest[i] === '--note' && rest[i + 1] !== undefined) note = rest[++i]!;
        else {
          io.err(`roster-cli invite: unexpected "${rest[i]}"`);
          return 2;
        }
      }
      const inv = createInvite(db, { kind: 'register', createdBy: null, isAdmin: admin, note }, now);
      audit(db, { actorId: null, action: 'invite.create', targetType: 'invite', targetId: inv.id, payload: { ...via, admin, note } }, now);
      io.out(link('invite', inv.token));
      return 0;
    }
    case 'reset':
    case 'totp-reset':
    case 'sign-out': {
      if (rest.length !== 1) {
        io.err(`usage: roster-cli ${cmd} <username>`);
        return 2;
      }
      const u = userByName(db, rest[0]!);
      if (!u) {
        io.err(`roster-cli ${cmd}: there is no account "${rest[0]}"`);
        return 3;
      }
      if (cmd === 'reset') {
        const inv = createInvite(db, { kind: 'reset', createdBy: null, forUserId: u.id }, now);
        audit(db, { actorId: null, action: 'invite.reset', targetType: 'user', targetId: u.id, payload: { ...via, invite: inv.id } }, now);
        io.out(link('reset', inv.token));
        return 0;
      }
      if (cmd === 'sign-out') {
        const n = revokeUserSessions(db, u.id, now);
        audit(db, { actorId: null, action: 'sessions.revoke_all', targetType: 'user', targetId: u.id, payload: { ...via, n } }, now);
        io.out(`${u.username}: ${n} session${n === 1 ? '' : 's'} ended`);
        return 0;
      }
      db.transaction(() => {
        db.prepare('UPDATE users SET totp_secret_enc = NULL, totp_pending_enc = NULL, totp_enabled_at = NULL, totp_recovery = NULL WHERE id = ?').run(u.id);
        const n = revokeUserSessions(db, u.id, now);
        audit(db, { actorId: null, action: 'totp.reset', targetType: 'user', targetId: u.id, payload: { ...via, signedOut: n } }, now);
      })();
      io.out(`${u.username}: authenticator removed, signed out everywhere${u.is_admin ? ' – set it up again after signing in' : ''}`);
      return 0;
    }
    case 'users': {
      if (rest.length) {
        io.err('usage: roster-cli users');
        return 2;
      }
      for (const u of listUsers(db, now)) {
        const flags = [u.isAdmin && 'admin', u.totp && 'totp', u.disabledAt && 'disabled'].filter(Boolean).join(',') || '-';
        io.out(`${u.username}\t${flags}\t${u.sessions} devices\tlast seen ${u.lastSeenAt ?? 'never'}`);
      }
      return 0;
    }
  }
}
