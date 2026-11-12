/* Contract, area 3: campaigns, their members, the warbands entered in them and their history (server/src/routes-campaigns.ts). Plan P5.
   Two campaigns: one the signed-in user starts and leads, and one a second player leads with the signed-in user a player in it
   (that part is set up by each side its own way: `elsewhere`). */
import { describe, expect, it } from 'vitest';
import { startAccounts } from '../accounts-helpers.ts';
import { gameData, totalsOf } from '../../src/rules.ts';
import { compare, fakeSide, serverSide, type Refs, type Step } from './driver.ts';

const SAVE = { wb: 'merc', name: 'The Probes', models: [], format: 2 };
const W = (n: number) => `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${String(n).repeat(12)}`;
const B1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

export const CAMPAIGN_STEPS: Step[] = [
  { name: 'campaigns of nobody', url: '/campaigns' },
  { name: 'start a campaign', url: '/campaigns', body: { name: '  The Hel   Fenn Campaign ' }, capture: { c1: 'campaign.id' } },
  { name: 'start one of the same name', url: '/campaigns', body: { name: 'The Hel Fenn Campaign' } },
  { name: 'start one without a name', url: '/campaigns', body: { name: '   ' } },
  { name: 'start one with a place', url: '/campaigns', body: { name: 'The Other', place: 'mordheim' }, capture: { c3: 'campaign.id' } },
  { name: 'start a Vanilla campaign', url: '/campaigns', body: { name: 'The Rulebook', vanilla: true }, capture: { c4: 'campaign.id' } },
  { name: 'start a Vanilla campaign elsewhere', url: '/campaigns', body: { name: 'The Rulebook Abroad', vanilla: true, place: 'lustria' } },
  { name: 'campaigns started', url: '/campaigns' },
  { name: 'read the campaign', url: '/campaigns/{c1}' },
  { name: 'read a campaign there is not', url: `/campaigns/${W(7)}` },
  { name: 'rename', method: 'PATCH', url: '/campaigns/{c1}', body: { name: 'The Hel Fenn Feud' } },
  { name: 'rename to a name taken', method: 'PATCH', url: '/campaigns/{c1}', body: { name: 'The Other' } },
  { name: 'rename to nothing', method: 'PATCH', url: '/campaigns/{c1}', body: { name: ' ' } },
  { name: 'opening scene', method: 'PUT', url: '/campaigns/{c1}/opening', body: { text: ' Rain on the Stir. ' } },
  { name: 'turn a running campaign to Vanilla', method: 'PUT', url: '/campaigns/{c1}/vanilla', body: { vanilla: true } },
  { name: 'turn Vanilla off', method: 'PUT', url: '/campaigns/{c1}/vanilla', body: { vanilla: false } },
  { name: 'members: a player', method: 'PUT', url: '/campaigns/{c1}/members/{ben}', body: { role: 'player' } },
  { name: 'members: a viewer', method: 'PUT', url: '/campaigns/{c1}/members/{rob}', body: { role: 'viewer' } },
  { name: 'members: somebody there is not', method: 'PUT', url: '/campaigns/{c1}/members/{nobody}', body: { role: 'player' } },
  { name: 'members: a role there is not', method: 'PUT', url: '/campaigns/{c1}/members/{ben}', body: { role: 'king' } },
  { name: 'members: the only leader steps down', method: 'PUT', url: '/campaigns/{c1}/members/{me}', body: { role: 'player' } },
  { name: 'members: take one out', method: 'DELETE', url: '/campaigns/{c1}/members/{rob}' },
  { name: 'members: the only leader leaves', method: 'DELETE', url: '/campaigns/{c1}/members/{me}' },
  { name: 'enter a warband', url: '/campaigns/{c1}/enrolments', body: { warbandId: W(1), data: SAVE }, capture: { e1: 'enrolmentId' } },
  { name: 'enter the same warband again', url: '/campaigns/{c1}/enrolments', body: { warbandId: W(1), data: SAVE } },
  { name: 'enter a planner', url: '/campaigns/{c1}/enrolments', body: { warbandId: W(2), data: { ...SAVE, planner: true } } },
  { name: 'enter without a save', url: '/campaigns/{c1}/enrolments', body: { warbandId: W(2) } },
  { name: 'enter something that is no save', url: '/campaigns/{c1}/enrolments', body: { warbandId: W(2), data: { nonsense: 1 } } },
  { name: 'the warband entered', url: `/warbands/${W(1)}` },
  { name: 'the warband in the campaign', url: `/campaigns/{c1}/warbands/${W(1)}` },
  { name: 'a warband that is not in it', url: `/campaigns/{c1}/warbands/${W(5)}` },
  { name: 'remove the entered warband from my list', method: 'DELETE', url: `/warbands/${W(1)}` },
  { name: 'catch up', url: '/campaigns/{c1}/catchup' },
  { name: 'confirm what is confirmed', url: '/campaigns/{c1}/enrolments/{e1}/confirm', body: {} },
  { name: 'decline what is confirmed', url: '/campaigns/{c1}/enrolments/{e1}/decline', body: {} },
  { name: 'house rules', method: 'PUT', url: '/campaigns/{c1}/house-rules', body: { rules: {} } },
  { name: 'house rules that are none', method: 'PUT', url: '/campaigns/{c1}/house-rules', body: { rules: { nonsense: 5 } } },
  { name: 'the first battle of the history', method: 'PUT', url: `/campaigns/{c1}/history/${B1}`, body: { round: 1, title: 'The ferry', playedOn: '2026-05-01', outcomes: { [W(1)]: 'victory' } } },
  { name: 'a battle of the history that does not fit', method: 'PUT', url: `/campaigns/{c1}/history/${B1}`, body: { round: 0, outcomes: {} } },
  { name: 'read after the history', url: '/campaigns/{c1}' },
  { name: 'take the battle out', method: 'DELETE', url: `/campaigns/{c1}/history/${B1}` },
  { name: 'take it out again', method: 'DELETE', url: `/campaigns/{c1}/history/${B1}` },
  { name: 'next round', url: '/campaigns/{c1}/rounds/advance', body: {} },
  { name: 'file the campaign away', method: 'PUT', url: '/campaigns/{c1}/archive', body: { archived: true } },
  { name: 'campaigns with one filed away', url: '/campaigns' },
  { name: 'delete with the wrong name', method: 'DELETE', url: '/campaigns/{c1}', body: { name: 'not it' } },
  { name: 'delete', method: 'DELETE', url: '/campaigns/{c1}', body: { name: 'The Hel Fenn Feud' } },
  { name: 'read the deleted one', url: '/campaigns/{c1}' },
  { name: 'warband after the campaign is gone', url: `/warbands/${W(1)}` },

  // the second campaign: a player leads it, the signed-in user is a player in it
  { name: 'a player starts a campaign and invites me', url: '', elsewhere: true },
  { name: 'the campaigns I am in', url: '/campaigns' },
  { name: 'read the other campaign', url: '/campaigns/{c2}' },
  { name: 'try to rename it', method: 'PATCH', url: '/campaigns/{c2}', body: { name: 'Mine now' } },
  { name: 'try to turn Vanilla off', method: 'PUT', url: '/campaigns/{c2}/vanilla', body: { vanilla: false } },
  { name: 'try to make myself a leader', method: 'PUT', url: '/campaigns/{c2}/members/{me}', body: { role: 'leader' } },
  { name: 'try to take history in', method: 'PUT', url: `/campaigns/{c2}/history/${B1}`, body: { round: 1, outcomes: {} } },
  { name: 'try to move the round on', url: '/campaigns/{c2}/rounds/advance', body: {} },
  { name: 'try to delete it', method: 'DELETE', url: '/campaigns/{c2}', body: { name: 'The Ferry Feud' } },
  { name: 'enter a warband, waiting for a leader', url: '/campaigns/{c2}/enrolments', body: { warbandId: W(3), data: SAVE }, capture: { e3: 'enrolmentId' } },
  { name: 'the campaign with my warband waiting', url: '/campaigns/{c2}' },
  { name: 'try to confirm my own', url: '/campaigns/{c2}/enrolments/{e3}/confirm', body: {} },
  { name: 'the leader’s warband', url: '/campaigns/{c2}/warbands/{bw}' },
  { name: 'withdraw mine', method: 'DELETE', url: '/campaigns/{c2}/enrolments/{e3}' },
  { name: 'withdraw it again', method: 'DELETE', url: '/campaigns/{c2}/enrolments/{e3}' },
  { name: 'try to withdraw the leader’s', method: 'DELETE', url: '/campaigns/{c2}/enrolments/{be}' },
  { name: 'file it away', method: 'PUT', url: '/campaigns/{c2}/archive', body: { archived: true } },
  { name: 'bring it back', method: 'PUT', url: '/campaigns/{c2}/archive', body: { archived: false } },
];

