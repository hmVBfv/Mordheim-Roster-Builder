/* Campaigns (phase 4a1) in the built campaign app, against the stand-in
   server (e2e/play.ts): the overview, another player's warband to read,
   entering a warband, what a leader manages, starting a campaign. Campaign
   app only (playwright.config.ts). */
import { crc32, deflateSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import { noSideScroll, shot, tapTargets, useTheme } from './helpers.ts';
import { playServer, SAVE, serverWarband } from './play.ts';

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error' || /net::ERR_/.test(m.text())) return;
    if (m.location().url.includes('/api/v1/') && /status of 4\d\d/.test(m.text())) return;
    errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
});
test.afterEach(() => { expect(errors, 'console errors').toEqual([]); });

const others = [
  { player: 'Anna', data: { ...SAVE, name: 'The Grey Penitents' }, role: 'leader' as const },
  { player: 'Ben', data: { ...SAVE, name: 'Clan Skrittle' }, pending: true },
];

for (const theme of ['chronicle', 'parchment'] as const) {
  test(`the overview, and another player's warband to read, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page);
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others });
    await page.goto('campaign');
    await expect(page.getByRole('heading', { level: 1, name: 'The Hel Fenn Campaign' })).toBeVisible();
    const list = page.getByRole('list', { name: 'Warbands' });
    await expect(list.getByRole('link')).toHaveCount(2);
    await expect(list.getByRole('link').first()).toContainText('✓ Start');
    await expect(list.getByRole('link').nth(1)).toContainText('Waiting for a leader');
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-campaign-overview`);
    await list.getByRole('link').first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'The Grey Penitents' })).toBeVisible();
    await expect(page.getByText(/Start marked .*: rating \d+/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Advance' })).toHaveCount(0);
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-campaign-warband`);
    expect(c.id).toBeTruthy();
  });
}

test('a leader manages: confirms a warband, adds someone, changes a role', async ({ page }) => {
  const srv = await playServer(page, true, { totp: true });
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others });
  await page.goto(`campaign/${c.id}/manage`);
  await expect(page.getByRole('heading', { name: 'Waiting for a leader' })).toBeVisible();
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'campaign-manage');
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Clan Skrittle takes part; its start is marked.')).toBeVisible();
  await page.getByLabel('Who').selectOption('user-rob');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Rob: Player.')).toBeVisible();
  await page.getByLabel('Role of Rob').selectOption('viewer');
  await expect(page.getByText('Rob: Viewer.')).toBeVisible();
  expect(srv.state.campaigns.get(c.id)!.enrolments.map((e) => e.status)).toEqual(['active', 'active']);
});

test('entering a warband: a copy goes in and opens; it can leave again', async ({ page }) => {
  const srv = await playServer(page);
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: others.slice(0, 1) });
  serverWarband(srv, 'The Silver Caravan');
  await page.goto('warbands');
  await expect(page.getByRole('link', { name: /The Silver Caravan/ })).toBeVisible();
  await page.goto(`campaign/${c.id}`);
  await page.getByRole('button', { name: 'Enter a warband' }).click();
  const sheet = page.getByRole('dialog', { name: 'Enter a warband' });
  await sheet.getByRole('radio', { name: /The Silver Caravan/ }).check();
  await tapTargets(page);
  await shot(page, 'campaign-enter');
  await sheet.getByRole('button', { name: 'Enter a copy' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'The Silver Caravan' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'In The Hel Fenn Campaign' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove the warband' })).toHaveCount(0);
  await noSideScroll(page);
  await page.getByRole('button', { name: 'Leave the campaign…' }).click();
  await page.getByRole('dialog', { name: 'Leave The Hel Fenn Campaign?' }).getByRole('button', { name: 'Leave the campaign' }).click();
  await expect(page.getByText('The warband has left the campaign.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove the warband' })).toBeVisible();
});

test('a new warband for the campaign: free under Warbands, its copy entered and opened', async ({ page }) => {
  const srv = await playServer(page);
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: others.slice(0, 1) });
  await page.goto(`campaign/${c.id}`);
  await page.getByRole('button', { name: 'Enter a warband' }).click();
  const sheet = page.getByRole('dialog', { name: 'Enter a warband' });
  await expect(sheet).toContainText('None of your warbands is free yet');
  await tapTargets(page);
  await shot(page, 'campaign-enter-none');
  await sheet.getByRole('button', { name: 'New warband for this campaign' }).click();
  await expect(page.getByText('For The Hel Fenn Campaign:', { exact: false })).toBeVisible();
  await page.getByRole('combobox', { name: 'Warband' }).selectOption('merc');
  await page.getByRole('combobox', { name: 'City' }).selectOption('midd');
  await page.getByLabel('Name').fill('The Ardent Caravan');
  await noSideScroll(page);
  await shot(page, 'campaign-new-warband');
  await page.getByRole('button', { name: 'Start the warband' }).click();
  await expect(page.getByRole('link', { name: 'In The Hel Fenn Campaign' })).toBeVisible();
  await page.goto('warbands');
  await expect(page.getByRole('link', { name: /The Ardent Caravan/ })).toHaveCount(2);
  await expect(page.getByRole('link', { name: /in The Hel Fenn Campaign/ })).toHaveCount(1);
  await shot(page, 'campaign-new-warband-list');
});

test('starting a campaign, with the authenticator', async ({ page }) => {
  await playServer(page, true, { totp: true });
  await page.goto('campaign');
  await expect(page.getByText('You are not part of a campaign yet', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Start a campaign' }).click();
  await page.getByLabel('Name of the campaign').fill('The Hel Fenn Campaign');
  await shot(page, 'campaign-start');
  await page.getByRole('button', { name: 'Start it' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'The Hel Fenn Campaign' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Manage' })).toHaveAttribute('aria-current', 'page');
  await noSideScroll(page);
  await tapTargets(page);
});

/* Rob, 19.10.2026: the archive of one's own list, and a leader deleting a campaign. */
test('a player files a campaign away in the list; a leader deletes one by its name', async ({ page }) => {
  const srv = await playServer(page, true, { totp: true });
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others });
  srv.addCampaign({ name: 'Summer in Sylvania', role: 'player' });
  srv.addCampaign({ name: 'The Long Winter', role: 'viewer', round: 2 });
  await page.goto('campaign');
  const list = page.getByRole('list', { name: 'Your campaigns' });
  await expect(list.getByRole('link')).toHaveCount(3);
  await page.getByRole('button', { name: 'Archive: The Long Winter' }).click();
  await expect(page.getByRole('list', { name: 'Archived campaigns' }).getByRole('link')).toHaveCount(1);
  await expect(list.getByRole('link')).toHaveCount(2);
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'campaign-archive');

  await page.goto(`campaign/${c.id}/manage`);
  await page.getByRole('button', { name: 'Delete the campaign…' }).click();
  const sheet = page.locator('dialog[open]');
  await expect(sheet.getByRole('button', { name: 'Delete it for everyone' })).toBeDisabled();
  await sheet.getByLabel('Type the name of the campaign').fill('The Hel Fenn Campaign');
  await expect(sheet.getByRole('button', { name: 'Delete it for everyone' })).toBeEnabled();
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'campaign-delete');
  await sheet.getByRole('button', { name: 'Delete it for everyone' }).click();
  await expect(page.getByText('“The Hel Fenn Campaign” is deleted. Its warbands are with their players again.')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Your campaigns' }).getByRole('link')).toHaveCount(1);
  expect(srv.state.campaigns.has(c.id)).toBe(false);
});

/* Rob, 19.10.2026: the side navigation opens into its entries; the account is a person, not three dots. */
for (const theme of ['chronicle', 'parchment'] as const) {
  test(`the side navigation: warbands, campaigns and the open campaign's sections, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.setViewportSize({ width: 1440, height: 900 });
    const srv = await playServer(page, true, { totp: true });
    serverWarband(srv, 'The Silver Caravan');
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others });
    srv.addCampaign({ name: 'Summer in Sylvania', role: 'player' });
    await page.goto(`campaign/${c.id}/timeline`);
    const nav = page.getByRole('navigation', { name: 'Main' });
    const sections = nav.getByRole('list', { name: 'The Hel Fenn Campaign: sections' });
    await expect(sections.getByRole('link')).toHaveText(['Overview', 'Notes', 'Timeline', 'Chronicle', 'World', 'Questions', 'Background ⚑', 'Manage']);
    await expect(sections.getByRole('link', { name: 'Timeline' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: 'Summer in Sylvania' })).toBeVisible();
    // the campaign's own tabs are the phone's: here the side carries them
    await expect(page.getByRole('navigation', { name: 'Campaign' })).toBeHidden();
    await nav.getByRole('button', { name: 'Open Warbands' }).click();
    await expect(nav.getByRole('link', { name: 'The Silver Caravan' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Account' })).toBeVisible();
    await noSideScroll(page);
    await shot(page, `${theme}-side-nav`);
    await sections.getByRole('link', { name: 'Manage' }).click();
    await expect(page.getByRole('heading', { name: 'Waiting for a leader' })).toBeVisible();
  });
}

