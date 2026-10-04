/* Warbands synced with the campaign server (phase 3h), in the built
   campaign app, against the stand-in server of the Vitest suites
   (src/sync/fakeSync.ts) played by the browser itself. Campaign app only
   (playwright.config.ts). */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { createFakeSync } from '../src/sync/fakeSync.ts';
import { noSideScroll, shot, tapTargets, useTheme } from './helpers.ts';

const SAVE = JSON.parse(readFileSync(new URL('./fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown>;
const KAI = { id: 'u1', username: 'kai', displayName: 'Kai', isAdmin: false, totp: false, mustSetUpTotp: false };
const T0 = '2026-10-04T10:00:00.000Z';

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error' || /net::ERR_/.test(m.text())) return;
    // the stand-in refuses on purpose (a conflict is a 409)
    if (m.location().url.includes('/api/v1/') && /status of 4\d\d/.test(m.text())) return;
    errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
});
test.afterEach(() => { expect(errors, 'console errors').toEqual([]); });

/** The server: signed in as Kai, the warband endpoints from the stand-in. */
async function playServer(page: Page, signedIn = true) {
  const f = createFakeSync();
  let me = signedIn;
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    if (f.state.down) return route.abort('internetdisconnected');
    if (path === '/auth/me') return route.fulfill({ json: { user: me ? KAI : null, pending: false } });
    if (path === '/auth/sessions') return route.fulfill({ json: { sessions: [] } });
    f.state.calls.push(`${req.method()} ${path}`);
    const res = f.handle(req.method(), path, url.searchParams, (req.postDataJSON() ?? {}) as Record<string, unknown>);
    return route.fulfill({ status: res.status, headers: { 'content-type': 'application/json' }, body: await res.text() });
  });
  return { ...f, signIn: () => { me = true; } };
}

function serverWarband(f: ReturnType<typeof createFakeSync>, name: string, draft?: { name: string; device: string }) {
  const id = crypto.randomUUID();
  const seq = ++f.state.seq;
  f.state.warbands.set(id, {
    id, headRev: 1, versions: [{ rev: 1, data: { ...SAVE, name }, createdAt: T0, source: 'save' }], archivedAt: null, seq,
    draft: draft ? { baseRev: 1, data: { ...SAVE, name: draft.name }, device: draft.device, updatedAt: T0, seq: ++f.state.seq } : null,
    copiedFrom: null, createdAt: T0,
  });
  return id;
}

test('the account’s warbands come to a new device; a change here goes up as the draft', async ({ page }) => {
  const srv = await playServer(page);
  const id = serverWarband(srv, 'The Ardent Caravan');
  await page.goto('warbands');
  await expect(page.getByRole('link', { name: /The Ardent Caravan/ })).toBeVisible();
  await expect(page.getByTitle('Saved on this device and on the campaign server')).toBeVisible();
  await page.getByRole('link', { name: /The Ardent Caravan/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'The Ardent Caravan' })).toBeVisible();
  await page.getByRole('button', { name: 'Rename the warband' }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('The Silver Caravan');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => srv.state.warbands.get(id)!.draft?.data as { name?: string } | undefined, { timeout: 8000 }).toMatchObject({ name: 'The Silver Caravan' });
  await expect(page.getByTitle('Saved on this device and on the campaign server')).toBeVisible();
  await noSideScroll(page);
  await shot(page, 'sync-roster-synced');
});

test('a new warband goes up; warbands made before signing in can join the account', async ({ page }) => {
  const srv = await playServer(page, false);
  await page.goto('warbands/new');
  await page.getByRole('combobox', { name: 'Warband' }).selectOption('merc');
  await page.getByRole('combobox', { name: 'City' }).selectOption('midd');
  await page.getByLabel('Name').fill('Made offline');
  await page.getByRole('button', { name: 'Start the warband' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Made offline' })).toBeVisible();
  expect(srv.state.calls.filter((c) => c.startsWith('POST'))).toEqual([]);

  srv.signIn();
  await page.goto('warbands');
  await expect(page.getByText('One warband is only on this device.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: /Made offline/ })).toContainText('only on this device');
  await tapTargets(page);
  await shot(page, 'sync-device-only');
  await page.getByRole('button', { name: 'Keep it in my account' }).click();
  await expect(page.getByText('One warband added to your account.')).toBeVisible();
  await expect.poll(() => srv.state.calls.filter((c) => c === 'POST /warbands').length, { timeout: 8000 }).toBe(1);
  await expect(page.getByRole('link', { name: /Made offline/ })).not.toContainText('only on this device');
});

for (const theme of ['chronicle', 'parchment'] as const) {
  test(`changed on another device as well: the player decides, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page);
    const id = serverWarband(srv, 'The Ardent Caravan');
    await page.goto(`warbands`);
    await page.getByRole('link', { name: /The Ardent Caravan/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'The Ardent Caravan' })).toBeVisible();
    // the laptop drafts while this phone renames
    srv.draftElsewhere(id, { ...SAVE, name: 'Named on the laptop' }, 'Firefox on Linux');
    await page.getByRole('button', { name: 'Rename the warband' }).click();
    await page.getByRole('dialog').getByRole('textbox').fill('Named on the phone');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    const banner = page.getByRole('alert').filter({ hasText: 'Changed on another device as well' });
    await expect(banner).toBeVisible({ timeout: 8000 });
    await expect(banner).toContainText('Firefox on Linux');
    await expect(page.getByTitle(/Changed on another device as well/)).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-sync-conflict`);
    await banner.getByRole('button', { name: 'Take the other one' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Named on the laptop' })).toBeVisible();
    await expect(banner).toBeHidden();
  });
}

test('offline the changes wait on the device and go up when it is back', async ({ page, context }) => {
  const srv = await playServer(page);
  const id = serverWarband(srv, 'The Ardent Caravan');
  await page.goto('warbands');
  await page.getByRole('link', { name: /The Ardent Caravan/ }).click();
  await expect(page.getByTitle('Saved on this device and on the campaign server')).toBeVisible();
  srv.state.down = true;
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Rename the warband' }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Renamed offline');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTitle('The campaign server does not answer; changes wait on this device')).toContainText('1 waiting', { timeout: 8000 });
  await shot(page, 'sync-offline-waiting');
  srv.state.down = false;
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => srv.state.warbands.get(id)!.draft?.data as { name?: string } | undefined, { timeout: 15000 }).toMatchObject({ name: 'Renamed offline' });
});
