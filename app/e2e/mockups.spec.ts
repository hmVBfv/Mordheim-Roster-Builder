/* The mockups in docs/mockups/ (served from the repository root, like the
   legacy app): at 360 px nothing scrolls sideways, every control does
   something, and every screen can be left. Rob tried them on his phone and
   found buttons that did nothing, tabs that led nowhere and a menu without a
   way back (29.09.2026) – a mockup that looks finished but does not react
   hides what is still missing.

   So every control is clicked from a fresh page, every control inside every
   sheet one of them opens, and every control inside a sheet opened from a
   sheet. A click must change the page (text, classes, pressed/hidden/open/
   disabled state, URL, history or an open sheet); a link must not point to
   "#" and must lead to a page that exists. Controls that are already chosen
   (aria-pressed="true", aria-current="page") or disabled are skipped, as is
   the strip at the top that only belongs to the mockups. */
import { expect, test, type Locator, type Page } from '@playwright/test';

// a '#…' opens a page on another tab, so its controls are clicked too
const SCREENS = ['home', 'warbands', 'roster', 'story', 'changes', 'trading-post', 'trading-post#search', 'trading-post#sell', 'trading-post#give', 'hire', 'chronicle',
  'campaign', 'visibility', 'timeline', 'world', 'background', 'manage', 'game-night', 'more', 'desktop'];
const PAGES = ['index', ...SCREENS];
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
const pathOf = (url: string) => new URL(url).pathname;

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

/* Clicks the control; '' if it did something, else what is wrong. */
async function verdict(page: Page, el: Locator): Promise<string> {
  const href = await el.evaluate((e) => (e.tagName === 'A' ? e.getAttribute('href') ?? '' : null));
  if (href !== null && (href === '' || href === '#')) return 'is a link to nowhere';
  const before = await state(page), path = pathOf(page.url());
  try {
    await el.click({ timeout: 2000 });
  } catch {
    return 'cannot be clicked';
  }
  await page.waitForTimeout(200);
  if (pathOf(page.url()) !== path) {
    await page.waitForLoadState('load');
    return (await page.locator('.mock').count()) ? '' : `leads to a missing page (${pathOf(page.url())})`;
  }
  return before !== (await state(page)) ? '' : 'does nothing';
}

/* The way to a control: on the page, then inside the sheets it opened. */
type Step = { sheet: string | null; i: number };
const scope = (page: Page, sheet: string | null) => (sheet ? page.locator(`#${sheet}`).locator(IN_SHEET) : page.locator(CONTROLS));
async function replay(page: Page, name: string, path: Step[]) {
  await go(page, name);
  for (const s of path) await scope(page, s.sheet).nth(s.i).click();
}
const openSheet = (page: Page) => page.evaluate(() => document.querySelector('dialog[open]')?.id ?? null);
/* A sheet's controls, by label: the same sheet can hold different controls (a Hero's menu, a group's). */
const sheetKey = (page: Page, sheet: string) =>
  page.locator(`#${sheet}`).locator(IN_SHEET).evaluateAll((els) => els.map((e) => (e.getAttribute('data-value') ? '·' : (e.textContent ?? '').trim().slice(0, 24))).join('|'));

/* Clicks every control of a page, then every control in every sheet they
   open, two sheets deep; returns what did nothing. */
async function crawl(page: Page, name: string) {
  const dead: string[] = [];
  const seen = new Set<string>();
  const queue: Step[][] = [[]];
  while (queue.length) {
    const path = queue.shift()!;
    await replay(page, name, path);
    const here = path.length ? await openSheet(page) : null;
    if (path.length && !here) { dead.push(`a sheet did not open again (${JSON.stringify(path)})`); continue; }
    const count = await scope(page, here).count();
    for (let i = 0; i < count; i++) {
      await replay(page, name, path);
      const el = scope(page, here).nth(i);
      if (await skipped(el)) continue;
      const label = await labelOf(el);
      const wrong = await verdict(page, el);
      if (wrong) dead.push(`${here ? `[${here}] ` : ''}${label} ${wrong}`);
      // the desktop never jumps to the phone's pages: they open in a panel
      else if (name.startsWith('desktop') && !pathOf(page.url()).endsWith('/desktop.html')) dead.push(`${label} leaves the desktop for ${pathOf(page.url())}`);
      // a sheet it opened (on the same page): its controls are next, up to two sheets deep
      const opened = pathOf(page.url()).endsWith(`/${name.split('#')[0]}.html`) ? await openSheet(page) : null;
      // a sheet is as narrow as the phone, too (the page's own width does not show it)
      if (opened && opened !== here) {
        const over = await page.evaluate((id) => { const d = document.getElementById(id)!; return d.scrollWidth - d.clientWidth; }, opened);
        if (over > 0) dead.push(`[${opened}] scrolls sideways by ${over} px`);
      }
      if (opened && opened !== here && path.length < 2) {
        const key = `${opened}|${await sheetKey(page, opened)}`;
        if (!seen.has(key)) { seen.add(key); queue.push([...path, { sheet: here, i }]); }
      }
    }
  }
  return dead;
}

