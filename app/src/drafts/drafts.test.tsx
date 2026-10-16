/* Chapters as drafts (phase 4b5b): a leader brings a chapter in as text, has
   it held against the hidden background, and publishes it – or throws it
   away. Nobody else sees a draft. Against the stand-in server
   (sync/fakeSync.ts). */
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
beforeAll(async () => { await import('../chronicle/Chronicle.tsx'); await import('./Drafts.tsx'); }, SCREENS_MS);
beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });
afterEach(async () => { cleanup(); stopSync(); resetSession(); localStorage.clear(); vi.restoreAllMocks(); await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });

function server(o: { totp?: boolean } = {}) {
  const me = { ...KAI, totp: o.totp ?? true };
  const srv = createFakeSync({ me: { id: KAI.id, username: KAI.username, displayName: KAI.displayName }, wbName: (wb) => data.WARBANDS[wb]?.name ?? wb });
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

const lang = (label: string, title: string, text: string) => ({ label, title, icDate: '', place: '', victor: '', text });
const GERHARD = 'Gerhard Voss wartete am Ufer der Stir, und die Nebel stiegen.';
const CLEAN = 'Ein ruhiger Morgen am Fluss, und niemand sprach ein Wort.';

/** A campaign with one closed battle (City Hall) and a background: a hidden person, a hinted thread, a place already public. */
function scene(role: FakeRole = 'leader', o: { totp?: boolean; chapter?: boolean } = {}) {
  const srv = server(o);
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role, others: [{ player: 'Anna', data: saveOf('The Grey Penitents'), role: role === 'leader' ? 'player' : 'leader' }, { player: 'Ben', data: saveOf('Clan Skrittle') }] });
  const b = srv.addBattle(c.id, { title: 'City Hall' });
  b.status = 'closed';
  b.closedAt = '2026-10-04T13:00:00.000Z';
  srv.backgroundFrom(c.id, { kind: 'figure', title: 'The ferryman', truth: 'Gerhard Voss ferries the Countess across the Stir. He kills witnesses.', playersKnow: 'A ferryman takes coin.', status: 'active', reveal: 'hidden' });
  srv.backgroundFrom(c.id, { kind: 'thread', title: 'The eel coin', truth: 'The Countess pays the ferrymen.', playersKnow: 'A coin with an eel on it.', status: 'active', reveal: 'hint', hintLimits: 'a coin, an eel, wet money' });
  srv.backgroundFrom(c.id, { kind: 'place', title: 'The Old Mill', truth: 'It was a smugglers’ cellar below Sigmar Street.', status: 'active', reveal: 'revealed' });
  if (o.chapter) {
    const id = '0000000c-0000-4000-8000-000000000002';
    srv.state.chapters.set(id, { id, campaignId: c.id, refKey: 'battle-1', kind: 'battle', publishedOn: '2026-06-08', createdAt: '2026-10-09T10:00:00.000Z', updatedAt: '2026-10-09T10:00:00.000Z', de: lang('Kapitel 1', 'Das Rathaus', 'Das Rathaus stand noch.'), en: null });
    srv.state.positions.set(`chapter:${id}`, { campaignId: c.id, itemType: 'chapter', itemId: id, segment: `b${b.id}:battle`, pos: '05', movedBy: 'user-anna', movedAt: '2026-10-09T10:00:00.000Z' });
  }
  return { srv, c, b };
}

const sheet = (name: string) => screen.findByRole('dialog', { name });
const drafts = () => within(screen.getByRole('list', { name: 'Drafts' })).queryAllByRole('listitem');
const chapters = () => within(screen.getByRole('list', { name: 'Chapters' })).queryAllByRole('listitem');

/** Opens the form and fills in a chapter by hand. */
async function bringIn(user: ReturnType<typeof userEvent.setup>, o: { title: string; text: string; lang?: 'de' | 'en'; round?: string }) {
  await user.click(await screen.findByRole('button', { name: 'Bring in a chapter' }));
  const form = await sheet('Bring in a chapter');
  await user.type(within(form).getByLabelText('Title'), o.title);
  if (o.round) { await user.clear(within(form).getByLabelText('Round of the battle')); await user.type(within(form).getByLabelText('Round of the battle'), o.round); }
  if (o.lang) await user.selectOptions(within(form).getByLabelText('Language'), o.lang);
  await user.click(within(form).getByLabelText('Text'));
  await user.paste(o.text);
  return form;
}

