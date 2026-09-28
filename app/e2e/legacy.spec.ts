/* The legacy Roster Builder, which the group plays with until phase 3, with
   the group's own warbands at phone width: nothing wider than the screen, and
   a notice never swallows a tap. */
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