async function themesFit(page: Page, name: string, width: number, shot: string) {
  for (const theme of ['chronicle', 'parchment']) {
    await page.locator(`.mock [data-theme="${theme}"]`).click();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(wide, `${name} in ${theme} scrolls sideways at ${width} px`).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/screens/mockup-${shot}-${theme}.png`, fullPage: true });
  }
  await page.locator('.mock [data-theme="chronicle"]').click();
}

for (const name of PAGES) {
  test(`mockup ${name}: fits 360 px, every control reacts`, async ({ page }) => {
    test.setTimeout(600_000);
    await go(page, name);
    await themesFit(page, name, 360, name.replace('#', '-'));
    expect(await crawl(page, name), `controls on ${name} that do nothing`).toEqual([]);
  });
}

/* Rob, 29.09.2026: "Can you show me the desktop mockup too? … several,
   perhaps movable windows … a good overview without clutter." The desktop
   page at a desktop's width: three columns, every control reacts – in each
   of its places (30.09.2026: "natuerlich fehlen noch die weiteren
   Unter-Seiten"), which also fit a phone's width. */
const DESKTOP = ['desktop', 'desktop#home', 'desktop#warbands', 'desktop#campaign', 'desktop#notes', 'desktop#more'];
for (const name of DESKTOP) {
  test(`mockup ${name} at 1440 px: every control reacts`, async ({ page }) => {
    test.setTimeout(600_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await go(page, name);
    await expect(page.locator('.cols.n3')).toBeVisible();
    const shot = name.replace('#', '-');
    await themesFit(page, name, 1440, `${shot}-1440`);
    expect(await crawl(page, name), `controls on ${name} that do nothing`).toEqual([]);
    await page.setViewportSize({ width: 360, height: 740 });
    await go(page, name);
    await themesFit(page, name, 360, `${shot}-360`);
  });
}

test('mockup desktop: a panel is moved by dragging, or by its menu', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await go(page, 'desktop');
  const first = (col: number) => page.locator(`.col[data-col="${col}"] .panel`).first().getAttribute('data-panel');
  expect(await first(0)).toBe('roster');
  await page.locator('#p-ledger .ph h2').dragTo(page.locator('#p-roster .pb'));
  expect(await first(0)).toBe('ledger');
  await expect(page.locator('.views [data-save]')).toBeVisible();
  // without a mouse: the ⋯ menu
  await page.locator('[data-menu="ledger"]').click();
  await page.locator('#sheet-panel [data-pm="right"]').click();
  expect(await first(1)).toBe('ledger');
  // across the full width, then minimised to the dock and back
  await page.locator('[data-menu="warrior"]').click();
  await page.locator('#sheet-panel [data-pm="top"]').click();
  await expect(page.locator('.top #p-warrior')).toBeVisible();
  await page.locator('[data-min="warrior"]').click();
  await expect(page.locator('#p-warrior')).toHaveCount(0);
  await page.locator('.dock [data-restore="warrior"]').click();
  await expect(page.locator('.top #p-warrior')).toBeVisible();
  // the arrangement can be kept as a view
  await page.locator('.views [data-save]').click();
  await expect(page.locator('.views button[aria-pressed="true"]')).toHaveText('My view');
  await page.screenshot({ path: 'test-results/screens/mockup-desktop-moved.png' });
});

/* Rob, 29.09.2026: the twin-tailed comet should strike on some visits. One
   in three by chance; ?impact decides it, and a test never gets it by chance. */
test('mockup home: the comet comes down on some visits', async ({ page }) => {
  await page.goto('home.html?impact=1');
  await expect(page.locator('#sky')).toHaveClass(/impact/);
  for (const q of ['?impact=0', '']) {
    await page.goto(`home.html${q}`);
    await expect(page.locator('#sky')).not.toHaveClass(/impact/);
  }
});

/* Every screen can be left: the bar at the bottom, or ← (game night). */
for (const name of SCREENS) {
  test(`mockup ${name}: there is a way on`, async ({ page }) => {
    await go(page, name);
    const nav = await page.locator('nav.nav a').count();
    const back = await page.locator('a.back[href]:not([href="#"])').count();
    expect(nav === 5 || back > 0, `${name} has neither the bottom bar nor ←`).toBe(true);
  });
}

/* Rob, 29.09.2026: "The ← sometimes does nothing, or only late." Closing a
   sheet steps back in the history; a link followed at that moment used to be
   cancelled by that step. */
test('mockups: ← works right after a sheet was closed', async ({ page }) => {
  await go(page, 'roster');
  await page.getByRole('button', { name: '+ Recruit' }).click();
  await expect(page.locator('#sheet-recruit')).toBeVisible();
  // a fast thumb: Close and ← within the same moment
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('#sheet-recruit [data-close]')!.click();
    document.querySelector<HTMLAnchorElement>('a.back')!.click();
  });
  await expect(page).toHaveURL(/warbands\.html/);
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/warbands\.html/);
});

test('mockups: a link inside a sheet leaves, and Back returns without the sheet', async ({ page }) => {
  await go(page, 'roster');
  await page.getByRole('button', { name: 'Stash · 2 shards' }).click();
  await page.locator('#sheet-stash').getByRole('link', { name: /Give an item/ }).click();
  await expect(page).toHaveURL(/trading-post\.html#give/);
  await page.goBack();
  await expect(page).toHaveURL(/roster\.html/);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.getByRole('link', { name: 'All warbands' }).click();
  await expect(page).toHaveURL(/warbands\.html/);
});

/* Rob's review of the hire and desktop mockups (02.10.2026). */
test('mockup hire: Hire is in reach, and after hiring the list starts at the top', async ({ page }) => {
  await go(page, 'hire');
  await page.locator('#list button').nth(20).click();
  const ok = page.locator('#h-ok');
  await expect(ok).toBeInViewport();
  await ok.click();
  await expect(page.locator('#sheet-hire')).toHaveCount(1);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('#q')).toBeInViewport();
});

test('mockup desktop: no click leads to the phone\'s pages', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await go(page, 'desktop#campaign');
  await page.getByRole('link', { name: 'Open game night' }).click();
  await expect(page).toHaveURL(/desktop\.html/);
  await expect(page.locator('#sheet-page')).toBeVisible();
  await expect(page.locator('#page-frame')).toHaveAttribute('src', /game-night\.html\?embed=1/);
  const frame = page.frameLocator('#page-frame');
  await expect(frame.locator('.mock')).toBeHidden();
  await expect(frame.locator('nav.nav')).toBeHidden();
});

test('mockup desktop: the layout is chosen by hand, on this device', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await go(page, 'desktop#more');
  await expect(page.getByRole('radio', { name: /Desktop/ })).toBeChecked();
  // it leaves the page at once, so a click: check() would wait to see it checked
  await page.getByRole('radio', { name: /Phone/ }).click();
  await expect(page).toHaveURL(/home\.html/);
});

test('mockup roster: equipment, skills, rules and injuries explain themselves', async ({ page }) => {
  await go(page, 'roster');
  const tips = page.locator('.tip:visible');
  expect(await tips.count()).toBeGreaterThan(5);
  await tips.first().click();
  const box = page.locator('#mock-tip');
  await expect(box).toBeVisible();
  expect((await box.innerText()).length).toBeGreaterThan(10);
  await page.screenshot({ path: 'test-results/screens/mockup-roster-tip.png' });
  await page.keyboard.press('Escape');
  await expect(box).toBeHidden();
});

test('mockup timeline: the AI pack holds the battle with what surrounds it', async ({ page }) => {
  await go(page, 'timeline');
  await page.getByRole('button', { name: 'AI pack…' }).click();
  const text = page.locator('#ai-text');
  for (const part of ['Aftermath', 'Canon', 'World', 'Background', 'Style']) await expect(text).toHaveValue(new RegExp(part));
  await page.locator('#sheet-ai [data-part="background"]').uncheck();
  await expect(text).not.toHaveValue(/Background/);
  await page.screenshot({ path: 'test-results/screens/mockup-timeline-ai.png' });
});

test('mockup chronicle: a chapter is imported as a draft, hidden names are flagged', async ({ page }) => {
  await go(page, 'chronicle');
  const before = await page.locator('#chapters > li').count();
  await page.getByRole('button', { name: 'Import a chapter' }).click();
  await page.locator('#imp-text').fill('Die Fährleute warteten am Steg.');
  await expect(page.locator('#imp-checks')).toContainText('Fährleute');
  await page.getByRole('button', { name: 'Add as draft' }).click();
  await expect(page.locator('#chapters > li')).toHaveCount(before + 1);
});

test('mockup warbands: a new warband is started from the list, or from Home', async ({ page }) => {
  await go(page, 'home');
  await page.getByRole('link', { name: 'New warband' }).click();
  await expect(page.locator('#sheet-new')).toBeVisible();
  await page.locator('#new-wb').selectOption('skaven');
  await expect(page.locator('#new-var-f')).toBeHidden();
  await page.locator('#new-name').fill('Clan Gnaw');
  await page.getByRole('button', { name: 'Start the warband' }).click();
  await expect(page.locator('#mine')).toContainText('Clan Gnaw');
  await expect(page.locator('#mine')).toContainText('Skaven');
});
