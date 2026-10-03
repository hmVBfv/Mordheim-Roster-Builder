/* The account screens as a player and the admin reach them, against a
   stand-in for the campaign server. */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../app/App.tsx';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';
import { resetSession } from './session.ts';
import { ADMIN, fakeServer, ME } from './testServer.ts';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
afterEach(() => { cleanup(); resetSession(); localStorage.clear(); });

describe('signing in', () => {
  it('password, then the authenticator’s code, then the account', async () => {
    let stage: 'out' | 'pending' | 'in' = 'out';
    const s = fakeServer({
      'GET /auth/me': () => ({ user: stage === 'in' ? { ...ME, totp: true } : null, pending: stage === 'pending' }),
      'POST /auth/login': (b) => (b.password === 'correct horse battery' ? (stage = 'pending', { stage: 'totp' }) : [401, { error: 'invalid_login' }]),
      'POST /auth/totp': (b) => (b.code === '123456' ? (stage = 'in', { stage: 'full', user: { ...ME, totp: true } }) : [401, { error: 'invalid_code' }]),
      'GET /auth/sessions': () => ({ sessions: [{ id: 's1', device: 'Chrome on Android', createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), current: true }] }),
    });
    const user = userEvent.setup();
    at('/sign-in');
    await user.type(await screen.findByLabelText('Username'), 'kai');
    await user.type(screen.getByLabelText('Password'), 'wrong password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Username or password is not right.');
    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    const code = await screen.findByLabelText('Code from your authenticator app');
    expect(s.calls.find((c) => c.path === '/auth/login')!.body).toMatchObject({ username: 'kai', device: expect.any(String) });
    await user.type(code, '654321');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/That code is not right/);
    await user.click(screen.getByRole('button', { name: 'Use a recovery code' }));
    expect(screen.getByLabelText('One of your recovery codes')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Use the app’s code' }));
    await user.type(screen.getByLabelText('Code from your authenticator app'), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    // the account in More
    expect(await screen.findByRole('heading', { level: 1, name: 'More' })).toBeTruthy();
    const account = screen.getByRole('region', { name: 'Account' });
    expect(within(account).getByText('Kai')).toBeTruthy();
    expect(within(account).getByText(/On – a code after the password/)).toBeTruthy();
    expect(await screen.findByText('Chrome on Android')).toBeTruthy();
  });

  it('More, signed out: the way to sign in, no devices, no admin', async () => {
    fakeServer({ 'GET /auth/me': () => ({ user: null, pending: false }) });
    at('/more');
    const account = await screen.findByRole('region', { name: 'Account' });
    expect(await within(account).findByRole('link', { name: 'Sign in' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Devices' })).toBeNull();
    expect(screen.queryByRole('region', { name: /Admin/ })).toBeNull();
  });

  it('More, the server unreachable: the warbands still work, the last user is named', async () => {
    localStorage.setItem('mordheim-me', JSON.stringify(ME));
    // Caddy's answer while the app is down: no JSON
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 502, headers: { 'content-type': 'text/plain' } })));
    at('/more');
    expect(await screen.findByText(/does not answer right now/)).toBeTruthy();
    expect(screen.getByText('Kai')).toBeTruthy();
  });
});

