/* Contract, area 10: the timeline of a campaign – chapters (imported, read, taken out) and the place of a block in the story (server/src/routes-timeline.ts).
   The signed-in user leads it with one battle and a note. Plan P5. */
import { describe, expect, it } from 'vitest';
import { startAccounts } from '../accounts-helpers.ts';
import { gameData, totalsOf } from '../../src/rules.ts';
import { compare, fakeSide, serverSide, type Step } from './driver.ts';

const SAVE = { wb: 'merc', name: 'The Probes', models: [], format: 2 };
const W1 = '11111111-1111-4111-8111-111111111111';
const BATTLE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const N1 = '10101010-1010-4010-8010-101010101010';
const CH1 = '30303030-3030-4030-8030-303030303030';
const CH2 = '40404040-4040-4040-8040-404040404040';
const GONE = '99999999-9999-4999-8999-999999999999';
const LANG = { label: 'Prolog', title: 'Auf Flügeln aus Feuer', icDate: '', place: '', victor: '', text: 'Der Komet fiel.' };
const CHAPTER = { refKey: 'prolog', kind: 'prologue', publishedOn: '2026-06-01', de: LANG, en: null, place: { segment: 'pre', pos: '5' } };

export const TIMELINE_STEPS: Step[] = [
  { name: 'start a campaign', url: '/campaigns', body: { name: 'The Hel Fenn Campaign' }, capture: { c: 'campaign.id' } },
  { name: 'enter a warband', url: '/campaigns/{c}/enrolments', body: { warbandId: W1, data: SAVE }, capture: { e: 'enrolmentId' } },
  { name: 'set up a battle', url: '/campaigns/{c}/battles', body: { id: BATTLE, title: 'The ferry', warbandIds: [W1] } },
  { name: 'a note', method: 'PUT', url: `/campaigns/{c}/notes/${N1}`, body: { text: 'Rain over the Stir.', battleId: BATTLE, turn: 1 } },
  { name: 'the timeline', url: '/campaigns/{c}/timeline' },
  { name: 'import a chapter', method: 'PUT', url: `/campaigns/{c}/chapters/${CH1}`, body: CHAPTER },
  { name: 'import it again', method: 'PUT', url: `/campaigns/{c}/chapters/${CH1}`, body: CHAPTER },
  { name: 'import a second under the same key', method: 'PUT', url: `/campaigns/{c}/chapters/${CH2}`, body: CHAPTER },
  { name: 'import a chapter without a language', method: 'PUT', url: `/campaigns/{c}/chapters/${CH2}`, body: { ...CHAPTER, refKey: 'other', de: null } },
  { name: 'import a chapter without a place', method: 'PUT', url: `/campaigns/{c}/chapters/${CH2}`, body: { ...CHAPTER, refKey: 'other', place: undefined } },
  { name: 'import a chapter of a kind there is not', method: 'PUT', url: `/campaigns/{c}/chapters/${CH2}`, body: { ...CHAPTER, refKey: 'other', kind: 'nonsense' } },
  { name: 'import a chapter with a name that is no id', method: 'PUT', url: '/campaigns/{c}/chapters/nope', body: { ...CHAPTER, refKey: 'other' } },
  { name: 'read the chapter', url: `/campaigns/{c}/chapters/${CH1}` },
  { name: 'read one there is not', url: `/campaigns/{c}/chapters/${GONE}` },
  { name: 'the timeline with a chapter', url: '/campaigns/{c}/timeline' },
  { name: 'move the note', method: 'PUT', url: `/campaigns/{c}/timeline/note/${N1}`, body: { segment: 'pre', pos: '7' } },
  { name: 'move the chapter', method: 'PUT', url: `/campaigns/{c}/timeline/chapter/${CH1}`, body: { segment: 'pre', pos: '3' } },
  { name: 'move a block of a type there is not', method: 'PUT', url: `/campaigns/{c}/timeline/nonsense/${N1}`, body: { segment: 'pre', pos: '7' } },
  { name: 'move a block there is not', method: 'PUT', url: `/campaigns/{c}/timeline/note/${GONE}`, body: { segment: 'pre', pos: '7' } },
  { name: 'move without a place', method: 'PUT', url: `/campaigns/{c}/timeline/note/${N1}`, body: {} },
  { name: 'the timeline after moving', url: '/campaigns/{c}/timeline' },
  { name: 'the timeline as the players read it', url: '/campaigns/{c}/timeline?as=player' },
  { name: 'take the chapter out', method: 'DELETE', url: `/campaigns/{c}/chapters/${CH1}` },
  { name: 'take it out again', method: 'DELETE', url: `/campaigns/{c}/chapters/${CH1}` },
  { name: 'the timeline at the end', url: '/campaigns/{c}/timeline' },
];

describe('contract: the timeline', () => {
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
    const { found, unused } = await compare(TIMELINE_STEPS, server, fake);
    expect(found).toEqual([]);
    expect(unused).toEqual([]);
  });
});
