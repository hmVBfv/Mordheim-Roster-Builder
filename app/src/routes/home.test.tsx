/* Home (docs/ui.md §2): the campaigns one plays beside the warbands, and how
   many warbands fit on a phone and on a desktop. Against the stand-in server
   (sync/fakeSync.ts). */
import { ctxOf, writeSave } from '@mordheim/core';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSession, signedIn } from '../account/session.ts';
import { ME as KAI } from '../account/testServer.ts';
import { AppRoutes } from '../app/App.tsx';
import { db } from '../db/db.ts';
import { createFakeSync } from '../sync/fakeSync.ts';
import { stopSync } from '../sync/runner.ts';
import { data, sampleSave } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const saveOf = (name: string) => writeSave(ctxOf(data, { ...sampleSave(), name }));

/** A screen as wide as a desktop (the side navigation is there) – or a phone. */
function wide(on: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: on && q.includes('min-width: 900px'), media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
}

async function seed(n: number) {
  for (let i = 1; i <= n; i++) {
    const name = `Warband ${i}`;
    const at = `2026-09-28T10:${String(i).padStart(2, '0')}:00.000Z`;
    const s = { ...sampleSave(), name };
    await db.warbands.add({ id: `w${i}`, name, wb: s.wb as string, wbName: data.WARBANDS[s.wb as string]!.name, state: s, format: 1, createdAt: at, updatedAt: at });
  }
}

function server() {
  const me = { ...KAI, totp: true };
  const srv = createFakeSync({ me: { id: KAI.id, username: KAI.username, displayName: KAI.displayName }, wbName: (wb) => data.WARBANDS[wb]?.name ?? wb });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost/');
    const path = url.pathname.replace(/^\/api\/v1/, '');
    if (path === '/auth/me') return new Response(JSON.stringify({ user: me, pending: false }), { headers: { 'content-type': 'application/json' } });
    return srv.handle(init?.method ?? 'GET', path, url.searchParams, init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {});
  }));
  signedIn({ stage: 'full', user: me });
  return srv;
}

const main = () => within(screen.getByRole('main'));
/** The links to one's own warbands in the page itself (not the side navigation's). */
const warbandLinks = () => main().queryAllByRole('link').filter((a) => /^\/warbands\/w\d+$/.test(a.getAttribute('href') ?? ''));

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); localStorage.clear(); });
afterEach(async () => { cleanup(); stopSync(); resetSession(); vi.unstubAllGlobals(); await db.warbands.clear(); await db.meta.clear(); });

describe('Home: campaigns', () => {
  it('lists the campaigns in play – role, round, warbands – each a link, the archived one left out', async () => {
    wide(false);
    const srv = server();
    const a = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'leader', others: [{ player: 'Anna', data: saveOf('The Grey Penitents') }, { player: 'Ben', data: saveOf('Clan Skrittle') }] });
    const b = srv.addCampaign({ name: 'Summer in Sylvania', role: 'player', round: 2 });
    const old = srv.addCampaign({ name: 'Old Feud', role: 'player' });
    srv.state.campaigns.get(old.id)!.archivedBy = [KAI.id];
    at('/');
    const list = await within(await screen.findByRole('region', { name: 'Campaigns' })).findByRole('list', { name: 'Your campaigns' });
    const rows = within(list).getAllByRole('link');
    expect(rows.map((r) => r.textContent)).toEqual(['The Hel Fenn CampaignLeader · Setup · 2 warbands', 'Summer in SylvaniaPlayer · After battle 2 · 0 warbands']);
    expect(rows.map((r) => r.getAttribute('href'))).toEqual([`/campaign/${a.id}`, `/campaign/${b.id}`]);
    expect(within(list).queryByText(/Old Feud/)).toBeNull();
    // the list of all of them, with the archive, stays one tap away – it must not jump into a lone campaign
    expect(within(screen.getByRole('region', { name: 'Campaigns' })).getByRole('link', { name: 'All campaigns' }).getAttribute('href')).toBe('/campaign');
  });

  it('says so when none is in play – but not before the list has come', async () => {
    wide(false);
    server();
    at('/');
    const region = await screen.findByRole('region', { name: 'Campaigns' });
    expect(within(region).queryByText(/None in play yet/)).toBeNull();
    expect(await within(region).findByText(/None in play yet/)).toBeTruthy();
  });
});

describe('Home: warbands', () => {
  it('a phone shows the three newest, a desktop six', async () => {
    await seed(8);
    wide(false);
    at('/');
    await vi.waitFor(() => expect(warbandLinks().map((a) => a.textContent)).toEqual(['Warband 8' + data.WARBANDS[sampleSave().wb as string]!.name, 'Warband 7' + data.WARBANDS[sampleSave().wb as string]!.name, 'Warband 6' + data.WARBANDS[sampleSave().wb as string]!.name]));
    cleanup();
    wide(true);
    at('/');
    await vi.waitFor(() => expect(warbandLinks()).toHaveLength(6));
    expect(warbandLinks()[0]!.textContent).toMatch(/^Warband 8/);
    expect(main().getByRole('link', { name: 'All warbands' })).toBeTruthy();
  });
});
