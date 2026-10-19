/* The leaders' plans: the red thread of a coming battle, written by its
   number under Background, shown folded to a leader at the battle, and
   handed to the writer by the AI pack. Against the stand-in server. */
import { ctxOf, writeSave } from '@mordheim/core';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSession, signedIn } from '../account/session.ts';
import { ME as KAI } from '../account/testServer.ts';
import { AppRoutes } from '../app/App.tsx';
import { db } from '../db/db.ts';
import { createFakeSync, type FakeRole } from '../sync/fakeSync.ts';
import { stopSync } from '../sync/runner.ts';
import { data, sampleSave } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const saveOf = (name: string) => writeSave(ctxOf(data, { ...sampleSave(), name }));

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });
afterEach(async () => { cleanup(); stopSync(); resetSession(); localStorage.clear(); await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });

function scene(role: FakeRole = 'leader', totp = true) {
  const me = { ...KAI, totp };
  const srv = createFakeSync({ me: { id: KAI.id, username: KAI.username, displayName: KAI.displayName }, wbName: (wb) => data.WARBANDS[wb]?.name ?? wb });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost/');
    const path = url.pathname.replace(/^\/api\/v1/, '');
    if (path === '/auth/me') return new Response(JSON.stringify({ user: me, pending: false }), { headers: { 'content-type': 'application/json' } });
    srv.state.calls.push(`${init?.method ?? 'GET'} ${path}`);
    return srv.handle(init?.method ?? 'GET', path, url.searchParams, init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {});
  }));
  signedIn({ stage: 'full', user: me });
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role, others: [{ player: 'Anna', data: saveOf('The Grey Penitents'), role: role === 'leader' ? 'player' : 'leader' }, { player: 'Ben', data: saveOf('Clan Skrittle') }] });
  return { srv, c };
}

describe('the leaders’ plans', () => {
  it('a leader plans the next battle by its number, edits it and takes it out', async () => {
    const { srv, c } = scene();
    const user = userEvent.setup();
    at(`/campaign/${c.id}/background`);
    await user.click(await screen.findByRole('button', { name: 'Plans' }));
    expect(await screen.findByText('No plan yet.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Plan a battle' }));
    const form = await screen.findByRole('dialog', { name: 'Plan a battle' });
    expect((within(form).getByLabelText('Battle number') as HTMLInputElement).value).toBe('1');
    await user.click(within(form).getByLabelText('The red thread'));
    await user.paste('The ferrymen turn on the Caravan halfway across.');
    await user.click(within(form).getByRole('button', { name: 'Save the plan' }));
    const list = await screen.findByRole('list', { name: 'Plans' });
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(1));
    expect(within(list).getByText('Battle 1 · next')).toBeTruthy();
    expect(srv.state.plans.get(`${c.id}:1`)?.text).toBe('The ferrymen turn on the Caravan halfway across.');
    expect(screen.getByText('Plan for battle 1 saved. Only leaders see it.')).toBeTruthy();

    await user.click(within(list).getByRole('button', { name: 'Edit the plan for battle 1' }));
    const edit = await screen.findByRole('dialog', { name: 'The plan for battle 1' });
    await user.click(within(edit).getByRole('button', { name: 'Take the plan out' }));
    await waitFor(() => expect(srv.state.plans.has(`${c.id}:1`)).toBe(false));
    expect(await screen.findByText('No plan yet.')).toBeTruthy();
  });

  it('another leader’s change in between is not overwritten blindly', async () => {
    const { srv, c } = scene();
    srv.planFrom(c.id, 2, 'One.');
    const user = userEvent.setup();
    at(`/campaign/${c.id}/background`);
    await user.click(await screen.findByRole('button', { name: 'Plans' }));
    await user.click(await screen.findByRole('button', { name: 'Edit the plan for battle 2' }));
    const form = await screen.findByRole('dialog', { name: 'The plan for battle 2' });
    srv.planFrom(c.id, 2, 'Two, by Anna.');
    await user.clear(within(form).getByLabelText('The red thread'));
    await user.type(within(form).getByLabelText('The red thread'), 'Mine.');
    await user.click(within(form).getByRole('button', { name: 'Save the plan' }));
    expect(await within(form).findByText(/Anna changed this plan while you were writing/)).toBeTruthy();
    await user.click(within(form).getByRole('button', { name: 'Save the plan' }));
    await waitFor(() => expect(srv.state.plans.get(`${c.id}:2`)?.text).toBe('Mine.'));
  });

  it('a leader at the battle finds its plan folded; nobody else is even asked for it', async () => {
    const { srv, c } = scene();
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    srv.planFrom(c.id, 1, 'The ferry burns.');
    const user = userEvent.setup();
    at(`/campaign/${c.id}/battles/${b.id}`);
    const own = await screen.findByRole('region', { name: 'Your plan' });
    await user.click(within(own).getByText('Your plan for this battle ⚑'));
    expect(within(own).getByText('The ferry burns.')).toBeTruthy();
    // another device: nothing kept from the leader's visit
    cleanup(); stopSync(); resetSession(); localStorage.clear(); await db.meta.clear();

    const p = scene('player');
    const pb = p.srv.addBattle(p.c.id, { title: 'Hel Fenn ferry' });
    at(`/campaign/${p.c.id}/battles/${pb.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Battle 1 · Hel Fenn ferry' });
    expect(screen.queryByRole('region', { name: 'Your plan' })).toBeNull();
    expect(p.srv.state.calls.filter((x) => x.includes('/plans'))).toEqual([]);
  });
});
