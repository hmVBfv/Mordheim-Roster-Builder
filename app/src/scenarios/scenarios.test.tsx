/* The scenarios of a campaign (phase 4b3c): a leaders' draft, released to a
   battle for everybody. Against the stand-in server (sync/fakeSync.ts). */
import { ctxOf, HIDABLE, writeSave, type ScenarioNpc } from '@mordheim/core';
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
import { ttsText, type Scenario } from './api.ts';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const saveOf = (name: string) => writeSave(ctxOf(data, { ...sampleSave(), name }));

beforeAll(loadScreens, SCREENS_MS);
beforeAll(polyfillDialog);
beforeAll(async () => { await import('../world/World.tsx'); await import('./Scenarios.tsx'); }, SCREENS_MS);
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
const RULES = 'The ferry is dark: no shooting beyond 8".';
const STATS = 'Captain Brandt M4 WS4 BS3 S3 T3 W1 I4 A1 Ld8';
const LONG = { timeout: 15_000 }; // the NPC form is loaded when it opens

/** An NPC of a scenario as the server keeps it (the leader's whole values); `hidden` is what the players must not read. */
const brandt = (o: Partial<ScenarioNpc> = {}): ScenarioNpc => ({
  id: '11111111-1111-4111-8111-111111111111', name: 'Captain Brandt', type: 'Hero', hidden: [],
  profile: { M: '4', WS: '4', BS: '3', S: '3', T: '3', W: '1', I: '4', A: '1', Ld: '8' }, sv: '5+',
  skills: [{ name: 'Step Aside', text: '' }], equipment: 'Sword', rules: 'Cannot be ambushed', from: null, ...o,
});

describe('ttsText', () => {
  const sc = (npcStatlines: string, npcs: ScenarioNpc[] = []): Scenario => ({ id: 'x', title: 'The night at the ferry', body: '', npcStatlines, npcs, visibility: 'public', playedInBattle: null, releasedAt: null, releasedBy: null, edited: false, createdAt: '', updatedAt: '', seq: 1 });
  it('heads the statlines with the title; no statlines, no text', () => {
    expect(ttsText(sc(`  ${STATS}\n`))).toBe(`The night at the ferry\n${STATS}\n`);
    expect(ttsText(sc('  '))).toBe('');
  });
  it('writes each NPC as the players read it: a hidden part is a “?”', () => {
    const t = ttsText(sc('', [brandt({ hidden: ['name', 'WS', 'equipment'] })]));
    expect(t.startsWith('The night at the ferry\n')).toBe(true);
    expect(t).not.toContain('Brandt');
    expect(t).not.toContain('Sword');
    expect(t).toMatch(/WS \?/);
    expect(t).toContain('BS 3'); // what was not hidden stays
    expect(ttsText(sc('', [brandt()]))).toContain('Captain Brandt');
  });
});

