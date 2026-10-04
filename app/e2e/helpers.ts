/* What every spec of the app checks (docs/ui.md checklist). */
import { expect, test, type Page } from '@playwright/test';

export async function shot(page: Page, name: string) {
  await page.screenshot({ path: `test-results/screens/${test.info().project.name}-${name}.png`, fullPage: true });
}

/* docs/ui.md checklist: usable at 360 px without horizontal scrolling. */
export async function noSideScroll(page: Page) {
  const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(scroll, 'the page scrolls sideways').toBeLessThanOrEqual(client);
}

/* …and touch targets of at least 44 px – except a word in running text that
   opens its rules in a bubble (docs/ui.md §5). */
export async function tapTargets(page: Page) {
  const small = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('a, button:not([data-tip]), summary, label:has(input[type=radio]), input[type=file]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || getComputedStyle(el).visibility === 'hidden') continue;
      if (r.height < 44 || r.width < 44) out.push(`${el.tagName} "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return out;
  });
  expect(small, 'touch targets under 44 px').toEqual([]);
}

export async function useTheme(page: Page, theme: string) {
  await page.addInitScript((t) => { localStorage.setItem('mordheim-theme', t); }, theme);
}
