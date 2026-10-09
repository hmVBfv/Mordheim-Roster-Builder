/* Pictures of a campaign (phase 4a3, part 2): sent from the Notes tab or at
   the game night, made smaller on the phone first (shrink.ts – the browser
   draws it; here a stand-in), waiting on the device without a connection,
   for everyone or leaders only. Against the stand-in server
   (sync/fakeSync.ts). */
import { ctxOf, stageTotals, writeSave } from '@mordheim/core';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSession, signedIn } from '../account/session.ts';
import { ME as KAI } from '../account/testServer.ts';
import { AppRoutes } from '../app/App.tsx';
import { flushOutbox } from '../battle/outbox.ts';
import { db } from '../db/db.ts';
import { readSave } from '../sync/engine.ts';
import { createFakeSync } from '../sync/fakeSync.ts';
import { stopSync } from '../sync/runner.ts';
import { data, sampleSave } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';

vi.mock('./shrink.ts', () => ({
  MAX_SIDE: 1600,
  shrink: vi.fn(async () => ({ bytes: new Uint8Array(2048).fill(7).buffer, mime: 'image/webp', width: 800, height: 600 })),
}));

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const saveOf = (name: string) => writeSave(ctxOf(data, { ...sampleSave(), name }));
const totals = (save: unknown) => stageTotals(ctxOf(data, readSave(data, save)!));
const SHOT = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'tts-screenshot.png', { type: 'image/png' });

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });
afterEach(async () => { cleanup(); stopSync(); resetSession(); localStorage.clear(); await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });

/** The stand-in server behind fetch, signed in as Kai; a picture's bytes reach it as they are. */
function server(o: { totp?: boolean } = {}) {
  const me = { ...KAI, totp: !!o.totp };
  const srv = createFakeSync({ me: { id: KAI.id, username: KAI.username, displayName: KAI.displayName }, totals, wbName: (wb) => data.WARBANDS[wb]?.name ?? wb });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (srv.state.down) throw new TypeError('Failed to fetch');
    const url = new URL(String(input), 'http://localhost/');
    const path = url.pathname.replace(/^\/api\/v1/, '');
    if (path === '/auth/me') return new Response(JSON.stringify({ user: me, pending: false }), { headers: { 'content-type': 'application/json' } });
    srv.state.calls.push(`${init?.method ?? 'GET'} ${path}`);
    const type = (init?.headers as Record<string, string> | undefined)?.['Content-Type'] ?? '';
    const body = init?.body === undefined ? {} : type.startsWith('image/') ? { raw: new Uint8Array(init.body as ArrayBuffer), type } : (JSON.parse(String(init.body)) as Record<string, unknown>);
    return srv.handle(init?.method ?? 'GET', path, url.searchParams, body);
  }));
  signedIn({ stage: 'full', user: me });
  return srv;
}

const others = () => [{ player: 'Anna', data: saveOf('The Grey Penitents'), role: 'leader' as const }, { player: 'Ben', data: saveOf('Clan Skrittle') }];