test('on a desktop the warbands and the members stand side by side', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const srv = await playServer(page);
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others });
  await page.goto(`campaign/${c.id}`);
  const warbands = page.getByRole('heading', { name: 'Warbands' });
  const members = page.getByRole('heading', { name: 'Members' });
  await expect(warbands).toBeVisible();
  const [a, b] = [await warbands.boundingBox(), await members.boundingBox()];
  expect(Math.abs(a!.y - b!.y)).toBeLessThan(4);
  expect(b!.x).toBeGreaterThan(a!.x + 200);
  await shot(page, 'campaign-desktop');
});

/* The game night (phase 4a2). */
for (const theme of ['chronicle', 'parchment'] as const) {
  test(`the game night: a leader writes the protocol, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page, true, { totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [others[0]!, { ...others[1]!, pending: false }] });
    await page.goto(`campaign/${c.id}`);
    await page.getByRole('button', { name: 'New battle' }).click();
    const setup = page.getByRole('dialog', { name: 'Battle 1' });
    await setup.getByLabel('Title (optional)').fill('Hel Fenn ferry');
    await tapTargets(page);
    await shot(page, `${theme}-battle-new`);
    await setup.getByRole('button', { name: 'Start the game night' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Battle 1 · Hel Fenn ferry' })).toBeVisible();
    await page.getByRole('button', { name: 'Next turn' }).click();
    await page.getByRole('button', { name: '+ Casualty' }).click();
    const cas = page.getByRole('dialog', { name: 'Out of action · turn 2' });
    await cas.getByRole('combobox', { name: 'Warband' }).first().selectOption({ label: 'The Grey Penitents' });
    await cas.getByRole('combobox', { name: 'Who' }).selectOption({ index: 2 });
    await cas.getByRole('combobox', { name: 'Warband' }).nth(1).selectOption({ label: 'Clan Skrittle' });
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-battle-casualty`);
    await cas.getByRole('button', { name: 'Add to the protocol' }).click();
    await page.getByRole('button', { name: '+ Event' }).click();
    const ev = page.getByRole('dialog', { name: 'Event · turn 2' });
    await ev.getByLabel('What happened', { exact: true }).fill('The ferry drifts towards the Stir.');
    await ev.getByRole('button', { name: 'Add to the protocol' }).click();
    await expect(page.getByRole('list', { name: 'Protocol' }).getByRole('listitem')).toHaveCount(2);
    await expect.poll(() => [...srv.state.battles.values()][0]!.entries.length, { timeout: 8000 }).toBe(2);
    await page.getByLabel('Outcome for The Grey Penitents').selectOption('victory');
    await expect(page.getByText('Outcome saved.')).toBeVisible();
    // the version that goes in: a leader confirms Anna's warband, and the comparison starts
    await expect(page.getByText('Version not confirmed yet').first()).toBeVisible();
    await page.getByRole('button', { name: 'Confirm for Anna' }).click();
    await expect(page.getByText(/✓ Version 1 goes in · confirmed by/)).toBeVisible();
    await expect(page.getByRole('list', { name: 'Before and after' })).toContainText('before: version 1');
    // full screen on the phone: no navigation, the buttons for one hand instead
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-game-night`);
  });
}

test('the game night without a connection: entered here, sent when back', async ({ page, context }) => {
  const srv = await playServer(page, true, { totp: true });
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [others[0]!, { ...others[1]!, pending: false }] });
  const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
  await page.goto(`campaign/${c.id}/battles/${b.id}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Battle 1 · Hel Fenn ferry' })).toBeVisible();
  srv.state.down = true;
  await context.setOffline(true);
  await page.getByRole('button', { name: '+ Event' }).click();
  const ev = page.getByRole('dialog', { name: 'Event · turn 1' });
  await ev.getByLabel('What happened', { exact: true }).fill('A building collapses on the quay.');
  await ev.getByRole('button', { name: 'Add to the protocol' }).click();
  await expect(page.getByText('No connection.', { exact: false })).toBeVisible();
  await expect(page.getByText('⏳ 1 waiting')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Protocol' })).toContainText('on this phone');
  await noSideScroll(page);
  await shot(page, 'game-night-offline');
  srv.state.down = false;
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => b.entries.length, { timeout: 15000 }).toBe(1);
  await expect(page.getByText('⏳ 1 waiting')).toBeHidden({ timeout: 10000 });
});

test('a player at the game night sees the protocol and suggests a correction', async ({ page }) => {
  const srv = await playServer(page);
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: [{ ...others[0]!, role: 'leader' }, { ...others[1]!, pending: false }] });
  const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
  srv.entryElsewhere(b.id, { id: '11111111-1111-4111-8111-111111111111', turn: 2, kind: 'event', payload: { text: 'Rain over the Stir.' }, author: 'Anna' });
  await page.goto(`campaign/${c.id}/battles/${b.id}`);
  await page.getByRole('list', { name: 'Protocol' }).getByRole('button', { name: 'Suggest a correction' }).click();
  await page.getByLabel('What should it say?').fill('It was snow, not rain.');
  await page.getByRole('button', { name: 'Send to the leader' }).click();
  await expect(page.getByRole('list', { name: 'Corrections' })).toContainText('It was snow, not rain.');
  await expect.poll(() => b.proposals.length, { timeout: 8000 }).toBe(1);
  // what another leader's device writes appears within seconds
  srv.entryElsewhere(b.id, { id: '22222222-2222-4222-8222-222222222222', turn: 3, kind: 'event', payload: { text: 'The ferry drifts.' }, author: 'Anna' });
  await expect(page.getByRole('list', { name: 'Protocol' })).toContainText('The ferry drifts.', { timeout: 10000 });
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'game-night-player');
});

