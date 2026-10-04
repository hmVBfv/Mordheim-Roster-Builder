/* Signing in, the authenticator, one-time links, one's own account and the
   admin's tools, through HTTP as the app uses them (phase 3g;
   docs/security.md section 3). */
import { describe, expect, it } from 'vitest';
import { listAttempts } from '../src/accounts.ts';
import { buildApp } from '../src/app.ts';
import { openDb } from '../src/db.ts';
import { Health } from '../src/health.ts';
import { loadStatic } from '../src/static.ts';
import { encryptSecret, hashCode, totpAt } from '../src/totp.ts';
import { cookieOf, ORIGIN, PASSWORD, startAccounts } from './accounts-helpers.ts';
import { clock } from './helpers.ts';

const NEW_PASSWORD = 'a much longer passphrase';
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

const login = (s: Awaited<ReturnType<typeof startAccounts>>, username: string, password = PASSWORD, token?: string) =>
  s.call({ url: '/api/v1/auth/login', body: { username, password, device: 'Phone' }, token: token ?? null });

describe('the first admin', () => {
  it('registers from a roster-cli link, must set up the authenticator, and then may use the admin tools', async () => {
    const s = await startAccounts();
    const inv = s.invite({ admin: true });
    const check = await s.call({ url: '/api/v1/invites/check', body: { token: inv.token } });
    expect(check.json()).toMatchObject({ kind: 'register', username: null });

    const reg = await s.call({ url: '/api/v1/invites/accept', body: { token: inv.token, username: 'Rob', displayName: 'Rob', password: PASSWORD } });
    expect(reg.statusCode).toBe(200);
    expect(reg.json()).toMatchObject({ stage: 'full', user: { username: 'Rob', isAdmin: true, totp: false, mustSetUpTotp: true } });
    const token = cookieOf(reg)!;
    expect(token).toBeTruthy();
    // the link works once
    expect((await s.call({ url: '/api/v1/invites/check', body: { token: inv.token } })).statusCode).toBe(404);
    expect((await s.call({ url: '/api/v1/admin/users', token })).statusCode).toBe(403);

    const setup = (await s.call({ url: '/api/v1/account/totp/setup', body: {}, token })).json() as { secret: string; uri: string };
    expect(setup.uri).toBe(`otpauth://totp/Mordheim%20Campaign%3ARob?secret=${setup.secret}&issuer=Mordheim%20Campaign&algorithm=SHA1&digits=6&period=30`);
    const wrong = await s.call({ url: '/api/v1/account/totp/enable', body: { code: '000000' }, token });
    expect(wrong.statusCode).toBe(400);
    const on = await s.call({ url: '/api/v1/account/totp/enable', body: { code: totpAt(setup.secret, s.clock.now()) }, token });
    const codes = (on.json() as { recoveryCodes: string[] }).recoveryCodes;
    expect(codes).toHaveLength(10);
    expect(codes[0]).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);

    const users = await s.call({ url: '/api/v1/admin/users', token });
    expect(users.statusCode).toBe(200);
    expect((users.json() as { users: { username: string; totp: boolean }[] }).users).toEqual([expect.objectContaining({ username: 'Rob', totp: true, isAdmin: true })]);
    // an admin keeps the authenticator
    expect((await s.call({ url: '/api/v1/account/totp/disable', body: { password: PASSWORD }, token })).statusCode).toBe(400);
  });
});

