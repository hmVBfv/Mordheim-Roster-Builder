/* Wish #167 (Rob, 30.10.2026), step 2: Vanilla Mordheim for a campaign – chosen when it starts, only the warbands of the rulebook enter it,
   a leader can turn it off and nobody can turn it on later. Against the stand-in server (sync/fakeSync.ts). */
import { FORMAT, ctxOf, stageTotals } from '@mordheim/core';
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
import { createFakeSync } from '../sync/fakeSync.ts';
import { stopSync } from '../sync/runner.ts';
import { ownKey } from '../account/owner.ts';
import { data, sampleSave } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const T0 = '2026-10-05T10:00:00.000Z';
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


describe('a campaign that plays Vanilla Mordheim (#167)', () => {
  it('is off unless ticked when the campaign starts, and the overview says so when it is on', async () => {
    const srv = server({ totp: true });
    const user = userEvent.setup();
    at('/campaign');
    await user.click(await screen.findByRole('button', { name: 'Start a campaign' }));
    const sheet = screen.getByRole('dialog', { name: 'Start a campaign' });
    const box = within(sheet).getByRole('checkbox', { name: /Vanilla Mordheim/ }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(within(sheet).getByText(/only the rulebook/i)).toBeTruthy();
    expect(within(sheet).getByText(/cannot be switched on later/i)).toBeTruthy();
    await user.type(within(sheet).getByLabelText('Name of the campaign'), 'The Vanilla Fenn');
    await user.click(box);
    await user.click(within(sheet).getByRole('button', { name: 'Start it' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'The Vanilla Fenn' })).toBeTruthy();
    expect([...srv.state.campaigns.values()].map((c) => c.vanilla)).toEqual([true]);
    expect(screen.getByText(/ · Vanilla Mordheim$/)).toBeTruthy();
  });

  it('is turned off by a leader on the house rules screen, for good, and no switch turns it on', async () => {
    const srv = server({ totp: true });
    srv.addCampaign({ name: 'The Vanilla Fenn', vanilla: true });
    const user = userEvent.setup();
    at('/campaign/campaign-1/house-rules');
    const card = await screen.findByRole('region', { name: 'Vanilla Mordheim' });
    expect(within(card).getByText(/only the rulebook/i)).toBeTruthy();
    await user.click(within(card).getByRole('button', { name: 'Allow every rule' }));
    await user.click(within(await screen.findByRole('dialog', { name: /Allow every rule/, hidden: true })).getByRole('button', { name: 'Allow every rule', hidden: true }));
    await waitFor(() => expect(srv.state.campaigns.get('campaign-1')!.vanilla).toBe(false));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Vanilla Mordheim' })).toBeNull());
    expect(screen.queryByRole('button', { name: /Vanilla/ })).toBeNull();
  });

  it('is not changed by a player: he reads that it is on', async () => {
    const srv = server();
    srv.addCampaign({ name: 'The Vanilla Fenn', vanilla: true, role: 'player' });
    at('/campaign/campaign-1/house-rules');
    const card = await screen.findByRole('region', { name: 'Vanilla Mordheim' });
    expect(within(card).queryByRole('button')).toBeNull();
  });

  it('lists the warbands of the rulebook to enter, and says why the others cannot', async () => {
    const srv = server();
    srv.addCampaign({ name: 'The Vanilla Fenn', vanilla: true, role: 'player' });
    const rulebook = record({ name: 'The Grey Company' });
    const other = record({ name: 'The Silver Wagons', wb: 'caravans', wbName: 'Merchant Caravans', state: { ...sampleSave(), wb: 'caravans', name: 'The Silver Wagons' } });
    await db.warbands.bulkAdd([rulebook, other]);
    const user = userEvent.setup();
    at('/campaign/campaign-1');
    await user.click(await screen.findByRole('button', { name: 'Enter a warband' }));
    const sheet = await screen.findByRole('dialog', { name: 'Enter a warband' });
    expect((within(sheet).getByRole('radio', { name: /The Grey Company/ }) as HTMLInputElement).disabled).toBe(false);
    const no = within(sheet).getByRole('radio', { name: /The Silver Wagons/ }) as HTMLInputElement;
    expect(no.disabled).toBe(true);
    expect(within(sheet).getByText(/not a warband of the rulebook/i)).toBeTruthy();
    expect(srv.state.campaigns.get('campaign-1')!.enrolments).toHaveLength(0);
  });

  it('offers only the warbands of the rulebook to make for it, and says so', async () => {
    server();
    await db.meta.put({ key: ownKey('campaign:', 'campaign-1'), value: { campaign: { id: 'campaign-1', name: 'The Vanilla Fenn', vanilla: true } } });
    at('/warbands/new?campaign=campaign-1');
    await screen.findByRole('heading', { level: 1 });
    // what the device knows of the campaign is read first; the list narrows when it is there
    expect(await screen.findByText(/plays Vanilla Mordheim: only the warbands of the rulebook/)).toBeTruthy();
    const rows = await screen.findAllByRole('radio');
    expect(rows).toHaveLength(6);
    const wanted = Object.values(data.WARBANDS).filter((w) => w.grade === 'core').map((w) => w.name).sort();
    expect(rows.map((r) => (r.closest('tr')?.querySelector('th, td')?.textContent ?? '').trim()).sort()).toEqual(wanted);
  });

  it('offers every warband for a campaign that does not play it', async () => {
    server();
    await db.meta.put({ key: ownKey('campaign:', 'campaign-1'), value: { campaign: { id: 'campaign-1', name: 'The Plain Fenn', vanilla: false } } });
    at('/warbands/new?campaign=campaign-1');
    await screen.findByRole('heading', { level: 1 });
    expect((await screen.findAllByRole('radio')).length).toBeGreaterThan(30);
    expect(screen.queryByText(/Vanilla Mordheim/)).toBeNull();
  });
});
