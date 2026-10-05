/* Warbands synced with the campaign server (phase 3h), in the built
   campaign app, against the stand-in server of the Vitest suites
   (src/sync/fakeSync.ts) played by the browser itself. Campaign app only
   (playwright.config.ts). */
import { expect, test } from '@playwright/test';
import { noSideScroll, shot, tapTargets, useTheme } from './helpers.ts';
import { playServer, SAVE, serverWarband } from './play.ts';

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
  // the roster's parts are loaded before the line goes down (a fresh browser has no cached copy yet)
  await expect(page.getByRole('heading', { level: 1, name: 'The Ardent Caravan' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rename the warband' })).toBeVisible();
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

test('versions: one saved with a note, an older one brought back; a copy as a blueprint', async ({ page }) => {
  const srv = await playServer(page);
  const id = serverWarband(srv, 'The Ardent Caravan');
  await page.goto(`warbands/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: 'The Ardent Caravan' })).toBeVisible();
  await page.getByRole('link', { name: /^Versions/ }).click();
  await page.getByLabel('A note for this version (optional)').fill('before the battle at the Docks');
  await page.getByRole('button', { name: 'Save a version' }).click();
  await expect(page.getByText('Version 2 saved.')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Versions' }).getByText('“before the battle at the Docks”', { exact: false })).toBeVisible();
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'versions');
  await page.getByRole('button', { name: 'Version 1: what to do' }).click();
  await shot(page, 'versions-sheet');
  await page.getByRole('dialog', { name: 'Version 1' }).getByRole('button', { name: 'Make a copy' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'The Ardent Caravan (copy)' })).toBeVisible();
  await expect.poll(() => [...srv.state.warbands.values()].find((w) => w.copiedFrom)?.copiedFrom, { timeout: 8000 }).toEqual({ id, rev: 1 });
});

test('a warband sent from the Quick Build arrives through its link', async ({ page }) => {
  const srv = await playServer(page);
  const { encodeSave } = await import('../src/share/link.ts');
  const fragment = await encodeSave({ ...SAVE, name: 'Planned at lunch' });
  await page.goto(`import#${fragment}`);
  await expect(page.getByRole('heading', { level: 2, name: 'Planned at lunch' })).toBeVisible();
  expect(new URL(page.url()).hash).toBe('');
  await noSideScroll(page);
  await shot(page, 'import-link');
  await page.getByRole('button', { name: 'Add as a new warband' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Planned at lunch' })).toBeVisible();
  await expect.poll(() => [...srv.state.warbands.values()].map((w) => w.versions[0]!.source), { timeout: 8000 }).toEqual(['import']);
});

/* Sharing (Rob, 05.10.2026): a copy straight to another player, or a short
   code – always a copy of their own. */
for (const theme of ['chronicle', 'parchment'] as const) {
  test(`Share…: a copy to a player, or a share code, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page);
    const id = serverWarband(srv, 'The Ardent Caravan');
    await page.goto(`warbands/${id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'The Ardent Caravan' })).toBeVisible();
    await page.getByRole('button', { name: 'Share…' }).click();
    const sheet = page.getByRole('dialog', { name: 'Share The Ardent Caravan' });
    await sheet.getByRole('radio', { name: /^Ben/ }).check();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-share-sheet`);
    await sheet.getByRole('button', { name: 'Send the copy' }).click();
    await expect(page.getByText('Sent to Ben.', { exact: false })).toBeVisible();
    expect(srv.state.shares[0]).toMatchObject({ toId: 'user-ben', name: 'The Ardent Caravan' });

    await page.getByRole('button', { name: 'Share…' }).click();
    await sheet.getByRole('button', { name: 'Make a share code' }).click();
    await expect(sheet.getByLabel('Share code', { exact: true })).toHaveText('K7M2-Q9XD');
    await expect(sheet.getByRole('list')).toContainText('code · taken 0×');
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-share-code`);
  });
}

test('a copy sent to you is taken from Home; a code is entered on Warbands', async ({ page }) => {
  const srv = await playServer(page);
  srv.shareFrom('Ben', { ...SAVE, name: 'The Ardent Caravan' });
  srv.shareFrom('Rob', { ...SAVE, name: 'Rob’s Spare' }, 'H4TR8WNP');
  await page.goto('');
  const list = page.getByRole('list', { name: 'Sent to you' });
  await expect(list).toContainText('Ben sent you The Ardent Caravan');
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'share-incoming');
  await list.getByRole('button', { name: 'Take it' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'The Ardent Caravan' })).toBeVisible();

  await page.goto('warbands');
  await page.getByRole('button', { name: 'Enter a share code' }).click();
  const sheet = page.getByRole('dialog', { name: 'Enter a share code' });
  await sheet.getByLabel('The code another player gave you').fill('h4tr-8wnp');
  await sheet.getByRole('button', { name: 'Look it up' }).click();
  await expect(sheet).toContainText('Rob’s Spare');
  await expect(sheet).toContainText('from Rob');
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'share-code-entered');
  await sheet.getByRole('button', { name: 'Add the copy' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Rob’s Spare' })).toBeVisible();
  expect([...srv.state.warbands.values()].map((w) => w.versions[0]!.note)).toEqual(['shared by Ben', 'shared by Rob']);
  // the copies are in step: the sync sends nothing for them
  await page.waitForTimeout(500);
  expect(srv.state.calls.filter((c) => c === 'POST /warbands' || c.endsWith('/autosave'))).toEqual([]);
});