/* Notes (phase 4a3). */
for (const theme of ['chronicle', 'parchment'] as const) {
  test(`the Notes tab: who can read a note, chosen when writing, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page, true, { totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [others[0]!, { ...others[1]!, pending: false }] });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    srv.noteFrom(c.id, { author: 'Ben', text: 'Skritch goes for the captain.', battleId: b.id, visibility: 'sealed' });
    srv.noteFrom(c.id, { author: 'Anna', text: 'Brother Anselm passes his fear test on a double one.', battleId: b.id, turn: 3, kind: 'dice' });
    srv.noteFrom(c.id, { author: 'Anna', text: 'The ferryman is in the Countess’s pay.', battleId: b.id, visibility: 'leader' });
    await page.goto(`campaign/${c.id}/notes`);
    await expect(page.getByText('This note is sealed. It opens for everyone when battle 1 is closed.')).toBeVisible();
    await page.getByRole('button', { name: 'New note' }).click();
    const sheet = page.getByRole('dialog', { name: 'A note' });
    await sheet.getByLabel('What happened').fill('Ulrich means to cut the ferry rope once the rats are aboard.');
    await sheet.getByRole('radio', { name: /Sealed until/ }).check();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-note-new`);
    await sheet.getByRole('button', { name: 'Save the note' }).click();
    await expect(page.getByRole('region', { name: 'Battle 1 · Hel Fenn ferry' }).getByText('Ulrich means to cut the ferry rope once the rats are aboard.')).toBeVisible();
    await expect.poll(() => [...srv.state.notes.values()].filter((n) => n.author === 'Kai').length, { timeout: 8000 }).toBe(1);
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-notes`);
  });
}

/* The background (phase 4b1): the leaders' side of the story, and what a player is sent of it. */
for (const theme of ['chronicle', 'parchment'] as const) {
  test(`the Background tab: threads, the truth behind them, revealing a note, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page, true, { totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [others[0]!, { ...others[1]!, pending: false }] });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    srv.backgroundFrom(c.id, { title: 'Who pays the ferryman?', truth: 'Countess Adelheid von Rauch pays the ferrymen’s guild to row warbands into ambushes. She wants the Hel Fenn wyrdstone for her own alchemists.', playersKnow: 'Skritch was paid in advance. The coin carries the eel of the ferrymen’s guild.', status: 'active', reveal: 'hint', hintLimits: 'Traces yes – the Countess’s name never.', battleId: b.id });
    srv.backgroundFrom(c.id, { title: 'The bell of St. Voss', truth: 'The bell tolls for whoever carries the reliquary. The Grey Penitents carry it without knowing.' });
    srv.backgroundFrom(c.id, { title: 'Skritch’s debt', truth: 'Skritch owed the clan a warlock engineer; he paid with Nibble’s tail.', status: 'resolved', reveal: 'revealed' });
    await page.goto(`campaign/${c.id}/background`);
    await expect(page.getByText('Only campaign leaders see this area.', { exact: false })).toBeVisible();
    const list = page.getByRole('list', { name: 'Threads' });
    await expect(list.getByRole('listitem')).toHaveCount(3);
    await expect(page.getByRole('link', { name: 'Background ⚑' })).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-background`);

    await list.getByRole('listitem').filter({ hasText: 'Who pays the ferryman?' }).getByRole('button', { name: 'Reveal…' }).click();
    const sheet = page.getByRole('dialog', { name: 'Reveal to everyone' });
    await sheet.getByLabel('Public note').fill('The ferryman did not come back for the Caravan. Someone had paid him not to.');
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-background-reveal`);
    await sheet.getByRole('button', { name: 'Reveal to everyone' }).click();
    await expect.poll(() => [...srv.state.notes.values()].filter((n) => n.visibility === 'public').length, { timeout: 8000 }).toBe(1);
    await expect(page.getByText(/Revealed as a public note in/)).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
  });
}

/* Questions to players (phase 4b3a): a leader asks, a player finds the question under "Open for you" and answers. */
for (const theme of ['chronicle', 'parchment'] as const) {
  test(`questions: a leader asks one player, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page, true, { totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [others[0]!, { ...others[1]!, pending: false }] });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    await page.goto(`campaign/${c.id}/questions`);
    await expect(page.getByRole('heading', { name: 'Questions to players' })).toBeVisible();
    await expect(page.getByText('No questions yet.')).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-questions-empty`);

    await page.getByRole('button', { name: 'Ask a question' }).click();
    const sheet = page.getByRole('dialog', { name: 'Ask a question' });
    await sheet.getByLabel('To').selectOption('user-anna');
    await sheet.getByLabel('About').selectOption(b.id);
    await sheet.getByLabel('Question').fill('How did Robba spend the night after the ferry? Who paid for the rooms, and what did the landlord say?');
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-questions-ask`);
    await sheet.getByRole('button', { name: 'Ask', exact: true }).click();
    const list = page.getByRole('list', { name: 'Questions' });
    await expect(list.getByText('To Anna')).toBeVisible();
    await expect(list.getByText('How did Robba spend the night', { exact: false })).toBeVisible();
    await expect.poll(() => srv.state.questions.size, { timeout: 8000 }).toBe(1);
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-questions`);
  });

  test(`questions: a player finds it under Open for you and answers, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page);
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    srv.questionFrom(c.id, { text: 'How did Robba spend the night after the ferry? Who paid for the rooms, and what did the landlord say?', battleId: b.id });
    await page.goto('./');
    const open = page.getByRole('list', { name: 'Open for you' });
    await expect(open.getByRole('link', { name: /Question from Anna/ })).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-home-open`);
    await open.getByRole('link', { name: /Question from Anna/ }).click();
    await expect(page.getByRole('heading', { name: 'Questions for you' })).toBeVisible();
    await page.getByRole('button', { name: 'Answer' }).click();
    const sheet = page.getByRole('dialog', { name: 'Answer' });
    await expect(sheet.getByLabel(/Sealed until/)).toBeVisible();
    await sheet.getByLabel('Your answer').fill('In the Three Crows, losing at dice. The landlord said nothing; he had been paid.');
    await sheet.getByLabel(/Sealed until/).check();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-questions-answer`);
    await sheet.getByRole('button', { name: 'Answer', exact: true }).click();
    await expect(page.getByText('Answered. Your note is in Notes.')).toBeVisible();
    await expect.poll(() => [...srv.state.notes.values()].filter((n) => n.visibility === 'sealed').length, { timeout: 8000 }).toBe(1);
    await expect(page.getByRole('list', { name: 'Questions' }).getByText('Answered', { exact: true })).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-questions-answered`);
  });
}

