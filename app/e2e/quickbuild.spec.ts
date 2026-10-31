/* What only the Quick Build has (Quick Build project only, playwright.config.ts):
   the campaign server's address and "Send to campaign server". */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { decodeSave } from '../src/share/link.ts';
import { noSideScroll, shot, tapTargets } from './helpers.ts';

const SAVE = readFileSync(new URL('./fixtures/silver-caravan.json', import.meta.url), 'utf8');

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
});
test.afterEach(() => { expect(errors, 'console errors').toEqual([]); });

test('send to the campaign server: the address once in Settings, then a link that carries the warband', async ({ page }) => {
  await page.goto('#/warbands');
  await page.getByRole('button', { name: 'Import a warband' }).first().click();
  await page.getByRole('textbox').fill(SAVE);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'The Silver Caravan' })).toBeVisible();
  const roster = page.url();
  await page.getByRole('link', { name: 'Export', exact: true }).click();
  await expect(page.getByText('enter its address under Settings → Campaign server', { exact: false })).toBeVisible();

  await page.goto('#/settings');
  await page.getByLabel('Campaign server').fill('mordheim.example.org/');
  await page.getByRole('button', { name: 'Save the address' }).click();
  await expect(page.getByText('Export → “Send to campaign server” opens https://mordheim.example.org.')).toBeVisible();
  await tapTargets(page);
  await shot(page, 'more-campaign-server');

  await page.goto(roster.replace(/#\/warbands\/([^/]+).*/, '#/warbands/$1/export'));
  const send = page.getByRole('link', { name: 'Send to campaign server' });
  await expect(send).toHaveAttribute('href', /^https:\/\/mordheim\.example\.org\/import#v1\./);
  const href = (await send.getAttribute('href'))!;
  const save = await decodeSave(href.slice(href.indexOf('#'))) as { name: string; wb: string };
  expect(save).toMatchObject({ name: 'The Silver Caravan', wb: 'merc' });
  await noSideScroll(page);
  await shot(page, 'export-send-to-server');
});

test('the rules: from Settings, a chapter at 360 px, and a search that finds hiding by hide', async ({ page }) => {
  await page.goto('#/settings');
  await page.getByRole('link', { name: 'Rules', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Characteristics' })).toBeVisible();
  await page.getByRole('link', { name: 'Shooting', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Shooting' })).toBeVisible();
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'rules-chapter');

  await page.getByRole('searchbox', { name: 'Search the rules' }).fill('hide');
  const results = page.getByRole('region', { name: 'Search results' });
  await expect(results.locator('mark').first()).toBeVisible();
  await noSideScroll(page);
  await shot(page, 'rules-search');
});

test('the banner holds still when the window is not in focus, and moves again when it is', async ({ page }) => {
  await page.goto('#/home');
  const lights = page.locator('svg [class*="_flicker_"]').first();
  await expect(lights).toBeAttached();
  const state = () => lights.evaluate((el) => getComputedStyle(el).animationPlayState);
  expect(await state()).toBe('running');
  await page.evaluate(() => { document.hasFocus = () => false; window.dispatchEvent(new Event('blur')); });
  expect(await state()).toBe('paused');
  await page.evaluate(() => { document.hasFocus = () => true; window.dispatchEvent(new Event('focus')); });
  expect(await state()).toBe('running');
});
