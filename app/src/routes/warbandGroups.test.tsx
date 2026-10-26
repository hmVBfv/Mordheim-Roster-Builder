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
    await user.click(within(sheet).getByRole('button', { name: 'Remove Imperial bands' }));
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
