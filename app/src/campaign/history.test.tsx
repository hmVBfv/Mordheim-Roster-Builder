/* Taking over a running campaign (phase 4a5): a leader records the battles
   played before the app under Manage – they stay as they were, no
   aftermath, nothing to mark; the campaign stands after the last of them.
   A warband that fought them takes the campaign's stage on its roster in
   one tap. Against the stand-in server (sync/fakeSync.ts). */
import * as core from '@mordheim/core';
import { FORMAT, ctxOf, stageTotals, writeSave } from '@mordheim/core';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSession, signedIn } from '../account/session.ts';
import { ME as KAI } from '../account/testServer.ts';
import { AppRoutes } from '../app/App.tsx';
import { db, type StoredWarband } from '../db/db.ts';
import { newId } from '../db/ids.ts';
import { readSave } from '../sync/engine.ts';
import { createFakeSync, type FakeRole } from '../sync/fakeSync.ts';
import { stopSync } from '../sync/runner.ts';
import { data, sampleSave } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';
import { historyOf } from './api.ts';
import { stageBehind, takeStage } from './stage.ts';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const T0 = '2026-10-05T10:00:00.000Z';
const totals = (save: unknown) => stageTotals(ctxOf(data, readSave(data, save)!));
const saveOf = (name: string) => writeSave(ctxOf(data, { ...sampleSave(), name }));
/** One of Kai's warbands on this device, as the Roster Builder left it: the campaign layer off, at Setup. */
const record = (over: Partial<StoredWarband> = {}): StoredWarband => {
  const s = sampleSave();
  return { id: newId(), name: s.name!, wb: s.wb as string, wbName: 'Mercenaries', state: s, format: FORMAT, createdAt: T0, updatedAt: T0, ownerId: KAI.id, origin: 'save', ...over };
};

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); });
afterEach(async () => { cleanup(); stopSync(); resetSession(); localStorage.clear(); await db.warbands.clear(); await db.meta.clear(); });

