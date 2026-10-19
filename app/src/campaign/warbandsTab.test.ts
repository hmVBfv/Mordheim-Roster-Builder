/* The order of the Warbands tab: the strongest warband first, one without a mark after those that have one, the waiting left out. */
import { describe, expect, it } from 'vitest';
import type { CampaignView, Enrolment } from './api.ts';
import { ranked } from './WarbandsTab.tsx';

const tag = (rating: number): Enrolment['tag'] => ({ id: 't', kind: 'start', rev: 1, round: 0, battleId: null, totals: { rating, spent: 0, models: 0, heroes: 0, gold: 0, fallen: 0 }, createdBy: 'x', createdAt: '' });
const e = (id: string, over: Partial<Enrolment>): Enrolment => ({
  id, warbandId: `w-${id}`, playerId: 'p', player: 'P', status: 'active', fromRound: null, createdAt: '', confirmedAt: null, name: id, wbType: 'mercs', wbName: 'Mercenaries', headRev: 1, updatedAt: '', tag: null, ...over,
});
const view = (enrolments: Enrolment[]): CampaignView => ({ campaign: { id: 'c', name: 'C', round: 0, houseRules: null, createdAt: '', updatedAt: '' }, role: 'player', members: [], enrolments });

describe('ranked', () => {
  it('puts the strongest first, those without a mark after them, and leaves out the waiting', () => {
    const v = view([e('low', { tag: tag(60) }), e('unmarked', {}), e('wait', { status: 'pending', tag: tag(900) }), e('high', { tag: tag(95) }), e('also-unmarked', {})]);
    expect(ranked(v).map((x) => x.id)).toEqual(['high', 'low', 'unmarked', 'also-unmarked']);
  });

  it('keeps the order of the campaign among equals', () => {
    expect(ranked(view([e('a', { tag: tag(70) }), e('b', { tag: tag(70) })])).map((x) => x.id)).toEqual(['a', 'b']);
  });
});
