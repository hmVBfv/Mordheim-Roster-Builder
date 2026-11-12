/* Contract, area 4: battles and their protocol, corrections, closing, confirming the version that fights, and the notes of a campaign
   (server/src/routes-battles.ts, routes-notes.ts). Marking a warband after a battle is left to the next area: the fake needs the rules' changes
   for it. The campaign is the signed-in user's own (a leader, with one warband entered). Plan P5. */
import { describe, expect, it } from 'vitest';
import { startAccounts } from '../accounts-helpers.ts';
import { gameData, totalsOf } from '../../src/rules.ts';
import { compare, fakeSide, serverSide, type Step } from './driver.ts';

const SAVE = { wb: 'merc', name: 'The Probes', models: [], format: 2 };
const W = (n: number) => `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${String(n).repeat(12)}`;
const BATTLE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BATTLE2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const E1 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const E2 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const P1 = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const N1 = '10101010-1010-4010-8010-101010101010';
const N2 = '20202020-2020-4020-8020-202020202020';

export const BATTLE_STEPS: Step[] = [
  { name: 'start a campaign', url: '/campaigns', body: { name: 'The Hel Fenn Campaign' }, capture: { c: 'campaign.id' } },
  { name: 'enter a warband', url: '/campaigns/{c}/enrolments', body: { warbandId: W(1), data: SAVE }, capture: { e: 'enrolmentId' } },
  { name: 'battles of nothing', url: '/campaigns/{c}/battles' },
  { name: 'set up a battle', url: '/campaigns/{c}/battles', body: { id: BATTLE, title: 'The ferry', warbandIds: [W(1)] } },
  { name: 'set up the same battle again', url: '/campaigns/{c}/battles', body: { id: BATTLE, title: 'The ferry', warbandIds: [W(1)] } },
  { name: 'set up another of the same name', url: '/campaigns/{c}/battles', body: { id: BATTLE2, title: 'The ferry', warbandIds: [W(1)] } },
  { name: 'set up one without a fighter', url: '/campaigns/{c}/battles', body: { id: BATTLE2, title: 'Alone', warbandIds: [] } },
  { name: 'set up one with a warband that is not in it', url: '/campaigns/{c}/battles', body: { id: BATTLE2, title: 'Alone', warbandIds: [W(5)] } },
  { name: 'set up one in a district there is not', url: '/campaigns/{c}/battles', body: { id: BATTLE2, title: 'Far', warbandIds: [W(1)], district: 'nowhere' } },
  { name: 'set up one in the past', url: '/campaigns/{c}/battles', body: { id: BATTLE2, title: 'Past', round: 0, warbandIds: [W(1)] } },
  { name: 'battles', url: '/campaigns/{c}/battles' },
  { name: 'read the battle', url: `/campaigns/{c}/battles/${BATTLE}` },
  { name: 'read it with its number', url: `/campaigns/{c}/battles/${BATTLE}?since=999` },
  { name: 'read a battle there is not', url: `/campaigns/{c}/battles/${BATTLE2}` },
  { name: 'change the battle', method: 'PATCH', url: `/campaigns/{c}/battles/${BATTLE}`, body: { scenario: 'Ambush', turn: 2, outcomes: { [W(1)]: 'victory' } } },
  { name: 'change it to a title taken', method: 'PATCH', url: `/campaigns/{c}/battles/${BATTLE}`, body: { title: 'The ferry' } },
  { name: 'give an outcome to a warband that did not fight', method: 'PATCH', url: `/campaigns/{c}/battles/${BATTLE}`, body: { outcomes: { [W(5)]: 'victory' } } },
  { name: 'write an event', method: 'PUT', url: `/campaigns/{c}/battles/${BATTLE}/protocol/${E1}`, body: { turn: 1, kind: 'event', payload: { text: 'Rain.' } } },
  { name: 'write the same entry again', method: 'PUT', url: `/campaigns/{c}/battles/${BATTLE}/protocol/${E1}`, body: { turn: 1, kind: 'event', payload: { text: 'Rain.' } } },
  { name: 'write a casualty', method: 'PUT', url: `/campaigns/{c}/battles/${BATTLE}/protocol/${E2}`, body: { turn: 2, kind: 'casualty', payload: { victim: { name: 'A ferryman', env: true }, attacker: null, note: 'Drowned.' } } },
  { name: 'write a casualty of a warband that did not fight', method: 'PUT', url: `/campaigns/{c}/battles/${BATTLE}/protocol/${W(6)}`, body: { turn: 2, kind: 'casualty', payload: { victim: { name: 'X', warbandId: W(5) }, attacker: null } } },
  { name: 'write something that is no entry', method: 'PUT', url: `/campaigns/{c}/battles/${BATTLE}/protocol/${W(6)}`, body: { turn: 2, kind: 'event', payload: { nonsense: 1 } } },
  { name: 'write an entry with a name that is no id', method: 'PUT', url: `/campaigns/{c}/battles/${BATTLE}/protocol/not-an-id`, body: { turn: 1, kind: 'event', payload: { text: 'x' } } },
  { name: 'a correction of an entry', method: 'PUT', url: `/campaigns/{c}/battles/${BATTLE}/proposals/${P1}`, body: { entryId: E1, text: 'It was snow.' } },
  { name: 'a correction of an entry there is not', method: 'PUT', url: `/campaigns/{c}/battles/${BATTLE}/proposals/${W(7)}`, body: { entryId: W(8), text: 'x' } },
  { name: 'a correction without text', method: 'PUT', url: `/campaigns/{c}/battles/${BATTLE}/proposals/${W(7)}`, body: { entryId: E1, text: '  ' } },
  { name: 'the battle with its protocol', url: `/campaigns/{c}/battles/${BATTLE}` },
  { name: 'accept the correction', url: `/campaigns/{c}/battles/${BATTLE}/proposals/${P1}/accept`, body: {} },
  { name: 'accept it again', url: `/campaigns/{c}/battles/${BATTLE}/proposals/${P1}/accept`, body: {} },
  { name: 'reject a correction there is not', url: `/campaigns/{c}/battles/${BATTLE}/proposals/${W(8)}/reject`, body: {} },
  { name: 'take an entry out', method: 'DELETE', url: `/campaigns/{c}/battles/${BATTLE}/protocol/${E2}` },
  { name: 'take it out again', method: 'DELETE', url: `/campaigns/{c}/battles/${BATTLE}/protocol/${E2}` },
  { name: 'confirm the version that fights', url: `/campaigns/{c}/battles/${BATTLE}/confirm`, body: { warbandId: W(1), rev: 1 } },
  { name: 'confirm a version there is not', url: `/campaigns/{c}/battles/${BATTLE}/confirm`, body: { warbandId: W(1), rev: 9 } },
  { name: 'confirm a warband that is not mine', url: `/campaigns/{c}/battles/${BATTLE}/confirm`, body: { warbandId: W(5), rev: 1 } },

  // notes
  { name: 'notes of nothing', url: '/campaigns/{c}/notes' },
  { name: 'a public note', method: 'PUT', url: `/campaigns/{c}/notes/${N1}`, body: { text: 'Rain over the Stir.', battleId: BATTLE, turn: 1 } },
  { name: 'a sealed note', method: 'PUT', url: `/campaigns/{c}/notes/${N2}`, body: { text: 'The ferryman takes the coin.', battleId: BATTLE, visibility: 'sealed' } },
  { name: 'a note for leaders', method: 'PUT', url: `/campaigns/{c}/notes/${W(9)}`, body: { text: 'The Countess pays him.', visibility: 'leader', kind: 'hook' } },
  { name: 'a note without text', method: 'PUT', url: `/campaigns/{c}/notes/${W(9)}`, body: { text: ' ' } },
  { name: 'a note with a name that is no id', method: 'PUT', url: '/campaigns/{c}/notes/nope', body: { text: 'x' } },
  { name: 'a note with a field there is not', method: 'PUT', url: `/campaigns/{c}/notes/${W(9)}`, body: { text: 'x', nonsense: 1 } },
  { name: 'change a note', method: 'PUT', url: `/campaigns/{c}/notes/${N1}`, body: { text: 'Rain over the Stir, all night.', battleId: BATTLE, turn: 1 } },
  { name: 'notes', url: '/campaigns/{c}/notes' },
  { name: 'notes as the players read them', url: '/campaigns/{c}/notes?as=player' },
  { name: 'notes since the newest', url: '/campaigns/{c}/notes?since=9999' },
  { name: 'take a note out', method: 'DELETE', url: `/campaigns/{c}/notes/${N1}` },
  { name: 'take it out again', method: 'DELETE', url: `/campaigns/{c}/notes/${N1}` },
  { name: 'write to the removed note', method: 'PUT', url: `/campaigns/{c}/notes/${N1}`, body: { text: 'Back.' } },

  // closing
  { name: 'close the battle', url: `/campaigns/{c}/battles/${BATTLE}/close`, body: {} },
  { name: 'close it again', url: `/campaigns/{c}/battles/${BATTLE}/close`, body: {} },
  { name: 'the closed battle', url: `/campaigns/{c}/battles/${BATTLE}` },
  { name: 'write to the closed battle', method: 'PUT', url: `/campaigns/{c}/battles/${BATTLE}/protocol/${E2}`, body: { turn: 1, kind: 'event', payload: { text: 'Late.' } } },
  { name: 'change the closed battle', method: 'PATCH', url: `/campaigns/{c}/battles/${BATTLE}`, body: { title: 'Late' } },
  { name: 'take the closed battle out', method: 'DELETE', url: `/campaigns/{c}/battles/${BATTLE}` },
  { name: 'notes after closing', url: '/campaigns/{c}/notes' },
  { name: 'a second battle', url: '/campaigns/{c}/battles', body: { id: BATTLE2, title: 'The second', warbandIds: [W(1)] } },
  { name: 'take it out', method: 'DELETE', url: `/campaigns/{c}/battles/${BATTLE2}` },
  { name: 'set it up again once taken out', url: '/campaigns/{c}/battles', body: { id: BATTLE2, title: 'The second', warbandIds: [W(1)] } },
  { name: 'battles at the end', url: '/campaigns/{c}/battles' },
];

describe('contract: battles and notes', () => {
  it('the fake answers as the server does', async () => {
    const s = await startAccounts();
    const kai = await s.user('kai');
    s.db.prepare('UPDATE users SET display_name = ? WHERE username = ?').run('Kai', 'kai');
    const server = serverSide((r) => s.call(r), kai.session(), { me: kai.id }, () => s.clock.advance(1000));
    const fake = fakeSide({
      me: { id: 'u1', username: 'kai', displayName: 'Kai' },
      totals: (save) => { const t = totalsOf(save); return { rating: t?.rating ?? 0, spent: t?.spent ?? 0, models: t?.models ?? 0, heroes: t?.heroes ?? 0, gold: t?.gold ?? 0, fallen: t?.fallen ?? 0 }; },
      wbName: (wb) => (gameData().WARBANDS as Record<string, { name?: string }>)[wb]?.name ?? wb,
      districtOk: (id) => gameData().DISTRICTS.some((d) => d.id === id),
    }, { me: 'u1' });
    const { found, unused } = await compare(BATTLE_STEPS, server, fake);
    expect(found).toEqual([]);
    expect(unused).toEqual([]);
  });
});
