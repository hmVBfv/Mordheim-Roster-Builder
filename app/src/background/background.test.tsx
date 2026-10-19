/* The Background tab (phase 4b1): the leaders' side of the story – threads
   with the truth behind them, how much of it the story may show, and the
   deliberate step of revealing a note to everyone. Only a leader with the
   authenticator sees it; "View as player" shows what the server sends a
   player. Against the stand-in server (sync/fakeSync.ts). */
import { ctxOf, writeSave } from '@mordheim/core';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });
afterEach(async () => { cleanup(); stopSync(); resetSession(); localStorage.clear(); await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });

function server(o: { totp?: boolean } = {}) {
  const me = { ...KAI, totp: !!o.totp };
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

const others = () => [{ player: 'Anna', data: saveOf('The Grey Penitents') }, { player: 'Ben', data: saveOf('Clan Skrittle') }];

describe('the Background tab', () => {
  it('a leader writes a thread, changes it and reads its earlier wording', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/background`);
    expect(await screen.findByText(/Only campaign leaders see this area/)).toBeTruthy();
    expect(await screen.findByText(/Nothing here yet/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'New thread' }));
    const sheet = screen.getByRole('dialog', { name: 'New thread' });
    await user.click(within(sheet).getByLabelText('Title'));
    await user.paste('Who pays the ferryman?');
    await user.click(within(sheet).getByLabelText('Truth ⚑'));
    await user.paste('The Countess pays the ferrymen’s guild.');
    await user.selectOptions(within(sheet).getByLabelText('How much may the story show?'), 'hint');
    await user.click(within(sheet).getByLabelText('Limit for hints'));
    await user.paste('Traces yes – the name never.');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    const list = await screen.findByRole('list', { name: 'Threads' });
    expect(await within(list).findByText('Who pays the ferryman?')).toBeTruthy();
    expect(within(list).getByText('Limit: “Traces yes – the name never.”')).toBeTruthy();
    expect(within(list).getByText('The Countess pays the ferrymen’s guild.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Threads 1' }).getAttribute('aria-pressed')).toBe('true');
    const id = [...srv.state.background.keys()][0]!;
    expect(srv.state.background.get(id)).toMatchObject({ kind: 'thread', reveal: 'hint', status: 'planned' });

    // another kind has its own list
    await user.click(screen.getByRole('button', { name: 'People 0' }));
    expect(await screen.findByText(/Nothing here yet/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Threads 1' }));

    await user.click(within(list).getByRole('button', { name: 'Edit' }));
    const edit = screen.getByRole('dialog', { name: 'Edit the thread' });
    await user.clear(within(edit).getByLabelText('Title'));
    await user.click(within(edit).getByLabelText('Title'));
    await user.paste('Who pays the ferrymen?');
    await user.selectOptions(within(edit).getByLabelText('Status'), 'active');
    await user.click(within(edit).getByRole('button', { name: 'Save' }));
    expect(await within(list).findByText('Who pays the ferrymen?')).toBeTruthy();
    expect(within(list).getByText('active')).toBeTruthy();

    await user.click(within(list).getByRole('button', { name: 'Earlier wordings' }));
    const history = await screen.findByRole('dialog', { name: 'Earlier wordings' });
    expect(await within(history).findByText(/1 earlier version\./)).toBeTruthy();
    await user.click(within(history).getByRole('button', { name: 'Close' }));
  });

  it('a leader reveals a note to everyone: it is public and placed in the story, the truth stays where it is', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    const e = srv.backgroundFrom(c.id, { title: 'Who pays the ferryman?', truth: 'The Countess pays the ferrymen’s guild.', reveal: 'hint', hintLimits: 'Traces yes – the name never.', status: 'active' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/background`);
    const list = await screen.findByRole('list', { name: 'Threads' });
    await user.click(await within(list).findByRole('button', { name: 'Reveal…' }));
    const reveal = screen.getByRole('dialog', { name: 'Reveal to everyone' });
    expect(within(reveal).getByText(/the truth stays hidden/)).toBeTruthy();
    expect((within(reveal).getByRole('button', { name: 'Reveal to everyone' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(within(reveal).getByLabelText('Public note'));
    await user.paste('The ferryman did not come back. Someone had paid him.');
    await user.selectOptions(within(reveal).getByLabelText('Level afterwards'), 'revealed');
    await user.click(within(reveal).getByRole('button', { name: 'Reveal to everyone' }));
    expect(await within(list).findByText(/Public since/)).toBeTruthy();
    expect(within(list).queryByRole('button', { name: 'Reveal…' })).toBeNull();
    const note = [...srv.state.notes.values()][0]!;
    expect(note).toMatchObject({ visibility: 'public', kind: 'general', battleId: b.id, text: 'The ferryman did not come back. Someone had paid him.' });
    // the words are public, the truth is not part of them
    expect(note.text).not.toMatch(/Countess/);
    expect(srv.state.background.get(e.id)).toMatchObject({ reveal: 'revealed', revealFromBattle: b.id, truth: 'The Countess pays the ferrymen’s guild.' });
    expect(srv.state.background.get(e.id)!.playersKnow).toMatch(/Someone had paid him/);
    // by default at the end of the story so far: the interlude after the battle
    expect([...srv.state.positions.values()].find((p) => p.itemId === note.id)).toMatchObject({ itemType: 'note', segment: 'i1' });

    // and the note stands on the Notes tab, for everyone
    cleanup();
    at(`/campaign/${c.id}/notes`);
    expect(await screen.findByText('The ferryman did not come back. Someone had paid him.')).toBeTruthy();
  });

  it('another leader got there first: the change is not written over theirs', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/background`);
    await user.click(await screen.findByRole('button', { name: 'New thread' }));
    const sheet = screen.getByRole('dialog', { name: 'New thread' });
    await user.type(within(sheet).getByLabelText('Title'), 'The bell of St. Voss');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    const list = await screen.findByRole('list', { name: 'Threads' });
    await user.click(await within(list).findByRole('button', { name: 'Edit' }));
    const edit = screen.getByRole('dialog', { name: 'Edit the thread' });
    await user.type(within(edit).getByLabelText('Truth ⚑'), 'It tolls for the one who carries the reliquary.');
    // while this one is open, somebody else saves
    const e = [...srv.state.background.values()][0]!;
    e.title = 'The bell of St. Voss (Ben)';
    e.updatedBy = 'Ben';
    e.seq += 100;
    await user.click(within(edit).getByRole('button', { name: 'Save' }));
    expect(await within(edit).findByRole('alert')).toHaveProperty('textContent', 'Ben changed this entry while you were editing it. Close this, look at it again and redo your change.');
    expect(srv.state.background.get(e.id)).toMatchObject({ title: 'The bell of St. Voss (Ben)', truth: '' });
  });

  it('a thread refers to a battle, a faction and a Named NPC – picked from tiles, taken out with a second tap', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    const f = srv.factionFrom(c.id, { nameEn: 'The Ferrymen' });
    srv.npcFrom(c.id, { nameEn: 'Old Marek', factionId: f.id, named: true });
    srv.npcFrom(c.id, { nameEn: 'A deckhand', factionId: f.id }); // one of a crowd: not offered
    const user = userEvent.setup();
    at(`/campaign/${c.id}/background`);
    await user.click(await screen.findByRole('button', { name: 'New thread' }));
    const sheet = within(screen.getByRole('dialog', { name: 'New thread' }));
    await user.click(sheet.getByLabelText('Title'));
    await user.paste('Who pays the ferryman?');

    const kinds = within(sheet.getByRole('group', { name: 'What does it refer to?' }));
    expect(kinds.getAllByRole('button').map((b) => b.textContent)).toEqual(['Battle', 'Faction', 'Named NPC', 'Something else']);
    await user.click(await sheet.findByRole('button', { name: 'Battle 1 · Hel Fenn ferry' }));
    await user.click(kinds.getByRole('button', { name: 'Faction' }));
    await user.click(await sheet.findByRole('button', { name: 'The Ferrymen' }));
    await user.click(kinds.getByRole('button', { name: 'Named NPC' }));
    expect(await sheet.findByRole('button', { name: /^Old Marek/ })).toBeTruthy();
    expect(sheet.queryByRole('button', { name: /A deckhand/ })).toBeNull();
    await user.click(sheet.getByRole('button', { name: /^Old Marek/ }));
    await user.click(sheet.getByRole('button', { name: /^Old Marek/ })); // a second tap takes it out again
    await user.click(sheet.getByRole('button', { name: /^Old Marek/ }));
    await user.click(kinds.getByRole('button', { name: 'Something else' }));
    await user.type(sheet.getByLabelText('Another reference'), 'the ford at dusk{Enter}');
    const picked = within(sheet.getByRole('list', { name: 'Refers to' }));
    expect(picked.getAllByRole('listitem').map((li) => li.textContent?.replace('✕', '').trim())).toEqual(['Battle Battle 1 · Hel Fenn ferry', 'Faction The Ferrymen', 'Named NPC Old Marek', 'Other the ford at dusk']);
    await user.click(sheet.getByRole('button', { name: 'Save' }));

    const list = await screen.findByRole('list', { name: 'Threads' });
    await waitFor(() => expect([...srv.state.background.values()][0]?.refs).toEqual([
      { kind: 'battle', id: expect.any(String), label: 'Battle 1 · Hel Fenn ferry' },
      { kind: 'faction', id: f.id, label: 'The Ferrymen' },
      { kind: 'npc', id: expect.any(String), label: 'Old Marek' },
      { kind: 'text', id: '', label: 'the ford at dusk' },
    ]));
    const card = within(await within(list).findByRole('list', { name: 'Refers to' }));
    expect(card.getByText('The Ferrymen')).toBeTruthy();
    expect(card.getByText('Named NPC')).toBeTruthy();
  });

  it('says so when there is nothing to pick for a kind, and when a faction or NPC referred to has left the world', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    srv.factionFrom(c.id, { nameEn: 'The Watch' });
    srv.backgroundFrom(c.id, { title: 'The vanished', refs: [{ kind: 'faction', id: 'gone-1', label: 'The Old Guild' }, { kind: 'npc', id: 'gone-2', label: 'Nobody' }] });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/background`);
    const refs = within(await screen.findByRole('list', { name: 'Refers to' }));
    await waitFor(() => expect(refs.getAllByText('(removed)')).toHaveLength(2)); // the world is read, and neither is in it
    expect(refs.getByText('The Old Guild')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'New thread' }));
    const sheet = within(screen.getByRole('dialog', { name: 'New thread' }));
    expect(await sheet.findByText('No battle yet.')).toBeTruthy();
    await user.click(sheet.getByRole('button', { name: 'Named NPC' }));
    expect(await sheet.findByText(/No Named NPC yet\. Tick “Named” on an NPC in the World tab/)).toBeTruthy();
  });

  it('an entry is taken out only after asking', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/background`);
    await user.click(await screen.findByRole('button', { name: 'New thread' }));
    await user.type(within(screen.getByRole('dialog', { name: 'New thread' })).getByLabelText('Title'), 'Skritch’s debt');
    await user.click(within(screen.getByRole('dialog', { name: 'New thread' })).getByRole('button', { name: 'Save' }));
    const list = await screen.findByRole('list', { name: 'Threads' });
    await user.click(await within(list).findByRole('button', { name: 'Edit' }));
    const edit = screen.getByRole('dialog', { name: 'Edit the thread' });
    await user.click(within(edit).getByRole('button', { name: 'Take out…' }));
    await user.click(within(edit).getByRole('button', { name: 'Keep it' }));
    expect([...srv.state.background.values()][0]!.deleted).toBeUndefined();
    await user.click(within(edit).getByRole('button', { name: 'Take out…' }));
    await user.click(within(edit).getByRole('button', { name: 'Take it out' }));
    await waitFor(() => expect([...srv.state.background.values()][0]!.deleted).toBe(true));
    expect(await screen.findByText(/Nothing here yet/)).toBeTruthy();
  });

  it('there is no Background for a player, a viewer, or a leader without the authenticator', async () => {
    const srv = server({ totp: false });
    const lead = srv.addCampaign({ name: 'Without the authenticator', others: others() });
    at(`/campaign/${lead.id}`);
    expect((await screen.findAllByRole('link', { name: 'Notes' })).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /Background/ })).toBeNull();
    cleanup();
    // the address alone gets nothing either
    at(`/campaign/${lead.id}/background`);
    expect((await screen.findAllByRole('link', { name: 'Notes' })).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Only campaign leaders see this area/)).toBeNull();
    cleanup();

    const srv2 = server({ totp: true });
    const player = srv2.addCampaign({ name: 'As a player', role: 'player', others: others() });
    at(`/campaign/${player.id}/background`);
    expect((await screen.findAllByRole('link', { name: 'Notes' })).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /Background/ })).toBeNull();
    expect(screen.queryByText(/Only campaign leaders see this area/)).toBeNull();
    cleanup();
    const watched = srv2.addCampaign({ name: 'Watching', role: 'viewer' });
    at(`/campaign/${watched.id}`);
    expect((await screen.findAllByRole('link', { name: 'Notes' })).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /Background/ })).toBeNull();
  });
});

describe('View as player', () => {
  it('shows what the server gives a player: no leaders’ notes, no sealed words, not even the leader’s own', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    srv.noteFrom(c.id, { author: 'Anna', text: 'The ferryman is in the Countess’s pay.', visibility: 'leader' });
    srv.noteFrom(c.id, { author: 'Ben', text: 'Skritch goes for the captain.', battleId: b.id, visibility: 'sealed' });
    srv.noteFrom(c.id, { author: 'Ben', text: 'The rain will not stop.', battleId: b.id });
    srv.pictureFrom(c.id, { uploader: 'Anna', caption: 'The Countess’s seal', visibility: 'leader' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/notes`);
    // as a leader, all of it is there
    expect(await screen.findByText('The ferryman is in the Countess’s pay.')).toBeTruthy();
    expect(screen.getByText('The rain will not stop.')).toBeTruthy();
    await user.click(screen.getByRole('link', { name: 'View as player' }));

    expect(await screen.findByText(/This is what a player gets from the server/)).toBeTruthy();
    expect(await screen.findByText('The rain will not stop.')).toBeTruthy();
    expect(screen.queryByText(/ferryman/)).toBeNull();
    expect(screen.queryByText(/Skritch goes/)).toBeNull();
    expect(screen.queryByText(/Countess/)).toBeNull();
    expect(screen.getByText('This note is sealed. It opens for everyone when battle 1 is closed.')).toBeTruthy();
    // read only
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Take out' })).toBeNull();
    await user.click(screen.getByRole('link', { name: 'Back to the notes' }));
    expect(await screen.findByText('The ferryman is in the Countess’s pay.')).toBeTruthy();
  });

  it('is offered to leaders only', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: others() });
    at(`/campaign/${c.id}/notes`);
    await screen.findByRole('button', { name: 'New note' });
    expect(screen.queryByRole('link', { name: 'View as player' })).toBeNull();
  });
});
