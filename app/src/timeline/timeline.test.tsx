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
