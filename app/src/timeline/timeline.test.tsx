/* The Timeline tab (phase 4a3, part 2): the story in its order, fixed
   anchors with reports and marks, blocks where their battle and time put
   them; each moves their own with ↑ ↓ or "Move to…", a leader all, the
   protocol only a leader. Against the stand-in server (sync/fakeSync.ts). */
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
import { createFakeSync, type FakeRole } from '../sync/fakeSync.ts';
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
    srv.state.calls.push(`${init?.method ?? 'GET'} ${path}`);
    return srv.handle(init?.method ?? 'GET', path, url.searchParams, init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {});
  }));
  signedIn({ stage: 'full', user: me });
  return srv;
}

/** A campaign with a closed battle: its protocol, a quote of Kai's at turn 2, a scene of Anna's, a picture, a note about the days after. */
function story(role: FakeRole, o: { totp?: boolean } = {}) {
  const srv = server(o);
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role, others: [{ player: 'Anna', data: saveOf('The Grey Penitents'), role: role === 'leader' ? 'player' : 'leader' }, { player: 'Ben', data: saveOf('Clan Skrittle') }] });
  const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
  b.participants[0]!.outcome = 'victory';
  b.participants[1]!.outcome = 'defeat';
  srv.entryElsewhere(b.id, { id: '11111111-1111-4111-8111-111111111111', turn: 3, kind: 'event', payload: { text: 'The ferry burns.' }, author: 'Anna' });
  const kai = '0000000a-0000-4000-8000-000000000000';
  srv.state.notes.set(kai, { id: kai, campaignId: c.id, battleId: b.id, turn: 2, authorId: KAI.id, author: 'Kai', kind: 'quote', text: 'Bolt the doors.', visibility: 'public', mentions: [], createdAt: '2026-10-04T12:00:30.000Z', updatedAt: '2026-10-04T12:00:30.000Z', seq: ++srv.state.seq });
  srv.noteFrom(c.id, { author: 'Anna', text: 'Brother Anselm sets the mill wheel on fire.', battleId: b.id, turn: 4, kind: 'scene' });
  srv.pictureFrom(c.id, { uploader: 'Ben', caption: 'Skritch on the roof.', battleId: b.id, turn: 1 });
  b.status = 'closed';
  b.closedAt = '2026-10-04T13:00:00.000Z';
  srv.state.notes.set('0000000b-0000-4000-8000-000000000000', { id: '0000000b-0000-4000-8000-000000000000', campaignId: c.id, battleId: null, turn: null, authorId: 'user-anna', author: 'Anna', kind: 'general', text: 'Two quiet days at the Blind Cat.', visibility: 'public', mentions: [], createdAt: '2026-10-05T12:00:00.000Z', updatedAt: '2026-10-05T12:00:00.000Z', seq: ++srv.state.seq });
  return { srv, c, b, kai };
}

const segment = (name: RegExp | string) => screen.findByRole('listitem', { name });
const texts = (seg: HTMLElement) => within(seg).getAllByRole('listitem').map((x) => x.textContent ?? '');

