/* The built app on a phone-sized screen. */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { noSideScroll, shot, tapTargets, unit, useTheme } from './helpers.ts';

const SAVE = readFileSync(new URL('./fixtures/silver-caravan.json', import.meta.url), 'utf8');
/* the same warband after its first battle: trading has begun (V4–V7) */
const FOUGHT = JSON.stringify({ ...JSON.parse(SAVE) as Record<string, unknown>, campaign: { ...(JSON.parse(SAVE) as { campaign: object }).campaign, round: 1 } });
const THEMES = ['chronicle', 'parchment'] as const;

/* No errors in the console, Content Security Policy violations included. */
let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|net::ERR_/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  // the preview has no campaign server: nobody is signed in (account.spec.ts plays the server)
  await page.route('**/api/v1/**', (r) => r.fulfill({ json: { user: null, pending: false } }));
});
test.afterEach(() => { expect(errors, 'console errors').toEqual([]); });

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
    // a row each, the whole profile in a line, nothing open until asked (Rob, 18.10.2026)
    await expect(page.getByRole('img', { name: /^M \S+, WS \S+, BS \S+/ })).toHaveCount(7);
    await expect(page.getByRole('button', { name: /^Ulrich the Grey/ })).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(0);
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-roster`);
    // opened under his row: experience as the framed steps of the track, not a bare number (Rob, 29.09.2026)
    const ulrich = await unit(page, 'Ulrich the Grey');
    await expect(ulrich.getByRole('list', { name: 'Experience steps' }).getByRole('listitem')).toHaveCount(21);
    await expect(page.getByRole('article')).toHaveCount(1);
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-roster-open`);

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
    await expect(page.getByRole('button', { name: /^Mercenary Captain/ })).toBeVisible();
    await expect(page.getByText('Recruited Mercenary Captain')).toBeVisible();
    await page.getByRole('button', { name: '+ Recruit' }).click();
    await expect(sheet.getByRole('button', { name: /^Mercenary Captain/ })).toBeDisabled();
    await sheet.getByRole('button', { name: /^Warrior/ }).click();
    const group = await unit(page, 'Warrior');
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
    const captain = await unit(page, 'Mercenary Captain');
    await captain.getByRole('button', { name: /One experience more/ }).click();
    await expect(captain.getByText('Exp 21')).toBeVisible();

    // the last tab: the Captain's name is a field – Enter saves it
    await unit(page, 'Mercenary Captain', 'Story & more');
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-warrior-story`);
    await captain.getByRole('textbox', { name: 'Name of this Mercenary Captain' }).fill('Ulrich the Grey');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('article', { name: 'Ulrich the Grey' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Ulrich the Grey, Mercenary Captain/ })).toBeVisible();

    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-roster-edited`);

    // everything is on the device: a reload shows the same
    await page.reload();
    await expect(await unit(page, 'Ulrich the Grey')).toContainText('Exp 21');
    await expect((await unit(page, 'Warrior')).getByRole('button', { name: 'Bruno: name or dismiss' })).toBeVisible();
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
    await (await unit(page, 'Magda', 'Gear')).getByRole('button', { name: /Equipment & rare items/ }).click();
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
    await page.getByRole('link', { name: 'Trade' }).click();
    await expect(page.getByText('Until its first battle the warband buys from its lists')).toBeVisible();
  });
}

