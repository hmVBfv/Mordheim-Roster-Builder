/* N8: what a place brought is booked – gold into the treasury (or the ledger, with its origin), shards and items into the stash, experience held,
   lasting advantages kept – recorded as finds with their origin, and taken back as a whole. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { Answer, WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

function warband(wb = 'merc', ledger = false): { s: WarbandState; hero: number; leader: number } {
  let s = { ...core.newWarband(data, wb), campaign: { on: true, round: 1, districts: {} } } as WarbandState;
  for (const u of data.WARBANDS[wb]!.units.filter((x) => x.req)) s = core.addUnit(ctx(s), u.id);
  if (ledger) s = core.openLedger(ctx(s));
  const hero = s.models.find((m) => core.isHeroModel(ctx(s), m))!.uid;
  return { s, hero, leader: core.leaderUid(ctx(s)) as number };
}
const rec = (s: WarbandState) => (s.campaign as { postbattle?: Record<string, { finds?: { source: string; kind: string; amount?: number; item?: string }[]; location?: unknown }> }).postbattle?.['1'];
const gold = (s: WarbandState) => core.goldCurrent(ctx(s));
const rollsOf = (...v: Answer[]) => { const rest = [...v]; return (q: core.Question): Answer => (q.kind === 'roll' ? (rest.shift() ?? (q.min as number)) : q.kind === 'pass' ? true : q.options?.[0]?.id ?? 0); };
/** The answers a walk gives, for a place. */
function answersFor(s: WarbandState, key: string, pick: (q: core.Question) => Answer): Record<string, Answer> {
  const a: Record<string, Answer> = {};
  for (let i = 0; i < 40; i++) { const r = core.resolveLocation(ctx(s), key, a); if (r.done) return a; a[r.question!.id] = pick(r.question!); }
  throw new Error('no end');
}

describe('taking a place', () => {
  it('gold goes into the treasury, with its origin in the round’s finds', () => {
    const { s } = warband();
    const before = gold(s);
    const answers = answersFor(s, '6 6', rollsOf(4));
    expect(core.locationProblem(ctx(s), 1, { key: '6 6', answers })).toBeNull();
    const t = core.applyLocation(ctx(s), 1, { key: '6 6', answers });
    expect(gold(t)).toBe(before + 4);
    expect(rec(t)!.finds).toEqual([expect.objectContaining({ id: 1, kind: 'gold', amount: 4, source: 'location:6 6' })]);
  });

  it('with the ledger kept, the gold is a booking that names its origin', () => {
    const { s } = warband('merc', true);
    const t = core.applyLocation(ctx(s), 1, { key: '3 3 3 3', answers: answersFor(s, '3 3 3 3', rollsOf(10)) });
    expect(gold(t)).toBe(gold(s) + 10);
    expect(t.ledger!.at(-1)).toMatchObject({ kind: 'adjust', amount: 10, source: 'location:3 3 3 3' });
    expect(core.ledgerBalance(t)).toBe(gold(t));
  });

  it('shards go into the stash', () => {
    const { s } = warband();
    const t = core.applyLocation(ctx(s), 1, { key: '5 5 5 5 5', answers: answersFor(s, '5 5 5 5 5', rollsOf(2)) });
    expect(t.stash?.wyrd).toBe(2);
  });

  it('items go into the stash as a catalogue item with their origin; one of several is the one picked', () => {
    const { s } = warband();
    const a = answersFor(s, '4 4 4 4', rollsOf(2, 2)); // 1–2: D3 shields or bucklers
    const t = core.applyLocation(ctx(s), 1, { key: '4 4 4 4', answers: a, pick: { 0: 'Buckler' } });
    expect(t.stash!.items).toEqual([expect.objectContaining({ name: 'Buckler', qty: 2, paid: 0, source: 'location:4 4 4 4' })]);
    expect(core.locationProblem(ctx(s), 1, { key: '4 4 4 4', answers: a, pick: { 0: 'Sword' } })).toMatch(/Shield|Buckler|choose/i);
  });

  it('a gem is a stash item with its value', () => {
    const { s } = warband();
    const t = core.applyLocation(ctx(s), 1, { key: '3 3 3 3 3', answers: answersFor(s, '3 3 3 3 3', rollsOf(5)) });
    expect(t.stash!.items).toEqual([expect.objectContaining({ name: 'Necklace', qty: 1, gem: true, value: 50 })]);
  });

  it('experience for the leader is held as the others are', () => {
    const { s, leader } = warband('possessed');
    const t = core.applyLocation(ctx(s), 1, { key: '4 4', answers: answersFor(s, '4 4', rollsOf()) });
    expect((t.campaign!.xp ?? []).filter((x) => !x.applied).map((x) => [x.uid, x.amount])).toEqual([[leader, 1]]);
  });

  it('experience “distributed among the Heroes” is given as the player spreads it, and must add up', () => {
    const { s, hero } = warband('possessed');
    const a = answersFor(s, '3 3 3', rollsOf(3)); // D3 experience
    expect(core.locationProblem(ctx(s), 1, { key: '3 3 3', answers: a, spread: { [hero]: 2 } })).toMatch(/3/);
    const t = core.applyLocation(ctx(s), 1, { key: '3 3 3', answers: a, spread: { [hero]: 3 } });
    expect((t.campaign!.xp ?? []).map((x) => [x.uid, x.amount])).toEqual([[hero, 3]]);
  });

  it('a lasting advantage is kept in the campaign, once if it is unique', () => {
    const { s } = warband();
    const a = answersFor(s, '6 6 6 6 6', rollsOf());
    const t = core.applyLocation(ctx(s), 1, { key: '6 6 6 6 6', answers: a });
    expect((t.campaign as { perks?: unknown[] }).perks).toEqual([expect.objectContaining({ id: 'catacombs-entrance', round: 1, key: '6 6 6 6 6' })]);
    // a second entrance, in a later round, gives no second re-roll
    const t2 = core.applyLocation(ctx({ ...t, campaign: { ...t.campaign, postbattle: {} } } as WarbandState), 2, { key: '6 6 6 6 6', answers: a });
    expect((t2.campaign as { perks?: unknown[] }).perks).toHaveLength(1);
  });

  it('a Hero who swallowed tainted water misses the next game', () => {
    const { s, hero } = warband();
    const a = answersFor(s, '1 1', (q) => (q.kind === 'hero' ? hero : false));
    const t = core.applyLocation(ctx(s), 1, { key: '1 1', answers: a });
    expect(t.models.find((m) => m.uid === hero)!.miss).toBe(1);
  });

  it('a Hero sent to the Pit who is devoured is gone for good', () => {
    const { s, hero } = warband();
    const a = answersFor(s, '1 1 1 1 1 1', (q) => (q.kind === 'hero' ? hero : 1));
    const t = core.applyLocation(ctx(s), 1, { key: '1 1 1 1 1 1', answers: a });
    expect(t.models.some((m) => m.uid === hero)).toBe(false);
    expect(core.undoLocation(ctx(t), 1)).toBe(t); // a death is taken back with the editor’s Undo, not here
  });

  it('one place for each round: a second is refused until the first is taken back', () => {
    const { s } = warband();
    const a = answersFor(s, '6 6', rollsOf(2));
    const t = core.applyLocation(ctx(s), 1, { key: '6 6', answers: a });
    expect(core.locationProblem(ctx(t), 1, { key: '6 6', answers: a })).toMatch(/taken|back/i);
    expect(core.applyLocation(ctx(t), 1, { key: '6 6', answers: a })).toBe(t);
  });

  it('an unfinished place is refused', () => {
    const { s } = warband();
    expect(core.locationProblem(ctx(s), 1, { key: '6 6', answers: {} })).toBeTruthy();
    expect(core.applyLocation(ctx(s), 1, { key: '6 6', answers: {} })).toBe(s);
  });
});

