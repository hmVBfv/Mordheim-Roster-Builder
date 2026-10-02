/* The built app on a phone-sized screen. */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const SAVE = readFileSync(new URL('./fixtures/silver-caravan.json', import.meta.url), 'utf8');
/* the same warband after its first battle: trading has begun (V4–V7) */
const FOUGHT = JSON.stringify({ ...JSON.parse(SAVE) as Record<string, unknown>, campaign: { ...(JSON.parse(SAVE) as { campaign: object }).campaign, round: 1 } });
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

/* …and touch targets of at least 44 px – except a word in running text that
   opens its rules in a bubble (docs/ui.md §5). */
async function tapTargets(page: Page) {
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

async function useTheme(page: Page, theme: string) {
  await page.addInitScript((t) => { localStorage.setItem('mordheim-theme', t); }, theme);
}

async function importText(page: Page, text: string, heading = 'The Silver Caravan') {
  await page.getByRole('button', { name: 'Import a warband' }).first().click();
  await page.getByRole('textbox').fill(text);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
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
    // experience as the framed steps of the track, not a bare number (Rob, 29.09.2026)
    await expect(page.getByRole('list', { name: 'Experience steps' }).first().getByRole('listitem')).toHaveCount(21);
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-roster`);

    await page.getByRole('link', { name: 'More' }).click();
    await expect(page.getByRole('radio', { name: /Parchment/ })).toBeVisible();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-more`);
  });
}

/* Phase 3a: a warband built from nothing, in both themes. Every sheet is
   checked open (width, touch targets) and photographed. */
