/* The client side of the accounts: requests, errors in words, who is
   signed in, and the small helpers. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, errorText, waitText } from './api.ts';
import { deviceLabel, safeNext } from './device.ts';
import { getSession, refreshSession, resetSession, signedIn, signedOut } from './session.ts';
import { fakeServer, ME } from './testServer.ts';
import { ago, stamp } from './time.ts';
import { attemptLine, auditLine } from './words.ts';

afterEach(() => { resetSession(); localStorage.clear(); });

describe('api()', () => {
  it('reads JSON, sends writes as JSON with a body, always to the app’s own origin', async () => {
    const s = fakeServer({ 'GET /auth/me': () => ({ user: null, pending: false }), 'POST /auth/logout': () => ({ ok: true }) });
    expect(await api('/auth/me')).toEqual({ user: null, pending: false });
    expect(await api('/auth/logout', { method: 'POST' })).toEqual({ ok: true });
    const [get, post] = s.fetchMock.mock.calls.map((c) => c[1]!);
    expect(get).toMatchObject({ method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } });
    expect(get!.body).toBeUndefined();
    expect(post).toMatchObject({ method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
    expect(String(s.fetchMock.mock.calls[0]![0])).toBe('/api/v1/auth/me');
  });

  it('turns the server’s refusals into errors with code, reason and wait', async () => {
    fakeServer({
      'POST /auth/login': () => [429, { error: 'too_many_attempts', retryAfter: 60 }],
      'POST /invites/accept': () => [400, { error: 'invalid', problem: 'at least 12 characters' }],
    });
    const e1 = await api('/auth/login', { body: {} }).catch((e: unknown) => e) as ApiError;
    expect(e1).toBeInstanceOf(ApiError);
    expect([e1.status, e1.code, e1.retryAfter]).toEqual([429, 'too_many_attempts', 60]);
    expect(errorText(e1)).toBe('Too many attempts. Try again in 60 seconds.');
    const e2 = await api('/invites/accept', { body: {} }).catch((e: unknown) => e) as ApiError;
    expect(errorText(e2)).toBe('At least 12 characters.');
  });

  it('no server (offline, or a page that is not JSON): unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const e1 = await api('/auth/me').catch((e: unknown) => e) as ApiError;
    expect([e1.status, e1.unreachable]).toEqual([0, true]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })));
    const e2 = await api('/auth/me').catch((e: unknown) => e) as ApiError;
    expect([e2.code, e2.unreachable]).toEqual(['unavailable', true]);
    expect(errorText(e2)).toMatch(/does not answer|offline/);
  });

  it('waits in words', () => {
    expect(waitText(30)).toBe('30 seconds');
    expect(waitText(900)).toBe('15 minutes');
  });
});

describe('the session', () => {
  it('asks the server, keeps the user for offline, forgets on sign-out', async () => {
    fakeServer({ 'GET /auth/me': () => ({ user: ME, pending: false }) });
    expect(await refreshSession()).toEqual({ status: 'in', user: ME });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect(await refreshSession()).toEqual({ status: 'unreachable', user: ME });
    signedOut();
    expect(getSession()).toEqual({ status: 'out' });
    expect(await refreshSession()).toEqual({ status: 'unreachable', user: null });
  });

  it('pending while the code is due', async () => {
    fakeServer({ 'GET /auth/me': () => ({ user: null, pending: true }) });
    expect(await refreshSession()).toEqual({ status: 'pending' });
    signedIn({ stage: 'full', user: ME });
    expect(getSession()).toEqual({ status: 'in', user: ME });
    expect(JSON.parse(localStorage.getItem('mordheim-me')!)).toEqual(ME);
  });
});

describe('helpers', () => {
  it('names the device', () => {
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36')).toBe('Chrome on Android');
    expect(deviceLabel('Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0')).toBe('Firefox on Linux');
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe('Safari on iPhone');
    expect(deviceLabel('curl/8')).toBe('Browser');
  });

  it('goes only to a path of this app after signing in', () => {
    expect(safeNext('/warbands/7')).toBe('/warbands/7');
    expect(safeNext('https://evil.example')).toBe('/more');
    expect(safeNext('//evil.example')).toBe('/more');
    expect(safeNext('/\\evil.example')).toBe('/more');
    expect(safeNext(null)).toBe('/more');
  });

  it('times: how long ago, and the logs’ stamp', () => {
    const now = new Date('2026-10-03T12:00:00Z');
    expect(ago('2026-10-03T11:59:30Z', now)).toBe('just now');
    expect(ago('2026-10-03T11:30:00Z', now)).toBe('30 minutes ago');
    expect(ago('2026-10-03T07:00:00Z', now)).toBe('5 hours ago');
    expect(ago('2026-10-02T09:00:00Z', now)).toBe('yesterday');
    expect(ago('2026-09-29T12:00:00Z', now)).toBe('4 days ago');
    expect(ago('2026-08-01T12:00:00Z', now)).toBe('1 Aug');
    expect(ago('2025-08-01T12:00:00Z', now)).toBe('1 Aug 2025');
    expect(stamp('2026-10-03T12:05:00Z')).toMatch(/^3 Oct, \d\d:05$/);
  });

  it('the logs in words', () => {
    expect(auditLine({ seq: 1, at: '', actor: null, action: 'invite.create', targetType: 'invite', target: 'x', payload: { via: 'roster-cli', admin: true, note: 'Rob' } }))
      .toEqual({ who: 'roster-cli on the Pi', what: 'made an invite', detail: '“Rob” · an admin account' });
    expect(auditLine({ seq: 2, at: '', actor: 'rob', action: 'totp.reset', targetType: 'user', target: 'kai', payload: { signedOut: 2 } }))
      .toEqual({ who: 'rob', what: 'removed the authenticator of kai', detail: '2 signed out' });
    expect(auditLine({ seq: 3, at: '', actor: 'kai', action: 'something.new', targetType: null, target: null, payload: null }).what).toBe('something.new');
    expect(attemptLine({ id: 1, username: 'kai', ip: '1.2.3.4', at: '', ok: false, reason: 'braked' })).toBe('failed: held back by the brake');
    expect(attemptLine({ id: 2, username: 'kai', ip: '1.2.3.4', at: '', ok: true, reason: '' })).toBe('signed in');
  });
});
