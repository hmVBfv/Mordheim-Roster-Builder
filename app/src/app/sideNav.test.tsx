/* The side navigation from tablet width on (Rob, 19.10.2026): Warbands and
   Campaign open into their entries – one's newest warbands, one's campaigns,
   and under the campaign one is in its sections – and close again; the last
   entry is the account, not three dots. A phone keeps the five entries. */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSession, signedIn } from '../account/session.ts';
import { ME as KAI } from '../account/testServer.ts';
import { db } from '../db/db.ts';
import { createFakeSync } from '../sync/fakeSync.ts';
import { stopSync } from '../sync/runner.ts';
import { data, sampleSave } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';
import { AppRoutes } from './App.tsx';

const NOW = '2026-09-28T10:00:00.000Z';
const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);

/** A screen as wide as a desktop: the side navigation is there. */
function wide(on: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: on && q.includes('min-width: 900px'), media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
}

async function seed(id: string, name: string, at = NOW) {
  const s = { ...sampleSave(), name };
  await db.warbands.add({ id, name, wb: s.wb as string, wbName: data.WARBANDS[s.wb as string]!.name, state: s, format: 1, createdAt: at, updatedAt: at });
}

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); localStorage.clear(); });
afterEach(() => { cleanup(); stopSync(); resetSession(); vi.unstubAllGlobals(); });

describe('the side navigation', () => {
  it('Warbands opens into one’s newest warbands and a new one, and closes again; the choice stays on the device', async () => {
    wide(true);
    await seed('w1', 'The Silver Caravan', '2026-09-28T10:00:00.000Z');
    await seed('w2', 'The Grey Company', '2026-09-28T11:00:00.000Z');
    const user = userEvent.setup();
    at('/warbands/w1');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    // inside the section the group is open: the newest first, then a new one
    const sub = await waitForList(nav, 'nav-warbands');
    await vi.waitFor(() => expect(within(sub).getAllByRole('link').map((a) => a.textContent)).toEqual(['The Grey Company', 'The Silver Caravan', '+ New warband']));
    expect(within(sub).getByRole('link', { name: 'The Silver Caravan' }).getAttribute('aria-current')).toBe('page');
    await user.click(within(nav).getByRole('button', { name: 'Close Warbands' }));
    expect(nav.querySelector('#nav-warbands')).toBeNull();
    expect(JSON.parse(localStorage.getItem('mordheim-nav-open')!)).toEqual({ warbands: false });
    await user.click(within(nav).getByRole('button', { name: 'Open Warbands' }));
    expect(nav.querySelector('#nav-warbands')).not.toBeNull();
  });

  it('Campaign lists one’s campaigns, and under the one that is open its sections', async () => {
    wide(true);
    const srv = createFakeSync({ me: { id: KAI.id, username: KAI.username, displayName: KAI.displayName } });
    const me = { ...KAI, totp: true };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost/');
      const path = url.pathname.replace(/^\/api\/v1/, '');
      if (path === '/auth/me') return new Response(JSON.stringify({ user: me, pending: false }), { headers: { 'content-type': 'application/json' } });
      return srv.handle(init?.method ?? 'GET', path, url.searchParams, init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {});
    }));
    signedIn({ stage: 'full', user: me });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign' });
    srv.addCampaign({ name: 'Summer in Sylvania', role: 'player' });
    at(`/campaign/${c.id}/timeline`);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const sub = await waitForList(nav, 'nav-campaign');
    await vi.waitFor(() => expect(within(sub).getAllByRole('link').map((a) => a.textContent)).toContain('Summer in Sylvania'));
    const sections = await within(sub).findByRole('list', { name: 'The Hel Fenn Campaign: sections' });
    expect(within(sections).getAllByRole('link').map((a) => a.textContent)).toEqual(['Overview', 'Warbands', 'Notes', 'Timeline', 'Chronicle', 'World', 'Questions', 'Background ⚑', 'Manage']);
    expect(within(sections).getByRole('link', { name: 'Timeline' }).getAttribute('aria-current')).toBe('page');
    // the other campaign shows no sections until it is the open one
    expect(within(sub).queryByRole('list', { name: 'Summer in Sylvania: sections' })).toBeNull();
  });

  it('a phone keeps its five entries, the last one the account', async () => {
    wide(false);
    await seed('w1', 'The Silver Caravan');
    at('/warbands/w1');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Home', 'Warbands', 'Campaign', 'Notes', 'Account']);
    expect(within(nav).queryByRole('button')).toBeNull();
  });
});

async function waitForList(nav: HTMLElement, id: string): Promise<HTMLElement> {
  await vi.waitFor(() => expect(nav.querySelector(`#${id}`)).not.toBeNull());
  return nav.querySelector<HTMLElement>(`#${id}`)!;
}