describe('a link from the admin', () => {
  it('an invite: the token leaves the address bar and goes in the body; the account is made', async () => {
    window.history.replaceState(null, '', '/invite#tok-123');
    const s = fakeServer({
      'GET /auth/me': () => ({ user: null, pending: false }),
      'POST /invites/check': () => ({ kind: 'register', expiresAt: '2026-10-10T12:00:00.000Z', username: null }),
      'POST /invites/accept': (b) => (b.username === 'taken' ? [400, { error: 'invalid', problem: 'that username is taken' }] : { stage: 'full', user: { ...ME, username: String(b.username) } }),
      'GET /auth/sessions': () => ({ sessions: [] }),
    });
    const user = userEvent.setup();
    at('/invite');
    expect(await screen.findByRole('heading', { name: 'Join the campaign' })).toBeTruthy();
    expect(window.location.hash).toBe('');
    expect(s.calls.find((c) => c.path === '/invites/check')!.body).toEqual({ token: 'tok-123' });
    await user.type(screen.getByLabelText('Username'), 'taken');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.type(screen.getByLabelText('The password again'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create the account' }));
    expect((await screen.findByRole('alert')).textContent).toBe('The password needs at least 12 characters.');
    await user.clear(screen.getByLabelText('Password'));
    await user.clear(screen.getByLabelText('The password again'));
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.type(screen.getByLabelText('The password again'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Create the account' }));
    expect((await screen.findByRole('alert')).textContent).toBe('That username is taken.');
    await user.clear(screen.getByLabelText('Username'));
    await user.type(screen.getByLabelText('Username'), 'kai');
    await user.click(screen.getByRole('button', { name: 'Create the account' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'More' })).toBeTruthy();
    expect(s.calls.filter((c) => c.path === '/invites/accept').at(-1)!.body).toMatchObject({ token: 'tok-123', username: 'kai', password: 'correct horse battery' });
  });

  it('a used link says so', async () => {
    window.history.replaceState(null, '', '/reset#gone');
    fakeServer({ 'GET /auth/me': () => ({ user: null, pending: false }), 'POST /invites/check': () => [404, { error: 'invalid_link' }] });
    at('/reset');
    expect((await screen.findByRole('alert')).textContent).toMatch(/no longer valid/);
  });

  it('a reset link names the account', async () => {
    window.history.replaceState(null, '', '/reset#tok-9');
    fakeServer({ 'GET /auth/me': () => ({ user: null, pending: false }), 'POST /invites/check': () => ({ kind: 'reset', expiresAt: '2026-10-04T12:00:00.000Z', username: 'kai' }) });
    at('/reset');
    expect(await screen.findByRole('heading', { name: 'A new password' })).toBeTruthy();
    expect(screen.getByText('kai')).toBeTruthy();
  });
});

describe('the account', () => {
  it('sets up the authenticator: QR code, the first code, the recovery codes', async () => {
    let totp = false;
    const s = fakeServer({
      'GET /auth/me': () => ({ user: { ...ME, totp }, pending: false }),
      'GET /auth/sessions': () => ({ sessions: [] }),
      'POST /account/totp/setup': () => ({ secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', uri: 'otpauth://totp/Mordheim%20Campaign%3Akai?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Mordheim%20Campaign' }),
      'POST /account/totp/enable': (b) => (b.code === '123456' ? (totp = true, { recoveryCodes: ['abcd-efgh', 'jkmn-pqrs'] }) : [400, { error: 'invalid', problem: 'the code is not right – check the time on your phone' }]),
    });
    const user = userEvent.setup();
    at('/more');
    await user.click(await screen.findByRole('button', { name: 'Set up' }));
    const sheet = screen.getByRole('dialog', { name: 'Authenticator' });
    await user.click(within(sheet).getByRole('button', { name: 'Set up' }));
    expect(await within(sheet).findByRole('img', { name: 'QR code for your authenticator app' })).toBeTruthy();
    expect(within(sheet).getByRole('link', { name: 'Open in the app' }).getAttribute('href')).toMatch(/^otpauth:\/\/totp\//);
    expect(within(sheet).getByText('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP')).toBeTruthy();
    await user.type(within(sheet).getByLabelText('2. The code the app shows now'), '000000');
    await user.click(within(sheet).getByRole('button', { name: 'Turn on' }));
    expect((await within(sheet).findByRole('alert')).textContent).toBe('The code is not right – check the time on your phone.');
    await user.clear(within(sheet).getByLabelText('2. The code the app shows now'));
    await user.type(within(sheet).getByLabelText('2. The code the app shows now'), '123456');
    await user.click(within(sheet).getByRole('button', { name: 'Turn on' }));
    const codes = await within(sheet).findByRole('list', { name: 'Recovery codes' });
    expect(within(codes).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['abcd-efgh', 'jkmn-pqrs']);
    await user.click(within(sheet).getByRole('button', { name: 'I have kept them' }));
    expect(await screen.findByText(/On – a code after the password/)).toBeTruthy();
    expect(s.calls.filter((c) => c.path === '/auth/me').length).toBeGreaterThan(1);
  });

  it('changes the password and signs out other devices', async () => {
    const now = new Date().toISOString();
    let sessions = [
      { id: 's1', device: 'Firefox on Linux', createdAt: now, lastSeenAt: now, current: true },
      { id: 's2', device: 'Chrome on Android', createdAt: now, lastSeenAt: now, current: false },
      { id: 's3', device: 'Safari on iPad', createdAt: now, lastSeenAt: now, current: false },
    ];
    const s = fakeServer({
      'GET /auth/me': () => ({ user: ME, pending: false }),
      'GET /auth/sessions': () => ({ sessions }),
      'DELETE /auth/sessions/s2': () => { sessions = sessions.filter((x) => x.id !== 's2'); return { revoked: 1 }; },
      'DELETE /auth/sessions/others': () => { sessions = sessions.filter((x) => x.current); return { revoked: 1 }; },
      'POST /account/password': (b) => (b.current === 'correct horse battery' ? { ok: true, signedOut: 0 } : [400, { error: 'invalid', problem: 'the current password is not right' }]),
    });
    const user = userEvent.setup();
    at('/more');
    const devices = await screen.findByRole('region', { name: 'Devices' });
    expect(await within(devices).findByText('Chrome on Android')).toBeTruthy();
    expect(within(devices).getByText(/This device/)).toBeTruthy();
    await user.click(within(devices).getAllByRole('button', { name: 'Sign out' })[0]!);
    expect(await screen.findByText('Signed out there.')).toBeTruthy();
    await user.click(within(devices).getByRole('button', { name: 'Sign out everywhere else' }));
    expect(await screen.findByText('Signed out on one other device.')).toBeTruthy();
    expect(within(devices).queryByRole('button', { name: 'Sign out everywhere else' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Change' }));
    const sheet = screen.getByRole('dialog', { name: 'Password' });
    await user.type(within(sheet).getByLabelText('Current password'), 'not it');
    await user.type(within(sheet).getByLabelText('New password'), 'a much longer passphrase');
    await user.type(within(sheet).getByLabelText('The new password again'), 'a much longer passphrase');
    await user.click(within(sheet).getByRole('button', { name: 'Change the password' }));
    expect((await within(sheet).findByRole('alert')).textContent).toBe('The current password is not right.');
    await user.clear(within(sheet).getByLabelText('Current password'));
    await user.type(within(sheet).getByLabelText('Current password'), 'correct horse battery');
    await user.click(within(sheet).getByRole('button', { name: 'Change the password' }));
    expect(await screen.findByText('Password changed.')).toBeTruthy();
    expect(s.calls.find((c) => c.path === '/account/password' && c.body.current === 'correct horse battery')!.body.next).toBe('a much longer passphrase');
  });

  it('an admin without the authenticator is told to set it up; the admin tools stay closed', async () => {
    fakeServer({ 'GET /auth/me': () => ({ user: { ...ADMIN, totp: false, mustSetUpTotp: true }, pending: false }), 'GET /auth/sessions': () => ({ sessions: [] }) });
    at('/more');
    expect(await screen.findByText(/Set it up to open the admin tools/)).toBeTruthy();
    const admin = screen.getByRole('region', { name: /Admin/ });
    expect(within(admin).queryByRole('link')).toBeNull();
    expect(within(admin).getByText('Admin only')).toBeTruthy();
  });
});

describe('the admin', () => {
  const users = [
    { id: 'a1', username: 'rob', displayName: 'Rob', isAdmin: true, totp: true, createdAt: '2026-10-01T10:00:00Z', disabledAt: null, lastSeenAt: '2026-10-03T10:00:00Z', sessions: 2 },
    { id: 'u1', username: 'kai', displayName: 'Kai', isAdmin: false, totp: true, createdAt: '2026-10-02T10:00:00Z', disabledAt: null, lastSeenAt: null, sessions: 1 },
  ];

  it('users: a reset link for a player, shown once; not for oneself', async () => {
    const s = fakeServer({
      'GET /auth/me': () => ({ user: ADMIN, pending: false }),
      'GET /admin/users': () => ({ users }),
      'POST /admin/users/u1/reset': () => ({ link: 'https://mordheim.test/reset#abc', token: 'abc' }),
      'POST /admin/users/u1/totp-reset': () => ({ ok: true, signedOut: 1 }),
    });
    const user = userEvent.setup();
    at('/admin/users');
    expect(await screen.findByText('Kai')).toBeTruthy();
    expect(screen.getByText('you')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'What to do for Rob' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'What to do for Kai' }));
    const sheet = screen.getByRole('dialog', { name: 'Kai' });
    await user.click(within(sheet).getByRole('button', { name: 'Make a link' }));
    expect(await within(sheet).findByText('https://mordheim.test/reset#abc')).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Done' }));
    await user.click(screen.getByRole('button', { name: 'What to do for Kai' }));
    await user.click(within(sheet).getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Kai’s authenticator removed; signed out everywhere.')).toBeTruthy();
    expect(s.calls.map((c) => `${c.method} ${c.path}`)).toContain('POST /admin/users/u1/totp-reset');
  });

  it('invites: make one with a note, revoke an open one', async () => {
    let open = [{ id: 'i1', kind: 'register', note: 'for Ben', forUser: null, createdAt: '2026-10-03T09:00:00Z', expiresAt: '2026-10-10T09:00:00Z' }];
    const s = fakeServer({
      'GET /auth/me': () => ({ user: ADMIN, pending: false }),
      'GET /admin/invites': () => ({ invites: open }),
      'POST /admin/invites': () => ({ id: 'i2', link: 'https://mordheim.test/invite#xyz', token: 'xyz' }),
      'DELETE /admin/invites/i1': () => { open = []; return { ok: true }; },
    });
    const user = userEvent.setup();
    at('/admin/invites');
    expect(await screen.findByText('for Ben')).toBeTruthy();
    await user.type(screen.getByLabelText(/Who is it for/), 'for Chris');
    await user.click(screen.getByRole('button', { name: 'Make an invite' }));
    expect(await screen.findByText('https://mordheim.test/invite#xyz')).toBeTruthy();
    expect(s.calls.find((c) => c.method === 'POST' && c.path === '/admin/invites')!.body).toEqual({ note: 'for Chris' });
    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(await screen.findByText('None open.')).toBeTruthy();
  });

  it('sign-ins and the audit log, page by page', async () => {
    const attempts = Array.from({ length: 50 }, (_, i) => ({ id: 100 - i, username: 'kai', ip: '203.0.113.9', at: '2026-10-03T10:00:00Z', ok: i % 2 === 0, reason: i % 2 ? 'password' : '' }));
    const s = fakeServer({
      'GET /auth/me': () => ({ user: ADMIN, pending: false }),
      'GET /admin/logins': (_b, url) => ({ attempts: url.searchParams.get('before') ? [{ id: 1, username: 'ben', ip: '198.51.100.7', at: '2026-10-01T10:00:00Z', ok: false, reason: 'braked' }] : attempts }),
      'GET /admin/audit': () => ({ entries: [{ seq: 3, at: '2026-10-03T10:00:00Z', actor: 'rob', action: 'invite.create', targetType: 'invite', target: 'i1', payload: { note: 'for Ben' } }] }),
    });
    const user = userEvent.setup();
    at('/admin/logins');
    const log = await screen.findByRole('list', { name: 'Sign-ins' });
    expect(await within(log).findAllByText('failed: wrong password')).toHaveLength(25);
    await user.click(screen.getByRole('button', { name: 'Older' }));
    expect(await within(log).findByText('failed: held back by the brake')).toBeTruthy();
    expect(s.calls.find((c) => c.url.searchParams.get('before'))!.url.searchParams.get('before')).toBe('51');
    expect(screen.queryByRole('button', { name: 'Older' })).toBeNull();
    await user.click(screen.getByRole('link', { name: 'Audit log' }));
    const audit = await screen.findByRole('list', { name: 'Audit log' });
    expect(within(audit).getByText('made an invite')).toBeTruthy();
    expect(within(audit).getByText('“for Ben”')).toBeTruthy();
  });

  it('a player at /admin is told it is the admin’s', async () => {
    fakeServer({ 'GET /auth/me': () => ({ user: ME, pending: false }) });
    at('/admin');
    expect(await screen.findByText('Only the admin sees this.')).toBeTruthy();
  });
});
