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
    expect(within(screen.getByRole('navigation', { name: 'Library' })).getAllByRole('link').map((a) => a.textContent)).toEqual(['Ideas', 'Factions', 'NPCs', 'Groups', 'Scenarios', 'Locations', 'Lore']);
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

  /* #39: places nest and groups come from places. */
  it('shows where a place lies and where a group comes from, and narrows the list to a place and what lies in it', async () => {
    server();
    const user = userEvent.setup();
    at('/library/lore');
    const list = await screen.findByRole('list', { name: 'Lore' });
    // the Pit lies in Mordheim, in Ostermark
    const pit = within(list).getByText('The Pit').closest('li')!;
    expect(within(pit).getByText(/^In .*Ostermark › Mordheim$/)).toBeTruthy();
    // the Sisters come from the convent in Mordheim
    const sisters = within(list).getByText('The Sisters of Sigmar').closest('li')!;
    expect(within(sisters).getByText(/^From .*Mordheim/)).toBeTruthy();
    // a place: itself, what lies in it, and the groups from it
    await user.selectOptions(screen.getByRole('combobox', { name: 'Place' }), 'mordheim');
    const names = within(screen.getByRole('list', { name: 'Lore' })).getAllByRole('listitem').map((li) => li.querySelector('strong')!.textContent);
    expect(names).toEqual(expect.arrayContaining(['Mordheim', 'The Pit', 'The Sisters of Sigmar', 'The Shadowlord and the Cult of the Possessed']));
    expect(names).not.toContain('Ostermark');
    expect(names).not.toContain('The Freetraders');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Place' }), '');
    expect(within(screen.getByRole('list', { name: 'Lore' })).getByText('Ostermark')).toBeTruthy();
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

  it('takes the place chain along into the idea or faction text (Rob, 22.10.2026)', async () => {
    const srv = server();
    const user = userEvent.setup();
    at('/library/lore');
    const list = await screen.findByRole('list', { name: 'Lore' });
    await user.click(within(list).getByRole('button', { name: 'Add The Pit to the Library' }));
    await waitFor(() => expect(within(list).getByRole('button', { name: 'The Pit is in the Library' })).toBeTruthy());
    await user.click(within(list).getByRole('button', { name: 'Add The Sisters of Sigmar to the Library' }));
    await waitFor(() => expect(within(list).getByRole('button', { name: 'The Sisters of Sigmar is in the Library' })).toBeTruthy());
    const kept = [...srv.state.library.values()];
    expect((kept.find((i) => i.name === 'The Pit')!.body as { text: string }).text).toMatch(/Place: .*Ostermark › Mordheim\n/);
    expect((kept.find((i) => i.name === 'The Sisters of Sigmar')!.body as { lore: string }).lore).toMatch(/Comes from: Old World › The Empire › Ostermark › Mordheim · .*Temple of Sigmar's Rock\n/);
  });
});

describe('the Library: NPCs', () => {
  it('writes an NPC outside any campaign, reads it in the list, changes it, takes it out', async () => {
    const srv = server();
    const user = userEvent.setup();
    at('/library/npcs');
    expect(await screen.findByText(/No NPCs yet/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'New NPC' }));
    let sheet = screen.getByRole('dialog', { name: 'A new NPC' });
    await user.type(within(sheet).getByLabelText('Name (English)'), 'Old Brother Anselm');
    await user.type(within(sheet).getByLabelText('Name (German)'), 'Der alte Bruder Anselm');
    await user.type(within(sheet).getByLabelText('Faction'), 'The Bell-ringers');
    await user.type(within(sheet).getByLabelText('Status everyone may read'), 'Rings the bells at dusk');
    await user.click(within(sheet).getByRole('checkbox', { name: /Named/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    const list = await screen.findByRole('list', { name: 'NPCs' });
    expect(within(list).getByText('Old Brother Anselm')).toBeTruthy();
    expect(within(list).getByText('The Bell-ringers')).toBeTruthy();
    expect(within(list).getByText('Rings the bells at dusk')).toBeTruthy();
    const kept = () => [...srv.state.library.values()].filter((i) => !i.deletedAt);
    expect(kept()).toMatchObject([{ kind: 'npc', name: 'Old Brother Anselm', body: { de: 'Der alte Bruder Anselm', faction: 'The Bell-ringers', status: 'Rings the bells at dusk', named: true } }]);

    await user.click(within(list).getByRole('button', { name: 'Edit Old Brother Anselm' }));
    sheet = screen.getByRole('dialog', { name: 'Edit NPC' });
    const status = within(sheet).getByLabelText('Status everyone may read');
    await user.clear(status);
    await user.type(status, 'Gone to the Rock');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'NPCs' })).getByText('Gone to the Rock')).toBeTruthy());
    expect(kept()).toMatchObject([{ body: { status: 'Gone to the Rock' } }]);

    await user.click(within(screen.getByRole('list', { name: 'NPCs' })).getByRole('button', { name: 'Edit Old Brother Anselm' }));
    sheet = screen.getByRole('dialog', { name: 'Edit NPC' });
    await user.click(within(sheet).getByRole('button', { name: 'Remove this NPC' }));
    await user.click(within(sheet).getByRole('button', { name: 'Yes, remove it' }));
    await waitFor(() => expect(screen.queryByRole('list', { name: 'NPCs' })).toBeNull());
    expect(kept()).toEqual([]);
  });
});

