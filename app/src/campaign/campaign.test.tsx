/* Campaigns as players reach them (phase 4a1): the Campaign tab, starting a
   campaign, the overview, another player's warband to read, entering a
   warband (a copy), what a leader manages, and leaving – against the
   stand-in server (sync/fakeSync.ts). */
import { FORMAT, ctxOf, stageTotals, writeSave } from '@mordheim/core';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSession, signedIn } from '../account/session.ts';
import { ME as KAI } from '../account/testServer.ts';
import { AppRoutes } from '../app/App.tsx';
import { db, type StoredWarband } from '../db/db.ts';
import { newId } from '../db/ids.ts';
import { readSave, syncOnce } from '../sync/engine.ts';
import { createFakeSync } from '../sync/fakeSync.ts';
import { stopSync } from '../sync/runner.ts';
import { data, sampleSave } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const T0 = '2026-10-05T10:00:00.000Z';
const saveOf = (name: string) => writeSave(ctxOf(data, { ...sampleSave(), name }));
const totals = (save: unknown) => stageTotals(ctxOf(data, readSave(data, save)!));
const record = (over: Partial<StoredWarband> = {}): StoredWarband => {
  const s = sampleSave();
  return { id: newId(), name: s.name!, wb: s.wb as string, wbName: 'Mercenaries', state: s, format: FORMAT, createdAt: T0, updatedAt: T0, ownerId: KAI.id, origin: 'save', ...over };
};

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); });
afterEach(async () => { cleanup(); stopSync(); resetSession(); localStorage.clear(); await db.warbands.clear(); await db.meta.clear(); });

/** The stand-in server behind fetch, signed in as Kai (with or without the authenticator). */
function server(o: { totp?: boolean } = {}) {
  const me = { ...KAI, totp: !!o.totp };
  const srv = createFakeSync({ me: { id: KAI.id, username: KAI.username, displayName: KAI.displayName }, totals, wbName: (wb) => data.WARBANDS[wb]?.name ?? wb });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost/');
    const path = url.pathname.replace(/^\/api\/v1/, '');
    if (path === '/auth/me') return new Response(JSON.stringify({ user: me, pending: false }), { headers: { 'content-type': 'application/json' } });
    return srv.handle(init?.method ?? 'GET', path, url.searchParams, init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {});
  }));
  signedIn({ stage: 'full', user: me });
  return srv;
}

describe('the Campaign tab', () => {
  it('without a campaign: starting one needs the authenticator', async () => {
    server();
    at('/campaign');
    expect(await screen.findByText(/You are not part of a campaign yet/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start a campaign' })).toBeNull();
    expect(screen.getByText(/Starting a campaign needs the authenticator/)).toBeTruthy();
  });

  it('with the authenticator a campaign is started, and its starter manages it', async () => {
    const srv = server({ totp: true });
    const user = userEvent.setup();
    at('/campaign');
    await user.click(await screen.findByRole('button', { name: 'Start a campaign' }));
    const sheet = screen.getByRole('dialog', { name: 'Start a campaign' });
    await user.type(within(sheet).getByLabelText('Name of the campaign'), 'The Hel Fenn Campaign');
    await user.click(within(sheet).getByRole('button', { name: 'Start it' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'The Hel Fenn Campaign' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Manage' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('Setup · you are leader')).toBeTruthy();
    expect([...srv.state.campaigns.values()].map((c) => c.name)).toEqual(['The Hel Fenn Campaign']);
  });

  it('several campaigns are listed; a single one opens at once', async () => {
    const srv = server();
    srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player' });
    at('/campaign');
    expect(await screen.findByRole('heading', { level: 1, name: 'The Hel Fenn Campaign' })).toBeTruthy();
    cleanup();
    srv.addCampaign({ name: 'Summer in Sylvania', role: 'viewer', round: 3 });
    at('/campaign');
    const list = await screen.findByRole('list', { name: 'Your campaigns' });
    expect(within(list).getAllByRole('link').map((a) => a.textContent)).toEqual(['The Hel Fenn CampaignPlayer · Setup · 0 warbands', 'Summer in SylvaniaViewer · Round 3 · 0 warbands']);
  });

  it('signed out: campaigns need the account', async () => {
    createFakeSync();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ user: null, pending: false }), { headers: { 'content-type': 'application/json' } })));
    at('/campaign');
    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeTruthy();
  });
});

