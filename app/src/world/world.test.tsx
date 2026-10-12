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
    await user.click(within(n).getByLabelText('Statline (optional)'));
    await user.paste('M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7');
    await user.click(within(n).getByRole('button', { name: 'Save' }));
    const people = await within(await screen.findByRole('article', { name: 'The Ferrymen' })).findByRole('list', { name: 'People of The Ferrymen' });
    expect(within(people).getByText('Old Marek')).toBeTruthy();
    expect(within(people).getByText('alive')).toBeTruthy();
    expect(within(people).getByText('M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7')).toBeTruthy();
    expect([...srv.state.npcs.values()]).toMatchObject([{ nameEn: 'Old Marek', publicStatus: 'alive', factionId: [...srv.state.factions.keys()][0] }]);

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
    await user.click(await screen.findByRole('button', { name: 'Record reputation' }));
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

describe('everybody else reads', () => {
  const stocked = (srv: ReturnType<typeof server>, c: { id: string; enrolments: { warbandId: string }[] }) => {
    const f = srv.factionFrom(c.id, { nameEn: 'The Ferrymen', nameDe: 'Die Fährleute', publicStatus: 'hold the Stir crossing' });
    srv.npcFrom(c.id, { nameEn: 'Old Marek', factionId: f.id, publicStatus: 'alive', statlineTts: 'M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7' });
    srv.reputationFrom(c.id, { warbandId: c.enrolments[0]!.warbandId, factionId: f.id, delta: 2, reason: 'Escorted the barge.' });
  };

  for (const role of ['player', 'viewer'] as const) {
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
