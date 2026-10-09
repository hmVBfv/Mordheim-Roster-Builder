/* A campaign's house rules (phase 4a4): a leader sets them for every
   warband, players read them; a warband whose own file differs is marked
   and takes them over; a copy entered in the campaign plays by them from
   the start. Against the stand-in server (sync/fakeSync.ts). */
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
import { readSave, syncOnce } from '../sync/engine.ts';
import { createFakeSync } from '../sync/fakeSync.ts';
import { stopSync } from '../sync/runner.ts';
import { data, sampleSave } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const T0 = '2026-10-05T10:00:00.000Z';
const totals = (save: unknown) => stageTotals(ctxOf(data, readSave(data, save)!));
const saveOf = (name: string, house?: Record<string, unknown>) => writeSave(ctxOf(data, { ...sampleSave(), name, ...(house ? { house } : {}) }));
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
  const srv = createFakeSync({ me: { id: KAI.id, username: KAI.username, displayName: KAI.displayName }, totals, wbName: (wb) => data.WARBANDS[wb]?.name ?? wb, districtName: (id) => data.DISTRICTS.find((d) => d.id === id)?.name ?? id });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost/');
    const path = url.pathname.replace(/^\/api\/v1/, '');
    if (path === '/auth/me') return new Response(JSON.stringify({ user: me, pending: false }), { headers: { 'content-type': 'application/json' } });
    return srv.handle(init?.method ?? 'GET', path, url.searchParams, init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {});
  }));
  signedIn({ stage: 'full', user: me });
  return srv;
}