/* Phase 3b: the Trading Post after the first battle, every tab and sheet. */
for (const theme of THEMES) {
  test(`the Trading Post after the first battle, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.goto('./');
    await importText(page, FOUGHT);
    await page.getByRole('link', { name: 'Trade' }).click();
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
    await (await unit(page, 'Grell', 'Skills & injuries')).getByRole('button', { name: 'Mutations' }).click();
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
    await expect(grell).toContainText('Great Claw');
    await expect(grell).toContainText('Cloven Hooves');
    await expect(page.getByRole('list', { name: 'Warnings' })).not.toContainText('Mutant needs');
  });

  test(`the Mark of Chaos, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.goto('./');
    const sheet = page.locator('dialog[open]');
    await importText(page, JSON.stringify({ wb: 'maraudersofchaos', name: 'Sons of the Crow', models: [{ uid: 1, uid_def: 'chieftain', name: 'Skarr' }, { uid: 2, uid_def: 'seer', name: 'Vala' }] }), 'Sons of the Crow');
    await (await unit(page, 'Vala', 'Skills & injuries')).getByRole('button', { name: /Mark of Chaos/ }).click();
    await sheet.getByRole('button', { name: /^Mark of Tchar/ }).click();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-mark`);
    await sheet.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByRole('article', { name: 'Vala' })).toContainText('Sorcerer of Tchar');
    await (await unit(page, 'Skarr', 'Skills & injuries')).getByRole('button', { name: /^Take the Mark of Tchar/ }).click();
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
  const group = await unit(page, 'Warrior');
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
  const rows = page.getByRole('button', { name: /^Youngblood(,|$)/ });
  await expect(rows).toHaveCount(2);
  const before = await gold();
  await rows.last().click();
  await page.getByRole('tab', { name: 'Gear' }).click();
  await page.getByRole('article', { name: 'Youngblood' }).getByRole('button', { name: 'Equipment & rare items' }).click();
  await expect(sheet).toContainText('until his own he buys from his list');
  await sheet.getByRole('button', { name: 'One Sword more' }).click();
  await expect.poll(gold).toBe(before - 10);
  await noSideScroll(page); await tapTargets(page);
  await shot(page, 'recruit-list');
  await sheet.getByRole('button', { name: 'Done' }).click();
  // a warrior who has fought goes to the Trading Post
  await expect((await unit(page, 'Magda', 'Gear')).getByRole('link', { name: /Equipment – at the Trading Post/ })).toBeVisible();
});

/* After the first battle a dismissed warrior refunds nothing; his
   equipment goes to the stash. */
test('a warrior dismissed after the first battle leaves his equipment', async ({ page }) => {
  await page.goto('./');
  await importText(page, FOUGHT);
  const gold = async () => (await page.locator('dt:text-is("Gold") + dd').textContent())!;
  const before = await gold();
  await (await unit(page, 'Ulrich the Grey', 'Story & more')).getByRole('button', { name: /Dismiss – his equipment goes to the stash/ }).click();
  await expect(page.getByRole('button', { name: /^Ulrich the Grey/ })).toHaveCount(0);
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect.poll(gold).toBe(before);
  await expect(page.getByRole('link', { name: /^Trade, stash/ })).toBeVisible();
  // his Gear leads to the Trading Post
  await (await unit(page, 'Magda', 'Gear')).getByRole('link', { name: /Equipment – at the Trading Post/ }).click();
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
    const ulrich = await unit(page, 'Ulrich the Grey');

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
    await unit(page, 'Ulrich the Grey', 'Skills & injuries');
    await expect(ulrich).toContainText(name);

    // 11 for a group: one man becomes a Hero, with two skill lists
    let group = await unit(page, 'Warrior');
    await group.getByRole('button', { name: 'Advance' }).click();
    await sheet.getByRole('textbox', { name: '2D6 as rolled' }).fill('11');
    await sheet.getByRole('group', { name: 'Who' }).getByRole('button', { name: 'Fritz' }).click();
    await sheet.getByRole('group', { name: 'Skill lists' }).getByRole('button').nth(0).click();
    await sheet.getByRole('group', { name: 'Skill lists' }).getByRole('button').nth(1).click();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-advance-talent`);
    await sheet.getByRole('button', { name: 'Apply' }).click();
    await expect(await unit(page, 'Fritz')).toContainText('Promoted');
    group = await unit(page, 'Warrior');
    await expect(group.getByRole('list', { name: 'Men of Warrior' }).getByRole('listitem')).toHaveCount(2);

    // a mistake taken back, from his skills
    await (await unit(page, 'Ulrich the Grey', 'Skills & injuries')).getByRole('button', { name: /Advances taken – correct/ }).click();
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
    const magda = await unit(page, 'Magda');
    await magda.getByRole('button', { name: 'Injury for Magda' }).click();
    await sheet.getByRole('textbox', { name: 'D66 as rolled' }).fill('23');
    await sheet.getByRole('button', { name: /^2–6 — misses the next game/ }).click();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-injury-arm`);
    await sheet.getByRole('button', { name: 'Apply' }).click();
    await expect(magda).toContainText('Misses 1 game');

    // Multiple Injuries: two more, one of them a lost pit fight with its own roll
    const ulrich = await unit(page, 'Ulrich the Grey');
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
    await unit(page, 'Ulrich the Grey', 'Gear');
    await expect(ulrich).not.toContainText('Sword');

    // a Henchman rolls a D6 for the man who went down
    const group = await unit(page, 'Warrior');
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
    const young = await unit(page, 'Youngblood');
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

    // an injury entered by mistake is taken back from his injuries
    await (await unit(page, 'Ulrich the Grey', 'Skills & injuries')).getByRole('button', { name: /Injuries – correct/ }).click();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-injuries-correct`);
    await sheet.getByRole('listitem').filter({ hasText: 'Leg Wound' }).getByRole('button', { name: 'Remove' }).click();
    await expect(ulrich).not.toContainText('Leg Wound');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(ulrich).toContainText('Leg Wound');

    // out of action for good: the Champion joins the Fallen
    await (await unit(page, 'Champion', 'Story & more')).getByRole('button', { name: /Out of action for good/ }).click();
    await expect(sheet.getByRole('textbox', { name: 'D66 as rolled' })).toHaveValue('11');
    await sheet.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByRole('button', { name: /^Champion(,|$)/ })).toHaveCount(0);
    await expect(page.getByText(/^Fallen \(\d+\)$/)).toBeVisible();
    // the Fallen say what was lost with him: experience, equipment, gold
    await page.getByText(/^Fallen \(\d+\)$/).click();
    const champion = page.getByRole('region', { name: '1× Champion' });
    await expect(champion).toContainText(/\d+ Exp · \d+ gc/);
    await expect(champion).toContainText('Dagger');
    await expect(page.getByText(/^\d+ gc lost/)).toBeVisible();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-fallen`);

    // a Hired Sword rolls a D6 too: on a 1 he is gone
    await (await unit(page, 'Ogre Bodyguard')).getByRole('button', { name: 'Injury for Ogre Bodyguard' }).click();
    await sheet.getByRole('textbox', { name: 'D6 as rolled' }).fill('1');
    await sheet.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByRole('button', { name: /^Ogre Bodyguard/ })).toHaveCount(0);
  });
}

/* Removing a warrior is a click and an Undo, not a question. */
test('a warrior removed from the roster comes back with Undo', async ({ page }) => {
  await page.goto('./');
  await importSample(page);
  await (await unit(page, 'Ulrich the Grey', 'Story & more')).getByRole('button', { name: /Remove from the roster/ }).click();
  await expect(page.getByRole('button', { name: /^Ulrich the Grey/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: /^Ulrich the Grey/ })).toBeVisible();
});

/* Back closes the sheets of the roster too, also one opened from a card. */
test('Back closes the sheets of the roster', async ({ page }) => {
  await page.goto('./');
  await importSample(page);
  const roster = page.url();
  await page.getByRole('button', { name: '+ Recruit' }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await page.goBack();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(page.url()).toBe(roster);
  await (await unit(page, 'Ulrich the Grey')).getByRole('button', { name: 'Advance' }).click();
  await expect(page.locator('dialog[open]').getByRole('textbox', { name: '2D6 as rolled' })).toBeVisible();
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

/* On a desktop screen the list and the selected warrior stand side by side
   (Rob, 18.10.2026: the whole width is used, the information is in sight at
   once, and many warriors are not a wall of text). A desktop has a mouse,
   not a finger: the controls are the smaller ones (docs/ui.md §5). */
test.describe('with a mouse', () => {
test.use({ hasTouch: false, isMobile: false });
for (const theme of THEMES) {
  test(`the roster uses the width of a desktop screen, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./');
    await importSample(page);
    await expect(page.locator('[data-layout]')).toHaveAttribute('data-layout', 'split');
    // the first warrior is selected; every section stands in the pane, nothing behind tabs
    const pane = page.getByRole('complementary', { name: 'Selected warrior' });
    await expect(pane.getByRole('article', { name: 'Ulrich the Grey' })).toBeVisible();
    await expect(page.getByRole('tablist')).toHaveCount(0);
    for (const h of ['Profile', 'Experience', 'Equipment', 'Skills', 'Injuries', 'Name', 'Leaving the warband']) {
      await expect(pane.getByRole('heading', { level: 3, name: new RegExp(`^${h}`) })).toBeVisible();
    }
    // the list beside the pane; a row is one table line: name, profile and experience across
    const heroes = page.getByRole('region', { name: 'Heroes' }).getByRole('listitem');
    const row = (await heroes.first().boundingBox())!;
    const side = (await pane.boundingBox())!;
    expect(side.x, 'the pane stands beside the list').toBeGreaterThan(row.x + row.width);
    expect(row.height, 'a row is a line or two, not a card').toBeLessThan(90);
    expect(row.width + side.width, 'the width is used').toBeGreaterThan(1000);
    // the warband's own functions are in sight, not behind a menu
    await expect(page.getByRole('link', { name: 'House rules', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Make a copy' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Trade' })).toBeVisible();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-desktop-roster`);

    // another warrior fills the pane; the experience is changed there
    await page.getByRole('button', { name: /^Magda/ }).click();
    await expect(page.getByRole('button', { name: /^Magda/ })).toHaveAttribute('aria-pressed', 'true');
    const magda = pane.getByRole('article', { name: 'Magda' });
    await expect(magda).toBeVisible();
    await magda.getByRole('button', { name: /One experience more for Magda/ }).click();
    await expect(magda.getByRole('button', { name: /Experience of Magda: 9\./ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Magda/ })).toContainText('Exp 9');
    // his name is a field in the pane: leaving it saves
    await magda.getByRole('textbox', { name: 'Name of this Champion' }).fill('Magda the Red');
    await magda.getByRole('textbox', { name: 'Name of this Champion' }).blur();
    await expect(page.getByRole('button', { name: /^Magda the Red/ })).toBeVisible();
    await shot(page, `${theme}-desktop-roster-magda`);
  });

  test(`a very wide screen adds a third column, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('./');
    await importSample(page);
    await expect(page.locator('[data-layout]')).toHaveAttribute('data-layout', 'triple');
    const pane = (await page.getByRole('complementary', { name: 'Selected warrior' }).boundingBox())!;
    const warband = (await page.getByRole('heading', { level: 2, name: 'Warband' }).boundingBox())!;
    expect(warband.x, 'the warband’s functions are the third column').toBeGreaterThan(pane.x + pane.width);
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-desktop-wide-roster`);
  });
}

test('the controls are smaller with a mouse than with a finger', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  await importSample(page);
  const recruit = (await page.getByRole('button', { name: '+ Recruit' }).boundingBox())!;
  expect(recruit.height).toBeGreaterThanOrEqual(32);
  expect(recruit.height).toBeLessThan(44);
});
});

/* The same page on a phone that is turned: the list is wide enough for table lines, the warrior still opens in place. */
test('a tablet in landscape shows table lines and opens a warrior under his row', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1000 });
  await page.goto('./');
  await importSample(page);
  await expect(page.locator('[data-layout]')).toHaveAttribute('data-layout', 'stack');
  await (await unit(page, 'Ulrich the Grey')).getByRole('list', { name: 'Experience steps' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('tablist', { name: 'Sections' })).toBeVisible();
  await noSideScroll(page);
  await shot(page, 'tablet-roster-open');
});

test('the navigation fits the flavour', async ({ page }) => {
  await page.goto('./');
  const labels = await page.getByRole('navigation', { name: 'Main' }).getByRole('link').allTextContents();
  expect(labels).toEqual(test.info().project.name === 'quickbuild' ? ['Home', 'Warbands', 'More'] : ['Home', 'Warbands', 'Campaign', 'Notes', 'More']);
  await expect(page).toHaveTitle(test.info().project.name === 'quickbuild' ? 'Mordheim Quick Build' : 'Mordheim Campaign');
});

/* Over http in the home network (the test instance) the browser has no
   crypto.randomUUID (Rob, 05.10.2026: import failed, "Start the warband"
   did nothing). The same without it here. */
test('without crypto.randomUUID (plain http) a warband can be started and imported', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true }); });
  const quick = test.info().project.name === 'quickbuild';
  await page.goto(quick ? '#/warbands/new' : 'warbands/new');
  await page.getByRole('combobox', { name: 'Warband' }).selectOption('merc');
  await page.getByRole('combobox', { name: 'City' }).selectOption('midd');
  await page.getByLabel('Name').fill('Over plain http');
  await page.getByRole('button', { name: 'Start the warband' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Over plain http' })).toBeVisible();
  await page.goto(quick ? '#/warbands' : 'warbands');
  await importSample(page);
});

test('the account is the campaign app’s: More shows it there, the Quick Build has none', async ({ page }) => {
  const quick = test.info().project.name === 'quickbuild';
  await page.goto(quick ? '#/more' : 'more');
  await expect(page.getByRole('heading', { level: 1, name: 'More' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Account' })).toHaveCount(quick ? 0 : 1);
  await page.goto(quick ? '#/sign-in' : 'sign-in');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(quick ? 'Not found' : 'Sign in');
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
    await unit(page, 'Ulrich the Grey');
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
    const ulrich = await unit(page, 'Ulrich the Grey');
    // his own Leader rule: 12" in a Reikland warband
    await ulrich.getByRole('button', { name: 'Leader', exact: true }).click();
    const tip = page.getByRole('tooltip');
    await expect(tip).toContainText('Reikland');
    await unit(page, 'Ulrich the Grey', 'Gear');
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
    await (await unit(page, 'Magda', 'Skills & injuries')).getByRole('button', { name: /Leg Wound/ }).click();
    await expect(tip).toContainText('Movement permanently');
    await (await unit(page, 'Ulrich the Grey', 'Skills & injuries')).getByRole('button', { name: 'Strike to Injure' }).click();
    await expect(tip).toContainText('Skill');
    await page.keyboard.press('Escape');
    await expect(tip).toHaveCount(0);
    await (await unit(page, 'Ogre Bodyguard')).getByRole('button', { name: 'Fear', exact: true }).click();
    await expect(tip).toBeVisible();
  });
}

/* Phase 3d: hiring (mockup docs/mockups/hire.html). Rob, 02.10.2026: the
   Hire button must be in reach without scrolling, and after hiring the list
   starts at its filters again. */
for (const theme of THEMES) {
  test(`hiring a Hired Sword, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.goto('./');
    await importSample(page);
    await page.getByRole('link', { name: 'Hire', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Hire' })).toBeVisible();
    const list = page.getByRole('list', { name: 'Hired Swords' });
    // the Ogre is already with the Silver Caravan
    await expect(list.getByRole('button', { name: /Ogre Bodyguard/ })).toContainText('with the warband');
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-hire`);

    // one who wants his weapons chosen first
    await page.getByRole('searchbox', { name: 'Find by name or race' }).fill('troll');
    await list.getByRole('button', { name: /Troll Slayer/ }).click();
    const sheet = page.locator('dialog[open]');
    const hire = sheet.getByRole('button', { name: 'Hire', exact: true });
    await expect(hire).toBeDisabled();
    await expect(sheet).toContainText('choose weapons first');
    await sheet.getByRole('button', { name: 'Double-Handed Axe' }).click();
    await expect(hire).toBeEnabled();
    await expect(hire).toBeInViewport();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-hire-sheet`);
    await hire.click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'hired' })).toContainText(/Troll Slayer hired for \d+ gc/);
    await expect(page.getByRole('searchbox', { name: 'Find by name or race' })).toBeInViewport();
    await expect(list.getByRole('button', { name: /Troll Slayer/ })).toContainText('with the warband');

    // and he is on the roster
    await page.getByRole('link', { name: /‹ The Silver Caravan/ }).click();
    await expect(page.getByRole('button', { name: /Troll Slayer, Hired Sword/ })).toBeVisible();
  });
}