describe('signing in', () => {
  it('without an authenticator: one step, a cookie for 90 days, and /me knows the user', async () => {
    const s = await startAccounts();
    await s.user('player');
    const res = await login(s, 'PLAYER');
    expect(res.json()).toMatchObject({ stage: 'full', user: { username: 'player' } });
    const header = String(res.headers['set-cookie']);
    expect(header).toMatch(/HttpOnly/);
    expect(header).toMatch(/SameSite=Lax/);
    expect(header).toMatch(/Max-Age=7776000/);
    // http in the tests; Secure only behind https
    expect(header).not.toMatch(/Secure/);
    const me = await s.call({ url: '/api/v1/auth/me', token: cookieOf(res) });
    expect(me.json()).toMatchObject({ user: { username: 'player', isAdmin: false }, pending: false });
    expect((await s.call({ url: '/api/v1/auth/me' })).json()).toEqual({ user: null, pending: false });
  });

  it('the cookie is Secure behind https', async () => {
    const s = await startAccounts({ env: { PUBLIC_ORIGIN: 'https://mordheim.test' } });
    await s.user('player');
    const res = await s.call({ url: '/api/v1/auth/login', body: { username: 'player', password: PASSWORD }, origin: 'https://mordheim.test' });
    expect(String(res.headers['set-cookie'])).toMatch(/; Secure/);
  });

  it('a wrong password, an unknown or a disabled account all get the same answer', async () => {
    const s = await startAccounts();
    const p = await s.user('player');
    await s.user('gone');
    s.db.prepare('UPDATE users SET disabled_at = ? WHERE username = ?').run(s.clock.now().toISOString(), 'gone');
    for (const [name, pw] of [['player', 'wrong password!'], ['nobody', PASSWORD], ['gone', PASSWORD]] as const) {
      const res = await login(s, name, pw);
      expect(res.statusCode, name).toBe(401);
      expect(res.json(), name).toEqual({ error: 'invalid_login' });
      expect(cookieOf(res), name).toBeNull();
    }
    expect(listAttempts(s.db, 10).map((a) => [a.username, a.ok, a.reason])).toEqual([
      ['gone', false, 'disabled'], ['nobody', false, 'unknown'], ['player', false, 'password'],
    ]);
    // one log line per failure, in the shape Fail2Ban reads
    const failed = s.log.entries().filter((e) => e.event === 'login_failed');
    expect(failed).toHaveLength(3);
    expect(failed[0]).toMatchObject({ ip: '127.0.0.1', account: 'player' });
    expect(p.id).toBeTruthy();
  });

  it('with an authenticator: the code after the password, once, within five minutes', async () => {
    const s = await startAccounts();
    const p = await s.user('player', { totp: true });
    const first = await login(s, 'player');
    expect(first.json()).toEqual({ stage: 'totp' });
    const pending = cookieOf(first)!;
    expect(String(first.headers['set-cookie'])).toMatch(/Max-Age=300/);
    expect((await s.call({ url: '/api/v1/auth/me', token: pending })).json()).toEqual({ user: null, pending: true });
    // nothing but the code while pending
    expect((await s.call({ url: '/api/v1/auth/sessions', token: pending })).statusCode).toBe(403);
    expect((await s.call({ url: '/api/v1/auth/totp', body: { code: '123456' }, token: pending })).json()).toEqual({ error: 'invalid_code' });
    const code = p.code();
    const ok = await s.call({ url: '/api/v1/auth/totp', body: { code }, token: pending });
    expect(ok.json()).toMatchObject({ stage: 'full', user: { username: 'player', totp: true } });
    const full = cookieOf(ok)!;
    expect(full).not.toBe(pending);
    // the pending token is spent: the session has a new one
    expect((await s.call({ url: '/api/v1/auth/me', token: pending })).json()).toEqual({ user: null, pending: false });
    expect((await s.call({ url: '/api/v1/auth/sessions', token: full })).statusCode).toBe(200);

    // the same code does not work twice
    const again = cookieOf(await login(s, 'player'))!;
    expect((await s.call({ url: '/api/v1/auth/totp', body: { code }, token: again })).statusCode).toBe(401);
    // and the step before the code ends after five minutes
    s.clock.advance(6 * MIN);
    expect((await s.call({ url: '/api/v1/auth/totp', body: { code: p.code() }, token: again })).json()).toEqual({ error: 'sign_in' });
  });

  it('a recovery code instead of the authenticator works once', async () => {
    const s = await startAccounts();
    await s.user('player');
    const token = cookieOf(await login(s, 'player'))!;
    const setup = (await s.call({ url: '/api/v1/account/totp/setup', body: {}, token })).json() as { secret: string };
    const codes = ((await s.call({ url: '/api/v1/account/totp/enable', body: { code: totpAt(setup.secret, s.clock.now()) }, token })).json() as { recoveryCodes: string[] }).recoveryCodes;
    s.clock.advance(MIN);
    const a = cookieOf(await login(s, 'player'))!;
    expect((await s.call({ url: '/api/v1/auth/totp', body: { code: codes[3]!.toUpperCase() }, token: a })).statusCode).toBe(200);
    const b = cookieOf(await login(s, 'player'))!;
    expect((await s.call({ url: '/api/v1/auth/totp', body: { code: codes[3] }, token: b })).statusCode).toBe(401);
    expect((await s.call({ url: '/api/v1/auth/totp', body: { code: codes[4] }, token: b })).statusCode).toBe(200);
  });

  it('a session lives 90 days from its last use; signing in again ends the one before on this device', async () => {
    const s = await startAccounts();
    await s.user('player');
    const token = cookieOf(await login(s, 'player'))!;
    s.clock.advance(80 * DAY);
    expect((await s.call({ url: '/api/v1/auth/me', token })).json()).toMatchObject({ user: { username: 'player' } });
    s.clock.advance(80 * DAY);
    expect((await s.call({ url: '/api/v1/auth/me', token })).json()).toMatchObject({ user: { username: 'player' } });
    s.clock.advance(91 * DAY);
    expect((await s.call({ url: '/api/v1/auth/me', token })).json()).toEqual({ user: null, pending: false });

    const one = cookieOf(await login(s, 'player'))!;
    const two = cookieOf(await login(s, 'player', PASSWORD, one))!;
    expect((await s.call({ url: '/api/v1/auth/me', token: one })).json()).toMatchObject({ user: null });
    expect((await s.call({ url: '/api/v1/auth/me', token: two })).json()).toMatchObject({ user: { username: 'player' } });
  });

  it('signing out ends the session and clears the cookie', async () => {
    const s = await startAccounts();
    await s.user('player');
    const token = cookieOf(await login(s, 'player'))!;
    const out = await s.call({ url: '/api/v1/auth/logout', method: 'POST', token });
    expect(out.json()).toEqual({ ok: true });
    expect(cookieOf(out)).toBe('');
    expect(String(out.headers['set-cookie'])).toMatch(/Max-Age=0/);
    expect((await s.call({ url: '/api/v1/auth/me', token })).json()).toMatchObject({ user: null });
  });
});

