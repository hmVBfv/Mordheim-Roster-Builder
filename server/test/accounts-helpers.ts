/* A server with accounts for the tests: a fixed clock, a cheap scrypt, a
   TOTP_KEY, and accounts made straight in the database. Requests go through
   app.inject, as a browser on the app's own origin would send them. */
import type { LightMyRequestResponse } from 'fastify';
import { createInvite, createSession, createUser, userByName } from '../src/accounts.ts';
import { hashPassword, type HashCost } from '../src/passwords.ts';
import { COOKIE } from '../src/routes-accounts.ts';
import { encryptSecret, newSecret, parseKey, totpAt } from '../src/totp.ts';
import { clock, startServer } from './helpers.ts';

/** scrypt at the smallest sensible cost: tests hash dozens of passwords. */
export const FAST: HashCost = { N: 16, r: 8, p: 1 };
export const TOTP_KEY = Buffer.alloc(32, 7).toString('base64');
export const ORIGIN = 'http://mordheim.test';
export const PASSWORD = 'correct horse battery';

export interface Req {
  method?: 'GET' | 'HEAD' | 'POST' | 'DELETE';
  url: string;
  body?: unknown;
  /** The session token, if any. */
  token?: string | null;
  /** The Origin header; default: the app's own. null sends none. */
  origin?: string | null;
  headers?: Record<string, string>;
}

export async function startAccounts(opts: { env?: NodeJS.ProcessEnv } = {}) {
  const c = clock();
  const s = await startServer({ now: c.now, hashCost: FAST, env: { TOTP_KEY, PUBLIC_ORIGIN: ORIGIN, ...opts.env } });
  const key = parseKey(TOTP_KEY)!;

  async function call(r: Req): Promise<LightMyRequestResponse> {
    const method = r.method ?? (r.body === undefined ? 'GET' : 'POST');
    const headers: Record<string, string> = { ...r.headers };
    if (r.origin !== null) headers.origin = r.origin ?? ORIGIN;
    if (r.token) headers.cookie = `${COOKIE}=${r.token}`;
    return s.app.inject({ method, url: r.url, headers, ...(r.body !== undefined ? { payload: r.body as object } : {}) });
  }

  /** An account; with `totp`, the authenticator is set up with a known secret. */
  async function user(username: string, o: { admin?: boolean; totp?: boolean; password?: string } = {}) {
    const id = createUser(s.db, { username, displayName: username, pwHash: await hashPassword(o.password ?? PASSWORD, FAST), isAdmin: !!o.admin }, c.now());
    let secret: string | null = null;
    if (o.totp) {
      secret = newSecret();
      s.db.prepare('UPDATE users SET totp_secret_enc = ?, totp_enabled_at = ? WHERE id = ?').run(encryptSecret(secret, key), c.now().toISOString(), id);
    }
    return {
      id, username, secret,
      /** A session made straight in the database. */
      session: (stage: 'full' | 'totp' = 'full') => createSession(s.db, { userId: id, stage, device: 'test', ip: '127.0.0.1' }, c.now()).token,
      code: () => totpAt(secret!, c.now()),
      row: () => userByName(s.db, username)!,
    };
  }

  const invite = (o: { admin?: boolean } = {}) => createInvite(s.db, { kind: 'register', createdBy: null, isAdmin: !!o.admin }, c.now());

  return { ...s, clock: c, key, call, user, invite };
}

/** The session token a response sets, '' when it clears the cookie, null when it sets none. */
export function cookieOf(res: LightMyRequestResponse): string | null {
  const raw = res.headers['set-cookie'];
  const line = [raw].flat().find((l) => typeof l === 'string' && l.startsWith(`${COOKIE}=`));
  if (!line) return null;
  return line.slice(COOKIE.length + 1).split(';')[0]!;
}
