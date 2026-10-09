/* Campaigns (phase 4a1) in the built campaign app, against the stand-in
   server (e2e/play.ts): the overview, another player's warband to read,
   entering a warband, what a leader manages, starting a campaign. Campaign
   app only (playwright.config.ts). */
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