describe('the Library: groups', () => {
  it('writes a group of opponents outside any campaign, reads it, changes it, takes it out', async () => {
    const srv = server();
    const user = userEvent.setup();
    at('/library/groups');
    expect(await screen.findByText(/No groups yet/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'New group' }));
    let sheet = screen.getByRole('dialog', { name: 'A new group' });
    await user.type(within(sheet).getByLabelText('Group name'), 'The ferrymen of the Stir');
    await user.type(within(sheet).getByLabelText('Note'), 'Smugglers on the river.');
    await user.click(within(sheet).getByRole('button', { name: 'Write your own' }));
    await user.type(within(sheet).getByLabelText('Name'), 'Ferryman');
    await user.click(within(sheet).getByRole('button', { name: 'Save the group' }));
    const list = await screen.findByRole('list', { name: 'Groups' });
    expect(within(list).getByText('The ferrymen of the Stir')).toBeTruthy();
    expect(within(list).getByText('Smugglers on the river.')).toBeTruthy();
    expect(within(list).getByText('Ferryman')).toBeTruthy();
    const kept = () => [...srv.state.library.values()].filter((i) => !i.deletedAt);
    expect(kept()).toMatchObject([{ kind: 'group', name: 'The ferrymen of the Stir', body: { note: 'Smugglers on the river.', profiles: [{ name: 'Ferryman', count: 1 }] } }]);

    await user.click(within(list).getByRole('button', { name: 'Edit The ferrymen of the Stir' }));
    sheet = screen.getByRole('dialog', { name: 'Edit The ferrymen of the Stir' });
    const note = within(sheet).getByLabelText('Note');
    await user.clear(note);
    await user.type(note, 'Gone upriver.');
    await user.click(within(sheet).getByRole('button', { name: 'Save the group' }));
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Groups' })).getByText('Gone upriver.')).toBeTruthy());
    expect(kept()).toMatchObject([{ body: { note: 'Gone upriver.' } }]);

    await user.click(within(screen.getByRole('list', { name: 'Groups' })).getByRole('button', { name: 'Edit The ferrymen of the Stir' }));
    sheet = screen.getByRole('dialog', { name: 'Edit The ferrymen of the Stir' });
    await user.click(within(sheet).getByRole('button', { name: 'Remove this group' }));
    await user.click(within(sheet).getByRole('button', { name: 'Yes, remove it' }));
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Groups' })).toBeNull());
    expect(kept()).toEqual([]);
  });
});

describe('the Library: scenarios', () => {
  const brandt = { id: '11111111-1111-4111-8111-111111111111', name: 'Captain Brandt', type: 'Hero', hidden: ['name'], profile: { M: '4' }, sv: '5+', skills: [], equipment: 'Sword', equipmentTips: [], rules: '', from: null };

  it('writes a scenario outside any campaign, reads it, changes it – its NPCs travel along untouched – and takes it out', async () => {
    const srv = server();
    srv.libraryFrom({ name: 'The night at the ferry', kind: 'scenario', body: { body: 'The ferry is dark.', npcStatlines: '', npcs: [brandt] } });
    const user = userEvent.setup();
    at('/library/scenarios');
    const list = await screen.findByRole('list', { name: 'Scenarios' });
    expect(within(list).getByText('The night at the ferry')).toBeTruthy();
    expect(within(list).getByText('1 NPC')).toBeTruthy();

    await user.click(within(list).getByRole('button', { name: 'Edit The night at the ferry' }));
    let sheet = screen.getByRole('dialog', { name: 'Edit The night at the ferry' });
    const rules = within(sheet).getByLabelText('Rules');
    await user.clear(rules);
    await user.type(rules, 'The ferry is lit.');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Scenarios' })).getByText(/The ferry is lit/)).toBeTruthy());
    const kept = () => [...srv.state.library.values()].filter((i) => !i.deletedAt);
    expect(kept()).toMatchObject([{ kind: 'scenario', body: { body: 'The ferry is lit.', npcs: [{ name: 'Captain Brandt', hidden: ['name'] }] } }]);

    await user.click(screen.getByRole('button', { name: 'New scenario' }));
    sheet = screen.getByRole('dialog', { name: 'A new scenario' });
    await user.type(within(sheet).getByLabelText('Title'), 'Ambush at the bridge');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(kept()).toHaveLength(2));

    await user.click(await within(screen.getByRole('list', { name: 'Scenarios' })).findByRole('button', { name: 'Edit Ambush at the bridge' }));
    sheet = screen.getByRole('dialog', { name: 'Edit Ambush at the bridge' });
    await user.click(within(sheet).getByRole('button', { name: 'Remove this scenario' }));
    await user.click(within(sheet).getByRole('button', { name: 'Yes, remove it' }));
    await waitFor(() => expect(kept()).toHaveLength(1));
  });
});