for (const theme of THEMES) {
  test(`a new warband, recruited and named, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.goto('./');
    await page.getByRole('link', { name: 'Warbands' }).click();
    await page.getByRole('link', { name: 'New warband' }).click();
    await page.getByRole('combobox', { name: 'Warband' }).selectOption('merc');
    await page.getByRole('combobox', { name: 'City' }).selectOption('midd');
    await page.getByRole('textbox', { name: 'Name' }).fill('The Grey Company');
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-new-warband`);
    await page.getByRole('button', { name: 'Start the warband' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'The Grey Company' })).toBeVisible();
    await expect(page.getByText('No warriors yet')).toBeVisible();

    // recruit: the list, grouped, with prices; the leader only once
    await page.getByRole('button', { name: '+ Recruit' }).click();
    const sheet = page.locator('dialog[open]');
    await expect(sheet.getByRole('heading', { name: 'Recruit' })).toBeVisible();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-recruit`);
    await sheet.getByRole('button', { name: /^Mercenary Captain/ }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page.getByRole('article', { name: 'Mercenary Captain' })).toBeVisible();
    await expect(page.getByText('Recruited Mercenary Captain')).toBeVisible();
    await page.getByRole('button', { name: '+ Recruit' }).click();
    await expect(sheet.getByRole('button', { name: /^Mercenary Captain/ })).toBeDisabled();
    await sheet.getByRole('button', { name: /^Warrior/ }).click();
    const group = page.getByRole('article', { name: 'Warrior' });
    await group.getByRole('button', { name: /\+ Man/ }).click();
    await sheet.getByRole('button', { name: 'One man more' }).click();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-more-men`);
    await sheet.getByRole('button', { name: 'Recruit' }).click();
    await expect(group.getByRole('list', { name: 'Men of Warrior' }).getByRole('listitem')).toHaveCount(3);

    // name one man, then let another go
    await group.getByRole('button', { name: 'Warrior 2: name or dismiss' }).click();
    await page.locator('dialog[open]').getByRole('textbox').fill('Bruno');
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-name-a-man`);
    await page.locator('dialog[open]').getByRole('button', { name: 'Save' }).click();
    await expect(group.getByRole('button', { name: 'Bruno: name or dismiss' })).toBeVisible();
    await group.getByRole('button', { name: 'Warrior 3: name or dismiss' }).click();
    await page.locator('dialog[open]').getByRole('button', { name: 'Dismiss him' }).click();
    await expect(group.getByRole('list', { name: 'Men of Warrior' }).getByRole('listitem')).toHaveCount(2);
    await expect(group.getByRole('button', { name: 'Bruno: name or dismiss' })).toBeVisible();

    // experience one step at a time
    const captain = page.getByRole('article', { name: 'Mercenary Captain' });
    await captain.getByRole('button', { name: /One experience more/ }).click();
    await expect(captain.getByText('Exp 21')).toBeVisible();

    // ⋯: the menu of a warrior, and a name for the Captain
    await captain.getByRole('button', { name: 'More for Mercenary Captain', exact: true }).click();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-warrior-menu`);
    await page.locator('dialog[open]').getByRole('button', { name: /^Name/ }).click();
    await page.locator('dialog[open]').getByRole('textbox').fill('Ulrich the Grey');
    await page.locator('dialog[open]').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('article', { name: 'Ulrich the Grey' })).toBeVisible();

    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-roster-edited`);

    // everything is on the device: a reload shows the same
    await page.reload();
    await expect(page.getByRole('article', { name: 'Ulrich the Grey' })).toContainText('Exp 21');
    await expect(page.getByRole('article', { name: 'Warrior' }).getByRole('button', { name: 'Bruno: name or dismiss' })).toBeVisible();
  });
}

/* Phase 3b: equipment while the warband is founded, from the warrior's list. */
for (const theme of THEMES) {
  test(`equipment from the list before the first battle, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.goto('./');
    await importSample(page);
    const gold = async () => Number((await page.locator('dt:text-is("Gold") + dd').textContent())!.replace(/\D/g, ''));
    const before = await gold();
    await page.getByRole('button', { name: 'More for Magda', exact: true }).click();
    await page.locator('dialog[open]').getByRole('button', { name: /Equipment & rare items/ }).click();
    const sheet = page.locator('dialog[open]');
    await expect(sheet.getByRole('heading', { name: 'Equipment · Magda' })).toBeVisible();
    await sheet.getByRole('button', { name: 'One Sword more' }).click();
    await expect(sheet.getByRole('button', { name: 'One Sword less' })).toBeEnabled();
    await sheet.getByRole('combobox', { name: 'Rare item to add' }).selectOption({ index: 1 });
    await sheet.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(sheet.getByRole('region', { name: 'Rare and trading-post items' }).getByRole('listitem')).toHaveCount(1);
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-equipment`);
    await sheet.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page.getByRole('article', { name: 'Magda' })).toContainText('Sword');
    await expect.poll(gold).toBeLessThan(before - 9);
    // the Trading Post says what applies before the first battle
    await page.getByRole('link', { name: /^Trading Post/ }).click();
    await expect(page.getByText('Until its first battle the warband buys from its lists')).toBeVisible();
  });
}

/* Phase 3b: the Trading Post after the first battle, every tab and sheet. */
for (const theme of THEMES) {
  test(`the Trading Post after the first battle, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.goto('./');
    await importText(page, FOUGHT);
    await page.getByRole('link', { name: /^Trading Post/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Trading Post' })).toBeVisible();
    const gold = async () => Number((await page.locator('dt:text-is("Gold in hand") + dd').textContent())!.replace(/\D/g, ''));
    const start = await gold();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-trade-buy`);

    // buy a helmet for Magda
    await page.getByRole('button', { name: /^Helmet/ }).click();
    const sheet = page.locator('dialog[open]');
    await sheet.getByRole('button', { name: /^Magda/ }).click();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-trade-buy-sheet`);
    await sheet.getByRole('button', { name: /^Buy · 10 gc/ }).click();
    await expect(page.locator('[role=status]', { hasText: 'Bought Helmet' })).toBeVisible();
    await expect.poll(gold).toBe(start - 10);

    // give Ulrich's sword to the stash: no gold moves
    await page.getByRole('button', { name: 'Give', exact: true }).click();
    await page.getByRole('button', { name: 'Give Sword of Ulrich the Grey' }).click();
    await sheet.getByRole('button', { name: /^Stash/ }).click();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-trade-give`);
    await sheet.getByRole('button', { name: 'Give', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Stash' }).getByText('Sword')).toBeVisible();
    await expect.poll(gold).toBe(start - 10);

    // sell it from the stash at half price
    await page.getByRole('button', { name: 'Sell', exact: true }).click();
    await page.getByRole('button', { name: 'Sell Sword of Stash' }).click();
    await expect(sheet.getByRole('textbox', { name: 'Gold received' })).toHaveValue('5');
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-trade-sell`);
    await sheet.getByRole('button', { name: 'Sell · 5 gc' }).click();
    await expect.poll(gold).toBe(start - 5);

    // Ulrich searches; a 12 finds anything
    await page.getByRole('button', { name: 'Search rare' }).click();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-trade-search`);
    await page.getByRole('listitem').filter({ hasText: 'Ulrich the Grey' }).getByRole('button', { name: 'Search' }).click();
    await sheet.getByRole('group', { name: 'Rare items' }).getByRole('button').first().click();
    await sheet.getByRole('textbox', { name: '2D6 as rolled' }).fill('12');
    await expect(sheet.getByText('12 — found.')).toBeVisible();
    await sheet.getByRole('textbox', { name: /^Price/ }).fill('20');
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-trade-search-sheet`);
    await sheet.getByRole('button', { name: 'Buy · 20 gc' }).click();
    await expect(page.locator('[role=status]', { hasText: /^Found / })).toBeVisible();
    await expect.poll(gold).toBe(start - 25);
    await expect(page.getByRole('listitem').filter({ hasText: 'Ulrich the Grey' }).getByRole('button', { name: 'Search' })).toBeDisabled();

    // the ledger says why, each time
    const ledger = page.getByRole('list', { name: 'Ledger' });
    await expect(ledger.getByRole('listitem')).toHaveCount(4);
    await expect(ledger).toContainText('Bought Helmet');
    await expect(ledger).toContainText('Sold Sword');
    await expect(ledger).toContainText('Ulrich the Grey found');
    await shot(page, `${theme}-trade-ledger`);

    // after a reload, the same
    await page.reload();
    await expect.poll(gold).toBe(start - 25);
  });
}