test('one who may not join says why, and cannot be hired', async ({ page }) => {
  await page.goto('./');
  await importSample(page);
  await page.getByRole('link', { name: 'Hire', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Only those this warband may hire' }).uncheck();
  await page.getByRole('searchbox', { name: 'Find by name or race' }).fill('Dark Elf Assassin');
  await page.getByRole('list', { name: 'Hired Swords' }).getByRole('button').first().click();
  const sheet = page.locator('dialog[open]');
  await expect(sheet).toContainText('Not now: not available to this warband type');
  await expect(sheet.getByRole('button', { name: 'Hire', exact: true })).toBeDisabled();
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

/* Phase 3e: a warband's house rules (mockup docs/mockups/house-rules.html). */
for (const theme of THEMES) {
  test(`house rules, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.goto('./');
    await importSample(page);
    await page.getByRole('link', { name: 'House rules', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'House rules' })).toBeVisible();
    await expect(page.getByText('Nothing: the rules as written.')).toBeVisible();
    // armour at 80 %, then a step up
    await page.getByRole('checkbox', { name: 'Armour', exact: true }).check();
    await page.getByRole('button', { name: 'More: Armour' }).click();
    await expect(page.getByRole('region', { name: 'Prices' })).toContainText('85 %');
    await expect(page.getByText(/House rules: Armour price: 85/)).toBeVisible();
    // a grade not played
    await page.getByRole('group', { name: 'Hired Sword grades played' }).getByRole('button', { name: '2a' }).click();
    await expect(page.getByText(/excluded: 2a/)).toBeVisible();
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-house-rules`);
    // the roster shows them, and leads back
    await page.getByRole('link', { name: /‹ The Silver Caravan/ }).click();
    await page.getByRole('link', { name: '⚖ 2 house rules' }).click();
    // all back, and undone
    await page.getByRole('button', { name: 'All back to the rules as written' }).click();
    await expect(page.getByText('Nothing: the rules as written.')).toBeVisible();
    await page.getByRole('status').filter({ hasText: 'All house rules off' }).getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText(/House rules: Armour price: 85/)).toBeVisible();
  });
}

/* Phase 3e: exports – Tabletop Simulator cards, readable text, tool file
   and the official roster sheet, as the Roster Builder made them. */
for (const theme of THEMES) {
  test(`exports, in ${theme}`, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await useTheme(page, theme);
    await page.goto('./');
    await importSample(page);
    // the last tab of a warrior leads to his Tabletop Simulator entry
    await (await unit(page, 'Ulrich the Grey', 'Story & more')).getByRole('link', { name: /^Tabletop Simulator card/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Export' })).toBeVisible();
    const card = page.locator('details[open]').filter({ hasText: 'Ulrich the Grey' });
    await expect(card.getByRole('textbox', { name: 'Name' })).toHaveValue('[B8860B]Ulrich the Grey[-]');
    await expect(card.getByRole('textbox', { name: 'Description' })).toHaveValue(/Special Rules:/);
    await card.getByRole('button', { name: 'Copy name' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'copied' })).toHaveText('Name copied.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('[B8860B]Ulrich the Grey[-]');
    // the men of a group each have a card with their own name
    await expect(page.locator('summary').filter({ hasText: 'Otto' })).toContainText('of Warrior');
    await noSideScroll(page); await tapTargets(page);
    await shot(page, `${theme}-export`);

    // the readable text, the tool file and the sheet
    await page.getByRole('button', { name: 'Show the text' }).click();
    await expect(page.getByRole('textbox', { name: 'Readable text' })).toHaveValue(/MORDHEIM-DATA:/);
    const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save as .json' }).click()]);
    expect(json.suggestedFilename()).toMatch(/\.json$/);
    const [txt] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save as .txt' }).click()]);
    expect(txt.suggestedFilename()).toMatch(/\d{4}-\d\d-\d\d\.txt$/);
    const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save as PDF' }).click()]);
    expect(pdf.suggestedFilename()).toMatch(/official_sheet\.pdf$/);
    const bytes = readFileSync(await pdf.path());
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(100_000);
  });
}

/* Phase 3f: the builder's last gaps against the Roster Builder – setting the
   experience at once, the price paid for a rare item, printing the roster. */
test('experience set at once, a rare item’s price by hand, the roster printed', async ({ page }) => {
  await page.addInitScript(() => { (window as unknown as { printed: number }).printed = 0; window.print = () => { (window as unknown as { printed: number }).printed++; }; });
  await page.goto('./');
  await importSample(page);
  const ulrich = await unit(page, 'Ulrich the Grey');
  await ulrich.getByRole('button', { name: /Experience of Ulrich the Grey: \d+\. Set it/ }).click();
  let sheet = page.locator('dialog[open]');
  await sheet.getByRole('group', { name: 'Steps of the track' }).getByRole('button', { name: '36', exact: true }).click();
  await expect(sheet.getByRole('spinbutton', { name: 'Experience' })).toHaveValue('36');
  await noSideScroll(page); await tapTargets(page);
  await shot(page, 'experience-set');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(ulrich.getByRole('button', { name: /Experience of Ulrich the Grey: 36/ })).toBeVisible();

  // the price rolled at the table, entered by hand
  await (await unit(page, 'Magda', 'Gear')).getByRole('button', { name: /Equipment & rare items/ }).click();
  sheet = page.locator('dialog[open]');
  await sheet.getByRole('combobox', { name: 'Rare item to add' }).selectOption({ index: 1 });
  await sheet.getByRole('button', { name: 'Add', exact: true }).click();
  const paid = sheet.getByRole('spinbutton', { name: /^Paid for / });
  await paid.fill('37');
  await paid.blur();
  await expect(page.getByRole('status').filter({ hasText: 'Paid set to 37 gc.' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Done' })).toBeInViewport();
  await sheet.getByRole('button', { name: 'Done' }).click();

  // printing: from Export to the roster, which prints once, without the screen's buttons
  await page.getByRole('link', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: 'Print the roster' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'The Silver Caravan' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
  await expect(page.getByRole('button', { name: '+ Recruit' })).toBeHidden();
  await expect(page.getByRole('article', { name: 'Ulrich the Grey' })).toBeVisible();
  await shot(page, 'roster-print');
});
