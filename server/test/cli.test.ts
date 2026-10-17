/* roster-cli, as roster-deploy and the backup timer use it. */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCli } from '../src/cli.ts';
import { getMeta, openDb } from '../src/db.ts';
import { loadMigrations, migrate } from '../src/migrations.ts';
import { ORIGIN, PASSWORD, startAccounts } from './accounts-helpers.ts';
import { clock, dataDir, SCHEMA, startServer, tmpDir } from './helpers.ts';

function cli(args: string[], data: string, now = clock().now) {
  const out: string[] = [];
  const err: string[] = [];
  const code = runCli(args, { DATA_DIR: data, ROSTER_VERSION: 'cli-test' }, { out: (l) => out.push(l), err: (l) => err.push(l) }, now);
  return { code, out: out.join('\n'), err: err.join('\n') };
}

describe('roster-cli', () => {
  it('refuses to work without the marker file, and creates nothing', () => {
    const empty = tmpDir();
    for (const args of [['backup'], ['schema-version'], ['info'], ['epoch', 'renew']]) {
      const r = cli(args, empty);
      expect(r.code, args.join(' ')).toBe(1);
      expect(r.err).toMatch(/\.roster-volume is missing/);
    }
    expect(readdirSync(empty)).toEqual([]);
  });

  it('before the first start: schema 0, nothing to back up', () => {
    const data = dataDir();
    expect(cli(['schema-version'], data)).toMatchObject({ code: 0, out: '0' });
    expect(cli(['backup'], data)).toMatchObject({ code: 3 });
    expect(JSON.parse(cli(['info'], data).out)).toEqual({ version: 'cli-test', database: null, snapshots: [] });
    expect(existsSync(join(data, 'roster.sqlite'))).toBe(false);
  });

  it('backs up the running database and prints the file name', async () => {
    const s = await startServer();
    const r = cli(['backup', '--label', 'pre-deploy-9cfc4ab'], s.data);
    expect(r.code).toBe(0);
    expect(r.out).toBe('20260930T120000Z-pre-deploy-9cfc4ab.sqlite');
    expect(readdirSync(join(s.data, 'snapshots'))).toEqual([r.out]);
    expect(cli(['backup', '--label', '../../etc'], s.data).code).toBe(1);
    expect(cli(['backup', '--nonsense'], s.data).code).toBe(2);
  });

  it('schema-version and info', async () => {
    const s = await startServer();
    expect(cli(['schema-version'], s.data)).toMatchObject({ code: 0, out: String(SCHEMA) });
    const info = JSON.parse(cli(['info'], s.data).out) as { database: { schema: number; expected: number; epoch: string } };
    expect(info.database).toMatchObject({ schema: SCHEMA, expected: SCHEMA, epoch: getMeta(s.db, 'epoch') });
  });

  it('epoch renew changes what health reports', async () => {
    const s = await startServer();
    const before = getMeta(s.db, 'epoch');
    const r = cli(['epoch', 'renew'], s.data);
    expect(r.code).toBe(0);
    expect(r.out).not.toBe(before);
    const health = (await (await fetch(`${s.url}/api/v1/health`)).json()) as { epoch: string };
    expect(health.epoch).toBe(r.out);
    expect(cli(['epoch'], s.data).code).toBe(2);
  });

  it('usage', () => {
    expect(cli([], dataDir()).code).toBe(2);
    expect(cli(['help'], dataDir())).toMatchObject({ code: 0 });
    expect(cli(['drop-everything'], dataDir()).code).toBe(2);
  });
});