/* Phase 3c: mutations (and Blessings of Nurgle) and the Mark of Chaos. */
for (const theme of THEMES) {
  test(`mutations, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.goto('./');
    const sheet = page.locator('dialog[open]');
    await importText(page, JSON.stringify({ wb: 'possessed', name: 'The Fallen Choir', models: [{ uid: 1, uid_def: 'mag' }, { uid: 2, uid_def: 'mut', name: 'Grell' }] }), 'The Fallen Choir');
    await expect(page.getByRole('list', { name: 'Warnings' })).toContainText('Mutant needs at least 1 mutation');
    await page.getByRole('button', { name: 'More for Grell', exact: true }).click();
    await sheet.getByRole('button', { name: 'Mutations' }).click();
    await sheet.getByRole('button', { name: 'One Great Claw more' }).click();
    await sheet.getByRole('button', { name: 'One Cloven Hooves more' }).click();
    await expect(sheet).toContainText('Together: 130 gc');
    // the UFAQ allows the same mutation again: a second claw, and both arms are taken
    await sheet.getByRole('button', { name: 'One Great Claw more' }).click();
    await expect(sheet).toContainText('Together: 230 gc');
    await expect(sheet.getByRole('button', { name: 'One Tentacles more' })).toBeDisabled();
    await sheet.getByRole('button', { name: 'One Great Claw less' }).click();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-mutations`);
    await sheet.getByRole('button', { name: 'Close' }).click();
    const grell = page.getByRole('article', { name: 'Grell' });
    await expect(grell).toContainText('Great Claw, Cloven Hooves');
    await expect(page.getByRole('list', { name: 'Warnings' })).not.toContainText('Mutant needs');
  });

  test(`the Mark of Chaos, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.goto('./');
    const sheet = page.locator('dialog[open]');
    await importText(page, JSON.stringify({ wb: 'maraudersofchaos', name: 'Sons of the Crow', models: [{ uid: 1, uid_def: 'chieftain', name: 'Skarr' }, { uid: 2, uid_def: 'seer', name: 'Vala' }] }), 'Sons of the Crow');
    await page.getByRole('button', { name: 'More for Vala', exact: true }).click();
    await sheet.getByRole('button', { name: /Mark of Chaos/ }).click();
    await sheet.getByRole('button', { name: /^Mark of Tchar/ }).click();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-mark`);
    await sheet.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByRole('article', { name: 'Vala' })).toContainText('Sorcerer of Tchar');
    await page.getByRole('button', { name: 'More for Skarr', exact: true }).click();
    await sheet.getByRole('button', { name: /^Take the Mark of Tchar/ }).click();
    await expect(page.getByRole('article', { name: 'Skarr' })).toContainText('Touched by Tchar');
  });
}