/* The world (phase 4b3b): factions, the people around them and the reputation log – a leader writes, a player reads. */
for (const theme of ['chronicle', 'parchment'] as const) {
  test(`the World tab: a leader adds a faction and records reputation, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page, true, { totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [others[0]!, { ...others[1]!, pending: false }] });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    const f = srv.factionFrom(c.id, { nameEn: 'The Ferrymen', nameDe: 'Die Fährleute', publicStatus: 'hold the Stir crossing, and every coin that passes it' });
    srv.npcFrom(c.id, { nameEn: 'Old Marek', nameDe: 'Der alte Marek', factionId: f.id, publicStatus: 'alive', statlineTts: 'M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7\n• Knows every shoal of the Stir' });
    srv.reputationFrom(c.id, { warbandId: c.enrolments[0]!.warbandId, factionId: f.id, delta: 2, reason: 'Escorted the barge through the fog.', battleId: b.id });
    await page.goto(`campaign/${c.id}/world`);
    await expect(page.getByRole('heading', { name: 'The world' })).toBeVisible();
    const card = page.getByRole('article', { name: 'The Ferrymen' });
    await expect(card.getByText('Old Marek')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Reputation log' })).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-world`);

    await page.getByRole('button', { name: 'Record reputation' }).click();
    const sheet = page.getByRole('dialog', { name: 'Record reputation' });
    await sheet.getByLabel('Warband').selectOption({ label: 'Clan Skrittle · Ben' });
    await sheet.getByLabel('Loses reputation').check();
    await sheet.getByLabel('By how much (1–100)').fill('3');
    await sheet.getByLabel('Why').fill('Sank the ferryman’s skiff and let the crew swim.');
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-world-record`);
    await sheet.getByRole('button', { name: 'Record', exact: true }).click();
    await expect(page.getByText('Reputation recorded.')).toBeVisible();
    await expect.poll(() => srv.state.reputation.size, { timeout: 8000 }).toBe(2);
    await expect(page.getByRole('list', { name: 'Standing with The Ferrymen' }).getByText('−3')).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-world-after`);

    await page.getByRole('button', { name: 'Add an NPC' }).click();
    const npc = page.getByRole('dialog', { name: 'Add an NPC' });
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-world-npc`);
    await npc.getByRole('button', { name: 'Cancel' }).click();
  });

  test(`the World tab: a player reads it, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page);
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others });
    const f = srv.factionFrom(c.id, { nameEn: 'The Ferrymen', nameDe: 'Die Fährleute', publicStatus: 'hold the Stir crossing' });
    srv.npcFrom(c.id, { nameEn: 'Old Marek', factionId: f.id, publicStatus: 'alive', statlineTts: 'M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7' });
    srv.reputationFrom(c.id, { warbandId: c.enrolments[0]!.warbandId, factionId: f.id, delta: 2, reason: 'Escorted the barge through the fog.' });
    await page.goto(`campaign/${c.id}`);
    await page.getByRole('link', { name: 'World' }).click();
    await expect(page.getByRole('article', { name: 'The Ferrymen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add a faction' })).toHaveCount(0);
    await page.getByText('Statline').click();
    await expect(page.getByText('M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7')).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-world-player`);
  });
}

/* Scenarios (phase 4b3c): a leaders' draft, released to a battle for everybody – a leader writes and releases, a player reads the played ones. */
for (const theme of ['chronicle', 'parchment'] as const) {
  test(`the Scenarios section: a leader writes a draft and releases it to a battle, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page, true, { totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [others[0]!, { ...others[1]!, pending: false }] });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    srv.scenarioFrom(c.id, { title: 'Fog on the Stir', body: 'Fog covers the table: no shooting beyond 8".\nThe ferry is a bridge: two models wide.', npcStatlines: 'Old Marek M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7', battleId: b.id });
    await page.goto(`campaign/${c.id}/world`);
    await expect(page.getByRole('heading', { name: 'Scenarios' })).toBeVisible();
    await expect(page.getByRole('article', { name: 'Fog on the Stir' })).toBeVisible();
    await page.getByRole('button', { name: 'Write a scenario' }).click();
    const form = page.getByRole('dialog', { name: 'Write a scenario' });
    await form.getByLabel('Title').fill('The night at the ferry');
    await form.getByLabel('Rules').fill('The Countess’s men wait on the far bank. They deploy hidden; a model that comes within 6" reveals them.');
    await form.getByLabel('NPC statlines (optional)').fill('Captain Brandt M4 WS4 BS3 S3 T3 W1 I4 A1 Ld8\n• Cannot be ambushed');
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-scenario-write`);
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Draft saved. Only leaders see it.')).toBeVisible();
    const draft = page.getByRole('article', { name: 'Draft: The night at the ferry' });
    await expect(draft.getByText('⚑ Draft – only leaders read it')).toBeVisible();
    await expect.poll(() => srv.state.scenarios.size, { timeout: 8000 }).toBe(2);
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-scenarios`);

    await draft.getByRole('button', { name: 'Release The night at the ferry to a battle' }).click();
    const release = page.getByRole('dialog', { name: 'Release The night at the ferry' });
    await release.getByLabel('Played in').selectOption({ label: 'Battle 1 · Hel Fenn ferry' });
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-scenario-release`);
    await release.getByRole('button', { name: 'Release', exact: true }).click();
    await expect(page.getByText('Released. Everybody in the campaign reads it now.')).toBeVisible();
    await expect(page.getByRole('article', { name: 'The night at the ferry' })).toBeVisible();
    await expect.poll(() => [...srv.state.scenarios.values()].filter((x) => x.visibility === 'public').length, { timeout: 8000 }).toBe(2);
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-scenarios-released`);
  });

  test(`the Scenarios section: a player reads the played ones, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page);
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    srv.scenarioFrom(c.id, { title: 'ZEBRA the ambush', body: 'ZEBRA' });
    srv.scenarioFrom(c.id, { title: 'Fog on the Stir', body: 'Fog covers the table: no shooting beyond 8".', npcStatlines: 'Old Marek M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7', battleId: b.id });
    await page.goto(`campaign/${c.id}`);
    await page.getByRole('link', { name: 'World' }).click();
    const card = page.getByRole('article', { name: 'Fog on the Stir' });
    await expect(card).toBeVisible();
    await expect(card.getByText(/Played in Battle 1 · Hel Fenn ferry/)).toBeVisible();
    await card.getByText('Rules').click();
    await expect(card.getByText('Fog covers the table: no shooting beyond 8".')).toBeVisible();
    await expect(page.getByText(/ZEBRA/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Write a scenario' })).toHaveCount(0);
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-scenarios-player`);
  });
}

test('View as player shows what the server gives a player', async ({ page }) => {
  const srv = await playServer(page, true, { totp: true });
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [others[0]!, { ...others[1]!, pending: false }] });
  const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
  srv.noteFrom(c.id, { author: 'Anna', text: 'The ferryman is in the Countess’s pay.', battleId: b.id, visibility: 'leader' });
  srv.noteFrom(c.id, { author: 'Ben', text: 'Skritch goes for the captain.', battleId: b.id, visibility: 'sealed' });
  srv.noteFrom(c.id, { author: 'Ben', text: 'The rain will not stop.', battleId: b.id });
  await page.goto(`campaign/${c.id}/notes`);
  await expect(page.getByText('The ferryman is in the Countess’s pay.')).toBeVisible();
  await page.getByRole('link', { name: 'View as player' }).click();
  await expect(page.getByText('The rain will not stop.')).toBeVisible();
  await expect(page.getByText('This is what a player gets from the server', { exact: false })).toBeVisible();
  await expect(page.getByText(/Countess/)).toHaveCount(0);
  await expect(page.getByText(/Skritch goes/)).toHaveCount(0);
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'notes-as-player');
});

test('notes and quotes at the game night, in the protocol by turn', async ({ page }) => {
  const srv = await playServer(page);
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: [{ ...others[0]!, role: 'leader' }, { ...others[1]!, pending: false }] });
  const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
  b.turn = 3;
  srv.entryElsewhere(b.id, { id: '11111111-1111-4111-8111-111111111111', turn: 2, kind: 'event', payload: { text: 'The ferry drifts.' }, author: 'Anna' });
  await page.goto(`campaign/${c.id}/battles/${b.id}`);
  await page.getByRole('button', { name: '+ Quote' }).click();
  const q = page.getByRole('dialog', { name: 'A quote · turn 3' });
  await expect(q.getByLabel('Who says it?').locator('option')).not.toHaveCount(1);
  await q.getByLabel('Who says it?').selectOption({ index: 1 });
  await q.getByLabel('What was said').fill('Bolt the doors. Whatever knocks tonight is not a customer.');
  await tapTargets(page);
  await shot(page, 'game-night-quote');
  await q.getByRole('button', { name: 'Save the note' }).click();
  await page.getByRole('button', { name: '+ Note' }).click();
  const n = page.getByRole('dialog', { name: 'A note · turn 3' });
  await n.getByLabel('Kind').selectOption('scene');
  await n.getByLabel('What happened').fill('Ulrich holds the gangway alone.');
  await n.getByRole('button', { name: 'Save the note' }).click();
  const protocol = page.getByRole('list', { name: 'Protocol' });
  await expect(protocol.getByRole('listitem')).toHaveCount(3);
  await expect(protocol.getByRole('listitem').last()).toContainText('The ferry drifts.');
  await expect.poll(() => srv.state.notes.size, { timeout: 8000 }).toBe(2);
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'game-night-notes');
});

/* After the battle (phase 4a4): the leader closes it, the player takes it
   over into the warband, goes through the post-battle sequence and marks it;
   the campaign moves on. */
async function battleFought(page: Parameters<typeof playServer>[0]) {
  const srv = await playServer(page, true, { totp: true });
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [others[0]!, { ...others[1]!, pending: false }] });
  const mine = crypto.randomUUID();
  srv.handle('POST', `/campaigns/${c.id}/enrolments`, new URLSearchParams(), { warbandId: mine, data: { ...SAVE, name: 'The Silver Caravan' } });
  const skrittle = c.enrolments.find((e) => e.name === 'Clan Skrittle')!.warbandId;
  const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry', warbandIds: [mine, skrittle] });
  b.participants[0]!.outcome = 'victory';
  b.participants[1]!.outcome = 'defeat';
  srv.entryElsewhere(b.id, { id: '11111111-1111-4111-8111-111111111111', turn: 2, kind: 'casualty', author: 'Kai',
    payload: { victim: { warbandId: mine, uid: 3, idx: 0, name: 'Magda', grade: 'hero', wb: 'merc' }, attacker: { warbandId: skrittle, uid: null, name: 'Clan Skrittle' }, note: 'on the gangway' } });
  srv.entryElsewhere(b.id, { id: '22222222-2222-4222-8222-222222222222', turn: 4, kind: 'casualty', author: 'Kai',
    payload: { victim: { warbandId: skrittle, uid: null, name: 'Clan Skrittle' }, attacker: { warbandId: mine, uid: 2, idx: 0, name: 'Ulrich the Grey', grade: 'hero', wb: 'merc' }, note: '' } });
  return { srv, c, b, mine };
}

