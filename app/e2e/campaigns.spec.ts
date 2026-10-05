/* Campaigns (phase 4a1) in the built campaign app, against the stand-in
   server (e2e/play.ts): the overview, another player's warband to read,
   entering a warband, what a leader manages, starting a campaign. Campaign
   app only (playwright.config.ts). */
import { expect, test } from '@playwright/test';
import { noSideScroll, shot, tapTargets, useTheme } from './helpers.ts';
import { playServer, SAVE, serverWarband } from './play.ts';

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

const others = [
  { player: 'Anna', data: { ...SAVE, name: 'The Grey Penitents' }, role: 'leader' as const },
  { player: 'Ben', data: { ...SAVE, name: 'Clan Skrittle' }, pending: true },
];

for (const theme of ['chronicle', 'parchment'] as const) {
  test(`the overview, and another player's warband to read, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page);
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others });
    await page.goto('campaign');
    await expect(page.getByRole('heading', { level: 1, name: 'The Hel Fenn Campaign' })).toBeVisible();
    const list = page.getByRole('list', { name: 'Warbands' });
    await expect(list.getByRole('link')).toHaveCount(2);
    await expect(list.getByRole('link').first()).toContainText('✓ Start');
    await expect(list.getByRole('link').nth(1)).toContainText('Waiting for a leader');
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-campaign-overview`);
    await list.getByRole('link').first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'The Grey Penitents' })).toBeVisible();
    await expect(page.getByText(/Start marked .*: rating \d+/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Advance' })).toHaveCount(0);
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-campaign-warband`);
    expect(c.id).toBeTruthy();
  });
}

test('a leader manages: confirms a warband, adds someone, changes a role', async ({ page }) => {
  const srv = await playServer(page, true, { totp: true });
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others });
  await page.goto(`campaign/${c.id}/manage`);
  await expect(page.getByRole('heading', { name: 'Waiting for a leader' })).toBeVisible();
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'campaign-manage');
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Clan Skrittle takes part; its start is marked.')).toBeVisible();
  await page.getByLabel('Who').selectOption('user-rob');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Rob: Player.')).toBeVisible();
  await page.getByLabel('Role of Rob').selectOption('viewer');
  await expect(page.getByText('Rob: Viewer.')).toBeVisible();
  expect(srv.state.campaigns.get(c.id)!.enrolments.map((e) => e.status)).toEqual(['active', 'active']);
});

test('entering a warband: a copy goes in and opens; it can leave again', async ({ page }) => {
  const srv = await playServer(page);
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: others.slice(0, 1) });
  serverWarband(srv, 'The Silver Caravan');
  await page.goto('warbands');
  await expect(page.getByRole('link', { name: /The Silver Caravan/ })).toBeVisible();
  await page.goto(`campaign/${c.id}`);
  await page.getByRole('button', { name: 'Enter a warband' }).click();
  const sheet = page.getByRole('dialog', { name: 'Enter a warband' });
  await sheet.getByRole('radio', { name: /The Silver Caravan/ }).check();
  await tapTargets(page);
  await shot(page, 'campaign-enter');
  await sheet.getByRole('button', { name: 'Enter a copy' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'The Silver Caravan' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'In The Hel Fenn Campaign' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove the warband' })).toHaveCount(0);
  await noSideScroll(page);
  await page.getByRole('button', { name: 'Leave the campaign…' }).click();
  await page.getByRole('dialog', { name: 'Leave The Hel Fenn Campaign?' }).getByRole('button', { name: 'Leave the campaign' }).click();
  await expect(page.getByText('The warband has left the campaign.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove the warband' })).toBeVisible();
});

test('a new warband for the campaign: free under Warbands, its copy entered and opened', async ({ page }) => {
  const srv = await playServer(page);
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: others.slice(0, 1) });
  await page.goto(`campaign/${c.id}`);
  await page.getByRole('button', { name: 'Enter a warband' }).click();
  const sheet = page.getByRole('dialog', { name: 'Enter a warband' });
  await expect(sheet).toContainText('None of your warbands is free yet');
  await tapTargets(page);
  await shot(page, 'campaign-enter-none');
  await sheet.getByRole('button', { name: 'New warband for this campaign' }).click();
  await expect(page.getByText('For The Hel Fenn Campaign:', { exact: false })).toBeVisible();
  await page.getByRole('combobox', { name: 'Warband' }).selectOption('merc');
  await page.getByRole('combobox', { name: 'City' }).selectOption('midd');
  await page.getByLabel('Name').fill('The Ardent Caravan');
  await noSideScroll(page);
  await shot(page, 'campaign-new-warband');
  await page.getByRole('button', { name: 'Start the warband' }).click();
  await expect(page.getByRole('link', { name: 'In The Hel Fenn Campaign' })).toBeVisible();
  await page.goto('warbands');
  await expect(page.getByRole('link', { name: /The Ardent Caravan/ })).toHaveCount(2);
  await expect(page.getByRole('link', { name: /in The Hel Fenn Campaign/ })).toHaveCount(1);
  await shot(page, 'campaign-new-warband-list');
});

test('starting a campaign, with the authenticator', async ({ page }) => {
  await playServer(page, true, { totp: true });
  await page.goto('campaign');
  await expect(page.getByText('You are not part of a campaign yet', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Start a campaign' }).click();
  await page.getByLabel('Name of the campaign').fill('The Hel Fenn Campaign');
  await shot(page, 'campaign-start');
  await page.getByRole('button', { name: 'Start it' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'The Hel Fenn Campaign' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Manage' })).toHaveAttribute('aria-current', 'page');
  await noSideScroll(page);
  await tapTargets(page);
});

test('on a desktop the warbands and the members stand side by side', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const srv = await playServer(page);
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others });
  await page.goto(`campaign/${c.id}`);
  const warbands = page.getByRole('heading', { name: 'Warbands' });
  const members = page.getByRole('heading', { name: 'Members' });
  await expect(warbands).toBeVisible();
  const [a, b] = [await warbands.boundingBox(), await members.boundingBox()];
  expect(Math.abs(a!.y - b!.y)).toBeLessThan(4);
  expect(b!.x).toBeGreaterThan(a!.x + 200);
  await shot(page, 'campaign-desktop');
});
