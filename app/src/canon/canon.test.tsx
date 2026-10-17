/* The canon export (phase 4b4b): a leader downloads the names of the campaign
   in German and English as a text file. Names only; nothing is saved unless
   every warband could be read. Against the stand-in server (sync/fakeSync.ts). */
import { ctxOf, writeSave } from '@mordheim/core';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
afterEach(async () => { cleanup(); stopSync(); resetSession(); localStorage.clear(); vi.restoreAllMocks(); await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });

function server() {
  const me = { ...KAI, totp: true };
  const srv = createFakeSync({ me: { id: KAI.id, username: KAI.username, displayName: KAI.displayName }, wbName: (wb) => data.WARBANDS[wb]?.name ?? wb });
  const handle = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost/');
    const path = url.pathname.replace(/^\/api\/v1/, '');
    return srv.handle(init?.method ?? 'GET', path, url.searchParams, init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {});
  };
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (new URL(String(input), 'http://localhost/').pathname === '/api/v1/auth/me') return new Response(JSON.stringify({ user: me, pending: false }), { headers: { 'content-type': 'application/json' } });
    return handle(input, init);
  }));
  signedIn({ stage: 'full', user: me });
  return { srv, handle };
}

interface Bits { uid: number; name?: string; profile?: unknown }

function scene() {
  const { srv, handle } = server();
  const anna = saveOf('The Grey Penitents') as { canon?: unknown; models: Bits[] };
  anna.canon = { name_de: 'Die Grauen Büßer', name_en: 'The Grey Penitents' };
  anna.models[0]!.profile = { name_de: 'Ulrich der Graue', name_en: 'Ulrich the Grey', title_de: 'Hauptmann', title_en: 'Captain', voice: 'SECRET-VOICE few words', origin: 'SECRET-ORIGIN Stirland', text: 'SECRET-TEXT' };
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'leader', others: [{ player: 'Anna', data: anna, role: 'player' }, { player: 'Ben', data: saveOf('Clan Skrittle') }] });
  const ferry = srv.factionFrom(c.id, { nameEn: 'The Ferrymen', nameDe: 'Die Fährleute', publicStatus: 'hold the crossing' });
  srv.npcFrom(c.id, { nameEn: 'Old Marek', nameDe: 'Alter Marek', factionId: ferry.id, publicStatus: 'alive' });
  srv.backgroundFrom(c.id, { kind: 'figure', title: 'SECRET-FIGURE', truth: 'SECRET-TRUTH', status: 'active', reveal: 'hidden' });
  srv.noteFrom(c.id, { author: 'Kai', text: 'SECRET-NOTE', kind: 'general', visibility: 'leader' });
  return { srv, handle, c };
}

/** The file the page hands to the browser, and its name. */
function catchDownload() {
  const blobs: Blob[] = [];
  const names: string[] = [];
  URL.createObjectURL = (b: Blob | MediaSource) => { blobs.push(b as Blob); return 'blob:canon'; };
  URL.revokeObjectURL = () => undefined;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download); });
  const read = () => new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsText(blobs[0]!); });
  return { names, blobs, read };
}

describe('the canon export', () => {
  it('a leader downloads the names in both languages – and nothing but names', async () => {
    const { c } = scene();
    const got = catchDownload();
    const user = userEvent.setup();
    at(`/campaign/${c.id}/manage`);
    await user.click(await screen.findByRole('button', { name: 'Download the canon (.txt)' }));
    expect(await screen.findByText(/^Saved \d+ names?: /)).toBeTruthy();
    expect(got.names).toEqual(['the-hel-fenn-campaign-canon.txt']);
    const text = await got.read();
    expect(text.split('\n')[0]).toBe('# Canon of The Hel Fenn Campaign');
    const lines = text.split('\n');
    const only = (marker: string) => { const i = lines.findIndex((l) => l.startsWith(`# == ${marker}:`)); return lines.slice(i + 1, lines.findIndex((l, k) => k > i && l.startsWith('# =='))).filter((l) => l.trim() && !l.startsWith('#')); };
    expect(only('only-de')).toEqual(expect.arrayContaining(['Alter Marek', 'Fährleute', 'Grauen Büßer', 'Hauptmann', 'Ulrich der Graue']));
    expect(only('only-en')).toEqual(expect.arrayContaining(['Captain', 'Grey Penitents', 'Ferrymen', 'Old Marek', 'Ulrich the Grey']));
    // what is not finished is said: the second warband has no canon name
    expect(only('incomplete')).toEqual(expect.arrayContaining(['Clan Skrittle – warband: no canon name yet']));
    expect(screen.getByText(/not finished yet – they are listed in the file\./)).toBeTruthy();
    // never the voice, the origin, the profile text, the background or a leaders' note
    expect(text).not.toMatch(/SECRET/);
  });

  it('saves nothing when a warband cannot be read, and names it', async () => {
    const { c, handle } = scene();
    const got = catchDownload();
    const fine = (fetch as unknown as { getMockImplementation: () => ((i: RequestInfo | URL, n?: RequestInit) => Promise<Response>) }).getMockImplementation();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), 'http://localhost/').pathname;
      if (/\/warbands\/[^/]+$/.test(path) && path.includes(c.enrolments[0]!.warbandId)) return new Response(JSON.stringify({ error: 'unavailable' }), { status: 503, headers: { 'content-type': 'application/json' } });
      return fine(input, init);
    }));
    void handle;
    const user = userEvent.setup();
    at(`/campaign/${c.id}/manage`);
    await user.click(await screen.findByRole('button', { name: 'Download the canon (.txt)' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/^Nothing was saved\. The Grey Penitents could not be read: /);
    expect(got.names).toEqual([]);
    expect(got.blobs).toEqual([]);
  });

  it('offline the button waits for the connection', async () => {
    const { c } = scene();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    at(`/campaign/${c.id}/manage`);
    const button = await screen.findByRole('button', { name: 'Download the canon (.txt)' });
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(true));
    expect(screen.getByText('Reading every warband needs the connection.')).toBeTruthy();
  });
});
