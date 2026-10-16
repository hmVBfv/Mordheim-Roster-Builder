/* The Chronicle tab (phase 4b5a): the whole story as written, chapter by
   chapter, for every member – read in either language where it stands, and
   downloaded as one file. Against the stand-in server (sync/fakeSync.ts). */
import { ctxOf, writeSave } from '@mordheim/core';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSession, signedIn } from '../account/session.ts';
import { ME as KAI } from '../account/testServer.ts';
import { AppRoutes } from '../app/App.tsx';
import { db } from '../db/db.ts';
import { createFakeSync, type FakeRole } from '../sync/fakeSync.ts';
import { stopSync } from '../sync/runner.ts';
import { data, sampleSave } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const saveOf = (name: string) => writeSave(ctxOf(data, { ...sampleSave(), name }));

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
beforeAll(async () => { await import('./Chronicle.tsx'); }, SCREENS_MS);
beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });
afterEach(async () => { cleanup(); stopSync(); resetSession(); localStorage.clear(); vi.restoreAllMocks(); await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });

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

const lang = (label: string, title: string, text: string, o: { icDate?: string; place?: string; victor?: string } = {}) => ({ label, title, icDate: '', place: '', victor: '', ...o, text });

/** A campaign with a prologue (both languages), a chapter of battle 1 (German only) and one in the interlude after it (English only). */
function story(role: FakeRole = 'viewer') {
  const srv = server();
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role, others: [{ player: 'Anna', data: saveOf('The Grey Penitents'), role: role === 'leader' ? 'player' : 'leader' }, { player: 'Ben', data: saveOf('Clan Skrittle') }] });
  const b = srv.addBattle(c.id, { title: 'City Hall' });
  b.status = 'closed';
  b.closedAt = '2026-10-04T13:00:00.000Z';
  const put = (id: string, refKey: string, kind: string, day: string, de: ReturnType<typeof lang> | null, en: ReturnType<typeof lang> | null, segment: string) => {
    srv.state.chapters.set(id, { id, campaignId: c.id, refKey, kind, publishedOn: day, createdAt: '2026-10-09T10:00:00.000Z', updatedAt: '2026-10-09T10:00:00.000Z', de, en });
    srv.state.positions.set(`chapter:${id}`, { campaignId: c.id, itemType: 'chapter', itemId: id, segment, pos: '05', movedBy: 'user-anna', movedAt: '2026-10-09T10:00:00.000Z' });
  };
  put('0000000c-0000-4000-8000-000000000001', 'prolog', 'prologue', '2026-06-01', lang('Prolog', 'Der Weg nach Mordheim', 'Der Regen hatte die Straße in einen Bach aus Lehm verwandelt.'), lang('Prologue', 'The road to Mordheim', 'The rain had turned the road to mud.'), 'pre');
  put('0000000c-0000-4000-8000-000000000002', 'battle-1', 'battle', '2026-06-08', lang('Kapitel 1', 'Das Rathaus', 'Das Rathaus stand noch.\n\nOttilie sah **Ulrich** an.', { icDate: '3. Nachgeheim', place: 'Mordheim', victor: 'Die Silberne Karavane' }), null, `b${b.id}:battle`);
  put('0000000c-0000-4000-8000-000000000003', 'interlude-1', 'interlude', '2026-06-15', null, lang('Interlude', 'What the rats took', 'In the morning a man was missing.'), 'i1');
  return { srv, c, b };
}

const chapters = () => within(screen.getByRole('list', { name: 'Chapters' })).getAllByRole('listitem');

