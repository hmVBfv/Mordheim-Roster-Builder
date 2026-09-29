/* The mockups in docs/mockups/ (served from the repository root, like the
   legacy app): at 360 px nothing scrolls sideways, and every control does
   something. Rob tried them on his phone and found buttons that did nothing
   (29.09.2026) – a mockup that looks finished but does not react hides what
   is still missing. So every control is clicked from a fresh page, and every
   control inside every sheet one of them opens; a click must change the page
   (text, classes, pressed/hidden/open/disabled state, URL, history or an open
   sheet). A control the mockup does not draw says so with a notice
   (`data-soon`). Controls that are already chosen (aria-pressed="true",
   aria-current="page") or disabled are skipped, as is the strip at the top
   that only belongs to the mockups. */
import { expect, test, type Locator, type Page } from '@playwright/test';

// a '#…' opens a page on another tab, so its controls are clicked too
const PAGES = ['index', 'roster', 'game-night', 'timeline', 'changes', 'visibility', 'background'];
const CONTROLS = 'button:visible, a:visible, input[type=checkbox]:visible, summary:visible';
const IN_SHEET = 'button:visible, a:visible, input[type=checkbox]:visible';

test.beforeEach(async ({ context }) => {
  // the mockups load their fonts from Google; not needed for the check
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
});

let fresh = 0;
/* A query string, so going to the same page really loads it anew. */
const go = (page: Page, name: string) => {
  const [file, tab] = name.split('#');
  return page.goto(`${file}.html?fresh=${fresh++}${tab ? `#${tab}` : ''}`);
};

/* A fingerprint of everything a click could change. */
const state = (page: Page) =>
  page.evaluate(() => {
    let h = 7;
    for (const e of document.querySelectorAll<HTMLElement>('*')) {
      const f = e as HTMLElement & { open?: boolean; value?: string; checked?: boolean; disabled?: boolean };
      const s = `${e.className}|${e.getAttribute('aria-pressed') ?? ''}${e.hidden ? 'h' : ''}${f.open ? 'o' : ''}${f.value ?? ''}${f.checked ? 'c' : ''}${f.disabled ? 'd' : ''}`;
      for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 1e9;
    }
    for (const c of document.body.innerText) h = (h * 33 + c.charCodeAt(0)) % 1e9;
    return `${h}|${location.href}|${history.length}|${!!document.querySelector('dialog[open]')}`;
  });

const skipped = (el: Locator) =>
  el.evaluate(
    (e) =>
      !!e.closest('.mock') ||
      e.getAttribute('aria-pressed') === 'true' ||
      e.getAttribute('aria-current') === 'page' ||
      (e as HTMLButtonElement).disabled === true,
  );

const labelOf = async (el: Locator) =>
  ((await el.getAttribute('aria-label')) || (await el.innerText().catch(() => '')) || '').trim().replace(/\s+/g, ' ').slice(0, 40);

/* Clicks the control and says whether anything changed. */
async function reacts(page: Page, el: Locator) {
  const before = await state(page);
  try {
    await el.click({ timeout: 2000 });
  } catch {
    return false;
  }
  await page.waitForTimeout(100);
  return before !== (await state(page));
}

for (const name of PAGES) {
  test(`mockup ${name}: fits 360 px, every control reacts`, async ({ page }) => {
    test.setTimeout(240_000);
    await go(page, name);
    for (const theme of ['chronicle', 'parchment']) {
      await page.locator(`.mock [data-theme="${theme}"]`).click();
      const wide = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(wide, `${name} in ${theme} scrolls sideways`).toBeLessThanOrEqual(360);
      await page.screenshot({ path: `test-results/screens/mockup-${name.replace('#', '-')}-${theme}.png`, fullPage: true });
    }
    await page.locator('.mock [data-theme="chronicle"]').click();

    const dead: string[] = [];
    const openers = new Map<string, number>();
    const count = await page.locator(CONTROLS).count();
    for (let i = 0; i < count; i++) {
      await go(page, name);
      const el = page.locator(CONTROLS).nth(i);
      if (await skipped(el)) continue;
      const label = await labelOf(el);
      if (!(await reacts(page, el))) dead.push(label);
      const sheet = await page.evaluate(() => document.querySelector('dialog[open]')?.id ?? null);
      if (sheet && page.url().includes(`${name.split('#')[0]}.html`) && !openers.has(sheet)) openers.set(sheet, i);
    }
    for (const [sheet, i] of openers) {
      await go(page, name);
      await page.locator(CONTROLS).nth(i).click();
      const inside = await page.locator(`#${sheet}`).locator(IN_SHEET).count();
      for (let j = 0; j < inside; j++) {
        await go(page, name);
        await page.locator(CONTROLS).nth(i).click();
        const el = page.locator(`#${sheet}`).locator(IN_SHEET).nth(j);
        if (await skipped(el)) continue;
        const label = await labelOf(el);
        if (!(await reacts(page, el))) dead.push(`[${sheet}] ${label}`);
      }
    }
    expect(dead, `controls on ${name} that do nothing`).toEqual([]);
  });
}
