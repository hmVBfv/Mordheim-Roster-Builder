/* Accounts in the built campaign app (phase 3g), against a stand-in for the
   campaign server played by the browser itself (page.route): signing in
   with the authenticator, an invite, setting up the authenticator, the
   admin's tools. Runs for the campaign app only (playwright.config.ts);
   app.spec.ts checks that the Quick Build has none of it. */
import { expect, test, type Page } from '@playwright/test';
import { noSideScroll, shot, tapTargets, useTheme } from './helpers.ts';

const THEMES = ['chronicle', 'parchment'] as const;

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error' || /net::ERR_/.test(m.text())) return;
    // the stand-in refuses on purpose (a wrong password is a 401)
    if (m.location().url.includes('/api/v1/') && /status of 4\d\d/.test(m.text())) return;
    errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
});
test.afterEach(() => { expect(errors, 'console errors').toEqual([]); });

interface World {
  stage: 'out' | 'pending' | 'in';
  user: { id: string; username: string; displayName: string; isAdmin: boolean; totp: boolean; mustSetUpTotp: boolean };
}

const now = Date.now();
const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();

/** The campaign server, as far as the screens need it. */
async function playServer(page: Page, w: World) {
  const sessions = [
    { id: 's1', device: 'Chrome on Android', createdAt: iso(60 * 24 * 3), lastSeenAt: iso(1), current: true },
    { id: 's2', device: 'Firefox on Linux', createdAt: iso(60 * 24 * 20), lastSeenAt: iso(60 * 26), current: false },
  ];
  const users = [
    { id: 'a1', username: 'rob', displayName: 'Rob', isAdmin: true, totp: true, createdAt: iso(60 * 24 * 2), disabledAt: null, lastSeenAt: iso(2), sessions: 2 },
    { id: 'u1', username: 'kai', displayName: 'Kai', isAdmin: false, totp: true, createdAt: iso(60 * 24), disabledAt: null, lastSeenAt: iso(60 * 5), sessions: 1 },
    { id: 'u2', username: 'ben-the-unlucky', displayName: 'Ben', isAdmin: false, totp: false, createdAt: iso(60 * 20), disabledAt: iso(60), lastSeenAt: null, sessions: 0 },
  ];
  let invites = [{ id: 'i1', kind: 'register', note: 'for Chris', forUser: null, createdAt: iso(60 * 3), expiresAt: new Date(now + 6 * 86_400_000).toISOString() }];
  const attempts = [
    { id: 9, username: 'kai', ip: '203.0.113.9', at: iso(5), ok: true, reason: '' },
    { id: 8, username: 'kai', ip: '203.0.113.9', at: iso(6), ok: false, reason: 'code' },
    { id: 7, username: 'admin', ip: '198.51.100.23', at: iso(60 * 4), ok: false, reason: 'unknown' },
    { id: 6, username: 'admin', ip: '198.51.100.23', at: iso(60 * 4 + 1), ok: false, reason: 'braked' },
    { id: 5, username: 'rob', ip: '192.0.2.1', at: iso(60 * 30), ok: true, reason: '' },
  ];
  const audit = [
    { seq: 4, at: iso(60), actor: 'rob', action: 'user.disable', targetType: 'user', target: 'ben-the-unlucky', payload: null },
    { seq: 3, at: iso(60 * 3), actor: 'rob', action: 'invite.create', targetType: 'invite', target: 'i1', payload: { note: 'for Chris' } },
    { seq: 2, at: iso(60 * 24), actor: 'kai', action: 'user.register', targetType: 'user', target: 'kai', payload: { admin: false } },
    { seq: 1, at: iso(60 * 48), actor: null, action: 'invite.create', targetType: 'invite', target: 'i0', payload: { via: 'roster-cli', admin: true, note: 'Rob' } },
  ];
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const key = `${req.method()} ${path}`;
    const body = (req.postDataJSON() ?? {}) as Record<string, string>;
    const json = (j: unknown, status = 200) => route.fulfill({ status, json: j });
    switch (key) {
      case 'GET /auth/me': return json({ user: w.stage === 'in' ? w.user : null, pending: w.stage === 'pending' });
      case 'POST /auth/login':
        if (body.password !== 'correct horse battery') return json({ error: 'invalid_login' }, 401);
        w.stage = w.user.totp ? 'pending' : 'in';
        return json(w.stage === 'in' ? { stage: 'full', user: w.user } : { stage: 'totp' });
      case 'POST /auth/totp':
        if (body.code !== '123456') return json({ error: 'invalid_code' }, 401);
        w.stage = 'in';
        return json({ stage: 'full', user: w.user });
      case 'POST /auth/logout': w.stage = 'out'; return json({ ok: true });
      case 'GET /auth/sessions': return json({ sessions });
      case 'POST /invites/check':
        return body.token === 'tok-123' ? json({ kind: 'register', expiresAt: new Date(now + 6 * 86_400_000).toISOString(), username: null }) : json({ error: 'invalid_link' }, 404);
      case 'POST /invites/accept':
        w.stage = 'in';
        w.user = { ...w.user, username: body.username!, displayName: body.displayName || body.username! };
        return json({ stage: 'full', user: w.user });
      case 'POST /account/totp/setup':
        return json({ secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', uri: `otpauth://totp/Mordheim%20Campaign%3A${w.user.username}?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Mordheim%20Campaign&algorithm=SHA1&digits=6&period=30` });
      case 'POST /account/totp/enable':
        if (body.code !== '123456') return json({ error: 'invalid', problem: 'the code is not right – check the time on your phone' }, 400);
        w.user = { ...w.user, totp: true, mustSetUpTotp: false };
        return json({ recoveryCodes: ['k7m2-q9xd', 'a3fh-7wze', 'p2rt-x8ka', 'zm4c-b6yh', 'h9vd-3qnt', 'w5ek-r2mf', 'c8jp-t4xs', 'n6ub-y3gw', 'f2qh-m7ec', 'u4xz-k9pa'] });
      case 'GET /admin/users': return json({ users });
      case 'POST /admin/users/u1/reset': return json({ link: `${url.origin}/reset#a-reset-token-only-shown-once`, token: 'x' });
      case 'GET /admin/invites': return json({ invites });
      case 'POST /admin/invites':
        invites = [{ id: 'i2', kind: 'register', note: body.note ?? '', forUser: null, createdAt: iso(0), expiresAt: new Date(now + 7 * 86_400_000).toISOString() }, ...invites];
        return json({ id: 'i2', link: `${url.origin}/invite#a-fresh-invite-token-for-one-person`, token: 'y' });
      case 'GET /admin/logins': return json({ attempts });
      case 'GET /admin/audit': return json({ entries: audit });
      default: return json({ error: 'not_found' }, 404);
    }
  });
}

