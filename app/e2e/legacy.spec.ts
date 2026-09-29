/* The legacy Roster Builder, which the group plays with until phase 3, with
   the group's own warbands at phone width: nothing wider than the screen, a
   notice never swallows a tap, and what the button audit found stays fixed. */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const SAVES = ['silver-caravan', 'rangvalds-reaver', 'example-grey-penitents'];
const save = (f: string) => readFileSync(new URL(`../../core/test/saves/${f}.json`, import.meta.url), 'utf8');

test.beforeEach(async ({ page }) => {
  // the page must work without the web fonts
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
});

for (const f of SAVES) {
  test(`${f}: no sideways scrolling at 360 px, every panel open`, async ({ page }) => {
    await page.goto('index.html');
    await page.waitForFunction(() => typeof (window as unknown as { applyState?: unknown }).applyState === 'function');
    await page.evaluate((s) => {
      const w = window as unknown as { applyState: (d: unknown) => void; render: () => void };
      w.applyState(JSON.parse(s)); w.render();
      document.querySelectorAll('details').forEach((d) => { d.open = true; });
    }, save(f));
    const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(scroll, 'the page scrolls sideways').toBeLessThanOrEqual(client);
    await page.screenshot({ path: `test-results/screens/legacy-${f}.png` });
  });
}

type W = { applyState: (d: unknown) => void; render: () => void };
async function load(page: import('@playwright/test').Page, f: string) {
  await page.goto('index.html');
  await page.waitForFunction(() => typeof (window as unknown as { applyState?: unknown }).applyState === 'function');
  await page.evaluate((s) => { const w = window as unknown as W; w.applyState(JSON.parse(s)); w.render(); }, save(f));
}
const sideScroll = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/* Found by the button audit (29.09.2026). */
test('an open campaign file does not widen the page at 360 px', async ({ page }) => {
  await load(page, 'example-grey-penitents');
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  await page.locator('input[type=file][onchange="cfPickFile(event)"]').first()
    .setInputFiles(new URL('../../core/test/saves/example-campaign.json', import.meta.url).pathname);
  await expect(page.locator('table.cf-tbl').first()).toBeVisible();
  expect(await sideScroll(page)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'test-results/screens/legacy-campaign-file.png' });
});

test('a henchman name field is wide enough to read at 360 px', async ({ page }) => {
  await load(page, 'silver-caravan');
  await page.evaluate(() => document.querySelectorAll('details.mem-wrap').forEach((d) => { (d as HTMLDetailsElement).open = true; }));
  const w = await page.locator('input.mem-in').first().evaluate((el) => el.getBoundingClientRect().width);
  expect(w).toBeGreaterThan(200);
});

test('on a desktop the sidebar fits the window, so the Stash can be reached', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await load(page, 'silver-caravan');
  const sb = await page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().height);
  expect(sb).toBeLessThanOrEqual(900);
  const add = page.getByRole('button', { name: '+ to stash' });
  await add.scrollIntoViewIfNeeded();
  await expect(add).toBeInViewport();
});

test('a rule chip opens and closes on tap, like the ⓘ icons', async ({ page }) => {
  await load(page, 'rangvalds-reaver');
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  const chip = page.locator('span.kwchip[onmouseenter^="showItipHTML"]').first();
  await chip.scrollIntoViewIfNeeded();
  const tip = page.locator('#itip');
  await chip.tap();
  await expect(tip).toBeVisible();
  await chip.tap();
  await expect(tip).toBeHidden();
  await chip.tap();
  await expect(tip).toBeVisible();
});

test('the extra-equipment panel of a Hired Sword opens without an error and stays open', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page, 'silver-caravan');
  await page.evaluate(() => {
    const w = window as unknown as { setHouseBool: (k: string, v: boolean) => void; hireHS: (k: string) => void };
    w.setHouseBool('hsEquip', true);
    w.hireHS('ogre');
    document.querySelectorAll('details').forEach((d) => { if (!d.classList.contains('eq-det')) d.open = true; });
  });
  const panel = page.locator('details.eq-det').first();
  await panel.locator('summary').click();
  await expect(panel).toHaveAttribute('open', '');
  await page.evaluate(() => (window as unknown as W).render());
  await expect(page.locator('details.eq-det').first()).toHaveAttribute('open', '');
  expect(errors).toEqual([]);
});

/* The post-battle helper (Rob, 29.09.2026). */
test('the post-battle helper opens from the top bar, fits a phone and Back closes it', async ({ page }) => {
  await load(page, 'rangvalds-reaver');
  const url = page.url();
  await page.getByRole('button', { name: '⚔ Post-battle' }).click();
  const modal = page.locator('#pbmodal');
  await expect(modal).toBeVisible();
  await page.evaluate(() => document.querySelectorAll('#pbmodal details').forEach((d) => { (d as HTMLDetailsElement).open = true; }));
  expect(await modal.locator('details.pbh-step').count()).toBe(10);
  const wide = await modal.evaluate((m) => [...m.querySelectorAll('table')].filter((tb) => tb.getBoundingClientRect().right > window.innerWidth + 1).length);
  expect(wide, 'tables wider than the screen').toBe(0);
  expect(await sideScroll(page)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'test-results/screens/legacy-post-battle.png' });
  await page.locator('#pbh-exploration').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/screens/legacy-post-battle-exploration.png' });
  await page.goBack();
  await expect(modal).toBeHidden();
  expect(page.url()).toBe(url);
  await expect(page.locator('#builder-view')).toBeVisible();
});

test('closing a dialog by its button leaves no dead step for Back', async ({ page }) => {
  await load(page, 'rangvalds-reaver');
  await page.getByRole('button', { name: 'Export ▾' }).click();
  await expect(page.locator('#exportmodal')).toBeVisible();
  await page.locator('#exportmodal').getByRole('button', { name: '✕ close' }).click();
  await expect(page.locator('#exportmodal')).toBeHidden();
  // the dialog's history entry is gone again
  await page.waitForFunction(() => !(history.state as { mhModal?: string } | null)?.mhModal);
});

test('a notice lets taps through', async ({ page }) => {
  await page.goto('index.html');
  await page.waitForFunction(() => typeof (window as unknown as { flash?: unknown }).flash === 'function');
  const through = await page.evaluate(() => {
    (window as unknown as { flash: (m: string) => void }).flash('Saved.');
    const el = [...document.body.children].at(-1) as HTMLElement;
    const r = el.getBoundingClientRect();
    return !el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  });
  expect(through).toBe(true);
});
