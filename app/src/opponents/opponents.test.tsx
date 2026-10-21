/* Opponents (leaders only): a group of profiles copied from any model of the
   game or of the campaign, changed at will, with skills from the game's lists
   or of our own, and a Tabletop Simulator card for each. Against the
   stand-in server (sync/fakeSync.ts). */
import { ctxOf, writeSave } from '@mordheim/core';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSession, signedIn } from '../account/session.ts';
import { ME as KAI } from '../account/testServer.ts';
import { AppRoutes } from '../app/App.tsx';
import { db } from '../db/db.ts';
import { loadGameData } from '../game/gameData.ts';
import { createFakeSync } from '../sync/fakeSync.ts';
import { stopSync } from '../sync/runner.ts';
import { data, sampleSave } from '../test/data.ts';
import { polyfillDialog } from '../test/dialog.ts';
import { loadScreens, SCREENS_MS } from '../test/screens.ts';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const saveOf = (name: string) => writeSave(ctxOf(data, { ...sampleSave(), name }));

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
beforeAll(async () => { await import('./Opponents.tsx'); await loadGameData(); }, SCREENS_MS);
beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });
afterEach(async () => { cleanup(); stopSync(); resetSession(); localStorage.clear(); await db.warbands.clear(); await db.meta.clear(); await db.outbox.clear(); });

function scene() {
  const me = { ...KAI, totp: true };
  const srv = createFakeSync({ me: { id: KAI.id, username: KAI.username, displayName: KAI.displayName }, wbName: (wb) => data.WARBANDS[wb]?.name ?? wb });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost/');
    const path = url.pathname.replace(/^\/api\/v1/, '');
    if (path === '/auth/me') return new Response(JSON.stringify({ user: me, pending: false }), { headers: { 'content-type': 'application/json' } });
    srv.state.calls.push(`${init?.method ?? 'GET'} ${path}`);
    return srv.handle(init?.method ?? 'GET', path, url.searchParams, init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {});
  }));
  signedIn({ stage: 'full', user: me });
  const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: [{ player: 'Anna', data: saveOf('The Grey Penitents') }, { player: 'Ben', data: saveOf('Clan Skrittle') }] });
  return { srv, c };
}

async function openOpponents(user: ReturnType<typeof userEvent.setup>, cid: string) {
  at(`/campaign/${cid}/background`);
  await user.click(await screen.findByRole('button', { name: 'Opponents' }));
  return screen.findByRole('heading', { name: 'Opponents' });
}

