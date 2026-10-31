/* Wish #169 (Rob, 30.10.2026): the opening scene of a campaign's place, under World. What a leader wrote, or – while nothing is written –
   the Lore's description of the place, marked as such; leaders write it, everybody reads it. Against the stand-in server (sync/fakeSync.ts). */
import { ctxOf, stageTotals } from '@mordheim/core';
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
import { data } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const totals = (save: unknown) => stageTotals(ctxOf(data, readSave(data, save)!));

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



const KHEMRI = /A dead city at the heart of the Land of the Dead/;

describe('the opening scene under World (#169)', () => {
  it('shows the Lore\'s description of the place while nothing is written, and says where it is from', async () => {
    const srv = server();
    srv.addCampaign({ name: 'The Khemri Campaign', place: 'khemri', role: 'player' });
    at('/campaign/campaign-1/world');
    const scene = await screen.findByRole('region', { name: 'Opening scene' });
    expect(await within(scene).findByText(KHEMRI)).toBeTruthy();
    expect(within(scene).getByText('From the Lore · Khemri')).toBeTruthy();
    expect(within(scene).queryByRole('button')).toBeNull();
  });

  it('shows what the leaders wrote instead, and the Lore no more', async () => {
    const srv = server();
    srv.addCampaign({ name: 'The Khemri Campaign', place: 'khemri', opening: 'The caravan reaches the dunes at dusk.', role: 'player' });
    at('/campaign/campaign-1/world');
    const scene = await screen.findByRole('region', { name: 'Opening scene' });
    expect(within(scene).getByText('The caravan reaches the dunes at dusk.')).toBeTruthy();
    expect(within(scene).getByText('Written by the leaders')).toBeTruthy();
    expect(within(scene).queryByText(KHEMRI)).toBeNull();
  });

  it('a leader writes their own, starting from the Lore\'s text, and goes back to the Lore\'s', async () => {
    const srv = server({ totp: true });
    srv.addCampaign({ name: 'The Khemri Campaign', place: 'khemri' });
    const user = userEvent.setup();
    at('/campaign/campaign-1/world');
    const scene = await screen.findByRole('region', { name: 'Opening scene' });
    await user.click(await within(scene).findByRole('button', { name: 'Write your own' }));
    const sheet = await screen.findByRole('dialog', { name: 'Opening scene', hidden: true });
    const box = within(sheet).getByRole('textbox', { name: 'The opening scene', hidden: true }) as HTMLTextAreaElement;
    expect(box.value).toMatch(KHEMRI);
    await user.clear(box);
    await user.type(box, 'The caravan reaches the dunes at dusk.');
    await user.click(within(sheet).getByRole('button', { name: 'Save', hidden: true }));
    await waitFor(() => expect(srv.state.campaigns.get('campaign-1')!.opening).toBe('The caravan reaches the dunes at dusk.'));
    expect(await within(scene).findByText('The caravan reaches the dunes at dusk.')).toBeTruthy();
    await user.click(within(scene).getByRole('button', { name: 'Use the Lore text' }));
    await waitFor(() => expect(srv.state.campaigns.get('campaign-1')!.opening).toBe(''));
    expect(await within(scene).findByText(KHEMRI)).toBeTruthy();
  });

  it('with no place and nothing written says so, and offers a leader to write one', async () => {
    const srv = server({ totp: true });
    srv.addCampaign({ name: 'The Plain Campaign' });
    at('/campaign/campaign-1/world');
    const scene = await screen.findByRole('region', { name: 'Opening scene' });
    expect(within(scene).getByText('No opening scene yet.')).toBeTruthy();
    expect(within(scene).getByRole('button', { name: 'Write your own' })).toBeTruthy();
  });
});
