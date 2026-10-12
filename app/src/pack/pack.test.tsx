/* The AI pack and the style guide (phase 4b4a): a leader's prompt for whoever
   writes the next chapter – the battle in story order, what changed, the
   canon, the world, the background with its hard rules, the style – made on
   the leader's device from what the app already reads. Against the stand-in
   server (sync/fakeSync.ts). */
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
beforeAll(async () => { await import('./PackSheet.tsx'); await import('./StyleSection.tsx'); }, SCREENS_MS);
beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });
afterEach(async () => { cleanup(); stopSync(); resetSession(); localStorage.clear(); vi.restoreAllMocks(); await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });

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

interface Bits { uid: number; name?: string; profile?: unknown }
const STYLE = 'German, past tense, close third person. No dice, no game terms.';
const STAT_KEY = '1:stat:ws';
const DIED_KEY = '1:died:hans';

/** A campaign with one closed battle, as a leader sees it: Anna's warband is marked (a death, an advance she explained), Ben's is not. */
function scene(role: FakeRole = 'leader', o: { totp?: boolean } = {}) {
  const srv = server({ totp: o.totp ?? true });
  const anna = saveOf('The Grey Penitents') as { canon?: unknown; story?: unknown; models: Bits[] };
  const hero = anna.models[0]!;
  hero.name = 'Ulrich';
  hero.profile = { name_de: 'Ulrich der Graue', name_en: 'Ulrich the Grey', voice: 'few words, all of them orders', origin: 'Stirland' };
  anna.canon = { name_de: 'Die Grauen Büßer', name_en: 'The Grey Penitents' };
  anna.story = { explain: { [STAT_KEY]: 'He learned it the hard way.' }, interludes: { '1': 'They buried Hans by the river.' } };
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role, others: [{ player: 'Anna', data: anna, role: role === 'leader' ? 'player' : 'leader' }, { player: 'Ben', data: saveOf('Clan Skrittle') }] });
  const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
  b.participants[0]!.outcome = 'victory';
  b.participants[1]!.outcome = 'defeat';
  srv.entryElsewhere(b.id, { id: '11111111-1111-4111-8111-111111111111', turn: 3, kind: 'event', payload: { text: 'The ferry burns.' }, author: 'Anna' });
  srv.entryElsewhere(b.id, {
    id: '22222222-2222-4222-8222-222222222222', turn: 4, kind: 'casualty', author: 'Ben',
    payload: { victim: { warbandId: b.participants[1]!.warbandId, uid: null, name: 'Grot' }, attacker: { warbandId: b.participants[0]!.warbandId, uid: hero.uid, name: 'Ulrich' }, note: '' },
  });
  srv.noteFrom(c.id, { author: 'Kai', text: 'Bolt the doors.', battleId: b.id, turn: 2, kind: 'quote' });
  srv.noteFrom(c.id, { author: 'Ben', text: 'Skritch eyes the captain.', battleId: b.id, turn: 1, kind: 'scene', visibility: 'sealed' });
  srv.noteFrom(c.id, { author: 'Kai', text: 'LEADER-ONLY plan: the ferryman turns on them.', battleId: b.id, turn: 5, kind: 'general', visibility: 'leader' });
  srv.noteFrom(c.id, { author: 'Anna', text: 'Two quiet days at the Blind Cat.', kind: 'general' });
  b.status = 'closed';
  b.closedAt = '2026-10-04T13:00:00.000Z';
  // Anna's mark after the battle, with the changes frozen into it
  const e = c.enrolments[0]!;
  e.tags = [...(e.tags ?? []), {
    id: 'tag-anna-1', kind: 'after_battle', rev: 1, round: b.round, battleId: b.id, totals: totals(e.data), createdBy: 'Anna', createdAt: '2026-10-04T14:00:00.000Z',
    changes: [
      { kind: 'died', uid: 77, name: 'Hans', changeKey: DIED_KEY, payload: { hero: true }, eventRef: null, unexplained: true },
      { kind: 'stat', uid: hero.uid, name: 'Ulrich', changeKey: STAT_KEY, payload: { stat: 'WS', before: 4, after: 5 }, eventRef: null, unexplained: false },
    ],
  }];
  // the world
  const ferry = srv.factionFrom(c.id, { nameEn: 'The Ferrymen', nameDe: 'Die Fährleute', publicStatus: 'hold the Stir crossing' });
  srv.npcFrom(c.id, { nameEn: 'Old Marek', factionId: ferry.id, publicStatus: 'alive' });
  srv.reputationFrom(c.id, { warbandId: e.warbandId, factionId: ferry.id, delta: -2, reason: 'burned the ferry' });
  // the background: a hidden person, a hinted thread, a started place; a plan, a GM note and a scenario idea stay out
  srv.backgroundFrom(c.id, { kind: 'figure', title: 'The Pale Man', truth: 'He is the ferryman’s brother.', status: 'active', reveal: 'hidden' });
  srv.backgroundFrom(c.id, { kind: 'thread', title: 'The eel coin', truth: 'The Countess pays the ferrymen.', playersKnow: 'A coin with an eel on it.', status: 'active', reveal: 'hint', hintLimits: 'a coin, an eel, wet money' });
  srv.backgroundFrom(c.id, { kind: 'place', title: 'The Old Mill', truth: 'It was a smugglers’ cellar.', status: 'active', reveal: 'revealed' });
  srv.backgroundFrom(c.id, { kind: 'thread', title: 'PLANNED-ONLY thread', truth: 'Not started yet.', status: 'planned', reveal: 'hidden' });
  srv.backgroundFrom(c.id, { kind: 'gm_note', title: 'GM-ONLY note', truth: 'Remember the dice.', status: 'active', reveal: 'hidden' });
  srv.backgroundFrom(c.id, { kind: 'scenario', title: 'SCENARIO-IDEA', truth: 'A siege.', status: 'active', reveal: 'hidden' });
  // a scenario released to the battle, a chapter written before it, the style
  srv.scenarioFrom(c.id, { title: 'Fog on the Stir', body: 'The ferry is dark: no shooting beyond 8".', battleId: b.id });
  const ch = '0000000c-0000-4000-8000-000000000000';
  srv.state.chapters.set(ch, { id: ch, campaignId: c.id, refKey: 'prologue', kind: 'prologue', publishedOn: '2026-06-21', createdAt: '2026-10-09T10:00:00.000Z', updatedAt: '2026-10-09T10:00:00.000Z', de: { label: 'Prolog', title: 'Auf Flügeln aus Feuer', icDate: '', place: '', victor: '', text: 'Die Fähre kam aus dem Nebel.' }, en: null });
  srv.state.positions.set(`chapter:${ch}`, { campaignId: c.id, itemType: 'chapter', itemId: ch, segment: 'pre', pos: '05', movedBy: 'user-anna', movedAt: '2026-10-09T10:00:00.000Z' });
  srv.styleFrom(c.id, STYLE);
  return { srv, c, b };
}

