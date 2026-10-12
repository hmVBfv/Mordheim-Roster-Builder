/* What waits for a player (phase 4b3a), as a pure function of what the screens have. */
import { describe, expect, it } from 'vitest';
import type { CampaignView } from '../campaign/api.ts';
import type { Question } from '../questions/api.ts';
import { openItems } from './items.ts';

const ME = 'user-kai';
function view(o: { role?: CampaignView['role']; round?: number; battles?: CampaignView['battles'] } = {}): CampaignView {
  return {
    campaign: { id: 'c1', name: 'Hel Fenn', round: o.round ?? 1, houseRules: {}, createdAt: '', updatedAt: '' },
    role: o.role ?? 'player',
    members: [],
    enrolments: [{ id: 'e1', warbandId: 'w1', playerId: ME, player: 'Kai', status: 'active', fromRound: null, createdAt: '', confirmedAt: '', name: 'The Silver Caravan', wbType: 'reikland', wbName: 'Reiklanders', headRev: 1, updatedAt: '', tag: null }],
    battles: o.battles ?? [],
  };
}
const local = (round: number, interludes: Record<string, string> = {}) => [{ id: 'w1', name: 'The Silver Caravan', state: { campaign: { round }, story: { prologue: '', interludes, explain: {} } } as never }];
const q = (o: Partial<Question>): Question => ({
  id: 'q1', battleId: null, askedBy: 'user-anna', askedByName: 'Anna', to: ME, toName: 'Kai', text: 'Where were you?', status: 'open', answerNoteId: null, createdAt: '', updatedAt: '', answeredAt: null, seq: 1, ...o,
});

describe('openItems', () => {
  it('lists a question asked of the player, once open – not an answered, withdrawn or someone else’s', () => {
    const items = openItems(view({ round: 0 }), ME, [q({}), q({ id: 'q2', status: 'answered' }), q({ id: 'q3', status: 'withdrawn' }), q({ id: 'q4', to: 'user-ben' })], []);
    expect(items.map((i) => [i.key, i.title, i.chip])).toEqual([['question:q1', 'Question from Anna', 'to answer']]);
  });

  it('shortens a long question to a line', () => {
    const [item] = openItems(view({ round: 0 }), ME, [q({ text: `${'word '.repeat(60)}\n\nend` })], []);
    expect(item!.detail.length).toBeLessThanOrEqual(90);
    expect(item!.detail.endsWith('…')).toBe(true);
    expect(item!.detail).not.toContain('\n');
  });

  it('asks for the interlude of the latest round once the warband has played it and nothing is written', () => {
    const items = openItems(view({ round: 2 }), ME, [], local(2, { '1': 'Trade in the Docks.' }));
    expect(items.map((i) => [i.title, i.to, i.chip])).toEqual([['Interlude 2', '/warbands/w1/story', 'to write']]);
  });

  it('asks for no interlude that is written, that is not played yet, or before the first battle', () => {
    expect(openItems(view({ round: 2 }), ME, [], local(2, { '2': 'Trade in the Docks.' }))).toEqual([]);
    expect(openItems(view({ round: 2 }), ME, [], local(1))).toEqual([]);
    expect(openItems(view({ round: 0 }), ME, [], local(0))).toEqual([]);
    expect(openItems(view({ round: 2 }), ME, [], local(2, { '2': '   ' }))).toHaveLength(1); // blanks are no words
    expect(openItems(view({ round: 2 }), ME, [], [])).toEqual([]); // not on this device
  });

  it('shows a viewer nothing', () => {
    expect(openItems(view({ role: 'viewer' }), ME, [q({})], local(2))).toEqual([]);
  });

  it('puts questions before aftermaths before interludes', () => {
    const battles = [{ id: 'b1', round: 1, title: 'Ferry', status: 'closed', warbands: [], warbandIds: ['w1'], marked: [], takenOver: false }] as unknown as CampaignView['battles'];
    const items = openItems(view({ round: 1, battles }), ME, [q({})], local(1));
    expect(items.map((i) => i.chip)).toEqual(['to answer', 'to mark', 'to write']);
  });
});