describe('a leader writes, releases and takes out', () => {
  it('writes a draft: only leaders read it, and the sheet says so', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    expect(await screen.findByText('No scenario yet.')).toBeTruthy();
    expect(screen.getByText(/A draft is read by the leaders alone/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Write a scenario' }));
    const f = screen.getByRole('dialog', { name: 'Write a scenario' });
    expect(within(f).getByText(/Only leaders read a draft/)).toBeTruthy();
    expect(within(f).getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true); // a title first
    await user.click(within(f).getByLabelText('Title'));
    await user.paste('The night at the ferry');
    await user.click(within(f).getByLabelText('Rules'));
    await user.paste(RULES);
    await user.click(within(f).getByLabelText('NPC statlines (optional)'));
    await user.paste(STATS);
    await user.click(within(f).getByRole('button', { name: 'Save' }));
    const card = await screen.findByRole('article', { name: 'Draft: The night at the ferry' });
    expect(within(card).getByText('⚑ Draft – only leaders read it')).toBeTruthy();
    expect(within(card).getByText(RULES)).toBeTruthy();
    expect(within(card).getByText(STATS)).toBeTruthy();
    expect([...srv.state.scenarios.values()]).toMatchObject([{ title: 'The night at the ferry', body: RULES, npcStatlines: STATS, visibility: 'leader', playedInBattle: null }]);
    expect(screen.getByText(/Draft saved. Only leaders see it./)).toBeTruthy();
  });

  it('releases a draft to a battle: it becomes public and says where it was played', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    const sc = srv.scenarioFrom(c.id, { title: 'The night at the ferry', body: RULES, npcStatlines: STATS });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    await user.click(await screen.findByRole('button', { name: 'Release The night at the ferry to a battle' }));
    const r = screen.getByRole('dialog', { name: 'Release The night at the ferry' });
    expect(within(r).getByText(/This cannot be undone/)).toBeTruthy();
    expect(within(r).getByRole('button', { name: 'Release' }).hasAttribute('disabled')).toBe(true); // a battle first
    await user.selectOptions(within(r).getByLabelText('Played in'), 'Battle 1 · Hel Fenn ferry');
    await user.click(within(r).getByRole('button', { name: 'Release' }));
    const card = await screen.findByRole('article', { name: 'The night at the ferry' });
    expect(within(card).getByText(/Played in Battle 1 · Hel Fenn ferry · released by Kai/)).toBeTruthy();
    expect(screen.queryByRole('article', { name: 'Draft: The night at the ferry' })).toBeNull();
    expect(srv.state.scenarios.get(sc.id)).toMatchObject({ visibility: 'public', playedInBattle: b.id });
    // released: it can be corrected, not taken out
    expect(within(card).getByRole('button', { name: 'Change The night at the ferry' })).toBeTruthy();
    expect(within(card).queryByRole('button', { name: /Remove|Release/ })).toBeNull();
  });

  it('with no battle yet, the release sheet says what to do first', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    srv.scenarioFrom(c.id, { title: 'The night at the ferry' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    await user.click(await screen.findByRole('button', { name: 'Release The night at the ferry to a battle' }));
    const r = screen.getByRole('dialog', { name: 'Release The night at the ferry' });
    expect(within(r).getByText(/no battle yet/)).toBeTruthy();
    expect(within(r).getByRole('button', { name: 'Release' }).hasAttribute('disabled')).toBe(true);
  });

  it('changes a draft and a released scenario; the corrected one shows that it was corrected', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    srv.scenarioFrom(c.id, { title: 'The night at the ferry', body: RULES, battleId: b.id });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    await user.click(await screen.findByRole('button', { name: 'Change The night at the ferry' }));
    const f = screen.getByRole('dialog', { name: 'Change the scenario' });
    expect(within(f).getByText(/Everyone in the campaign already reads this scenario/)).toBeTruthy();
    expect((within(f).getByLabelText('Rules') as HTMLTextAreaElement).value).toBe(RULES);
    await user.clear(within(f).getByLabelText('Rules'));
    await user.click(within(f).getByLabelText('Rules'));
    await user.paste('The ferry is dark: no shooting beyond 6".');
    await user.click(within(f).getByRole('button', { name: 'Save' }));
    const card = await screen.findByRole('article', { name: 'The night at the ferry' });
    await waitFor(() => expect(within(card).getByText(/corrected since/)).toBeTruthy());
    expect([...srv.state.scenarios.values()]).toMatchObject([{ body: 'The ferry is dark: no shooting beyond 6".', edited: true }]);
  });

  it('takes a draft out after asking; asking is not removing', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const sc = srv.scenarioFrom(c.id, { title: 'The night at the ferry' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    await user.click(await screen.findByRole('button', { name: 'Remove The night at the ferry' }));
    const sheet = screen.getByRole('dialog', { name: 'Remove The night at the ferry?' });
    await user.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    expect(srv.state.scenarios.get(sc.id)!.deleted).toBeUndefined();
    await user.click(screen.getByRole('button', { name: 'Remove The night at the ferry' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Remove The night at the ferry?' })).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Draft: The night at the ferry' })).toBeNull());
    expect(srv.state.scenarios.get(sc.id)!.deleted).toBe(true);
    expect(await screen.findByText('No scenario yet.')).toBeTruthy();
  });

  it('another leader changed the scenario meanwhile: the sheet stays with the words and says why', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const sc = srv.scenarioFrom(c.id, { title: 'The night at the ferry', body: RULES });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    await user.click(await screen.findByRole('button', { name: 'Change The night at the ferry' }));
    const f = screen.getByRole('dialog', { name: 'Change the scenario' });
    await user.clear(within(f).getByLabelText('Rules'));
    await user.click(within(f).getByLabelText('Rules'));
    await user.paste('My version.');
    Object.assign(srv.state.scenarios.get(sc.id)!, { body: 'Theirs.', seq: sc.seq + 100 }); // another leader got in first
    await user.click(within(f).getByRole('button', { name: 'Save' }));
    expect((await within(f).findByRole('alert')).textContent).toMatch(/Another leader changed this scenario/);
    expect((within(f).getByLabelText('Rules') as HTMLTextAreaElement).value).toBe('My version.');
    expect(srv.state.scenarios.get(sc.id)!.body).toBe('Theirs.');
  });

  it('copies the statlines for the table', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    srv.scenarioFrom(c.id, { title: 'The night at the ferry', npcStatlines: STATS });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    await user.click(await screen.findByRole('button', { name: 'Copy the statlines of The night at the ferry' }));
    expect(await screen.findByText('Statlines copied.')).toBeTruthy();
    expect(await navigator.clipboard.readText()).toBe(`The night at the ferry\n${STATS}\n`); // user-event's own clipboard
  });
});

