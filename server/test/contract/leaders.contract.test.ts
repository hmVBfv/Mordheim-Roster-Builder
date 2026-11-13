/* Contract, area 5: what a campaign's leaders write – the style guide, the plans for the battles, the backstory and the questions to the players
   (server/src/routes-style.ts, routes-plans.ts, routes-backstory.ts, routes-questions.ts). The signed-in user starts the campaign and leads it. Plan P5. */
import { describe, expect, it } from 'vitest';
import { startAccounts } from '../accounts-helpers.ts';
import { compare, fakeSide, serverSide, type Step } from './driver.ts';

const Q1 = '10101010-1010-4010-8010-101010101010';
const NOTE = '20202020-2020-4020-8020-202020202020';
const SECTION = { heading: 'Battle 1 – the ferry', battleNo: 1, text: 'The ferry burned.' };

export const LEADER_STEPS: Step[] = [
  { name: 'start a campaign', url: '/campaigns', body: { name: 'The Hel Fenn Campaign' }, capture: { c: 'campaign.id' } },
  { name: 'make a player of ben', method: 'PUT', url: '/campaigns/{c}/members/{ben}', body: { role: 'player' } },

  { name: 'style of nothing', url: '/campaigns/{c}/style' },
  { name: 'write the style', method: 'PUT', url: '/campaigns/{c}/style', body: { text: 'German, past tense.', baseSeq: 0 } },
  { name: 'write it on a stale base', method: 'PUT', url: '/campaigns/{c}/style', body: { text: 'Another.', baseSeq: 0 } },
  { name: 'write it on the right base', method: 'PUT', url: '/campaigns/{c}/style', body: { text: 'German, present tense.', baseSeq: 1 } },
  { name: 'write a style with a field there is not', method: 'PUT', url: '/campaigns/{c}/style', body: { text: 'x', nonsense: 1 } },
  { name: 'the style', url: '/campaigns/{c}/style' },

  { name: 'plans of nothing', url: '/campaigns/{c}/plans' },
  { name: 'plan the second battle', method: 'PUT', url: '/campaigns/{c}/plans/2', body: { text: 'The ferryman dies at the jetty.', baseSeq: 0 } },
  { name: 'plan it on a stale base', method: 'PUT', url: '/campaigns/{c}/plans/2', body: { text: 'Another.', baseSeq: 0 } },
  { name: 'plan a battle number there is not', method: 'PUT', url: '/campaigns/{c}/plans/0', body: { text: 'x', baseSeq: 0 } },
  { name: 'the plans', url: '/campaigns/{c}/plans' },

  { name: 'backstory of nothing', url: '/campaigns/{c}/backstory' },
  { name: 'bring in a backstory', method: 'PUT', url: '/campaigns/{c}/backstory', body: { sections: [SECTION], baseSeq: 0 } },
  { name: 'bring it in on a stale base', method: 'PUT', url: '/campaigns/{c}/backstory', body: { sections: [SECTION], baseSeq: 0 } },
  { name: 'bring in a backstory that is none', method: 'PUT', url: '/campaigns/{c}/backstory', body: { sections: 'x' } },
  { name: 'the backstory', url: '/campaigns/{c}/backstory' },

  { name: 'questions of nothing', url: '/campaigns/{c}/questions' },
  { name: 'ask ben', method: 'PUT', url: `/campaigns/{c}/questions/${Q1}`, body: { to: '{ben}', text: 'How did the night go?' } },
  { name: 'ask somebody there is not', method: 'PUT', url: `/campaigns/{c}/questions/${'30303030-3030-4030-8030-303030303030'}`, body: { to: '{nobody}', text: 'Who are you?' } },
  { name: 'ask without a text', method: 'PUT', url: `/campaigns/{c}/questions/${'30303030-3030-4030-8030-303030303030'}`, body: { to: '{ben}', text: ' ' } },
  { name: 'ask with a name that is no id', method: 'PUT', url: '/campaigns/{c}/questions/nope', body: { to: '{ben}', text: 'x' } },
  { name: 'withdraw the question', method: 'PUT', url: `/campaigns/{c}/questions/${Q1}`, body: { to: '{ben}', text: 'How did the night go?', status: 'withdrawn' } },
  { name: 'the questions', url: '/campaigns/{c}/questions' },
  { name: 'answer a question that is withdrawn', url: `/campaigns/{c}/questions/${Q1}/answer`, body: { noteId: NOTE, text: 'Fine.' } },
];

describe('contract: what the leaders write', () => {
  it('the fake answers as the server does', async () => {
    const s = await startAccounts();
    const kai = await s.user('kai');
    const ben = await s.user('ben');
    for (const [name, display] of [['kai', 'Kai'], ['ben', 'Ben']]) s.db.prepare('UPDATE users SET display_name = ? WHERE username = ?').run(display, name);
    const server = serverSide((r) => s.call(r), kai.session(), { me: kai.id, ben: ben.id, nobody: '77777777-7777-4777-8777-777777777777' }, () => s.clock.advance(1000));
    const fake = fakeSide({ me: { id: 'u1', username: 'kai', displayName: 'Kai' } }, { me: 'u1', ben: 'user-ben', nobody: 'user-nobody' });
    const { found, unused } = await compare(LEADER_STEPS, server, fake);
    expect(found).toEqual([]);
    expect(unused).toEqual([]);
  });
});
