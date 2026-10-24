/* Problem reports at 360 px (phase 4c1, docs/ui.md checklist): the button in
   the header of every screen, the form with what goes along, the reporter's
   own list under Account, and the admin's reports. Both themes. */
import { expect, test } from '@playwright/test';
import { noSideScroll, shot, tapTargets, useTheme } from './helpers.ts';
import { playServer } from './play.ts';

for (const theme of ['chronicle', 'parchment'] as const) {
  test(`a player reports a problem from the header and follows it under Account, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page);
    await page.goto('more');
    await expect(page.getByRole('heading', { level: 1, name: 'Account' })).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    // the beetle carries its word; the header still fits the title and the sync state at 360 px
    await expect(page.getByRole('button', { name: 'Report a bug' })).toHaveText('Bug');
    await shot(page, `${theme}-bug-button`);
    await page.getByRole('button', { name: 'Report a bug' }).click();
    const form = page.getByRole('dialog', { name: 'Report a problem' });
    await expect(form).toBeVisible();
    await expect(form.getByRole('radio', { name: /Bug/ })).toBeChecked();
    await form.getByLabel(/What did you want to do/).fill('The trading post does not open. I tap Buy and nothing happens.');
    await form.getByText('What goes along').click();
    await expect(form.getByText(/^# Problem report: The trading post does not open\./)).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-report-form`);
    await form.getByRole('button', { name: 'Send' }).click();
    // the sheet is named after what it shows now
    const done = page.getByRole('dialog', { name: 'Sent' });
    await expect(done).toBeVisible();
    await shot(page, `${theme}-report-sent`);
    expect(srv.state.bugs).toHaveLength(1);
    expect(srv.state.bugs[0]).toMatchObject({ kind: 'bug', status: 'new', title: 'The trading post does not open. I tap Buy and nothing happens.' });
    await done.getByRole('button', { name: 'Done' }).click();
    await expect(done).toBeHidden();
    // closing a sheet takes its history entry away with a step back, which is
    // still on its way when the dialog is already gone; a reload now would
    // cancel it ("ERR_ABORTED") or be cancelled by it
    await page.waitForFunction(() => !(history.state as { mordheimSheet?: boolean } | null)?.mordheimSheet);
    // the reports are a tab of their own: the settings do not grow with them
    await expect(page.getByRole('region', { name: 'Your reports' })).toHaveCount(0);
    await page.getByRole('navigation', { name: 'Account' }).getByRole('link', { name: 'Your reports' }).click();
    const table = page.getByRole('table', { name: 'Your reports' });
    await expect(table.getByText('Received')).toBeVisible();
    srv.state.bugs[0]!.status = 'fixed';
    srv.state.bugs[0]!.fixedIn = '3f2a9c1';
    await page.reload();
    await expect(page.getByRole('table', { name: 'Your reports' }).getByText('Fixed in 3f2a9c1')).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-your-reports`);
  });

  test(`Back closes the report sheet and stays in the app, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await playServer(page);
    await page.goto('more');
    await page.getByRole('button', { name: 'Report a bug' }).click();
    const form = page.getByRole('dialog', { name: 'Report a problem' });
    await expect(form).toBeVisible();
    await page.goBack();
    await expect(form).toBeHidden();
    await expect(page.getByRole('heading', { level: 1, name: 'Account' })).toBeVisible();
  });

  test(`the admin reads and sorts the reports, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page, true, { admin: true });
    srv.bugFrom({
      title: 'Gold drifts after the second battle', text: 'After the battle the gold is off by 15.', reporterName: 'Ben', severity: 'S1', area: 'gold ledger', status: 'confirmed',
      context: {
        screen: '/warbands/:id/trade',
        steps: [{ at: '2026-10-17T11:59:00.000Z', kind: 'screen', what: '/warbands/:id', n: 1 }, { at: '2026-10-17T11:59:30.000Z', kind: 'api', what: 'PUT /warbands/:id/autosave → 409 stale', n: 2 }],
        settings: { theme: 'chronicle', flavour: 'campaign', online: true, sync: 'idle, 0 waiting, 0 in conflict', role: null, viewport: '360×740', installed: false }, houseRules: { warband: { heroes: 7 }, campaign: null },
      },
      jsErrors: [{ at: '2026-10-17T11:59:40.000Z', message: 'TypeError: x is undefined', where: 'index.js:1:2' }], warbandId: 'w-9', rev: 2, consent: true, attachment: { name: 'Ben’s Reavers', models: [] },
    });
    srv.bugFrom({ title: 'The tooltip says five', text: 'It should say six.', reporterName: 'Anna', kind: 'rules', sourceRef: 'https://mordheimer.net/example' });
    await page.goto('admin/bugs');
    const table = page.getByRole('table', { name: 'Reports' });
    await expect(table.getByRole('row')).toHaveCount(3);
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-admin-reports`);
    // #67: the mark of an attached warband is a small pill of one line, not a bubble stretched to the height of the title
    const flag = table.getByText('warband attached');
    const pill = (await flag.boundingBox())!;
    const card = (await table.getByRole('row').nth(2).boundingBox())!;
    expect(pill.height).toBeLessThan(32);
    expect(pill.x + pill.width).toBeLessThanOrEqual(card.x + card.width);
    await page.getByRole('button', { name: 'Open: Gold drifts after the second battle' }).click();
    const sheet = page.getByRole('dialog', { name: 'Gold drifts after the second battle' });
    await expect(sheet.getByText('After the battle the gold is off by 15.', { exact: true })).toBeVisible();
    await sheet.getByText('Everything that came with it').click();
    await expect(sheet.getByText(/Attached: the warband w-9, built on version 2/)).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-admin-report-open`);
    await sheet.getByLabel('Status').selectOption('fixed');
    await sheet.getByLabel('Fixed in version').fill('3f2a9c1');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => srv.state.bugs[0]?.status).toBe('fixed');
    expect(srv.state.bugs[0]!.fixedIn).toBe('3f2a9c1');
    // a fixed report leaves the "Open" list: wait for the list to be read again
    await expect(sheet).toBeHidden();
    await expect(table.getByRole('row')).toHaveCount(2);
  });
}
