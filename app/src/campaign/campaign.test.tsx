/* Campaigns as players reach them (phase 4a1): the Campaign tab, starting a
   campaign, the overview, another player's warband to read, entering a
   warband (a copy), what a leader manages, and leaving – against the
   stand-in server (sync/fakeSync.ts). */
import { FORMAT, addSkill, addUnit, asPlanner, ctxOf, newWarband, stageTotals, writeSave, type WarbandState } from '@mordheim/core';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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

  it('a place of the lore can be chosen when it starts, and its name stands under the title (#66)', async () => {
    const srv = server({ totp: true });
    const user = userEvent.setup();
    at('/campaign');
    await user.click(await screen.findByRole('button', { name: 'Start a campaign' }));
    const sheet = screen.getByRole('dialog', { name: 'Start a campaign' });
    await user.type(within(sheet).getByLabelText('Name of the campaign'), 'The Hel Fenn Campaign');
    // optional: starts without a place, the choice is a region of the lore
    const place = await within(sheet).findByLabelText('Place (optional)');
    expect((place as HTMLSelectElement).value).toBe('');
    await user.selectOptions(place, 'mordheim');
    await user.click(within(sheet).getByRole('button', { name: 'Start it' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'The Hel Fenn Campaign' })).toBeTruthy();
    expect([...srv.state.campaigns.values()].map((c) => c.place)).toEqual(['mordheim']);
    expect(await screen.findByText(/Setup · you are leader · Mordheim/)).toBeTruthy();
  });

  it('the Campaign tab always shows the list, also with a single campaign (#75)', async () => {
    const srv = server();
    srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player' });
    at('/campaign');
    const one = await screen.findByRole('list', { name: 'Your campaigns' });
    expect(within(one).getAllByRole('link').map((a) => a.textContent)).toEqual(['The Hel Fenn CampaignPlayer · Setup · 0 warbands']);
    expect(screen.getByRole('heading', { level: 1, name: 'Campaigns' })).toBeTruthy();
    cleanup();
    srv.addCampaign({ name: 'Summer in Sylvania', role: 'viewer', round: 3 });
    at('/campaign');
    // what the device remembered shows first; the server's list follows
    const list = await screen.findByRole('list', { name: 'Your campaigns' });
    await waitFor(() => expect(within(list).getAllByRole('link').map((a) => a.textContent)).toEqual(['The Hel Fenn CampaignPlayer · Setup · 0 warbands', 'Summer in SylvaniaViewer · After battle 3 · 0 warbands']));
  });

  /* Rob, 19.10.2026: every player files campaigns away in their own list, in a section of its own. */
  it('a campaign is archived in one’s own list and taken back', async () => {
    const srv = server();
    srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player' });
    srv.addCampaign({ name: 'Summer in Sylvania', role: 'viewer', round: 3 });
    const user = userEvent.setup();
    at('/campaign');
    const list = await screen.findByRole('list', { name: 'Your campaigns' });
    await waitFor(() => expect(within(list).getAllByRole('link')).toHaveLength(2));
    expect(screen.queryByRole('heading', { name: 'Archived' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Archive: Summer in Sylvania' }));
    const archived = await screen.findByRole('list', { name: 'Archived campaigns' });
    expect(within(archived).getAllByRole('link').map((a) => a.textContent)).toEqual(['Summer in SylvaniaViewer · After battle 3 · 0 warbands']);
    expect(within(screen.getByRole('list', { name: 'Your campaigns' })).getAllByRole('link')).toHaveLength(1);
    await waitFor(() => expect(srv.state.campaigns.get('campaign-2')!.archivedBy).toEqual([KAI.id]));
    // opened again with one campaign left in play: the list, with the archive in its own section
    cleanup();
    at('/campaign');
    expect(await screen.findByRole('list', { name: 'Archived campaigns' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: 'The Hel Fenn Campaign' })).toBeNull();
    cleanup();
    render(<MemoryRouter initialEntries={[{ pathname: '/campaign' }]}><AppRoutes /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Back to the list: Summer in Sylvania' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Archived' })).toBeNull());
    expect(srv.state.campaigns.get('campaign-2')!.archivedBy).toEqual([]);
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
    // to read only: a row each, and opened a card without any button to change something
    const row = (await screen.findAllByRole('button', { expanded: false }))[0]!;
    await user.click(row);
    const card = await screen.findByRole('article');
    expect(within(card).getAllByRole('columnheader').length).toBeGreaterThan(8);
    for (const name of ['Advance', /^Injury for /, /One experience (less|more)/, /^Recruit/, 'Remove from the roster']) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  /* #41: the warband's own page shows how full it is as a bar under "Models 12/12"; the campaign's view of it showed only the figures. */
  it('a warband in the campaign shows its models as a bar too, as its own page does', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: [{ player: 'Anna', data: saveOf('The Grey Penitents'), role: 'leader' }] });
    const user = userEvent.setup();
    at(`/campaign/${c.id}`);
    await user.click(within(await screen.findByRole('list', { name: 'Warbands' })).getAllByRole('link')[0]!);
    await screen.findByRole('heading', { level: 1, name: 'The Grey Penitents' });
    const tile = screen.getByText('Models').parentElement!;
    const [have, max] = (tile.querySelector('dd')!.textContent ?? '').split('/').map(Number) as [number, number];
    const bar = tile.querySelector('dd span[aria-hidden="true"] i') as HTMLElement | null;
    expect(bar).toBeTruthy();
    expect(bar!.style.width).toBe(`${Math.min(100, Math.round((100 * have) / Math.max(1, max)))}%`);
  });

  /* Wish #77: a leader reads in the warband itself why it joined late and what it exceeds. */
  it('a warband that joined late says so to those who read it, and what it exceeds', async () => {
    const srv = server();
    const late = { ...saveOf('The Late Company'), campaign: { on: false, districts: {}, catchUp: { round: 3, peers: 3, rating: 140, value: 900, battles: 3, gold: 900, exp: 88, over: ['A Champion needs 36 exp for its advances; the catch-up gives 30.'] } } };
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'leader', others: [{ player: 'Anna', data: late, role: 'player', pending: true }] });
    const user = userEvent.setup();
    at(`/campaign/${c.id}`);
    await user.click(await screen.findByRole('link', { name: /The Late Company/ }));
    const note = await screen.findByLabelText('Joined late');
    expect(note.textContent).toMatch(/Joined late, in round 3: a catch-up of up to 900 gc and 88 rating points of experience, by the median of 3 warbands \(rating 140, value 900 gc, 3 battles\)/);
    expect(note.textContent).toMatch(/It exceeds the plan – a leader can still confirm it/);
    expect(note.textContent).toMatch(/needs 36 exp for its advances; the catch-up gives 30/);
  });

  /* Wish #79: a leader keeps hidden NPC warbands – planners, tracked by value, experience and rating; nobody else sees the section. */
  it('NPC warbands: a leader adds one of his warbands and reads its figures and cards; a player sees no such section', async () => {
    const srv = server({ totp: true });
    await db.warbands.add(record({ name: 'The Black Company' }));
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'leader', others: [] });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/warbands`);
    const form = await screen.findByRole('form', { name: 'Add an NPC warband' });
    await user.selectOptions(within(form).getByRole('combobox'), await within(form).findByRole('option', { name: /The Black Company/ }));
    await user.click(within(form).getByRole('button', { name: 'Add as an NPC warband' }));
    const list = await screen.findByRole('list', { name: 'NPC warbands' });
    expect(list.textContent).toMatch(/The Black Company.*Value \d+ gc · Exp \d+ · Rating \d+ · \d+ models?/);
    const saved = [...srv.state.npcWarbands.values()][0]!;
    expect(saved.save).toMatchObject({ planner: true, plannerTrade: true });
    await user.click(within(list).getByText(/The Black Company/));
    expect(await within(list).findByRole('group', { name: /Tabletop Simulator cards of The Black Company/ })).toBeTruthy();
  });

  it('NPC warbands: a player is not offered the section', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: [{ player: 'Anna', data: saveOf('The Grey Penitents'), role: 'leader' }] });
    at(`/campaign/${c.id}/warbands`);
    await screen.findByRole('list', { name: 'Warbands' });
    expect(screen.queryByText(/NPC warbands/)).toBeNull();
    expect(screen.queryByRole('form', { name: 'Add an NPC warband' })).toBeNull();
  });

  /* Rob, 19.10.2026: a section of its own, for the quick overview of every warband. */
  it('the Warbands tab: a card each with the numbers of its last mark, the waiting ones apart; a card opens the warband', async () => {
    const srv = server();
    const anna = saveOf('The Grey Penitents');
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: [{ player: 'Anna', data: anna, role: 'leader' }, { player: 'Ben', data: saveOf('Clan Skrittle'), pending: true }] });
    const user = userEvent.setup();
    at(`/campaign/${c.id}`);
    // the bottom navigation has a Warbands entry too: the campaign's tab is the one that goes to this campaign's warbands
    const tab = () => document.querySelector<HTMLElement>(`a[href="/campaign/${c.id}/warbands"]`);
    await waitFor(() => expect(tab()).toBeTruthy());
    await user.click(tab()!);
    const playing = await screen.findByRole('list', { name: 'Warbands' });
    const t = totals(anna);
    expect(within(playing).getAllByRole('link').map((a) => a.textContent)).toEqual([
      `The Grey Penitents✓ StartAnna · MercenariesRating${t.rating}Warriors${t.models}Heroes${t.heroes}Gold${t.gold}Fallen${t.fallen}`,
    ]);
    const waiting = screen.getByRole('list', { name: 'Waiting warbands' });
    expect(within(waiting).getAllByRole('link').map((a) => a.textContent)).toEqual(['Clan SkrittleWaiting for a leaderBen · MercenariesNo mark yet – its numbers come with the first one.']);
    await user.click(within(playing).getAllByRole('link')[0]!);
    expect(await screen.findByRole('heading', { level: 1, name: 'The Grey Penitents' })).toBeTruthy();
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

  /* Wish #77: a planner does not enter as it is: it is offered apart, to join late, and the plain entry refuses it. */
  it('a planner is offered apart from the warbands that enter as a copy, and does not enter as it is', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign' });
    const plain = record();
    const planner = { ...record(), id: 'w-planner', name: 'The Late Company', state: { ...record().state, planner: true } };
    await db.warbands.bulkAdd([plain, planner]);
    await syncOnce({ userId: KAI.id, data: async () => data });
    const user = userEvent.setup();
    at(`/campaign/${c.id}`);
    await user.click(await screen.findByRole('button', { name: 'Enter a warband' }));
    const sheet = screen.getByRole('dialog', { name: 'Enter a warband' });
    // the warbands that enter as a copy are under "Warband"; the planner is under its own heading, to join late
    expect(within(within(sheet).getByRole('group', { name: 'Warband' })).getAllByRole('radio')).toHaveLength(1);
    expect(within(within(sheet).getByRole('group', { name: 'Planners, to join late' })).getByRole('radio', { name: /The Late Company/ })).toBeTruthy();
    const { enterWarband } = await import('./enter.ts');
    await expect(enterWarband(data, c.id, planner)).rejects.toThrow(/planner/i);
  });

  /* Wish #77: a planner joins a running campaign late. It is measured against the others (the median of those that have
     fought), enters as an ordinary warband, and the entry keeps a record of why. */
  const planner = (extra?: (s: WarbandState) => WarbandState): StoredWarband => {
    let s: WarbandState = { ...asPlanner(ctxOf(data, newWarband(data, 'merc'))), name: 'The Late Company' };
    for (const id of ['capt', 'champ', 'warr']) s = addUnit(ctxOf(data, s), id);
    if (extra) s = extra(s);
    return { ...record(), name: 'The Late Company', wb: 'merc', state: s };
  };
  const campaignWithFight = () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: [{ player: 'Anna', data: saveOf('The Grey Penitents'), role: 'leader' }] });
    srv.addBattle(c.id).status = 'closed';
    return { srv, c };
  };

  it('a planner joins late: measured by the others, entered as an ordinary warband with the record of why', async () => {
    const { srv, c } = campaignWithFight();
    const mine = planner();
    await db.warbands.add(mine);
    await syncOnce({ userId: KAI.id, data: async () => data });
    const user = userEvent.setup();
    at(`/campaign/${c.id}`);
    await user.click(await screen.findByRole('button', { name: 'Enter a warband' }));
    const sheet = screen.getByRole('dialog', { name: 'Enter a warband' });
    await user.click(within(sheet).getByRole('radio', { name: /The Late Company/ }));
    expect(await within(sheet).findByText(/median of 1 warband that has fought/)).toBeTruthy();
    expect(within(sheet).getByRole('list', { name: 'Experience from the catch-up' })).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Enter as a latecomer' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'The Late Company' })).toBeTruthy();
    const all = await db.warbands.toArray();
    const copy = all.find((w) => w.campaignId === c.id)!;
    expect(copy.state.planner).toBeUndefined();
    expect(copy.state.campaign?.catchUp).toMatchObject({ peers: 1, battles: 1, round: c.round });
    // the planner itself stays a planner, free
    expect(all.find((w) => w.id === mine.id)!.state.planner).toBe(true);
    expect(srv.state.campaigns.get(c.id)!.enrolments.some((e) => e.warbandId === copy.id)).toBe(true);
  });

  it('what exceeds the plan is said, and the entry goes on with it for a leader to see', async () => {
    const { c } = campaignWithFight();
    // more advances than the experience of the plan pays for
    const rich = planner((s) => { let t = s; const champ = t.models.find((m) => m.uid_def === 'champ')!.uid; for (let i = 0; i < 24; i++) t = addSkill(ctxOf(data, t), champ, `Skill ${i}`); return t; });
    await db.warbands.add(rich);
    await syncOnce({ userId: KAI.id, data: async () => data });
    const user = userEvent.setup();
    at(`/campaign/${c.id}`);
    await user.click(await screen.findByRole('button', { name: 'Enter a warband' }));
    const sheet = screen.getByRole('dialog', { name: 'Enter a warband' });
    await user.click(within(sheet).getByRole('radio', { name: /The Late Company/ }));
    expect(await within(sheet).findByText(/needs \d+ exp for its advances; the catch-up gives \d+/)).toBeTruthy();
    expect(within(sheet).getByText(/A leader can still confirm an entry that exceeds the plan/)).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Enter anyway' }));
    await waitFor(async () => expect((await db.warbands.toArray()).find((w) => w.campaignId === c.id)).toBeTruthy());
    const copy = (await db.warbands.toArray()).find((w) => w.campaignId === c.id)!;
    expect((copy.state.campaign?.catchUp as { over?: string[] }).over?.[0]).toMatch(/needs \d+ exp for its advances/);
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
    await user.click(await screen.findByRole('radio', { name: 'Tileans' }));
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
      expect.stringMatching(/· in The Hel Fenn Campaign(Created|$)/), expect.not.stringMatching(/in The Hel Fenn/),
    ]));
  });

  it('a new warband for the campaign without the connection: made, and entered later', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player' });
    const user = userEvent.setup();
    at(`/warbands/new?campaign=${c.id}`);
    await user.click(await screen.findByRole('radio', { name: 'Tileans' }));
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

  /* Rob, 19.10.2026: a leader deletes the campaign, with its name typed to be sure; the warbands in it are free again. */
  it('a leader deletes the campaign by typing its name; it is gone, and the list says so', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [{ player: 'Anna', data: saveOf('The Grey Penitents') }] });
    srv.addCampaign({ name: 'Summer in Sylvania', role: 'player' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/manage`);
    await user.click(await screen.findByRole('button', { name: 'Delete the campaign…' }));
    const sheet = screen.getByRole('dialog', { name: /Delete “The Hel Fenn Campaign”/ });
    expect(sheet.textContent).toMatch(/The warband in it goes back to its player, free/);
    const go = within(sheet).getByRole('button', { name: 'Delete it for everyone' });
    expect((go as HTMLButtonElement).disabled).toBe(true);
    await user.type(within(sheet).getByLabelText('Type the name of the campaign'), 'The Hel Fenn');
    expect((go as HTMLButtonElement).disabled).toBe(true);
    await user.type(within(sheet).getByLabelText('Type the name of the campaign'), ' Campaign');
    await user.click(go);
    expect(await screen.findByText('“The Hel Fenn Campaign” is deleted. Its warbands are with their players again.')).toBeTruthy();
    expect(srv.state.campaigns.has(c.id)).toBe(false);
    const list = await screen.findByRole('list', { name: 'Your campaigns' });
    await waitFor(() => expect(within(list).getAllByRole('link').map((a) => a.textContent)).toEqual(['Summer in SylvaniaPlayer · Setup · 0 warbands']));
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
