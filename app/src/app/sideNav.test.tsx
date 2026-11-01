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
  /* Wish #94 (Rob, 26.10.2026): the name in the corner of the header is a way back to Home. */
  it('the app name in the header leads to Home', async () => {
    const user = userEvent.setup();
    at('/warbands');
    const header = screen.getByRole('banner');
    await user.click(within(header).getByRole('link', { name: 'Mordheim Campaign' }));
    expect(await screen.findByRole('heading', { name: 'Your warbands' })).toBeTruthy();
  });

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

  /* Wish #91 (Rob, 26.10.2026): planners and the warbands of a campaign are kept apart in the list and have a place of their own under Warbands. */
  it('Warbands also names the kinds apart – planners, the warbands in a campaign – as places to jump to, only where there are such', async () => {
    wide(true);
    await seed('w1', 'The Silver Caravan', '2026-09-28T10:00:00.000Z');
    at('/warbands');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const none = await waitForList(nav, 'nav-warbands');
    await vi.waitFor(() => expect(within(none).getAllByRole('link').map((a) => a.textContent)).toEqual(['The Silver Caravan', '+ New warband']));
    cleanup();
    const plan = { ...sampleSave(), name: 'The Late Company', planner: true };
    await db.warbands.add({ id: 'p1', name: 'The Late Company', wb: plan.wb as string, wbName: 'Mercenaries', state: plan, format: 1, createdAt: NOW, updatedAt: '2026-09-28T12:00:00.000Z' });
    const inCamp = { ...sampleSave(), name: 'The Field Company' };
    await db.warbands.add({ id: 'c1', name: 'The Field Company', wb: inCamp.wb as string, wbName: 'Mercenaries', state: inCamp, format: 1, createdAt: NOW, updatedAt: '2026-09-28T09:00:00.000Z', campaignId: 'camp-1' });
    at('/warbands');
    const nav2 = screen.getByRole('navigation', { name: 'Main' });
    const sub = await waitForList(nav2, 'nav-warbands');
    await vi.waitFor(() => expect(within(sub).getByRole('link', { name: 'Planners' })).toBeTruthy());
    expect(within(sub).getByRole('link', { name: 'Planners' }).getAttribute('href')).toBe('/warbands?show=planners');
    expect(within(sub).getByRole('link', { name: 'In campaigns' }).getAttribute('href')).toBe('/warbands?show=campaigns');
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

  it('the admin has Admin, which opens into the admin tools; a player has no such entry', async () => {
    wide(true);
    const srv = createFakeSync({ me: { id: KAI.id, username: KAI.username, displayName: KAI.displayName } });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost/');
      const path = url.pathname.replace(/^\/api\/v1/, '');
      if (path === '/auth/me') return new Response(JSON.stringify({ user: { ...KAI, isAdmin: true, totp: true }, pending: false }), { headers: { 'content-type': 'application/json' } });
      if (path.startsWith('/admin/')) return new Response(JSON.stringify({ users: [], invites: [], attempts: [], entries: [] }), { headers: { 'content-type': 'application/json' } });
      return srv.handle(init?.method ?? 'GET', path, url.searchParams, {});
    }));
    signedIn({ stage: 'full', user: { ...KAI, isAdmin: true, totp: true } });
    const user = userEvent.setup();
    at('/admin/users');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const entry = await within(nav).findByRole('link', { name: 'Admin' });
    expect(entry.getAttribute('href')).toBe('/admin');
    const list = await waitForList(nav, 'nav-admin');
    expect(within(list).getAllByRole('link').map((a) => a.textContent)).toEqual(['Users', 'Invites', 'Sign-ins', 'Audit log', 'Reports']);
    await user.click(within(nav).getByRole('button', { name: 'Close Admin' }));
    expect(nav.querySelector('#nav-admin')).toBeNull();
  });

  it('Library opens into its tabs, for whoever is signed in', async () => {
    wide(true);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), 'http://localhost/').pathname.replace(/^\/api\/v1/, '');
      const body = path === '/auth/me' ? { user: KAI, pending: false } : { items: [], seq: 0 };
      return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
    }));
    signedIn({ stage: 'full', user: KAI });
    const user = userEvent.setup();
    at('/library/ideas');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect((await within(nav).findByRole('link', { name: 'Library' })).getAttribute('href')).toBe('/library');
    const list = await waitForList(nav, 'nav-library');
    expect(within(list).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([['Ideas', '/library/ideas'], ['Factions', '/library/factions'], ['NPCs', '/library/npcs'], ['Groups', '/library/groups'], ['Scenarios', '/library/scenarios'], ['Locations', '/library/locations'], ['Lore', '/library/lore']]);
    await user.click(within(nav).getByRole('button', { name: 'Close Library' }));
    expect(nav.querySelector('#nav-library')).toBeNull();
  });

  /* Report of 1.11.2026: offline the navigation had no Library. The server cannot be reached, but the person is known on this device,
     and the Library is read from the device: it stays where it was. Admin works on the server only: it goes. */
  it('keeps Library in the navigation when the server cannot be reached, and leaves Admin out: it needs the server', async () => {
    wide(true);
    localStorage.setItem('mordheim-me', JSON.stringify({ ...KAI, isAdmin: true, totp: true }));
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    at('/home');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect((await within(nav).findByRole('link', { name: 'Library' })).getAttribute('href')).toBe('/library');
    expect(within(nav).queryByRole('link', { name: 'Admin' })).toBeNull();
  });

  it('shows no Library where nobody is known', async () => {
    wide(true);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    at('/home');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    await within(nav).findByRole('link', { name: 'Home' });
    expect(within(nav).queryByRole('link', { name: 'Library' })).toBeNull();
  });

  it('Account opens into the settings and Your reports', async () => {
    wide(true);
    signedIn({ stage: 'full', user: KAI });
    const user = userEvent.setup();
    at('/account/reports');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const list = await waitForList(nav, 'nav-account');
    expect(within(list).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([['Settings', '/account'], ['Your reports', '/account/reports']]);
    await user.click(within(nav).getByRole('button', { name: 'Close Account' }));
    expect(nav.querySelector('#nav-account')).toBeNull();
  });

  it('a player has no Admin entry', async () => {
    wide(true);
    signedIn({ stage: 'full', user: KAI });
    at('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).queryByRole('link', { name: 'Admin' })).toBeNull();
  });

  it('a phone keeps its four entries, the last one the account', async () => {
    wide(false);
    await seed('w1', 'The Silver Caravan');
    at('/warbands/w1');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Home', 'Warbands', 'Campaign', 'Account']);
    expect(within(nav).queryByRole('button')).toBeNull();
  });
});

async function waitForList(nav: HTMLElement, id: string): Promise<HTMLElement> {
  await vi.waitFor(() => expect(nav.querySelector(`#${id}`)).not.toBeNull());
  return nav.querySelector<HTMLElement>(`#${id}`)!;
}
