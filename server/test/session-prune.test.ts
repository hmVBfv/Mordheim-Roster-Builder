/* Devices that nobody uses any more are dropped (wish #44): one unused for
   30 days is gone in any case; once an account has more than five, those
   unused for 7 days go, the oldest first, until five are left. */
import { describe, expect, it } from 'vitest';
import { PASSWORD, startAccounts } from './accounts-helpers.ts';

const DAY = 24 * 60 * 60 * 1000;

type S = Awaited<ReturnType<typeof startAccounts>>;
const login = (s: S, username: string) => s.call({ url: '/api/v1/auth/login', body: { username, password: PASSWORD, device: 'Phone' } });
const open = (s: S, token: string) => (s.call({ url: '/api/v1/auth/sessions', token }).then((r) => (r.json() as { sessions: unknown[] }).sessions.length));

describe('devices', () => {
  it('a device unused for 30 days is signed out, one used on day 25 lives on', async () => {
    const s = await startAccounts();
    const p = await s.user('player');
    const idle = p.session();
    const used = p.session();
    s.clock.advance(25 * DAY);
    expect((await s.call({ url: '/api/v1/auth/me', token: used })).json()).toMatchObject({ user: { username: 'player' } });
    s.clock.advance(6 * DAY);
    expect((await s.call({ url: '/api/v1/auth/me', token: idle })).json()).toEqual({ user: null, pending: false });
    expect((await s.call({ url: '/api/v1/auth/me', token: used })).json()).toMatchObject({ user: { username: 'player' } });
  });

  it('over five devices, those unused for 7 days go at the next sign-in, the oldest first', async () => {
    const s = await startAccounts();
    const p = await s.user('player');
    const old = [p.session(), p.session()];
    s.clock.advance(1 * DAY);
    const mid = [p.session(), p.session(), p.session()];
    s.clock.advance(8 * DAY);
    const here = p.session();
    expect(await open(s, here)).toBe(6);
    await login(s, 'player');
    // seven open, two over: the two oldest idle ones go
    expect(await open(s, here)).toBe(5);
    for (const t of old) expect((await s.call({ url: '/api/v1/auth/me', token: t })).json()).toEqual({ user: null, pending: false });
    for (const t of mid) expect((await s.call({ url: '/api/v1/auth/me', token: t })).json()).toMatchObject({ user: { username: 'player' } });
  });

  it('five devices or fewer stay, however idle; and no device used within 7 days is dropped', async () => {
    const s = await startAccounts();
    const few = await s.user('few');
    for (let i = 0; i < 3; i++) few.session();
    const many = await s.user('many');
    s.clock.advance(8 * DAY);
    const fresh = Array.from({ length: 7 }, () => many.session());
    const here = few.session();
    await login(s, 'few');
    expect(await open(s, here)).toBe(5);
    await login(s, 'many');
    expect(await open(s, fresh[0]!)).toBe(8);
  });

  it('the device just signed in is never dropped, and others’ devices are not touched', async () => {
    const s = await startAccounts();
    const p = await s.user('player');
    const q = await s.user('other');
    for (let i = 0; i < 6; i++) p.session();
    const theirs = q.session();
    s.clock.advance(10 * DAY);
    const res = await login(s, 'player');
    expect(res.statusCode).toBe(200);
    expect((await s.call({ url: '/api/v1/auth/me', token: theirs })).json()).toMatchObject({ user: { username: 'other' } });
    expect(await open(s, theirs)).toBe(1);
  });
});