describe('a picture', () => {
  it('sent from the Notes tab: made smaller on the phone, shown among the notes; without a connection it waits', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: others() });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/notes`);
    await user.click(await screen.findByRole('button', { name: 'New picture' }));
    const sheet = screen.getByRole('dialog', { name: 'A picture' });
    expect(within(sheet).getByRole('button', { name: 'Save the picture' })).toHaveProperty('disabled', true);
    await user.upload(within(sheet).getByLabelText('Screenshot or photo'), SHOT());
    expect(await within(sheet).findByText('800 × 600 · 2 KB · only the pixels leave this phone')).toBeTruthy();
    // a player chooses nobody to hide it from: leaders-only is for leaders
    expect(within(sheet).queryByRole('radio')).toBeNull();
    await user.type(within(sheet).getByLabelText('Caption (optional)'), 'The ferry, before it burned.');
    await user.click(within(sheet).getByRole('button', { name: 'Save the picture' }));
    await waitFor(() => expect([...srv.state.pictures.values()]).toMatchObject([{ caption: 'The ferry, before it burned.', mime: 'image/webp', bytes: 2048, width: 800, height: 600, stored: true, visibility: 'public', battleId: null }]));
    const general = await screen.findByRole('region', { name: 'The campaign in general' });
    expect(await within(general).findByText('The ferry, before it burned.')).toBeTruthy();
    expect(await db.outbox.count()).toBe(0);

    // without a connection: on this phone, sent when the server answers
    srv.state.down = true;
    await user.click(screen.getByRole('button', { name: 'New picture' }));
    await user.upload(within(screen.getByRole('dialog', { name: 'A picture' })).getByLabelText('Screenshot or photo'), SHOT());
    await within(screen.getByRole('dialog', { name: 'A picture' })).findByText(/800 × 600/);
    await user.click(within(screen.getByRole('dialog', { name: 'A picture' })).getByRole('button', { name: 'Save the picture' }));
    expect(await screen.findByText(/on this phone/)).toBeTruthy();
    expect(srv.state.pictures.size).toBe(1);
    srv.state.down = false;
    expect(await flushOutbox(KAI.id)).toBe(1);
    expect([...srv.state.pictures.values()].map((p) => p.stored)).toEqual([true, true]);
  });

  it('a leaders’ picture reaches leaders only; its sender or a leader takes a picture out', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    srv.pictureFrom(c.id, { uploader: 'Anna', caption: 'The Countess’s seal.', visibility: 'leader' });
    srv.pictureFrom(c.id, { uploader: 'Ben', caption: 'Skritch on the roof.' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/notes`);
    const general = await screen.findByRole('region', { name: 'The campaign in general' });
    expect(await within(general).findByText('The Countess’s seal.')).toBeTruthy();
    expect(within(general).getByText(/⚑ Leaders only/)).toBeTruthy();
    // a leader may choose
    await user.click(screen.getByRole('button', { name: 'New picture' }));
    expect(within(screen.getByRole('dialog', { name: 'A picture' })).getAllByRole('radio')).toHaveLength(2);
    await user.click(within(screen.getByRole('dialog', { name: 'A picture' })).getByRole('button', { name: 'Cancel' }));
    const ben = screen.getByText('Skritch on the roof.').closest('li')!;
    await user.click(within(ben).getByRole('button', { name: 'Take out' }));
    await waitFor(() => expect([...srv.state.pictures.values()].find((p) => p.caption === 'Skritch on the roof.')!.deleted).toBe(true));
    expect(screen.queryByText('Skritch on the roof.')).toBeNull();
    cleanup();
    c.members.find((m) => m.userId === KAI.id)!.role = 'player';
    at(`/campaign/${c.id}/notes`);
    expect(await screen.findByText(/No notes yet/)).toBeTruthy();
    expect(screen.queryByText('The Countess’s seal.')).toBeNull();
  });

  it('at the game night: + Picture at the turn, in the protocol', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/battles/${b.id}`);
    await user.click(await screen.findByRole('button', { name: 'Next turn' }));
    await user.click(screen.getByRole('button', { name: '+ Picture' }));
    const sheet = screen.getByRole('dialog', { name: 'A picture · turn 2' });
    // the battle is given: no choosing what it is about
    expect(within(sheet).queryByLabelText('About')).toBeNull();
    await user.upload(within(sheet).getByLabelText('Screenshot or photo'), SHOT());
    await within(sheet).findByText(/800 × 600/);
    await user.type(within(sheet).getByLabelText('Caption (optional)'), 'Turn two from above.');
    await user.click(within(sheet).getByRole('button', { name: 'Save the picture' }));
    const protocol = screen.getByRole('list', { name: 'Protocol' });
    expect(await within(protocol).findByText('Turn two from above.')).toBeTruthy();
    await waitFor(() => expect([...srv.state.pictures.values()]).toMatchObject([{ battleId: b.id, turn: 2, stored: true }]));
  });
});
