/* The scenarios of a campaign (phase 4b3c): a leaders' draft, released to a
   battle for everybody. Against the stand-in server (sync/fakeSync.ts). */
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

describe('ttsText', () => {
  const sc = (npcStatlines: string): Scenario => ({ id: 'x', title: 'The night at the ferry', body: '', npcStatlines, visibility: 'public', playedInBattle: null, releasedAt: null, releasedBy: null, edited: false, createdAt: '', updatedAt: '', seq: 1 });
  it('heads the statlines with the title; no statlines, no text', () => {
    expect(ttsText(sc(`  ${STATS}\n`))).toBe(`The night at the ferry\n${STATS}\n`);
    expect(ttsText(sc('  '))).toBe('');
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
