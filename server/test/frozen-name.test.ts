/* Security review AUTHZ-6: a warband that has left a campaign is shown there under the name it had when it left – what its owner calls it
   afterwards is theirs, not the campaign's. */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createBattle, battleView, listBattles } from '../src/battles.ts';
import { confirmEnrolment, createCampaign, endEnrolment, enrol } from '../src/campaigns.ts';
import { campaignMarks, campaignOutcomes } from '../src/timeline.ts';
import { addVersion, warbandById } from '../src/warbands.ts';
import { startAccounts } from './accounts-helpers.ts';

const save = (name: string) => ({ wb: 'merc', name, models: [], format: 2 });

describe('a warband that left a campaign', () => {
  it('stays in its battles, outcomes and marks under the name it had when it left, whatever it is called later', async () => {
    const s = await startAccounts();
    const kai = await s.user('kai');
    const t0 = s.clock.now();
    const c = createCampaign(s.db, { name: 'The Hel Fenn Campaign', by: kai.id }, t0);
    const id = randomUUID();
    const e = enrol(s.db, { campaign: c, playerId: kai.id, warbandId: id, data: save('The Grey Penitents'), json: JSON.stringify(save('The Grey Penitents')), copiedFrom: null, appVersion: '' }, t0).enrolment;
    expect(confirmEnrolment(s.db, c, e, kai.id, t0).ok).toBe(true);
    const b = createBattle(s.db, { id: randomUUID(), campaignId: c.id, round: 1, title: 'The ferry', scenario: '', district: '', warbandIds: [id], by: kai.id }, t0);
    const names = () => ({
      list: listBattles(s.db, c.id)[0]!.warbands,
      view: battleView(s.db, b).participants.map((p) => p.name),
      outcomes: campaignOutcomes(s.db, c.id).map((o) => o.name),
      marks: campaignMarks(s.db, c.id).map((m) => m.warband),
    });
    expect(names()).toEqual({ list: ['The Grey Penitents'], view: ['The Grey Penitents'], outcomes: ['The Grey Penitents'], marks: ['The Grey Penitents'] });

    // it leaves, and its owner renames it afterwards
    endEnrolment(s.db, warbandOf(e), 'left', kai.id, t0);
    const w = warbandById(s.db, id)!;
    const r = addVersion(s.db, { id, userId: kai.id, baseRev: w.head_rev, data: save('A Private Name'), json: JSON.stringify(save('A Private Name')), source: 'save', note: '', appVersion: '' }, t0);
    expect(r.ok).toBe(true);
    expect(warbandById(s.db, id)!.name).toBe('A Private Name');

    expect(names()).toEqual({ list: ['The Grey Penitents'], view: ['The Grey Penitents'], outcomes: ['The Grey Penitents'], marks: ['The Grey Penitents'] });
    function warbandOf(x: typeof e) { return s.db.prepare('SELECT * FROM enrolments WHERE id = ?').get(x.id) as typeof e; }
  });

  it('while it is in the campaign a new name shows at once', async () => {
    const s = await startAccounts();
    const kai = await s.user('kai');
    const t0 = s.clock.now();
    const c = createCampaign(s.db, { name: 'The Hel Fenn Campaign', by: kai.id }, t0);
    const id = randomUUID();
    const e = enrol(s.db, { campaign: c, playerId: kai.id, warbandId: id, data: save('Old'), json: JSON.stringify(save('Old')), copiedFrom: null, appVersion: '' }, t0).enrolment;
    confirmEnrolment(s.db, c, e, kai.id, t0);
    createBattle(s.db, { id: randomUUID(), campaignId: c.id, round: 1, title: 'x', scenario: '', district: '', warbandIds: [id], by: kai.id }, t0);
    const w = warbandById(s.db, id)!;
    addVersion(s.db, { id, userId: kai.id, baseRev: w.head_rev, data: save('New'), json: JSON.stringify(save('New')), source: 'save', note: '', appVersion: '' }, t0);
    expect(listBattles(s.db, c.id)[0]!.warbands).toEqual(['New']);
  });
});
