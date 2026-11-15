/* Plan P14, stage 1: the numbers of every mark for a statistics chart, for every member; frozen in the tag on the first read, with the name a
   warband that left had. */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { campaignStatistics, confirmEnrolment, createCampaign, endEnrolment, enrol, setMember } from '../src/campaigns.ts';
import { addVersion, warbandById } from '../src/warbands.ts';
import { startAccounts } from './accounts-helpers.ts';

const save = (name: string, exp = 0) => ({ wb: 'merc', name, models: [{ uid: 1, uid_def: 'capt', exp, qty: 1, eq: {}, adv: {}, skills: [], inj: [], spells: [], mut: [] }], format: 2 });

describe('statistics of a campaign', () => {
  it('lists each warband with the numbers of its marks, frozen on the first read', async () => {
    const s = await startAccounts();
    const kai = await s.user('kai');
    const ben = await s.user('ben');
    const t0 = s.clock.now();
    const c = createCampaign(s.db, { name: 'The Hel Fenn Campaign', by: kai.id }, t0);
    setMember(s.db, c.id, ben.id, 'player', kai.id, t0);
    const make = (owner: string, name: string, exp: number) => {
      const id = randomUUID();
      const e = enrol(s.db, { campaign: c, playerId: owner, warbandId: id, data: save(name, exp), json: JSON.stringify(save(name, exp)), copiedFrom: null, appVersion: '' }, t0).enrolment;
      expect(confirmEnrolment(s.db, c, e, kai.id, t0).ok).toBe(true);
      return { id, e };
    };
    const a = make(kai.id, 'The Grey Penitents', 12);
    const b = make(ben.id, 'Clan Skrittle', 3);
    expect(s.db.prepare('SELECT count(*) FROM tags WHERE metrics IS NOT NULL').pluck().get()).toBe(0);
    const r = campaignStatistics(s.db, c.id);
    expect(r.map((w) => [w.name, w.active, w.points.map((p) => [p.kind, p.round])])).toEqual([['Clan Skrittle', true, [['start', 0]]], ['The Grey Penitents', true, [['start', 0]]]]);
    const m = r[1]!.points[0]!.metrics;
    expect(m).toMatchObject({ exp: 12, heroExp: 12, income: 0, wyrd: 0, lost: 0 });
    for (const k of ['value', 'gold', 'wealth', 'stash', 'incomeWyrd', 'incomeLocations', 'upkeepPaid', 'lootValue']) expect(typeof m[k], k).toBe('number');
    // frozen in the tag: the same numbers again, and now stored
    expect(s.db.prepare('SELECT count(*) FROM tags WHERE metrics IS NOT NULL').pluck().get()).toBe(2);
    expect(campaignStatistics(s.db, c.id)).toEqual(r);

    // a warband saved again does not move the numbers of its mark; one that left keeps the name it had
    endEnrolment(s.db, s.db.prepare('SELECT * FROM enrolments WHERE id = ?').get(b.e.id) as typeof b.e, 'left', ben.id, t0);
    const w = warbandById(s.db, b.id)!;
    addVersion(s.db, { id: b.id, userId: ben.id, baseRev: w.head_rev, data: save('A Private Name', 40), json: JSON.stringify(save('A Private Name', 40)), source: 'save', note: '', appVersion: '' }, t0);
    const after = campaignStatistics(s.db, c.id);
    expect(after.map((x) => [x.name, x.active])).toEqual([['Clan Skrittle', false], ['The Grey Penitents', true]]);
    expect(after[0]!.points[0]!.metrics.exp).toBe(3);
    expect(a.id).toBeTruthy();
  });

  it('is empty for a campaign nobody entered', async () => {
    const s = await startAccounts();
    const kai = await s.user('kai');
    const c = createCampaign(s.db, { name: 'Empty', by: kai.id }, s.clock.now());
    expect(campaignStatistics(s.db, c.id)).toEqual([]);
  });
});