test('after the battle: the leader closes it, the player takes it over, goes through the steps and marks it', async ({ page }) => {
  const { srv, c, b, mine } = await battleFought(page);
  await page.goto(`campaign/${c.id}/battles/${b.id}`);
  await page.getByRole('button', { name: 'Close the battle…' }).click();
  const close = page.getByRole('dialog', { name: 'Close Battle 1 · Hel Fenn ferry?' });
  await tapTargets(page);
  await shot(page, 'battle-close');
  await close.getByRole('button', { name: 'Close the battle' }).click();
  await expect(page.getByText(/This battle is closed: its protocol is fixed/)).toBeVisible();
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'battle-closed');
  await page.getByRole('link', { name: 'Your aftermath →' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'After battle 1' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'From the protocol' })).toContainText('Magda (The Silver Caravan) out of action – by someone of Clan Skrittle.');
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'aftermath-take');
  await page.getByRole('button', { name: 'Take it over' }).click();

  // injuries
  const casualties = page.getByRole('list', { name: 'Casualties' });
  await casualties.getByRole('button', { name: 'Roll' }).click();
  const roll = page.getByRole('dialog', { name: 'Serious injury · Magda' });
  await roll.getByLabel('D66 as rolled').fill('45');
  await roll.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Nothing left to roll.')).toBeVisible();
  await page.getByRole('button', { name: 'Done – next step' }).click();
  // experience
  await page.getByRole('button', { name: 'Grant the battle’s experience' }).click();
  await expect(page.getByRole('list', { name: 'Experience held' })).toContainText('Ulrich the Grey +1');
  await page.getByRole('button', { name: 'Write it onto the roster' }).click();
  await page.getByRole('button', { name: 'Done – next step' }).click();
  // exploration: two shards found
  await page.getByRole('button', { name: 'One shard more' }).click();
  await page.getByRole('button', { name: 'One shard more' }).click();
  await page.getByRole('button', { name: 'Done – next step' }).click();
  // wyrdstone
  await page.getByRole('button', { name: /^Sell for \d+ gc$/ }).click();
  await expect(page.getByText(/✓ Sold 2 shards for \d+ gc/)).toBeVisible();
  await expect(page.getByRole('list', { name: 'Changes' })).toContainText('Ulrich the Grey');
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'aftermath-steps');

  await page.getByRole('button', { name: 'Looks right – mark after battle 1' }).click();
  await expect(page.getByText(/✓ Marked after battle 1 – version 2/)).toBeVisible({ timeout: 10000 });
  const e = c.enrolments.find((x) => x.warbandId === mine)!;
  expect(e.tag).toMatchObject({ kind: 'after_battle', rev: 2, battleId: b.id });
  expect(e.tag!.changes!.map((x) => x.kind)).toEqual(expect.arrayContaining(['experience', 'gold']));
  expect(srv.state.warbands.get(mine)!.headRev).toBe(2);
  await shot(page, 'aftermath-marked');

  // on a desktop the sequence and what changed stand side by side
  await page.setViewportSize({ width: 1280, height: 900 });
  const steps = await page.getByRole('heading', { level: 2, name: 'After the battle' }).boundingBox();
  const changed = await page.getByRole('heading', { level: 2, name: 'What changed' }).boundingBox();
  expect(changed!.x).toBeGreaterThan(steps!.x + 200);
  await shot(page, 'aftermath-desktop');
});

test('the aftermath in parchment', async ({ page }) => {
  await useTheme(page, 'parchment');
  const { c, b, mine } = await battleFought(page);
  b.status = 'closed';
  await page.goto(`campaign/${c.id}`);
  await expect(page.getByRole('region', { name: 'Open for you' })).toBeVisible();
  await page.goto(`warbands/${mine}/aftermath/${b.id}`);
  await page.getByRole('button', { name: 'Take it over' }).click();
  await expect(page.getByRole('list', { name: 'Casualties' })).toContainText('Magda was put out of action');
  await noSideScroll(page);
  await shot(page, 'parchment-aftermath');
});

test('the campaign after the battle: open for each player, and a leader moves it on', async ({ page }) => {
  const { c, b } = await battleFought(page);
  b.status = 'closed';
  await page.goto(`campaign/${c.id}`);
  const open = page.getByRole('region', { name: 'Open for you' });
  await expect(open.getByRole('link')).toContainText('Battle 1 · Hel Fenn ferry · The Silver Caravan');
  await expect(page.getByRole('list', { name: 'Battles' })).toContainText('closed · 0/2 marked');
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'campaign-open-for-you');
  await page.getByRole('link', { name: 'Manage' }).click();
  await expect(page.getByText(/The Grey Penitents fought none/)).toBeVisible();
  await page.getByRole('button', { name: 'Move on to After battle 1' }).click();
  await expect(page.getByText('On to After battle 1.')).toBeVisible();
  // no battle of round 2 yet: the button says so by looking disabled too – grey, not the accent (docs/ui.md §5)
  const next = page.getByRole('button', { name: 'Move on to After battle 2' });
  await expect(next).toBeDisabled();
  const look = await next.evaluate((el) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--accent)';
    document.body.append(probe);
    const accent = getComputedStyle(probe).color;
    probe.remove();
    const s = getComputedStyle(el);
    return { background: s.backgroundColor, accent, cursor: s.cursor };
  });
  expect(look.background).not.toBe(look.accent);
  expect(look.cursor).toBe('not-allowed');
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'campaign-next-round');
  await page.getByRole('link', { name: 'Overview' }).click();
  await expect(page.getByRole('list', { name: 'Warbands' })).toContainText('Sat out battle 1');
});

/* The campaign's house rules and the districts (phase 4a4, part 2). */
async function enteredCampaign(page: Parameters<typeof playServer>[0], o: { totp?: boolean } = {}) {
  const srv = await playServer(page, true, o);
  const skrittle = { ...SAVE, name: 'Clan Skrittle', campaign: { ...(SAVE.campaign as object), districts: { artisanquarter: 'foothold', richquarter: 'foothold' } } };
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: o.totp ? 'leader' : 'player', others: [{ ...others[0]!, role: 'leader', data: { ...SAVE, name: 'The Grey Penitents', house: { priceArmour: 80 } } }, { player: 'Ben', data: skrittle }] });
  const mine = crypto.randomUUID();
  srv.handle('POST', `/campaigns/${c.id}/enrolments`, new URLSearchParams(), { warbandId: mine, data: { ...SAVE, name: 'The Silver Caravan' } });
  return { srv, c, mine };
}

test('the campaign’s house rules: a leader sets them; a warband whose file differs takes them over', async ({ page }) => {
  const { c, mine } = await enteredCampaign(page, { totp: true });
  await page.goto(`campaign/${c.id}/manage`);
  await page.getByRole('link', { name: 'Set the house rules' }).click();
  await page.getByRole('checkbox', { name: 'All daggers free' }).check();
  await expect(page.getByRole('list', { name: 'Warbands that differ' })).toContainText('The Silver Caravan (Kai): All daggers free');
  await expect.poll(() => c.houseRules?.freeDagger).toBe(true);
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'campaign-house-rules');

  await page.goto(`warbands/${mine}`);
  await page.getByRole('link', { name: '⚠ House rules differ from the campaign’s' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'own file differs' })).toContainText('All daggers free');
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'warband-house-in-campaign');
  await page.getByRole('button', { name: 'Take The Hel Fenn Campaign’s rules' }).click();
  await expect(page.getByText(/own file differs/)).toBeHidden();
});

