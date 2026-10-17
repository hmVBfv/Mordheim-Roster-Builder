/* The bug token (phase 4c2; ADR 0019): a credential for a cloud session that
   reads and sorts problem reports – and does nothing else. It is not a
   session: no cookie, no authenticator, no Origin; it runs out, it can be
   revoked, only its hash is stored. The tests that matter most are the ones
   that close doors: the token on every other route, a token that is not good,
   and a token next to a cookie. */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createBugToken, DEFAULT_DAYS, MAX_ACTIVE, MAX_DAYS, revokeBugToken, TOKEN_PREFIX } from '../src/bug-tokens.ts';
import { ACTIONS, tokenMay, type Action } from '../src/policy.ts';
import { COOKIE } from '../src/routes-accounts.ts';
import { openDb } from '../src/db.ts';
import { loadMigrations, migrate } from '../src/migrations.ts';
import { startAccounts } from './accounts-helpers.ts';
import { clock } from './helpers.ts';

const DAY = 24 * 60 * 60 * 1000;

async function table() {
  const s = await startAccounts();
  const rob = await s.user('rob', { admin: true, totp: true });
  const anna = await s.user('anna');
  const made = createBugToken(s.db, { label: 'cloud', days: 30 }, s.clock.now());
  if (!made.ok) throw new Error(made.problem);
  /** A request with the token in its header, as curl sends it: no cookie, no Origin. */
  const withToken = (token: string, method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, body?: unknown, extra: { cookie?: string } = {}) =>
    s.call({ method, url: `/api/v1${url}`, ...(body !== undefined ? { body } : {}), origin: null, headers: { authorization: `Bearer ${token}`, ...(extra.cookie ? { cookie: extra.cookie } : {}) } });
  const asToken = (method: 'GET' | 'POST' | 'PATCH', url: string, body?: unknown) => withToken(made.token, method, url, body);
  const report = (o: Record<string, unknown> = {}) => ({
    id: randomUUID(), kind: 'bug', title: 'The trading post does not open', text: 'ZEBRA: I tap Buy and nothing happens.', appVersion: 'abc1234', device: 'Chrome on Android',
    view: '/warbands/:id/trade', context: null, jsErrors: [], ...o,
  });
  const send = async (o: Record<string, unknown> = {}) => {
    const body = report(o);
    const res = await s.call({ method: 'POST', url: '/api/v1/bugs', body, token: anna.session() });
    return { body, res };
  };
  return { s, rob, anna, token: made.token, tokenId: made.id, withToken, asToken, send };
}

