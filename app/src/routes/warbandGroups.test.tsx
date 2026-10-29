/* Groups of one's own warbands (wish #10): a person sorts the list into groups of their own and assigns a warband
   with one choice. The groups are Library entries (ADR 0023): private, on the account, read offline. */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSession, signedIn } from '../account/session.ts';
import { ME as KAI } from '../account/testServer.ts';
import { AppRoutes } from '../app/App.tsx';
import { db, type StoredWarband } from '../db/db.ts';
import { createFakeSync } from '../sync/fakeSync.ts';
import { stopSync } from '../sync/runner.ts';
import { sampleSave } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });
afterEach(async () => { cleanup(); stopSync(); resetSession(); localStorage.clear(); vi.unstubAllGlobals(); await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });

const warband = (id: string, name: string): StoredWarband => {
  const s = sampleSave();
  return { id, name, wb: s.wb as string, wbName: 'Mercenaries', state: s, format: 1, createdAt: '2026-10-03T12:00:00.000Z', updatedAt: '2026-10-03T12:00:00.000Z', ownerId: KAI.id };
};

function server() {
  const me = { ...KAI };
  const srv = createFakeSync({ me: { id: KAI.id, username: KAI.username, displayName: KAI.displayName } });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (srv.state.down) throw new TypeError('Failed to fetch');
    const url = new URL(String(input), 'http://localhost/');
    const path = url.pathname.replace(/^\/api\/v1/, '');
    if (path === '/auth/me') return new Response(JSON.stringify({ user: me, pending: false }), { headers: { 'content-type': 'application/json' } });
    return srv.handle(init?.method ?? 'GET', path, url.searchParams, init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {});
  }));
  signedIn({ stage: 'full', user: me });
  return srv;
}
const kept = (srv: ReturnType<typeof server>) => [...srv.state.library.values()].filter((i) => i.kind === 'warband_group' && !i.deletedAt);

const favourites = (srv: ReturnType<typeof server>) => [...srv.state.library.values()].filter((i) => i.kind === 'warband_favourites' && !i.deletedAt);

/* Wish #95 (Rob, 26.10.2026): a warband – a planner too – is marked as a favourite and then stands in a section of its own on top. */
describe('favourite warbands (#95)', () => {
  it('a warband is made a favourite and stands in the section Favourites on top; taken out, the section goes', async () => {
    const srv = server();
    await db.warbands.bulkPut([warband('wb-1', 'The Grey Penitents'), warband('wb-2', 'Clan Skrittle')]);
    const user = userEvent.setup();
    at('/warbands');
    await user.click(await screen.findByRole('button', { name: 'Favourite The Grey Penitents' }, { timeout: 15_000 }));
    await waitFor(() => expect(favourites(srv)).toMatchObject([{ body: { warbands: ['wb-1'] } }]));
    const section = await screen.findByRole('region', { name: 'Favourites' });
    expect(within(section).getByText('The Grey Penitents')).toBeTruthy();
    expect(within(section).queryByText('Clan Skrittle')).toBeNull();
    expect(within(section).getByText(/Favourite$/)).toBeTruthy();
    // it stays in its own place, too; the toggle says what it does next
    const again = screen.getAllByRole('button', { name: 'Take The Grey Penitents out of the favourites' });
    await user.click(again[0]!);
    await waitFor(() => expect(favourites(srv)).toMatchObject([{ body: { warbands: [] } }]));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Favourites' })).toBeNull());
  });

  it('a planner can be a favourite, and carries both marks', async () => {
    const srv = server();
    const planner = warband('wb-2', 'The Late Company');
    planner.state = { ...planner.state, planner: true };
    srv.libraryFrom({ name: 'Favourites', kind: 'warband_favourites', body: { warbands: ['wb-2'] } });
    await db.warbands.bulkPut([planner]);
    at('/warbands');
    const section = await screen.findByRole('region', { name: 'Favourites' }, { timeout: 15_000 });
    const card = within(section).getByText('The Late Company').closest('li')!;
    expect(card.textContent).toContain('Planner');
    expect(card.textContent).toContain('Favourite');
  });
});

/** A screen as wide as a desktop: the side navigation is there. */
function wide() {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('min-width: 900px'), media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
}
const sideLinks = (nav: HTMLElement) => within(nav.querySelector<HTMLElement>('#nav-warbands')!).getAllByRole('link').map((a) => a.textContent);

/* Wishes #92 and #93 (Rob, 26.10.2026): in the side navigation the kinds and the groups stand above the free warbands and do not look
   like warbands; a group carries its warbands, and follows the groups as they change. */
