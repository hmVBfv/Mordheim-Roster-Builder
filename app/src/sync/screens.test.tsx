/* The screens of phase 3h as a player reaches them: versions, a copy, a
   warband from the Quick Build, a conflict decided. */
import { FORMAT, ctxOf, writeSave } from '@mordheim/core';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetSession, signedIn } from '../account/session.ts';
import { ME as KAI } from '../account/testServer.ts';
import { AppRoutes } from '../app/App.tsx';
import { db, type StoredWarband } from '../db/db.ts';
import { newId } from '../db/ids.ts';
import { encodeSave } from '../share/link.ts';
import { data, sampleSave } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';
import { syncOnce } from './engine.ts';
import { fakeSyncServer } from './fakeServer.ts';
import { stopSync } from './runner.ts';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const T0 = '2026-10-04T10:00:00.000Z';
const record = (over: Partial<StoredWarband> = {}): StoredWarband => {
  const s = sampleSave();
  return { id: newId(), name: s.name!, wb: s.wb as string, wbName: 'Mercenaries', state: s, format: FORMAT, createdAt: T0, updatedAt: T0, ownerId: KAI.id, origin: 'save', ...over };
};

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); });
afterEach(async () => { cleanup(); stopSync(); resetSession(); localStorage.clear(); await db.warbands.clear(); await db.meta.clear(); });

/** The stand-in server, signed in as Kai, with /auth/me answered. */
function server() {
  const srv = fakeSyncServer();
  const handle = srv.handle;
  srv.handle = (method, path, query, body) => (path === '/auth/me' ? new Response(JSON.stringify({ user: KAI, pending: false }), { headers: { 'content-type': 'application/json' } }) : handle(method, path, query, body));
  signedIn({ stage: 'full', user: KAI });
  return srv;
}

describe('versions', () => {
  it('a version saved with a note; an older one brought back', async () => {
    const srv = server();
    const w = record();
    await db.warbands.add(w);
    await syncOnce({ userId: KAI.id, data: async () => data });
    const user = userEvent.setup();
    at(`/warbands/${w.id}/versions`);
    const list = await screen.findByRole('list', { name: 'Versions' });
    expect(within(list).getByText(/Version 1 · this one/)).toBeTruthy();
    await user.type(screen.getByLabelText('A note for this version (optional)'), 'before the Docks');
    await user.click(screen.getByRole('button', { name: 'Save a version' }));
    expect(await screen.findByText('Version 2 saved.')).toBeTruthy();
    expect(await within(list).findByText(/“before the Docks”/)).toBeTruthy();
    await user.click(within(list).getByRole('button', { name: 'Version 1: what to do' }));
    const sheet = screen.getByRole('dialog', { name: 'Version 1' });
    await user.click(within(sheet).getByRole('button', { name: 'Bring back' }));
    expect(await screen.findByText('Version 1 is the newest again (version 3).')).toBeTruthy();
    expect(srv.state.warbands.get(w.id)!.headRev).toBe(3);
  });

  it('signed out: versions need the account', async () => {
    // a server that knows nobody
    fakeSyncServer();
    const w = record();
    await db.warbands.add(w);
    at(`/warbands/${w.id}/versions`);
    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeTruthy();
  });
});

describe('a copy from the roster', () => {
  it('opens the copy, the original stays', async () => {
    server();
    const w = record();
    await db.warbands.add(w);
    const user = userEvent.setup();
    at(`/warbands/${w.id}`);
    await user.click(await screen.findByRole('button', { name: 'Make a copy' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'The Silver Caravan (copy)' })).toBeTruthy();
    expect((await db.warbands.toArray()).map((x) => x.name).sort()).toEqual(['The Silver Caravan', 'The Silver Caravan (copy)']);
  });
});

describe('from the Quick Build', () => {
  it('the link’s warband is shown and added; the fragment leaves the address bar', async () => {
    server();
    const fragment = await encodeSave(writeSave(ctxOf(data, { ...sampleSave(), name: 'Planned at lunch' })));
    window.history.replaceState(null, '', `/import#${fragment}`);
    const user = userEvent.setup();
    at('/import');
    expect(await screen.findByRole('heading', { level: 2, name: 'Planned at lunch' })).toBeTruthy();
    expect(window.location.hash).toBe('');
    await user.click(screen.getByRole('button', { name: 'Add as a new warband' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Planned at lunch' })).toBeTruthy();
    expect((await db.warbands.toArray())[0]).toMatchObject({ ownerId: KAI.id, origin: 'import' });
  });
});

describe('a conflict on the roster', () => {
  it('asks which to keep, and takes the other one', async () => {
    server();
    const w = record({ serverRev: 1, syncedAt: T0, conflict: { kind: 'draft', draft: { data: writeSave(ctxOf(data, { ...sampleSave(), name: 'From the laptop' })), device: 'Firefox on Linux', updatedAt: T0, seq: 9, baseRev: 1 } } });
    await db.warbands.add(w);
    const user = userEvent.setup();
    at(`/warbands/${w.id}`);
    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toMatch(/Changed on another device as well \(Firefox on Linux\)/);
    await user.click(within(banner).getByRole('button', { name: 'Take the other one' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'From the laptop' })).toBeTruthy();
  });
});
