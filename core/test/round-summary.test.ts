/* N13: the balance of a post-battle round, computed from the save alone: injuries, experience, exploration, income by source, spending, finds
   with their worth, and rating, gold and models before and after. Pure, so the server can freeze it with the mark (ADR 0003). */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

function base(): { s: WarbandState; hero: number } {
  let s = { ...core.newWarband(data, 'merc'), campaign: { on: true, round: 1, districts: {} } } as WarbandState;
  for (const u of data.WARBANDS.merc!.units.filter((x) => x.req)) s = core.addUnit(ctx(s), u.id);
  s = core.openLedger(ctx(s));
  return { s, hero: s.models.find((m) => core.isHeroModel(ctx(s), m))!.uid };
}

describe('the balance of a round', () => {
  it('is empty for a round nothing happened in', () => {
    const { s } = base();
    const r = core.postBattleSummary(ctx(s), 1);
    expect(r).toMatchObject({
      round: 1, injuries: { total: 0 }, exploration: null, income: { total: 0 }, spending: { total: 0 }, finds: [], lootValue: 0, wyrd: { found: 0, sold: 0, held: 0 },
    });
  });

  it('reads exploration, a place, the sale of wyrdstone and the upkeep as income and spending by source', () => {
    let { s } = base();
    s = { ...s, hired: [{ key: 'elfranger', uid: 'hs0' }] } as WarbandState;
    s = core.recordExploration(ctx(s), 1, { rolled: [6, 6, 6, 6], by: 'entered' }); // 24: four shards; four 6s: Catacombs
    s = core.sellWyrdstone(ctx(s), 1, 3);
    const sale = (s.campaign as { postbattle: Record<string, { wyrd: { gc: number } }> }).postbattle['1']!.wyrd.gc;
    s = core.payUpkeep(ctx(s), 1, ['hs0']);
    const up = core.hsUpkeepFor(ctx(s), 'elfranger');
    const r = core.postBattleSummary(ctx(s), 1);
    expect(r.exploration).toMatchObject({ total: 24, shards: 4, location: '6 6 6 6', by: 'entered', dice: 4 });
    expect(r.wyrd).toEqual({ found: 4, sold: 3, held: 1 });
    expect(r.income).toMatchObject({ wyrdstone: sale, total: sale });
    expect(r.spending).toMatchObject({ upkeep: up, total: up });
  });

  it('a place’s gold is income from locations, and what it brings is listed with its worth', () => {
    const answers: Record<string, core.Answer> = {};
    for (let i = 0; i < 6; i++) { const q = core.resolveLocation(ctx(base().s), '5 5 5', answers); if (q.done) break; answers[q.question!.id] = q.question!.min as number; }
    const t = core.applyLocation(ctx(base().s), 1, { key: '5 5 5', answers });
    const r = core.postBattleSummary(ctx(t), 1);
    expect(r.income.locations).toBeGreaterThan(0);
    expect(r.income.total).toBe(r.income.locations);
    expect(r.finds.every((f) => f.source === 'location:5 5 5')).toBe(true);
  });

  it('injuries: what was rolled this round', () => {
    const b = base();
    const s = core.addCasualty(ctx(b.s), { victim: { uid: b.hero, name: 'Hero', wb: 'merc' }, attacker: { name: 'Enemy' } });
    expect(core.postBattleSummary(ctx(s), 1).injuries).toMatchObject({ total: 1, pending: 1, dead: 0 });
  });

  it('experience: the points held and written this round', () => {
    const b = base();
    const hero = b.hero;
    const s = core.grantXp(ctx(b.s), hero, 3, 'survived', 1);
    expect(core.postBattleSummary(ctx(s), 1).experience).toMatchObject({ points: 3 });
  });

  it('buying: the round’s bookings of kinds buy and search count as spending', () => {
    let { s } = base();
    s = core.bookGold(ctx(s), -30, { text: 'Bought' }, 'buy');
    s = core.bookGold(ctx(s), -10, { text: 'Searched', item: 'x' }, 'search');
    expect(core.postBattleSummary(ctx(s), 1).spending).toMatchObject({ buys: 30, searches: 10, total: 40 });
  });

  it('before and after: rating, gold and models from the stage snapshot and the save', () => {
    const { s } = base();
    const withSnap = { ...s, campaign: { ...s.campaign, snapshots: { 0: { round: 0, at: 'x', state: s, totals: { rating: 100, spent: 300, models: 2, heroes: 1, gold: 200, fallen: 0 } } } } } as WarbandState;
    const r = core.postBattleSummary(ctx(withSnap), 1);
    expect(r.before).toMatchObject({ rating: 100, gold: 200, models: 2 });
    expect(r.after).toMatchObject({ rating: core.totalRating(ctx(withSnap)), gold: core.goldCurrent(ctx(withSnap)), models: core.totalModels(ctx(withSnap)) });
    expect(core.postBattleSummary(ctx(s), 1).before).toBeNull();
  });
});
