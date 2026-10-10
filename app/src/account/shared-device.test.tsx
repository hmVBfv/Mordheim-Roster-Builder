/* One device, two accounts (security review CLIENT-1, CLIENT-2): what the
   campaign server showed one account – a leaders' note, sealed words, an
   unsent note – never reaches the next one, not even from the device's
   own cache; signed out, an account's warbands are neither listed nor
   opened. Based on the reviewer's probe, which showed the opposite. */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FORMAT } from '@mordheim/core';
import { AppRoutes } from '../app/App.tsx';
import type { CampaignView } from '../campaign/api.ts';
import { db } from '../db/db.ts';
import { getNotes } from '../notes/api.ts';
import { NotesTab } from '../notes/Notes.tsx';
import { sampleSave } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';
import { flushOutbox } from '../battle/outbox.ts';
import { forgetCampaignData } from './owner.ts';
import { resetSession, signedIn, signedOut } from './session.ts';

beforeAll(polyfillDialog);
beforeAll(loadScreens, SCREENS_MS);
beforeEach(async () => { await db.meta.clear(); await db.outbox.clear(); await db.warbands.clear(); });
afterEach(async () => { cleanup(); resetSession(); localStorage.clear(); await db.meta.clear(); await db.outbox.clear(); await db.warbands.clear(); });

const A = { id: 'uA', username: 'anna', displayName: 'Anna', isAdmin: false, totp: true, mustSetUpTotp: false };
const B = { id: 'uB', username: 'ben', displayName: 'Ben', isAdmin: false, totp: false, mustSetUpTotp: false };
const CID = '11111111-1111-4111-8111-111111111111';
const T = '2026-10-01T10:00:00Z';
const leaderNote = { id: 'n1', battleId: null, turn: null, kind: 'general', text: 'LEADER-ONLY-SECRET', visibility: 'leader', mentions: [], authorId: 'uA', author: 'Anna', lang: 'en', sealedUntil: null, opened: false, protocolEntryId: null, createdAt: T, updatedAt: T, edited: false };
const SEQ = 7;

/** The server as routes-notes.ts answered before the review: `since` at or past the newest seq is "unchanged", whoever asks. */
function serverFor(who: 'A' | 'B') {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost/');
    const json = (v: unknown) => new Response(JSON.stringify(v), { headers: { 'content-type': 'application/json' } });
    if (url.pathname.endsWith('/notes')) {
      const since = url.searchParams.get('since');
      if (since !== null && Number(since) >= SEQ) return json({ unchanged: true, seq: SEQ });
      return json({ notes: who === 'A' ? [leaderNote] : [], seq: SEQ });
    }
    if (url.pathname.endsWith('/attachments')) return json({ attachments: [], seq: 0 });
    if (url.pathname.endsWith('/auth/me')) return json({ user: null, pending: false });
    return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  }));
}
const texts = (r: Awaited<ReturnType<typeof getNotes>>) => r.notes.map((n) => ('text' in n ? n.text : ''));

describe('one device, two accounts', () => {
  it('the next account never gets the cached leaders’ note of the one before', async () => {
    serverFor('A');
    signedIn({ stage: 'full', user: A });
    expect(texts(await getNotes(CID))).toContain('LEADER-ONLY-SECRET');
    signedOut();
    // signing out takes the campaign data off the device
    await waitFor(async () => expect((await db.meta.toArray()).map((r) => r.key)).toEqual([]));
    serverFor('B');
    signedIn({ stage: 'full', user: B });
    expect(texts(await getNotes(CID))).not.toContain('LEADER-ONLY-SECRET');
  });

  it('kept per account: without a sign-out in between (a session ended elsewhere), the next one reads nothing of the last', async () => {
    serverFor('A');
    signedIn({ stage: 'full', user: A });
    await getNotes(CID);
    serverFor('B');
    signedIn({ stage: 'full', user: B });
    expect(texts(await getNotes(CID))).toEqual([]);
    // and the last one's are gone from the device
    await waitFor(async () => expect((await db.meta.toArray()).some((r) => r.key.includes('uA'))).toBe(false));
  });

  it('an unsent sealed note waits for its author – the next account neither sees nor sends it', async () => {
    await db.outbox.put({ key: 'n2', op: 'note.put', userId: 'uA', campaignId: CID, battleId: 'b1', targetId: 'n2', at: T,
      body: { battleId: 'b1', turn: 2, kind: 'scene', text: 'SEALED-PLAN-OF-ANNA', visibility: 'sealed', mentions: [] } });
    signedOut();
    serverFor('B');
    signedIn({ stage: 'full', user: B });
    const view: CampaignView = { campaign: { id: CID, name: 'C', round: 1, houseRules: {}, createdAt: T, updatedAt: T }, role: 'player', members: [], enrolments: [], battles: [] };
    render(<MemoryRouter><NotesTab id={CID} view={view} user={B} lead={false} /></MemoryRouter>);
    await screen.findByText(/No notes yet|Nothing written yet|no notes/i);
    expect(screen.queryByText(/SEALED-PLAN-OF-ANNA/)).toBeNull();
    expect(await db.outbox.get('n2')).toBeTruthy();
  });

  it('forgetting keeps the one account named', async () => {
    await db.meta.bulkPut([{ key: `notes:uA:${CID}`, value: 1 }, { key: `notes:uB:${CID}`, value: 2 }, { key: `campaigns:uA:list`, value: [] }, { key: 'sync:uA', value: { cursor: 3 } }]);
    await forgetCampaignData('uB');
    expect((await db.meta.toArray()).map((r) => r.key).sort()).toEqual([`notes:uB:${CID}`, 'sync:uA'].sort());
  });
});

