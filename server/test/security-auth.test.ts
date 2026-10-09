/* Signing in, after the security review of 09.10.2026 (docs/security-
   review.md, AUTH-…): what held only one request at a time now holds for
   requests at once; a second factor guards the second factor; somebody
   else's failures do not lock an account out. Each test was written to
   fail before its fix. */
import { describe, expect, it } from 'vitest';
import { createInvite, revokeInvite, useInvite } from '../src/accounts.ts';
import { HashBusyError, hashPassword, verifyPassword } from '../src/passwords.ts';
import { hashCode, newRecoveryCodes, totpAt } from '../src/totp.ts';
import { cookieOf, PASSWORD, startAccounts, TOTP_KEY } from './accounts-helpers.ts';

const MIN = 60 * 1000;
const from = (ip: string) => ({ 'x-forwarded-for': ip });

describe('requests at once', () => {
  it('AUTH-1: parallel wrong passwords for one account are checked one at a time – the brake holds', async () => {
    const s = await startAccounts();
    await s.user('player');
    const res = await Promise.all(Array.from({ length: 20 }, (_, i) => s.call({ url: '/api/v1/auth/login', body: { username: 'player', password: `wrong guess ${i}!!` } })));
    expect(res.filter((r) => r.statusCode === 401).length).toBeLessThanOrEqual(5);
    expect(res.filter((r) => r.statusCode === 429).length).toBeGreaterThanOrEqual(15);
  });

  it('AUTH-8: a crowd waiting for the password hash is answered "busy" at once instead of queueing for minutes', async () => {
    const cost = { N: 2 ** 12, r: 8, p: 1 };
    const stored = await hashPassword('a fine long password', cost);
    const all = await Promise.allSettled(Array.from({ length: 60 }, () => verifyPassword('wrong', stored)));
    const busy = all.filter((r) => r.status === 'rejected');
    expect(busy.length).toBeGreaterThan(0);
    expect(busy.every((r) => (r as PromiseRejectedResult).reason instanceof HashBusyError)).toBe(true);
    // and the server says so plainly: with the queue full, a sign-in is "busy"
    const s = await startAccounts();
    await s.user('player');
    const slow = await hashPassword('a fine long password', { N: 2 ** 14, r: 8, p: 1 });
    const crowd = Array.from({ length: 22 }, () => verifyPassword('wrong', slow).catch(() => false));
    const r = await s.call({ url: '/api/v1/auth/login', body: { username: 'player', password: PASSWORD } });
    expect([r.statusCode, r.headers['retry-after'], r.json()]).toEqual([503, '5', { error: 'busy' }]);
    await Promise.all(crowd);
    expect((await s.call({ url: '/api/v1/auth/login', body: { username: 'player', password: PASSWORD } })).statusCode).toBe(200);
  });

  it('AUTH-2: a reset link redeemed twice at once sets one password', async () => {
    const s = await startAccounts();
    const p = await s.user('player');
    const inv = createInvite(s.db, { kind: 'reset', createdBy: null, forUserId: p.id }, s.clock.now());
    const [a, b] = await Promise.all([
      s.call({ url: '/api/v1/invites/accept', body: { token: inv.token, password: 'first new password 1' } }),
      s.call({ url: '/api/v1/invites/accept', body: { token: inv.token, password: 'second new password 2' } }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 404]);
    expect(s.db.prepare("SELECT count(*) AS n FROM audit_log WHERE action = 'user.password_reset'").get()).toEqual({ n: 1 });
  });

  it('AUTH-2: a link is used up only if it is still good at that moment – revoked, used or expired meanwhile, it is not', () => {
    return (async () => {
      const s = await startAccounts();
      const p = await s.user('player');
      const t = s.clock.now();
      const revoked = createInvite(s.db, { kind: 'reset', createdBy: null, forUserId: p.id }, t);
      revokeInvite(s.db, revoked.id, t);
      expect(useInvite(s.db, revoked.id, t)).toBe(false);
      const good = createInvite(s.db, { kind: 'reset', createdBy: null, forUserId: p.id }, t);
      expect(useInvite(s.db, good.id, t)).toBe(true);
      expect(useInvite(s.db, good.id, t)).toBe(false);
      const late = s.invite();
      expect(useInvite(s.db, late.id, new Date(t.getTime() + 8 * 24 * 60 * MIN))).toBe(false);
    })();
  });

  it('AUTH-6: a password change from a session that was ended meanwhile is refused', async () => {
    const s = await startAccounts();
    const p = await s.user('player');
    const admin = await s.user('admin', { admin: true, totp: true });
    const stolen = p.session('full');
    const before = p.row().pw_hash;
    const [change] = await Promise.all([
      s.call({ url: '/api/v1/account/password', body: { current: PASSWORD, next: 'the thief owns this 42' }, token: stolen }),
      s.call({ url: `/api/v1/admin/users/${p.id}/sign-out`, body: {}, token: admin.session('full') }),
    ]);
    expect(change.statusCode).toBe(401);
    expect(p.row().pw_hash).toBe(before);
  });

  it('AUTH-13: two invites taking the same username at once – one account, the other told the name is taken', async () => {
    const s = await startAccounts();
    const [a, b] = [s.invite(), s.invite()];
    const res = await Promise.all([a, b].map((inv) => s.call({ url: '/api/v1/invites/accept', body: { token: inv.token, username: 'twin', password: 'a long new password 5' } })));
    expect(res.map((r) => r.statusCode).sort()).toEqual([200, 400]);
    expect(res.find((r) => r.statusCode === 400)!.json()).toEqual({ error: 'invalid', problem: 'that username is taken' });
  });
});

describe('the second factor guards itself', () => {
  it('AUTH-5: setting up the authenticator ends the sessions made with the password alone', async () => {
    const s = await startAccounts();
    const p = await s.user('player');
    const old = cookieOf(await s.call({ url: '/api/v1/auth/login', body: { username: 'player', password: PASSWORD } }))!;
    const mine = p.session('full');
    const { secret } = (await s.call({ url: '/api/v1/account/totp/setup', body: {}, token: mine })).json() as { secret: string };
    expect((await s.call({ url: '/api/v1/account/totp/enable', body: { code: totpAt(secret, s.clock.now()) }, token: mine })).statusCode).toBe(200);
    expect((await s.call({ url: '/api/v1/auth/me', token: old })).json()).toMatchObject({ user: null });
    expect((await s.call({ url: '/api/v1/campaigns', body: { name: 'By the old session' }, token: old })).statusCode).toBe(401);
    // the one that set it up stays
    expect((await s.call({ url: '/api/v1/auth/me', token: mine })).json()).toMatchObject({ user: { totp: true } });
  });

  it('AUTH-3: replacing the authenticator needs a code of the current one, or a recovery code', async () => {
    const s = await startAccounts();
    const p = await s.user('leader', { totp: true });
    const token = p.session('full');
    const before = p.row().totp_secret_enc;
    const { secret } = (await s.call({ url: '/api/v1/account/totp/setup', body: {}, token })).json() as { secret: string };
    const fresh = totpAt(secret, s.clock.now());
    expect((await s.call({ url: '/api/v1/account/totp/enable', body: { code: fresh }, token })).json()).toMatchObject({ error: 'invalid', problem: expect.stringMatching(/current authenticator/) });
    expect((await s.call({ url: '/api/v1/account/totp/enable', body: { code: fresh, current: '000000' }, token })).statusCode).toBe(400);
    expect(p.row().totp_secret_enc).toBe(before);
    expect((await s.call({ url: '/api/v1/account/totp/enable', body: { code: fresh, current: p.code() }, token })).statusCode).toBe(200);
    expect(p.row().totp_secret_enc).not.toBe(before);
  });

  it('AUTH-15: turning the authenticator off needs the password and a code', async () => {
    const s = await startAccounts();
    const p = await s.user('player', { totp: true });
    const token = p.session('full');
    expect((await s.call({ url: '/api/v1/account/totp/disable', body: { password: PASSWORD }, token })).statusCode).toBe(400);
    expect(p.row().totp_enabled_at).not.toBeNull();
    expect((await s.call({ url: '/api/v1/account/totp/disable', body: { password: PASSWORD, code: p.code() }, token })).statusCode).toBe(200);
    expect(p.row().totp_enabled_at).toBeNull();
  });

  it('AUTH-4: a wrong current password is a failed sign-in – the brake holds for changing the password and turning the authenticator off', async () => {
    const s = await startAccounts();
    const p = await s.user('player', { totp: true });
    const token = p.session('full');
    for (let i = 0; i < 5; i++) expect((await s.call({ url: '/api/v1/account/password', body: { current: `guess ${i} wrong!!`, next: 'another long password 9' }, token })).statusCode).toBe(400);
    expect((await s.call({ url: '/api/v1/account/password', body: { current: PASSWORD, next: 'another long password 9' }, token })).statusCode).toBe(429);
    expect((await s.call({ url: '/api/v1/account/totp/disable', body: { password: PASSWORD, code: p.code() }, token })).statusCode).toBe(429);
    s.clock.advance(16 * MIN);
    expect((await s.call({ url: '/api/v1/account/password', body: { current: PASSWORD, next: 'another long password 9' }, token })).statusCode).toBe(200);
  });

  it('AUTH-10: recovery codes are kept keyed with TOTP_KEY; codes kept the old way still work', async () => {
    const s = await startAccounts();
    const p = await s.user('player');
    const token = p.session('full');
    const { secret } = (await s.call({ url: '/api/v1/account/totp/setup', body: {}, token })).json() as { secret: string };
    const { recoveryCodes } = (await s.call({ url: '/api/v1/account/totp/enable', body: { code: totpAt(secret, s.clock.now()) }, token })).json() as { recoveryCodes: string[] };
    const kept = JSON.parse(p.row().totp_recovery!) as string[];
    expect(kept.every((h) => h.startsWith('h1:'))).toBe(true);
    // a database copy without TOTP_KEY: the plain hash of a code is not among them
    expect(kept).not.toContain(hashCode(recoveryCodes[0]!));
    // codes kept before: still good once
    const [oldCode] = newRecoveryCodes(1);
    s.db.prepare('UPDATE users SET totp_recovery = ? WHERE id = ?').run(JSON.stringify([...kept, hashCode(oldCode!)]), p.id);
    const pending = cookieOf(await s.call({ url: '/api/v1/auth/login', body: { username: 'player', password: PASSWORD } }))!;
    expect((await s.call({ url: '/api/v1/auth/totp', body: { code: oldCode }, token: pending })).statusCode).toBe(200);
    const pending2 = cookieOf(await s.call({ url: '/api/v1/auth/login', body: { username: 'player', password: PASSWORD } }))!;
    expect((await s.call({ url: '/api/v1/auth/totp', body: { code: recoveryCodes[1] }, token: pending2 })).statusCode).toBe(200);
    expect(TOTP_KEY).toBeTruthy();
  });
});

describe('locked out by somebody else', () => {
  it('AUTH-9: failures from one address do not lock the account out from another; many addresses together still do', async () => {
    const s = await startAccounts();
    await s.user('player');
    for (let i = 0; i < 6; i++) await s.call({ url: '/api/v1/auth/login', body: { username: 'player', password: 'wrong password!' }, headers: from('203.0.113.9') });
    expect((await s.call({ url: '/api/v1/auth/login', body: { username: 'player', password: 'wrong password!' }, headers: from('203.0.113.9') })).statusCode).toBe(429);
    expect((await s.call({ url: '/api/v1/auth/login', body: { username: 'player', password: PASSWORD }, headers: from('198.51.100.20') })).statusCode).toBe(200);
    // the refusal is no failed sign-in for Fail2Ban
    expect(s.log.entries().filter((e) => e.event === 'login_braked').length).toBeGreaterThan(0);
    // spread over many addresses, the account is braked for everyone
    for (let a = 0; a < 6; a++) for (let i = 0; i < 5; i++) await s.call({ url: '/api/v1/auth/login', body: { username: 'player', password: 'wrong password!' }, headers: from(`192.0.2.${a + 1}`) });
    expect((await s.call({ url: '/api/v1/auth/login', body: { username: 'player', password: PASSWORD }, headers: from('198.51.100.21') })).statusCode).toBe(429);
  });
});

describe('links, cookies and admins', () => {
  it('AUTH-12: disabling an account or signing it out everywhere ends its open reset links', async () => {
    const s = await startAccounts();
    const admin = await s.user('admin', { admin: true, totp: true });
    const at = admin.session('full');
    for (const op of ['disable', 'sign-out'] as const) {
      const p = await s.user(`player-${op}`);
      const { token } = (await s.call({ url: `/api/v1/admin/users/${p.id}/reset`, body: {}, token: at })).json() as { token: string };
      await s.call({ url: `/api/v1/admin/users/${p.id}/${op}`, body: {}, token: at });
      expect((await s.call({ url: '/api/v1/invites/check', body: { token } })).statusCode).toBe(404);
      if (op === 'disable') await s.call({ url: `/api/v1/admin/users/${p.id}/enable`, body: {}, token: at });
      expect((await s.call({ url: '/api/v1/invites/accept', body: { token, password: 'a long new password 5' } })).statusCode).toBe(404);
    }
  });

  it('AUTH-14: a session in use gets its cookie renewed with it', async () => {
    const s = await startAccounts();
    await s.user('player');
    const token = cookieOf(await s.call({ url: '/api/v1/auth/login', body: { username: 'player', password: PASSWORD } }))!;
    s.clock.advance(30 * MIN);
    expect(cookieOf(await s.call({ url: '/api/v1/auth/me', token }))).toBeNull();
    s.clock.advance(60 * MIN);
    const r = await s.call({ url: '/api/v1/auth/me', token });
    expect(cookieOf(r)).toBe(token);
    expect(String(r.headers['set-cookie'])).toMatch(/Max-Age=7776000/);
  });

  it('AUTH-16: an admin account is not reset through the app – only with roster-cli on the Pi', async () => {
    const s = await startAccounts();
    const admin = await s.user('admin', { admin: true, totp: true });
    const other = await s.user('second', { admin: true, totp: true });
    for (const op of ['reset', 'totp-reset']) {
      expect((await s.call({ url: `/api/v1/admin/users/${other.id}/${op}`, body: {}, token: admin.session('full') })).json()).toMatchObject({ error: 'invalid', problem: expect.stringMatching(/roster-cli/) });
    }
    expect(other.row().totp_enabled_at).not.toBeNull();
  });

  it('AUTH-7: old sign-in attempts are cleared by an index, not a scan of the table', async () => {
    const s = await startAccounts();
    const plan = s.db.prepare('EXPLAIN QUERY PLAN DELETE FROM login_attempts WHERE at < ?').all('2026-01-01') as { detail: string }[];
    expect(plan.map((p) => p.detail).join()).toMatch(/USING (COVERING )?INDEX login_attempts_at/);
  });
});
