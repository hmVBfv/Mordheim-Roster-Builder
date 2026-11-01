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

test('on a desktop the side navigation scrolls by itself when it is taller than the window (report of 1.11.2026)', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 643 });
  await page.goto('#/home');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav).toBeVisible();
  // many entries under it, as a person with many warbands has
  await nav.evaluate((el) => {
    const ul = el.querySelector('ul')!;
    for (let i = 0; i < 40; i++) { const li = document.createElement('li'); li.textContent = `A long list of warbands ${i}`; li.style.minHeight = '44px'; ul.append(li); }
  });
  const box = await nav.evaluate((el) => ({ h: el.getBoundingClientRect().height, scroll: el.scrollHeight, client: el.clientHeight, overflow: getComputedStyle(el).overflowY, win: innerHeight }));
  expect(box.h, 'the bar is not taller than the window').toBeLessThanOrEqual(box.win);
  expect(['auto', 'scroll']).toContain(box.overflow);
  expect(box.scroll, 'what does not fit is reached by scrolling the bar').toBeGreaterThan(box.client);
  // the wheel over the bar moves the bar, not the page
  await nav.hover();
  await page.mouse.wheel(0, 400);
  await expect.poll(() => nav.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test('a sheet one only reads closes with a click beside it, one one writes in does not (wish of 1.11.2026)', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 643 });
  await page.goto('#/home');
  await page.getByRole('button', { name: "What's new" }).first().click();
  const sheet = page.getByRole('dialog', { name: "What's new" });
  await expect(sheet).toBeVisible();
  // inside its box: it stays; on the backdrop, beside it: it goes
  const box = (await sheet.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + 12);
  await expect(sheet).toBeVisible();
  await page.mouse.click(8, 8);
  await expect(sheet).toBeHidden();

  await page.getByRole('button', { name: 'Report a bug' }).click();
  const form = page.getByRole('dialog', { name: 'Report a problem' });
  await expect(form).toBeVisible();
  await page.mouse.click(8, 8);
  await expect(form).toBeVisible();
});