describe('requests on their way when the account changes (independent review of CLIENT-1)', () => {
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } });
  const sentAs = (init?: RequestInit) => new Headers(init?.headers).get('X-Roster-User');

  it('an answer for the last account that arrives after the next one signed in is not kept', async () => {
    let answer!: (r: Response) => void;
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => (String(input).endsWith('/notes')
      ? new Promise<Response>((go) => { answer = go; })
      : Promise.resolve(json({ user: null, pending: false })))));
    signedIn({ stage: 'full', user: A });
    const asked = getNotes(CID);
    await waitFor(() => expect(answer).toBeTypeOf('function'));
    signedIn({ stage: 'full', user: B });
    answer(json({ notes: [leaderNote], seq: SEQ }));
    await asked;
    await new Promise((r) => setTimeout(r, 20));
    expect(JSON.stringify(await db.meta.toArray())).not.toContain('LEADER-ONLY-SECRET');
  });

  it('every request says whose it is; when the server’s cookie belongs to another account, the app asks again who is signed in', async () => {
    const calls: { url: string; as: string | null }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, as: sentAs(init) });
      if (url.endsWith('/auth/me')) return json({ user: B, pending: false });
      return json({ error: 'other_user' }, 409);
    }));
    signedIn({ stage: 'full', user: A });
    await expect(getNotes(CID)).rejects.toMatchObject({ code: 'other_user' });
    expect(calls[0]).toMatchObject({ as: 'uA' });
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/auth/me') && c.as === null)).toBe(true));
  });

  it('an unsent note goes only as its author: the device signed in as somebody else, it waits', async () => {
    await db.outbox.put({ key: 'n3', op: 'note.put', userId: 'uA', campaignId: CID, battleId: '', targetId: 'n3', at: T,
      body: { battleId: null, turn: null, kind: 'scene', text: 'WORDS-OF-ANNA', visibility: 'leader', mentions: [] } });
    // the server: the cookie is Ben's; a request made for anybody else is refused
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => (sentAs(init) && sentAs(init) !== 'uB' ? json({ error: 'other_user' }, 409) : json({ note: {} }))));
    signedIn({ stage: 'full', user: B });
    expect(await flushOutbox('uA')).toBe(0);
    expect(await db.outbox.get('n3')).toMatchObject({ userId: 'uA' });
    expect((await db.outbox.get('n3'))?.refused).toBeUndefined();
  });
});

describe('signed out', () => {
  it('an account’s warbands are neither listed nor opened; the device’s own are', async () => {
    serverFor('B');
    const s = sampleSave();
    const rec = (id: string, ownerId?: string) => ({ id, name: `W ${id}`, wb: s.wb as string, wbName: 'Mercenaries', state: { ...s, name: `W ${id}` }, format: FORMAT, createdAt: T, updatedAt: T, ...(ownerId ? { ownerId } : {}) });
    await db.warbands.bulkPut([rec('w-anna', 'uA'), rec('w-device')]);
    signedOut();
    render(<MemoryRouter initialEntries={['/warbands']}><AppRoutes /></MemoryRouter>);
    expect(await screen.findByText('W w-device')).toBeTruthy();
    expect(screen.queryByText('W w-anna')).toBeNull();
    cleanup();
    render(<MemoryRouter initialEntries={['/warbands/w-anna']}><AppRoutes /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByRole('heading', { level: 1, name: 'W w-anna' })).toBeNull());
    expect(await screen.findByText(/not (on this device|here)|no warband/i)).toBeTruthy();
  });
});
