/* The backstory (concept.md 4.10): what happened before the campaign came
   into the app. Every member reads it in the Chronicle tab; a leader with the
   authenticator brings it in as text, cut into sections at its headings,
   held against the hidden background first. Against the stand-in server. */
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
beforeAll(async () => { await import('../chronicle/Chronicle.tsx'); }, SCREENS_MS);
beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });
afterEach(async () => { cleanup(); stopSync(); resetSession(); localStorage.clear(); vi.restoreAllMocks(); await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });

function scene(role: FakeRole, totp = true) {
  const me = { ...KAI, totp };
  const srv = createFakeSync({ me: { id: KAI.id, username: KAI.username, displayName: KAI.displayName }, wbName: (wb) => data.WARBANDS[wb]?.name ?? wb });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost/');
    const path = url.pathname.replace(/^\/api\/v1/, '');
    if (path === '/auth/me') return new Response(JSON.stringify({ user: me, pending: false }), { headers: { 'content-type': 'application/json' } });
    srv.state.calls.push(`${init?.method ?? 'GET'} ${path}`);
    return srv.handle(init?.method ?? 'GET', path, url.searchParams, init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {});
  }));
  signedIn({ stage: 'full', user: me });
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role, others: [{ player: 'Anna', data: saveOf('The Grey Penitents'), role: role === 'leader' ? 'player' : 'leader' }] });
  return { srv, c };
}

const TEXT = '# The group’s chronicle\n\nThe caravan left Nuln in the spring.\n\n## Battle 1 – the ferry\nRain over the Stir.\n\n## Battle 3 – the quay\nA building collapsed.\n';
const SECTIONS = [
  { heading: 'The group’s chronicle', battleNo: null, text: 'The caravan left Nuln in the spring.' },
  { heading: 'Battle 1 – the ferry', battleNo: 1, text: 'Rain over the Stir.' },
  { heading: 'Battle 3 – the quay', battleNo: 3, text: 'A building collapsed.' },
];

describe('reading the backstory', () => {
  it('every member, a viewer too, reads the sections where they stand; nobody but a leader sees how to bring it in', async () => {
    for (const [role, totp] of [['viewer', true], ['player', true]] as const) {
      const { srv, c } = scene(role, totp);
      srv.backstoryFrom(c.id, SECTIONS);
      at(`/campaign/${c.id}/chronicle`);
      const list = await screen.findByRole('list', { name: 'Backstory sections' });
      expect(within(list).getAllByRole('listitem').map((x) => within(x).getByText(/Battle|chronicle/, { selector: 'summary' }).textContent)).toEqual(
        ['The group’s chronicle before the first battle', 'Battle 1 – the ferry Battle 1', 'Battle 3 – the quay Battle 3']);
      expect(within(list).getByText('Rain over the Stir.')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /backstory…/ })).toBeNull();
      cleanup(); stopSync(); resetSession(); localStorage.clear(); vi.restoreAllMocks();
    }
  });

  it('says so when there is none', async () => {
    const { c } = scene('player');
    at(`/campaign/${c.id}/chronicle`);
    expect(await screen.findByText('No backstory yet.')).toBeTruthy();
  });
});

