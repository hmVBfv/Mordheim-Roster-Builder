/* Questions to players (phase 4b3a): a leader asks one player, the player
   answers with a note and chooses who may read it; "Open for you" shows what
   waits, on the campaign and on Home. Against the stand-in server
   (sync/fakeSync.ts), which filters like the real one. */
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
/** Kai is a player; Anna leads. */
const asPlayer = (srv: ReturnType<typeof server>) => srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: [{ player: 'Anna', role: 'leader', data: saveOf('The Grey Penitents') }] });

describe('asking', () => {
  it('a leader asks a player, changes the question, withdraws it and asks again', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/questions`);
    expect(await screen.findByText('No questions yet.')).toBeTruthy();
    expect(screen.getByText(/Only leaders and the player asked see a question/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Ask a question' }));
    const sheet = screen.getByRole('dialog', { name: 'Ask a question' });
    const to = within(sheet).getByLabelText('To') as HTMLSelectElement;
    expect([...to.options].map((o) => o.textContent)).toEqual(['Choose…', 'Anna', 'Ben']); // not oneself
    expect(within(sheet).getByRole('button', { name: 'Ask' }).hasAttribute('disabled')).toBe(true);
    await user.selectOptions(to, 'user-anna');
    await user.selectOptions(within(sheet).getByLabelText('About'), b.id);
    await user.click(within(sheet).getByLabelText('Question'));
    await user.paste('How did Robba spend the night after the ferry?');
    await user.click(within(sheet).getByRole('button', { name: 'Ask' }));

    const list = await screen.findByRole('list', { name: 'Questions' });
    expect(within(list).getByText('To Anna')).toBeTruthy();
    expect(within(list).getByText('How did Robba spend the night after the ferry?')).toBeTruthy();
    expect(within(list).getByText(/About Battle 1 · Hel Fenn ferry/)).toBeTruthy();
    expect(await screen.findByText('Question asked.')).toBeTruthy();
    const id = [...srv.state.questions.keys()][0]!;
    expect(srv.state.questions.get(id)).toMatchObject({ to: 'user-anna', battleId: b.id, status: 'open', text: 'How did Robba spend the night after the ferry?' });

    await user.click(within(list).getByRole('button', { name: 'Change' }));
    const edit = screen.getByRole('dialog', { name: 'Change the question' });
    expect((within(edit).getByLabelText('To') as HTMLSelectElement).disabled).toBe(true); // the one asked stays
    await user.click(within(edit).getByLabelText('Question'));
    await user.paste(' And who paid?');
    await user.click(within(edit).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(srv.state.questions.get(id)!.text).toBe('How did Robba spend the night after the ferry? And who paid?'));

    await user.click(await within(await screen.findByRole('list', { name: 'Questions' })).findByRole('button', { name: 'Withdraw' }));
    await waitFor(() => expect(srv.state.questions.get(id)!.status).toBe('withdrawn'));
    await user.click(await screen.findByRole('button', { name: 'Ask again' }));
    await waitFor(() => expect(srv.state.questions.get(id)!.status).toBe('open'));
  });

  it('a leader without the authenticator can ask like any leader (ADR 0030)', async () => {
    const srv = server({ totp: false });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    at(`/campaign/${c.id}/questions`);
    expect(await screen.findByRole('heading', { name: 'Questions to players' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Ask a question' })).toBeTruthy();
  });

  it('a viewer has no Questions tab', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'viewer', others: others() });
    at(`/campaign/${c.id}`);
    const nav = await screen.findByRole('navigation', { name: 'Campaign' });
    expect(within(nav).queryByRole('link', { name: 'Questions' })).toBeNull();
    expect(within(nav).getByRole('link', { name: 'Notes' })).toBeTruthy();
  });
});

describe('answering', () => {
  it('a player answers; the answer is a note of theirs, public, and the question is answered', async () => {
    const srv = server();
    const c = asPlayer(srv);
    const q = srv.questionFrom(c.id, { text: 'How did Robba spend the night?' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/questions`);
    expect(await screen.findByRole('heading', { name: 'Questions for you' })).toBeTruthy();
    const list = await screen.findByRole('list', { name: 'Questions' });
    expect(within(list).getByText('From Anna')).toBeTruthy();

    await user.click(within(list).getByRole('button', { name: 'Answer' }));
    const sheet = screen.getByRole('dialog', { name: 'Answer' });
    expect(within(sheet).getByText('How did Robba spend the night?')).toBeTruthy();
    // no battle, no leaders' notes for a player: only “everyone”
    const radios = within(sheet).getAllByRole('radio');
    expect(radios).toHaveLength(1);
    expect((radios[0] as HTMLInputElement).checked).toBe(true);
    await user.click(within(sheet).getByLabelText('Your answer'));
    await user.paste('In the Three Crows, losing at dice.');
    await user.click(within(sheet).getByRole('button', { name: 'Answer' }));

    expect(await screen.findByText('Answered. Your note is in Notes.')).toBeTruthy();
    expect(srv.state.questions.get(q.id)).toMatchObject({ status: 'answered' });
    const note = [...srv.state.notes.values()].find((n) => n.authorId === KAI.id)!;
    expect(note).toMatchObject({ text: 'In the Three Crows, losing at dice.', visibility: 'public' });
    expect(note.text).not.toContain('How did Robba'); // the question does not go with the note
    const after = await screen.findByRole('list', { name: 'Questions' });
    expect(await within(after).findByText('Answered')).toBeTruthy();
    expect(within(after).queryByRole('button', { name: 'Answer' })).toBeNull();
    expect(within(after).getByRole('link', { name: 'Read the notes' }).getAttribute('href')).toBe(`/campaign/${c.id}/notes`);
  });

  it('about a battle that is still open the answer may be sealed until it closes', async () => {
    const srv = server();
    const c = asPlayer(srv);
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    srv.questionFrom(c.id, { text: 'What does Kai’s captain whisper to the ferryman?', battleId: b.id });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/questions`);
    await user.click(await screen.findByRole('button', { name: 'Answer' }));
    const sheet = screen.getByRole('dialog', { name: 'Answer' });
    expect(within(sheet).getByText(/Your answer becomes a note of yours on Battle 1 · Hel Fenn ferry/)).toBeTruthy();
    await user.click(within(sheet).getByLabelText(/Sealed until Battle 1 · Hel Fenn ferry is closed/));
    await user.click(within(sheet).getByLabelText('Your answer'));
    await user.paste('“Cross, and say nothing.”');
    await user.click(within(sheet).getByRole('button', { name: 'Answer' }));
    await waitFor(() => expect([...srv.state.notes.values()].find((n) => n.authorId === KAI.id)).toMatchObject({ visibility: 'sealed', battleId: b.id }));
  });

  it('a question about a closed battle cannot be answered sealed – and a leader may answer for leaders only', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const b = srv.addBattle(c.id, { title: 'Old war' });
    srv.state.battles.get(b.id)!.status = 'closed';
    srv.questionFrom(c.id, { text: 'What did you find?', battleId: b.id, askedBy: 'Anna' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/questions`);
    const list = await screen.findByRole('list', { name: 'Questions' });
    await user.click(within(list).getByRole('button', { name: 'Answer' }));
    const sheet = screen.getByRole('dialog', { name: 'Answer' });
    expect(within(sheet).queryByLabelText(/Sealed until/)).toBeNull();
    expect(within(sheet).getByLabelText(/Leaders only/)).toBeTruthy();
  });

  it('an answer that fails keeps the sheet open with the words and says why', async () => {
    const srv = server();
    const c = asPlayer(srv);
    const q = srv.questionFrom(c.id, { text: 'Where were you?' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/questions`);
    await user.click(await screen.findByRole('button', { name: 'Answer' }));
    const sheet = screen.getByRole('dialog', { name: 'Answer' });
    await user.click(within(sheet).getByLabelText('Your answer'));
    await user.paste('Somewhere.');
    srv.state.questions.get(q.id)!.status = 'withdrawn'; // the leader took it back meanwhile
    await user.click(within(sheet).getByRole('button', { name: 'Answer' }));
    expect(await within(sheet).findByRole('alert')).toBeTruthy();
    expect((within(sheet).getByLabelText('Your answer') as HTMLTextAreaElement).value).toBe('Somewhere.');
    expect(srv.state.notes.size).toBe(0);
  });
});

describe('Open for you', () => {
  it('the campaign overview lists a question asked of the player, and it leads to the tab', async () => {
    const srv = server();
    const c = asPlayer(srv);
    srv.questionFrom(c.id, { text: 'How did Robba spend the night?' });
    const withdrawn = srv.questionFrom(c.id, { text: 'Never mind this one', status: 'withdrawn' });
    expect(withdrawn.status).toBe('withdrawn');
    at(`/campaign/${c.id}`);
    const region = await screen.findByRole('region', { name: 'Open for you' });
    const link = await within(region).findByRole('link', { name: /Question from Anna/ });
    expect(link.getAttribute('href')).toBe(`/campaign/${c.id}/questions`);
    expect(within(link).getByText('How did Robba spend the night?')).toBeTruthy();
    expect(within(region).getAllByRole('link')).toHaveLength(1); // the withdrawn one is not there
  });

  it('Home gathers what waits in every campaign, with its name', async () => {
    const srv = server();
    const c = asPlayer(srv);
    srv.addCampaign({ name: 'The Marienburg Feud', role: 'player', others: [{ player: 'Ben', role: 'leader', data: saveOf('Clan Skrittle') }] });
    srv.questionFrom(c.id, { text: 'How did Robba spend the night?' });
    at('/');
    const link = await screen.findByRole('link', { name: /Question from Anna/ });
    expect(within(link).getByText(/The Hel Fenn Campaign · How did Robba spend the night\?/)).toBeTruthy();
    expect(link.getAttribute('href')).toBe(`/campaign/${c.id}/questions`);
    expect(screen.queryByText(/Nothing waiting/)).toBeNull();
  });

  it('Home says that nothing waits when nothing does', async () => {
    const srv = server();
    asPlayer(srv);
    at('/');
    expect(await screen.findByText(/Nothing waiting/)).toBeTruthy();
    expect(srv.state.questions.size).toBe(0);
  });
});