describe('taking a place back', () => {
  it('gold, shards, items, held experience and lasting advantages are as before', () => {
    const { s } = warband();
    for (const [key, ...r] of [['6 6', 5], ['5 5 5 5 5', 3], ['2 2 2', 4, 2], ['6 6 6 6 6']] as [string, ...number[]][]) {
      const t = core.applyLocation(ctx(s), 1, { key, answers: answersFor(s, key, rollsOf(...r)) });
      const back = core.undoLocation(ctx(t), 1);
      expect(gold(back), key).toBe(gold(s));
      expect(back.stash?.wyrd ?? 0, key).toBe(s.stash?.wyrd ?? 0);
      expect(back.stash?.items ?? [], key).toEqual(s.stash?.items ?? []);
      expect((back.campaign as { perks?: unknown[] }).perks ?? [], key).toEqual([]);
      expect(rec(back)?.finds ?? [], key).toEqual([]);
      expect(rec(back)?.location, key).toBeUndefined();
    }
  });

  it('with the ledger, the booking is taken back by a booking that cancels it', () => {
    const { s } = warband('merc', true);
    const t = core.applyLocation(ctx(s), 1, { key: '6 6', answers: answersFor(s, '6 6', rollsOf(6)) });
    const back = core.undoLocation(ctx(t), 1);
    expect(gold(back)).toBe(gold(s));
    expect(core.ledgerBalance(back)).toBe(gold(back));
  });

  it('the miss of a sick Hero is given back', () => {
    const { s, hero } = warband();
    const t = core.applyLocation(ctx(s), 1, { key: '1 1', answers: answersFor(s, '1 1', (q) => (q.kind === 'hero' ? hero : false)) });
    expect(core.undoLocation(ctx(t), 1).models.find((m) => m.uid === hero)!.miss ?? 0).toBe(0);
  });
});
