/* The timeline put together (phase 4a3, part 2): fixed anchors, blocks
   where their battle and time put them – or where they were moved. */
import { describe, expect, it } from 'vitest';
import type { BattleSummary } from '../battle/api.ts';
import type { FullNote, Note } from '../notes/api.ts';
import type { ShownPicture } from '../pictures/api.ts';
import type { TimelineData } from './api.ts';
import { buildTimeline, stepPlace } from './build.ts';
import { between } from './order.ts';

const B1 = '11111111-1111-4111-8111-111111111111', B2 = '22222222-2222-4222-8222-222222222222';
const battle = (id: string, round: number, createdAt: string, closedAt: string | null): BattleSummary => ({ id, round, title: round === 1 ? 'Hel Fenn ferry' : '', status: closedAt ? 'closed' : 'open', turn: 1, warbands: [], createdAt, closedAt });
const BATTLES = [battle(B2, 2, '2026-10-08T19:00:00Z', null), battle(B1, 1, '2026-10-05T19:00:00Z', '2026-10-05T23:00:00Z')];
const note = (id: string, createdAt: string, o: Partial<FullNote> = {}): Note => ({ id, battleId: null, turn: null, kind: 'general', text: id, visibility: 'public', mentions: [], authorId: 'u1', author: 'Kai', lang: '', sealedUntil: null, opened: false, protocolEntryId: null, createdAt, updatedAt: createdAt, edited: false, ...o });
const picture = (id: string, createdAt: string, battleId: string | null, turn: number | null): ShownPicture => ({ id, battleId, turn, uploaderId: 'u1', uploader: 'Kai', mime: 'image/webp', bytes: 1, width: 1, height: 1, caption: id, visibility: 'public', stored: true, createdAt, updatedAt: createdAt });
const EMPTY: TimelineData = { positions: [], entries: [], outcomes: [], marks: [] };

describe('the timeline', () => {
  it('a frame of fixed anchors: before the campaign, each battle before / course / aftermath, the interlude after its round', () => {
    expect(buildTimeline(BATTLES, [], [], EMPTY).map((s) => s.title)).toEqual([
      'Before the campaign',
      'Battle 1 · Hel Fenn ferry · before', 'Battle 1 · Hel Fenn ferry · course', 'Battle 1 · Hel Fenn ferry · aftermath', 'Interlude 1',
      'Battle 2 · before', 'Battle 2 · course', 'Battle 2 · aftermath', 'Interlude 2',
    ]);
  });

  it('blocks never moved stand where their battle and time put them, by turn in the course', () => {
    const data: TimelineData = {
      ...EMPTY,
      entries: [{ id: 'e1', battleId: B1, turn: 4, kind: 'event', payload: { text: 'The ferry burns.' }, author: 'Anna', createdAt: '2026-10-05T20:00:00Z' }],
      marks: [{ id: 't1', warbandId: 'w1', warband: 'The Silver Caravan', kind: 'after_battle', round: 1, battleId: B1, rev: 2, changes: 8, unexplained: 0, createdAt: '2026-10-06T10:00:00Z' }, { id: 't0', warbandId: 'w1', warband: 'The Silver Caravan', kind: 'start', round: 0, battleId: null, rev: 1, changes: 0, unexplained: 0, createdAt: '2026-10-01T10:00:00Z' }],
      outcomes: [{ battleId: B1, warbandId: 'w1', name: 'The Silver Caravan', outcome: 'victory' }],
    };
    const notes = [
      note('prologue', '2026-10-01T12:00:00Z'),
      note('intention', '2026-10-05T19:30:00Z', { battleId: B1, visibility: 'sealed', sealedUntil: B1, opened: true }),
      note('quote-t2', '2026-10-05T21:00:00Z', { battleId: B1, turn: 2, kind: 'quote' }),
      note('after', '2026-10-06T09:00:00Z', { battleId: B1 }),
      note('quiet-days', '2026-10-07T12:00:00Z'),
      note('during-2', '2026-10-08T20:00:00Z'),
    ];
    const segs = buildTimeline(BATTLES, notes, [picture('shot-t3', '2026-10-05T20:30:00Z', B1, 3)], data);
    const ids = Object.fromEntries(segs.map((s) => [s.title, s.blocks.map((b) => b.id)]));
    expect(ids).toMatchObject({
      'Before the campaign': ['prologue'],
      'Battle 1 · Hel Fenn ferry · before': ['intention'],
      'Battle 1 · Hel Fenn ferry · course': ['quote-t2', 'shot-t3', 'e1'],
      'Battle 1 · Hel Fenn ferry · aftermath': ['after'],
      'Interlude 1': ['quiet-days'],
      'Battle 2 · course': ['during-2'],
    });
    expect(segs[0]!.marks.map((m) => m.id)).toEqual(['t0']);
    expect(segs[3]!.marks.map((m) => m.id)).toEqual(['t1']);
    expect(segs[2]!.report).toMatchObject({ battle: { id: B1 }, outcomes: [{ outcome: 'victory' }] });
  });

  it('a moved block stands where it was moved; one step up or down crosses into the next segment at an edge', () => {
    const notes = [note('a', '2026-10-05T20:00:00Z', { battleId: B1 }), note('b', '2026-10-05T20:10:00Z', { battleId: B1 }), note('c', '2026-10-05T20:20:00Z', { battleId: B1 })];
    let data: TimelineData = { ...EMPTY };
    const ids = () => buildTimeline(BATTLES, notes, [], data).filter((s) => s.blocks.length).map((s) => [s.title, s.blocks.map((b) => b.id).join('')]);
    expect(ids()).toEqual([['Battle 1 · Hel Fenn ferry · course', 'abc']]);
    const segs = buildTimeline(BATTLES, notes, [], data);
    // c one up: between a and b
    const up = stepPlace(segs, 'c', -1)!;
    data = { ...data, positions: [{ itemType: 'note', itemId: 'c', segment: up.segment, pos: between(up.before, up.after), movedBy: 'u1', movedAt: '' }] };
    expect(ids()).toEqual([['Battle 1 · Hel Fenn ferry · course', 'acb']]);
    // a one up: over the edge, to the end of the segment before
    const edge = stepPlace(buildTimeline(BATTLES, notes, [], data), 'a', -1)!;
    expect(edge).toEqual({ segment: `b${B1}:before`, before: null, after: null });
    data = { ...data, positions: [...data.positions, { itemType: 'note', itemId: 'a', segment: edge.segment, pos: between(edge.before, edge.after), movedBy: 'u1', movedAt: '' }] };
    expect(ids()).toEqual([['Battle 1 · Hel Fenn ferry · before', 'a'], ['Battle 1 · Hel Fenn ferry · course', 'cb']]);
    // the very first block goes no further up
    expect(stepPlace(buildTimeline([], [note('x', '2026-10-01T00:00:00Z')], [], EMPTY), 'x', -1)).toBeNull();
  });
});
