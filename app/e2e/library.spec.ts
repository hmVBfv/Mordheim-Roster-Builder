/* The Library at 360 px and on a desktop (ADR 0023): the entry in the navigation, an idea written and read, both
   themes. Campaign app only (playwright.config.ts), against the stand-in server (e2e/play.ts). */
import { expect, test } from '@playwright/test';
import { noSideScroll, shot, tapTargets, useTheme } from './helpers.ts';
import { playServer } from './play.ts';

for (const theme of ['chronicle', 'parchment'] as const) {
  test(`an idea is written in the Library and read again, in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    const srv = await playServer(page);
    srv.libraryFrom({ name: 'The ferrymen of the Stir', body: { text: 'A war band that knows every ford. They smuggle for the Countess.', topic: 'warband' } });
    await page.goto('./');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Library' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Library' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Ideas' }).getByText('The ferrymen of the Stir')).toBeVisible();
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-library-ideas`);

    await page.getByRole('button', { name: 'New idea' }).click();
    const sheet = page.getByRole('dialog', { name: 'A new idea' });
    await sheet.getByLabel('Title').fill('A faction of bell-ringers');
    await sheet.getByLabel('About').selectOption('faction');
    await sheet.getByLabel('The idea').fill('Monks who ring the bells of the drowned quarter and know what the water hides.');
    await noSideScroll(page);
    await tapTargets(page);
    await shot(page, `${theme}-library-idea-form`);
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('list', { name: 'Ideas' }).getByText('A faction of bell-ringers')).toBeVisible();
    await expect.poll(() => [...srv.state.library.values()].filter((i) => !i.deletedAt).length).toBe(2);
    await noSideScroll(page);
  });
}

test('the Library on a wide screen: its tabs stand in the side navigation, the ideas side by side', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const srv = await playServer(page);
  for (const name of ['The ferrymen', 'The bell-ringers', 'The tallow-makers']) srv.libraryFrom({ name, body: { text: `${name}: a thought for later.`, topic: 'faction' } });
  await page.goto('library');
  await expect(page).toHaveURL(/\/library\/ideas$/);
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Ideas' })).toBeVisible();
  // the tabs on top are for the phone
  await expect(page.getByRole('navigation', { name: 'Library' })).toBeHidden();
  const cards = page.getByRole('list', { name: 'Ideas' }).getByRole('listitem');
  await expect(cards).toHaveCount(3);
  const [a, b] = await Promise.all([cards.nth(0).boundingBox(), cards.nth(1).boundingBox()]);
  expect(Math.round(a!.y)).toBe(Math.round(b!.y));
  await shot(page, 'library-ideas-desktop');
});

test('a faction is written in the Library, taken into a campaign and given to a warrior', async ({ page }) => {
  const srv = await playServer(page);
  await page.goto('library/factions');
  await expect(page.getByText(/No factions yet/)).toBeVisible();
  await page.getByRole('button', { name: 'New faction' }).click();
  const sheet = page.getByRole('dialog', { name: 'A new faction' });
  await sheet.getByLabel('Name (English)').fill('The Bell-ringers');
  await sheet.getByLabel('Name (German)').fill('Die Glockenläuter');
  await sheet.getByLabel('What the players may read').fill('Known in the drowned quarter');
  await sheet.getByLabel('The lore').fill('Monks who ring the bells of the drowned quarter and know what the water hides.');
  await noSideScroll(page);
  await tapTargets(page);
  await shot(page, 'library-faction-form');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('list', { name: 'Factions' }).getByText('The Bell-ringers')).toBeVisible();
  await noSideScroll(page);
  await shot(page, 'library-factions');
  expect([...srv.state.library.values()].filter((i) => !i.deletedAt && i.kind === 'faction')).toHaveLength(1);
});
