/* Signing in, one-time links, a user's own account and the admin's view
   (phase 3g; ADR 0008, docs/security.md section 3, docs/architecture.md
   "Endpunkte"). Every route names its action; app.ts has already found the
   actor and asked can() when a handler runs. Every write lands in the audit
   log. Tokens leave the server once – in the answer or the cookie that hands
   them out – and are stored only as hashes. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  audit, createInvite, createSession, createUser, inviteByToken, listAttempts, listAudit, listOpenInvites, listSessions, listUsers,
  promoteSession, recentFailures, recordAttempt, revokeInvite, revokeResetLinks, revokeSession, revokeUserSessions, sessionByToken, setPassword,
  touchSession, useInvite, userById, userByName, usernameProblem, type UserRow,
} from './accounts.ts';
import type { DB } from './db.ts';
import { loginBraked, loginFailed } from './log.ts';
import { DEFAULT_COST, dummyHash, hashPassword, passwordProblem, verifyPassword, type HashCost } from './passwords.ts';
import { mustSetUpTotp, type Actor } from './policy.ts';
import { decryptSecret, encryptSecret, findCode, keyedCode, newRecoveryCodes, newSecret, otpauthUri, verifyTotp } from './totp.ts';

export const COOKIE = 'mh_session';

export interface AccountDeps {
  db: DB | null;
  now: () => Date;
  config: { publicOrigin: string | null };
  totpKey: Buffer | null;
  hashCost?: HashCost | undefined;
}

/* ---- the session cookie ---- */

function cookieToken(req: FastifyRequest): string | null {
  const header = req.headers.cookie ?? '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === COOKIE) return part.slice(i + 1).trim() || null;
  }
  return null;
}

/** Who is asking: the session cookie's user, or null. A full session in use lives on – `renew` hands its token back when it did, for a new cookie. */
export function readActor(db: DB, req: FastifyRequest, now: Date, renew?: (token: string) => void): Actor | null {
  const token = cookieToken(req);
  if (!token) return null;
  const found = sessionByToken(db, token, now);
  if (!found) return null;
  const { session, user } = found;
  if (touchSession(db, session, req.ip, now)) renew?.(token);
  return {
    id: user.id, username: user.username, displayName: user.display_name, isAdmin: !!user.is_admin,
    totp: !!user.totp_enabled_at, sessionId: session.id, pending: session.stage === 'totp',
  };
}

/** The session cookie's header line; no days: it is cleared. */
export function sessionCookie(token: string, secure: boolean, maxAgeDays: number | null): string {
  const parts = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (secure) parts.push('Secure');
  parts.push(maxAgeDays === null ? 'Max-Age=0' : `Max-Age=${Math.round(maxAgeDays * 24 * 60 * 60)}`);
  return parts.join('; ');
}

function setCookie(reply: FastifyReply, token: string, secure: boolean, maxAgeDays: number | null): void {
  reply.header('Set-Cookie', sessionCookie(token, secure, maxAgeDays));
}

/* ---- what the app sees of a user ---- */

export interface Me { id: string; username: string; displayName: string; isAdmin: boolean; totp: boolean; mustSetUpTotp: boolean }

const meOf = (a: Actor): Me => ({ id: a.id, username: a.username, displayName: a.displayName, isAdmin: a.isAdmin, totp: a.totp, mustSetUpTotp: mustSetUpTotp(a) });
const meOfRow = (u: UserRow): Me => meOf({ id: u.id, username: u.username, displayName: u.display_name, isAdmin: !!u.is_admin, totp: !!u.totp_enabled_at, sessionId: '', pending: false });

/* ---- the brake (docs/security.md): 5 failures in 15 minutes for an
   account from one address, or from one address for any account – 25 for
   an account from everywhere together, so somebody else's failures do not
   lock it out (security review AUTH-9) – then a wait that doubles with
   every further failure ---- */

export const FREE_FAILURES = 5;
export const ACCOUNT_FAILURES = 25;

