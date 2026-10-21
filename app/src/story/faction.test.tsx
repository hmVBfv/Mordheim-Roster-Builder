/* A warrior's faction (ADR 0023, Rob 20.10.2026 "einer bereits erdachten Fraktion zugeordnet"): picked from one's
   own Library in the profile; the warband keeps its name and the id of the entry, so the name reads on without the Library. */
import * as core from '@mordheim/core';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSession, signedIn } from '../account/session.ts';
import { ME as KAI } from '../account/testServer.ts';
import { AppRoutes } from '../app/App.tsx';
import { db } from '../db/db.ts';
import { createWarband } from '../roster/view.ts';
import { createFakeSync } from '../sync/fakeSync.ts';
import { stopSync } from '../sync/runner.ts';
import { data } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';

const NOW = '2026-10-21T10:00:00.000Z';
const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const stored = async () => (await db.warbands.get('w1'))!.state;

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
beforeAll(async () => { await import('./Story.tsx'); }, SCREENS_MS);
beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); });
afterEach(async () => { cleanup(); stopSync(); resetSession(); localStorage.clear(); vi.unstubAllGlobals(); await db.warbands.clear(); await db.meta.clear(); });

function band(): core.WarbandState {
  const c = (s: core.WarbandState) => core.ctxOf(data, s);
  let s: core.WarbandState = createWarband(data, 'merc', null, 'The Grey Company');
  s = core.addUnit(c(s), 'capt');
  return s;
}
const seed = (s: core.WarbandState) =>
  db.warbands.add({ id: 'w1', name: s.name ?? '', wb: s.wb as string, wbName: data.WARBANDS[s.wb as string]!.name, state: s, format: core.FORMAT, createdAt: NOW, updatedAt: NOW });

/** The stand-in server behind fetch, signed in as Kai; his Library is the one the test fills. */
function server() {
  const me = { ...KAI };
  const srv = createFakeSync({ me: { id: KAI.id, username: KAI.username, displayName: KAI.displayName } });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost/');
    const path = url.pathname.replace(/^\/api\/v1/, '');
    if (path === '/auth/me') return new Response(JSON.stringify({ user: me, pending: false }), { headers: { 'content-type': 'application/json' } });
    return srv.handle(init?.method ?? 'GET', path, url.searchParams, init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {});
  }));
  signedIn({ stage: 'full', user: me });
  return srv;
}

const openProfile = async (user: ReturnType<typeof userEvent.setup>, uid: number) => {
  at(`/warbands/w1/story?who=${uid}`);
  const life = await screen.findByRole('dialog', { name: /Mercenary Captain/ });
  await user.click(within(life).getByRole('button', { name: 'Edit the profile' }));
  return screen.findByRole('dialog', { name: /Mercenary Captain: names, voice, story/ });
};

describe('a warrior’s faction', () => {
  it('is picked from the Library: the warband keeps its name and the id, and the life shows it', async () => {
    const srv = server();
    const bell = srv.libraryFrom({ name: 'The Bell-ringers', kind: 'faction', body: { de: '', status: '', lore: '' } });
    srv.libraryFrom({ name: 'An idea', body: { text: 'x', topic: 'other' } });
    const s0 = band();
    await seed(s0);
    const user = userEvent.setup();
    const sheet = await openProfile(user, s0.models[0]!.uid);
    const pick = await within(sheet).findByLabelText('Faction');
    expect(within(pick).getAllByRole('option').map((o) => o.textContent)).toEqual(['None', 'The Bell-ringers']);
    await user.selectOptions(pick, bell.id);
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect(core.profileOf((await stored()).models[0])).toMatchObject({ faction: 'The Bell-ringers', faction_id: bell.id }));

    // the list names it beside him, and his life reads it
    const heroes = await screen.findByRole('group', { name: 'Heroes' });
    await waitFor(() => expect(heroes.textContent).toContain('The Bell-ringers'));
    await user.click(within(heroes).getByRole('button', { name: /Mercenary Captain/ }));
    const life = await screen.findByRole('dialog', { name: /Mercenary Captain/ });
    expect(within(life).getByText('The Bell-ringers')).toBeTruthy();

    // leaving the faction takes both away
    await user.click(within(life).getByRole('button', { name: 'Edit the profile' }));
    const again = await screen.findByRole('dialog', { name: /Mercenary Captain: names, voice, story/ });
    await user.selectOptions(await within(again).findByLabelText('Faction'), '');
    await user.click(within(again).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect(core.profileOf((await stored()).models[0])).toEqual({}));
  });

  it('stays when the Library no longer has it: the name is the warband’s own', async () => {
    const srv = server();
    srv.libraryFrom({ name: 'The Ferrymen', kind: 'faction', body: { de: '', status: '', lore: '' } });
    const s0 = band();
    await seed(core.setProfile(core.ctxOf(data, s0), s0.models[0]!.uid, { faction: 'The Lost Order', faction_id: '3f2a9c1e-5b7d-4f60-9a1c-2d8e7b6a5f40', voice: 'Few words.' }));
    const user = userEvent.setup();
    const sheet = await openProfile(user, s0.models[0]!.uid);
    const pick = await within(sheet).findByLabelText('Faction') as HTMLSelectElement;
    await waitFor(() => expect(within(pick).getAllByRole('option').map((o) => o.textContent)).toEqual(['None', 'The Ferrymen', 'The Lost Order (not in your Library)']));
    expect(pick.value).toBe('3f2a9c1e-5b7d-4f60-9a1c-2d8e7b6a5f40');
    // saving something else does not drop it
    await user.type(within(sheet).getByLabelText('Name (English)'), 'Aldric');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect(core.profileOf((await stored()).models[0])).toMatchObject({ name_en: 'Aldric', faction: 'The Lost Order', faction_id: '3f2a9c1e-5b7d-4f60-9a1c-2d8e7b6a5f40' }));
  });

  it('signed out there is nothing to pick from, and the faction the warband has is still read', async () => {
    const s0 = band();
    await seed(core.setProfile(core.ctxOf(data, s0), s0.models[0]!.uid, { faction: 'The Bell-ringers', faction_id: '3f2a9c1e-5b7d-4f60-9a1c-2d8e7b6a5f40' }));
    const user = userEvent.setup();
    at(`/warbands/w1/story?who=${s0.models[0]!.uid}`);
    const life = await screen.findByRole('dialog', { name: /Mercenary Captain/ });
    expect(within(life).getByText('The Bell-ringers')).toBeTruthy();
    await user.click(within(life).getByRole('button', { name: 'Edit the profile' }));
    const sheet = await screen.findByRole('dialog', { name: /Mercenary Captain: names, voice, story/ });
    expect(within(sheet).queryByLabelText('Faction')).toBeNull();
    await user.type(within(sheet).getByLabelText('Name (English)'), 'Aldric');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect(core.profileOf((await stored()).models[0])).toMatchObject({ name_en: 'Aldric', faction: 'The Bell-ringers' }));
  });
});