describe('opponents', () => {
  it('a leader copies a Hired Sword, changes it, gives it a skill of the game and one of our own, and keeps the group', async () => {
    const { srv, c } = scene();
    const user = userEvent.setup();
    await openOpponents(user, c.id);
    expect(await screen.findByText('No group yet.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'New group' }));
    const form = await screen.findByRole('dialog', { name: 'New group of opponents' });
    await user.type(within(form).getByLabelText('Group name'), 'The ferrymen');
    await user.click(within(form).getByRole('button', { name: 'Copy a model from the game…' }));
    const picker = within(await within(form).findByRole('group', { name: 'Copy a model' }, { timeout: 15_000 }));
    await user.type(picker.getByLabelText('Search every model'), 'ogre bodyguard');
    await user.click(await picker.findByRole('button', { name: /^Add Ogre Bodyguard \(/ }));
    await user.click(picker.getByRole('button', { name: 'Done adding' }));

    const name = within(form).getByLabelText('Name') as HTMLInputElement;
    expect(name.value).toBe('Ogre Bodyguard');
    expect(within(form).getByText(/Copied from Ogre Bodyguard \(/)).toBeTruthy();
    expect((within(form).getByLabelText('S of Ogre Bodyguard') as HTMLInputElement).value).toBe('4');
    await user.clear(name);
    await user.type(name, 'Big Grul');
    await user.clear(within(form).getByLabelText('WS of Big Grul'));
    await user.type(within(form).getByLabelText('WS of Big Grul'), '4');

    await user.click(within(form).getByRole('button', { name: 'Add a skill' }));
    const adder = within(await within(form).findByRole('group', { name: 'Add a skill' }, { timeout: 15_000 }));
    await user.type(adder.getByLabelText('Find a skill'), 'step aside');
    await user.click(await adder.findByRole('button', { name: 'Add the skill Step Aside' }));
    await user.type(adder.getByLabelText('Skill name'), 'Ferryman’s Luck');
    await user.type(adder.getByLabelText('Tooltip (optional)'), 'Re-roll one dice per battle.');
    await user.click(adder.getByRole('checkbox', { name: 'Keep it among our own skills' }));
    await user.click(adder.getByRole('button', { name: 'Add this skill' }));
    await waitFor(() => expect([...srv.state.opponentSkills.values()].map((k) => k.name)).toEqual(['Ferryman’s Luck']));
    await waitFor(() => expect(within(within(form).getByRole('list', { name: 'Skills of Big Grul' })).getAllByRole('listitem').map((x) => x.textContent)).toEqual(['Step Aside×', 'Ferryman’s Luck×']));

    await user.click(within(form).getByRole('button', { name: 'Save the group' }));
    await waitFor(() => expect(srv.state.opponentGroups.size).toBe(1));
    const g = [...srv.state.opponentGroups.values()][0]!;
    expect(g.name).toBe('The ferrymen');
    expect(g.profiles).toEqual([expect.objectContaining({
      name: 'Big Grul', type: 'Hired Sword', profile: expect.objectContaining({ WS: '4', S: '4' }), sv: '6+',
      skills: [expect.objectContaining({ name: 'Step Aside' }), { name: 'Ferryman’s Luck', text: 'Re-roll one dice per battle.', ref: expect.any(String) }],
      from: expect.objectContaining({ kind: 'hired', key: 'hired/ogre' }),
    })]);
    const list = await screen.findByRole('list', { name: 'Opponent groups' });
    expect(await within(list).findByText('Big Grul')).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'Our own skills' })).getByText('Ferryman’s Luck')).toBeTruthy();
  });

  it('copies a warrior of the campaign as he stands, from the warbands entered there', async () => {
    const { srv, c } = scene();
    const user = userEvent.setup();
    await openOpponents(user, c.id);
    await user.click(await screen.findByRole('button', { name: 'New group' }));
    const form = await screen.findByRole('dialog', { name: 'New group of opponents' });
    await user.type(within(form).getByLabelText('Group name'), 'Turncoats');
    await user.click(within(form).getByRole('button', { name: 'Copy a model from the game…' }));
    const picker = within(await within(form).findByRole('group', { name: 'Copy a model' }, { timeout: 15_000 }));
    await user.click(picker.getByRole('button', { name: 'Our warriors' }));
    const found = await picker.findByRole('list', { name: 'Models found' });
    await waitFor(() => expect(within(found).getAllByRole('listitem').length).toBeGreaterThan(0));
    expect(within(found).getAllByRole('listitem').every((x) => /The Grey Penitents|Clan Skrittle/.test(x.textContent ?? ''))).toBe(true);
    await user.click(within(found).getAllByRole('button', { name: /^Add .*\(The Grey Penitents\)$/ })[0]!);
    await user.click(within(form).getByRole('button', { name: 'Save the group' }));
    await waitFor(() => expect([...srv.state.opponentGroups.values()][0]?.profiles).toEqual([expect.objectContaining({ from: expect.objectContaining({ kind: 'warrior' }) })]));
  });

  it('every profile is a Tabletop Simulator card', async () => {
    const { srv, c } = scene();
    srv.opponentGroupFrom(c.id, { name: 'The ferrymen', profiles: [{ id: 'p1', name: 'Old Marek', type: 'Hero', count: 1, profile: { M: '4', WS: '4', BS: '3', S: '3', T: '3', W: '2', I: '4', A: '2', Ld: '8' }, sv: '5+', skills: [{ name: 'Step Aside', text: 'A 5+ save.' }], equipment: 'Boat hook', rules: 'Knows the Stir', note: '', from: null }] });
    const user = userEvent.setup();
    await openOpponents(user, c.id);
    await user.click(await screen.findByRole('button', { name: 'Tabletop Simulator cards of The ferrymen' }));
    const sheet = await screen.findByRole('dialog', { name: 'The ferrymen · Tabletop Simulator' });
    expect((within(sheet).getByLabelText('Name') as HTMLTextAreaElement).value).toBe('[B8860B]Old Marek[-]');
    const text = (within(sheet).getByLabelText('Description') as HTMLTextAreaElement).value;
    expect(text).toContain('M 4   WS 4   BS 3   S 3   T 3   W 2   I 4   A 2   Ld 8   Sv 5+');
    expect(text).toContain('• Step Aside: A 5+ save.');
    expect(text).toContain('[5ACFFF]Equipment:[-] Boat hook');
  });

  it('another leader’s change in between is not overwritten blindly; a group can be taken out', async () => {
    const { srv, c } = scene();
    const gid = srv.opponentGroupFrom(c.id, { name: 'The ferrymen' });
    const user = userEvent.setup();
    await openOpponents(user, c.id);
    await user.click(await screen.findByRole('button', { name: 'Edit The ferrymen' }));
    const form = await screen.findByRole('dialog', { name: 'Edit The ferrymen' });
    srv.opponentGroupFrom(c.id, { id: gid, name: 'The ferrymen of the Stir' });
    await user.click(within(form).getByRole('button', { name: 'Write your own' }));
    await user.click(within(form).getByRole('button', { name: 'Save the group' }));
    expect(await within(form).findByText(/Anna changed this group meanwhile/)).toBeTruthy();
    await user.click(within(form).getByRole('button', { name: 'Take the group out' }));
    await waitFor(() => expect(srv.state.opponentGroups.get(gid)?.deleted).toBe(true));
    expect(await screen.findByText('No group yet.')).toBeTruthy();
  });
});