/** The pack sheet, opened and filled. */
async function openPack(user: ReturnType<typeof userEvent.setup>) {
  const button = await screen.findByRole('button', { name: 'AI pack…' });
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false)); // the timeline has come
  await user.click(button);
  const sheet = await screen.findByRole('dialog', { name: 'AI pack' });
  const prompt = (await within(sheet).findByLabelText('The prompt, as it will be copied')) as HTMLTextAreaElement;
  return { sheet, prompt };
}

describe('the AI pack', () => {
  it('a leader gets the battle in story order, with all that goes with it – and nothing only leaders may read', async () => {
    const { c } = scene();
    const user = userEvent.setup();
    at(`/campaign/${c.id}/timeline`);
    const { sheet, prompt } = await openPack(user);
    const t = prompt.value;
    expect(t.split('\n')[0]).toBe('<!-- mordheim-ai-pack format=1 -->');
    expect(t).toContain('# The Hel Fenn Campaign — Battle 1: Hel Fenn ferry');
    // who fought, the scenario
    expect(t).toMatch(/\*\*The Grey Penitents\*\*.*played by Anna.*Victory/);
    expect(t).toMatch(/\*\*Clan Skrittle\*\*.*played by Ben.*Defeat/);
    expect(t).toContain('### The scenario: Fog on the Stir');
    expect(t).toContain('no shooting beyond 8".');
    // the battle in the order of the timeline: the sealed scene opened, the quote verbatim, the protocol
    expect(t).toContain('Skritch eyes the captain.');
    expect(t).toMatch(/\(sealed, opened\)/);
    expect(t).toContain('> Bolt the doors.');
    expect(t).toContain('The ferry burns.');
    expect(t).toMatch(/Grot.*put out of action by Ulrich/);
    expect(t.indexOf('Skritch eyes the captain.')).toBeLessThan(t.indexOf('> Bolt the doors.'));
    expect(t.indexOf('> Bolt the doors.')).toBeLessThan(t.indexOf('The ferry burns.'));
    // what changed: the frozen changes of the mark, with the player's explanation and the deed
    expect(t).toContain('## Aftermath');
    expect(t).toMatch(/\*\*Hans\*\*.*no recorded cause/);
    expect(t).toContain('He learned it the hard way.');
    expect(t).toMatch(/In this battle: put Grot out of action/);
    expect(t).toContain('They buried Hans by the river.');
    // canon: the warband and the warrior the battle touched, with his voice
    expect(t).toContain('| Ulrich the Grey | Ulrich der Graue | voice: few words, all of them orders; origin: Stirland | The Grey Penitents |');
    expect(t).toContain('Die Grauen Büßer');
    // the world, the notes of the round, the chapters, the style
    expect(t).toContain('The Ferrymen');
    expect(t).toContain('Old Marek');
    expect(t).toContain('Two quiet days at the Blind Cat.');
    expect(t).toContain('### The last chapter in full: Prolog · Auf Flügeln aus Feuer');
    expect(t).toContain('Die Fähre kam aus dem Nebel.');
    expect(t).toContain(STYLE);
    // the background carries its rule; leaders’ own words stay out
    expect(t).toMatch(/### The Pale Man \(person\)\s+Rule: HIDDEN/);
    expect(t).toMatch(/### The eel coin \(thread\)\s+Rule: HINT ONLY.*a coin, an eel, wet money/);
    expect(t).toMatch(/### The Old Mill \(place\)\s+Rule: REVEALED/);
    expect(t).toContain('He is the ferryman’s brother.');
    for (const out of ['LEADER-ONLY', 'PLANNED-ONLY', 'GM-ONLY', 'SCENARIO-IDEA']) expect(t).not.toContain(out);
    // what is missing is told, not hidden
    const gaps = within(sheet).getByRole('list', { name: 'Gaps in the material' });
    expect(within(gaps).getByText('Clan Skrittle has not been marked after this battle: its aftermath is missing.')).toBeTruthy();
    expect(within(sheet).getByText(/characters · about .* tokens/)).toBeTruthy();
  });

  it('the parts and the language are the leader’s to choose', async () => {
    const { c } = scene();
    const user = userEvent.setup();
    at(`/campaign/${c.id}/timeline`);
    const { sheet, prompt } = await openPack(user);
    expect(prompt.value).toContain('Write the chapter in German.');
    expect(prompt.value).toContain(STYLE);
    await user.click(within(sheet).getByRole('checkbox', { name: /^Style/ }));
    await waitFor(() => expect(prompt.value).not.toContain(STYLE));
    await user.click(within(sheet).getByRole('checkbox', { name: /^Background/ }));
    await waitFor(() => expect(prompt.value).not.toContain('Rule: HIDDEN'));
    expect(prompt.value).not.toContain('He is the ferryman’s brother.');
    await user.click(within(sheet).getByRole('radio', { name: 'English' }));
    await waitFor(() => expect(prompt.value).toContain('Write the chapter in English.'));
    await user.click(within(sheet).getByRole('radio', { name: 'Both' }));
    await waitFor(() => expect(prompt.value).toContain('then give an English version'));
    // the parts that stay stand as they were
    expect(prompt.value).toContain('He learned it the hard way.');
  });

  it('a truth that becomes public only in a later battle goes in as hidden for the earlier one', async () => {
    const { srv, c, b } = scene();
    const later = srv.addBattle(c.id, { title: 'The siege', round: 2 });
    Object.assign(srv.backgroundFrom(c.id, { kind: 'thread', title: 'Early truth', truth: 'Told since the ferry.', status: 'active', reveal: 'revealed' }), { revealFromBattle: b.id });
    Object.assign(srv.backgroundFrom(c.id, { kind: 'thread', title: 'Late truth', truth: 'Told only from the siege.', status: 'active', reveal: 'revealed' }), { revealFromBattle: later.id });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/timeline`);
    const { sheet, prompt } = await openPack(user); // the latest battle first
    await waitFor(() => expect(prompt.value).toMatch(/# The Hel Fenn Campaign — Battle 2: The siege/));
    expect(prompt.value).toMatch(/### Late truth \(thread\)\s+Rule: REVEALED — public since Battle 2/);
    await user.selectOptions(within(sheet).getByLabelText('Battle'), b.id);
    // the field is made anew for the other battle, once its material has come
    await waitFor(() => expect((within(sheet).getByLabelText('The prompt, as it will be copied') as HTMLTextAreaElement).value).toMatch(/# The Hel Fenn Campaign — Battle 1: Hel Fenn ferry/));
    const now = (within(sheet).getByLabelText('The prompt, as it will be copied') as HTMLTextAreaElement).value;
    expect(now).toMatch(/### Early truth \(thread\)\s+Rule: REVEALED — public since Battle 1/);
    expect(now).toMatch(/### Late truth \(thread\)\s+Rule: HIDDEN/);
  });

  it('copies the prompt as it is shown, and saves it as a .md file named for the battle', async () => {
    const { c } = scene();
    const user = userEvent.setup();
    at(`/campaign/${c.id}/timeline`);
    const { sheet, prompt } = await openPack(user);
    await user.click(within(sheet).getByRole('button', { name: 'Copy prompt' }));
    expect(await within(sheet).findByText('Prompt copied. Paste it into a chat with Claude.')).toBeTruthy();
    expect(await navigator.clipboard.readText()).toBe(prompt.value);
    // the download: a Blob behind an anchor with a name
    const blobs: Blob[] = [];
    const names: string[] = [];
    URL.createObjectURL = (b: Blob | MediaSource) => { blobs.push(b as Blob); return 'blob:pack'; };
    URL.revokeObjectURL = () => undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download); });
    await user.click(within(sheet).getByRole('button', { name: 'Download .md' }));
    expect(names).toEqual(['the-hel-fenn-campaign-battle-1-ai-pack.md']);
    const text = await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsText(blobs[0]!); });
    expect(text).toBe(prompt.value);
    expect(blobs[0]!.type).toBe('text/markdown');
  });

  it('the sheet is made anew each time: a change of the style shows when it opens again', async () => {
    const { srv, c } = scene();
    const user = userEvent.setup();
    at(`/campaign/${c.id}/timeline`);
    const first = await openPack(user);
    expect(first.prompt.value).toContain(STYLE);
    await user.click(within(first.sheet).getByRole('button', { name: 'Close' }));
    srv.styleFrom(c.id, 'English, present tense.');
    await user.click(screen.getByRole('button', { name: 'AI pack…' }));
    await waitFor(() => expect((within(screen.getByRole('dialog', { name: 'AI pack' })).getByLabelText('The prompt, as it will be copied') as HTMLTextAreaElement).value).toContain('English, present tense.'));
  });

  it('only leaders with the authenticator have it; a player or viewer does not even see the button', async () => {
    const { c } = scene('player');
    at(`/campaign/${c.id}/timeline`);
    await screen.findByRole('list', { name: 'Timeline' });
    expect(screen.queryByRole('button', { name: 'AI pack…' })).toBeNull();
  });

  it('a leader without the authenticator is not offered it either', async () => {
    const { c } = scene('leader', { totp: false });
    at(`/campaign/${c.id}/timeline`);
    await screen.findByRole('list', { name: 'Timeline' });
    expect(screen.queryByRole('button', { name: 'AI pack…' })).toBeNull();
  });

  it('with no battle yet the button waits', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [{ player: 'Anna', data: saveOf('The Grey Penitents') }] });
    at(`/campaign/${c.id}/timeline`);
    const button = await screen.findByRole('button', { name: 'AI pack…' });
    expect(button.hasAttribute('disabled')).toBe(true);
  });
});

describe('the style guide', () => {
  const manage = (id: string) => at(`/campaign/${id}/manage`);

  it('a leader writes it; it is saved for the campaign, and read back', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [{ player: 'Anna', data: saveOf('The Grey Penitents') }] });
    const user = userEvent.setup();
    manage(c.id);
    const box = (await screen.findByLabelText('Instructions for the writer')) as HTMLTextAreaElement;
    await waitFor(() => expect(box.disabled).toBe(false)); // it waits for what the server has
    const save = screen.getByRole('button', { name: 'Save the style' });
    expect(save.hasAttribute('disabled')).toBe(true); // nothing changed yet
    await user.click(box);
    await user.paste(STYLE);
    await user.click(save);
    expect(await screen.findByText('Style guide saved.')).toBeTruthy();
    expect(srv.state.styles.get(c.id)).toMatchObject({ text: STYLE, updatedBy: 'Kai' });
    expect(save.hasAttribute('disabled')).toBe(true);
  });

  it('shows what is there, and what the leader has typed is not overwritten by what arrives', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [{ player: 'Anna', data: saveOf('The Grey Penitents') }] });
    srv.styleFrom(c.id, STYLE);
    manage(c.id);
    const box = (await screen.findByLabelText('Instructions for the writer')) as HTMLTextAreaElement;
    await waitFor(() => expect(box.value).toBe(STYLE));
    expect(screen.getByText(/Last saved by Anna\./)).toBeTruthy();
  });

  it('another leader changed it meanwhile: theirs is shown, with why', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [{ player: 'Anna', data: saveOf('The Grey Penitents') }] });
    srv.styleFrom(c.id, STYLE);
    const user = userEvent.setup();
    manage(c.id);
    const box = (await screen.findByLabelText('Instructions for the writer')) as HTMLTextAreaElement;
    await waitFor(() => expect(box.value).toBe(STYLE));
    await user.clear(box);
    await user.click(box);
    await user.paste('My version.');
    srv.styleFrom(c.id, 'Theirs.', 'Anna'); // another leader got in first
    await user.click(screen.getByRole('button', { name: 'Save the style' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Anna changed the style guide while you were editing it/);
    expect(box.value).toBe('Theirs.');
    expect(srv.state.styles.get(c.id)!.text).toBe('Theirs.');
  });

  it('offline it shows the last text it saw, says so, and cannot be saved', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [{ player: 'Anna', data: saveOf('The Grey Penitents') }] });
    srv.styleFrom(c.id, STYLE);
    const user = userEvent.setup();
    const first = manage(c.id);
    const box = (await screen.findByLabelText('Instructions for the writer')) as HTMLTextAreaElement;
    await waitFor(() => expect(box.value).toBe(STYLE));
    first.unmount();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    manage(c.id);
    const again = (await screen.findByLabelText('Instructions for the writer')) as HTMLTextAreaElement;
    await waitFor(() => expect(again.value).toBe(STYLE));
    expect(await screen.findByText('You are offline – this needs the connection.')).toBeTruthy();
    await user.type(again, ' More.');
    expect(screen.getByRole('button', { name: 'Save the style' }).hasAttribute('disabled')).toBe(true);
    expect(srv.state.styles.get(c.id)!.text).toBe(STYLE);
  });
});
