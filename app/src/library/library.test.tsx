/* The Library (ADR 0023): one's own ideas – later factions, NPCs, groups and scenarios – kept with the account,
   against the stand-in server (sync/fakeSync.ts). */
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
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });
afterEach(async () => { cleanup(); stopSync(); resetSession(); localStorage.clear(); vi.unstubAllGlobals(); await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });

/** The stand-in server behind fetch, signed in as Kai. */
function server() {
  const me = { ...KAI };
  const srv = createFakeSync({ me: { id: KAI.id, username: KAI.username, displayName: KAI.displayName } });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (srv.state.down) throw new TypeError('Failed to fetch');
    const url = new URL(String(input), 'http://localhost/');
    const path = url.pathname.replace(/^\/api\/v1/, '');
    if (path === '/auth/me') return new Response(JSON.stringify({ user: me, pending: false }), { headers: { 'content-type': 'application/json' } });
    srv.state.calls.push(`${init?.method ?? 'GET'} ${path}`);
    return srv.handle(init?.method ?? 'GET', path, url.searchParams, init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {});
  }));
  signedIn({ stage: 'full', user: me });
  return srv;
}

const ideas = (srv: ReturnType<typeof server>) => [...srv.state.library.values()].filter((i) => !i.deletedAt);

describe('the Library: ideas', () => {
  it('the first reader finds /library opened on Ideas, with an empty page that says what it is for', async () => {
    server();
    at('/library');
    expect(await screen.findByRole('heading', { level: 1, name: 'Library' })).toBeTruthy();
    expect(within(screen.getByRole('navigation', { name: 'Library' })).getAllByRole('link').map((a) => a.textContent)).toEqual(['Ideas', 'Factions', 'Lore']);
    expect(await screen.findByText(/No ideas yet/)).toBeTruthy();
  });

  it('writes an idea, reads it in the list, changes it, takes it out', async () => {
    const srv = server();
    const user = userEvent.setup();
    at('/library/ideas');
    await user.click(await screen.findByRole('button', { name: 'New idea' }));
    let sheet = screen.getByRole('dialog', { name: 'A new idea' });
    await user.type(within(sheet).getByLabelText('Title'), 'The ferrymen');
    await user.selectOptions(within(sheet).getByLabelText('About'), 'warband');
    await user.type(within(sheet).getByLabelText('The idea'), 'A war band that knows every ford of the Stir.');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    const list = await screen.findByRole('list', { name: 'Ideas' });
    expect(within(list).getByText('The ferrymen')).toBeTruthy();
    expect(within(list).getByText('Warband')).toBeTruthy();
    expect(within(list).getByText(/knows every ford/)).toBeTruthy();
    expect(ideas(srv)).toMatchObject([{ kind: 'idea', name: 'The ferrymen', body: { topic: 'warband', text: 'A war band that knows every ford of the Stir.' } }]);

    // changed from the state it was seen in
    await user.click(within(list).getByRole('button', { name: 'Edit The ferrymen' }));
    sheet = screen.getByRole('dialog', { name: 'Edit idea' });
    const text = within(sheet).getByLabelText('The idea');
    await user.clear(text);
    await user.type(text, 'They smuggle for the Countess.');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(ideas(srv)[0]!.body).toMatchObject({ text: 'They smuggle for the Countess.' }));
    expect(await within(await screen.findByRole('list', { name: 'Ideas' })).findByText(/smuggle for the Countess/)).toBeTruthy();

    // taken out only after asking
    await user.click(within(screen.getByRole('list', { name: 'Ideas' })).getByRole('button', { name: 'Edit The ferrymen' }));
    sheet = screen.getByRole('dialog', { name: 'Edit idea' });
    await user.click(within(sheet).getByRole('button', { name: 'Remove this idea' }));
    expect(ideas(srv)).toHaveLength(1);
    await user.click(within(sheet).getByRole('button', { name: 'Yes, remove it' }));
    await waitFor(() => expect(ideas(srv)).toHaveLength(0));
    expect(await screen.findByText(/No ideas yet/)).toBeTruthy();
  });

  it('an idea without a title is not saved', async () => {
    const srv = server();
    const user = userEvent.setup();
    at('/library/ideas');
    await user.click(await screen.findByRole('button', { name: 'New idea' }));
    const sheet = screen.getByRole('dialog', { name: 'A new idea' });
    expect((within(sheet).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    await user.type(within(sheet).getByLabelText('The idea'), 'Words, but no title.');
    expect((within(sheet).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    expect(ideas(srv)).toHaveLength(0);
  });

  it('offline the last list is there, shown as last seen; writing needs the connection', async () => {
    const srv = server();
    srv.libraryFrom({ name: 'The ferrymen', body: { text: 'Smugglers.', topic: 'warband' } });
    const user = userEvent.setup();
    at('/library/ideas');
    expect(await screen.findByText('The ferrymen')).toBeTruthy();
    cleanup();
    srv.state.down = true;
    at('/library/ideas');
    expect(await screen.findByText('The ferrymen')).toBeTruthy();
    expect(await screen.findByText(/Shown as last seen/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'New idea' }));
    expect(within(screen.getByRole('dialog', { name: 'A new idea' })).getByText(/needs the connection/)).toBeTruthy();
  });

  it('is one’s own: what the server keeps for another is not here', async () => {
    const srv = server();
    srv.libraryFrom({ name: 'Mine', body: { text: 'x', topic: 'other' } });
    srv.libraryFrom({ name: 'Ben’s secret', body: { text: 'x', topic: 'other' }, owner: 'user-ben' });
    at('/library/ideas');
    expect(await screen.findByText('Mine')).toBeTruthy();
    expect(screen.queryByText('Ben’s secret')).toBeNull();
  });
});

describe('the Library: factions', () => {
  it('writes a faction with its two names, what players may read and its lore; changes it; takes it out', async () => {
    const srv = server();
    const user = userEvent.setup();
    at('/library/factions');
    expect(await screen.findByText(/No factions yet/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'New faction' }));
    let sheet = screen.getByRole('dialog', { name: 'A new faction' });
    await user.type(within(sheet).getByLabelText('Name (English)'), 'The Bell-ringers');
    await user.type(within(sheet).getByLabelText('Name (German)'), 'Die Glockenläuter');
    await user.type(within(sheet).getByLabelText('What the players may read'), 'Known in the drowned quarter');
    await user.type(within(sheet).getByLabelText('The lore'), 'Monks who ring the bells and know what the water hides.');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    const list = await screen.findByRole('list', { name: 'Factions' });
    expect(within(list).getByText('The Bell-ringers')).toBeTruthy();
    expect(within(list).getByText('Die Glockenläuter')).toBeTruthy();
    expect(within(list).getByText('Known in the drowned quarter')).toBeTruthy();
    expect([...srv.state.library.values()].filter((i) => !i.deletedAt)).toMatchObject([{ kind: 'faction', name: 'The Bell-ringers', body: { de: 'Die Glockenläuter', status: 'Known in the drowned quarter', lore: expect.stringContaining('bells') } }]);

    await user.click(within(list).getByRole('button', { name: 'Edit The Bell-ringers' }));
    sheet = screen.getByRole('dialog', { name: 'Edit faction' });
    const status = within(sheet).getByLabelText('What the players may read');
    await user.clear(status);
    await user.type(status, 'Feared in the drowned quarter');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await within(await screen.findByRole('list', { name: 'Factions' })).findByText('Feared in the drowned quarter')).toBeTruthy();

    await user.click(within(screen.getByRole('list', { name: 'Factions' })).getByRole('button', { name: 'Edit The Bell-ringers' }));
    sheet = screen.getByRole('dialog', { name: 'Edit faction' });
    await user.click(within(sheet).getByRole('button', { name: 'Remove this faction' }));
    await user.click(within(sheet).getByRole('button', { name: 'Yes, remove it' }));
    await waitFor(() => expect([...srv.state.library.values()].filter((i) => !i.deletedAt)).toHaveLength(0));
    expect(await screen.findByText(/No factions yet/)).toBeTruthy();
  });

  it('ideas and factions are kept apart, each on its own tab', async () => {
    const srv = server();
    srv.libraryFrom({ name: 'An idea', body: { text: 'x', topic: 'other' } });
    srv.libraryFrom({ name: 'A faction', kind: 'faction', body: { de: '', status: '', lore: '' } });
    at('/library/ideas');
    expect(await screen.findByText('An idea')).toBeTruthy();
    expect(screen.queryByText('A faction')).toBeNull();
    cleanup();
    at('/library/factions');
    expect(await screen.findByText('A faction')).toBeTruthy();
    expect(screen.queryByText('An idea')).toBeNull();
  });
});