/* Wishes #73 and #74: places of the world, and links between the entries of the Library, seen openly there. */
describe('the Library: places and links', () => {
  const npcBody = { de: '', status: '', faction: '', named: false, statlineTts: '', profile: null };

  it('a place is written with a tag and read in the list', async () => {
    const srv = server();
    const user = userEvent.setup();
    at('/library/locations');
    await user.click(await screen.findByRole('button', { name: 'New place' }));
    const sheet = screen.getByRole('dialog', { name: 'A new place' });
    await user.type(within(sheet).getByLabelText('Name (English)'), 'Ostermark');
    await user.type(within(sheet).getByLabelText('Kind of place'), 'Region');
    await user.type(within(sheet).getByLabelText('The lore'), 'Forests, war and a long border.');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    const list = await screen.findByRole('list', { name: 'Places' });
    expect(within(list).getByText('Ostermark')).toBeTruthy();
    expect(within(list).getByText('Region')).toBeTruthy();
    expect([...srv.state.library.values()]).toMatchObject([{ kind: 'location', name: 'Ostermark', body: { type: 'Region', lore: 'Forests, war and a long border.', links: [] } }]);
  });

  it('an entry is linked to another, and both show the link openly; a link is taken away again', async () => {
    const srv = server();
    const watch = srv.libraryFrom({ kind: 'faction', name: 'The Watch', body: { de: '', status: '', lore: '' } });
    srv.libraryFrom({ kind: 'npc', name: 'Captain Brandt', body: npcBody });
    srv.libraryFrom({ kind: 'idea', name: 'Not linkable', body: { text: 'x', topic: 'other' } });
    const user = userEvent.setup();
    at('/library/factions');
    await user.click(await screen.findByRole('button', { name: 'Edit The Watch' }));
    let sheet = screen.getByRole('dialog', { name: 'Edit faction' });
    const add = within(sheet).getByLabelText('Add a link');
    // only entries that can be linked, named with their kind, and not itself
    expect(within(add).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choose …', 'Captain Brandt (NPC)']);
    await user.selectOptions(add, 'Captain Brandt (NPC)');
    expect(within(sheet).getByRole('button', { name: 'Remove link to Captain Brandt' })).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect((srv.state.library.get(watch.id)!.body as { links: string[] }).links).toHaveLength(1));
    const card = within(await screen.findByRole('list', { name: 'Factions' })).getByText('The Watch').closest('li')!;
    expect(within(within(card).getByRole('list', { name: 'Linked entries' })).getByText('Captain Brandt')).toBeTruthy();
    // the other side reads the link too
    cleanup();
    at('/library/npcs');
    const npcCard = within(await screen.findByRole('list', { name: 'NPCs' })).getByText('Captain Brandt').closest('li')!;
    expect(within(within(npcCard).getByRole('list', { name: 'Linked entries' })).getByText('The Watch')).toBeTruthy();
    // taken away
    cleanup();
    at('/library/factions');
    await user.click(await screen.findByRole('button', { name: 'Edit The Watch' }));
    sheet = screen.getByRole('dialog', { name: 'Edit faction' });
    await user.click(within(sheet).getByRole('button', { name: 'Remove link to Captain Brandt' }));
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect((srv.state.library.get(watch.id)!.body as { links: string[] }).links).toEqual([]));
  });

  it('a link to an entry that is gone is not shown', async () => {
    const srv = server();
    srv.libraryFrom({ kind: 'faction', name: 'The Watch', body: { de: '', status: '', lore: '', links: ['gone-for-good'] } });
    at('/library/factions');
    const card = within(await screen.findByRole('list', { name: 'Factions' })).getByText('The Watch').closest('li')!;
    expect(within(card).queryByRole('list', { name: 'Linked entries' })).toBeNull();
  });

  /* Not seen here does not mean gone: the target may be written on another device that has not synced yet.
     A save of the entry must not drop what it cannot see. */
  it('a save keeps a link to an entry this device does not know', async () => {
    const srv = server();
    const watch = srv.libraryFrom({ kind: 'faction', name: 'The Watch', body: { de: '', status: '', lore: '', links: ['written-elsewhere'] } });
    const user = userEvent.setup();
    at('/library/factions');
    await user.click(await screen.findByRole('button', { name: 'Edit The Watch' }));
    const sheet = screen.getByRole('dialog', { name: 'Edit faction' });
    await user.type(within(sheet).getByLabelText('What the players may read'), 'Known in the quarter');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(srv.state.library.get(watch.id)!.body).toMatchObject({ status: 'Known in the quarter', links: ['written-elsewhere'] }));
  });
});