describe('contract: campaigns', () => {
  it('the fake answers as the server does', async () => {
    const s = await startAccounts();
    const kai = await s.user('kai');
    const ben = await s.user('ben');
    const rob = await s.user('rob');
    for (const [name, display] of [['kai', 'Kai'], ['ben', 'Ben'], ['rob', 'Rob']]) s.db.prepare('UPDATE users SET display_name = ? WHERE username = ?').run(display, name);
    const bens = ben.session();
    const refs: Refs = { me: kai.id, ben: ben.id, rob: rob.id, nobody: '77777777-7777-4777-8777-777777777777' };
    const fakeRefs: Refs = { me: 'u1', ben: 'user-ben', rob: 'user-rob', nobody: 'user-nobody' };
    const asBen = async (req: { method?: 'POST' | 'PUT'; url: string; body: unknown }) => {
      s.clock.advance(1000);
      const r = await s.call({ method: req.method ?? 'POST', url: `/api/v1${req.url}`, body: req.body, token: bens });
      expect(r.statusCode, r.body).toBeLessThan(300);
      return r.json() as { campaign: { id: string }; enrolmentId: string };
    };
    const server = serverSide((r) => s.call(r), kai.session(), refs, () => s.clock.advance(1000), async (_step, r) => {
      const made = await asBen({ url: '/campaigns', body: { name: 'The Ferry Feud' } });
      r.c2 = made.campaign.id;
      await asBen({ method: 'PUT', url: `/campaigns/${r.c2}/members/${kai.id}`, body: { role: 'player' } });
      const entered = await asBen({ url: `/campaigns/${r.c2}/enrolments`, body: { warbandId: W(9), data: SAVE } });
      r.bw = W(9);
      r.be = entered.enrolmentId;
    });
    const fake = fakeSide({
      me: { id: 'u1', username: 'kai', displayName: 'Kai' },
      totals: (save) => { const t = totalsOf(save); return { rating: t?.rating ?? 0, spent: t?.spent ?? 0, models: t?.models ?? 0, heroes: t?.heroes ?? 0, gold: t?.gold ?? 0, fallen: t?.fallen ?? 0 }; },
      wbName: (wb) => (gameData().WARBANDS as Record<string, { name?: string }>)[wb]?.name ?? wb,
    }, fakeRefs, (f, _step, r) => {
      const camp = f.addCampaign({ name: 'The Ferry Feud', role: 'player', others: [{ player: 'Ben', role: 'leader', data: SAVE }] });
      r.c2 = camp.id;
      r.bw = camp.enrolments[0]!.warbandId;
      r.be = camp.enrolments[0]!.id;
    });
    const { found, unused } = await compare(CAMPAIGN_STEPS, server, fake);
    expect(found).toEqual([]);
    expect(unused).toEqual([]);
  });
});