test('the districts: set by hand beside the others’ footholds; the campaign’s map', async ({ page }) => {
  await useTheme(page, 'parchment');
  const { c, mine } = await enteredCampaign(page);
  await page.goto(`campaign/${c.id}`);
  await expect(page.getByRole('list', { name: 'Districts held' })).toContainText('Artisan QuarterClan Skrittlecontrol');
  await shot(page, 'parchment-campaign-map');
  await page.goto(`warbands/${mine}`);
  await page.getByRole('link', { name: 'Districts' }).click();
  const artisan = page.getByRole('group', { name: 'Artisan Quarter' });
  await artisan.getByRole('button', { name: 'Foothold' }).click();
  await expect(artisan.getByRole('button', { name: 'Foothold' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Also a foothold here: Clan Skrittle').first()).toBeVisible();
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'parchment-warband-districts');
});

/* Pictures (phase 4a3, part 2): a real picture, made smaller by the browser. */

/** A 960×540 PNG – a dusk sky over a dark street, as a TTS screenshot might be. */
function screenshotPng(): Buffer {
  const w = 960, h = 540;
  const rows = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    rows[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      const ground = y > h * 0.62 + Math.sin(x / 37) * 18;
      rows[o] = ground ? 30 : 90 + Math.round((y / h) * 120);
      rows[o + 1] = ground ? 26 : 60 + Math.round((x / w) * 40);
      rows[o + 2] = ground ? 34 : 110 - Math.round((y / h) * 60);
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

test('a picture at the game night and among the notes: made smaller here, shown from the server', async ({ page }) => {
  const srv = await playServer(page, true, { totp: true });
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [others[0]!, { ...others[1]!, pending: false }] });
  const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
  await page.goto(`campaign/${c.id}/battles/${b.id}`);
  await page.getByRole('button', { name: 'Next turn' }).click();
  await page.getByRole('button', { name: '+ Picture' }).click();
  const sheet = page.getByRole('dialog', { name: 'A picture · turn 2' });
  await sheet.getByLabel('Screenshot or photo').setInputFiles({ name: 'tts-turn-2.png', mimeType: 'image/png', buffer: screenshotPng() });
  await expect(sheet.getByText(/960 × 540 · \d+ KB · only the pixels leave this phone/)).toBeVisible();
  await sheet.getByLabel('Caption (optional)').fill('Turn two: the ferry from above.');
  await tapTargets(page);
  await shot(page, 'picture-new');
  await sheet.getByRole('button', { name: 'Save the picture' }).click();
  await expect.poll(() => [...srv.state.pictures.values()].map((p) => [p.stored, p.mime, p.width, p.turn])).toEqual([[true, 'image/webp', 960, 2]]);
  const pic = [...srv.state.pictures.values()][0]!;
  // what arrived is a WebP made here, not the file picked
  expect(Buffer.from(pic.data!).subarray(8, 12).toString('latin1')).toBe('WEBP');
  const img = page.getByRole('list', { name: 'Protocol' }).getByRole('img', { name: 'Turn two: the ferry from above.' });
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(960);
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'game-night-picture');
  await page.goto(`campaign/${c.id}/notes`);
  await expect(page.getByRole('region', { name: 'Battle 1 · Hel Fenn ferry' }).getByRole('img', { name: 'Turn two: the ferry from above.' })).toBeVisible();
  await noSideScroll(page);
  await shot(page, 'notes-picture');
});

/* The timeline (phase 4a3, part 2). */
for (const theme of ['chronicle', 'parchment'] as const) {
  test(`the timeline: the story in its order, a block moved, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page);
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: [{ ...others[0]!, role: 'leader' }, { ...others[1]!, pending: false }] });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    b.participants[0]!.outcome = 'victory';
    b.participants[1]!.outcome = 'defeat';
    srv.entryElsewhere(b.id, { id: '11111111-1111-4111-8111-111111111111', turn: 3, kind: 'event', payload: { text: 'The ferry burns and drifts towards the Stir.' }, author: 'Anna' });
    srv.state.notes.set('0000000a-0000-4000-8000-000000000000', { id: '0000000a-0000-4000-8000-000000000000', campaignId: c.id, battleId: b.id, turn: 2, authorId: 'u1', author: 'Kai', kind: 'quote', text: 'Bolt the doors. Whatever knocks tonight is not a customer.', visibility: 'public', mentions: [], createdAt: '2026-10-04T12:00:30.000Z', updatedAt: '2026-10-04T12:00:30.000Z', seq: ++srv.state.seq });
    srv.noteFrom(c.id, { author: 'Anna', text: 'Brother Anselm sets the mill wheel on fire to smoke the rats out of the cellar.', battleId: b.id, turn: 4, kind: 'scene' });
    b.status = 'closed';
    b.closedAt = '2026-10-04T13:00:00.000Z';
    await page.goto(`campaign/${c.id}/timeline`);
    const course = page.getByRole('listitem', { name: 'Battle 1 · Hel Fenn ferry · course' });
    await expect(course).toContainText('Bolt the doors');
    await page.getByRole('button', { name: /^Move up: Bolt the doors/ }).click();
    await expect.poll(() => [...srv.state.positions.values()].map((p) => p.segment)).toEqual([`b${b.id}:before`]);
    await expect(page.getByRole('listitem', { name: 'Battle 1 · Hel Fenn ferry · before' })).toContainText('Bolt the doors');
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-timeline`);
  });
}

/* Taking over a running campaign (phase 4a5): its battles before the app. */
test('the history: a leader records a battle before the app; the warband that fought it takes the campaign’s stage', async ({ page }) => {
  const { c, mine } = await enteredCampaign(page, { totp: true });
  await page.goto(`campaign/${c.id}/manage`);
  await page.getByRole('button', { name: '+ A battle before the app' }).click();
  const sheet = page.getByRole('dialog', { name: 'New battle before the app' });
  await sheet.getByLabel('Title (optional)').fill('Das Urteil im Nebel');
  await sheet.getByRole('combobox', { name: 'District' }).selectOption('quayside');
  await sheet.getByLabel('Played on (optional)').fill('2026-06-12');
  await sheet.getByRole('combobox', { name: /The Silver Caravan/ }).selectOption('routed');
  await sheet.getByRole('combobox', { name: /Clan Skrittle/ }).selectOption('victory');
  await sheet.getByRole('combobox', { name: /The Grey Penitents/ }).selectOption('-');
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'campaign-history-new');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Battle 1 · Das Urteil im Nebel is in the history.')).toBeVisible();
  await expect(page.getByText(/After battle 1 · you are leader/)).toBeVisible();
  await expect(page.getByRole('list', { name: 'Battles before the app' })).toContainText('12 June 2026 · Clan Skrittle · The Silver Caravan');
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'campaign-history');

  await page.goto(`campaign/${c.id}`);
  await expect(page.getByRole('list', { name: 'Battles' }).getByRole('link')).toContainText('before the app');
  await expect(page.getByRole('heading', { name: 'Open for you' })).toHaveCount(0);
  await page.getByRole('list', { name: 'Battles' }).getByRole('link').click();
  await expect(page.getByText('Played before the app, on 12 June 2026', { exact: false })).toBeVisible();
  await noSideScroll(page);
  await shot(page, 'battle-before-the-app');

  await page.goto(`warbands/${mine}`);
  const flag = page.getByRole('status').filter({ hasText: 'fought before the app' });
  await expect(flag).toContainText('its own stage is Setup');
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'warband-campaign-stage');
  await flag.getByRole('button', { name: 'Take the campaign’s stage' }).click();
  await expect(page.getByText('Stage: After battle 1, as the campaign.')).toBeVisible();
  await expect(page.getByText(/· After battle 1/).first()).toBeVisible();

  await page.goto(`campaign/${c.id}/timeline`);
  const past = page.getByRole('listitem', { name: 'Battle 1 · Das Urteil im Nebel · before the app' });
  await expect(past).toContainText('Clan Skrittle: Victory');
  await expect(page.getByRole('listitem', { name: 'Interlude 1' })).toContainText('Entered after battle 1 · The Silver Caravan');
  await noSideScroll(page);
  await shot(page, 'timeline-history');
});