describe('everybody else reads the released ones', () => {
  for (const role of ['player', 'viewer'] as const) {
    it(`a ${role} reads a released scenario and does not know about the drafts`, async () => {
      const srv = server();
      const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role, others: [{ ...others()[0]!, role: 'leader' as const }] });
      const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
      srv.scenarioFrom(c.id, { title: 'ZEBRA the ambush', body: 'ZEBRA' });
      srv.scenarioFrom(c.id, { title: 'The night at the ferry', body: RULES, npcStatlines: STATS, battleId: b.id });
      const user = userEvent.setup();
      at(`/campaign/${c.id}/world`);
      const card = await screen.findByRole('article', { name: 'The night at the ferry' });
      expect(within(card).getByText(/Played in Battle 1 · Hel Fenn ferry · released by Anna/)).toBeTruthy();
      await user.click(within(card).getByText('Rules'));
      expect(within(card).getByText(RULES)).toBeTruthy();
      expect(within(card).getByRole('button', { name: 'Copy the statlines of The night at the ferry' })).toBeTruthy();
      expect(screen.queryByText(/ZEBRA/)).toBeNull();
      expect(screen.queryByRole('button', { name: /Write a scenario|Change The night|Release|Remove The night/ })).toBeNull();
      expect(screen.queryByText(/read by the leaders alone/)).toBeNull();
    });
  }

  it('a leader without the authenticator reads like a player: no drafts, nothing to write', async () => {
    const srv = server({ totp: false });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    srv.scenarioFrom(c.id, { title: 'ZEBRA the ambush' });
    srv.scenarioFrom(c.id, { title: 'The night at the ferry', battleId: b.id });
    at(`/campaign/${c.id}/world`);
    expect(await screen.findByRole('article', { name: 'The night at the ferry' })).toBeTruthy();
    expect(screen.queryByText(/ZEBRA/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Write a scenario' })).toBeNull();
  });

  it('says that nothing has been played yet', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: others() });
    at(`/campaign/${c.id}/world`);
    expect(await screen.findByText('No scenario has been played yet.')).toBeTruthy();
    await waitFor(() => expect(srv.state.scenarios.size).toBe(0));
  });
});