/* After the first battle more men for a group with experience draw on the
   veterans roll (rulebook, new recruits and existing Henchmen groups). */
test('more men after the first battle: the veterans roll', async ({ page }) => {
  await page.goto('./');
  await importText(page, FOUGHT);
  const sheet = page.locator('dialog[open]');
  const gold = async () => parseInt((await page.locator('dt:text-is("Gold") + dd').textContent())!, 10);
  const group = page.getByRole('article', { name: 'Warrior', exact: true });
  for (let i = 0; i < 3; i++) await group.getByRole('button', { name: 'One experience more for Warrior', exact: true }).click();
  await expect(group).toContainText('Exp 3');
  const before = await gold();
  await group.getByRole('button', { name: /\+ Man/ }).click();
  const roll = sheet.getByRole('textbox', { name: /2D6 as rolled for the veterans/ });
  await expect(sheet.getByRole('button', { name: 'Recruit' })).toBeDisabled();
  await roll.fill('5');
  await sheet.getByRole('button', { name: 'One man more' }).click();
  await expect(sheet).toContainText('2 men bring 6 experience; 5 of the roll are left.');
  await expect(sheet.getByRole('button', { name: 'Recruit' })).toBeDisabled();
  await sheet.getByRole('button', { name: 'One man less' }).click();
  await sheet.getByRole('textbox', { name: 'Name of new man 1' }).fill('Kaspar');
  await noSideScroll(page); await tapTargets(page);
  await shot(page, 'more-men-veterans');
  await sheet.getByRole('button', { name: 'Recruit' }).click();
  await expect(group.getByRole('button', { name: 'Kaspar: name or dismiss' })).toBeVisible();
  await expect.poll(gold).toBeLessThan(before);
  // the rest of the roll stays for this round: 2 left, one more man would bring 3
  await group.getByRole('button', { name: /\+ Man/ }).click();
  await expect(roll).toHaveValue('5');
  await expect(sheet).toContainText('1 man brings 3 experience; 2 of the roll are left.');
});

/* A warrior hired after the first battle buys from his own list until his
   own first battle (Rob, 02.10.2026, on the Ultimate FAQ); rare items only
   by searching. */
test('a recruit after the first battle buys from his list', async ({ page }) => {
  await page.goto('./');
  await importText(page, FOUGHT);
  const sheet = page.locator('dialog[open]');
  const gold = async () => parseInt((await page.locator('dt:text-is("Gold") + dd').textContent())!, 10);
  await page.getByRole('button', { name: '+ Recruit' }).click();
  await sheet.getByRole('button', { name: /^Youngblood/ }).click();
  await expect(sheet).toHaveCount(0);
  const young = page.getByRole('article', { name: 'Youngblood' }).last();
  await expect(page.getByRole('article', { name: 'Youngblood' })).toHaveCount(2);
  const before = await gold();
  await young.getByRole('button', { name: /More for Youngblood/ }).click();
  await sheet.getByRole('button', { name: 'Equipment & rare items' }).click();
  await expect(sheet).toContainText('until his own he buys from his list');
  await sheet.getByRole('button', { name: 'One Sword more' }).click();
  await expect.poll(gold).toBe(before - 10);
  await noSideScroll(page); await tapTargets(page);
  await shot(page, 'recruit-list');
  await sheet.getByRole('button', { name: 'Done' }).click();
  // a warrior who has fought goes to the Trading Post
  await page.getByRole('button', { name: 'More for Magda', exact: true }).click();
  await expect(sheet.getByRole('button', { name: /Equipment – at the Trading Post/ })).toBeVisible();
});

/* After the first battle a dismissed warrior refunds nothing; his
   equipment goes to the stash. */