describe('opponents and the Library (ADR 0023)', () => {
  const profile = (over: Record<string, unknown> = {}) => ({ id: 'p-lib-1', name: 'Ferryman', type: 'Henchman', count: 3, profile: { M: '4', WS: '3' }, sv: '6+', skills: [{ name: 'Dodge', text: '' }, { name: 'Ferryman’s Luck', text: 'Re-roll one dice.', ref: 'skill-of-another-campaign' }], equipment: 'Boat hook', equipmentTips: [], rules: '', note: '', from: null, ...over });

  it('a leader sets a group of the Library against the warbands as a copy: new ids, no link to another campaign’s own skills', async () => {
    const { srv, c } = scene();
    srv.libraryFrom({ name: 'The ferrymen', kind: 'group', body: { note: 'Smugglers.', profiles: [profile()] } });
    srv.libraryFrom({ name: 'An idea', body: { text: 'x', topic: 'other' } });
    srv.libraryFrom({ name: 'Ben’s group', kind: 'group', body: { note: '', profiles: [] }, owner: 'user-ben' });
    const user = userEvent.setup();
    await openOpponents(user, c.id);
    await user.click(await screen.findByRole('button', { name: 'Groups from the Library…' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add groups from your Library' });
    const list = await within(sheet).findByRole('list', { name: 'Your groups' });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringContaining('The ferrymen')]);
    await user.click(within(list).getByRole('button', { name: 'Add The ferrymen' }));
    await waitFor(() => expect(srv.state.opponentGroups.size).toBe(1));
    const g = [...srv.state.opponentGroups.values()][0]!;
    expect(g).toMatchObject({ name: 'The ferrymen', note: 'Smugglers.' });
    const p = (g.profiles as { id: string; name: string; count: number; skills: { name: string; ref?: string }[] }[])[0]!;
    expect(p).toMatchObject({ name: 'Ferryman', count: 3, skills: [{ name: 'Dodge' }, { name: 'Ferryman’s Luck' }] });
    expect(p.id).not.toBe('p-lib-1');
    expect(p.skills.every((s) => !('ref' in s))).toBe(true);
    // it is there: the Library does not offer it again
    await user.click(screen.getByRole('button', { name: 'Groups from the Library…' }));
    const again = within(await screen.findByRole('dialog', { name: 'Add groups from your Library' }));
    expect((await again.findByRole('button', { name: 'Add The ferrymen' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('a leader keeps a group of the campaign in the Library, as a copy without links to the campaign’s own skills', async () => {
    const { srv, c } = scene();
    srv.opponentGroupFrom(c.id, { name: 'Turncoats', note: 'Deserters.', profiles: [profile({ id: 'p-camp-1', name: 'Deserter' })] });
    const user = userEvent.setup();
    await openOpponents(user, c.id);
    await user.click(await screen.findByRole('button', { name: 'Save Turncoats to your Library' }));
    expect(await screen.findByText('Saved to your Library.')).toBeTruthy();
    const kept = [...srv.state.library.values()].filter((i) => !i.deletedAt);
    expect(kept).toMatchObject([{ kind: 'group', name: 'Turncoats', body: { note: 'Deserters.', profiles: [{ name: 'Deserter', count: 3 }] } }]);
    const skills = (kept[0]!.body as { profiles: { skills: object[] }[] }).profiles[0]!.skills;
    expect(skills.every((s) => !('ref' in s))).toBe(true);
  });
});