describe('bringing the backstory in', () => {
  it('a leader pastes the old chronicle: it is cut into sections, saved, and everyone reads it', async () => {
    const { srv, c } = scene('leader');
    const user = userEvent.setup();
    at(`/campaign/${c.id}/chronicle`);
    await user.click(await screen.findByRole('button', { name: 'Bring in the backstory…' }));
    const form = await screen.findByRole('dialog', { name: 'Bring in the backstory' });
    expect(within(form).getByText('Everyone in the campaign will read it.')).toBeTruthy();
    await user.click(within(form).getByLabelText('Text'));
    await user.paste(TEXT);
    const found = await within(form).findByRole('list', { name: 'Sections found' });
    expect(within(found).getAllByRole('listitem').map((x) => x.textContent)).toEqual([
      'The group’s chroniclebefore the first battle · 7 words', 'Battle 1 – the ferryBattle 1 · 4 words', 'Battle 3 – the quayBattle 3 · 3 words',
    ]);
    expect(await within(form).findByText(/No word of the hidden or hinted background was found/)).toBeTruthy();
    await user.click(within(form).getByRole('button', { name: 'Save the backstory' }));
    await waitFor(() => expect(srv.state.backstories.get(c.id)?.sections).toEqual(SECTIONS));
    expect(await screen.findByText('Backstory saved: 3 sections. Everyone in the campaign can read it.')).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'Backstory sections' })).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Replace the backstory…' })).toBeTruthy();
  });

  it('holds the text against the hidden background: a name that must not appear needs the leader’s word', async () => {
    const { srv, c } = scene('leader');
    srv.backgroundFrom(c.id, { kind: 'figure', title: 'The ferryman', truth: 'Gerhard Voss ferries the Countess across the Stir. He kills witnesses.', playersKnow: 'A ferryman takes coin.', status: 'active', reveal: 'hidden' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/chronicle`);
    await user.click(await screen.findByRole('button', { name: 'Bring in the backstory…' }));
    const form = await screen.findByRole('dialog', { name: 'Bring in the backstory' });
    await user.click(within(form).getByLabelText('Text'));
    await user.paste('## Battle 1\nGerhard Voss waited at the Stir.');
    expect(await within(form).findByRole('list', { name: 'Words of the hidden background' })).toBeTruthy();
    expect(within(form).getByText('In “Battle 1”')).toBeTruthy();
    const save = within(form).getByRole('button', { name: 'Save the backstory' });
    await user.click(save);
    expect(await within(form).findByText(/tick that you want everyone to read this/)).toBeTruthy();
    expect(srv.state.backstories.has(c.id)).toBe(false);
    await user.click(within(form).getByRole('checkbox', { name: /everyone in the campaign may read this/ }));
    await user.click(save);
    await waitFor(() => expect(srv.state.backstories.get(c.id)?.sections).toEqual([{ heading: 'Battle 1', battleNo: 1, text: 'Gerhard Voss waited at the Stir.' }]));
  });

  it('replaces what was there, and says so; another leader’s change in between is not overwritten blindly', async () => {
    const { srv, c } = scene('leader');
    srv.backstoryFrom(c.id, SECTIONS.slice(0, 1));
    const user = userEvent.setup();
    at(`/campaign/${c.id}/chronicle`);
    await screen.findByRole('list', { name: 'Backstory sections' });
    await user.click(screen.getByRole('button', { name: 'Replace the backstory…' }));
    const form = await screen.findByRole('dialog', { name: 'Replace the backstory' });
    expect(within(form).getByText('This replaces the 1 section that is there now.')).toBeTruthy();
    await user.click(within(form).getByLabelText('Text'));
    await user.paste('## Battle 2\nA building collapsed.');
    // another leader gets in first
    srv.backstoryFrom(c.id, SECTIONS, 'Anna');
    await user.click(within(form).getByRole('button', { name: 'Save the backstory' }));
    expect(await within(form).findByText(/Anna replaced the backstory while you were editing/)).toBeTruthy();
    expect(srv.state.backstories.get(c.id)?.sections).toEqual(SECTIONS);
    await user.click(within(form).getByRole('button', { name: 'Save the backstory' }));
    await waitFor(() => expect(srv.state.backstories.get(c.id)?.sections).toEqual([{ heading: 'Battle 2', battleNo: 2, text: 'A building collapsed.' }]));
  });

  it('saves nothing when no section can be made of the text', async () => {
    const { srv, c } = scene('leader');
    const user = userEvent.setup();
    at(`/campaign/${c.id}/chronicle`);
    await user.click(await screen.findByRole('button', { name: 'Bring in the backstory…' }));
    const form = await screen.findByRole('dialog', { name: 'Bring in the backstory' });
    expect(within(form).getByRole('button', { name: 'Save the backstory' })).toHaveProperty('disabled', true);
    await user.click(within(form).getByLabelText('Text'));
    await user.paste('# Only a title\n');
    expect(within(form).getByRole('button', { name: 'Save the backstory' })).toHaveProperty('disabled', true);
    expect(srv.state.backstories.has(c.id)).toBe(false);
  });
});
