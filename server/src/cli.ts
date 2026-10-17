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
     test-accounts        the test instance only (ROSTER_STAGING=1): one
                          test password from stdin for every account, no
                          authenticators, no sessions, no open links, no
                          bug tokens – the nightly restore test runs it on
                          its copy of production (security review OPS-3)
     bug-token create [--days N] [--label L]
                          a token for a cloud session to read and sort the
                          problem reports (GET/PATCH /bugs, nothing else;
                          ADR 0019); printed once. 60 days unless told, 180 at most
     bug-token list       the tokens: good, expired or revoked
     bug-token revoke <id>
                          ends a token (the id, or its first characters)
     bugs [--status S]    the problem reports, one per line: open ones, `all`,
                          or one status
     bugs show <number>   one report as JSON (the warband copy only as a size)

   It never migrates and never creates a database; like the server it refuses
   to run without the marker file on the SSD. Links and tokens are printed
   once; only their hashes are stored. */
import { existsSync, statSync } from 'node:fs';
import { audit, createInvite, listUsers, revokeUserSessions, userByName } from './accounts.ts';
import { bugByRef, listBugs, oneBug, STATUSES } from './bugs.ts';
import { createBugToken, DEFAULT_DAYS, listBugTokens, revokeBugToken } from './bug-tokens.ts';
import { hashPasswordSync, passwordProblem } from './passwords.ts';
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
  users                      list the accounts
  test-accounts              test instance only: one password (stdin) for every account,
                             no authenticators, no sessions, no open links, no bug tokens
  bug-token create [--days <n>] [--label <text>]
                             print a token for a cloud session (GET/PATCH /bugs only; once)
  bug-token list             the tokens: good, expired or revoked
  bug-token revoke <id>      end a token (its id, or the first characters)
  bugs [--status <s>]        the problem reports, one per line (open · all · a status)
  bugs show <number>         one report as JSON`;

/** The accounts arrived with this schema version (migrations/0002_accounts.sql). */
const ACCOUNTS_SCHEMA = 2;
/** Report numbers (0022_bug_numbers.sql) and the bug token (0023_bug_tokens.sql). */
const BUG_NUMBERS_SCHEMA = 22;
const BUG_TOKENS_SCHEMA = 23;

export interface CliIO {
  out(line: string): void;
  err(line: string): void;
  /** Standard input, read whole (test-accounts reads its password there, never from the command line). */
  input?(): string;
}

export function runCli(argv: string[], env: NodeJS.ProcessEnv, io: CliIO, now: () => Date = () => new Date()): number {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    io.out(USAGE);
    return cmd ? 0 : 2;
  }
  const known = ['backup', 'schema-version', 'info', 'epoch', 'invite', 'reset', 'totp-reset', 'sign-out', 'users', 'test-accounts', 'bug-token', 'bugs'];
  if (!known.includes(cmd)) {
    io.err(`roster-cli: unknown command "${cmd}"\n${USAGE}`);
    return 2;
  }
  // a copy of production gets one test password for every account: never anywhere but the test instance
  if (cmd === 'test-accounts' && env.ROSTER_STAGING !== '1') {
    io.err('roster-cli test-accounts: only on the test instance (ROSTER_STAGING=1 in staging.env) – it gives every account the same password');
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
      case 'users':
      case 'test-accounts':
      case 'bug-token':
      case 'bugs': {
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
          if (cmd === 'test-accounts') return testAccounts(rest, db, io, now());
          if (cmd === 'bug-token' || cmd === 'bugs') {
            const need = cmd === 'bug-token' ? BUG_TOKENS_SCHEMA : BUG_NUMBERS_SCHEMA;
            if (currentVersion(db) < need) {
              io.err(`roster-cli ${cmd}: the database is not at schema ${need} yet – start the new version of the server first`);
              return 3;
            }
            return cmd === 'bug-token' ? bugToken(rest, db, io, now()) : bugs(rest, db, io);
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

/** The test instance after the nightly restore (security review OPS-3, Rob
    09.10.2026): it holds a copy of production, served over plain http in
    the home network, so nothing of production's that signs in may work
    there. Every account gets the one test password, every authenticator
    goes (its secret is under production's key anyway), every session ends
    and every open invite or reset link is revoked. */
function testAccounts(rest: string[], db: DB, io: CliIO, now: Date): number {
  if (rest.length) {
    io.err('usage: roster-cli test-accounts < <file with the password>');
    return 2;
  }
  const pw = (io.input?.() ?? '').split(/\r?\n/)[0] ?? '';
  const problem = passwordProblem(pw);
  if (problem) {
    io.err(`roster-cli test-accounts: the test password (stdin): ${problem}`);
    return 2;
  }
  const hash = hashPasswordSync(pw);
  const t = now.toISOString();
  const n = db.transaction(() => {
    const accounts = db.prepare('UPDATE users SET pw_hash = ?, totp_secret_enc = NULL, totp_pending_enc = NULL, totp_enabled_at = NULL, totp_recovery = NULL, totp_last_step = 0').run(hash).changes;
    const sessions = db.prepare('UPDATE sessions SET revoked_at = ? WHERE revoked_at IS NULL').run(t).changes;
    const links = db.prepare('UPDATE invites SET revoked_at = ? WHERE used_at IS NULL AND revoked_at IS NULL').run(t).changes;
    // a copy made before the bug tokens existed has no such table
    const hasTokens = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'bug_tokens'").get() !== undefined;
    const tokens = hasTokens ? db.prepare('UPDATE bug_tokens SET revoked_at = ? WHERE revoked_at IS NULL').run(t).changes : 0;
    audit(db, { actorId: null, action: 'user.test_accounts', payload: { via: 'roster-cli', accounts, sessions, links, tokens } }, now);
    return { accounts, sessions, links, tokens };
  })();
  io.out(`${n.accounts} accounts: one test password, no authenticators; ${n.sessions} sessions ended, ${n.links} open links revoked, ${n.tokens} bug tokens revoked`);
  return 0;
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

function bugToken(rest: string[], db: DB, io: CliIO, now: Date): number {
  const [sub, ...args] = rest;
  const via = { via: 'roster-cli' };
  switch (sub) {
    case 'create': {
      let days = DEFAULT_DAYS;
      let label = '';
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--days' && args[i + 1] !== undefined) days = Number(args[++i]);
        else if (args[i] === '--label' && args[i + 1] !== undefined) label = args[++i]!;
        else {
          io.err(`roster-cli bug-token create: unexpected "${args[i]}"`);
          return 2;
        }
      }
      const t = createBugToken(db, { label, days }, now);
      if (!t.ok) {
        io.err(`roster-cli bug-token create: ${t.problem}`);
        return 2;
      }
      audit(db, { actorId: null, action: 'bugtoken.create', targetType: 'bug_token', targetId: t.id, payload: { ...via, days, label: label.slice(0, 60) } }, now);
      io.out(t.token);
      io.out(`(id ${t.id.slice(0, 8)}, good until ${t.expiresAt.slice(0, 10)} – the token is shown only now; it opens GET/PATCH /bugs and nothing else)`);
      return 0;
    }
    case 'list': {
      if (args.length) {
        io.err('usage: roster-cli bug-token list');
        return 2;
      }
      for (const t of listBugTokens(db, now)) {
        io.out(`${t.id.slice(0, 8)}\t${t.state}\t${t.label || '-'}\tuntil ${t.expiresAt.slice(0, 10)}\tlast used ${t.lastUsedAt ?? 'never'}`);
      }
      return 0;
    }
    case 'revoke': {
      if (args.length !== 1) {
        io.err('usage: roster-cli bug-token revoke <id>');
        return 2;
      }
      const r = revokeBugToken(db, args[0]!, now);
      if (!r.ok) {
        io.err(`roster-cli bug-token revoke: ${r.problem}`);
        return 3;
      }
      if (!r.already) audit(db, { actorId: null, action: 'bugtoken.revoke', targetType: 'bug_token', targetId: r.id, payload: via }, now);
      io.out(`${r.id.slice(0, 8)}: ${r.already ? 'was revoked already' : 'revoked'}`);
      return 0;
    }
    default:
      io.err('usage: roster-cli bug-token create [--days <n>] [--label <text>] | list | revoke <id>');
      return 2;
  }
}

function bugs(rest: string[], db: DB, io: CliIO): number {
  if (rest[0] === 'show') {
    if (rest.length !== 2) {
      io.err('usage: roster-cli bugs show <number>');
      return 2;
    }
    const row = bugByRef(db, rest[1]!);
    const bug = row ? oneBug(db, row.id) : null;
    if (!bug) {
      io.err(`roster-cli bugs show: there is no report "${rest[1]}"`);
      return 3;
    }
    // the copy of a warband is for the admin's screen and the bug token, not for a terminal's scrollback
    io.out(JSON.stringify({ ...bug, attachment: bug.attachment === null ? null : `warband copy, ${Math.round(JSON.stringify(bug.attachment).length / 1024)} KB (not printed)` }, null, 2));
    return 0;
  }
  let status = 'open';
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--status' && rest[i + 1] !== undefined) status = rest[++i]!;
    else {
      io.err(`roster-cli bugs: unexpected "${rest[i]}"`);
      return 2;
    }
  }
  if (status !== 'open' && status !== 'all' && !(STATUSES as readonly string[]).includes(status)) {
    io.err(`roster-cli bugs: status is open, all or one of ${STATUSES.join(', ')}`);
    return 2;
  }
  for (const b of listBugs(db, { status: status as 'open', limit: 200 })) {
    io.out(`#${b.number}\t${b.severity ?? '-'}\t${b.kind}\t${b.status}\t${plain(b.title, 80)}`);
  }
  return 0;
}

/** Somebody's text on a terminal: no control codes (an escape sequence could write on the screen), one line. */
const plain = (text: string, max: number) => [...text].map((c) => (c.codePointAt(0)! < 32 || (c.codePointAt(0)! >= 127 && c.codePointAt(0)! < 160) ? ' ' : c)).join('').replace(/\s+/g, ' ').trim().slice(0, max);
