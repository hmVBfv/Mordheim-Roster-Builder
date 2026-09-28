/* The built app on a phone-sized screen. */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const SAVE = readFileSync(new URL('./fixtures/silver-caravan.json', import.meta.url), 'utf8');
const THEMES = ['chronicle', 'parchment'] as const;

/* No errors in the console, Content Security Policy violations included. */
let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|net::ERR_/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
});
test.afterEach(() => { expect(errors, 'console errors').toEqual([]); });

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `test-results/screens/${test.info().project.name}-${name}.png`, fullPage: true });
}

/* docs/ui.md checklist: usable at 360 px without horizontal scrolling. */
async function noSideScroll(page: Page) {
  const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(scroll, 'the page scrolls sideways').toBeLessThanOrEqual(client);
}

/* …and touch targets of at least 44 px. */
async function tapTargets(page: Page) {
  const small = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('a, button, summary, label:has(input[type=radio]), input[type=file]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || getComputedStyle(el).visibility === 'hidden') continue;
      if (r.height < 44 || r.width < 44) out.push(`${el.tagName} "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return out;
  });
  expect(small, 'touch targets under 44 px').toEqual([]);
}

async function useTheme(page: Page, theme: string) {
  await page.addInitScript((t) => { localStorage.setItem('mordheim-theme', t); }, theme);
}

async function importSample(page: Page) {
  await page.getByRole('button', { name: 'Import a warband' }).first().click();
  await page.getByRole('textbox').fill(SAVE);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'The Silver Caravan' })).toBeVisible();
}

for (const theme of THEMES) {
  test(`home, roster and settings in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.getByRole('heading', { name: 'Your warbands' })).toBeVisible();
    await expect(page.getByTitle('Saved on this device')).toBeVisible();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-home`);

    await importSample(page);
    await expect(page.getByRole('article')).toHaveCount(7);
    await expect(page.getByRole('heading', { name: 'Ulrich the Grey' })).toBeVisible();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-roster`);

    await page.getByRole('link', { name: 'More' }).click();
    await expect(page.getByRole('radio', { name: /Parchment/ })).toBeVisible();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-more`);
  });
}

/* Back closes a sheet instead of leaving the app (Rob, 28.09.2026). */
test('Back closes the import sheet and stays on the screen', async ({ page }) => {
  await page.goto('./');
  const home = page.url();
  await page.getByRole('link', { name: 'Warbands' }).click();
  const here = page.url();
  await page.getByRole('button', { name: 'Import a warband' }).first().click();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await page.goBack();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(page.url()).toBe(here);
  // Cancel leaves no step behind: one Back returns to Home
  await page.getByRole('button', { name: 'Import a warband' }).first().click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.waitForFunction(() => !(history.state as { mordheimSheet?: boolean } | null)?.mordheimSheet);
  await page.goBack();
  await expect(page).toHaveURL(home);
  await expect(page.getByRole('heading', { name: 'Your warbands' })).toBeVisible();
});

test('after an import, Back returns to where the import began, not to the sheet', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Warbands' }).click();
  const list = page.url();
  await importSample(page);
  await page.goBack();
  expect(page.url()).toBe(list);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('the navigation fits the flavour', async ({ page }) => {
  await page.goto('./');
  const labels = await page.getByRole('navigation', { name: 'Main' }).getByRole('link').allTextContents();
  expect(labels).toEqual(test.info().project.name === 'quickbuild' ? ['Home', 'Warbands', 'More'] : ['Home', 'Warbands', 'Campaign', 'Notes', 'More']);
  await expect(page).toHaveTitle(test.info().project.name === 'quickbuild' ? 'Mordheim Quick Build' : 'Mordheim Campaign');
});

test('installable: the manifest and its icons', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  const manifest = await (await request.get(new URL(href ?? '', page.url()).href)).json() as { name: string; display: string; icons: { src: string; sizes: string; purpose?: string }[] };
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  for (const i of manifest.icons) expect((await request.get(new URL(i.src, page.url()).href)).ok()).toBe(true);
});

test('starts offline once it has been opened', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await importSample(page);
  const roster = page.url();
  await context.setOffline(true);
  await page.goto(roster);
  await expect(page.getByRole('heading', { level: 1, name: 'The Silver Caravan' })).toBeVisible();
  await expect(page.getByTitle('Saved on this device')).toContainText('Offline');
  await context.setOffline(false);
});

/* docs/ui.md "Leistungsgrenzen", on a throttled phone. */
test.describe('start-up budgets', () => {
  async function throttle(page: Page) {
    const cdp = await page.context().newCDPSession(page);
    // a slow 4G line and a mid-range phone (4× slower CPU)
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  const ready = (page: Page) => expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

  test('first start online in under 3 s', async ({ page }) => {
    await throttle(page);
    const t0 = Date.now();
    await page.goto('./');
    await ready(page);
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  test('start from the cache in under 1 s, a reaction in under 100 ms', async ({ page }) => {
    await page.goto('./');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await throttle(page);
    const t0 = Date.now();
    await page.reload();
    await ready(page);
    expect(Date.now() - t0).toBeLessThan(1000);
    await page.getByRole('link', { name: 'More' }).click();
    const ms = await page.evaluate(async () => {
      const radio = document.querySelector<HTMLInputElement>('input[value=parchment]')!;
      const t = performance.now();
      radio.click();
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      return performance.now() - t;
    });
    expect(ms).toBeLessThan(100);
  });
});