describe('the timeline', () => {
  it('every member reads the story in its order: anchors, the report and the marks fixed, blocks by turn', async () => {
    const { c } = story('viewer');
    at(`/campaign/${c.id}/timeline`);
    const course = await segment('Battle 1 · Hel Fenn ferry · course');
    await waitFor(() => expect(texts(course)).toHaveLength(5));
    const t = texts(course);
    expect(t[0]).toMatch(/Battle report · fixed.*The Grey Penitents: Victory · Clan Skrittle: Defeat|Battle report · fixed.*Victory/);
    expect(t.slice(1).map((x) => x.match(/Skritch on the roof|Bolt the doors|The ferry burns|mill wheel/)?.[0])).toEqual(['Skritch on the roof', 'Bolt the doors', 'The ferry burns', 'mill wheel']);
    expect(texts(await segment('Before the campaign')).join()).toMatch(/Start · The Grey Penitents/);
    expect(texts(await segment('Interlude 1')).join()).toMatch(/Two quiet days/);
    // a viewer moves nothing
    expect(screen.queryByRole('button', { name: /^Move up/ })).toBeNull();
  });

  it('a player moves their own blocks – up, over an anchor, and back with Undo; not others’, not the protocol', async () => {
    const { srv, c, kai } = story('player');
    const user = userEvent.setup();
    at(`/campaign/${c.id}/timeline`);
    const course = await segment('Battle 1 · Hel Fenn ferry · course');
    await waitFor(() => expect(texts(course)).toHaveLength(5));
    // only the own quote has tools
    expect(screen.getAllByRole('button', { name: /^Move up/ })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Move up: Bolt the doors.' }));
    await waitFor(() => expect(srv.state.positions.get(`note:${kai}`)).toMatchObject({ segment: expect.stringMatching(/:battle$/) }));
    expect(texts(course).slice(1).map((x) => x.match(/Skritch|Bolt/)?.[0])).toEqual(['Bolt', 'Skritch', undefined, undefined]);
    // over the anchor: to the battle's "before"
    await user.click(screen.getByRole('button', { name: 'Move up: Bolt the doors.' }));
    const before = await segment('Battle 1 · Hel Fenn ferry · before');
    await waitFor(() => expect(texts(before).join()).toMatch(/Bolt the doors/));
    expect(srv.state.positions.get(`note:${kai}`)).toMatchObject({ segment: expect.stringMatching(/:before$/) });
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(srv.state.positions.get(`note:${kai}`)).toMatchObject({ segment: expect.stringMatching(/:battle$/) }));
  });

  it('a leader moves any block, the protocol too, with "Move to…"', async () => {
    const { srv, c } = story('leader', { totp: true });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/timeline`);
    await segment('Battle 1 · Hel Fenn ferry · course');
    await user.click(await screen.findByRole('button', { name: 'Move to…: the protocol entry of turn 3' }));
    const sheet = screen.getByRole('dialog', { name: 'Move to…' });
    expect(within(sheet).getByRole('button', { name: 'Battle 1 · Hel Fenn ferry · course' }).getAttribute('aria-current')).toBe('true');
    await user.click(within(sheet).getByRole('button', { name: 'Battle 1 · Hel Fenn ferry · aftermath' }));
    await waitFor(() => expect(srv.state.positions.get('entry:11111111-1111-4111-8111-111111111111')).toMatchObject({ segment: expect.stringMatching(/:after$/) }));
    expect(texts(await segment('Battle 1 · Hel Fenn ferry · aftermath')).join()).toMatch(/The ferry burns/);
  });
});

/* The chronicle's published chapters (4a5, part 2), in the chronicle's own form. */
const BATTLE_DE = '---\nref: "battle-1"\ntitle: "Das Urteil im Nebel"\nchapter: "Erste Schlacht"\nic_date: "Frühes Jahr 2000 IC"\ndate: 2026-06-14\n---\n\n### Am Kai\n\nDer Nebel lag über dem Stir, und **Ottilie** rang den Great Crest zu Boden.\n';
const BATTLE_EN = '---\nref: "battle-1"\ntitle: "The Verdict in the Fog"\nchapter: "First Battle"\ndate: 2026-06-14\n---\n\n### At the Quay\n\nThe fog lay over the Stir, and the gulls did not cry.\n';
const INTERLUDE_DE = '---\nref: "interlude-1"\nkind: "interlude"\ntitle: "Der Nebel hebt sich"\nchapter: "Zwischenspiel"\ndate: 2026-06-21\n---\n\nDie Tage danach waren still, und der Regen hielt an.\n';

describe('the chronicle’s chapters', () => {
  it('a leader imports the chronicle’s files: German and English one chapter, at the head of its part; everyone reads it', async () => {
    const { srv, c, b } = story('leader', { totp: true });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/timeline`);
    await segment('Battle 1 · Hel Fenn ferry · course');
    await user.click(screen.getByRole('button', { name: 'Import chapters…' }));
    const sheet = screen.getByRole('dialog', { name: 'Import chapters' });
    await user.upload(within(sheet).getByLabelText('Chapter files'), [
      new File([BATTLE_DE], '2026-06-14-das-urteil-im-nebel.md', { type: 'text/markdown' }),
      new File([BATTLE_EN], '2026-06-14-the-verdict-in-the-fog.md', { type: 'text/markdown' }),
      new File([INTERLUDE_DE], '2026-06-21-der-nebel-hebt-sich.md', { type: 'text/markdown' }),
      new File(['# Notes\n\nNothing here.'], 'notes.md', { type: 'text/markdown' }),
    ]);
    const list = await within(sheet).findByRole('list', { name: 'Chapters to import' });
    expect(within(list).getAllByRole('listitem').map((x) => x.querySelector('span')?.textContent)).toEqual([
      'Erste Schlacht · Das Urteil im Nebel · Deutsch, English',
      'Zwischenspiel · Der Nebel hebt sich · Deutsch',
    ]);
    expect(within(list).getAllByRole('combobox').map((x) => (x as HTMLSelectElement).value)).toEqual([`b${b.id}:battle`, 'i1']);
    expect(within(sheet).getByRole('list', { name: 'Files not read' }).textContent).toMatch(/notes\.md: no front matter/);
    await user.click(within(sheet).getByRole('button', { name: 'Import 2 chapters' }));
    expect(await screen.findByText('2 chapters imported.')).toBeTruthy();
    expect([...srv.state.chapters.values()].map((x) => [x.refKey, x.de?.title, x.en?.title ?? null])).toEqual([['battle-1', 'Das Urteil im Nebel', 'The Verdict in the Fog'], ['interlude-1', 'Der Nebel hebt sich', null]]);
    // at the head of its part: after the fixed report, before every block
    const course = await segment('Battle 1 · Hel Fenn ferry · course');
    await waitFor(() => expect(texts(course)[1]).toMatch(/^Chapter · Erste Schlacht · Frühes Jahr 2000 ICDas Urteil im NebelThe Verdict in the Fog/));
    expect(texts(course)).toHaveLength(6);
    expect(texts(await segment('Interlude 1'))[0]).toMatch(/Chapter · Zwischenspiel/);
    // a leader moves it like the protocol
    expect(screen.getByRole('button', { name: 'Move to…: the chapter Das Urteil im Nebel' })).toBeTruthy();
    // read in either language
    await user.click(screen.getByRole('button', { name: 'Read Das Urteil im Nebel in English' }));
    const reader = await screen.findByRole('dialog', { name: 'The Verdict in the Fog' });
    expect(await within(reader).findByText('The fog lay over the Stir, and the gulls did not cry.')).toBeTruthy();
    await user.click(within(reader).getByRole('button', { name: 'Deutsch' }));
    expect(within(reader).getByRole('heading', { name: 'Am Kai' })).toBeTruthy();
    expect(within(reader).getByText('Ottilie').tagName).toBe('STRONG');
    // taken out again
    await user.click(within(reader).getByRole('button', { name: 'Take the chapter out' }));
    expect(await screen.findByText('Das Urteil im Nebel is out of the timeline.')).toBeTruthy();
    await waitFor(() => expect(texts(course).join()).not.toMatch(/Erste Schlacht/));
  });

  it('a player reads a chapter; imports, moves and takes out none', async () => {
    const { srv, c } = story('player');
    const id = '0000000c-0000-4000-8000-000000000000';
    srv.state.chapters.set(id, { id, campaignId: c.id, refKey: 'interlude-1', kind: 'interlude', publishedOn: '2026-06-21', createdAt: '2026-10-09T10:00:00.000Z', updatedAt: '2026-10-09T10:00:00.000Z', de: { label: 'Zwischenspiel', title: 'Der Nebel hebt sich', icDate: '', place: '', victor: '', text: 'Die Tage danach waren still.' }, en: null });
    srv.state.positions.set(`chapter:${id}`, { campaignId: c.id, itemType: 'chapter', itemId: id, segment: 'i1', pos: '05', movedBy: 'user-anna', movedAt: '2026-10-09T10:00:00.000Z' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/timeline`);
    const interlude = await segment('Interlude 1');
    await waitFor(() => expect(texts(interlude)[0]).toMatch(/Der Nebel hebt sich/));
    expect(screen.queryByRole('button', { name: 'Import chapters…' })).toBeNull();
    expect(screen.queryByRole('button', { name: /the chapter Der Nebel hebt sich/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Read Der Nebel hebt sich in Deutsch' }));
    const reader = await screen.findByRole('dialog', { name: 'Der Nebel hebt sich' });
    expect(await within(reader).findByText('Die Tage danach waren still.')).toBeTruthy();
    expect(within(reader).queryByRole('button', { name: 'Take the chapter out' })).toBeNull();
  });
});