describe('the campaign’s house rules', () => {
  it('a leader sets them for every warband, with Undo; whose own file differs is listed', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [{ player: 'Anna', data: saveOf('The Grey Penitents', { priceArmour: 80 }) }, { player: 'Ben', data: saveOf('Clan Skrittle') }] });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/manage`);
    await user.click(await screen.findByRole('link', { name: 'Set the house rules' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'House rules' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Warbands that differ' }).textContent).toBe('The Grey Penitents (Anna): Armour');
    await user.click(screen.getByRole('checkbox', { name: 'All daggers free' }));
    await waitFor(() => expect(c.houseRules).toMatchObject({ freeDagger: true }));
    expect(await screen.findByText('All daggers free: house rule on – for every warband.')).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'Warbands that differ' })).getAllByRole('listitem').map((x) => x.textContent)).toEqual([
      'The Grey Penitents (Anna): Armour, All daggers free',
      'Clan Skrittle (Ben): All daggers free',
    ]);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(c.houseRules).toMatchObject({ freeDagger: false }));
    // the overview marks a warband whose own rules differ, for everyone
    cleanup();
    at(`/campaign/${c.id}`);
    const list = await screen.findByRole('list', { name: 'Warbands' });
    expect(within(list).getAllByRole('link').map((a) => /own house rules differ/.test(a.textContent ?? ''))).toEqual([true, false]);
  });

  it('a player reads them – what is on, no switches', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: [{ player: 'Anna', data: saveOf('The Grey Penitents'), role: 'leader' }] });
    c.houseRules = { freeDagger: true, notes: 'Daggers are on the house.' };
    at(`/campaign/${c.id}/house-rules`);
    expect(await screen.findByText(/leaders set these for every warband/)).toBeTruthy();
    expect(screen.getByText('All daggers free')).toBeTruthy();
    expect(screen.getByText('Daggers are on the house.')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText('Everything else is played as written.')).toBeTruthy();
  });
});

describe('a warband in the campaign', () => {
  it('its own file differs: marked on the roster and its House rules, taken over in one tap', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: [{ player: 'Anna', data: saveOf('The Grey Penitents'), role: 'leader' }] });
    c.houseRules = { freeDagger: true };
    const mine = record({ campaignId: c.id });
    await db.warbands.add(mine);
    const user = userEvent.setup();
    at(`/warbands/${mine.id}`);
    await user.click(await screen.findByRole('link', { name: '⚠ House rules differ from the campaign’s' }));
    const flag = await screen.findByRole('status');
    expect(flag.textContent).toMatch(/The Silver Caravan’s own file differs – All daggers free/);
    // the campaign's rules, not switches the player cannot use; the display setting stays his
    expect(screen.queryByRole('checkbox', { name: 'All daggers free' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Show rarity on the cards' })).toBeTruthy();
    await user.click(within(flag).getByRole('button', { name: 'Take The Hel Fenn Campaign’s rules' }));
    await waitFor(async () => expect(core.houseRules((await db.warbands.get(mine.id))!.state).freeDagger).toBe(true));
    expect(screen.queryByText(/own file differs/)).toBeNull();
  });

  it('a copy entered plays by the campaign’s rules from the start', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign' });
    c.houseRules = { freeDagger: true };
    const mine = record();
    await db.warbands.add(mine);
    await syncOnce({ userId: KAI.id, data: async () => data });
    const user = userEvent.setup();
    at(`/campaign/${c.id}`);
    await user.click(await screen.findByRole('button', { name: 'Enter a warband' }));
    const sheet = screen.getByRole('dialog', { name: 'Enter a warband' });
    // the warbands of the device come a moment after the sheet
    await user.click(await within(sheet).findByRole('radio', { name: /The Silver Caravan/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Enter a copy' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'The Silver Caravan' })).toBeTruthy();
    const copy = (await db.warbands.toArray()).find((w) => w.id !== mine.id)!;
    expect(core.houseRules(copy.state).freeDagger).toBe(true);
    expect((srv.state.warbands.get(copy.id)!.versions[0]!.data as { house?: { freeDagger?: boolean } }).house?.freeDagger).toBe(true);
    // the warband picked keeps its own
    expect(core.houseRules((await db.warbands.get(mine.id))!.state).freeDagger).toBe(false);
    expect(srv.state.campaigns.get(c.id)!.enrolments[0]).toMatchObject({ status: 'active' });
  });
});

describe('the districts', () => {
  it('a player sets a foothold by hand, with the others’ beside it; the overview shows who holds what – a sole foothold is control', async () => {
    const srv = server();
    const skrittle = { ...sampleSave(), name: 'Clan Skrittle', campaign: { on: true, districts: { artisanquarter: 'foothold' as const, richquarter: 'foothold' as const } } };
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: [{ player: 'Ben', data: writeSave(ctxOf(data, skrittle)), role: 'leader' }] });
    const mine = record({ campaignId: c.id });
    await db.warbands.add(mine);
    const user = userEvent.setup();
    at(`/campaign/${c.id}`);
    const map = await screen.findByRole('list', { name: 'Districts held' });
    expect(within(map).getAllByRole('listitem').map((x) => x.textContent)).toEqual(['Artisan QuarterClan Skrittlecontrol', `${data.DISTRICTS.find((d) => d.id === 'richquarter')!.name}Clan Skrittlecontrol`]);
    cleanup();

    at(`/warbands/${mine.id}`);
    await user.click(await screen.findByRole('link', { name: 'Districts' }));
    const artisan = await screen.findByRole('group', { name: 'Artisan Quarter' });
    // the others' footholds, as this device last saw the campaign
    expect(await within(artisan.parentElement!).findByText('Also a foothold here: Clan Skrittle')).toBeTruthy();
    await user.click(within(artisan).getByRole('button', { name: 'Foothold' }));
    await waitFor(async () => expect((await db.warbands.get(mine.id))!.state.campaign?.districts?.artisanquarter).toBe('foothold'));
    expect(within(artisan).getByRole('button', { name: 'Foothold' }).getAttribute('aria-pressed')).toBe('true');
    expect(await screen.findByText('Artisan Quarter: foothold.')).toBeTruthy();
  });
});