describe('the overview', () => {
  it('the warbands entered with their player, type, state and frozen rating; another player’s opens to read', async () => {
    const srv = server();
    const anna = saveOf('The Grey Penitents');
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: [{ player: 'Anna', data: anna, role: 'leader' }, { player: 'Ben', data: saveOf('Clan Skrittle'), pending: true }] });
    const user = userEvent.setup();
    at(`/campaign/${c.id}`);
    const list = await screen.findByRole('list', { name: 'Warbands' });
    expect(within(list).getAllByRole('link').map((a) => a.textContent)).toEqual([
      `The Grey PenitentsAnna · Mercenaries · Rating ${totals(anna).rating}✓ Start`,
      'Clan SkrittleBen · MercenariesWaiting for a leader',
    ]);
    expect(within(screen.getByRole('list', { name: 'Members' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['KaiPlayer', 'AnnaLeader', 'BenPlayer']);
    expect(screen.queryByRole('link', { name: 'Manage' })).toBeNull();

    await user.click(within(list).getAllByRole('link')[0]!);
    expect(await screen.findByRole('heading', { level: 1, name: 'The Grey Penitents' })).toBeTruthy();
    expect(screen.getByText(/^Anna · /)).toBeTruthy();
    expect(screen.getByText(new RegExp(`Start marked .* \\(version 1\\): rating ${totals(anna).rating}`))).toBeTruthy();
    // to read only: no button to change anything on the cards
    expect(screen.queryByRole('button', { name: 'Advance' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^More for / })).toBeNull();
    expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
  });

  it('entering a warband: a copy goes in, the warband stays free; a leader’s own takes part at once', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign' });
    const mine = record();
    await db.warbands.add(mine);
    await syncOnce({ userId: KAI.id, data: async () => data });
    const user = userEvent.setup();
    at(`/campaign/${c.id}`);
    await user.click(await screen.findByRole('button', { name: 'Enter a warband' }));
    const sheet = screen.getByRole('dialog', { name: 'Enter a warband' });
    await user.click(within(sheet).getByRole('radio', { name: /The Silver Caravan/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Enter a copy' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'The Silver Caravan' })).toBeTruthy();
    const all = await db.warbands.toArray();
    const copy = all.find((w) => w.id !== mine.id)!;
    expect(copy).toMatchObject({ campaignId: c.id, ownerId: KAI.id, serverRev: 1, copiedFrom: { id: mine.id, rev: 1 } });
    expect(all.find((w) => w.id === mine.id)!.campaignId ?? null).toBeNull();
    expect(srv.state.campaigns.get(c.id)!.enrolments).toMatchObject([{ warbandId: copy.id, status: 'active', tag: { kind: 'start' } }]);
    // on its roster: where it is entered, and no removing while it is
    expect(await screen.findByRole('link', { name: 'In The Hel Fenn Campaign' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove the warband' })).toBeNull();
    // the copy is in step with the server: the next sync sends nothing
    expect(await syncOnce({ userId: KAI.id, data: async () => data })).toMatchObject({ pushed: 0, waiting: 0 });
  });

  it('a new warband for the campaign: made free under Warbands, its copy entered at once and opened (Rob, 05.10.2026)', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: [{ player: 'Anna', data: saveOf('The Grey Penitents'), role: 'leader' }] });
    const user = userEvent.setup();
    at(`/campaign/${c.id}`);
    await user.click(await screen.findByRole('button', { name: 'Enter a warband' }));
    const sheet = screen.getByRole('dialog', { name: 'Enter a warband' });
    expect(within(sheet).getByText(/None of your warbands is free yet/)).toBeTruthy();
    expect(within(sheet).queryByRole('button', { name: 'Enter a copy' })).toBeNull();
    await user.click(within(sheet).getByRole('button', { name: 'New warband for this campaign' }));
    expect(await screen.findByText(/For The Hel Fenn Campaign: the warband is yours under Warbands/)).toBeTruthy();
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Warband' }), 'tileans');
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Sons of Trantio');
    await user.click(screen.getByRole('button', { name: 'Start the warband' }));
    expect(await screen.findByRole('link', { name: 'In The Hel Fenn Campaign' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Sons of Trantio' })).toBeTruthy();
    const all = await db.warbands.toArray();
    const free = all.find((w) => !w.campaignId)!;
    const copy = all.find((w) => w.campaignId)!;
    expect(all).toHaveLength(2);
    expect(free).toMatchObject({ name: 'Sons of Trantio', ownerId: KAI.id, serverRev: 1 });
    expect(copy).toMatchObject({ name: 'Sons of Trantio', campaignId: c.id, copiedFrom: { id: free.id, rev: 1 } });
    expect(srv.state.warbands.get(free.id)!.campaignId ?? null).toBeNull();
    expect(srv.state.warbands.get(free.id)!.versions.map((v) => v.source)).toEqual(['save']);
    expect(srv.state.campaigns.get(c.id)!.enrolments.map((e) => [e.name, e.status])).toEqual([['The Grey Penitents', 'active'], ['Sons of Trantio', 'pending']]);
    // in step with the server: the next sync sends neither of them again
    expect(await syncOnce({ userId: KAI.id, data: async () => data })).toMatchObject({ pushed: 0, waiting: 0 });
    cleanup();
    at('/warbands');
    await screen.findByRole('link', { name: /in The Hel Fenn Campaign/ });
    expect(screen.getAllByRole('link', { name: /Sons of Trantio/ }).map((a) => a.textContent)).toEqual(expect.arrayContaining([
      expect.stringMatching(/· in The Hel Fenn Campaign$/), expect.not.stringMatching(/in The Hel Fenn/),
    ]));
  });

  it('a new warband for the campaign without the connection: made, and entered later', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player' });
    const user = userEvent.setup();
    at(`/warbands/new?campaign=${c.id}`);
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Warband' }), 'tileans');
    srv.state.down = true;
    const fetchNow = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await user.click(screen.getByRole('button', { name: 'Start the warband' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Your warband is made and under Warbands, but it could not be entered yet/);
    expect(await db.warbands.count()).toBe(1);
    vi.stubGlobal('fetch', fetchNow);
    await user.click(screen.getByRole('link', { name: 'Open the warband' }));
    expect(await screen.findByRole('button', { name: 'Remove the warband' })).toBeTruthy();
  });

  it('leaving the campaign from the roster: the warband is free again', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: [{ player: 'Anna', data: saveOf('The Grey Penitents'), role: 'leader' }] });
    await db.warbands.add(record());
    await syncOnce({ userId: KAI.id, data: async () => data });
    const user = userEvent.setup();
    at(`/campaign/${c.id}`);
    await user.click(await screen.findByRole('button', { name: 'Enter a warband' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Enter a warband' })).getByRole('radio', { name: /The Silver Caravan/ }));
    await user.click(screen.getByRole('button', { name: 'Enter a copy' }));
    expect(await screen.findByRole('link', { name: 'In The Hel Fenn Campaign' })).toBeTruthy();
    expect(srv.state.campaigns.get(c.id)!.enrolments.map((e) => e.status)).toEqual(['active', 'pending']);
    await user.click(screen.getByRole('button', { name: 'Leave the campaign…' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Leave The Hel Fenn Campaign?' })).getByRole('button', { name: 'Leave the campaign' }));
    expect(await screen.findByText('The warband has left the campaign.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove the warband' })).toBeTruthy();
    expect(srv.state.campaigns.get(c.id)!.enrolments).toHaveLength(1);
  });
});

describe('Manage', () => {
  it('a leader confirms and declines warbands, adds people, changes roles; the campaign keeps a leader', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [{ player: 'Anna', data: saveOf('The Grey Penitents'), pending: true }, { player: 'Ben', data: saveOf('Clan Skrittle'), pending: true }] });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/manage`);
    const waiting = await screen.findByRole('heading', { name: 'Waiting for a leader' });
    const box = waiting.parentElement!;
    await user.click(within(within(box).getAllByRole('listitem')[0]!).getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('The Grey Penitents takes part; its start is marked.')).toBeTruthy();
    await user.click(within(box).getByRole('button', { name: 'Decline' }));
    expect(await within(box).findByText('No warband waiting.')).toBeTruthy();
    expect(srv.state.campaigns.get(c.id)!.enrolments.map((e) => [e.name, e.status])).toEqual([['The Grey Penitents', 'active']]);

    await user.selectOptions(screen.getByLabelText('Who'), 'user-rob');
    await user.selectOptions(screen.getByLabelText('As'), 'viewer');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Rob: Viewer.')).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Role of Anna'), 'leader');
    expect(await screen.findByText('Anna: Leader.')).toBeTruthy();
    expect(srv.state.campaigns.get(c.id)!.members.map((m) => [m.displayName, m.role])).toEqual([['Kai', 'leader'], ['Anna', 'leader'], ['Ben', 'player'], ['Rob', 'viewer']]);
    await user.click(screen.getByRole('button', { name: 'Take Ben out of the campaign' }));
    expect(await screen.findByText('Ben is no longer part of it.')).toBeTruthy();

    await user.selectOptions(screen.getByLabelText('Role of Anna'), 'player');
    expect(await screen.findByText('Anna: Player.')).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Role of Kai'), 'player');
    expect((await screen.findByRole('alert')).textContent).toMatch(/keeps at least one leader/);
  });

  it('a leader without the authenticator is told to set it up', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign' });
    at(`/campaign/${c.id}/manage`);
    expect(await screen.findByText(/Leading needs the authenticator/)).toBeTruthy();
  });
});

describe('the sync', () => {
  it('carries where a warband is entered, and when it is free again', async () => {
    const srv = server();
    const w = record();
    await db.warbands.add(w);
    await syncOnce({ userId: KAI.id, data: async () => data });
    const there = srv.state.warbands.get(w.id)!;
    there.campaignId = 'campaign-9';
    there.seq = ++srv.state.seq;
    expect(await syncOnce({ userId: KAI.id, data: async () => data })).toMatchObject({ pulled: 1 });
    expect((await db.warbands.get(w.id))!.campaignId).toBe('campaign-9');
    there.campaignId = null;
    there.seq = ++srv.state.seq;
    await syncOnce({ userId: KAI.id, data: async () => data });
    expect((await db.warbands.get(w.id))!.campaignId).toBeNull();
  });

  it('a removal the server refuses while the warband is entered: it comes back', async () => {
    const srv = server();
    const w = record();
    await db.warbands.add(w);
    await syncOnce({ userId: KAI.id, data: async () => data });
    srv.state.warbands.get(w.id)!.campaignId = 'campaign-9';
    await db.warbands.update(w.id, { removedAt: new Date(0).toISOString() });
    await syncOnce({ userId: KAI.id, data: async () => data, undoMs: 0 });
    expect((await db.warbands.get(w.id))!.removedAt).toBeUndefined();
    expect(srv.state.warbands.get(w.id)!.archivedAt).toBeNull();
  });
});
