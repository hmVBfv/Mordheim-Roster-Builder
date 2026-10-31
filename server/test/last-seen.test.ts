/* "Last seen" of a user (Rob, 31.10.2026): the last time somebody was really at the app – changing section, working on a roster –
   not a tab left open in the background that only syncs. The app says so with `X-Roster-Active: 1` on a request; a request without
   it keeps the session alive as before and does not move "Last seen". */
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

const MIN = 60 * 1000;
const ACTIVE = { 'x-roster-active': '1' };

async function setup() {
  const s = await startAccounts();
  const admin = await s.user('rob', { admin: true, totp: true });
  const kai = await s.user('kai');
  const token = kai.session();
  const seen = async () => ((await s.call({ url: '/api/v1/admin/users', token: admin.session() })).json() as { users: { username: string; lastSeenAt: string | null }[] }).users.find((u) => u.username === 'kai')!.lastSeenAt;
  const devices = async () => ((await s.call({ url: '/api/v1/auth/sessions', token })).json() as { sessions: { lastSeenAt: string }[] }).sessions[0]!.lastSeenAt;
  return { s, token, seen, devices };
}

describe('last seen', () => {
  it('starts when the user signs in', async () => {
    const { s, seen } = await setup();
    expect(await seen()).toBe(s.clock.now().toISOString());
  });

  it('does not move for a request that is only the app syncing in the background, however often and however late', async () => {
    const { s, token, seen } = await setup();
    const first = await seen();
    for (let i = 0; i < 4; i++) {
      s.clock.advance(30 * MIN);
      expect((await s.call({ url: '/api/v1/auth/me', token })).statusCode).toBe(200);
    }
    expect(await seen()).toBe(first);
  });

  it('moves when the app says somebody is there, and no more often than every five minutes', async () => {
    const { s, token, seen, devices } = await setup();
    const first = await seen();
    s.clock.advance(2 * MIN);
    await s.call({ url: '/api/v1/auth/me', token, headers: ACTIVE });
    expect(await seen()).toBe(first);
    s.clock.advance(4 * MIN);
    await s.call({ url: '/api/v1/auth/me', token, headers: ACTIVE });
    expect(await seen()).toBe(s.clock.now().toISOString());
    expect(await devices()).toBe(s.clock.now().toISOString());
  });

  it('is claimed by the session’s owner only: a request without a session says nothing', async () => {
    const { s, seen } = await setup();
    const first = await seen();
    s.clock.advance(20 * MIN);
    await s.call({ url: '/api/v1/auth/me', headers: ACTIVE });
    expect(await seen()).toBe(first);
  });

  it('leaves the session as it was: still renewed by any request, once an hour', async () => {
    const { s, token } = await setup();
    s.clock.advance(90 * 60 * MIN / 60);
    const r = await s.call({ url: '/api/v1/auth/me', token });
    expect(String(r.headers['set-cookie'] ?? '')).toContain(token);
  });
});
