/* Wish of 8.11.2026: "What's new" is a tab under Account – Settings, Your reports, What's new – and no longer a button hidden at the foot of
   Settings; Rules moved to the Library. */
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { resetSession, signedIn } from '../account/session.ts';
import { ME as KAI } from '../account/testServer.ts';
import { AppRoutes } from '../app/App.tsx';
import { db } from '../db/db.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';
import { ENTRIES } from './entries.ts';

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
afterEach(async () => { cleanup(); resetSession(); vi.unstubAllGlobals(); await db.warbands.clear(); await db.meta.clear(); });

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
function signIn() {
  const me = { ...KAI };
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ user: me, pending: false }), { headers: { 'content-type': 'application/json' } })));
  signedIn({ stage: 'full', user: me });
}

describe('What\'s new under Account', () => {
  it('is the last tab of Account, and lists the changes of every day', async () => {
    signIn();
    at('/account/whats-new');
    const tabs = await screen.findByRole('navigation', { name: 'Account' });
    expect(within(tabs).getAllByRole('link').map((a) => a.textContent)).toEqual(['Settings', 'Your reports', "What's new"]);
    expect(within(tabs).getByRole('link', { name: "What's new" }).getAttribute('aria-current')).toBe('page');
    expect(await screen.findByText(ENTRIES[0]!.changes[0]!.text)).toBeTruthy();
  });

  it('is no button at the foot of Settings any more, nor is Rules, for a reader who is signed in', async () => {
    signIn();
    at('/account');
    await screen.findByRole('navigation', { name: 'Account' });
    // the header keeps its own button; it is the foot of Settings that has none
    const page = screen.getByRole('heading', { level: 1 }).closest('section') as HTMLElement;
    expect(within(page).queryByRole('button', { name: "What's new" })).toBeNull();
    expect(within(page).queryByRole('link', { name: 'Rules' })).toBeNull();
  });

  it('still leaves a reader who is not signed in the way to both', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ user: null, pending: false }), { headers: { 'content-type': 'application/json' } })));
    at('/account');
    const page = (await screen.findByRole('heading', { level: 1 })).closest('section') as HTMLElement;
    expect(await within(page).findByRole('link', { name: 'Rules' })).toBeTruthy();
    expect(within(page).getByRole('link', { name: 'Rules' }).getAttribute('href')).toBe('/library/rules');
    expect(within(page).getByRole('button', { name: "What's new" })).toBeTruthy();
  });
});
