/* The game night as the table uses it (phase 4a2): a leader sets up a
   battle and writes its protocol – also without a connection, nothing is
   lost – players see it and suggest corrections, the leader takes them
   over or not. Against the stand-in server (sync/fakeSync.ts). */
import { ctxOf, stageTotals, writeSave } from '@mordheim/core';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSession, signedIn } from '../account/session.ts';
import { ME as KAI } from '../account/testServer.ts';
import { AppRoutes } from '../app/App.tsx';
import { db } from '../db/db.ts';
import { readSave } from '../sync/engine.ts';
import { createFakeSync } from '../sync/fakeSync.ts';
import { stopSync } from '../sync/runner.ts';
import { data, sampleSave } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const saveOf = (name: string) => writeSave(ctxOf(data, { ...sampleSave(), name }));
const totals = (save: unknown) => stageTotals(ctxOf(data, readSave(data, save)!));

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });
afterEach(async () => { cleanup(); stopSync(); resetSession(); localStorage.clear(); await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });

/** The stand-in server behind fetch, signed in as Kai; `down` makes the next requests fail as offline. */
function server(o: { totp?: boolean } = {}) {
  const me = { ...KAI, totp: !!o.totp };
  const srv = createFakeSync({ me: { id: KAI.id, username: KAI.username, displayName: KAI.displayName }, totals, wbName: (wb) => data.WARBANDS[wb]?.name ?? wb });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (srv.state.down) throw new TypeError('Failed to fetch');
    const url = new URL(String(input), 'http://localhost/');
    const path = url.pathname.replace(/^\/api\/v1/, '');
    if (path === '/auth/me') return new Response(JSON.stringify({ user: me, pending: false }), { headers: { 'content-type': 'application/json' } });
    srv.state.calls.push(`${init?.method ?? 'GET'} ${path}`);
    return srv.handle(init?.method ?? 'GET', path, url.searchParams, init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {});
  }));
  signedIn({ stage: 'full', user: me });
  return srv;
}

const others = () => [
  { player: 'Anna', data: saveOf('The Grey Penitents') },
  { player: 'Ben', data: saveOf('Clan Skrittle') },
];

