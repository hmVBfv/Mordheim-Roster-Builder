/* Wish #155 (Rob, 30.10.2026): "What's new" was too hidden. It stands in the header beside "Bug" (a desktop), as a card on Home (a phone),
   and under the notice of an update with the first change in view. */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../app/App.tsx';
import { db } from '../db/db.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';
import { ENTRIES } from './entries.ts';

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
afterEach(async () => { cleanup(); vi.unstubAllGlobals(); await db.warbands.clear(); await db.meta.clear(); });

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const newest = ENTRIES[0]!.changes[0]!.text;

describe('"What\'s new" is easy to find', () => {
  it('stands in the header of every screen, beside the report button, and opens the list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ user: null, pending: false }))));
    const user = userEvent.setup();
    at('/account');
    const header = (await screen.findByRole('banner')) as HTMLElement;
    const button = within(header).getByRole('button', { name: "What's new" });
    // a closed sheet carries nothing: the text of thirty changes is not on every screen, for a search of the page or for a test of what else is there
    expect(document.body.textContent).not.toContain(newest);
    expect(within(header).getByRole('button', { name: 'Report a bug' })).toBeTruthy();
    await user.click(button);
    const sheet = await screen.findByRole('dialog', { name: "What's new", hidden: true });
    expect(sheet.textContent).toContain(newest);
  });

  it('is a card on Home with the newest change in it, and "All changes" opens the list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ user: null, pending: false }))));
    const user = userEvent.setup();
    at('/');
    const card = (await screen.findByRole('region', { name: "What's new" })) as HTMLElement;
    expect(card.textContent).toContain(newest);
    await user.click(within(card).getByRole('button', { name: 'All changes' }));
    const sheet = await screen.findByRole('dialog', { name: "What's new", hidden: true });
    expect(sheet.textContent).toContain(ENTRIES[ENTRIES.length - 1]!.changes[0]!.text);
  });
});