/* The chronicle's published chapters in the timeline (phase 4a5, part 2). */
const chapterFile = (name: string, front: string, body: string) => ({ name, mimeType: 'text/markdown', buffer: Buffer.from(`---\n${front}\n---\n\n${body}\n`) });
const PROSE_DE = '### Am Kai\n\nQuayside war einst das schlagende Herz des Handels von Mordheim gewesen – jene lange Reihe von Kais und Lagerhäusern am Ufer des Stir. Nun lagen die Anlegestege gebrochen im Wasser, und über allem stand noch ein Ladekran aus schwarzem Eichenholz.\n\n**Ottilie**, Robbas Lehrling und alles andere als eine geübte Klinge, rang den Great Crest **Wonton** zu Boden, ehe sie selbst überwältigt wurde.\n\n---\n\nDie Kinder des Sotek zogen sich zurück in den Nebel, aus dem sie gekommen waren.';
const PROSE_EN = '### At the Quay\n\nQuayside had once been the beating heart of Mordheim’s trade – the long row of quays and warehouses along the Stir. Now the landing stages lay broken in the water, and above it all still stood a crane of black oak.\n\n**Ottilie**, Robba’s apprentice and anything but a practised blade, wrestled the Great Crest **Wonton** to the ground before she was overwhelmed herself.';

for (const theme of ['chronicle', 'parchment'] as const) {
  test(`the chronicle's chapters: a leader imports them, everyone reads them, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const { srv, c } = await enteredCampaign(page, { totp: true });
    const [gp, sk] = c.enrolments.map((e) => e.warbandId) as [string, string];
    srv.pastBattle(c.id, { round: 1, title: 'Das Urteil im Nebel', district: 'quayside', outcomes: { [gp]: 'routed', [sk]: 'victory' } });
    await page.goto(`campaign/${c.id}/timeline`);
    await page.getByRole('button', { name: 'Import chapters…' }).click();
    const sheet = page.getByRole('dialog', { name: 'Import chapters' });
    await sheet.getByLabel('Chapter files').setInputFiles([
      chapterFile('2026-06-01-auf-fluegeln-aus-feuer.md', 'ref: "prolog"\nkind: "prologue"\ntitle: "Auf Flügeln aus Feuer"\nchapter: "Prolog"\ndate: 2026-06-01', 'Der Komet fiel, und die Stadt brannte. Drei Warbands machten sich auf den Weg.'),
      chapterFile('2026-06-14-das-urteil-im-nebel.md', 'ref: "battle-1"\ntitle: "Das Urteil im Nebel"\nchapter: "Erste Schlacht"\nic_date: "Frühes Jahr 2000 IC"\nplace: "Quayside, Mordheim"\nvictor: >-\n  Das Feld blieb den Reavers – die Karawane wich\n  mit ihren Waren in den Nebel.\ndate: 2026-06-14', PROSE_DE),
      chapterFile('2026-06-14-the-verdict-in-the-fog.md', 'ref: "battle-1"\ntitle: "The Verdict in the Fog"\nchapter: "First Battle"\nic_date: "Early 2000 IC"\nplace: "Quayside, Mordheim"\ndate: 2026-06-14', PROSE_EN),
      chapterFile('2026-06-21-der-nebel-hebt-sich.md', 'ref: "interlude-1"\nkind: "interlude"\ntitle: "Der Nebel hebt sich"\nchapter: "Zwischenspiel"\ndate: 2026-06-21', 'Die Tage danach waren still, und der Regen hielt an.'),
    ]);
    await expect(sheet.getByRole('list', { name: 'Chapters to import' }).getByRole('listitem')).toHaveCount(3);
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-chapters-import`);
    await sheet.getByRole('button', { name: 'Import 3 chapters' }).click();
    await expect(page.getByText('3 chapters imported.')).toBeVisible();
    const past = page.getByRole('listitem', { name: 'Battle 1 · Das Urteil im Nebel · before the app' });
    await expect(past).toContainText('Chapter · Erste Schlacht · Frühes Jahr 2000 IC · Quayside, Mordheim');
    await expect(page.getByRole('listitem', { name: 'Before the campaign' })).toContainText('Auf Flügeln aus Feuer');
    await expect(page.getByRole('listitem', { name: 'Interlude 1' })).toContainText('Der Nebel hebt sich');
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-timeline-chapters`);
    await page.getByRole('button', { name: 'Read Das Urteil im Nebel in Deutsch' }).click();
    const reader = page.getByRole('dialog', { name: 'Das Urteil im Nebel' });
    await expect(reader.getByRole('heading', { name: 'Am Kai' })).toBeVisible();
    await expect(reader.getByText('Das Feld blieb den Reavers – die Karawane wich mit ihren Waren in den Nebel.')).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-chapter-read`);
    await reader.getByRole('button', { name: 'English' }).click();
    await expect(page.getByRole('dialog', { name: 'The Verdict in the Fog' }).getByRole('heading', { name: 'At the Quay' })).toBeVisible();
  });
}

/* Chapters as drafts (phase 4b5b): a leader brings a chapter in, is warned of hidden words, publishes it. */
const DRAFT_DE = 'Gerhard Voss wartete am Steg, die Münze mit dem Aal in der Hand.\n\nDie Aalmünze glänzte nass. Der Nebel stieg über der Stir, und niemand sprach ein Wort.';

for (const theme of ['chronicle', 'parchment'] as const) {
  test(`chapter drafts: a leader brings one in, is warned of hidden words and publishes it, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page, true, { totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others });
    const b = srv.addBattle(c.id, { title: 'City Hall' });
    b.status = 'closed';
    b.closedAt = '2026-10-04T13:00:00.000Z';
    srv.backgroundFrom(c.id, { kind: 'figure', title: 'The ferryman', truth: 'Gerhard Voss ferries the Countess across the Stir. He kills witnesses.', playersKnow: 'A ferryman takes coin.', status: 'active', reveal: 'hidden' });
    srv.backgroundFrom(c.id, { kind: 'thread', title: 'Aalmünze', truth: 'Die Gräfin bezahlt die Fährleute mit einer Aalmünze.', playersKnow: 'Eine Münze mit einem Aal.', status: 'active', reveal: 'hint', hintLimits: 'a coin, an eel, wet money' });
    await page.goto(`campaign/${c.id}/chronicle`);
    await expect(page.getByRole('heading', { name: /Drafts/ })).toBeVisible();
    await expect(page.getByText('No draft yet.')).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-drafts-empty`);

    // bring one in from a file: the front matter fills the form, the check runs as it is read
    await page.getByRole('button', { name: 'Bring in a chapter' }).click();
    const form = page.getByRole('dialog', { name: 'Bring in a chapter' });
    await form.getByLabel('From a file (optional)').setInputFiles(chapterFile('2026-10-12-das-rathaus.md', 'ref: "battle-1"\ntitle: "Das Rathaus"\nchapter: "Erste Schlacht"\nlang: "de"', DRAFT_DE));
    await expect(form.getByLabel('Title')).toHaveValue('Das Rathaus');
    await expect(form.getByRole('list', { name: 'Words of the hidden background' })).toContainText('Gerhard');
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-drafts-form`);
    await form.getByRole('button', { name: 'Save the draft' }).click();
    const list = page.getByRole('list', { name: 'Drafts' });
    await expect(list.getByRole('listitem')).toHaveCount(1);
    await expect(page.getByRole('list', { name: 'Chapters' }).getByRole('listitem')).toHaveCount(0);
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-drafts-list`);

    // review: the words found, what a hint may say; publishing needs the leader's knowing yes
    await page.getByRole('button', { name: 'Review Das Rathaus' }).click();
    const review = page.getByRole('dialog', { name: 'Das Rathaus' });
    await expect(review.getByRole('list', { name: 'Words of the hidden background' })).toContainText('Allowed: a coin, an eel, wet money');
    const publish = review.getByRole('button', { name: 'Publish anyway' });
    await expect(publish).toBeDisabled();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-drafts-review`);
    await review.getByLabel('I have read the places above and publish anyway').check();
    await expect(publish).toBeEnabled();
    await publish.click();
    await expect(page.getByText('“Das Rathaus” is published in Deutsch. Everyone in the campaign can read it now.')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Chapters' }).getByRole('listitem')).toHaveCount(1);
    await expect(list.getByRole('listitem')).toHaveCount(0);
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-drafts-published`);
  });
}