describe('setting up a battle', () => {
  it('a leader picks who fights and opens the game night; members see it listed', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const user = userEvent.setup();
    at(`/campaign/${c.id}`);
    await user.click(await screen.findByRole('button', { name: 'New battle' }));
    const sheet = screen.getByRole('dialog', { name: 'Battle 1' });
    expect(within(sheet).getAllByRole('checkbox').map((x) => (x as HTMLInputElement).checked)).toEqual([true, true]);
    await user.type(within(sheet).getByLabelText('Title (optional)'), 'Hel Fenn ferry');
    await user.selectOptions(await within(sheet).findByRole('combobox'), 'artisanquarter');
    await user.click(within(sheet).getByRole('button', { name: 'Start the game night' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Battle 1 · Hel Fenn ferry' })).toBeTruthy();
    expect([...srv.state.battles.values()]).toMatchObject([{ title: 'Hel Fenn ferry', district: 'artisanquarter', participants: [{ outcome: '' }, { outcome: '' }] }]);
    // full screen on the phone: the game night's own buttons, not the navigation
    expect(screen.getByRole('button', { name: '+ Casualty' })).toBeTruthy();
    cleanup();
    at(`/campaign/${c.id}`);
    expect((await screen.findByRole('list', { name: 'Battles' })).textContent).toMatch(/Battle 1 · Hel Fenn ferry.*live/);
  });
});

describe('the protocol', () => {
  it('a leader enters who went out of action, by whom; corrects it; takes it out', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    const [penitents, skrittle] = b.participants.map((p) => p.warbandId) as [string, string];
    const user = userEvent.setup();
    at(`/campaign/${c.id}/battles/${b.id}`);
    await user.click(await screen.findByRole('button', { name: 'Next turn' }));
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    expect(screen.getByText('Turn 3')).toBeTruthy();
    await waitFor(() => expect(srv.state.battles.get(b.id)!.turn).toBe(3));

    await user.click(screen.getByRole('button', { name: '+ Casualty' }));
    const sheet = screen.getByRole('dialog', { name: 'Out of action · turn 3' });
    const [victimWb, attackerWb] = within(sheet).getAllByRole('combobox', { name: 'Warband' });
    await user.selectOptions(victimWb!, penitents);
    const victim = await within(sheet).findByRole('combobox', { name: 'Who' });
    const first = within(victim).getAllByRole('option')[1]!;
    await user.selectOptions(victim, first);
    await user.selectOptions(attackerWb!, skrittle);
    await user.type(within(sheet).getByLabelText('What happened (optional)'), 'into the black water');
    await user.click(within(sheet).getByRole('button', { name: 'Add to the protocol' }));
    const protocol = screen.getByRole('list', { name: 'Protocol' });
    expect(await within(protocol).findByText(/is out of action/)).toBeTruthy();
    await waitFor(() => expect(srv.state.battles.get(b.id)!.entries).toHaveLength(1));
    const entry = srv.state.battles.get(b.id)!.entries[0]!;
    expect(entry).toMatchObject({ turn: 3, kind: 'casualty', payload: { victim: { warbandId: penitents, name: first.textContent }, attacker: { warbandId: skrittle, name: 'Clan Skrittle' }, note: 'into the black water' } });
    expect(protocol.textContent).toContain(`${first.textContent} (The Grey Penitents) is out of action – by someone of Clan Skrittle. into the black water`);

    await user.click(within(protocol).getByRole('button', { name: 'Correct' }));
    const fix = screen.getByRole('dialog', { name: 'Correct the casualty' });
    await user.selectOptions(within(fix).getAllByRole('combobox', { name: 'Warband' })[1]!, 'env');
    await user.click(within(fix).getByRole('button', { name: 'Save the correction' }));
    await waitFor(() => expect(srv.state.battles.get(b.id)!.entries[0]!.payload).toMatchObject({ attacker: { name: 'The surroundings', env: true } }));
    expect(srv.state.battles.get(b.id)!.entries).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: '+ Event' }));
    await user.type(within(screen.getByRole('dialog', { name: 'Event · turn 3' })).getByLabelText('What happened'), 'The ferry drifts.');
    await user.click(within(screen.getByRole('dialog', { name: 'Event · turn 3' })).getByRole('button', { name: 'Add to the protocol' }));
    await waitFor(() => expect(srv.state.battles.get(b.id)!.entries).toHaveLength(2));
    await user.click(screen.getByRole('button', { name: 'Undo last' }));
    await waitFor(() => expect(srv.state.battles.get(b.id)!.entries.filter((e) => !e.deleted)).toHaveLength(1));
    expect(within(protocol).queryByText('The ferry drifts.')).toBeNull();

    await user.selectOptions(screen.getByLabelText('Outcome for The Grey Penitents'), 'victory');
    expect(await screen.findByText('Outcome saved.')).toBeTruthy();
    expect(srv.state.battles.get(b.id)!.participants.find((p) => p.warbandId === penitents)!.outcome).toBe('victory');
  });

  it('without a connection nothing is lost: the entry waits on this phone and goes when the server answers', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const b = srv.addBattle(c.id);
    const user = userEvent.setup();
    at(`/campaign/${c.id}/battles/${b.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Battle 1' });
    srv.state.down = true;
    await user.click(screen.getByRole('button', { name: '+ Event' }));
    const ev = screen.getByRole('dialog', { name: 'Event · turn 1' });
    await user.type(within(ev).getByLabelText('What happened'), 'A building collapses.');
    await user.click(within(ev).getByRole('button', { name: 'Add to the protocol' }));
    const protocol = screen.getByRole('list', { name: 'Protocol' });
    expect(await within(protocol).findByText('A building collapses.')).toBeTruthy();
    expect(within(protocol).getByText(/on this phone/)).toBeTruthy();
    expect(await screen.findByText('⏳ 1 waiting')).toBeTruthy();
    expect(await db.outbox.count()).toBe(1);
    expect(srv.state.battles.get(b.id)!.entries).toHaveLength(0);

    srv.state.down = false;
    const { flushOutbox } = await import('./outbox.ts');
    expect(await flushOutbox(KAI.id)).toBe(1);
    expect(srv.state.battles.get(b.id)!.entries).toMatchObject([{ kind: 'event', payload: { text: 'A building collapses.' } }]);
    expect(await db.outbox.count()).toBe(0);
    // sent twice (the answer lost): there once
    expect(await flushOutbox(KAI.id)).toBe(0);
  });

  it('a player only reads the protocol and suggests corrections; the leader takes one over', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: [{ ...others()[0]!, role: 'leader' }, others()[1]!] });
    const b = srv.addBattle(c.id);
    srv.entryElsewhere(b.id, { id: '11111111-1111-4111-8111-111111111111', turn: 2, kind: 'event', payload: { text: 'Rain.' }, author: 'Anna' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/battles/${b.id}`);
    const protocol = await screen.findByRole('list', { name: 'Protocol' });
    expect(await within(protocol).findByText('Rain.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '+ Casualty' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next turn' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: /Outcome for/ })).toBeNull();
    await user.click(within(protocol).getByRole('button', { name: 'Suggest a correction' }));
    const sheet = screen.getByRole('dialog', { name: 'Suggest a correction' });
    expect(within(sheet).getByText(/About: “Rain.”/)).toBeTruthy();
    await user.type(within(sheet).getByLabelText('What should it say?'), 'It was snow.');
    await user.click(within(sheet).getByRole('button', { name: 'Send to the leader' }));
    expect(await screen.findByText('Sent to the leader.')).toBeTruthy();
    await waitFor(() => expect(srv.state.battles.get(b.id)!.proposals).toMatchObject([{ targetType: 'protocol_entry', targetId: '11111111-1111-4111-8111-111111111111', payload: { text: 'It was snow.' }, status: 'open' }]));
    expect(within(await screen.findByRole('list', { name: 'Corrections' })).getByText('It was snow.')).toBeTruthy();
  });

  it('the leader takes a correction over or rejects it', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const b = srv.addBattle(c.id);
    b.proposals.push({ id: 'p1', targetType: 'battle', targetId: b.id, authorId: 'user-ben', author: 'Ben', payload: { text: 'We held, we did not rout.' }, status: 'open', decidedBy: null, createdAt: '2026-10-05T20:00:00Z' });
    b.proposals.push({ id: 'p2', targetType: 'battle', targetId: b.id, authorId: 'user-anna', author: 'Anna', payload: { text: 'It was turn 5.' }, status: 'open', decidedBy: null, createdAt: '2026-10-05T20:01:00Z' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/battles/${b.id}`);
    const list = await screen.findByRole('list', { name: 'Corrections' });
    await user.click(within(within(list).getAllByRole('listitem')[0]!).getByRole('button', { name: 'Take over' }));
    expect(await screen.findByText(/Taken over/)).toBeTruthy();
    await user.click(within(list).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(b.proposals.map((p) => p.status)).toEqual(['accepted', 'rejected']));
    expect(within(list).queryByRole('button', { name: 'Take over' })).toBeNull();
  });
});
