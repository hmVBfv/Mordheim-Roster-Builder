/* Notes as players write them (phase 4a3): on the Notes tab and at the
   game night, who may read each chosen when writing – everyone, sealed
   until the battle is closed, leaders only – and what others' sealed notes
   look like until then. Against the stand-in server (sync/fakeSync.ts). */
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

const others = () => [{ player: 'Anna', data: saveOf('The Grey Penitents') }, { player: 'Ben', data: saveOf('Clan Skrittle') }];

describe('the Notes tab', () => {
  it('a note sealed until the battle is closed: its author reads it, the others see that it is there', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: others() });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    srv.noteFrom(c.id, { author: 'Ben', text: 'Skritch goes for the captain.', battleId: b.id, visibility: 'sealed' });
    srv.noteFrom(c.id, { author: 'Anna', text: 'The ferryman is paid.', battleId: b.id, visibility: 'leader' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/notes`);
    const group = await screen.findByRole('region', { name: 'Battle 1 · Hel Fenn ferry' });
    expect(within(group).getByText('This note is sealed. It opens for everyone when battle 1 is closed.')).toBeTruthy();
    expect(screen.queryByText(/Skritch/)).toBeNull();
    // a leaders' note does not reach a player at all
    expect(screen.queryByText(/ferryman/)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'New note' }));
    const sheet = screen.getByRole('dialog', { name: 'A note' });
    expect((within(sheet).getByLabelText('About') as HTMLSelectElement).value).toBe(b.id);
    await user.selectOptions(within(sheet).getByLabelText('Kind'), 'scene');
    await user.type(within(sheet).getByLabelText('What happened'), 'Ulrich means to cut the ferry rope.');
    expect(within(sheet).queryByRole('radio', { name: /Leaders only/ })).toBeNull();
    await user.click(within(sheet).getByRole('radio', { name: /Sealed until Battle 1 · Hel Fenn ferry is closed/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Save the note' }));
    expect(await within(group).findByText(/Ulrich means to cut the ferry rope/)).toBeTruthy();
    await waitFor(() => expect([...srv.state.notes.values()].find((n) => n.author === 'Kai')).toMatchObject({ kind: 'scene', visibility: 'sealed', battleId: b.id }));
    // Ben's still a placeholder, Kai's own with its words – both marked sealed
    expect(within(group).getAllByText(/🔒 Sealed until battle 1 is closed/)).toHaveLength(2);
  });

  it('a quote names its speaker from the rosters; its author edits and takes it out', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: others() });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/notes`);
    await user.click(await screen.findByRole('button', { name: 'New note' }));
    const sheet = screen.getByRole('dialog', { name: 'A note' });
    await user.selectOptions(within(sheet).getByLabelText('Kind'), 'quote');
    const who = within(sheet).getByLabelText('Who says it?') as HTMLSelectElement;
    await waitFor(() => expect(within(who).getAllByRole('option').length).toBeGreaterThan(2));
    const speaker = within(who).getAllByRole('option')[1]!;
    await user.selectOptions(who, speaker);
    await user.type(within(sheet).getByLabelText('What was said'), 'Bolt the doors.');
    await user.click(within(sheet).getByRole('button', { name: 'Save the note' }));
    const list = await screen.findByRole('region', { name: 'The campaign in general' });
    expect(await within(list).findByText('“Bolt the doors.”')).toBeTruthy();
    expect(within(list).getByText(`— ${speaker.textContent!.replace(/ \(.*\)$/, '')}`)).toBeTruthy();
    await waitFor(() => expect([...srv.state.notes.values()][0]).toMatchObject({ kind: 'quote', mentions: [{ name: speaker.textContent!.replace(/ \(.*\)$/, '') }] }));

    await user.click(within(list).getByRole('button', { name: 'Edit' }));
    const edit = screen.getByRole('dialog', { name: 'Edit the note' });
    await user.clear(within(edit).getByLabelText('What was said'));
    await user.type(within(edit).getByLabelText('What was said'), 'Bolt the doors. Whatever knocks is not a customer.');
    await user.click(within(edit).getByRole('button', { name: 'Save' }));
    expect(await within(list).findByText('“Bolt the doors. Whatever knocks is not a customer.”')).toBeTruthy();
    await user.click(within(list).getByRole('button', { name: 'Take out' }));
    await waitFor(() => expect([...srv.state.notes.values()][0]!.deleted).toBe(true));
    expect(await screen.findByText(/No notes yet/)).toBeTruthy();
  });

  it('a leader writes for leaders only and reads the other leaders’ notes; a viewer only reads', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    srv.noteFrom(c.id, { author: 'Anna', text: 'The ferryman is in the Countess’s pay.', visibility: 'leader' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/notes`);
    expect(await screen.findByText('The ferryman is in the Countess’s pay.')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'The campaign in general' })).getByText('⚑ Leaders only')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'New note' }));
    expect(within(screen.getByRole('dialog', { name: 'A note' })).getByRole('radio', { name: /Leaders only/ })).toBeTruthy();
    cleanup();
    srv.addCampaign({ name: 'Watching', role: 'viewer' });
    const watched = [...srv.state.campaigns.values()].find((x) => x.name === 'Watching')!;
    at(`/campaign/${watched.id}/notes`);
    expect(await screen.findByText(/No notes yet/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New note' })).toBeNull();
  });

  it('Notes below with a single campaign opens its notes', async () => {
    const srv = server();
    srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player' });
    at('/notes');
    expect(await screen.findByRole('link', { name: 'Notes' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Notes' }).some((a) => a.getAttribute('aria-current') === 'page')).toBe(true);
  });
});

describe('at the game night', () => {
  it('everybody adds notes and quotes at the turn the table is at; they stand in the protocol', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: others() });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    b.turn = 4;
    srv.entryElsewhere(b.id, { id: '11111111-1111-4111-8111-111111111111', turn: 3, kind: 'event', payload: { text: 'Rain.' }, author: 'Anna' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/battles/${b.id}`);
    await user.click(await screen.findByRole('button', { name: '+ Quote' }));
    const sheet = screen.getByRole('dialog', { name: 'A quote · turn 4' });
    await user.type(within(sheet).getByLabelText('What was said'), 'Whatever knocks tonight is not a customer.');
    await user.click(within(sheet).getByRole('button', { name: 'Save the note' }));
    const protocol = screen.getByRole('list', { name: 'Protocol' });
    expect(await within(protocol).findByText('“Whatever knocks tonight is not a customer.”')).toBeTruthy();
    await waitFor(() => expect([...srv.state.notes.values()]).toMatchObject([{ battleId: b.id, turn: 4, kind: 'quote', author: 'Kai' }]));
    // newest turn on top: the quote of turn 4 before the event of turn 3
    expect(within(protocol).getAllByRole('listitem').map((li) => li.textContent)[0]).toMatch(/Whatever knocks/);
  });
});