describe('the bug token', () => {
  it('is made once, starts with a mark that can be found, and only its hash is stored', async () => {
    const { s, token, tokenId } = await table();
    expect(token.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(token.length).toBeGreaterThan(40);
    const rows = s.db.prepare('SELECT * FROM bug_tokens').all() as { id: string; label: string; token_hash: string; expires_at: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: tokenId, label: 'cloud', expires_at: '2026-10-30T12:00:00.000Z' });
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(rows[0]!.token_hash).not.toBe(token);
  });

  it('days are 1 to 180, at most five are good at once, and a revoked one makes room', async () => {
    const s = await startAccounts();
    const now = s.clock.now();
    for (const days of [0, -1, MAX_DAYS + 1, 1.5, Number.NaN]) expect(createBugToken(s.db, { label: '', days }, now), `days ${days}`).toMatchObject({ ok: false });
    expect(createBugToken(s.db, { label: '', days: MAX_DAYS }, now)).toMatchObject({ ok: true });
    const ids: string[] = [];
    for (let i = 1; i < MAX_ACTIVE; i++) {
      const t = createBugToken(s.db, { label: `t${i}`, days: DEFAULT_DAYS }, now);
      if (!t.ok) throw new Error(t.problem);
      ids.push(t.id);
    }
    const sixth = createBugToken(s.db, { label: 'too many', days: 5 }, now);
    expect(sixth).toMatchObject({ ok: false });
    expect(revokeBugToken(s.db, ids[0]!, now)).toMatchObject({ ok: true, already: false });
    expect(createBugToken(s.db, { label: 'room again', days: 5 }, now)).toMatchObject({ ok: true });
    // an expired one makes room as well
    s.clock.advance(6 * DAY);
    expect(createBugToken(s.db, { label: 'later', days: 5 }, s.clock.now())).toMatchObject({ ok: true });
  });

  it('opens the reports: list, one by number or id, and sorting – without a cookie, an authenticator or an Origin', async () => {
    const { s, send, asToken } = await table();
    const { body } = await send();
    const list = await asToken('GET', '/bugs');
    expect(list.statusCode).toBe(200);
    const rows = (list.json() as { bugs: { id: string; number: number }[] }).bugs;
    expect(rows.map((b) => b.id)).toEqual([body.id]);
    expect(rows[0]!.number).toBe(1);
    const one = await asToken('GET', '/bugs/1');
    expect(one.statusCode).toBe(200);
    expect((one.json() as { bug: { text: string } }).bug.text).toMatch(/ZEBRA/);
    const patched = await asToken('PATCH', '/bugs/1', { status: 'confirmed', severity: 'S2', area: 'trading post' });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({ bug: { status: 'confirmed', severity: 'S2', area: 'trading post' } });
    expect((await asToken('PATCH', `/bugs/${body.id}`, { status: 'fixed', fixedIn: 'f00dbee' })).statusCode).toBe(200);
    // the log says what happened, who (the token's id) and how – not the words
    const log = s.db.prepare("SELECT actor_id, payload FROM audit_log WHERE action = 'bug.update' ORDER BY seq").all() as { actor_id: string; payload: string }[];
    expect(log).toHaveLength(2);
    expect(log[0]!.actor_id).toMatch(/^bug-token:/);
    expect(JSON.parse(log[1]!.payload)).toMatchObject({ from: 'confirmed', status: 'fixed', via: 'bug-token' });
    expect(JSON.stringify(log)).not.toMatch(/ZEBRA/);
  });

  it('does exactly the two actions that name it: every other route turns it away', async () => {
    const { s, token, withToken } = await table();
    const named = (Object.keys(ACTIONS) as Action[]).filter(tokenMay);
    expect(named.sort()).toEqual(['bugs.read', 'bugs.write']);
    // health and the app's files are open to everybody and never look at who asks
    const open: Action[] = ['health.read', 'app.files'];
    const routes = s.app.registeredRoutes.filter((r) => !named.includes(r.action) && !open.includes(r.action) && r.method !== 'HEAD');
    expect(routes.length).toBeGreaterThan(60);
    const problems: string[] = [];
    for (const r of routes) {
      const url = r.url.replace('/api/v1', '').replace(/:[A-Za-z]+/g, randomUUID());
      const res = await withToken(token, r.method as 'GET', url, r.method === 'GET' ? undefined : {});
      if (res.statusCode !== 403 || (res.json() as { error: string }).error !== 'forbidden') problems.push(`${r.method} ${r.url} (${r.action}): ${res.statusCode} ${res.body.slice(0, 60)}`);
    }
    expect(problems).toEqual([]);
    // two it names but does not need: sending and reading one's own
    for (const [m, u] of [['POST', '/bugs'], ['GET', '/bugs/mine']] as const) expect((await withToken(token, m, u, m === 'POST' ? { id: randomUUID(), kind: 'bug', title: 't', text: 't' } : undefined)).statusCode, u).toBe(403);
  });

  it('a token that is not good is not a visitor: unknown, revoked, expired, wrong mark, a session token', async () => {
    const { s, anna, rob, token, tokenId, withToken } = await table();
    const other = createBugToken(s.db, { label: 'short', days: 1 }, s.clock.now());
    if (!other.ok) throw new Error(other.problem);
    const refused = async (t: string, what: string) => {
      const r = await withToken(t, 'GET', '/bugs');
      expect(r.statusCode, what).toBe(401);
      expect(r.json()).toEqual({ error: 'sign_in' });
    };
    await refused(`${TOKEN_PREFIX}${'A'.repeat(43)}`, 'unknown');
    await refused('x', 'no mark');
    await refused(anna.session(), 'a session token');
    // the admin's own session token, sent as a bearer token, is nothing either
    await refused(rob.session(), 'an admin session token');
    s.clock.advance(2 * DAY);
    await refused(other.token, 'expired');
    expect(revokeBugToken(s.db, tokenId, s.clock.now())).toMatchObject({ ok: true });
    await refused(token, 'revoked');
  });

  it('a cookie next to a token changes nothing: the token alone decides, in both directions', async () => {
    const { s, rob, anna, token, tokenId, withToken } = await table();
    const cookie = (who: { session: () => string }) => `${COOKIE}=${who.session()}`;
    // the admin's cookie does not rescue a token that is not good
    expect(revokeBugToken(s.db, tokenId, s.clock.now())).toMatchObject({ ok: true });
    const revoked = await withToken(token, 'GET', '/bugs', undefined, { cookie: cookie(rob) });
    expect(revoked.statusCode).toBe(401);
    // and a good token next to a player's cookie is the token, not the player
    const fresh = createBugToken(s.db, { label: 'fresh', days: 5 }, s.clock.now());
    if (!fresh.ok) throw new Error(fresh.problem);
    expect((await withToken(fresh.token, 'GET', '/bugs', undefined, { cookie: cookie(anna) })).statusCode).toBe(200);
    expect((await withToken(fresh.token, 'GET', '/bugs/mine', undefined, { cookie: cookie(anna) })).statusCode).toBe(403);
  });

  it('a cookie alone still needs the Origin for a write, as before', async () => {
    const { rob, send, s } = await table();
    await send();
    const noOrigin = await s.call({ method: 'PATCH', url: '/api/v1/bugs/1', body: { status: 'confirmed' }, token: rob.session(), origin: null });
    expect(noOrigin.statusCode).toBe(403);
    expect(noOrigin.json()).toEqual({ error: 'cross_origin' });
  });

  it('remembers when it was used, at most once a minute', async () => {
    const { s, tokenId, asToken } = await table();
    const last = () => (s.db.prepare('SELECT last_used_at AS t FROM bug_tokens WHERE id = ?').get(tokenId) as { t: string | null }).t;
    expect(last()).toBeNull();
    await asToken('GET', '/bugs');
    expect(last()).toBe('2026-09-30T12:00:00.000Z');
    s.clock.advance(30_000);
    await asToken('GET', '/bugs');
    expect(last()).toBe('2026-09-30T12:00:00.000Z');
    s.clock.advance(31_000);
    await asToken('GET', '/bugs');
    expect(last()).toBe('2026-09-30T12:01:01.000Z');
  });
});