describe('the NPCs of a scenario (ADR 0022)', () => {
  const open = async (user: ReturnType<typeof userEvent.setup>, title = 'The night at the ferry', verb = 'Add') => {
    await user.click(await screen.findByRole('button', { name: `${verb} the NPCs of ${title}` }));
    return within(await screen.findByRole('dialog', { name: `NPCs of ${title}` }, LONG));
  };
  const stats = { M: '4', WS: '4', BS: '3' };

  it('adds an NPC to a draft after the scenario exists, with the grid, and hides single stats and the name', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const sc = srv.scenarioFrom(c.id, { title: 'The night at the ferry' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    const f = await open(user);
    await user.click(await f.findByRole('button', { name: 'New NPC' }, LONG));
    await user.type(f.getByLabelText('Name of the NPC'), 'Captain Brandt');
    for (const [k, v] of Object.entries(stats)) await user.type(await f.findByLabelText(`${k} of Captain Brandt`, {}, LONG), v);
    await user.click(f.getByRole('checkbox', { name: 'Hide WS of Captain Brandt' }));
    const players = f.getByRole('table', { name: 'Characteristics of Captain Brandt' }); // the preview: as the players read it
    expect(within(players).getAllByRole('cell').map((x) => x.textContent).slice(0, 3)).toEqual(['4', '?', '3']);
    await user.click(f.getByRole('checkbox', { name: 'Hide the name of Captain Brandt' }));
    expect(f.getByText('?', { selector: 'strong' })).toBeTruthy(); // the name in the preview
    await user.click(f.getByRole('checkbox', { name: 'Hide the name of Captain Brandt' })); // and back
    expect(f.queryByText('?', { selector: 'strong' })).toBeNull();
    await user.click(f.getByRole('button', { name: 'Save NPCs' }));
    const card = await screen.findByRole('article', { name: 'Draft: The night at the ferry' });
    expect(await within(card).findByText(/The players read “\?” for: WS\./)).toBeTruthy();
    expect(srv.state.scenarios.get(sc.id)!.npcs).toMatchObject([{ name: 'Captain Brandt', hidden: ['WS'], profile: { M: '4', WS: '4', BS: '3' } }]);
    expect(within(card).getByRole('button', { name: 'Change the NPCs of The night at the ferry' })).toBeTruthy();
  }, 40_000);

  it('“All stats” hides every characteristic and the save at once, and clears again', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const sc = srv.scenarioFrom(c.id, { title: 'The night at the ferry', npcs: [brandt()] });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    const f = await open(user, 'The night at the ferry', 'Change');
    const all = await f.findByRole('checkbox', { name: 'Hide all stats of Captain Brandt' }, LONG) as HTMLInputElement;
    await user.click(f.getByRole('checkbox', { name: 'Hide BS of Captain Brandt' }));
    expect(all.indeterminate).toBe(true); // some, not all
    await user.click(all);
    expect(all.checked).toBe(true);
    expect(within(f.getByRole('table', { name: 'Characteristics of Captain Brandt' })).getAllByRole('cell').map((x) => x.textContent)).toEqual(Array(10).fill('?'));
    await user.click(all);
    expect(all.checked).toBe(false);
    await user.click(all);
    await user.click(f.getByRole('button', { name: 'Save NPCs' }));
    await waitFor(() => expect(srv.state.scenarios.get(sc.id)!.npcs[0]!.hidden).toEqual(['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld', 'sv']));
    // the Tabletop Simulator copy for the table has the “?” too
    await user.click(await screen.findByRole('button', { name: 'Copy the statlines of The night at the ferry' }));
    const text = await navigator.clipboard.readText();
    expect(text).toMatch(/M \?\s+WS \?\s+BS \?/);
    expect(text).not.toContain('WS 4');
  }, 40_000);

  it('“Hide everything” hides every part at once – name, stats, skills, equipment, rules – and clears again', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const sc = srv.scenarioFrom(c.id, { title: 'The night at the ferry', npcs: [brandt()] });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    const f = await open(user, 'The night at the ferry', 'Change');
    const every = await f.findByRole('checkbox', { name: 'Hide everything of Captain Brandt' }, LONG) as HTMLInputElement;
    expect(every.checked).toBe(false);
    await user.click(f.getByRole('checkbox', { name: 'Hide the name of Captain Brandt' }));
    expect(every.indeterminate).toBe(true); // some, not all
    await user.click(every);
    expect(every.checked).toBe(true);
    expect(every.indeterminate).toBe(false);
    // the form shows every part ticked, and the preview reads “?” everywhere
    for (const name of ['Hide the name of Captain Brandt', 'Hide all stats of Captain Brandt', 'Hide the skills of Captain Brandt', 'Hide the equipment of Captain Brandt', 'Hide the special rules of Captain Brandt']) {
      expect((f.getByRole('checkbox', { name }) as HTMLInputElement).checked, name).toBe(true);
    }
    expect(within(f.getByRole('table', { name: 'Characteristics of ?' })).getAllByRole('cell').map((x) => x.textContent)).toEqual(Array(10).fill('?'));
    await user.click(every);
    expect(every.checked).toBe(false);
    expect((f.getByRole('checkbox', { name: 'Hide the name of Captain Brandt' }) as HTMLInputElement).checked).toBe(false);
    expect((f.getByRole('checkbox', { name: 'Hide all stats of Captain Brandt' }) as HTMLInputElement).checked).toBe(false);
    await user.click(every);
    await user.click(f.getByRole('button', { name: 'Save NPCs' }));
    await waitFor(() => expect(srv.state.scenarios.get(sc.id)!.npcs[0]!.hidden).toEqual([...HIDABLE]));
  }, 40_000);

  it('after the release “Hide everything” is off: the players have read some of it, and it cannot be hidden after the fact', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    srv.scenarioFrom(c.id, { title: 'The night at the ferry', npcs: [brandt({ hidden: ['name', 'WS'] })], battleId: b.id });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    const f = await open(user, 'The night at the ferry', 'Change');
    expect(((await f.findByRole('checkbox', { name: 'Hide everything of Captain Brandt' }, LONG)) as HTMLInputElement).disabled).toBe(true);
  }, 40_000);

  it('asks for no type and shows none: not in the form, not in the preview, not on the card – the NPC keeps the one it came with', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const sc = srv.scenarioFrom(c.id, { title: 'The night at the ferry', npcs: [brandt({ type: 'TYPE-MARK', hidden: ['name'] })] });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    expect(await screen.findByText('Captain Brandt')).toBeTruthy();
    expect(document.body.textContent).not.toContain('TYPE-MARK');
    const f = await open(user, 'The night at the ferry', 'Change');
    await f.findByLabelText('Name of the NPC', {}, LONG);
    expect(f.queryByLabelText('Type')).toBeNull();
    expect(document.body.textContent).not.toContain('TYPE-MARK');
    await user.click(f.getByRole('button', { name: 'Save NPCs' }));
    await waitFor(() => expect(srv.state.scenarios.get(sc.id)!.npcs).toHaveLength(1));
    expect(srv.state.scenarios.get(sc.id)!.npcs[0]).toMatchObject({ type: 'TYPE-MARK' });
  }, 40_000);

  it('the eye shows a card the way the players read it, and back; only an NPC with something hidden has one', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    srv.scenarioFrom(c.id, { title: 'The night at the ferry', npcs: [brandt({ hidden: ['name', 'WS', 'equipment'] }), brandt({ id: '22222222-2222-4222-8222-222222222222', name: 'Old Marek' })] });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    const card = await screen.findByRole('article', { name: 'Draft: The night at the ferry' });
    const list = within(await within(card).findByRole('list', { name: 'NPCs of The night at the ferry' }));
    expect(list.getAllByRole('button', { name: 'Players’ view' })).toHaveLength(1);
    const mine = within(list.getByText('Captain Brandt').closest('li')!);
    const cells = () => within(mine.getByRole('table', { name: /^Characteristics of/ })).getAllByRole('cell').slice(0, 3).map((x) => x.textContent);
    // the leader's view is the default: all of it, what is hidden marked
    expect(cells()).toEqual(['4', '4', '3']);
    expect(mine.getByText(/The players read “\?” for: name, WS, equipment\./)).toBeTruthy();
    const eye = mine.getByRole('button', { name: 'Players’ view' });
    expect(eye.getAttribute('aria-pressed')).toBe('false');
    await user.click(eye);
    expect(eye.getAttribute('aria-pressed')).toBe('true');
    expect(cells()).toEqual(['4', '?', '3']);
    expect(mine.queryByText('Captain Brandt')).toBeNull();
    expect(mine.getByText('This is the card as the players read it.')).toBeTruthy();
    expect(mine.getByText('?', { selector: 'strong' })).toBeTruthy();
    expect(mine.queryByText(/Sword/)).toBeNull(); // the equipment reads “?” in this view – and the copy with every value is not part of it
    expect(mine.getByText('Skills, equipment and rules').closest('details')!.textContent).toContain('Equipment: ?');
    await user.click(eye);
    expect(eye.getAttribute('aria-pressed')).toBe('false');
    expect(cells()).toEqual(['4', '4', '3']);
    expect(mine.getByText('Captain Brandt')).toBeTruthy();
  }, 40_000);

  it('a fold-out says that it opens: its title is a bar with a chevron, and it opens and closes', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    srv.scenarioFrom(c.id, { title: 'The night at the ferry', npcs: [brandt()] });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    const card = await screen.findByRole('article', { name: 'Draft: The night at the ferry' });
    const bar = await within(card).findByText('Skills, equipment and rules');
    expect(bar.tagName).toBe('SUMMARY');
    expect(bar.className).toMatch(/fold/); // the shared bar with the chevron (ui.module.css)
    const details = bar.closest('details')!;
    expect(details.open).toBe(false);
    await user.click(bar);
    expect(details.open).toBe(true);
    await user.click(bar);
    expect(details.open).toBe(false);
  }, 40_000);

  it('adds an NPC made under World straight from its list; the copy has its own name and is a new NPC of the scenario', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const guard = srv.factionFrom(c.id, { nameEn: 'The Countess’s Guard' });
    const values = { type: 'Henchman', profile: { M: '4', WS: '3', BS: '3', S: '3', T: '3', W: '1', I: '3', A: '1', Ld: '7' }, sv: '6+', skills: [], equipment: 'Boat hook', rules: 'Knows the river', from: null };
    srv.npcFrom(c.id, { nameEn: 'Old Marek', factionId: guard.id, profile: values });
    srv.npcFrom(c.id, { nameEn: 'Loose Lena', profile: { ...values, equipment: 'Knife' } });
    const sc = srv.scenarioFrom(c.id, { title: 'The night at the ferry' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    const f = await open(user);
    const pick = await f.findByLabelText('Add an NPC of the world', {}, LONG);
    expect(within(pick).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choose a person…', 'Loose Lena', 'Old Marek']);
    expect((f.getByRole('button', { name: 'Add this one' }) as HTMLButtonElement).disabled).toBe(true);
    await user.selectOptions(pick, 'Old Marek');
    await user.click(f.getByRole('button', { name: 'Add this one' }));
    expect((f.getByLabelText('Name of the NPC') as HTMLInputElement).value).toBe('Old Marek');
    expect((f.getByLabelText('WS of Old Marek') as HTMLInputElement).value).toBe('3');
    expect((pick as HTMLSelectElement).value).toBe(''); // ready for the next one
    await user.click(f.getByRole('button', { name: 'Save NPCs' }));
    await waitFor(() => expect(srv.state.scenarios.get(sc.id)!.npcs).toHaveLength(1));
    expect(srv.state.scenarios.get(sc.id)!.npcs[0]).toMatchObject({ name: 'Old Marek', hidden: [], profile: { WS: '3' }, equipment: 'Boat hook', rules: 'Knows the river' });
  }, 40_000);

  it('says so when the world has no NPC yet', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    srv.scenarioFrom(c.id, { title: 'The night at the ferry' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    const f = await open(user);
    const pick = await f.findByLabelText('Add an NPC of the world', {}, LONG) as HTMLSelectElement;
    expect(pick.disabled).toBe(true);
    expect(within(pick).getByText('No NPC in the world yet')).toBeTruthy();
  }, 40_000);

  it('copies an NPC from a model of the game, and the NPC keeps its own name', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const sc = srv.scenarioFrom(c.id, { title: 'The night at the ferry' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    const f = await open(user);
    await user.click(await f.findByRole('button', { name: 'Copy from a model…' }, LONG));
    const picker = within(await f.findByRole('group', { name: 'Copy a model' }, LONG));
    await user.type(picker.getByLabelText('Search every model'), 'ogre bodyguard');
    await user.click(await picker.findByRole('button', { name: /^Copy Ogre Bodyguard \(/ }));
    expect((f.getByLabelText('Name of the NPC') as HTMLInputElement).value).toBe('Ogre Bodyguard');
    expect((f.getByLabelText('S of Ogre Bodyguard') as HTMLInputElement).value).toBe('4');
    await user.clear(f.getByLabelText('Name of the NPC'));
    await user.type(f.getByLabelText('Name of the NPC'), 'Big Grul');
    await user.click(f.getByRole('button', { name: 'Save NPCs' }));
    await waitFor(() => expect(srv.state.scenarios.get(sc.id)!.npcs).toHaveLength(1));
    expect(srv.state.scenarios.get(sc.id)!.npcs[0]).toMatchObject({ name: 'Big Grul', hidden: [], profile: { S: '4' } });
  }, 40_000);

  it('brings an NPC along from another scenario, with what was hidden; the copy is a new NPC', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    srv.scenarioFrom(c.id, { title: 'The night at the ferry', npcs: [brandt({ hidden: ['WS'] })], battleId: b.id });
    const later = srv.scenarioFrom(c.id, { title: 'The bridge' });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    const f = await open(user, 'The bridge');
    await user.selectOptions(await f.findByLabelText('Bring along from another scenario', {}, LONG), 'Captain Brandt · The night at the ferry');
    await user.click(f.getByRole('button', { name: 'Bring along' }));
    expect((f.getByLabelText('Name of the NPC') as HTMLInputElement).value).toBe('Captain Brandt');
    expect((f.getByRole('checkbox', { name: 'Hide WS of Captain Brandt' }) as HTMLInputElement).checked).toBe(true);
    await user.click(f.getByRole('button', { name: 'Save NPCs' }));
    await waitFor(() => expect(srv.state.scenarios.get(later.id)!.npcs).toHaveLength(1));
    const copy = srv.state.scenarios.get(later.id)!.npcs[0]!;
    expect(copy).toMatchObject({ name: 'Captain Brandt', hidden: ['WS'], profile: { WS: '4' } });
    expect(copy.id).not.toBe(brandt().id);
  }, 40_000);

  it('the players read “?” – the server has replaced the hidden parts before they arrive', async () => {
    const srv = server();
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', role: 'player', others: [{ ...others()[0]!, role: 'leader' as const }] });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    srv.scenarioFrom(c.id, { title: 'The night at the ferry', npcs: [brandt({ name: 'QUOKKA Brandt', hidden: ['name', 'WS', 'skills', 'equipment'] }), brandt({ id: '22222222-2222-4222-8222-222222222222', name: 'Old Marek', equipment: 'Boat hook' })], battleId: b.id });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    const card = await screen.findByRole('article', { name: 'The night at the ferry' });
    const list = within(await within(card).findByRole('list', { name: 'NPCs of The night at the ferry' }));
    expect(list.getAllByRole('listitem').length).toBeGreaterThanOrEqual(2);
    expect(list.getByText('Old Marek')).toBeTruthy(); // the one nobody hid
    expect(document.body.textContent).not.toContain('QUOKKA');
    expect(document.body.textContent).not.toContain('Sword');
    expect(within(list.getByRole('table', { name: 'Characteristics of ?' })).getAllByRole('cell').slice(0, 3).map((x) => x.textContent)).toEqual(['4', '?', '3']);
    expect(list.queryByText(/The players read/)).toBeNull(); // the leader's note is the leader's
    expect(within(card).queryByRole('button', { name: /NPCs of/ })).toBeNull();
    await user.click(within(card).getByRole('button', { name: 'Copy the statlines of The night at the ferry' }));
    expect(await navigator.clipboard.readText()).not.toContain('QUOKKA');
  }, 40_000);

  it('after the release what was hidden can be shown but not changed, nothing new is hidden, and the NPC stays', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    const sc = srv.scenarioFrom(c.id, { title: 'The night at the ferry', npcs: [brandt({ hidden: ['WS'] })], battleId: b.id });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    const f = await open(user, 'The night at the ferry', 'Change');
    expect((await f.findByLabelText('WS of Captain Brandt', {}, LONG) as HTMLInputElement).disabled).toBe(true); // hidden when the players read it
    expect((f.getByLabelText('BS of Captain Brandt') as HTMLInputElement).disabled).toBe(false); // not hidden: a correction is fine
    expect((f.getByRole('checkbox', { name: 'Hide BS of Captain Brandt' }) as HTMLInputElement).disabled).toBe(true); // too late to hide it
    expect((f.getByRole('button', { name: 'Take Captain Brandt out' }) as HTMLButtonElement).disabled).toBe(true);
    expect(f.getByText(/Those values can be shown, not changed/)).toBeTruthy();
    await user.click(f.getByRole('checkbox', { name: 'Hide WS of Captain Brandt' })); // show it
    expect(f.getByRole('status').textContent).toMatch(/Saving shows WS to everybody in the campaign/);
    await user.click(f.getByRole('button', { name: 'Save NPCs' }));
    await waitFor(() => expect(srv.state.scenarios.get(sc.id)!.npcs[0]!.hidden).toEqual([]));
    expect(srv.state.scenarios.get(sc.id)!.npcs[0]!.profile.WS).toBe('4');
  }, 40_000);

  it('the server’s refusal of a change to what was read is shown in words, and nothing is lost', async () => {
    const srv = server({ totp: true });
    const c = srv.addCampaign({ name: 'The Hel Fenn Campaign', others: others() });
    const b = srv.addBattle(c.id, { title: 'Hel Fenn ferry' });
    const sc = srv.scenarioFrom(c.id, { title: 'The night at the ferry', npcs: [brandt({ hidden: ['WS'] })], battleId: b.id });
    const user = userEvent.setup();
    at(`/campaign/${c.id}/world`);
    const f = await open(user, 'The night at the ferry', 'Change');
    await f.findByLabelText('WS of Captain Brandt', {}, LONG);
    srv.state.scenarios.get(sc.id)!.npcs[0]!.profile.WS = '5'; // another device got the hidden value changed (the server would not have let it)
    await user.click(f.getByRole('button', { name: 'Save NPCs' }));
    expect((await f.findByRole('alert')).textContent).toMatch(/The players have already read this scenario: what is hidden cannot be changed/);
    expect(srv.state.scenarios.get(sc.id)!.npcs[0]!.profile.WS).toBe('5');
  }, 40_000);
});