test('a warrior dismissed after the first battle leaves his equipment', async ({ page }) => {
  await page.goto('./');
  await importText(page, FOUGHT);
  const gold = async () => (await page.locator('dt:text-is("Gold") + dd').textContent())!;
  const before = await gold();
  await page.getByRole('button', { name: 'More for Ulrich the Grey', exact: true }).click();
  await page.locator('dialog[open]').getByRole('button', { name: /Dismiss – his equipment goes to the stash/ }).click();
  await expect(page.getByRole('article', { name: 'Ulrich the Grey' })).toHaveCount(0);
  await expect.poll(gold).toBe(before);
  await expect(page.getByRole('link', { name: /Trading Post · stash/ })).toBeVisible();
  // ⋯ → Equipment leads to the Trading Post
  await page.getByRole('button', { name: 'More for Magda', exact: true }).click();
  await page.locator('dialog[open]').getByRole('button', { name: /Equipment – at the Trading Post/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Trading Post' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Give items' })).toBeVisible();
});

/* Phase 3c: advances as rolled, and "The lad's got talent". */
for (const theme of THEMES) {
  test(`advances as rolled, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.goto('./');
    await importSample(page);
    const sheet = page.locator('dialog[open]');
    const ulrich = page.getByRole('article', { name: 'Ulrich the Grey' });

    // 7: +1 WS or +1 BS
    await ulrich.getByRole('button', { name: 'Advance' }).click();
    await sheet.getByRole('textbox', { name: '2D6 as rolled' }).fill('7');
    await sheet.getByRole('button', { name: '+1 Weapon Skill' }).click();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-advance-stat`);
    await sheet.getByRole('button', { name: 'Apply' }).click();
    await expect(page.locator('[role=status]', { hasText: '+1 Weapon Skill' })).toBeVisible();

    // 3: a new skill from his lists
    await ulrich.getByRole('button', { name: 'Advance' }).click();
    await sheet.getByRole('textbox', { name: '2D6 as rolled' }).fill('3');
    const combat = sheet.getByRole('group', { name: 'Combat' });
    const skill = combat.getByRole('button', { disabled: false }).first();
    const name = (await skill.textContent())!;
    await skill.click();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-advance-skill`);
    await sheet.getByRole('button', { name: 'Apply' }).click();
    await expect(ulrich).toContainText(name);

    // 11 for a group: one man becomes a Hero, with two skill lists
    const group = page.getByRole('article', { name: 'Warrior', exact: true });
    await group.getByRole('button', { name: 'Advance' }).click();
    await sheet.getByRole('textbox', { name: '2D6 as rolled' }).fill('11');
    await sheet.getByRole('group', { name: 'Who' }).getByRole('button', { name: 'Fritz' }).click();
    await sheet.getByRole('group', { name: 'Skill lists' }).getByRole('button').nth(0).click();
    await sheet.getByRole('group', { name: 'Skill lists' }).getByRole('button').nth(1).click();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-advance-talent`);
    await sheet.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByRole('article', { name: 'Fritz' })).toContainText('Promoted');
    await expect(group.getByRole('list', { name: 'Men of Warrior' }).getByRole('listitem')).toHaveCount(2);

    // a mistake taken back, from ⋯
    await page.getByRole('button', { name: 'More for Ulrich the Grey', exact: true }).click();
    await sheet.getByRole('button', { name: /Advances taken – correct/ }).click();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-advances-taken`);
    await sheet.getByRole('listitem').filter({ hasText: name }).getByRole('button', { name: 'Remove' }).click();
    await expect(ulrich).not.toContainText(name);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(ulrich).toContainText(name);
  });
}

/* Phase 3c: injuries as rolled, with the follow-ups the chart asks for (V1). */
for (const theme of THEMES) {
  test(`injuries as rolled, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.goto('./');
    await importSample(page);
    const sheet = page.locator('dialog[open]');

    // 23 Arm Wound asks a D6: 2–6, he misses the next game
    const magda = page.getByRole('article', { name: 'Magda' });
    await magda.getByRole('button', { name: 'Injury for Magda' }).click();
    await sheet.getByRole('textbox', { name: 'D66 as rolled' }).fill('23');
    await sheet.getByRole('button', { name: /^2–6 — misses the next game/ }).click();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-injury-arm`);
    await sheet.getByRole('button', { name: 'Apply' }).click();
    await expect(magda).toContainText('Misses 1 game');

    // Multiple Injuries: two more, one of them a lost pit fight with its own roll
    const ulrich = page.getByRole('article', { name: 'Ulrich the Grey' });
    await ulrich.getByRole('button', { name: 'Injury for Ulrich the Grey' }).click();
    await sheet.getByRole('textbox', { name: 'D66 as rolled' }).fill('21');
    await sheet.getByRole('group', { name: 'D6: how many more' }).getByRole('button', { name: '2', exact: true }).click();
    await sheet.getByRole('textbox', { name: 'Further result 1, D66' }).fill('22');
    await expect(sheet.getByRole('button', { name: 'Apply' })).toBeDisabled();
    await sheet.getByRole('textbox', { name: 'Further result 2, D66' }).fill('65');
    await sheet.getByRole('button', { name: /^Lost — loses his weapons and armour/ }).click();
    await sheet.getByRole('textbox', { name: 'Then D66, 11–35' }).fill('34');
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-injury-multiple`);
    await sheet.getByRole('button', { name: 'Apply' }).click();
    await expect(ulrich).toContainText('Leg Wound');
    await expect(ulrich).toContainText('Hand Injury');
    await expect(ulrich).not.toContainText('Sword');

    // a Henchman rolls a D6 for the man who went down
    const group = page.getByRole('article', { name: 'Warrior', exact: true });
    await group.getByRole('button', { name: 'Injury for Warrior' }).click();
    await sheet.getByRole('group', { name: 'Who' }).getByRole('button', { name: 'Otto' }).click();
    await sheet.getByRole('textbox', { name: 'D6 as rolled' }).fill('2');
    await expect(sheet).toContainText('Otto is dead');
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-injury-hench`);
    await sheet.getByRole('button', { name: 'Apply' }).click();
    await expect(group.getByRole('list', { name: 'Men of Warrior' }).getByRole('listitem')).toHaveCount(2);
    await expect(group).not.toContainText('Otto');

    // 61 Captured, held for now (Rob, 02.10.2026): on the roster but not fighting, until ransomed
    const young = page.getByRole('article', { name: 'Youngblood' });
    await young.getByRole('button', { name: 'Injury for Youngblood' }).click();
    await sheet.getByRole('textbox', { name: 'D66 as rolled' }).fill('61');
    await sheet.getByRole('button', { name: /^Held for now/ }).click();
    await sheet.getByRole('button', { name: 'Apply' }).click();
    await expect(young).toContainText('Captive');
    await expect(young.getByRole('button', { name: 'Injury for Youngblood' })).toHaveCount(0);
    const goldBefore = await page.locator('dl dt', { hasText: 'Gold' }).locator('xpath=following-sibling::dd').textContent();
    await young.getByRole('button', { name: /Captivity of Youngblood/ }).click();
    await sheet.getByRole('button', { name: 'Ransomed' }).click();
    await sheet.getByRole('textbox', { name: 'Ransom paid, in gc' }).fill('20');
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-captivity`);
    await sheet.getByRole('button', { name: 'Apply' }).click();
    await expect(young).not.toContainText('Captive');
    await expect(page.locator('dl dt', { hasText: 'Gold' }).locator('xpath=following-sibling::dd')).toHaveText(`${parseInt(goldBefore!, 10) - 20} gc`);

    // an injury entered by mistake is taken back from ⋯
    await page.getByRole('button', { name: 'More for Ulrich the Grey', exact: true }).click();
    await sheet.getByRole('button', { name: /Injuries – correct/ }).click();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-injuries-correct`);
    await sheet.getByRole('listitem').filter({ hasText: 'Leg Wound' }).getByRole('button', { name: 'Remove' }).click();
    await expect(ulrich).not.toContainText('Leg Wound');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(ulrich).toContainText('Leg Wound');

    // out of action for good: the Champion joins the Fallen
    await page.getByRole('button', { name: 'More for Champion', exact: true }).click();
    await sheet.getByRole('button', { name: /Out of action for good/ }).click();
    await expect(sheet.getByRole('textbox', { name: 'D66 as rolled' })).toHaveValue('11');
    await sheet.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByRole('article', { name: 'Champion', exact: true })).toHaveCount(0);
    await expect(page.getByText(/^Fallen \(\d+\)$/)).toBeVisible();

    // a Hired Sword rolls a D6 too: on a 1 he is gone
    await page.getByRole('button', { name: 'Injury for Ogre Bodyguard' }).click();
    await sheet.getByRole('textbox', { name: 'D6 as rolled' }).fill('1');
    await sheet.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByRole('article', { name: 'Ogre Bodyguard' })).toHaveCount(0);
  });
}

/* Removing a warrior is a click and an Undo, not a question. */
test('a warrior removed from the roster comes back with Undo', async ({ page }) => {
  await page.goto('./');
  await importSample(page);
  await page.getByRole('button', { name: 'More for Ulrich the Grey', exact: true }).click();
  await page.locator('dialog[open]').getByRole('button', { name: /Remove from the roster/ }).click();
  await expect(page.getByRole('article', { name: 'Ulrich the Grey' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('article', { name: 'Ulrich the Grey' })).toBeVisible();
});

/* Back closes the sheets of the roster too, and a sheet opened from the ⋯
   menu leaves no step of the menu behind. */
test('Back closes the sheets of the roster', async ({ page }) => {
  await page.goto('./');
  await importSample(page);
  const roster = page.url();
  await page.getByRole('button', { name: '+ Recruit' }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await page.goBack();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(page.url()).toBe(roster);
  await page.getByRole('button', { name: 'More for Ulrich the Grey', exact: true }).click();
  await page.locator('dialog[open]').getByRole('button', { name: /^Name/ }).click();
  await expect(page.locator('dialog[open]').getByRole('textbox')).toBeVisible();
  await page.goBack();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(page.url()).toBe(roster);
  await page.getByRole('button', { name: 'Rename the warband' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Cancel' }).click();
  await page.waitForFunction(() => !(history.state as { mordheimSheet?: boolean } | null)?.mordheimSheet);
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'The Silver Caravan' })).toHaveCount(0);
});

/* Back closes a sheet instead of leaving the app (Rob, 28.09.2026). */
test('Back closes the import sheet and stays on the screen', async ({ page }) => {
  await page.goto('./');
  const home = page.url();
  await page.getByRole('link', { name: 'Warbands' }).click();
  const here = page.url();
  await page.getByRole('button', { name: 'Import a warband' }).first().click();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await tapTargets(page); // the file picker too (button audit, 29.09.2026)
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

/* Removing a warband leaves no step back to it (button audit, 29.09.2026). */
test('after removing a warband, Back does not lead to it', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Warbands' }).click();
  await importSample(page);
  await page.getByRole('button', { name: 'Remove from this device' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Warbands' })).toBeVisible();
  await page.goBack();
  await expect(page.getByText('Not on this device')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Warbands' })).toBeVisible();
});

/* The undo notice must not stand in the way (Rob, 28.09.2026). */
test('the undo notice goes quickly, can be dismissed and lets taps through', async ({ page }) => {
  await page.goto('./');
  await importSample(page);
  await page.getByRole('button', { name: 'Remove from this device' }).click();
  const toast = page.locator('[role=status]', { hasText: 'removed.' });
  await expect(toast).toBeVisible();
  await shot(page, 'undo-toast');
  const through = await toast.evaluate((el) => {
    const r = el.querySelector('span')!.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !el.contains(hit);
  });
  expect(through, 'a tap on the text reaches what lies under it').toBe(true);
  await expect(toast).toBeHidden({ timeout: 6000 });
  // Undo brings the warband back; the next notice is dismissed at once
  await importSample(page);
  await page.getByRole('button', { name: 'Remove from this device' }).click();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('link', { name: /The Silver Caravan/ })).toBeVisible();
  await page.getByRole('link', { name: /The Silver Caravan/ }).click();
  await page.getByRole('button', { name: 'Remove from this device' }).click();
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(toast).toBeHidden({ timeout: 500 });
});

/* On a desktop screen the cards stand side by side. */
test('the roster uses the width of a desktop screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  await importSample(page);
  const tops = await page.getByRole('article').evaluateAll((els) => els.slice(0, 2).map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(tops[0], 'the first two warriors share a row').toBe(tops[1]);
  await noSideScroll(page);
  await shot(page, 'desktop-roster');
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
/* The budgets of docs/ui.md. Each time is the median of three runs: a
   shared CI runner has slow moments that say nothing about the app, and a
   real regression still shows in the median. */
test.describe('start-up budgets', () => {
  async function throttle(page: Page) {
    const cdp = await page.context().newCDPSession(page);
    // a slow 4G line and a mid-range phone (4× slower CPU)
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  const ready = (page: Page) => expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

  test('first start online in under 3 s', async ({ browser, baseURL }) => {
    const times: number[] = [];
    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      await throttle(page);
      const t0 = Date.now();
      await page.goto(baseURL!);
      await ready(page);
      times.push(Date.now() - t0);
      await ctx.close();
    }
    expect(median(times), `first starts: ${times.join(', ')} ms`).toBeLessThan(3000);
  });

  test('start from the cache in under 1 s, a reaction in under 100 ms', async ({ page }) => {
    await page.goto('./');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await throttle(page);
    const starts: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      await page.reload();
      await ready(page);
      starts.push(Date.now() - t0);
    }
    expect(median(starts), `starts from the cache: ${starts.join(', ')} ms`).toBeLessThan(1000);
    await page.getByRole('link', { name: 'More' }).click();
    // the screen must be there before its reaction is timed
    await expect(page.locator('input[value=parchment]')).toBeAttached();
    const reactions: number[] = [];
    for (const theme of ['parchment', 'chronicle', 'parchment']) {
      reactions.push(await page.evaluate(async (v) => {
        const radio = document.querySelector<HTMLInputElement>(`input[value=${v}]`)!;
        const t = performance.now();
        radio.click();
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        return performance.now() - t;
      }, theme));
    }
    expect(median(reactions), `reactions: ${reactions.map(Math.round).join(', ')} ms`).toBeLessThan(100);
  });

  /* The most frequent change on the roster: one step of experience. The
     whole roster is worked out again by core; it must still feel instant. */
  test('a step of experience shows in under 100 ms', async ({ page }) => {
    await page.goto('./');
    await importSample(page);
    await throttle(page);
    const button = 'article[aria-label="Ulrich the Grey"] button[aria-label^="One experience more"]';
    await expect(page.locator(button)).toBeVisible();
    const reactions: number[] = [];
    for (let i = 0; i < 3; i++) {
      reactions.push(await page.evaluate(async (sel) => {
        const b = document.querySelector<HTMLButtonElement>(sel)!;
        const out = b.previousElementSibling!;
        const before = out.textContent;
        const t = performance.now();
        b.click();
        while (out.textContent === before) await new Promise((r) => requestAnimationFrame(() => r(null)));
        return performance.now() - t;
      }, button));
    }
    expect(median(reactions), `experience steps: ${reactions.map(Math.round).join(', ')} ms`).toBeLessThan(100);
  });
});

/* Rob, 02.10.2026: the Roster Builder's tooltips are "essential and must be
   in". Every word on a card that names a rule opens a bubble with its text. */
for (const theme of THEMES) {
  test(`rule texts on the cards, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.goto('./');
    await importSample(page);
    const ulrich = page.getByRole('article', { name: 'Ulrich the Grey' });
    // his own Leader rule: 12" in a Reikland warband
    await ulrich.getByRole('button', { name: 'Leader', exact: true }).click();
    const tip = page.getByRole('tooltip');
    await expect(tip).toContainText('Reikland');
    await ulrich.getByRole('button', { name: 'Sword', exact: true }).click();
    await expect(tip).toHaveCount(1);
    await expect(tip).toContainText('Parry');
    const box = (await tip.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-rule-tip`);
    // a tap elsewhere closes it
    await page.getByRole('heading', { level: 1 }).click();
    await expect(tip).toHaveCount(0);
    // an injury, a skill, a Hired Sword's rule
    await page.getByRole('article', { name: 'Magda' }).getByRole('button', { name: /Leg Wound/ }).click();
    await expect(tip).toContainText('Movement permanently');
    await ulrich.getByRole('button', { name: 'Strike to Injure' }).click();
    await expect(tip).toContainText('Skill');
    await page.keyboard.press('Escape');
    await expect(tip).toHaveCount(0);
    await page.getByRole('article', { name: /Ogre/ }).getByRole('button', { name: 'Fear', exact: true }).click();
    await expect(tip).toBeVisible();
  });
}