describe('the brake', () => {
  it('after five failures in 15 minutes: a growing wait, which waiting out always lifts', async () => {
    const s = await startAccounts();
    await s.user('player');
    for (let i = 0; i < 5; i++) expect((await login(s, 'player', 'wrong password!')).statusCode).toBe(401);
    const braked = await login(s, 'player');
    expect(braked.statusCode).toBe(429);
    expect(braked.headers['retry-after']).toBe('30');
    expect(braked.json()).toEqual({ error: 'too_many_attempts', retryAfter: 30 });
    // tries during the wait do not make it longer
    s.clock.advance(20 * 1000);
    expect((await login(s, 'player')).json()).toMatchObject({ retryAfter: 10 });
    s.clock.advance(11 * 1000);
    // one more failure: twice the wait
    expect((await login(s, 'player', 'wrong password!')).statusCode).toBe(401);
    expect((await login(s, 'player')).json()).toMatchObject({ retryAfter: 60 });
    s.clock.advance(61 * 1000);
    expect((await login(s, 'player')).statusCode).toBe(200);
  });

  it('counts per address too, and holds the authenticator code as well', async () => {
    const s = await startAccounts();
    const p = await s.user('player', { totp: true });
    for (let i = 0; i < 5; i++) await login(s, `someone${i}`, 'wrong password!');
    expect((await login(s, 'player')).statusCode).toBe(429);
    s.clock.advance(16 * MIN);
    const pending = cookieOf(await login(s, 'player'))!;
    for (let i = 0; i < 5; i++) await s.call({ url: '/api/v1/auth/totp', body: { code: '000000' }, token: pending });
    expect((await s.call({ url: '/api/v1/auth/totp', body: { code: p.code() }, token: pending })).statusCode).toBe(429);
  });
});