describe('the groups in the side navigation (#92, #93)', () => {
  it('the sections come first, each with its warbands; what is free stands in a section of its own below, then a new one', async () => {
    const srv = server();
    wide();
    srv.libraryFrom({ name: 'Reikland bands', kind: 'warband_group', body: { warbands: ['wb-1'] } });
    const planner = warband('wb-2', 'The Late Company');
    planner.state = { ...planner.state, planner: true };
    await db.warbands.bulkPut([warband('wb-1', 'The Grey Penitents'), planner, { ...warband('wb-3', 'The Field Company'), campaignId: 'camp-1' }, warband('wb-4', 'Clan Skrittle')]);
    at('/warbands');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    await waitFor(() => expect(sideLinks(nav)).toEqual(['Planners', 'The Late Company', 'In campaigns', 'The Field Company', 'Reikland bands', 'The Grey Penitents', 'Free warbands', 'Clan Skrittle', '+ New warband']), { timeout: 15_000 });
    // a section is a place to jump to, a warband under it a page of its own
    const sub = nav.querySelector<HTMLElement>('#nav-warbands')!;
    expect(within(sub).getByRole('link', { name: 'Reikland bands' }).getAttribute('href')).toMatch(/^\/warbands\?show=group-/);
    expect(within(sub).getByRole('link', { name: 'The Grey Penitents' }).getAttribute('href')).toBe('/warbands/wb-1');
  });

  it('a group appears, gains a warband and goes again at once, without a reload', async () => {
    const srv = server();
    wide();
    await db.warbands.bulkPut([warband('wb-1', 'The Grey Penitents')]);
    const user = userEvent.setup();
    at('/warbands');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    await user.click(await screen.findByRole('button', { name: 'Groups' }, { timeout: 15_000 }));
    const sheet = await screen.findByRole('dialog', { name: 'Groups of warbands' });
    await user.type(within(sheet).getByLabelText('Name of the new group'), 'Reikland bands');
    await user.click(within(sheet).getByRole('button', { name: 'Add the group' }));
    await waitFor(() => expect(kept(srv)).toHaveLength(1));
    await waitFor(() => expect(sideLinks(nav)).toContain('Reikland bands'));
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    await user.selectOptions(await screen.findByLabelText('Group of The Grey Penitents'), 'Reikland bands');
    await waitFor(() => expect(sideLinks(nav)).toEqual(['Reikland bands', 'The Grey Penitents', '+ New warband']));
    await user.click(await screen.findByRole('button', { name: 'Groups' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Groups of warbands' })).getByRole('button', { name: 'Remove Reikland bands' }));
    await waitFor(() => expect(sideLinks(nav)).toEqual(['The Grey Penitents', '+ New warband']));
  });
});

describe('the kinds of warband apart (#91)', () => {
  it('a planner and a warband in a campaign stand in sections of their own, not among the free ones; the menu jumps to a section', async () => {
    server();
    const plain = warband('wb-1', 'The Grey Penitents');
    const planner = warband('wb-2', 'The Late Company');
    planner.state = { ...planner.state, planner: true };
    const inCampaign = { ...warband('wb-3', 'The Field Company'), campaignId: 'camp-1' };
    await db.warbands.bulkPut([plain, planner, inCampaign]);
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) { scrolled.push(this.id); };
    at('/warbands?show=campaigns');
    expect(await screen.findByText('The Grey Penitents')).toBeTruthy();
    const planners = screen.getByRole('region', { name: 'Planners' });
    const campaigns = screen.getByRole('region', { name: 'In campaigns' });
    expect(within(planners).getByText('The Late Company')).toBeTruthy();
    expect(within(campaigns).getByText('The Field Company')).toBeTruthy();
    for (const sec of [planners, campaigns]) expect(within(sec).queryByText('The Grey Penitents')).toBeNull();
    expect(within(campaigns).queryByText('The Late Company')).toBeNull();
    // the free warbands are one list, without the other two kinds
    const free = screen.getAllByRole('list').filter((l) => !planners.contains(l) && !campaigns.contains(l));
    const names = free.flatMap((l) => within(l).queryAllByRole('link')).map((a) => a.textContent);
    expect(names.join(' ')).toContain('The Grey Penitents');
    expect(names.join(' ')).not.toContain('The Late Company');
    expect(names.join(' ')).not.toContain('The Field Company');
    await waitFor(() => expect(scrolled).toContain('campaigns-h'));
  });
});

describe('groups of warbands', () => {
  it('a person makes a group, assigns two warbands to it with one choice each, and the list shows them under it', async () => {
    const srv = server();
    await db.warbands.bulkPut([warband('wb-1', 'The Grey Penitents'), warband('wb-2', 'The Silver Caravan'), warband('wb-3', 'Clan Skrittle')]);
    const user = userEvent.setup();
    at('/warbands');
    expect(await screen.findByText('The Grey Penitents')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Not in a group' })).toBeNull(); // no group yet: one plain list

    await user.click(await screen.findByRole('button', { name: 'Groups' }, { timeout: 15_000 }));
    const sheet = await screen.findByRole('dialog', { name: 'Groups of warbands' });
    await user.type(within(sheet).getByLabelText('Name of the new group'), 'Reikland bands');
    await user.click(within(sheet).getByRole('button', { name: 'Add the group' }));
    await waitFor(() => expect(kept(srv)).toMatchObject([{ name: 'Reikland bands', body: { warbands: [] } }]));
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));

    await user.selectOptions(await screen.findByLabelText('Group of The Grey Penitents'), 'Reikland bands');
    await waitFor(() => expect(kept(srv)[0]!.body).toEqual({ warbands: ['wb-1'] }));
    await user.selectOptions(screen.getByLabelText('Group of The Silver Caravan'), 'Reikland bands');
    await waitFor(() => expect(kept(srv)[0]!.body).toEqual({ warbands: ['wb-1', 'wb-2'] }));

    const group = await screen.findByRole('region', { name: 'Reikland bands' });
    expect(within(group).getByText('The Grey Penitents')).toBeTruthy();
    expect(within(group).getByText('The Silver Caravan')).toBeTruthy();
    expect(within(group).queryByText('Clan Skrittle')).toBeNull();
    const rest = screen.getByRole('region', { name: 'Not in a group' });
    expect(within(rest).getByText('Clan Skrittle')).toBeTruthy();
  });

  it('moving a warband to another group takes it out of the first; “No group” takes it out of any', async () => {
    const srv = server();
    srv.libraryFrom({ name: 'Reikland bands', kind: 'warband_group', body: { warbands: ['wb-1'] } });
    srv.libraryFrom({ name: 'Mercenaries', kind: 'warband_group', body: { warbands: [] } });
    await db.warbands.bulkPut([warband('wb-1', 'The Grey Penitents')]);
    const user = userEvent.setup();
    at('/warbands');
    await screen.findByRole('region', { name: 'Reikland bands' }, { timeout: 15_000 }); // the groups have arrived
    await user.selectOptions(screen.getByLabelText('Group of The Grey Penitents'), 'Mercenaries');
    await waitFor(() => expect(Object.fromEntries(kept(srv).map((g) => [g.name, (g.body as { warbands: string[] }).warbands]))).toEqual({ 'Reikland bands': [], Mercenaries: ['wb-1'] }));
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Mercenaries' })).getByText('The Grey Penitents')).toBeTruthy()); // the list shows it moved
    await user.selectOptions(screen.getByLabelText('Group of The Grey Penitents'), 'No group');
    await waitFor(() => expect(Object.fromEntries(kept(srv).map((g) => [g.name, (g.body as { warbands: string[] }).warbands]))).toEqual({ 'Reikland bands': [], Mercenaries: [] }));
  });

  it('renaming and removing a group: the warbands in it stay, ungrouped', async () => {
    const srv = server();
    srv.libraryFrom({ name: 'Reikland bands', kind: 'warband_group', body: { warbands: ['wb-1'] } });
    await db.warbands.bulkPut([warband('wb-1', 'The Grey Penitents')]);
    const user = userEvent.setup();
    at('/warbands');
    await screen.findByRole('region', { name: 'Reikland bands' }, { timeout: 15_000 });
    await user.click(await screen.findByRole('button', { name: 'Groups' }, { timeout: 15_000 }));
    const sheet = await screen.findByRole('dialog', { name: 'Groups of warbands' });
    const name = within(sheet).getByLabelText('Name of Reikland bands');
    await user.clear(name);
    await user.type(name, 'Imperial bands');
    await user.click(within(sheet).getByRole('button', { name: 'Rename Reikland bands' }));
    await waitFor(() => expect(kept(srv)).toMatchObject([{ name: 'Imperial bands', body: { warbands: ['wb-1'] } }]));
    // the sheet takes the rename in a moment after the server has it: wait for its button, not only for the server
    const remove = await within(sheet).findByRole('button', { name: 'Remove Imperial bands' }, { timeout: 15_000 });
    await waitFor(() => expect((remove as HTMLButtonElement).disabled).toBe(false), { timeout: 15_000 });
    await user.click(remove);
    await waitFor(() => expect(kept(srv)).toEqual([]));
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(await screen.findByText('The Grey Penitents')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Imperial bands' })).toBeNull();
  });

  it('nobody signed in: no groups, the list is as it was', async () => {
    await db.warbands.bulkPut([{ ...warband('wb-1', 'The Grey Penitents'), ownerId: undefined }]);
    at('/warbands');
    expect(await screen.findByText('The Grey Penitents')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Groups' })).toBeNull();
    expect(screen.queryByLabelText('Group of The Grey Penitents')).toBeNull();
  });
});