describe('chapter drafts', () => {
  it('only a leader with the authenticator has the section; for everybody else nothing is even asked', async () => {
    for (const [role, totp] of [['player', true], ['viewer', true], ['leader', false]] as const) {
      const { c, srv } = scene(role, { totp });
      at(`/campaign/${c.id}/chronicle`);
      await screen.findByText('No chapter has been published yet.');
      expect(screen.queryByRole('heading', { name: /Drafts/ })).toBeNull();
      expect(srv.state.calls.some((x) => x.includes('chapter-drafts'))).toBe(false);
      cleanup(); stopSync(); resetSession(); localStorage.clear(); vi.restoreAllMocks();
    }
    const { c } = scene('leader');
    at(`/campaign/${c.id}/chronicle`);
    expect(await screen.findByRole('heading', { name: /Drafts/ })).toBeTruthy();
    expect(screen.getByText('⚑ Leaders only')).toBeTruthy();
    expect(await screen.findByText('No draft yet.')).toBeTruthy();
  });

  it('brings a chapter in by hand: it is listed as a draft, kept on the server, and is no chapter', async () => {
    const { c, srv } = scene('leader');
    const user = userEvent.setup();
    at(`/campaign/${c.id}/chronicle`);
    await screen.findByText('No draft yet.');
    const form = await bringIn(user, { title: 'Das Rathaus', text: CLEAN, round: '1' });
    await user.click(within(form).getByRole('button', { name: 'Save the draft' }));
    await waitFor(() => expect(drafts()).toHaveLength(1));
    expect(drafts()[0]!.textContent).toContain('Battle · battle-1 · Deutsch');
    expect(screen.getByText('Draft “Das Rathaus” saved. Only leaders can see it.')).toBeTruthy();
    expect([...srv.state.drafts.values()]).toMatchObject([{ refKey: 'battle-1', kind: 'battle', lang: 'de', title: 'Das Rathaus', text: CLEAN, status: 'draft' }]);
    expect(chapters()).toHaveLength(0);
    expect(screen.getByText('No chapter has been published yet.')).toBeTruthy();
  });

  it('reads a chronicle file with its front matter, and a plain file as the text', async () => {
    const { c, srv } = scene('leader');
    const user = userEvent.setup();
    at(`/campaign/${c.id}/chronicle`);
    await user.click(await screen.findByRole('button', { name: 'Bring in a chapter' }));
    let form = await sheet('Bring in a chapter');
    const file = '---\nref: interlude-1\ntitle: What the rats took\nlang: en\nchapter: Interlude\nic_date: 4th Nachgeheim\n---\n\nIn the morning a man was missing.\n';
    await user.upload(within(form).getByLabelText('From a file (optional)'), new File([file], '2026-06-15-interlude-1-en.md', { type: 'text/markdown' }));
    expect(await within(form).findByText(/title, chapter and language come from its front matter/)).toBeTruthy();
    expect((within(form).getByLabelText('Title') as HTMLInputElement).value).toBe('What the rats took');
    expect((within(form).getByLabelText('What it tells') as HTMLSelectElement).value).toBe('interlude');
    expect((within(form).getByLabelText('Interlude after the battle of round') as HTMLInputElement).value).toBe('1');
    expect((within(form).getByLabelText('Language') as HTMLSelectElement).value).toBe('en');
    expect((within(form).getByLabelText('Text') as HTMLTextAreaElement).value).toBe('In the morning a man was missing.');
    await user.click(within(form).getByRole('button', { name: 'Save the draft' }));
    await waitFor(() => expect(drafts()).toHaveLength(1));
    expect([...srv.state.drafts.values()][0]).toMatchObject({ refKey: 'interlude-1', kind: 'interlude', lang: 'en', label: 'Interlude', icDate: '4th Nachgeheim' });

    // a file with no front matter: the title from its first heading, the language from its words, a note to check both
    await user.click(screen.getByRole('button', { name: 'Bring in a chapter' }));
    form = await sheet('Bring in a chapter');
    await user.upload(within(form).getByLabelText('From a file (optional)'), new File(['# Die Fähre\n\nDer Mann und die Frau gingen mit dem Boot auf den Fluss, und es war kalt.'], 'faehre.txt', { type: 'text/plain' }));
    expect(await within(form).findByText(/The whole file is the text; check the chapter and the language/)).toBeTruthy();
    expect((within(form).getByLabelText('Title') as HTMLInputElement).value).toBe('Die Fähre');
    expect((within(form).getByLabelText('Language') as HTMLSelectElement).value).toBe('de');
    expect((within(form).getByLabelText('Text') as HTMLTextAreaElement).value).toContain('Der Mann und die Frau');
  });

  it('holds the text against the background while it is typed, before anything is saved', async () => {
    const { c, srv } = scene('leader');
    const user = userEvent.setup();
    at(`/campaign/${c.id}/chronicle`);
    await screen.findByText('No draft yet.');
    const form = await bringIn(user, { title: 'Das Rathaus', text: GERHARD, round: '1' });
    const list = await within(form).findByRole('list', { name: 'Words of the hidden background' });
    expect(list.textContent).toContain('The ferryman');
    expect(list.textContent).toContain('“Voss” × 1');
    expect(within(form).getByText(/11 words · 1 paragraph · /)).toBeTruthy();
    // a clean text takes the warning away again; the leader is not stopped from saving a draft with words in it
    await user.clear(within(form).getByLabelText('Text'));
    await user.click(within(form).getByLabelText('Text'));
    await user.paste(CLEAN);
    expect(await within(form).findByText(/No word of the 2 hidden or hinted pieces of the background was found/)).toBeTruthy();
    expect(within(form).queryByRole('list', { name: 'Words of the hidden background' })).toBeNull();
    await user.clear(within(form).getByLabelText('Text'));
    await user.click(within(form).getByLabelText('Text'));
    await user.paste(GERHARD);
    await user.click(within(form).getByRole('button', { name: 'Save the draft' }));
    await waitFor(() => expect(srv.state.drafts.size).toBe(1));
  });

  it('will not save what the server would refuse, and says what is missing', async () => {
    const { c, srv } = scene('leader');
    const user = userEvent.setup();
    at(`/campaign/${c.id}/chronicle`);
    await user.click(await screen.findByRole('button', { name: 'Bring in a chapter' }));
    const form = await sheet('Bring in a chapter');
    await user.click(within(form).getByRole('button', { name: 'Save the draft' }));
    expect((await within(form).findByRole('alert')).textContent).toBe('Give the chapter a title.');
    await user.type(within(form).getByLabelText('Title'), 'Das Rathaus');
    await user.click(within(form).getByRole('button', { name: 'Save the draft' }));
    expect((await within(form).findByRole('alert')).textContent).toBe('The chapter has no text.');
    await user.selectOptions(within(form).getByLabelText('What it tells'), 'chapter');
    await user.click(within(form).getByLabelText('Text'));
    await user.paste(CLEAN);
    await user.type(within(form).getByLabelText('Key of the chapter'), 'Not A Key');
    await user.click(within(form).getByRole('button', { name: 'Save the draft' }));
    expect((await within(form).findByRole('alert')).textContent).toMatch(/may use a–z, 0–9 and “-” only/);
    expect(srv.state.drafts.size).toBe(0);
  });

  it('holds the text against the hidden background: what must not appear, what may be hinted, what is public', async () => {
    const { c, srv } = scene('leader');
    srv.draftFrom(c.id, { title: 'Das Rathaus', text: `${GERHARD} Die Gräfin zahlte mit einer Münze, auf der ein Aal war. The eel coin gleamed. Old Mill.`, refKey: 'battle-1' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/chronicle`);
    await user.click(await screen.findByRole('button', { name: 'Review Das Rathaus' }));
    const review = await sheet('Das Rathaus');
    const list = await within(review).findByRole('list', { name: 'Words of the hidden background' });
    const found = within(list).getAllByRole('listitem').filter((li) => li.querySelector('strong'));
    // what must not appear comes first; the public place is never listed
    expect(found.map((li) => li.querySelector('strong')!.textContent)).toEqual(['The ferryman', 'The eel coin']);
    expect(found[0]!.textContent).toContain('must not appear yet');
    expect(found[0]!.textContent).toContain('“Gerhard” × 1');
    expect(found[0]!.textContent).toContain('Gerhard Voss wartete am Ufer');
    expect(found[1]!.textContent).toContain('may only be hinted at');
    expect(found[1]!.textContent).toContain('Allowed: a coin, an eel, wet money');
    expect(within(review).queryByText(/Old Mill/, { selector: 'strong' })).toBeNull();
    // a warning the leader may override, but only knowingly
    const publish = within(review).getByRole('button', { name: 'Publish anyway' });
    expect(publish.hasAttribute('disabled')).toBe(true);
    await user.click(within(review).getByLabelText('I have read the places above and publish anyway'));
    expect(publish.hasAttribute('disabled')).toBe(false);
  });

  it('a revealed piece is public in its battle’s own chapter and after it – before it, it is held back', async () => {
    const { c, b, srv } = scene('leader');
    const mill = [...srv.state.background.values()].find((e) => e.title === 'The Old Mill')!;
    mill.revealFromBattle = b.id;
    srv.draftFrom(c.id, { title: 'Prolog', text: 'Im Keller der Old Mill unter der Sigmar Street.', refKey: 'prolog', kind: 'prologue' });
    srv.draftFrom(c.id, { title: 'Das Rathaus', text: 'Im Keller der Old Mill unter der Sigmar Street.', refKey: 'battle-1' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/chronicle`);
    await user.click(await screen.findByRole('button', { name: 'Review Das Rathaus' }));
    let review = await sheet('Das Rathaus');
    expect(await within(review).findByText(/No word of the \d+ hidden or hinted pieces? of the background was found/)).toBeTruthy();
    await user.click(within(review).getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Review Prolog' }));
    review = await sheet('Prolog');
    const list = await within(review).findByRole('list', { name: 'Words of the hidden background' });
    expect(within(list).getAllByRole('listitem').some((li) => li.querySelector('strong')?.textContent === 'The Old Mill')).toBe(true);
  });

  it('publishes a clean draft as a new chapter at the head of the battle it tells: everybody reads it, the draft is used up', async () => {
    const { c, b, srv } = scene('leader');
    srv.draftFrom(c.id, { title: 'Das Rathaus', text: CLEAN, refKey: 'battle-1', label: 'Kapitel 1' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/chronicle`);
    await user.click(await screen.findByRole('button', { name: 'Review Das Rathaus' }));
    const review = await sheet('Das Rathaus');
    expect(await within(review).findByText(/No word of the 2 hidden or hinted pieces/)).toBeTruthy();
    // no warning, no acknowledgement; the place is the battle’s own
    expect(within(review).queryByLabelText(/publish anyway/)).toBeNull();
    const place = within(review).getByLabelText('A new chapter, at the head of') as HTMLSelectElement;
    await waitFor(() => expect(place.value).toBe(`b${b.id}:battle`));
    const publish = within(review).getByRole('button', { name: 'Publish' });
    await waitFor(() => expect(publish.hasAttribute('disabled')).toBe(false));
    await user.click(publish);
    await waitFor(() => expect(chapters()).toHaveLength(1));
    expect(within(chapters()[0]!).getByRole('heading').textContent).toBe('Das Rathaus');
    expect(drafts()).toHaveLength(0);
    expect(screen.getByText('“Das Rathaus” is published in Deutsch. Everyone in the campaign can read it now.')).toBeTruthy();
    const ch = [...srv.state.chapters.values()][0]!;
    expect(ch).toMatchObject({ refKey: 'battle-1', kind: 'battle', de: { title: 'Das Rathaus', text: CLEAN }, en: null });
    expect(srv.state.positions.get(`chapter:${ch.id}`)).toMatchObject({ segment: `b${b.id}:battle` });
  });

  it('a draft of a chapter that exists joins it: the other language is added, the same one replaced – the place stays', async () => {
    const { c, srv } = scene('leader', { chapter: true });
    srv.draftFrom(c.id, { title: 'City Hall', text: CLEAN, refKey: 'battle-1', lang: 'en' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/chronicle`);
    await waitFor(() => expect(chapters()).toHaveLength(1));
    await user.click(await screen.findByRole('button', { name: 'Review City Hall' }));
    let review = await sheet('City Hall');
    expect(await within(review).findByText(/This adds the English text to “Das Rathaus”\./)).toBeTruthy();
    expect(within(review).queryByLabelText('A new chapter, at the head of')).toBeNull();
    await waitFor(() => expect(within(review).getByRole('button', { name: 'Publish' }).hasAttribute('disabled')).toBe(false));
    await user.click(within(review).getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(screen.getByText('“City Hall” is published in English. Everyone in the campaign can read it now.')).toBeTruthy());
    const ch = [...srv.state.chapters.values()][0]!;
    expect(srv.state.chapters.size).toBe(1);
    expect(ch).toMatchObject({ de: { title: 'Das Rathaus', text: 'Das Rathaus stand noch.' }, en: { title: 'City Hall', text: CLEAN } });
    await waitFor(() => expect(chapters()[0]!.textContent).toContain('Deutsch · English'));

    srv.draftFrom(c.id, { title: 'Das Rathaus', text: 'Das Rathaus stand noch, wenn man es so nennen wollte.', refKey: 'battle-1', lang: 'de' });
    cleanup(); stopSync();
    at(`/campaign/${c.id}/chronicle`);
    await user.click(await screen.findByRole('button', { name: 'Review Das Rathaus' }));
    review = await sheet('Das Rathaus');
    expect(await within(review).findByText(/This replaces the Deutsch text of “Das Rathaus”\./)).toBeTruthy();
    await waitFor(() => expect(within(review).getByRole('button', { name: 'Publish' }).hasAttribute('disabled')).toBe(false));
    await user.click(within(review).getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(ch.de?.text).toBe('Das Rathaus stand noch, wenn man es so nennen wollte.'));
    expect(ch.en?.text).toBe(CLEAN);
  });

  it('throws a draft away only after asking; a draft changed meanwhile by another leader is shown to the one who saves over it', async () => {
    const { c, srv } = scene('leader');
    const d = srv.draftFrom(c.id, { title: 'Das Rathaus', text: CLEAN, refKey: 'battle-1' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/chronicle`);
    // Edit: another leader changed it in between
    await user.click(await screen.findByRole('button', { name: 'Edit Das Rathaus' }));
    const form = await sheet('Edit the draft');
    const mine = srv.state.drafts.get(d.id)!;
    Object.assign(mine, { text: 'Anna schrieb es neu.', seq: mine.seq + 5 });
    await user.type(within(form).getByLabelText('Title'), ' II');
    await user.click(within(form).getByRole('button', { name: 'Save the draft' }));
    expect((await within(form).findByRole('alert')).textContent).toBe('Anna changed this draft while you were editing it. Save again to replace their version with yours.');
    await user.click(within(form).getByRole('button', { name: 'Save the draft' }));
    await waitFor(() => expect(srv.state.drafts.get(d.id)!.title).toBe('Das Rathaus II'));

    // Throw away: asked first
    await user.click(await screen.findByRole('button', { name: 'Review Das Rathaus II' }));
    const review = await sheet('Das Rathaus II');
    await user.click(within(review).getByRole('button', { name: 'Throw away' }));
    expect(srv.state.drafts.get(d.id)!.deleted).toBeUndefined();
    await user.click(within(review).getByRole('button', { name: 'Keep it' }));
    await user.click(within(review).getByRole('button', { name: 'Throw away' }));
    await user.click(within(review).getByRole('button', { name: 'Yes, throw it away' }));
    await waitFor(() => expect(drafts()).toHaveLength(0));
    expect(srv.state.drafts.get(d.id)!.deleted).toBe(true);
    expect(screen.getByText('Draft “Das Rathaus II” thrown away.')).toBeTruthy();
  });

  it('offline it shows the drafts it kept, and writing needs the connection', async () => {
    const { c, srv } = scene('leader');
    srv.draftFrom(c.id, { title: 'Das Rathaus', text: CLEAN, refKey: 'battle-1' });
    const first = at(`/campaign/${c.id}/chronicle`);
    await waitFor(() => expect(drafts()).toHaveLength(1));
    first.unmount();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const user = userEvent.setup();
    at(`/campaign/${c.id}/chronicle`);
    await waitFor(() => expect(drafts()).toHaveLength(1));
    expect((await screen.findAllByText(/Shown as last seen\./)).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Bring in a chapter' }));
    const form = await sheet('Bring in a chapter');
    expect(within(form).getByText('Saving a draft needs the connection.')).toBeTruthy();
    expect(within(form).getByRole('button', { name: 'Save the draft' }).hasAttribute('disabled')).toBe(true);
  });
});