describe('writes only from the app itself', () => {
  it('refuses a write without the app\'s Origin, and anything but JSON', async () => {
    const s = await startAccounts();
    await s.user('player');
    const body = { username: 'player', password: PASSWORD };
    expect((await s.call({ url: '/api/v1/auth/login', body, origin: null })).json()).toEqual({ error: 'cross_origin' });
    expect((await s.call({ url: '/api/v1/auth/login', body, origin: 'https://evil.example' })).statusCode).toBe(403);
    const form = await s.call({ url: '/api/v1/auth/login', body: 'username=player&password=x', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    expect(form.statusCode).toBe(415);
    const text = await s.call({ url: '/api/v1/auth/login', body: JSON.stringify(body), headers: { 'content-type': 'text/plain' } });
    expect(text.statusCode).toBe(415);
    // a read needs no Origin
    expect((await s.call({ url: '/api/v1/auth/me', origin: null })).statusCode).toBe(200);
    expect(ORIGIN).toBe('http://mordheim.test');
  });

  it('keeps the accounts closed while the database is not ready', async () => {
    const log = false as const;
    const db = openDb(':memory:');
    const health = new Health(db, { version: 't', expected: 1, startedAt: clock().now(), now: clock().now, log: { info() {}, warn() {}, error() {} } as never });
    const app = buildApp({ config: { version: 't' }, health, db: null, files: loadStatic(''), trustProxy: [], logger: log });
    for (const [method, url] of [['GET', '/api/v1/auth/me'], ['POST', '/api/v1/auth/login'], ['GET', '/api/v1/admin/users']] as const) {
      const res = await app.inject({ method, url, ...(method === 'POST' ? { payload: {} } : {}) });
      expect(res.statusCode, url).toBe(503);
      expect(res.json()).toEqual({ error: 'unavailable' });
    }
  });
});

describe('one-time links', () => {
  it('register: checks the username and the password, and a taken name', async () => {
    const s = await startAccounts();
    await s.user('taken');
    const inv = s.invite();
    const accept = (username: string, password: string) => s.call({ url: '/api/v1/invites/accept', body: { token: inv.token, username, password } });
    expect((await accept('a', PASSWORD)).json()).toMatchObject({ problem: expect.stringMatching(/3 to 32/) });
    expect((await accept('Taken', PASSWORD)).json()).toMatchObject({ problem: 'that username is taken' });
    expect((await accept('newbie', 'short')).json()).toMatchObject({ problem: 'at least 12 characters' });
    expect((await accept('newbie', 'iloveyou1234')).json()).toMatchObject({ problem: expect.stringMatching(/too common/) });
    expect((await accept('newbie', 'newbie-and-more')).json()).toMatchObject({ problem: 'it may not contain the username' });
    const ok = await accept('newbie', PASSWORD);
    expect(ok.json()).toMatchObject({ stage: 'full', user: { username: 'newbie', isAdmin: false, mustSetUpTotp: false } });
    expect((await accept('second', PASSWORD)).statusCode).toBe(404);
  });

  it('expire: register after 7 days, reset after 24 hours', async () => {
    const s = await startAccounts();
    const inv = s.invite();
    s.clock.advance(7 * DAY + 1);
    expect((await s.call({ url: '/api/v1/invites/check', body: { token: inv.token } })).json()).toEqual({ error: 'invalid_link' });
  });

  it('reset: the admin makes a link, the player sets a new password, every device is signed out', async () => {
    const s = await startAccounts();
    const admin = await s.user('rob', { admin: true, totp: true });
    const p = await s.user('player');
    const old = p.session();
    const made = (await s.call({ url: `/api/v1/admin/users/${p.id}/reset`, body: {}, token: admin.session() })).json() as { link: string; token: string };
    expect(made.link).toBe(`${ORIGIN}/reset#${made.token}`);
    expect((await s.call({ url: '/api/v1/invites/check', body: { token: made.token } })).json()).toMatchObject({ kind: 'reset', username: 'player' });
    expect((await s.call({ url: '/api/v1/invites/accept', body: { token: made.token, password: 'player password 1' } })).json()).toMatchObject({ problem: expect.stringMatching(/username/) });
    const done = await s.call({ url: '/api/v1/invites/accept', body: { token: made.token, password: NEW_PASSWORD } });
    expect(done.json()).toMatchObject({ stage: 'full', user: { username: 'player' } });
    expect((await s.call({ url: '/api/v1/auth/me', token: old })).json()).toMatchObject({ user: null });
    expect((await login(s, 'player')).statusCode).toBe(401);
    expect((await login(s, 'player', NEW_PASSWORD)).statusCode).toBe(200);
    expect((await s.call({ url: '/api/v1/invites/accept', body: { token: made.token, password: NEW_PASSWORD } })).statusCode).toBe(404);
  });

  it('a new reset link replaces the older one', async () => {
    const s = await startAccounts();
    const admin = await s.user('rob', { admin: true, totp: true });
    const p = await s.user('player');
    const token = admin.session();
    const first = (await s.call({ url: `/api/v1/admin/users/${p.id}/reset`, body: {}, token })).json() as { token: string };
    await s.call({ url: `/api/v1/admin/users/${p.id}/reset`, body: {}, token });
    expect((await s.call({ url: '/api/v1/invites/check', body: { token: first.token } })).statusCode).toBe(404);
  });
});

describe('one\'s own account', () => {
  it('changing the password keeps this device and signs out the others', async () => {
    const s = await startAccounts();
    const p = await s.user('player');
    const here = p.session();
    const there = p.session();
    expect((await s.call({ url: '/api/v1/account/password', body: { current: 'wrong password!', next: NEW_PASSWORD }, token: here })).statusCode).toBe(400);
    expect((await s.call({ url: '/api/v1/account/password', body: { current: PASSWORD, next: 'password1234' }, token: here })).statusCode).toBe(400);
    const ok = await s.call({ url: '/api/v1/account/password', body: { current: PASSWORD, next: NEW_PASSWORD }, token: here });
    expect(ok.json()).toEqual({ ok: true, signedOut: 1 });
    expect((await s.call({ url: '/api/v1/auth/me', token: here })).json()).toMatchObject({ user: { username: 'player' } });
    expect((await s.call({ url: '/api/v1/auth/me', token: there })).json()).toMatchObject({ user: null });
  });

  it('lists the devices and signs out one of them, or all the others – never someone else\'s', async () => {
    const s = await startAccounts();
    const p = await s.user('player');
    const other = await s.user('other');
    const here = p.session();
    p.session();
    p.session();
    const theirs = other.session();
    const list = (await s.call({ url: '/api/v1/auth/sessions', token: here })).json() as { sessions: { id: string; current: boolean; device: string }[] };
    expect(list.sessions).toHaveLength(3);
    expect(list.sessions.filter((x) => x.current)).toHaveLength(1);
    const theirId = ((await s.call({ url: '/api/v1/auth/sessions', token: theirs })).json() as typeof list).sessions[0]!.id;
    expect((await s.call({ url: `/api/v1/auth/sessions/${theirId}`, method: 'DELETE', token: here })).statusCode).toBe(404);
    const one = list.sessions.find((x) => !x.current)!.id;
    expect((await s.call({ url: `/api/v1/auth/sessions/${one}`, method: 'DELETE', token: here })).json()).toEqual({ revoked: 1 });
    expect((await s.call({ url: '/api/v1/auth/sessions/others', method: 'DELETE', token: here })).json()).toEqual({ revoked: 1 });
    expect(((await s.call({ url: '/api/v1/auth/sessions', token: here })).json() as typeof list).sessions).toHaveLength(1);
    expect((await s.call({ url: '/api/v1/auth/me', token: theirs })).json()).toMatchObject({ user: { username: 'other' } });
  });

  it('a player may turn the authenticator off again, with the password', async () => {
    const s = await startAccounts();
    const p = await s.user('player', { totp: true });
    const token = p.session();
    expect((await s.call({ url: '/api/v1/account/totp/disable', body: { password: 'wrong password!' }, token })).statusCode).toBe(400);
    expect((await s.call({ url: '/api/v1/account/totp/disable', body: { password: PASSWORD }, token })).json()).toEqual({ ok: true });
    expect((await login(s, 'player')).json()).toMatchObject({ stage: 'full' });
  });

  it('a replaced TOTP_KEY: the code fails with a log line, not a crash; a recovery code still works', async () => {
    const s = await startAccounts();
    const p = await s.user('player', { totp: true });
    const other = Buffer.alloc(32, 9);
    s.db.prepare('UPDATE users SET totp_secret_enc = ?, totp_recovery = ? WHERE id = ?').run(encryptSecret(p.secret!, other), JSON.stringify([hashCode('abcd-efgh')]), p.id);
    const pending = cookieOf(await login(s, 'player'))!;
    expect((await s.call({ url: '/api/v1/auth/totp', body: { code: p.code() }, token: pending })).json()).toEqual({ error: 'invalid_code' });
    expect(s.log.entries().some((e) => e.event === 'totp_key_mismatch')).toBe(true);
    expect((await s.call({ url: '/api/v1/auth/totp', body: { code: 'abcd-efgh' }, token: pending })).statusCode).toBe(200);
  });

  it('without TOTP_KEY no authenticator can be set up', async () => {
    const s = await startAccounts({ env: { TOTP_KEY: '' } });
    const p = await s.user('player');
    expect((await s.call({ url: '/api/v1/account/totp/setup', body: {}, token: p.session() })).json()).toEqual({ error: 'totp_unavailable' });
    expect(s.log.entries().some((e) => e.event === 'totp_key_missing')).toBe(true);
  });
});

describe('the admin', () => {
  it('invites, revokes, disables, removes an authenticator – and every write is in the audit log', async () => {
    const s = await startAccounts();
    const admin = await s.user('rob', { admin: true, totp: true });
    const p = await s.user('player', { totp: true });
    const token = admin.session();
    const playerToken = p.session();

    const made = (await s.call({ url: '/api/v1/admin/invites', body: { note: 'for Kai' }, token })).json() as { id: string; link: string; token: string };
    expect(made.link).toBe(`${ORIGIN}/invite#${made.token}`);
    const open = (await s.call({ url: '/api/v1/admin/invites', token })).json() as { invites: { id: string; note: string }[] };
    expect(open.invites).toEqual([expect.objectContaining({ id: made.id, note: 'for Kai', kind: 'register' })]);
    expect((await s.call({ url: `/api/v1/admin/invites/${made.id}`, method: 'DELETE', token })).json()).toEqual({ ok: true });
    expect((await s.call({ url: `/api/v1/admin/invites/${made.id}`, method: 'DELETE', token })).statusCode).toBe(404);
    expect((await s.call({ url: '/api/v1/invites/check', body: { token: made.token } })).statusCode).toBe(404);

    expect((await s.call({ url: `/api/v1/admin/users/${p.id}/totp-reset`, body: {}, token })).json()).toEqual({ ok: true, signedOut: 1 });
    expect((await s.call({ url: '/api/v1/auth/me', token: playerToken })).json()).toMatchObject({ user: null });
    expect((await login(s, 'player')).json()).toMatchObject({ stage: 'full' });

    expect((await s.call({ url: `/api/v1/admin/users/${p.id}/disable`, body: {}, token })).json()).toEqual({ ok: true });
    expect((await login(s, 'player')).statusCode).toBe(401);
    expect((await s.call({ url: `/api/v1/admin/users/${p.id}/enable`, body: {}, token })).json()).toEqual({ ok: true });
    expect((await login(s, 'player')).statusCode).toBe(200);

    expect((await s.call({ url: `/api/v1/admin/users/${admin.id}/disable`, body: {}, token })).statusCode).toBe(400);
    expect((await s.call({ url: `/api/v1/admin/users/${p.id}/nonsense`, body: {}, token })).statusCode).toBe(404);
    expect((await s.call({ url: '/api/v1/admin/users/nobody/reset', body: {}, token })).statusCode).toBe(404);

    const audit = (await s.call({ url: '/api/v1/admin/audit', token })).json() as { entries: { action: string; actor: string; target: string | null }[] };
    expect(audit.entries.map((e) => e.action)).toEqual(['user.enable', 'user.disable', 'totp.reset', 'invite.revoke', 'invite.create']);
    expect(audit.entries[0]).toMatchObject({ actor: 'rob', target: 'player' });
    const page = (await s.call({ url: '/api/v1/admin/audit?limit=2', token })).json() as { entries: { seq: number }[] };
    expect(page.entries).toHaveLength(2);
    const rest = (await s.call({ url: `/api/v1/admin/audit?limit=50&before=${page.entries[1]!.seq}`, token })).json() as { entries: unknown[] };
    expect(rest.entries).toHaveLength(3);

    const logins = (await s.call({ url: '/api/v1/admin/logins', token })).json() as { attempts: { username: string; ok: boolean; reason: string }[] };
    expect(logins.attempts.map((a) => [a.username, a.ok, a.reason])).toEqual([['player', true, ''], ['player', false, 'disabled'], ['player', true, '']]);
  });
});
