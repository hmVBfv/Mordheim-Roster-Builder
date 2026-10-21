/* The world of a campaign (phase 4b3b): factions, the people around them and
   the reputation log – open to every member, written by leaders with the
   authenticator. Against the stand-in server (sync/fakeSync.ts). */
import { ctxOf, writeSave } from '@mordheim/core';
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
import { data, sampleSave } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';
import { signed, standings, type World } from './api.ts';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const saveOf = (name: string) => writeSave(ctxOf(data, { ...sampleSave(), name }));

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
beforeAll(async () => { await import('./World.tsx'); }, SCREENS_MS);
beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });
afterEach(async () => { cleanup(); stopSync(); resetSession(); localStorage.clear(); await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });

function server(o: { totp?: boolean } = {}) {
  const me = { ...KAI, totp: !!o.totp };
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

const others = () => [{ player: 'Anna', data: saveOf('The Grey Penitents') }, { player: 'Ben', data: saveOf('Clan Skrittle') }];
const WARBAND = 'The Grey Penitents';

describe('standings', () => {
  const ev = (id: string, warbandId: string, warband: string, factionId: string, delta: number) => ({ id, warbandId, warband, factionId, delta, reason: '', battleId: null, actor: 'Anna', createdAt: '', seq: 1 });
  const world: World = { factions: [], npcs: [], seq: 1, reputation: [ev('1', 'w1', 'Penitents', 'f1', 2), ev('2', 'w1', 'Penitents', 'f1', -1), ev('3', 'w2', 'Skrittle', 'f1', 3), ev('4', 'w1', 'Penitents', 'f2', 5)] };

  it('the standing is the sum of the events, the best first, only of the faction asked', () => {
    expect(standings(world, 'f1')).toEqual([{ warbandId: 'w2', warband: 'Skrittle', value: 3, events: 1 }, { warbandId: 'w1', warband: 'Penitents', value: 1, events: 2 }]);
    expect(standings(world, 'f2')).toEqual([{ warbandId: 'w1', warband: 'Penitents', value: 5, events: 1 }]);
    expect(standings(world, 'f3')).toEqual([]);
  });

  it('writes a step with its sign: + for a gain, a real minus for a loss', () => {
    expect([signed(2), signed(-1), signed(0)]).toEqual(['+2', '−1', '0']);
  });
});

describe('the world and the Library (ADR 0023)', () => {
  it('a leader adds a faction from the Library as a copy: the names and what players may read go along, the lore stays', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    srv.libraryFrom({ name: 'The Bell-ringers', kind: 'faction', body: { de: 'Die Glockenläuter', status: 'Known in the drowned quarter', lore: 'SECRET LORE: they ring for the drowned.' } });
    srv.libraryFrom({ name: 'An idea', body: { text: 'x', topic: 'other' } });
    srv.libraryFrom({ name: 'Ben’s faction', kind: 'faction', body: { de: '', status: '', lore: '' }, owner: 'user-ben' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    await user.click(await screen.findByRole('button', { name: 'From the Library…' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add from your Library' });
    // only one's own factions: no idea, nobody else's
    const list = await within(sheet).findByRole('list', { name: 'Your factions' });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringContaining('The Bell-ringers')]);
    await user.click(within(list).getByRole('button', { name: 'Add The Bell-ringers' }));
    const made = () => [...srv.state.factions.values()].filter((f) => f.campaignId === c.id && !f.deleted);
    await waitFor(() => expect(made()).toHaveLength(1));
    expect(made()).toMatchObject([{ nameEn: 'The Bell-ringers', nameDe: 'Die Glockenläuter', publicStatus: 'Known in the drowned quarter' }]);
    expect(JSON.stringify(made())).not.toContain('SECRET LORE');
    expect(await screen.findByRole('article', { name: 'The Bell-ringers' })).toBeTruthy();
    // the faction is there: the Library does not offer it again
    await user.click(screen.getByRole('button', { name: 'From the Library…' }));
    const again = within(await screen.findByRole('dialog', { name: 'Add from your Library' }));
    expect((await again.findByRole('button', { name: 'Add The Bell-ringers' }) as HTMLButtonElement).disabled).toBe(true);
    expect(again.getByText('Already in this world')).toBeTruthy();
  });

  it('a leader keeps a faction of the world in the Library, as a copy', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    await user.click(await screen.findByRole('button', { name: 'Add a faction' }));
    const f = screen.getByRole('dialog', { name: 'Add a faction' });
    await user.type(within(f).getByLabelText('Name (English)'), 'The Ferrymen');
    await user.type(within(f).getByLabelText('Status everyone may read'), 'Ply the Stir');
    await user.click(within(f).getByRole('button', { name: 'Save' }));
    const card = await screen.findByRole('article', { name: 'The Ferrymen' });
    await user.click(within(card).getByRole('button', { name: 'Save The Ferrymen to your Library' }));
    expect(await screen.findByText('Saved to your Library.')).toBeTruthy();
    expect([...srv.state.library.values()].filter((i) => !i.deletedAt)).toMatchObject([{ kind: 'faction', name: 'The Ferrymen', body: { de: '', status: 'Ply the Stir', lore: '' } }]);
  });

  it('players do not get the buttons', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: others() });
    srv.factionFrom(c.id, { nameEn: 'The Ferrymen' });
    at(`/campaign/${c.id}/world`);
    expect(await screen.findByRole('article', { name: 'The Ferrymen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'From the Library…' })).toBeNull();
    expect(screen.queryByRole('button', { name: /to your Library/ })).toBeNull();
  });
});

describe('a leader writes the world', () => {
  it('adds a faction, a person under it, and records reputation; the standing and the log follow', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    expect(await screen.findByText('Nothing here yet.')).toBeTruthy();
    expect(screen.getByText(/Everyone in the campaign reads this, viewers too/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Record reputation' }) as HTMLButtonElement).disabled).toBe(true); // nothing to rate yet

    await user.click(screen.getByRole('button', { name: 'Add a faction' }));
    const f = screen.getByRole('dialog', { name: 'Add a faction' });
    expect(within(f).getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true); // a name first
    await user.click(within(f).getByLabelText('Name (English)'));
    await user.paste('The Ferrymen');
    await user.click(within(f).getByLabelText('Name (German)'));
    await user.paste('Die Fährleute');
    await user.click(within(f).getByLabelText('Status everyone may read'));
    await user.paste('hold the Stir crossing');
    await user.click(within(f).getByRole('button', { name: 'Save' }));
    const card = await screen.findByRole('article', { name: 'The Ferrymen' });
    expect(within(card).getByText('hold the Stir crossing')).toBeTruthy();
    expect(within(card).getByText(/Die Fährleute/)).toBeTruthy();
    expect([...srv.state.factions.values()]).toMatchObject([{ nameEn: 'The Ferrymen', nameDe: 'Die Fährleute', publicStatus: 'hold the Stir crossing' }]);

    await user.click(screen.getByRole('button', { name: 'Add an NPC' }));
    const n = screen.getByRole('dialog', { name: 'Add an NPC' });
    await user.selectOptions(within(n).getByLabelText('Faction'), 'The Ferrymen');
    await user.click(within(n).getByLabelText('Name (English)'));
    await user.paste('Old Marek');
    await user.click(within(n).getByLabelText('Status everyone may read'));
    await user.paste('alive');
    await user.click(await within(n).findByRole('button', { name: 'Text for Tabletop Simulator' }, { timeout: 15_000 })); // the fallback: the text the Tabletop Simulator copy reads
    await user.click(within(n).getByLabelText('Statline and rules as text'));
    await user.paste('M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7');
    await user.click(within(n).getByRole('button', { name: 'Save' }));
    const people = await within(await screen.findByRole('article', { name: 'The Ferrymen' })).findByRole('list', { name: 'People of The Ferrymen' });
    expect(within(people).getByText('Old Marek')).toBeTruthy();
    expect(within(people).getByText('alive')).toBeTruthy();
    expect(within(people).getByText('M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7')).toBeTruthy();
    expect([...srv.state.npcs.values()]).toMatchObject([{ nameEn: 'Old Marek', publicStatus: 'alive', statlineTts: 'M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7', profile: null, named: false, factionId: [...srv.state.factions.keys()][0] }]);

    await user.click(screen.getByRole('button', { name: 'Record reputation' }));
    const r = screen.getByRole('dialog', { name: 'Record reputation' });
    expect(within(r).getByRole('button', { name: 'Record' }).hasAttribute('disabled')).toBe(true);
    await user.selectOptions(within(r).getByLabelText('Warband'), `${WARBAND} · Anna`);
    expect((within(r).getByLabelText('Faction') as HTMLSelectElement).value).not.toBe(''); // the only faction is chosen
    await user.click(within(r).getByLabelText('Loses reputation'));
    await user.clear(within(r).getByLabelText('By how much (1–100)'));
    await user.type(within(r).getByLabelText('By how much (1–100)'), '2');
    await user.click(within(r).getByLabelText('Why'));
    await user.paste('Left the ferryman to the rats.');
    await user.selectOptions(within(r).getByLabelText('In battle (optional)'), 'Battle 1 · Hel Fenn ferry');
    await user.click(within(r).getByRole('button', { name: 'Record' }));

    const standing = await screen.findByRole('list', { name: 'Standing with The Ferrymen' });
    expect(within(standing).getByText(WARBAND)).toBeTruthy();
    expect(within(standing).getByText('−2')).toBeTruthy();
    const log = screen.getByRole('list', { name: 'Reputation log' });
    expect(within(log).getByText('Left the ferryman to the rats.')).toBeTruthy();
    expect(within(log).getByText(/Battle 1 · Hel Fenn ferry · recorded by Kai/)).toBeTruthy();
    expect([...srv.state.reputation.values()]).toMatchObject([{ delta: -2, reason: 'Left the ferryman to the rats.', battleId: b.id }]);
  });

  it('changes a person: the status moves on and the person goes under another faction', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const ferry = srv.factionFrom(c.id, { nameEn: 'The Ferrymen' });
    srv.factionFrom(c.id, { nameEn: 'The Watch' });
    const marek = srv.npcFrom(c.id, { nameEn: 'Old Marek', factionId: ferry.id, publicStatus: 'alive' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    await user.click(await screen.findByRole('button', { name: 'Change Old Marek' }));
    const n = screen.getByRole('dialog', { name: 'Change the NPC' });
    expect((within(n).getByLabelText('Name (English)') as HTMLInputElement).value).toBe('Old Marek');
    await user.selectOptions(within(n).getByLabelText('Faction'), 'The Watch');
    await user.clear(within(n).getByLabelText('Status everyone may read'));
    await user.click(within(n).getByLabelText('Status everyone may read'));
    await user.paste('dead');
    await user.click(within(n).getByRole('button', { name: 'Save' }));
    const watch = await screen.findByRole('article', { name: 'The Watch' });
    expect(await within(watch).findByText('Old Marek')).toBeTruthy();
    expect(within(watch).getByText('dead')).toBeTruthy();
    expect(srv.state.npcs.get(marek.id)).toMatchObject({ publicStatus: 'dead' });
    expect(srv.state.npcs.get(marek.id)!.factionId).not.toBe(ferry.id);
  });

  it('removes a faction after asking: its people stay without one, its reputation leaves the view', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const f = srv.factionFrom(c.id, { nameEn: 'The Ferrymen' });
    srv.npcFrom(c.id, { nameEn: 'Old Marek', factionId: f.id, publicStatus: 'alive' });
    srv.reputationFrom(c.id, { warbandId: c.enrolments[0]!.warbandId, factionId: f.id, delta: 2, reason: 'Escorted the barge.' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    const card = await screen.findByRole('article', { name: 'The Ferrymen' });
    await user.click(within(card).getByRole('button', { name: 'Remove The Ferrymen' }));
    const sheet = screen.getByRole('dialog', { name: 'Remove The Ferrymen?' });
    expect(within(sheet).getByText(/Its people stay, without a faction/)).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    expect(srv.state.factions.get(f.id)!.deleted).toBeUndefined(); // asking is not removing

    await user.click(within(card).getByRole('button', { name: 'Remove The Ferrymen' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Remove The Ferrymen?' })).getByRole('button', { name: 'Remove' }));
    expect(await screen.findByRole('heading', { name: 'People without a faction' })).toBeTruthy();
    expect(screen.queryByRole('article', { name: 'The Ferrymen' })).toBeNull();
    expect(screen.queryByRole('list', { name: 'Reputation log' })).toBeNull();
    expect(srv.state.factions.get(f.id)!.deleted).toBe(true);
    expect(within(screen.getByRole('list', { name: 'People without a faction' })).getByText('Old Marek')).toBeTruthy();
  });

  it('takes a reputation entry out; the standing is worked out without it', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const f = srv.factionFrom(c.id, { nameEn: 'The Ferrymen' });
    const wid = c.enrolments[0]!.warbandId;
    srv.reputationFrom(c.id, { warbandId: wid, factionId: f.id, delta: 2, reason: 'Escorted the barge.' });
    srv.reputationFrom(c.id, { warbandId: wid, factionId: f.id, delta: 1, reason: 'Paid the toll.' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    const standing = await screen.findByRole('list', { name: 'Standing with The Ferrymen' });
    expect(within(standing).getByText('+3')).toBeTruthy();
    const log = screen.getByRole('list', { name: 'Reputation log' });
    await user.click(within(within(log).getAllByRole('listitem').find((li) => within(li).queryByText('Paid the toll.'))!).getByRole('button', { name: /^Take out/ }));
    await user.click(within(screen.getByRole('dialog', { name: 'Take this entry out?' })).getByRole('button', { name: 'Remove' }));
    expect(await within(await screen.findByRole('list', { name: 'Standing with The Ferrymen' })).findByText('+2')).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'Reputation log' })).queryByText('Paid the toll.')).toBeNull();
  });

  it('a refused write keeps the sheet open with the words and says why', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const f = srv.factionFrom(c.id, { nameEn: 'The Ferrymen' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    await screen.findByRole('article', { name: 'The Ferrymen' }); // the world is in: only then is there anything to rate, and the button works
    await user.click(screen.getByRole('button', { name: 'Record reputation' }));
    const r = screen.getByRole('dialog', { name: 'Record reputation' });
    await user.selectOptions(within(r).getByLabelText('Warband'), `${WARBAND} · Anna`);
    await user.click(within(r).getByLabelText('Why'));
    await user.paste('Escorted the barge.');
    srv.state.factions.get(f.id)!.deleted = true; // another leader removed it meanwhile
    await user.click(within(r).getByRole('button', { name: 'Record' }));
    expect(await within(r).findByRole('alert')).toBeTruthy();
    expect((within(r).getByLabelText('Why') as HTMLTextAreaElement).value).toBe('Escorted the barge.');
    expect(srv.state.reputation.size).toBe(0);
  });
});

describe('the values of an NPC', () => {
  const STATS = { M: '4', WS: '3', BS: '3', S: '3', T: '3', W: '1', I: '3', A: '1', Ld: '7' } as const;
  const scene = () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    return { srv, c };
  };
  const openForm = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'Add an NPC' }));
    return within(await screen.findByRole('dialog', { name: 'Add an NPC' }));
  };

  it('opens on the values: a grid to fill in, the text written from it, a Named flag; the text stays a fallback', async () => {
    const { srv, c } = scene();
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    const n = await openForm(user);
    expect((await n.findByRole('button', { name: 'Values' }, { timeout: 15_000 })).getAttribute('aria-pressed')).toBe('true');
    expect(n.getByRole('button', { name: 'Text for Tabletop Simulator' }).getAttribute('aria-pressed')).toBe('false');
    expect(n.queryByLabelText('Statline and rules as text')).toBeNull();
    await user.click(n.getByLabelText('Name (English)'));
    await user.paste('Old Marek');
    await user.click(n.getByLabelText('Named', { exact: false }));
    for (const [k, v] of Object.entries(STATS)) await user.type(await n.findByLabelText(`${k} of Old Marek`, {}, { timeout: 15_000 }), v);
    await user.type(n.getByLabelText('Save of Old Marek'), '6+');
    await user.type(n.getByLabelText('Equipment'), 'Boat hook');
    await user.type(n.getByLabelText('Special rules (one per line)'), 'Knows the river');
    await user.click(n.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(srv.state.npcs.size).toBe(1));
    expect([...srv.state.npcs.values()][0]).toMatchObject({
      nameEn: 'Old Marek', named: true,
      profile: { type: 'Hero', profile: STATS, sv: '6+', equipment: 'Boat hook', rules: 'Knows the river', skills: [] },
      statlineTts: 'M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7 Sv 6+\nEquipment: Boat hook\n• Knows the river',
    });
    const person = (await screen.findByText('Old Marek')).closest('li')!;
    expect(within(person).getByText('Named')).toBeTruthy();
    const table = within(person).getByRole('table', { name: 'Characteristics of Old Marek' });
    expect(within(table).getAllByRole('columnheader').map((x) => x.textContent)).toEqual(['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld', 'Sv']);
    expect(within(table).getAllByRole('cell').map((x) => x.textContent)).toEqual(['4', '3', '3', '3', '3', '1', '3', '1', '7', '6+']);
  });

  it('copies the values of a monster of the game and, later, of another NPC', async () => {
    const { srv, c } = scene();
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    let n = await openForm(user);
    await user.click(await n.findByRole('button', { name: 'Copy from a model…' }, { timeout: 15_000 }));
    let picker = within(await n.findByRole('group', { name: 'Copy a model' }, { timeout: 15_000 }));
    await user.type(picker.getByLabelText('Search every model'), 'ogre bodyguard');
    await user.click(await picker.findByRole('button', { name: /^Copy Ogre Bodyguard \(/ }));
    expect(n.queryByRole('group', { name: 'Copy a model' })).toBeNull(); // one model was wanted
    expect((n.getByLabelText('Name (English)') as HTMLInputElement).value).toBe('Ogre Bodyguard'); // the name was empty
    expect((n.getByLabelText('S of Ogre Bodyguard') as HTMLInputElement).value).toBe('4');
    expect(n.getByText(/Copied from Ogre Bodyguard \(/)).toBeTruthy();
    await user.clear(n.getByLabelText('Name (English)'));
    await user.type(n.getByLabelText('Name (English)'), 'Big Grul');
    await user.click(n.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(srv.state.npcs.size).toBe(1));
    expect([...srv.state.npcs.values()][0]).toMatchObject({ nameEn: 'Big Grul', named: false, profile: { type: 'Hired Sword', sv: '6+', from: { kind: 'hired', key: 'hired/ogre' } } });

    // the NPC just made can be copied like any model
    n = await openForm(user);
    await user.click(n.getByRole('button', { name: 'Copy from a model…' }));
    picker = within(await n.findByRole('group', { name: 'Copy a model' }, { timeout: 15_000 }));
    await user.type(picker.getByLabelText('Search every model'), 'big grul');
    await user.click(await picker.findByRole('button', { name: /^Copy Big Grul \(NPC · no faction\)/ }));
    expect((n.getByLabelText('S of Big Grul') as HTMLInputElement).value).toBe('4');
    expect(n.getByText(/Copied from Big Grul \(NPC · no faction\)/)).toBeTruthy();
  });

  it('arms a person from the equipment the game lists, and the card says what the items do', async () => {
    const { srv, c } = scene();
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    const n = await openForm(user);
    await user.type(await n.findByLabelText('Name (English)'), 'Big Grul');
    await user.click(await n.findByRole('button', { name: 'Add equipment' }, { timeout: 15_000 }));
    const adder = within(await n.findByRole('group', { name: 'Add equipment' }, { timeout: 15_000 }));
    await user.type(adder.getByLabelText('Find equipment'), 'sword breaker');
    await user.click(adder.getByRole('button', { name: 'Add the equipment Sword breaker' }));
    await user.click(n.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(srv.state.npcs.size).toBe(1));
    const saved = [...srv.state.npcs.values()][0]!.profile as { equipment: string; equipmentTips: { name: string; text: string }[] };
    expect(saved.equipment).toBe('Sword breaker');
    expect(saved.equipmentTips).toEqual([{ name: 'Sword breaker', text: expect.stringMatching(/^Close combat — Parry/) }]);
    const person = (await screen.findByText('Big Grul')).closest('li')!;
    expect(within(person).getByText('Skills, equipment and rules').closest('details')!.textContent).toMatch(/Equipment tooltips:.*Sword breaker: Close combat — Parry/);
    expect(person.textContent).toContain('[5ACFFF]Equipment tooltips:[-]'); // and the Tabletop Simulator card carries them
  });

  it('an NPC written as text opens as text; “Values” reads what it can, and says so when there is nothing to read', async () => {
    const { srv, c } = scene();
    const old = srv.npcFrom(c.id, { nameEn: 'Old Marek', statlineTts: 'M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7 Sv 6+\nEquipment: Boat hook\n• Knows the river' });
    const dumb = srv.npcFrom(c.id, { nameEn: 'The Ferryman', statlineTts: 'Just an old man with a pole.' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    await user.click(await screen.findByRole('button', { name: 'Change Old Marek' }));
    let n = within(await screen.findByRole('dialog', { name: 'Change the NPC' }));
    expect((await n.findByRole('button', { name: 'Text for Tabletop Simulator' }, { timeout: 15_000 })).getAttribute('aria-pressed')).toBe('true');
    await user.click(n.getByRole('button', { name: 'Values' }));
    expect((await n.findByLabelText('WS of Old Marek', {}, { timeout: 15_000 }) as HTMLInputElement).value).toBe('3');
    expect((n.getByLabelText('Save of Old Marek') as HTMLInputElement).value).toBe('6+');
    expect((n.getByLabelText('Equipment') as HTMLTextAreaElement).value).toBe('Boat hook');
    expect((n.getByLabelText('Special rules (one per line)') as HTMLTextAreaElement).value).toBe('Knows the river');
    await user.click(n.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(srv.state.npcs.get(old.id)!.profile).toMatchObject({ profile: STATS, sv: '6+' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Change the NPC' })).toBeNull());

    await user.click(await screen.findByRole('button', { name: 'Change The Ferryman' }));
    n = within(await screen.findByRole('dialog', { name: 'Change the NPC' }));
    await user.click(await n.findByRole('button', { name: 'Values' }));
    expect(await n.findByText(/No statline found in the text/)).toBeTruthy();
    expect(n.getByRole('button', { name: 'Text for Tabletop Simulator' }).getAttribute('aria-pressed')).toBe('true'); // nothing was lost
    expect((n.getByLabelText('Statline and rules as text') as HTMLTextAreaElement).value).toBe('Just an old man with a pole.');
    expect(srv.state.npcs.get(dumb.id)!.profile).toBeNull();
  });
});

describe('everybody else reads', () => {
  const stocked = (srv: ReturnType<typeof server>, c: { id: string; enrolments: { warbandId: string }[] }) => {
    const f = srv.factionFrom(c.id, { nameEn: 'The Ferrymen', nameDe: 'Die Fährleute', publicStatus: 'hold the Stir crossing' });
    srv.npcFrom(c.id, { nameEn: 'Old Marek', factionId: f.id, publicStatus: 'alive', statlineTts: 'M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7' });
    srv.reputationFrom(c.id, { warbandId: c.enrolments[0]!.warbandId, factionId: f.id, delta: 2, reason: 'Escorted the barge.' });
  };

  for (const role of ['player', 'viewer'] as const) {
    it(`a ${role} reads the values of a named NPC and can copy its Tabletop Simulator card`, async () => {
      const srv = server();
      const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role, others: [{ ...others()[0]!, role: 'leader' as const }] });
      srv.npcFrom(c.id, {
        nameEn: 'Black Hand', named: true, statlineTts: 'M4 WS4 BS3 S4 T3 W2 I4 A2 Ld8',
        profile: { type: 'Hero', profile: { M: '4', WS: '4', BS: '3', S: '4', T: '3', W: '2', I: '4', A: '2', Ld: '8' }, sv: '5+', skills: [{ name: 'Step Aside', text: '' }], equipment: 'Sword', rules: 'Fear', from: null },
      });
      at(`/campaign/${c.id}/world`);
      const person = (await screen.findByText('Black Hand')).closest('li')!;
      expect(within(person).getByText('Named')).toBeTruthy();
      expect(within(within(person).getByRole('table', { name: 'Characteristics of Black Hand' })).getAllByRole('cell').map((x) => x.textContent)).toEqual(['4', '4', '3', '4', '3', '2', '4', '2', '8', '5+']);
      expect(within(person).getByText('Step Aside', { selector: 'p' })).toBeTruthy();
      expect((within(person).getByLabelText('Name') as HTMLTextAreaElement).value).toBe('[B8860B]Black Hand[-]');
      expect((within(person).getByLabelText('Description') as HTMLTextAreaElement).value).toContain('M 4   WS 4   BS 3   S 4   T 3   W 2   I 4   A 2   Ld 8   Sv 5+');
    });

    it(`a ${role} reads all of it and cannot change anything`, async () => {
      const srv = server();
      const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role, others: [{ ...others()[0]!, role: 'leader' as const }] });
      stocked(srv, c);
      at(`/campaign/${c.id}/world`);
      const card = await screen.findByRole('article', { name: 'The Ferrymen' });
      expect(within(card).getByText('hold the Stir crossing')).toBeTruthy();
      expect(within(card).getByText('Old Marek')).toBeTruthy();
      expect(within(card).getByText('Statline')).toBeTruthy();
      expect(within(screen.getByRole('list', { name: 'Standing with The Ferrymen' })).getByText('+2')).toBeTruthy();
      expect(within(screen.getByRole('list', { name: 'Reputation log' })).getByText('Escorted the barge.')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Add a faction|Add an NPC|Record reputation|Change|Remove|Take out/ })).toBeNull();
      expect(screen.queryByText(/viewers too/)).toBeNull(); // the leaders' hint is for leaders
    });
  }

  it('a leader without the authenticator reads, like a player: the server would refuse the rest', async () => {
    const srv = server({ totp: false });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    stocked(srv, c);
    at(`/campaign/${c.id}/world`);
    expect(await screen.findByRole('article', { name: 'The Ferrymen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a faction' })).toBeNull();
  });

  it('the World tab is there for everyone, a viewer included', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'viewer', others: others() });
    at(`/campaign/${c.id}`);
    const nav = await screen.findByRole('navigation', { name: 'Campaign' });
    expect(within(nav).getByRole('link', { name: 'World' }).getAttribute('href')).toBe(`/campaign/${c.id}/world`);
  });

  it('an empty world tells the players that nothing is public yet', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: others() });
    at(`/campaign/${c.id}/world`);
    expect(await screen.findByText(/have not made anything of the world public yet/)).toBeTruthy();
    await waitFor(() => expect(srv.state.factions.size).toBe(0));
  });
});
