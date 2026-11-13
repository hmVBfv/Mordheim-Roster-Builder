/* Contract, area 7: scenarios, the background, opponents, hidden NPC warbands and chapter drafts – what a campaign's leader writes that the
   players do not (or not yet) read. The signed-in user leads the campaign, one warband entered, one battle. Plan P5. */
import { describe, expect, it } from 'vitest';
import { startAccounts } from '../accounts-helpers.ts';
import { gameData, totalsOf } from '../../src/rules.ts';
import { compare, fakeSide, serverSide, type Step } from './driver.ts';

const SAVE = { wb: 'merc', name: 'The Probes', models: [], format: 2 };
const W1 = '11111111-1111-4111-8111-111111111111';
const BATTLE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const id = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const [S1, S2, E1, E2, G1, K1, N1, D1, D2] = [id(1), id(2), id(3), id(4), id(5), id(6), id(7), id(8), id(9)];
const GONE = id(0);

export const LEADER2_STEPS: Step[] = [
  { name: 'start a campaign', url: '/campaigns', body: { name: 'The Hel Fenn Campaign' }, capture: { c: 'campaign.id' } },
  { name: 'enter a warband', url: '/campaigns/{c}/enrolments', body: { warbandId: W1, data: SAVE }, capture: { e: 'enrolmentId' } },
  { name: 'set up a battle', url: '/campaigns/{c}/battles', body: { id: BATTLE, title: 'The ferry', warbandIds: [W1] } },

  // scenarios
  { name: 'scenarios of nothing', url: '/campaigns/{c}/scenarios' },
  { name: 'write a scenario', method: 'PUT', url: `/campaigns/{c}/scenarios/${S1}`, body: { title: 'The ferry at night', body: 'Rules of the night.', npcStatlines: 'Captain Brandt M4 WS4' } },
  { name: 'write a second of the same title', method: 'PUT', url: `/campaigns/{c}/scenarios/${S2}`, body: { title: ' the ferry at night ', body: '' } },
  { name: 'write a scenario without a title', method: 'PUT', url: `/campaigns/{c}/scenarios/${S2}`, body: { title: '  ', body: '' } },
  { name: 'write a scenario with a name that is no id', method: 'PUT', url: '/campaigns/{c}/scenarios/nope', body: { title: 'X', body: '' } },
  { name: 'write a second scenario', method: 'PUT', url: `/campaigns/{c}/scenarios/${S2}`, body: { title: 'The mill', body: 'Fog.' } },
  { name: 'change it on a stale base', method: 'PUT', url: `/campaigns/{c}/scenarios/${S2}`, body: { title: 'The mill', body: 'Thicker fog.', baseSeq: 0 } },
  { name: 'release it', url: `/campaigns/{c}/scenarios/${S1}/release`, body: { battleId: BATTLE } },
  { name: 'release it again', url: `/campaigns/{c}/scenarios/${S1}/release`, body: { battleId: BATTLE } },
  { name: 'release a scenario there is not', url: `/campaigns/{c}/scenarios/${GONE}/release`, body: { battleId: BATTLE } },
  { name: 'release into a battle there is not', url: `/campaigns/{c}/scenarios/${S2}/release`, body: { battleId: GONE } },
  { name: 'the scenarios', url: '/campaigns/{c}/scenarios' },
  { name: 'take out a scenario', method: 'DELETE', url: `/campaigns/{c}/scenarios/${S2}` },
  { name: 'take out the released one', method: 'DELETE', url: `/campaigns/{c}/scenarios/${S1}` },
  { name: 'take out one there is not', method: 'DELETE', url: `/campaigns/{c}/scenarios/${GONE}` },

  // the background
  { name: 'background of nothing', url: '/campaigns/{c}/background' },
  { name: 'a thread', method: 'PUT', url: `/campaigns/{c}/background/${E1}`, body: { kind: 'thread', title: 'The ferryman', truth: 'He is paid by somebody.' } },
  { name: 'a second of the same title', method: 'PUT', url: `/campaigns/{c}/background/${E2}`, body: { kind: 'thread', title: 'The Ferryman', truth: '' } },
  { name: 'a kind there is not', method: 'PUT', url: `/campaigns/{c}/background/${E2}`, body: { kind: 'nonsense', title: 'X', truth: '' } },
  { name: 'an entry without a title', method: 'PUT', url: `/campaigns/{c}/background/${E2}`, body: { kind: 'thread', title: ' ', truth: '' } },
  { name: 'an entry with a name that is no id', method: 'PUT', url: '/campaigns/{c}/background/nope', body: { kind: 'thread', title: 'X', truth: '' } },
  { name: 'change the thread', method: 'PUT', url: `/campaigns/{c}/background/${E1}`, body: { kind: 'thread', title: 'The ferryman', truth: 'He is paid by the Countess.', baseSeq: 1 } },
  { name: 'change it on a stale base', method: 'PUT', url: `/campaigns/{c}/background/${E1}`, body: { kind: 'thread', title: 'The ferryman', truth: 'Another.', baseSeq: 0 } },
  { name: 'read the entry', url: `/campaigns/{c}/background/${E1}` },
  { name: 'read an entry there is not', url: `/campaigns/{c}/background/${GONE}` },
  { name: 'reveal a hint', url: `/campaigns/{c}/background/${E1}/reveal`, body: { noteId: id(1), text: 'The ferryman did not come back.', level: 'hint' } },
  { name: 'reveal with a level there is not', url: `/campaigns/{c}/background/${E1}/reveal`, body: { noteId: id(2), text: 'x', level: 'nonsense' } },
  { name: 'reveal an entry there is not', url: `/campaigns/{c}/background/${GONE}/reveal`, body: { noteId: id(3), text: 'x', level: 'hint' } },
  { name: 'the background', url: '/campaigns/{c}/background' },
  { name: 'take the entry out', method: 'DELETE', url: `/campaigns/{c}/background/${E1}` },
  { name: 'take it out again', method: 'DELETE', url: `/campaigns/{c}/background/${E1}` },

  // opponents
  { name: 'opponents of nothing', url: '/campaigns/{c}/opponents' },
  { name: 'a group', method: 'PUT', url: `/campaigns/{c}/opponents/groups/${G1}`, body: { name: 'The ferrymen', profiles: [{ id: 'p1', name: 'Ferryman', type: 'Henchman', count: 1, profile: { M: '4', WS: '3' }, sv: '', skills: [], equipment: '', equipmentTips: [], rules: '', note: '', from: null }], baseSeq: 0 } },
  { name: 'a group on a stale base', method: 'PUT', url: `/campaigns/{c}/opponents/groups/${G1}`, body: { name: 'The ferrymen', profiles: [{ ...({ id: 'p1', name: 'Ferryman', type: 'Henchman', count: 1, profile: { M: '4', WS: '3' }, sv: '', skills: [], equipment: '', equipmentTips: [], rules: '', note: '', from: null }), profile: { M: '5' } }], baseSeq: 0 } },
  { name: 'a group without a name', method: 'PUT', url: `/campaigns/{c}/opponents/groups/${id(2)}`, body: { name: ' ', profiles: [], baseSeq: 0 } },
  { name: 'a skill', method: 'PUT', url: `/campaigns/{c}/opponents/skills/${K1}`, body: { name: 'Ferryman’s Luck', text: 'Re-roll one dice.', baseSeq: 0 } },
  { name: 'a skill without a name', method: 'PUT', url: `/campaigns/{c}/opponents/skills/${id(2)}`, body: { name: '', text: 'x', baseSeq: 0 } },
  { name: 'the opponents', url: '/campaigns/{c}/opponents' },
  { name: 'take the skill out', method: 'DELETE', url: `/campaigns/{c}/opponents/skills/${K1}` },
  { name: 'take the group out', method: 'DELETE', url: `/campaigns/{c}/opponents/groups/${G1}` },
  { name: 'take a group out that is not there', method: 'DELETE', url: `/campaigns/{c}/opponents/groups/${GONE}` },

  // hidden NPC warbands
  { name: 'npc warbands of nothing', url: '/campaigns/{c}/npc-warbands' },
  { name: 'an npc warband', method: 'PUT', url: `/campaigns/{c}/npc-warbands/${N1}`, body: { name: 'The Watch', save: { planner: true, name: 'The Watch' }, summary: { value: 100, exp: 2, rating: 12, models: 3, kind: 'Mercenaries' } } },
  { name: 'one without a name', method: 'PUT', url: `/campaigns/{c}/npc-warbands/${id(2)}`, body: { name: ' ', save: {}, summary: {} } },
  { name: 'read it', url: `/campaigns/{c}/npc-warbands/${N1}` },
  { name: 'read one there is not', url: `/campaigns/{c}/npc-warbands/${GONE}` },
  { name: 'take it out', method: 'DELETE', url: `/campaigns/{c}/npc-warbands/${N1}` },
  { name: 'take it out again', method: 'DELETE', url: `/campaigns/{c}/npc-warbands/${N1}` },

  // chapter drafts
  { name: 'drafts of nothing', url: '/campaigns/{c}/chapter-drafts' },
  { name: 'a draft', method: 'PUT', url: `/campaigns/{c}/chapter-drafts/${D1}`, body: { refKey: 'battle-2', kind: 'battle', lang: 'de', title: 'Die Mühle', text: 'Nebel lag über dem Mühlbach.' } },
  { name: 'a draft without a text', method: 'PUT', url: `/campaigns/{c}/chapter-drafts/${D2}`, body: { refKey: 'battle-3', kind: 'battle', lang: 'de', title: 'T', text: '' } },
  { name: 'a draft of a kind there is not', method: 'PUT', url: `/campaigns/{c}/chapter-drafts/${D2}`, body: { refKey: 'x', kind: 'nonsense', lang: 'de', title: 'T', text: 'x' } },
  { name: 'a draft on a stale base', method: 'PUT', url: `/campaigns/{c}/chapter-drafts/${D1}`, body: { refKey: 'battle-2', kind: 'battle', lang: 'de', title: 'Die Mühle', text: 'Anders.', baseSeq: 0 } },
  { name: 'the drafts', url: '/campaigns/{c}/chapter-drafts' },
  { name: 'publish the draft', url: `/campaigns/{c}/chapter-drafts/${D1}/publish`, body: { at: { segment: 'pre', pos: '5' } } },
  { name: 'publish it again', url: `/campaigns/{c}/chapter-drafts/${D1}/publish`, body: { at: { segment: 'pre', pos: '5' } } },
  { name: 'publish one there is not', url: `/campaigns/{c}/chapter-drafts/${GONE}/publish`, body: { at: { segment: 'pre', pos: '5' } } },
  { name: 'take a draft out that is not there', method: 'DELETE', url: `/campaigns/{c}/chapter-drafts/${GONE}` },
];

describe('contract: scenarios, background, opponents, NPC warbands, drafts', () => {
  it('the fake answers as the server does', async () => {
    const s = await startAccounts();
    const kai = await s.user('kai');
    s.db.prepare('UPDATE users SET display_name = ? WHERE username = ?').run('Kai', 'kai');
    const server = serverSide((r) => s.call(r), kai.session(), { me: kai.id }, () => s.clock.advance(1000));
    const fake = fakeSide({
      me: { id: 'u1', username: 'kai', displayName: 'Kai' },
      totals: (save) => { const t = totalsOf(save); return { rating: t?.rating ?? 0, spent: t?.spent ?? 0, models: t?.models ?? 0, heroes: t?.heroes ?? 0, gold: t?.gold ?? 0, fallen: t?.fallen ?? 0 }; },
      wbName: (wb) => (gameData().WARBANDS as Record<string, { name?: string }>)[wb]?.name ?? wb,
    }, { me: 'u1' });
    const { found, unused } = await compare(LEADER2_STEPS, server, fake);
    expect(found).toEqual([]);
    expect(unused).toEqual([]);
  });
});
