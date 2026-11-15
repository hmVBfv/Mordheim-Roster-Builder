/* Plan P7: the rating of every warband of a campaign over its marks, for every member; a warband that left keeps the name it had. */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { campaignRatings, confirmEnrolment, createCampaign, endEnrolment, enrol, setMember } from '../src/campaigns.ts';
import { addVersion, warbandById } from '../src/warbands.ts';
import { startAccounts } from './accounts-helpers.ts';

const save = (name: string) => ({ wb: 'merc', name, models: [], format: 2 });

describe('ratings of a campaign', () => {
  it('lists each warband with the rating of its marks, in order, and the name it had when it left', async () => {
    const s = await startAccounts();
    const kai = await s.user('kai');
    const ben = await s.user('ben');
    const t0 = s.clock.now();
    const c = createCampaign(s.db, { name: 'The Hel Fenn Campaign', by: kai.id }, t0);
    setMember(s.db, c.id, ben.id, 'player', kai.id, t0);
    const make = (owner: string, name: string) => {
      const id = randomUUID();
      const e = enrol(s.db, { campaign: c, playerId: owner, warbandId: id, data: save(name), json: JSON.stringify(save(name)), copiedFrom: null, appVersion: '' }, t0).enrolment;
      expect(confirmEnrolment(s.db, c, e, kai.id, t0).ok).toBe(true);
      return { id, e };
    };
    const a = make(kai.id, 'The Grey Penitents');
    const b = make(ben.id, 'Clan Skrittle');
    const r = campaignRatings(s.db, c.id);
    expect(r.map((w) => [w.name, w.active, w.points.map((p) => [p.kind, p.round])])).toEqual([['Clan Skrittle', true, [['start', 0]]], ['The Grey Penitents', true, [['start', 0]]]]);
    expect(typeof r[0]!.points[0]!.rating).toBe('number');

    // one leaves and is renamed by its owner: the campaign still names it as it was
    endEnrolment(s.db, s.db.prepare('SELECT * FROM enrolments WHERE id = ?').get(b.e.id) as typeof b.e, 'left', ben.id, t0);
    const w = warbandById(s.db, b.id)!;
    addVersion(s.db, { id: b.id, userId: ben.id, baseRev: w.head_rev, data: save('A Private Name'), json: JSON.stringify(save('A Private Name')), source: 'save', note: '', appVersion: '' }, t0);
    const after = campaignRatings(s.db, c.id);
    expect(after.map((x) => [x.name, x.active])).toEqual([['Clan Skrittle', false], ['The Grey Penitents', true]]);
    expect(a.id).toBeTruthy();
  });
});