const PLAYER = { id: 'u1', username: 'kai', displayName: 'Kai', isAdmin: false, totp: true, mustSetUpTotp: false };
const ADMIN = { id: 'a1', username: 'rob', displayName: 'Rob', isAdmin: true, totp: true, mustSetUpTotp: false };

for (const theme of THEMES) {
  test(`signing in with the authenticator's code, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await playServer(page, { stage: 'out', user: PLAYER });
    await page.goto('more');
    await expect(page.getByRole('region', { name: 'Account' }).getByText(/Accounts are by invitation/)).toBeVisible();
    await shot(page, `${theme}-account-signed-out`);
    await page.getByRole('link', { name: 'Sign in' }).click();
    await page.getByLabel('Username').fill('kai');
    await page.getByLabel('Password').fill('wrong password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toHaveText('Username or password is not right.');
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-sign-in`);
    await page.getByLabel('Password').fill('correct horse battery');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByLabel('Code from your authenticator app')).toBeVisible();
    await tapTargets(page);
    await shot(page, `${theme}-sign-in-code`);
    await page.getByLabel('Code from your authenticator app').fill('123456');
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'More' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Devices' }).getByText('Firefox on Linux')).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-account`);
  });

  test(`the admin's tools, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await playServer(page, { stage: 'in', user: ADMIN });
    await page.goto('more');
    const admin = page.getByRole('region', { name: /Admin/ });
    await expect(admin.getByText('Admin only')).toBeVisible();
    await admin.getByRole('link', { name: 'Users' }).click();
    await expect(page.getByText('ben-the-unlucky')).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-admin-users`);
    await page.getByRole('button', { name: 'What to do for Kai' }).click();
    const sheet = page.getByRole('dialog', { name: 'Kai' });
    await sheet.getByRole('button', { name: 'Make a link' }).click();
    await expect(sheet.getByText(/a-reset-token-only-shown-once/)).toBeVisible();
    await shot(page, `${theme}-admin-reset-link`);
    await page.goBack();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/\/admin\/users$/);

    await page.getByRole('link', { name: 'Invites' }).click();
    await page.getByLabel(/Who is it for/).fill('for Dana');
    await page.getByRole('button', { name: 'Make an invite' }).click();
    await expect(page.getByText(/a-fresh-invite-token-for-one-person/)).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-admin-invites`);

    await page.getByRole('link', { name: 'Sign-ins' }).click();
    await expect(page.getByText('failed: held back by the brake')).toBeVisible();
    await noSideScroll(page);
    await shot(page, `${theme}-admin-sign-ins`);
    await page.getByRole('link', { name: 'Audit log' }).click();
    await expect(page.getByText('roster-cli on the Pi')).toBeVisible();
    await noSideScroll(page);
    await shot(page, `${theme}-admin-audit`);
  });
}

test('an invite: the account made from the link, the token gone from the address bar', async ({ page }) => {
  await playServer(page, { stage: 'out', user: { ...PLAYER, totp: false } });
  await page.goto('invite#tok-123');
  await expect(page.getByRole('heading', { name: 'Join the campaign' })).toBeVisible();
  expect(new URL(page.url()).hash).toBe('');
  await page.getByLabel('Username').fill('dana');
  await page.getByLabel('Name shown to the others (optional)').fill('Dana of Marienburg');
  await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
  await page.getByLabel('The password again').fill('correct horse batterz');
  await expect(page.getByText('Not the same as above.')).toBeVisible();
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'invite');
  await page.getByLabel('The password again').fill('correct horse battery');
  await page.getByRole('button', { name: 'Create the account' }).click();
  await expect(page.getByRole('region', { name: 'Account' }).getByText('Dana of Marienburg')).toBeVisible();
});

test('setting up the authenticator: the QR code, the first code, the recovery codes; Back closes the sheet', async ({ page }) => {
  await playServer(page, { stage: 'in', user: { ...ADMIN, totp: false, mustSetUpTotp: true } });
  await page.goto('more');
  await expect(page.getByText('The admin tools open once your authenticator is set up.')).toBeVisible();
  await shot(page, 'account-admin-without-authenticator');
  await page.getByRole('button', { name: 'Set up' }).click();
  const sheet = page.getByRole('dialog', { name: 'Authenticator' });
  await page.goBack();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\/more$/);
  await page.getByRole('button', { name: 'Set up' }).click();
  await sheet.getByRole('button', { name: 'Set up' }).click();
  await expect(sheet.getByRole('img', { name: 'QR code for your authenticator app' })).toBeVisible();
  await sheet.getByText('Type the key instead').click();
  await expect(sheet.getByText('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP')).toBeVisible();
  await tapTargets(page);
  await shot(page, 'authenticator-scan');
  await sheet.getByLabel('2. The code the app shows now').fill('123456');
  await sheet.getByRole('button', { name: 'Turn on' }).click();
  await expect(sheet.getByRole('list', { name: 'Recovery codes' }).getByRole('listitem')).toHaveCount(10);
  await shot(page, 'authenticator-codes');
  await sheet.getByRole('button', { name: 'I have kept them' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Authenticator on.' })).toBeVisible();
  await expect(page.getByRole('region', { name: /Admin/ }).getByRole('link', { name: 'Users' })).toBeVisible();
});

test('the admin on a wide screen: the users side by side', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await playServer(page, { stage: 'in', user: ADMIN });
  await page.goto('admin/users');
  const cards = page.getByRole('listitem').filter({ hasText: /Last seen|Never signed in/ });
  await expect(cards).toHaveCount(3);
  const [a, b] = await Promise.all([cards.nth(0).boundingBox(), cards.nth(1).boundingBox()]);
  expect(Math.round(a!.y)).toBe(Math.round(b!.y));
  await shot(page, 'admin-users-desktop');
});