/** Seconds to wait before the next try, or 0. */
export function brakeWait(fails: number, last: string | null, now: Date): number {
  if (fails < FREE_FAILURES || !last) return 0;
  const wait = Math.min(15 * 60, 30 * 2 ** (fails - FREE_FAILURES));
  const passed = (now.getTime() - Date.parse(last)) / 1000;
  return Math.max(0, Math.ceil(wait - passed));
}

const str = (maxLength: number) => ({ type: 'string', maxLength }) as const;
const body = (props: Record<string, unknown>, required: string[]) => ({ body: { type: 'object', additionalProperties: false, required, properties: props } });

export function registerAccountRoutes(app: FastifyInstance, deps: AccountDeps): void {
  const cost = deps.hashCost ?? DEFAULT_COST;
  const secure = (deps.config.publicOrigin ?? '').startsWith('https:');
  // only called once app.ts has let the request through, which needs the database
  const db = () => deps.db as DB;
  const now = deps.now;
  const deviceOf = (req: FastifyRequest, given?: string) => (given?.trim() || String(req.headers['user-agent'] ?? 'unknown device')).slice(0, 80);
  // the token rides in the fragment, which browsers never send to a server
  const linkFor = (token: string, kind: 'register' | 'reset') => `${deps.config.publicOrigin ?? ''}/${kind === 'register' ? 'invite' : 'reset'}#${token}`;

  /** Signs the user in on this device: a full session, or – with an authenticator – the step before the code. */
  const signIn = (req: FastifyRequest, reply: FastifyReply, u: UserRow, device: string) => {
    // whoever was signed in on this device before is signed out
    if (req.actor) revokeSession(db(), req.actor.sessionId, now());
    const stage = u.totp_enabled_at ? 'totp' : 'full';
    const s = createSession(db(), { userId: u.id, stage, device, ip: req.ip }, now());
    setCookie(reply, s.token, secure, stage === 'full' ? 90 : 1 / 24 / 12);
    return stage === 'totp' ? { stage: 'totp' as const } : { stage: 'full' as const, user: meOfRow(u) };
  };

  /** An authenticator's secret, or null when TOTP_KEY is missing or not the one it was encrypted with. */
  const secretOf = (req: FastifyRequest, enc: string | null) => {
    if (!enc || !deps.totpKey) return null;
    try {
      return decryptSecret(enc, deps.totpKey);
    } catch {
      req.log.error({ event: 'totp_key_mismatch' }, 'an authenticator secret does not open with TOTP_KEY (replaced key?)');
      return null;
    }
  };

  /** 429 with the wait, if the brake holds for this account or address. The
      refusal is no failed sign-in for Fail2Ban: a locked-out owner trying
      again would otherwise get the own address banned. */
  const braked = (req: FastifyRequest, reply: FastifyReply, username: string, t: Date) => {
    const f = recentFailures(db(), username, req.ip, t);
    const n = Math.max(f.pair.n, f.ip.n, f.user.n - (ACCOUNT_FAILURES - FREE_FAILURES));
    const last = [f.pair.last, f.ip.last, f.user.last].filter(Boolean).sort().pop() ?? null;
    const wait = brakeWait(n, last, t);
    if (wait <= 0) return false;
    recordAttempt(db(), { username, ip: req.ip, ok: false, reason: 'braked' }, t);
    loginBraked(req.log, req.ip, username);
    void reply.code(429).header('Retry-After', String(wait)).send({ error: 'too_many_attempts', retryAfter: wait });
    return true;
  };

  /* One password check at a time per account, and a few per address
     (security review AUTH-1): the brake counts failures, and requests sent
     at once would all be checked before the first failure is counted. A few
     per address, not one: players behind one router sign in at the same
     moment on a game night. */
  const PER_ADDRESS = 3;
  const accounts = new Set<string>();
  const addresses = new Map<string, number>();
  const oneAtATime = (req: FastifyRequest, reply: FastifyReply, username: string): (() => void) | null => {
    const account = username.toLowerCase();
    const at = addresses.get(req.ip) ?? 0;
    if (accounts.has(account) || at >= PER_ADDRESS) {
      void reply.code(429).header('Retry-After', '1').send({ error: 'too_many_attempts', retryAfter: 1 });
      return null;
    }
    accounts.add(account);
    addresses.set(req.ip, at + 1);
    return () => {
      accounts.delete(account);
      const left = (addresses.get(req.ip) ?? 1) - 1;
      if (left > 0) addresses.set(req.ip, left);
      else addresses.delete(req.ip);
    };
  };

  /** A password checked for a signed-in user (changing it, turning the authenticator off): braked like signing in, a wrong one counted.
      'sent' when the answer is out already. */
  const checkPassword = async (req: FastifyRequest, reply: FastifyReply, u: UserRow, password: string, t: Date): Promise<'ok' | 'wrong' | 'sent'> => {
    if (braked(req, reply, u.username, t)) return 'sent';
    const release = oneAtATime(req, reply, u.username);
    if (!release) return 'sent';
    try {
      if (await verifyPassword(password, u.pw_hash)) return 'ok';
    } finally { release(); }
    recordAttempt(db(), { username: u.username, ip: req.ip, ok: false, reason: 'password' }, t);
    loginFailed(req.log, req.ip, u.username);
    return 'wrong';
  };

  /** The authenticator's code now, or one of the recovery codes (used up). Whether it was right. */
  const secondFactor = (req: FastifyRequest, u: UserRow, code: string, t: Date): boolean => {
    const secret = secretOf(req, u.totp_secret_enc);
    if (secret) {
      const step = verifyTotp(secret, code.trim(), t, u.totp_last_step);
      if (step !== null) {
        db().prepare('UPDATE users SET totp_last_step = ? WHERE id = ?').run(step, u.id);
        return true;
      }
    }
    if (u.totp_recovery) {
      // a recovery code works once
      const left = JSON.parse(u.totp_recovery) as string[];
      const i = findCode(left, code, deps.totpKey);
      if (i >= 0) {
        left.splice(i, 1);
        db().prepare('UPDATE users SET totp_recovery = ? WHERE id = ?').run(JSON.stringify(left), u.id);
        audit(db(), { actorId: u.id, action: 'totp.recovery_used', targetType: 'user', targetId: u.id, payload: { left: left.length } }, t);
        return true;
      }
    }
    return false;
  };

  /** Is the session still open – after an await, an admin may have ended it meanwhile (security review AUTH-6). */
  const stillOpen = (sessionId: string, t: Date) => {
    const r = db().prepare('SELECT revoked_at, expires_at FROM sessions WHERE id = ?').get(sessionId) as { revoked_at: string | null; expires_at: string } | undefined;
    return !!r && !r.revoked_at && r.expires_at > t.toISOString();
  };

  app.get('/api/v1/auth/me', { config: { action: 'auth.me' } }, async (req) => ({ user: req.actor && !req.actor.pending ? meOf(req.actor) : null, pending: !!req.actor?.pending }));

  app.post('/api/v1/auth/login', {
    config: { action: 'auth.login' },
    schema: body({ username: str(64), password: str(256), device: str(80) }, ['username', 'password']),
  }, async (req, reply) => {
    const { username, password, device } = req.body as { username: string; password: string; device?: string };
    const t = now();
    if (braked(req, reply, username, t)) return reply;
    const release = oneAtATime(req, reply, username);
    if (!release) return reply;
    const u = userByName(db(), username);
    let ok: boolean;
    try {
      ok = u && !u.disabled_at ? await verifyPassword(password, u.pw_hash) : (await verifyPassword(password, await dummyHash(cost)), false);
    } finally { release(); }
    if (!u || !ok || u.disabled_at) {
      recordAttempt(db(), { username, ip: req.ip, ok: false, reason: !u ? 'unknown' : u.disabled_at ? 'disabled' : 'password' }, t);
      loginFailed(req.log, req.ip, username);
      return reply.code(401).send({ error: 'invalid_login' });
    }
    if (!u.totp_enabled_at) recordAttempt(db(), { username: u.username, ip: req.ip, ok: true }, t);
    return signIn(req, reply, u, deviceOf(req, device));
  });

  app.post('/api/v1/auth/totp', {
    config: { action: 'auth.totp' },
    schema: body({ code: str(20) }, ['code']),
  }, async (req, reply) => {
    const a = req.actor!;
    const t = now();
    const u = userById(db(), a.id)!;
    // six digits are quick to guess without the brake
    if (braked(req, reply, u.username, t)) return reply;
    const ok = secondFactor(req, u, (req.body as { code: string }).code, t);
    recordAttempt(db(), { username: u.username, ip: req.ip, ok, reason: ok ? '' : 'code' }, t);
    if (!ok) {
      loginFailed(req.log, req.ip, u.username);
      return reply.code(401).send({ error: 'invalid_code' });
    }
    const token = promoteSession(db(), a.sessionId, t);
    setCookie(reply, token, secure, 90);
    return { stage: 'full', user: meOfRow(u) };
  });

  app.post('/api/v1/auth/logout', { config: { action: 'auth.logout' } }, async (req, reply) => {
    revokeSession(db(), req.actor!.sessionId, now());
    setCookie(reply, '', secure, null);
    // what the browser keeps of this account's answers (a leaders' picture's bytes) goes too (security review CLIENT-1)
    reply.header('Clear-Site-Data', '"cache"');
    return { ok: true };
  });

  app.get('/api/v1/auth/sessions', { config: { action: 'auth.sessions.read' } }, async (req) => ({ sessions: listSessions(db(), req.actor!.id, req.actor!.sessionId, now()) }));

  // one device, or every other device ("sign out everywhere else")
  app.delete('/api/v1/auth/sessions/:id', { config: { action: 'auth.sessions.revoke' } }, async (req, reply) => {
    const a = req.actor!;
    const { id } = req.params as { id: string };
    const t = now();
    if (id === 'others') {
      const n = revokeUserSessions(db(), a.id, t, a.sessionId);
      audit(db(), { actorId: a.id, action: 'sessions.revoke_others', targetType: 'user', targetId: a.id, payload: { n } }, t);
      return { revoked: n };
    }
    const mine = listSessions(db(), a.id, a.sessionId, t).some((s) => s.id === id);
    if (!mine) return reply.code(404).send({ error: 'not_found' });
    revokeSession(db(), id, t);
    audit(db(), { actorId: a.id, action: 'session.revoke', targetType: 'session', targetId: id }, t);
    if (id === a.sessionId) setCookie(reply, '', secure, null);
    return { revoked: 1 };
  });

  /* ---- one-time links ---- */

  // the token travels in the body, never in a URL that something might log
  app.post('/api/v1/invites/check', {
    config: { action: 'invites.read' },
    schema: body({ token: str(100) }, ['token']),
  }, async (req, reply) => {
    const inv = inviteByToken(db(), (req.body as { token: string }).token, now());
    if (!inv) return reply.code(404).send({ error: 'invalid_link' });
    const forUser = inv.for_user_id ? userById(db(), inv.for_user_id) : undefined;
    // the same as accepting refuses: a reset link of a disabled account
    if (inv.kind === 'reset' && (!forUser || forUser.disabled_at)) return reply.code(404).send({ error: 'invalid_link' });
    return { kind: inv.kind, expiresAt: inv.expires_at, username: forUser?.username ?? null };
  });

  app.post('/api/v1/invites/accept', {
    config: { action: 'invites.accept' },
    schema: body({ token: str(100), username: str(64), displayName: str(64), password: str(256), device: str(80) }, ['token', 'password']),
  }, async (req, reply) => {
    const t = now();
    const b = req.body as { token: string; username?: string; displayName?: string; password: string; device?: string };
    const inv = inviteByToken(db(), b.token, t);
    if (!inv) return reply.code(404).send({ error: 'invalid_link' });
    if (inv.kind === 'register') {
      const username = (b.username ?? '').trim();
      const problem = usernameProblem(username) || (userByName(db(), username) ? 'that username is taken' : '') || passwordProblem(b.password, username);
      if (problem) return reply.code(400).send({ error: 'invalid', problem });
      const pwHash = await hashPassword(b.password, cost);
      let id: string | null;
      try {
        id = db().transaction(() => {
          // the link may have been used meanwhile (two taps at once)
          if (!useInvite(db(), inv.id, t)) return null;
          const uid = createUser(db(), { username, displayName: (b.displayName ?? '').trim() || username, pwHash, isAdmin: !!inv.is_admin }, t);
          audit(db(), { actorId: uid, action: 'user.register', targetType: 'user', targetId: uid, payload: { invite: inv.id, admin: !!inv.is_admin } }, t);
          return uid;
        })();
      } catch (e) {
        // the same name taken by another invite meanwhile (security review AUTH-13); the link stays unused
        if (String((e as { code?: string }).code).startsWith('SQLITE_CONSTRAINT')) return reply.code(400).send({ error: 'invalid', problem: 'that username is taken' });
        throw e;
      }
      if (!id) return reply.code(404).send({ error: 'invalid_link' });
      recordAttempt(db(), { username, ip: req.ip, ok: true, reason: 'registered' }, t);
      return signIn(req, reply, userById(db(), id)!, deviceOf(req, b.device));
    }
    // a reset: a new password, every device signed out
    const u = inv.for_user_id ? userById(db(), inv.for_user_id) : undefined;
    if (!u || u.disabled_at) return reply.code(404).send({ error: 'invalid_link' });
    const problem = passwordProblem(b.password, u.username);
    if (problem) return reply.code(400).send({ error: 'invalid', problem });
    const pwHash = await hashPassword(b.password, cost);
    const done = db().transaction(() => {
      // still good now: not used, revoked or replaced while the password was hashed, the account not disabled (security review AUTH-2)
      if (userById(db(), u.id)?.disabled_at || !useInvite(db(), inv.id, t)) return false;
      setPassword(db(), u.id, pwHash);
      revokeUserSessions(db(), u.id, t);
      audit(db(), { actorId: u.id, action: 'user.password_reset', targetType: 'user', targetId: u.id, payload: { invite: inv.id } }, t);
      return true;
    })();
    if (!done) return reply.code(404).send({ error: 'invalid_link' });
    return signIn(req, reply, userById(db(), u.id)!, deviceOf(req, b.device));
  });

  /* ---- one's own account ---- */

  app.post('/api/v1/account/password', {
    config: { action: 'account.password' },
    schema: body({ current: str(256), next: str(256) }, ['current', 'next']),
  }, async (req, reply) => {
    const a = req.actor!;
    const { current, next } = req.body as { current: string; next: string };
    const u = userById(db(), a.id)!;
    const t = now();
    const checked = await checkPassword(req, reply, u, current, t);
    if (checked === 'sent') return reply;
    if (checked === 'wrong') return reply.code(400).send({ error: 'invalid', problem: 'the current password is not right' });
    const problem = passwordProblem(next, u.username);
    if (problem) return reply.code(400).send({ error: 'invalid', problem });
    const pwHash = await hashPassword(next, cost);
    const n = db().transaction(() => {
      if (!stillOpen(a.sessionId, t)) return null;
      setPassword(db(), u.id, pwHash);
      // other devices must sign in with the new one
      const k = revokeUserSessions(db(), u.id, t, a.sessionId);
      audit(db(), { actorId: a.id, action: 'user.password_change', targetType: 'user', targetId: a.id, payload: { signedOut: k } }, t);
      return k;
    })();
    if (n === null) return reply.code(401).send({ error: 'sign_in' });
    return { ok: true, signedOut: n };
  });

  // the authenticator: a new secret to scan, then its first code to confirm it
  app.post('/api/v1/account/totp/setup', { config: { action: 'account.totp' } }, async (req, reply) => {
    if (!deps.totpKey) return reply.code(503).send({ error: 'totp_unavailable' });
    const a = req.actor!;
    const secret = newSecret();
    db().prepare('UPDATE users SET totp_pending_enc = ? WHERE id = ?').run(encryptSecret(secret, deps.totpKey), a.id);
    return { secret, uri: otpauthUri(secret, a.username) };
  });

  app.post('/api/v1/account/totp/enable', {
    config: { action: 'account.totp' },
    schema: body({ code: str(20), current: str(20) }, ['code']),
  }, async (req, reply) => {
    const key = deps.totpKey;
    if (!key) return reply.code(503).send({ error: 'totp_unavailable' });
    const a = req.actor!;
    const u = userById(db(), a.id)!;
    const pending = secretOf(req, u.totp_pending_enc);
    if (!pending) return reply.code(400).send({ error: 'invalid', problem: 'start the setup first' });
    const t = now();
    const { code, current } = req.body as { code: string; current?: string };
    // a new phone in place of the old one: only with a code of the old one, or a recovery code (security review AUTH-3)
    if (u.totp_enabled_at) {
      if (braked(req, reply, u.username, t)) return reply;
      if (!current) return reply.code(400).send({ error: 'invalid', problem: 'a code from your current authenticator (or a recovery code) is needed' });
      if (!secondFactor(req, u, current, t)) {
        recordAttempt(db(), { username: u.username, ip: req.ip, ok: false, reason: 'code' }, t);
        loginFailed(req.log, req.ip, u.username);
        return reply.code(400).send({ error: 'invalid', problem: 'the code from your current authenticator is not right' });
      }
    }
    const step = verifyTotp(pending, code, t);
    if (step === null) return reply.code(400).send({ error: 'invalid', problem: 'the code is not right – check the time on your phone' });
    const codes = newRecoveryCodes();
    const n = db().transaction(() => {
      db().prepare('UPDATE users SET totp_secret_enc = totp_pending_enc, totp_pending_enc = NULL, totp_enabled_at = ?, totp_last_step = ?, totp_recovery = ? WHERE id = ?')
        .run(t.toISOString(), step, JSON.stringify(codes.map((c) => keyedCode(c, key))), a.id);
      // sessions signed in with the password alone end: from now on a sign-in takes the code (security review AUTH-5)
      const k = revokeUserSessions(db(), a.id, t, a.sessionId);
      audit(db(), { actorId: a.id, action: 'totp.enable', targetType: 'user', targetId: a.id, payload: { signedOut: k, replaced: !!u.totp_enabled_at } }, t);
      return k;
    })();
    void n;
    return { recoveryCodes: codes };
  });

  app.post('/api/v1/account/totp/disable', {
    config: { action: 'account.totp' },
    schema: body({ password: str(256), code: str(20) }, ['password']),
  }, async (req, reply) => {
    const a = req.actor!;
    // required for an admin (ADR 0008): only the admin reset (roster-cli) takes it away
    if (a.isAdmin) return reply.code(400).send({ error: 'invalid', problem: 'an admin keeps the authenticator' });
    const u = userById(db(), a.id)!;
    const t = now();
    const { password, code } = req.body as { password: string; code?: string };
    // the password and a code: a stolen session alone does not take the second factor away (security review AUTH-15)
    const checked = await checkPassword(req, reply, u, password, t);
    if (checked === 'sent') return reply;
    if (checked === 'wrong') return reply.code(400).send({ error: 'invalid', problem: 'the password is not right' });
    if (u.totp_enabled_at && !(code && secondFactor(req, u, code, t))) {
      recordAttempt(db(), { username: u.username, ip: req.ip, ok: false, reason: 'code' }, t);
      return reply.code(400).send({ error: 'invalid', problem: code ? 'the code is not right' : 'a code from your authenticator (or a recovery code) is needed' });
    }
    if (!stillOpen(a.sessionId, t)) return reply.code(401).send({ error: 'sign_in' });
    db().prepare('UPDATE users SET totp_secret_enc = NULL, totp_pending_enc = NULL, totp_enabled_at = NULL, totp_recovery = NULL WHERE id = ?').run(a.id);
    audit(db(), { actorId: a.id, action: 'totp.disable', targetType: 'user', targetId: a.id }, t);
    return { ok: true };
  });

  /* ---- the admin ---- */

  app.get('/api/v1/admin/users', { config: { action: 'admin.users.read' } }, async () => ({ users: listUsers(db(), now()) }));

  app.post('/api/v1/admin/users/:id/:op', {
    config: { action: 'admin.users.write' },
  }, async (req, reply) => {
    const a = req.actor!;
    const { id, op } = req.params as { id: string; op: string };
    const u = userById(db(), id);
    if (!u) return reply.code(404).send({ error: 'not_found' });
    // one's own account is looked after in the profile; an admin keeps the authenticator
    if (u.id === a.id) return reply.code(400).send({ error: 'invalid', problem: 'not your own account' });
    // a reset link or a removed authenticator hands an account over: for an admin account only roster-cli on the Pi does that (security review AUTH-16)
    if (u.is_admin && (op === 'reset' || op === 'totp-reset')) return reply.code(400).send({ error: 'invalid', problem: 'an admin account is reset with roster-cli on the Pi' });
    const t = now();
    switch (op) {
      case 'reset': {
        const inv = createInvite(db(), { kind: 'reset', createdBy: a.id, forUserId: u.id }, t);
        audit(db(), { actorId: a.id, action: 'invite.reset', targetType: 'user', targetId: u.id, payload: { invite: inv.id } }, t);
        return { link: linkFor(inv.token, 'reset'), token: inv.token };
      }
      case 'totp-reset': {
        // a lost phone may still be signed in: every device signs in anew
        const n = db().transaction(() => {
          db().prepare('UPDATE users SET totp_secret_enc = NULL, totp_pending_enc = NULL, totp_enabled_at = NULL, totp_recovery = NULL WHERE id = ?').run(u.id);
          const k = revokeUserSessions(db(), u.id, t);
          audit(db(), { actorId: a.id, action: 'totp.reset', targetType: 'user', targetId: u.id, payload: { signedOut: k } }, t);
          return k;
        })();
        return { ok: true, signedOut: n };
      }
      case 'disable':
      case 'enable': {
        db().prepare('UPDATE users SET disabled_at = ? WHERE id = ?').run(op === 'disable' ? t.toISOString() : null, u.id);
        if (op === 'disable') {
          revokeUserSessions(db(), u.id, t);
          revokeResetLinks(db(), u.id, t);
        }
        audit(db(), { actorId: a.id, action: `user.${op}`, targetType: 'user', targetId: u.id }, t);
        return { ok: true };
      }
      case 'sign-out': {
        const n = revokeUserSessions(db(), u.id, t);
        // "taken over?": an open reset link may be the way in
        revokeResetLinks(db(), u.id, t);
        audit(db(), { actorId: a.id, action: 'sessions.revoke_all', targetType: 'user', targetId: u.id, payload: { n } }, t);
        return { revoked: n };
      }
      default:
        return reply.code(404).send({ error: 'not_found' });
    }
  });

  app.get('/api/v1/admin/invites', { config: { action: 'admin.invites.read' } }, async () => ({ invites: listOpenInvites(db(), now()) }));

  app.post('/api/v1/admin/invites', {
    config: { action: 'admin.invites.write' },
    schema: body({ note: str(120) }, []),
  }, async (req) => {
    const a = req.actor!;
    const t = now();
    const note = ((req.body ?? {}) as { note?: string }).note ?? '';
    const inv = createInvite(db(), { kind: 'register', createdBy: a.id, note }, t);
    audit(db(), { actorId: a.id, action: 'invite.create', targetType: 'invite', targetId: inv.id, payload: { note } }, t);
    return { id: inv.id, link: linkFor(inv.token, 'register'), token: inv.token };
  });

  app.delete('/api/v1/admin/invites/:id', { config: { action: 'admin.invites.write' } }, async (req, reply) => {
    const a = req.actor!;
    const { id } = req.params as { id: string };
    const t = now();
    if (!revokeInvite(db(), id, t)) return reply.code(404).send({ error: 'not_found' });
    audit(db(), { actorId: a.id, action: 'invite.revoke', targetType: 'invite', targetId: id }, t);
    return { ok: true };
  });

  const page = (req: FastifyRequest) => {
    const q = req.query as { limit?: string; before?: string };
    const limit = Math.min(200, Math.max(1, Number(q.limit) || 50));
    const before = q.before ? Number(q.before) : undefined;
    return { limit, before: Number.isFinite(before) ? before : undefined };
  };

  app.get('/api/v1/admin/logins', { config: { action: 'admin.logins.read' } }, async (req) => {
    const p = page(req);
    return { attempts: listAttempts(db(), p.limit, p.before) };
  });

  app.get('/api/v1/admin/audit', { config: { action: 'admin.audit.read' } }, async (req) => {
    const p = page(req);
    return { entries: listAudit(db(), req.actor!.id, p.limit, p.before) };
  });
}
