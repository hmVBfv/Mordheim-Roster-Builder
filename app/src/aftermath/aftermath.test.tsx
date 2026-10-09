/* After the battle as the table does it (phase 4a4): the leader closes the
   battle; each player takes it over into their warband, goes through the
   post-battle sequence and marks the warband "after battle N" – the
   changes frozen as core finds them; then a leader moves the campaign on.
   Against the stand-in server (sync/fakeSync.ts), which computes the
   changes with core as the server does. */
import { FORMAT, ctxOf, stageTotals, writeSave } from '@mordheim/core';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSession, signedIn } from '../account/session.ts';
import { ME as KAI } from '../account/testServer.ts';
import { AppRoutes } from '../app/App.tsx';
import { db } from '../db/db.ts';
import { newId } from '../db/ids.ts';
import { readSave } from '../sync/engine.ts';
import { createFakeSync, type FakeChange } from '../sync/fakeSync.ts';
import { stopSync } from '../sync/runner.ts';
import { data, sampleSave } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';
import { previewChanges } from './changes.ts';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const T0 = '2026-10-05T10:00:00.000Z';
const saveOf = (name: string) => writeSave(ctxOf(data, { ...sampleSave(), name }));
const totals = (save: unknown) => stageTotals(ctxOf(data, readSave(data, save)!));
const changes = (before: unknown, after: unknown, b: { id: string; round: number }) =>
  previewChanges(data, readSave(data, before)!, readSave(data, after)!, b.id, b.round) as FakeChange[];

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });
afterEach(async () => { cleanup(); stopSync(); resetSession(); localStorage.clear(); await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });

/** The stand-in server behind fetch, signed in as Kai, who leads with the authenticator. */
function server() {
  const me = { ...KAI, totp: true };
  const srv = createFakeSync({ me: { id: KAI.id, username: KAI.username, displayName: KAI.displayName }, totals, changes, wbName: (wb) => data.WARBANDS[wb]?.name ?? wb });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost/');
    const path = url.pathname.replace(/^\/api\/v1/, '');
    if (path === '/auth/me') return new Response(JSON.stringify({ user: me, pending: false }), { headers: { 'content-type': 'application/json' } });
    srv.state.calls.push(`${init?.method ?? 'GET'} ${path}`);
    return srv.handle(init?.method ?? 'GET', path, url.searchParams, init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {});
  }));
  signedIn({ stage: 'full', user: me });
  return srv;
}

/** A campaign with Anna's and Ben's warbands (sample Mercenaries, renamed) and Kai's Silver Caravan (entered, its start marked, on this device too); one battle of the Caravan against Clan Skrittle. */
async function world() {
  const srv = server();
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [{ player: 'Anna', data: saveOf('The Grey Penitents') }, { player: 'Ben', data: saveOf('Clan Skrittle') }] });
  const mine = newId();
  const save = saveOf('The Silver Caravan');
  await srv.handle('POST', `/campaigns/${c.id}/enrolments`, new URLSearchParams(), { warbandId: mine, data: save }).json();
  await db.warbands.add({ id: mine, name: 'The Silver Caravan', wb: 'merc', wbName: 'Mercenaries', state: readSave(data, save)!, format: FORMAT, createdAt: T0, updatedAt: T0, syncedAt: T0, serverRev: 1, draftSeq: null, ownerId: KAI.id, origin: 'save', campaignId: c.id });
  const [penitents, skrittle] = c.enrolments.map((e) => e.warbandId) as [string, string];
  const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry', warbandIds: [mine, skrittle] });
  b.participants[0]!.outcome = 'victory';
  b.participants[1]!.outcome = 'defeat';
  srv.entryElsewhere(b.id, { id: '11111111-1111-4111-8111-111111111111', turn: 2, kind: 'casualty', author: 'Kai',
    payload: { victim: { warbandId: mine, uid: 2, idx: 0, name: 'Champion', grade: 'hero', wb: 'merc' }, attacker: { warbandId: skrittle, uid: null, name: 'Clan Skrittle' }, note: 'at the ferry' } });
  return { srv, c, b, mine, penitents, skrittle };
}

