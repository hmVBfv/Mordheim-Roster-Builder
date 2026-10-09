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
  // no battle of round 2 yet: the button says so by looking disabled too
  const next = page.getByRole('button', { name: 'Move on to After battle 2' });
  await expect(next).toBeDisabled();
  expect(Number(await next.evaluate((el) => getComputedStyle(el).opacity))).toBeLessThan(1);
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
