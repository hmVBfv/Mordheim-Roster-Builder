/* The story of a warband (phase 4b2) in the built campaign app: from the
   roster to the Story page, the prologue and the names written into the
   save, a warrior's life opened from his menu and his profile edited from
   there. Against the stand-in server, which only supplies the warband
   (e2e/play.ts). Campaign app only (playwright.config.ts). */
import { expect, test } from '@playwright/test';
import { noSideScroll, shot, tapTargets, unit, useTheme } from './helpers.ts';
import { playServer, serverWarband } from './play.ts';

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error' || /net::ERR_/.test(m.text())) return;
    if (m.location().url.includes('/api/v1/') && /status of 4\d\d/.test(m.text())) return;
    errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
});
test.afterEach(() => { expect(errors, 'console errors').toEqual([]); });

for (const theme of ['chronicle', 'parchment'] as const) {
  test(`the story page and a warrior's life, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page);
    const id = serverWarband(srv, 'The Silver Caravan');
    await page.goto('warbands');
    await page.getByRole('link', { name: /The Silver Caravan/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'The Silver Caravan' })).toBeVisible();

    // the way in: the roster's link, and a warrior's own menu
    await page.getByRole('link', { name: 'Story', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Story' })).toBeVisible();
    await expect(page.getByText(/it goes with every export/)).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-story`);

    await page.getByRole('button', { name: 'Write the prologue' }).click();
    const sheet = page.getByRole('dialog', { name: 'The prologue' });
    await sheet.getByLabel('Prologue').fill('They came up the river with the last barge, and the ferryman did not ask their names.');
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-story-write`);
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('region', { name: 'Prologue' }).getByText('the ferryman did not ask their names', { exact: false })).toBeVisible();
    // saved in the warband itself, and on its way to the server as the draft
    await expect.poll(() => (srv.state.warbands.get(id)!.draft?.data as { story?: { prologue?: string } } | undefined)?.story?.prologue, { timeout: 8000 }).toMatch(/last barge/);

    // a life, from the chip
    await page.getByRole('group', { name: 'Heroes' }).getByRole('button', { name: /Ulrich the Grey/ }).click();
    const life = page.getByRole('dialog', { name: 'Ulrich the Grey' });
    await expect(life.getByRole('button', { name: 'Edit the profile' })).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-story-life`);
    await life.getByRole('button', { name: 'Edit the profile' }).click();
    const profile = page.getByRole('dialog', { name: /Ulrich the Grey: names, voice, story/ });
    await profile.getByLabel('Name (English)').fill('Ulrich Brandt');
    await profile.getByLabel('Title (English)').fill('the Grey');
    await tapTargets(page);
    await shot(page, `${theme}-story-profile`);
    await profile.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Ulrich the Grey: profile saved.')).toBeVisible();
    await page.getByRole('group', { name: 'Heroes' }).getByRole('button', { name: /Ulrich the Grey/ }).click();
    const again = page.getByRole('dialog', { name: 'Ulrich the Grey' });
    await expect(again.getByRole('definition').filter({ hasText: 'Ulrich Brandt' })).toBeVisible();
    await expect(again.getByRole('definition').filter({ hasText: 'the Grey' })).toBeVisible();
  });
}

test('his story so far, from the last tab of the warrior on the roster', async ({ page }) => {
  const srv = await playServer(page);
  serverWarband(srv, 'The Silver Caravan');
  await page.goto('warbands');
  await page.getByRole('link', { name: /The Silver Caravan/ }).click();
  await (await unit(page, 'Ulrich the Grey', 'Story & more')).getByRole('link', { name: /^Story so far & profile/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Story' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Ulrich the Grey' })).toBeVisible();
  // Back closes the sheet and stays in the app
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Ulrich the Grey' })).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: 'Story' })).toBeVisible();
});