describe('report numbers', () => {
  it('every report gets the next number; a report is found by its number or its id, and an unknown one is not there', async () => {
    const { s, rob, send, asToken } = await table();
    const a = await send({ title: 'First' });
    const b = await send({ title: 'Second' });
    const c = await send({ title: 'Third' });
    const get = async (ref: string) => (await s.call({ url: `/api/v1/bugs/${ref}`, token: rob.session() })).json() as { bug?: { number: number; title: string } };
    expect((await get('1')).bug).toMatchObject({ number: 1, title: 'First' });
    expect((await get(c.body.id as string)).bug).toMatchObject({ number: 3, title: 'Third' });
    expect((await get((b.body.id as string).toUpperCase())).bug).toMatchObject({ number: 2 });
    for (const ref of ['4', '0', '01', '-1', '1.5', '99999999999', 'abc', `${a.body.id as string}x`]) {
      const r = await s.call({ url: `/api/v1/bugs/${ref}`, token: rob.session() });
      expect(r.statusCode, ref).toBe(404);
    }
    expect((await asToken('PATCH', '/bugs/9', { status: 'closed' })).statusCode).toBe(404);
    // sending the same one again is the same report, with the same number
    const again = await s.call({ method: 'POST', url: '/api/v1/bugs', body: a.body, token: (await s.user('anna2')).session() });
    expect(again.statusCode).toBe(409);
    expect((await get('1')).bug!.number).toBe(1);
  });
});

describe('migration 22', () => {
  it('numbers the reports that exist already by the order they came in', () => {
    const db = openDb(':memory:');
    migrate(db, loadMigrations().slice(0, 21), clock().now);
    db.prepare("INSERT INTO users (id, username, display_name, pw_hash, is_admin, created_at) VALUES ('u1', 'anna', 'Anna', 'x', 0, '2026-10-01T00:00:00Z')").run();
    const put = (id: string, at: string) => db.prepare("INSERT INTO bugs (id, reporter_id, kind, title, text, created_at, updated_at) VALUES (?, 'u1', 'bug', ?, 't', ?, ?)").run(id, id, at, at);
    // inserted out of order, and two at the same moment: the order of arrival is the time, then the order of insertion
    put('c', '2026-10-03T10:00:00Z');
    put('a', '2026-10-01T10:00:00Z');
    put('b', '2026-10-02T10:00:00Z');
    put('d', '2026-10-03T10:00:00Z');
    migrate(db, loadMigrations(), clock().now);
    const rows = db.prepare('SELECT id, number FROM bugs ORDER BY number').all();
    expect(rows).toEqual([{ id: 'a', number: 1 }, { id: 'b', number: 2 }, { id: 'c', number: 3 }, { id: 'd', number: 4 }]);
    expect(() => db.prepare("INSERT INTO bugs (id, number, reporter_id, kind, title, text, created_at, updated_at) VALUES ('e', 4, 'u1', 'bug', 'e', 't', 'x', 'x')").run()).toThrow(/UNIQUE/);
  });
});