describe('roster-cli: accounts', () => {
  const env = (data: string) => ({ DATA_DIR: data, ROSTER_VERSION: 'cli-test', PUBLIC_ORIGIN: ORIGIN });
  const run = (args: string[], data: string, now = clock().now) => {
    const out: string[] = [];
    const err: string[] = [];
    const code = runCli(args, env(data), { out: (l) => out.push(l), err: (l) => err.push(l) }, now);
    return { code, out: out.join('\n'), err: err.join('\n') };
  };

  it('invite --admin: a link that makes the first admin; only its hash is stored', async () => {
    const s = await startAccounts();
    const r = run(['invite', '--admin', '--note', 'Rob himself'], s.data);
    expect(r.code).toBe(0);
    const m = /^http:\/\/mordheim\.test\/invite#([\w-]{43})$/.exec(r.out);
    expect(m).not.toBeNull();
    const token = m![1]!;
    expect(JSON.stringify(s.db.prepare('SELECT * FROM invites').all())).not.toContain(token);
    const reg = await s.call({ url: '/api/v1/invites/accept', body: { token, username: 'rob', password: PASSWORD } });
    expect(reg.json()).toMatchObject({ user: { isAdmin: true } });
    const audit = s.db.prepare('SELECT action, actor_id, payload FROM audit_log ORDER BY seq').all() as { action: string; actor_id: string | null; payload: string }[];
    expect(audit[0]).toMatchObject({ action: 'invite.create', actor_id: null });
    expect(JSON.parse(audit[0]!.payload)).toEqual({ via: 'roster-cli', admin: true, note: 'Rob himself' });
    expect(run(['invite', '--nonsense'], s.data).code).toBe(2);
  });

  it('reset, sign-out, totp-reset and users', async () => {
    const s = await startAccounts();
    const p = await s.user('player', { totp: true });
    p.session();
    const reset = run(['reset', 'Player'], s.data);
    expect(reset.out).toMatch(/^http:\/\/mordheim\.test\/reset#[\w-]{43}$/);
    expect(run(['reset', 'nobody'], s.data)).toMatchObject({ code: 3, err: expect.stringMatching(/no account "nobody"/) });
    expect(run(['reset'], s.data).code).toBe(2);

    expect(run(['users'], s.data).out).toBe('player\ttotp\t1 devices\tlast seen 2026-09-30T12:00:00.000Z');
    const second = p.session();
    expect(run(['sign-out', 'player'], s.data).out).toBe('player: 2 sessions ended');
    expect((await s.call({ url: '/api/v1/auth/me', token: second })).json()).toMatchObject({ user: null });
    const third = p.session();
    expect(run(['totp-reset', 'player'], s.data)).toMatchObject({ code: 0, out: 'player: authenticator removed, signed out everywhere' });
    expect(p.row().totp_enabled_at).toBeNull();
    expect((await s.call({ url: '/api/v1/auth/me', token: third })).json()).toMatchObject({ user: null });
    expect(run(['users'], s.data).out).toBe('player\t-\t0 devices\tlast seen 2026-09-30T12:00:00.000Z');
  });

  it('test-accounts, on the test instance after the nightly restore (security review OPS-3): one test password for every account, no authenticators, no sessions, no open links', async () => {
    const s = await startAccounts();
    const player = await s.user('player', { totp: true });
    await s.user('boss', { admin: true, totp: true });
    const token = player.session();
    const link = /#([\w-]{43})$/.exec(run(['invite'], s.data).out)![1]!;
    const bugToken = run(['bug-token', 'create', '--label', 'cloud'], s.data).out.split('\n')[0]!;
    expect((await s.call({ url: '/api/v1/bugs', origin: null, headers: { authorization: `Bearer ${bugToken}` } })).statusCode).toBe(200);
    const TEST = 'staging test password 1';
    const staged = (input: string, staging = true) => {
      const out: string[] = [];
      const err: string[] = [];
      const code = runCli(['test-accounts'], { ...env(s.data), ...(staging ? { ROSTER_STAGING: '1' } : {}) }, { out: (l) => out.push(l), err: (l) => err.push(l), input: () => input }, clock().now);
      return { code, out: out.join('\n'), err: err.join('\n') };
    };
    // anywhere but the test instance: refused, nothing changed
    expect(staged(`${TEST}\n`, false)).toMatchObject({ code: 2, err: expect.stringMatching(/only on the test instance/) });
    expect(player.row().totp_enabled_at).not.toBeNull();
    expect(staged('short\n')).toMatchObject({ code: 2, err: expect.stringMatching(/the test password/) });
    expect(player.row().totp_enabled_at).not.toBeNull();

    const r = staged(`${TEST}\n`);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/^2 accounts: one test password, no authenticators; \d+ sessions ended, 1 open links revoked, 1 bug tokens revoked$/);
    // the bug token of production does not open anything here
    expect((await s.call({ url: '/api/v1/bugs', origin: null, headers: { authorization: `Bearer ${bugToken}` } })).statusCode).toBe(401);
    expect(player.row()).toMatchObject({ totp_enabled_at: null, totp_secret_enc: null, totp_recovery: null });
    expect(s.db.prepare('SELECT count(*) AS n FROM sessions WHERE revoked_at IS NULL').get()).toEqual({ n: 0 });
    expect((await s.call({ url: '/api/v1/auth/me', token })).json()).toMatchObject({ user: null });
    // the test password signs in, production's no longer does
    expect((await s.call({ url: '/api/v1/auth/login', body: { username: 'player', password: TEST } })).statusCode).toBe(200);
    expect((await s.call({ url: '/api/v1/auth/login', body: { username: 'boss', password: PASSWORD } })).statusCode).toBe(401);
    // a link sent for production does nothing here
    expect((await s.call({ url: '/api/v1/invites/accept', body: { token: link, username: 'newcomer', password: PASSWORD } })).json()).toMatchObject({ error: 'invalid_link' });
    // logged, never the password
    const row = s.db.prepare("SELECT actor_id, payload FROM audit_log WHERE action = 'user.test_accounts'").get() as { actor_id: string | null; payload: string };
    expect(row.actor_id).toBeNull();
    expect(JSON.parse(row.payload)).toMatchObject({ via: 'roster-cli', accounts: 2, links: 1, tokens: 1 });
    expect(JSON.stringify(s.db.prepare('SELECT * FROM audit_log').all())).not.toContain(TEST);
    expect(JSON.stringify(s.db.prepare('SELECT * FROM audit_log').all())).not.toContain(bugToken);
  });

  it('bug-token: create prints the token once, list and revoke work with the start of the id, and only the hash is stored', async () => {
    const s = await startAccounts();
    const made = run(['bug-token', 'create', '--days', '10', '--label', 'cloud session'], s.data);
    expect(made.code).toBe(0);
    const [token, note] = made.out.split('\n');
    expect(token).toMatch(/^rbt_[\w-]{43}$/);
    const id = /\(id ([0-9a-f]{8}), good until 2026-10-10 /.exec(note!)![1]!;
    expect(JSON.stringify(s.db.prepare('SELECT * FROM bug_tokens').all())).not.toContain(token);
    expect((await s.call({ url: '/api/v1/bugs', origin: null, headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(200);
    const list = run(['bug-token', 'list'], s.data).out;
    expect(list).toMatch(new RegExp(`^${id}\\tgood\\tcloud session\\tuntil 2026-10-10\\tlast used 2026-09-30T12:00:00.000Z$`));
    expect(list).not.toContain(token);
    expect(run(['bug-token', 'revoke', id], s.data)).toMatchObject({ code: 0, out: `${id}: revoked` });
    expect(run(['bug-token', 'revoke', id], s.data)).toMatchObject({ code: 0, out: `${id}: was revoked already` });
    expect(run(['bug-token', 'list'], s.data).out).toMatch(/\trevoked\t/);
    expect((await s.call({ url: '/api/v1/bugs', origin: null, headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(401);
    // logged with who made it and how long, never the token
    const log = s.db.prepare("SELECT action, actor_id, payload FROM audit_log WHERE action LIKE 'bugtoken.%' ORDER BY seq").all() as { action: string; actor_id: string | null; payload: string }[];
    expect(log.map((l) => l.action)).toEqual(['bugtoken.create', 'bugtoken.revoke']);
    expect(log.every((l) => l.actor_id === null)).toBe(true);
    expect(JSON.parse(log[0]!.payload)).toEqual({ via: 'roster-cli', days: 10, label: 'cloud session' });
    expect(JSON.stringify(log)).not.toContain(token);
  });

  it('bug-token: refuses what makes no sense, and says why', async () => {
    const s = await startAccounts();
    expect(run(['bug-token', 'create', '--days', '0'], s.data)).toMatchObject({ code: 2, err: expect.stringMatching(/days is 1 to 180/) });
    expect(run(['bug-token', 'create', '--days', '181'], s.data).code).toBe(2);
    expect(run(['bug-token', 'create', '--nonsense'], s.data).code).toBe(2);
    expect(run(['bug-token'], s.data).code).toBe(2);
    expect(run(['bug-token', 'revoke'], s.data).code).toBe(2);
    expect(run(['bug-token', 'revoke', 'zz'], s.data)).toMatchObject({ code: 3, err: expect.stringMatching(/at least 6 characters/) });
    expect(run(['bug-token', 'revoke', 'abcdef'], s.data)).toMatchObject({ code: 3, err: expect.stringMatching(/no token starts with/) });
    for (let i = 0; i < 5; i++) expect(run(['bug-token', 'create'], s.data).code).toBe(0);
    expect(run(['bug-token', 'create'], s.data)).toMatchObject({ code: 2, err: expect.stringMatching(/5 tokens are good already/) });
    expect(s.db.prepare('SELECT count(*) AS n FROM bug_tokens').get()).toEqual({ n: 5 });
  });

  it('bugs: the list, and one report as JSON without printing the warband', async () => {
    const s = await startAccounts();
    const anna = await s.user('anna');
    const send = (title: string, extra: Record<string, unknown> = {}) => s.call({
      method: 'POST', url: '/api/v1/bugs', token: anna.session(),
      body: { id: crypto.randomUUID(), kind: 'bug', title, text: 'ZEBRA text', ...extra },
    });
    await send('Gold drifts\u001b[2J after the battle', { attach: { warbandId: crypto.randomUUID(), rev: 1, save: { name: 'ATTACH-ZEBRA', models: [] } } });
    await send('The tooltip says five', { kind: 'rules', sourceRef: 'https://mordheimer.net/x' });
    s.db.prepare("UPDATE bugs SET status = 'fixed', fixed_in = 'f00dbee' WHERE number = 2").run();
    const open = run(['bugs'], s.data);
    expect(open.code).toBe(0);
    // somebody's text on a terminal: the escape code is gone
    expect(open.out).toBe('#1\t-\tbug\tnew\tGold drifts [2J after the battle');
    expect(run(['bugs', '--status', 'all'], s.data).out.split('\n')).toHaveLength(2);
    expect(run(['bugs', '--status', 'fixed'], s.data).out).toMatch(/^#2\t-\trules\tfixed\t/);
    expect(run(['bugs', '--status', 'nonsense'], s.data).code).toBe(2);
    const shown = run(['bugs', 'show', '1'], s.data);
    expect(shown.code).toBe(0);
    expect(JSON.parse(shown.out)).toMatchObject({ number: 1, text: 'ZEBRA text', reporterName: 'anna' });
    expect(shown.out).toMatch(/warband copy, \d+ KB \(not printed\)/);
    expect(shown.out).not.toContain('ATTACH-ZEBRA');
    expect(run(['bugs', 'show', '9'], s.data)).toMatchObject({ code: 3, err: expect.stringMatching(/there is no report/) });
    expect(run(['bugs', 'show'], s.data).code).toBe(2);
  });

  it('refuses before the server has made the accounts', () => {
    const data = dataDir();
    expect(run(['invite'], data)).toMatchObject({ code: 3, err: expect.stringMatching(/no database yet/) });
    const db = openDb(join(data, 'roster.sqlite'));
    migrate(db, loadMigrations().slice(0, 1), clock().now);
    db.close();
    expect(run(['users'], data)).toMatchObject({ code: 3, err: expect.stringMatching(/no accounts yet/) });
  });

  it('a copy of production from before the report numbers and the bug token: the new commands wait for the server, test-accounts still works', () => {
    const data = dataDir();
    const db = openDb(join(data, 'roster.sqlite'));
    migrate(db, loadMigrations().slice(0, 21), clock().now);
    db.close();
    expect(run(['bugs'], data)).toMatchObject({ code: 3, err: expect.stringMatching(/not at schema 22 yet/) });
    expect(run(['bug-token', 'list'], data)).toMatchObject({ code: 3, err: expect.stringMatching(/not at schema 23 yet/) });
    const out: string[] = [];
    const code = runCli(['test-accounts'], { ...env(data), ROSTER_STAGING: '1' }, { out: (l) => out.push(l), err: (l) => out.push(l), input: () => 'staging test password 1\n' }, clock().now);
    expect(code, out.join('\n')).toBe(0);
    expect(out.join('\n')).toMatch(/0 bug tokens revoked/);
  });
});