/* The AI pack and the style guide (phase 4b4a): a leader's prompt for whoever writes the next chapter, and the style it carries. */
function packScene(srv: Awaited<ReturnType<typeof playServer>>) {
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [others[0]!, { ...others[1]!, pending: false }] });
  const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
  b.participants[0]!.outcome = 'victory';
  b.participants[1]!.outcome = 'defeat';
  srv.entryElsewhere(b.id, { id: '11111111-1111-4111-8111-111111111111', turn: 3, kind: 'event', payload: { text: 'The ferry burns.' }, author: 'Anna' });
  srv.noteFrom(c.id, { author: 'Kai', text: 'Bolt the doors.', battleId: b.id, turn: 2, kind: 'quote' });
  srv.noteFrom(c.id, { author: 'Kai', text: 'LEADER-ONLY plan: the ferryman turns on them.', battleId: b.id, turn: 5, kind: 'general', visibility: 'leader' });
  b.status = 'closed';
  b.closedAt = '2026-10-04T13:00:00.000Z';
  const e = c.enrolments[0]!;
  e.tags = [...(e.tags ?? []), {
    id: 'tag-anna-1', kind: 'after_battle', rev: 1, round: b.round, battleId: b.id, totals: { rating: 1, spent: 0, models: 3, heroes: 1, gold: 0, fallen: 0 }, createdBy: 'Anna', createdAt: '2026-10-04T14:00:00.000Z',
    changes: [{ kind: 'died', uid: 77, name: 'Hans', changeKey: '1:died:hans', payload: { hero: true }, eventRef: null, unexplained: true }],
  }];
  srv.backgroundFrom(c.id, { kind: 'figure', title: 'The Pale Man', truth: 'He is the ferryman’s brother.', status: 'active', reveal: 'hidden' });
  srv.backgroundFrom(c.id, { kind: 'thread', title: 'The eel coin', truth: 'The Countess pays the ferrymen.', status: 'active', reveal: 'hint', hintLimits: 'a coin, an eel, wet money' });
  srv.styleFrom(c.id, 'German, past tense, close third person.\nNo dice, no game terms.');
  return c;
}

for (const theme of ['chronicle', 'parchment'] as const) {
  test(`the AI pack: a leader chooses the parts and the language and copies the prompt, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page, true, { totp: true });
    const c = packScene(srv);
    await page.goto(`campaign/${c.id}/timeline`);
    const open = page.getByRole('button', { name: 'AI pack…' });
    await expect(open).toBeEnabled();
    await open.click();
    const sheet = page.getByRole('dialog', { name: 'AI pack' });
    const prompt = sheet.getByLabel('The prompt, as it will be copied');
    await expect(prompt).toHaveValue(/Bolt the doors\./);
    await expect(prompt).toHaveValue(/Rule: HIDDEN/);
    await expect(prompt).not.toHaveValue(/LEADER-ONLY/);
    await expect(sheet.getByRole('list', { name: 'Gaps in the material' })).toContainText('Clan Skrittle has not been marked after this battle');
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-ai-pack`);
    await sheet.getByRole('radio', { name: 'English' }).check();
    await expect(prompt).toHaveValue(/Write the chapter in English\./);
    await sheet.getByRole('checkbox', { name: /^Style/ }).uncheck();
    await expect(prompt).not.toHaveValue(/close third person/);
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-ai-pack-english`);
    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(sheet).toBeHidden();
  });

  test(`the style guide: a leader writes it under Manage, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page, true, { totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others });
    await page.goto(`campaign/${c.id}/manage`);
    await expect(page.getByRole('heading', { name: 'Style guide ⚑' })).toBeVisible();
    const box = page.getByLabel('Instructions for the writer');
    await expect(box).toBeEnabled();
    await box.fill('German, past tense, close third person.\nNo dice, no game terms.');
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-style-guide`);
    await page.getByRole('button', { name: 'Save the style' }).click();
    await expect(page.getByText('Style guide saved.')).toBeVisible();
    await expect.poll(() => srv.state.styles.get(c.id)?.text, { timeout: 8000 }).toMatch(/close third person/);
  });

  test(`the canon export: a leader downloads the names for the linter under Manage, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page, true, { totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [{ ...others[0]!, data: { ...SAVE, name: 'The Grey Penitents', canon: { name_de: 'Die Grauen Büßer', name_en: 'The Grey Penitents' } } }, { ...others[1]!, pending: false }] });
    const ferry = srv.factionFrom(c.id, { nameEn: 'The Ferrymen', nameDe: 'Die Fährleute', publicStatus: 'hold the crossing' });
    srv.npcFrom(c.id, { nameEn: 'Old Marek', nameDe: 'Alter Marek', factionId: ferry.id, publicStatus: 'alive' });
    await page.goto(`campaign/${c.id}/manage`);
    await expect(page.getByRole('heading', { name: 'Canon for the linter' })).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download the canon (.txt)' }).click()]);
    expect(file.suggestedFilename()).toBe('the-hel-fenn-campaign-canon.txt');
    await expect(page.getByText(/^Saved \d+ names?: /)).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-canon-export`);
  });
}

/* The Chronicle tab (phase 4b5a): the whole story as written, read chapter by chapter in either language, downloaded as one file. */
for (const theme of ['chronicle', 'parchment'] as const) {
  test(`the Chronicle tab: a player reads the story and downloads it, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page);
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others });
    const b = srv.addBattle(c.id, { title: 'City Hall' });
    b.status = 'closed';
    b.closedAt = '2026-10-04T13:00:00.000Z';
    const lang = (label: string, title: string, text: string, o: { icDate?: string; place?: string; victor?: string } = {}) => ({ label, title, icDate: '', place: '', victor: '', ...o, text });
    const put = (id: string, refKey: string, kind: string, day: string, de: ReturnType<typeof lang> | null, en: ReturnType<typeof lang> | null, segment: string) => {
      srv.state.chapters.set(id, { id, campaignId: c.id, refKey, kind, publishedOn: day, createdAt: '2026-10-09T10:00:00.000Z', updatedAt: '2026-10-09T10:00:00.000Z', de, en });
      srv.state.positions.set(`chapter:${id}`, { campaignId: c.id, itemType: 'chapter', itemId: id, segment, pos: '05', movedBy: 'u2', movedAt: '2026-10-09T10:00:00.000Z' });
    };
    put('0000000c-0000-4000-8000-000000000001', 'prolog', 'prologue', '2026-06-01', lang('Prolog', 'Der Weg nach Mordheim', 'Der Regen hatte die Straße nach Mordheim in einen Bach aus Lehm verwandelt, als **Ulrich der Graue** seine Leute zum letzten Mal zählte.\n\nSieben. Mehr waren es nicht.'), lang('Prologue', 'The road to Mordheim', 'The rain had turned the road to mud.'), 'pre');
    put('0000000c-0000-4000-8000-000000000002', 'battle-1', 'battle', '2026-06-08', lang('Kapitel 1', 'Das Rathaus', 'Das Rathaus stand noch, wenn man es so nennen wollte.', { icDate: '3. Nachgeheim', place: 'Mordheim', victor: 'Die Silberne Karavane' }), null, `b${b.id}:battle`);
    await page.goto(`campaign/${c.id}/chronicle`);
    await expect(page.getByRole('list', { name: 'Chapters' }).getByRole('listitem')).toHaveCount(2);
    await page.getByRole('button', { name: 'Read Der Weg nach Mordheim' }).click();
    await expect(page.getByText('Sieben. Mehr waren es nicht.')).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-chronicle`);
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByText('The rain had turned the road to mud.')).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-chronicle-english`);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download all (.md)' }).click();
    expect((await download).suggestedFilename()).toBe('the-hel-fenn-campaign-chronicle-en.md');
    await expect(page.getByText(/Saved 2 chapters as a \.md file/)).toBeVisible();
  });
}
