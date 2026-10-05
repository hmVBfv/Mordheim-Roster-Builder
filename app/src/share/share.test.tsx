/* Sharing a warband as players reach it (Rob, 05.10.2026): "Share…" on the
   roster sends a copy to another player or makes a short code; a copy sent
   waits under "Open for you"; a code is entered on Warbands. Always a copy
   of one's own – against the stand-in server (sync/fakeSync.ts). */
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
import { syncOnce } from '../sync/engine.ts';
import { fakeSyncServer } from '../sync/fakeServer.ts';
import { stopSync } from '../sync/runner.ts';
import { data, sampleSave } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';
import { acceptShare } from './take.ts';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const T0 = '2026-10-05T10:00:00.000Z';
const record = (over: Partial<StoredWarband> = {}): StoredWarband => {
  const s = sampleSave();
  return { id: newId(), name: s.name!, wb: s.wb as string, wbName: 'Mercenaries', state: s, format: FORMAT, createdAt: T0, updatedAt: T0, ownerId: KAI.id, origin: 'save', ...over };
};
const saveOf = (name: string) => writeSave(ctxOf(data, { ...sampleSave(), name }));

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

describe('Share… on the roster', () => {
  it('a copy to another player; a share code, shown once; taken back', async () => {
    const srv = server();
    const w = record();
    await db.warbands.add(w);
    const user = userEvent.setup();
    at(`/warbands/${w.id}`);

    await user.click(await screen.findByRole('button', { name: 'Share…' }));
    let sheet = screen.getByRole('dialog', { name: 'Share The Silver Caravan' });
    expect(within(sheet).getByRole('button', { name: 'Send the copy' })).toHaveProperty('disabled', true);
    await user.click(await within(sheet).findByRole('radio', { name: /^Ben\b/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Send the copy' }));
    expect(await screen.findByText('Sent to Ben. It waits under “Open for you”.')).toBeTruthy();
    expect(srv.state.shares).toMatchObject([{ toId: 'user-ben', name: 'The Silver Caravan', code: null, mine: true, data: { name: 'The Silver Caravan', wb: w.wb } }]);

    await user.click(screen.getByRole('button', { name: 'Share…' }));
    sheet = screen.getByRole('dialog', { name: 'Share The Silver Caravan' });
    await user.click(within(sheet).getByRole('button', { name: 'Make a share code' }));
    expect((await within(sheet).findByLabelText('Share code')).textContent).toBe('K7M2-Q9XD');
    expect(within(sheet).getByText(/enters it under Warbands → “Enter a share code”/)).toBeTruthy();
    const open = await within(sheet).findByRole('list');
    expect(within(open).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^The Silver Caravanto Ben · until/),
      expect.stringMatching(/^The Silver Caravancode · taken 0× · until/),
    ]);
    await user.click(within(within(open).getAllByRole('listitem')[1]!).getByRole('button', { name: 'Take back' }));
    expect(await screen.findByText('Taken back.')).toBeTruthy();
    expect(srv.state.shares[1]!.revokedAt).toBeTruthy();
    expect(await within(sheet).findAllByRole('listitem')).toHaveLength(1);
  });

  it('only with the account: signed out there is no Share…', async () => {
    fakeSyncServer();
    const w = record({ ownerId: undefined });
    await db.warbands.add(w);
    at(`/warbands/${w.id}`);
    expect(await screen.findByRole('button', { name: 'Make a copy' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Share…' })).toBeNull();
  });
});

describe('a copy sent to you', () => {
  it('waits under “Open for you”; taken, it is a warband of one’s own and opens', async () => {
    const srv = server();
    srv.shareFrom('Ben', saveOf('The Ardent Caravan'));
    srv.shareFrom('Rob', saveOf('Rob’s Spare'));
    const user = userEvent.setup();
    at('/');
    const list = await screen.findByRole('list', { name: 'Sent to you' });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent?.replace(/a copy.*$/, ''))).toEqual(['Ben sent you The Ardent Caravan', 'Rob sent you Rob’s Spare']);

    await user.click(within(within(list).getAllByRole('listitem')[1]!).getByRole('button', { name: 'Decline' }));
    expect(await within(list).findAllByRole('listitem')).toHaveLength(1);
    expect(srv.state.shares[1]).toMatchObject({ accepted: false });

    await user.click(within(list).getByRole('button', { name: 'Take it' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'The Ardent Caravan' })).toBeTruthy();
    const mine = await db.warbands.toArray();
    expect(mine).toMatchObject([{ name: 'The Ardent Caravan', ownerId: KAI.id, serverRev: 1, origin: 'import' }]);
    expect(srv.state.warbands.get(mine[0]!.id)).toMatchObject({ headRev: 1, versions: [{ source: 'import', note: 'shared by Ben' }] });
  });

  it('a copy taken is in step with the server: the next sync neither sends it nor brings it twice', async () => {
    const srv = server();
    const sh = srv.shareFrom('Ben', saveOf('The Ardent Caravan'));
    const id = await acceptShare(data, sh.id);
    expect(await syncOnce({ userId: KAI.id, data: async () => data })).toMatchObject({ pushed: 0, waiting: 0, conflicts: 0 });
    expect(await db.warbands.toArray()).toMatchObject([{ id, serverRev: 1 }]);
    expect(srv.state.warbands.size).toBe(1);
  });
});

describe('a share code', () => {
  it('entered on Warbands as typed: looked up, then the copy is added and opens', async () => {
    const srv = server();
    srv.shareFrom('Ben', saveOf('The Ardent Caravan'), 'H4TR8WNP');
    const user = userEvent.setup();
    at('/warbands');
    await user.click(await screen.findByRole('button', { name: 'Enter a share code' }));
    const sheet = screen.getByRole('dialog', { name: 'Enter a share code' });
    await user.type(within(sheet).getByLabelText('The code another player gave you'), 'h4tr 8wnp');
    await user.click(within(sheet).getByRole('button', { name: 'Look it up' }));
    expect(await within(sheet).findByText('The Ardent Caravan')).toBeTruthy();
    expect(within(sheet).getByText(/from Ben/)).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Add the copy' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'The Ardent Caravan' })).toBeTruthy();
    expect(srv.state.shares[0]!.uses).toBe(1);
  });

  it('a code that does not exist (any more) says so', async () => {
    server();
    const user = userEvent.setup();
    at('/warbands');
    await user.click(await screen.findByRole('button', { name: 'Enter a share code' }));
    const sheet = screen.getByRole('dialog', { name: 'Enter a share code' });
    await user.type(within(sheet).getByLabelText('The code another player gave you'), 'ZZZZ-ZZZZ');
    await user.click(within(sheet).getByRole('button', { name: 'Look it up' }));
    expect((await within(sheet).findByRole('alert')).textContent).toMatch(/No warband goes with that code/);
  });
});