describe('the Chronicle tab', () => {
  it('every member, a viewer too, sees the chapters in the order of the story, each with where it stands', async () => {
    const { c } = story('viewer');
    at(`/campaign/${c.id}/chronicle`);
    await screen.findByRole('list', { name: 'Chapters' });
    await waitFor(() => expect(chapters()).toHaveLength(3));
    expect(chapters().map((x) => within(x).getByRole('heading').textContent)).toEqual(['Der Weg nach Mordheim', 'Das Rathaus', 'What the rats took']);
    const hall = chapters()[1]!;
    expect(hall.textContent).toContain('Battle · Kapitel 1 · 3. Nachgeheim · Mordheim');
    expect(hall.textContent).toContain('Battle 1 · City Hall · course · Deutsch');
    expect(within(hall).getByText('Die Silberne Karavane')).toBeTruthy();
    // the interlude's chapter exists only in English: shown in it, and says so
    expect(chapters()[2]!.textContent).toContain('Interlude 1 · English – shown in English');
    expect(screen.getByRole('link', { name: 'Chronicle' })).toBeTruthy();
  });

  it('reads a chapter where it stands, in the language chosen; the other one where there is only that', async () => {
    const { c } = story('player');
    const user = userEvent.setup();
    at(`/campaign/${c.id}/chronicle`);
    await waitFor(() => expect(screen.getByRole('list', { name: 'Chapters' }).children).toHaveLength(3));
    await user.click(screen.getByRole('button', { name: 'Read Der Weg nach Mordheim' }));
    expect(await screen.findByText('Der Regen hatte die Straße in einen Bach aus Lehm verwandelt.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(await screen.findByText('The rain had turned the road to mud.')).toBeTruthy();
    expect(screen.queryByText('Der Regen hatte die Straße in einen Bach aus Lehm verwandelt.')).toBeNull();
    // bold names stay bold, as plain pieces
    await user.click(screen.getByRole('button', { name: 'Deutsch' }));
    await user.click(screen.getByRole('button', { name: 'Read Das Rathaus' }));
    expect((await screen.findByText('Ulrich')).tagName).toBe('STRONG');
    await user.click(screen.getByRole('button', { name: 'Hide Das Rathaus' }));
    expect(screen.queryByText('Das Rathaus stand noch.')).toBeNull();
  });

  it('downloads the whole chronicle as one .md in the language chosen', async () => {
    const { c } = story('player');
    const user = userEvent.setup();
    at(`/campaign/${c.id}/chronicle`);
    await waitFor(() => expect(screen.getByRole('list', { name: 'Chapters' }).children).toHaveLength(3));
    const blobs: Blob[] = [];
    const names: string[] = [];
    URL.createObjectURL = (b: Blob | MediaSource) => { blobs.push(b as Blob); return 'blob:chronicle'; };
    URL.revokeObjectURL = () => undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download); });
    await user.click(screen.getByRole('button', { name: 'Download all (.md)' }));
    expect(await screen.findByText('Saved 3 chapters as a .md file – 1 only in the other language, marked as such.')).toBeTruthy();
    expect(names).toEqual(['the-hel-fenn-campaign-chronicle-de.md']);
    const text = await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsText(blobs[0]!); });
    expect(text.split('\n')[0]).toBe('# The Hel Fenn Campaign — Chronicle (Deutsch)');
    expect(text.indexOf('Der Weg nach Mordheim')).toBeLessThan(text.indexOf('Das Rathaus'));
    expect(text.indexOf('Das Rathaus')).toBeLessThan(text.indexOf('What the rats took'));
    expect(text).toContain('*(Only available in English.)*');
    expect(text).toContain('Der Regen hatte die Straße in einen Bach aus Lehm verwandelt.');
  });

  it('with no chapter it says so and has nothing to download', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [{ player: 'Anna', data: saveOf('The Grey Penitents') }] });
    at(`/campaign/${c.id}/chronicle`);
    expect(await screen.findByText('No chapter has been published yet.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download all (.md)' }).hasAttribute('disabled')).toBe(true);
  });

  it('offline it shows the chapters it kept, and says so', async () => {
    const { c } = story('player');
    const first = at(`/campaign/${c.id}/chronicle`);
    await waitFor(() => expect(screen.getByRole('list', { name: 'Chapters' }).children).toHaveLength(3));
    first.unmount();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    at(`/campaign/${c.id}/chronicle`);
    await waitFor(() => expect(screen.getByRole('list', { name: 'Chapters' }).children).toHaveLength(3));
    expect((await screen.findAllByText(/Shown as last seen\./)).length).toBeGreaterThan(0);
  });
});