function server(o: { totp?: boolean } = {}) {
  const me = { ...KAI, totp: !!o.totp };
  const srv = createFakeSync({ me: { id: KAI.id, username: KAI.username, displayName: KAI.displayName }, totals, wbName: (wb) => data.WARBANDS[wb]?.name ?? wb });
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

/** The group's campaign: Anna's and Ben's warbands entered and confirmed at its founding. */
function campaign(role: FakeRole = 'leader', o: { totp?: boolean } = {}) {
  const srv = server(o);
  const c = srv.addCampaign({ name: 'The Lustria Campaign', role, others: [{ player: 'Anna', data: saveOf('Die Silberne Karavane'), role: role === 'leader' ? 'player' : 'leader' }, { player: 'Ben', data: saveOf("Rangvald's Reavers") }] });
  const [caravan, reavers] = c.enrolments.map((e) => e.warbandId) as [string, string];
  return { srv, c, caravan, reavers };
}

describe('the history of a running campaign', () => {
  it('a leader records the battles before the app: who fought, how it ended; the campaign stands after the last', async () => {
    const { srv, c, caravan, reavers } = campaign('leader', { totp: true });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/manage`);
    await user.click(await screen.findByRole('button', { name: '+ A battle before the app' }));
    const sheet = screen.getByRole('dialog', { name: 'New battle before the app' });
    expect((within(sheet).getByRole('spinbutton', { name: 'Battle' }) as HTMLInputElement).value).toBe('1');
    await user.type(within(sheet).getByRole('textbox', { name: 'Title (optional)' }), 'Das Urteil im Nebel');
    await user.selectOptions(await within(sheet).findByRole('combobox', { name: 'District' }), 'quayside');
    // the date input takes its value as typed into it
    await user.type(within(sheet).getByLabelText('Played on (optional)'), '2026-06-12');
    await user.selectOptions(within(sheet).getByRole('combobox', { name: /Die Silberne Karavane/ }), 'routed');
    await user.selectOptions(within(sheet).getByRole('combobox', { name: /Rangvald's Reavers/ }), 'victory');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Battle 1 · Das Urteil im Nebel is in the history.')).toBeTruthy();
    const b1 = [...srv.state.battles.values()][0]!;
    expect(b1).toMatchObject({ round: 1, title: 'Das Urteil im Nebel', district: 'quayside', playedAt: '2026-06-12', status: 'closed', takenOver: true });
    expect(Object.fromEntries(b1.participants.map((p) => [p.warbandId, p.outcome]))).toEqual({ [caravan]: 'routed', [reavers]: 'victory' });
    // the next one: battle 2 by default, one warband not there
    await user.click(screen.getByRole('button', { name: '+ A battle before the app' }));
    const next = screen.getByRole('dialog', { name: 'New battle before the app' });
    expect((within(next).getByRole('spinbutton', { name: 'Battle' }) as HTMLInputElement).value).toBe('2');
    await user.selectOptions(within(next).getByRole('combobox', { name: /Die Silberne Karavane/ }), '-');
    await user.click(within(next).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Battle 2 is in the history.')).toBeTruthy();
    expect(screen.getByText(/After battle 2 · you are leader/)).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'Battles before the app' })).getAllByRole('listitem').map((x) => x.textContent)).toEqual([
      'Battle 1 · Das Urteil im Nebel12 June 2026 · Die Silberne Karavane · Rangvald\'s ReaversChange',
      'Battle 2Rangvald\'s ReaversChange',
    ]);
    // every warband's start moved after the history
    expect(c.enrolments.map((e) => e.tag)).toEqual([expect.objectContaining({ kind: 'start', round: 2 }), expect.objectContaining({ kind: 'start', round: 2 })]);
    // corrected under its id, taken out again
    await user.click(screen.getByRole('button', { name: 'Change Battle 2' }));
    const change = await screen.findByRole('dialog', { name: 'A battle before the app' });
    expect((within(change).getByRole('combobox', { name: /Die Silberne Karavane/ }) as HTMLSelectElement).value).toBe('-');
    await user.click(within(change).getByRole('button', { name: 'Take it out' }));
    expect(await screen.findByText('Taken out of the history.')).toBeTruthy();
    expect(screen.getByText(/After battle 1 · you are leader/)).toBeTruthy();
  });

  it('the overview: battles before the app have no aftermath and nothing to mark', async () => {
    const { srv, c, caravan, reavers } = campaign('player');
    srv.pastBattle(c.id, { round: 1, title: 'Das Urteil im Nebel', outcomes: { [caravan]: 'routed', [reavers]: 'victory' } });
    // Kai's own warband fought it too
    const mine = record({ campaignId: c.id });
    await db.warbands.add(mine);
    c.enrolments.push({ id: 'e-kai', warbandId: mine.id, playerId: KAI.id, player: 'Kai', status: 'active', fromRound: 0, createdAt: T0, confirmedAt: T0, name: mine.name, wbType: 'merc', tag: null });
    srv.state.battles.get([...srv.state.battles.keys()][0]!)!.participants.push({ warbandId: mine.id, outcome: 'defeat' });
    at(`/campaign/${c.id}`);
    const battles = await screen.findByRole('list', { name: 'Battles' });
    expect(within(battles).getByRole('link').textContent).toMatch(/Battle 1 · Das Urteil im Nebel.*before the app/);
    expect(screen.queryByRole('heading', { name: 'Open for you' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Manage' })).toBeNull();
  });

  it('a battle before the app shows who fought and how it ended – no turns, no aftermath', async () => {
    const { srv, c, caravan, reavers } = campaign('player');
    const b = srv.pastBattle(c.id, { round: 1, title: 'Das Urteil im Nebel', playedOn: '2026-06-12', outcomes: { [caravan]: 'routed', [reavers]: 'victory' } });
    if (typeof b === 'string') throw new Error(b);
    at(`/campaign/${c.id}/battles/${b.id}`);
    expect(await screen.findByText(/Played before the app, on 12 June 2026/)).toBeTruthy();
    expect(screen.queryByLabelText('Turn')).toBeNull();
    expect(screen.queryByText(/Aftermath not marked/)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Notes and pictures' })).toBeTruthy();
    expect(screen.getByText('Victory')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '+ Note' })).toBeNull();
  });

  it('once the campaign has a battle of its own, the history is closed', async () => {
    const { srv, c, caravan } = campaign('leader', { totp: true });
    srv.pastBattle(c.id, { round: 1, outcomes: { [caravan]: 'victory' } });
    srv.addBattle(c.id, { title: 'The mill' });
    at(`/campaign/${c.id}/manage`);
    expect(await screen.findByText('The campaign’s own battles have begun: its history is closed.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '+ A battle before the app' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Change/ })).toBeNull();
  });
});

describe('a warband that fought before the app', () => {
  it('takes the campaign’s stage on its roster: the layer on, after the last battle – no stages closed on the way', async () => {
    const { srv, c, reavers } = campaign('player');
    const mine = record({ campaignId: c.id });
    mine.state = { ...mine.state, models: mine.state.models.map((m, i) => (i === 0 ? { ...m, miss: 1 } : m)) };
    await db.warbands.add(mine);
    srv.pastBattle(c.id, { round: 1, outcomes: { [mine.id]: 'victory', [reavers]: 'defeat' } });
    srv.pastBattle(c.id, { round: 2, outcomes: { [mine.id]: 'defeat', [reavers]: 'victory' } });
    const user = userEvent.setup();
    at(`/warbands/${mine.id}`);
    const flag = await screen.findByText(/The Lustria Campaign stands after battle 2, which The Silver Caravan fought before the app; its own stage is Setup/);
    await user.click(within(flag.closest('[role="status"]') as HTMLElement).getByRole('button', { name: 'Take the campaign’s stage' }));
    await waitFor(async () => expect((await db.warbands.get(mine.id))!.state.campaign).toMatchObject({ on: true, round: 2 }));
    const s = (await db.warbands.get(mine.id))!.state;
    // no snapshots, no game missed served – those battles were played before the app
    expect(s.campaign?.snapshots ?? {}).toEqual({});
    expect(s.models[0]!.miss).toBe(1);
    expect(core.tradeLocked(ctxOf(data, s))).toBe(true);
    expect(screen.queryByRole('button', { name: 'Take the campaign’s stage' })).toBeNull();
    expect(await screen.findByText('Stage: After battle 2, as the campaign.')).toBeTruthy();
  });

  it('the stage is asked for only of a warband that fought in the history and stands before it', () => {
    const s = sampleSave();
    const h = { round: 4, warbandIds: ['w1'] };
    expect(stageBehind(s, 'w1', h)).toBe(4);
    expect(stageBehind(s, 'w2', h)).toBeNull();
    expect(stageBehind(s, 'w1', { round: 0, warbandIds: [] })).toBeNull();
    const there = takeStage(ctxOf(data, s), 4);
    expect(there.campaign).toMatchObject({ on: true, round: 4 });
    expect(stageBehind(there, 'w1', h)).toBeNull();
    expect(historyOf({ battles: [
      { id: 'a', round: 1, title: '', status: 'closed', turn: 1, warbands: [], warbandIds: ['w1', 'w2'], createdAt: T0, closedAt: T0, takenOver: true },
      { id: 'b', round: 3, title: '', status: 'closed', turn: 1, warbands: [], warbandIds: ['w1'], createdAt: T0, closedAt: T0, takenOver: true },
    ] })).toMatchObject({ round: 3, warbandIds: ['w1', 'w2'], open: true });
  });
});
