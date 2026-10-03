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

  it('refuses before the server has made the accounts', () => {
    const data = dataDir();
    expect(run(['invite'], data)).toMatchObject({ code: 3, err: expect.stringMatching(/no database yet/) });
    const db = openDb(join(data, 'roster.sqlite'));
    migrate(db, loadMigrations().slice(0, 1), clock().now);
    db.close();
    expect(run(['users'], data)).toMatchObject({ code: 3, err: expect.stringMatching(/no accounts yet/) });
  });
});