describe('closing a battle', () => {
  it('a leader closes it after a last look; then each player goes on to the aftermath', async () => {
    const { srv, c, b, mine } = await world();
    const user = userEvent.setup();
    at(`/campaign/${c.id}/battles/${b.id}`);
    await user.click(await screen.findByRole('button', { name: 'Close the battle…' }));
    const sheet = screen.getByRole('dialog', { name: 'Close Battle 1 · Hel Fenn ferry?' });
    expect(within(sheet).getByText(/Notes sealed until this battle open for everyone/)).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Close the battle' }));
    expect(await screen.findByText(/This battle is closed: its protocol is fixed/)).toBeTruthy();
    expect(srv.state.battles.get(b.id)!.status).toBe('closed');
    expect(screen.queryByRole('button', { name: '+ Casualty' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close the battle…' })).toBeNull();
    const link = screen.getByRole('link', { name: 'Your aftermath →' });
    expect(link.getAttribute('href')).toBe(`/warbands/${mine}/aftermath/${b.id}`);
    expect(screen.getAllByText('Aftermath not marked yet')).toHaveLength(2);
  });
});

describe('the aftermath of one’s warband', () => {
  it('takes the battle over, goes through the sequence and marks the warband; the changes are frozen for everyone', async () => {
    const { srv, c, b, mine } = await world();
    b.status = 'closed';
    const user = userEvent.setup();
    at(`/warbands/${mine}/aftermath/${b.id}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'After battle 1' })).toBeTruthy();
    // what is taken over, shown first
    expect((await screen.findByRole('list', { name: 'From the protocol' })).textContent).toBe('Champion (The Silver Caravan) out of action – by someone of Clan Skrittle.');
    await user.click(screen.getByRole('button', { name: 'Take it over' }));
    const casualties = await screen.findByRole('list', { name: 'Casualties' });
    expect(casualties.textContent).toMatch(/Champion was put out of action by Clan Skrittle \(Mercenaries\) — at the ferry\./);
    expect((await db.warbands.get(mine))!.state.campaign).toMatchObject({ round: 1, battles: [{ serverId: b.id, outcome: 'Victory' }] });

    // 1. injuries: the Champion rolls on the chart
    await user.click(within(casualties).getByRole('button', { name: 'Roll' }));
    const roll = screen.getByRole('dialog', { name: 'Serious injury · Champion' });
    await user.type(within(roll).getByLabelText('D66 as rolled'), '45');
    await user.click(within(roll).getByRole('button', { name: 'Apply' }));
    expect(await screen.findByText('Nothing left to roll.')).toBeTruthy();
    expect(casualties.textContent).toMatch(/Champion recovered fully/);
    await user.click(screen.getByRole('button', { name: 'Done – next step' }));

    // 2. experience: granted once, then written onto the roster
    await user.click(await screen.findByRole('button', { name: 'Grant the battle’s experience' }));
    expect((await screen.findByRole('list', { name: 'Experience held' })).textContent).toMatch(/Mercenary Captain \+1/);
    expect(screen.getByRole('button', { name: '✓ Battle experience granted' })).toHaveProperty('disabled', true);
    await user.click(screen.getByRole('button', { name: 'Write it onto the roster' }));
    await waitFor(async () => expect((await db.warbands.get(mine))!.state.models.find((m) => m.uid === 1)!.exp).toBe(43));

    // what changed since the start, and the mark
    const list = await screen.findByRole('list', { name: 'Changes' });
    expect(within(list).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toContain('Mercenary Captain');
    expect(screen.getByText(/Since its start \(version 1\) · a preview/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Looks right – mark after battle 1' }));
    expect(await screen.findByText(/✓ Marked after battle 1 – version 2/)).toBeTruthy();
    const e = srv.state.campaigns.get(c.id)!.enrolments.find((x) => x.warbandId === mine)!;
    expect(e.tag).toMatchObject({ kind: 'after_battle', rev: 2, round: 1, battleId: b.id });
    expect(e.tag!.changes).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'experience', name: 'Mercenary Captain', unexplained: false })]));
    expect(srv.state.warbands.get(mine)!.versions.at(-1)).toMatchObject({ rev: 2, note: 'after battle 1' });
    // marked again, the newer mark corrects the earlier
    expect(screen.getByRole('button', { name: 'Mark after battle 1 again' })).toBeTruthy();
  });

  it('waits while the battle is still being fought', async () => {
    const { b, mine } = await world();
    at(`/warbands/${mine}/aftermath/${b.id}`);
    expect(await screen.findByText(/The battle is still being fought/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Take it over' })).toBeNull();
  });
});

describe('the campaign after the battle', () => {
  it('shows each player what is open for them; a leader moves the campaign on once the round’s battles are closed', async () => {
    const { c, b, mine, penitents } = await world();
    const user = userEvent.setup();
    at(`/campaign/${c.id}/manage`);
    expect(await screen.findByText(/1 of 1 battle of round 1 still being fought/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Move on to After battle 1' })).toHaveProperty('disabled', true);
    cleanup();

    b.status = 'closed';
    at(`/campaign/${c.id}`);
    const open = await screen.findByRole('region', { name: 'Open for you' });
    expect(within(open).getByRole('link').getAttribute('href')).toBe(`/warbands/${mine}/aftermath/${b.id}`);
    expect(within(open).getByRole('link').textContent).toMatch(/Battle 1 · Hel Fenn ferry · The Silver Caravan/);
    expect(screen.getByRole('list', { name: 'Battles' }).textContent).toMatch(/closed · 0\/2 marked/);
    cleanup();

    at(`/campaign/${c.id}/manage`);
    expect(await screen.findByText(/The Grey Penitents fought none/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Move on to After battle 1' }));
    expect(await screen.findByText('On to After battle 1.')).toBeTruthy();
    expect(c.round).toBe(1);
    expect(c.enrolments.find((e) => e.warbandId === penitents)!.tag).toMatchObject({ kind: 'sat_out', round: 1 });
    await user.click(screen.getByRole('link', { name: 'Overview' }));
    expect((await screen.findByRole('list', { name: 'Warbands' })).textContent).toMatch(/Sat out battle 1/);
  });
});