describe('the Library: lore', () => {
  it('lists the setting’s regions, factions and groups with their source, and narrows them by kind', async () => {
    server();
    const user = userEvent.setup();
    at('/library/lore');
    const list = await screen.findByRole('list', { name: 'Lore' });
    expect(within(list).getByText('Ostermark')).toBeTruthy();
    expect(within(list).getByText('The Witch Hunters')).toBeTruthy();
    const source = within(list).getAllByRole('link', { name: /The League of Ostermark/ })[0]!;
    expect(source.getAttribute('href')).toBe('https://mordheimer.net/docs/introduction/additional-lore/league-of-ostermark');
    await user.click(screen.getByRole('button', { name: 'Groups' }));
    expect(within(screen.getByRole('list', { name: 'Lore' })).queryByText('Ostermark')).toBeNull();
    expect(within(screen.getByRole('list', { name: 'Lore' })).getByText('The Witch Hunters')).toBeTruthy();
  });

  it('adds a faction or group to the Library as a faction, and a region as an idea about a campaign; each only once', async () => {
    const srv = server();
    const user = userEvent.setup();
    at('/library/lore');
    const list = await screen.findByRole('list', { name: 'Lore' });
    await user.click(within(list).getByRole('button', { name: 'Add The Witch Hunters to the Library' }));
    await waitFor(() => expect(within(list).getByRole('button', { name: 'The Witch Hunters is in the Library' }).hasAttribute('disabled')).toBe(true));
    await user.click(within(list).getByRole('button', { name: 'Add Ostermark to the Library' }));
    await waitFor(() => expect(within(list).getByRole('button', { name: 'Ostermark is in the Library' })).toBeTruthy());
    const kept = [...srv.state.library.values()];
    expect(kept.find((i) => i.name === 'The Witch Hunters')).toMatchObject({ kind: 'faction', body: { de: 'Die Hexenjäger' } });
    expect((kept.find((i) => i.name === 'The Witch Hunters')!.body as { lore: string }).lore).toMatch(/Source: .*https:\/\/mordheimer\.net\//);
    expect(kept.find((i) => i.name === 'Ostermark')).toMatchObject({ kind: 'idea', body: { topic: 'campaign' } });
  });
});
