/* What every spec of the app checks (docs/ui.md checklist). */
import { expect, test, type Locator, type Page } from '@playwright/test';

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
/* Targets a finger can hit: 44 px; with a mouse and no touch 32 px are enough (docs/ui.md §5). */
export async function tapTargets(page: Page) {
  const small = await page.evaluate(() => {
    const min = matchMedia('(pointer: coarse)').matches ? 44 : 32;
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('a, button:not([data-tip]), summary, label:has(input[type=radio]), input[type=file]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || getComputedStyle(el).visibility === 'hidden') continue;
      if (r.height < min || r.width < min) out.push(`${el.tagName} "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return out;
  });
  expect(small, 'targets too small to hit').toEqual([]);
}

export async function useTheme(page: Page, theme: string) {
  await page.addInitScript((t) => { localStorage.setItem('mordheim-theme', t); }, theme);
}

export type Tab = 'Overview' | 'Gear' | 'Skills & injuries' | 'Story & more';

/* A warrior on the roster (docs/ui.md §3): his row is opened – on a phone
   under the row, on a desktop in the pane – and with `tab` the section he is
   asked for (a desktop shows them all). Gives his card. */
export async function unit(page: Page, name: string, tab?: Tab): Promise<Locator> {
  const row = page.getByRole('button', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(,|$)`) });
  const open = (await row.getAttribute('aria-expanded')) === 'true' || (await row.getAttribute('aria-pressed')) === 'true';
  if (!open) await row.click();
  if (tab && (await page.getByRole('tablist', { name: 'Sections' }).count())) await page.getByRole('tab', { name: tab }).click();
  return page.getByRole('article', { name, exact: true });
}
