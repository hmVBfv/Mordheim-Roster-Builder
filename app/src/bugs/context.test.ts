/* What goes along with a report without being written: the house rules, the
   sync, the context built from a screen – and nothing a player typed. */
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db.ts';
import { campaignKey } from '../campaign/api.ts';
import { data, sampleSave } from '../test/data.ts';
import { buildContext, ruleSummary, syncLine } from './context.ts';
import { takeSnapshot, warbandCopy } from './snapshot.ts';
import { note, resetTrail } from './trail.ts';

beforeEach(async () => { await db.warbands.clear(); await db.meta.clear(); resetTrail(); });

describe('the house rules that go along', () => {
  it('only the ones that differ from the defaults, as plain values, and never the notes', () => {
    expect(ruleSummary(undefined)).toEqual({});
    expect(ruleSummary({ heroes: 7, priceAll: 90, freeDagger: true, notes: 'SECRET house notes' })).toEqual({ heroes: 7, priceAll: 90, freeDagger: true });
    expect(ruleSummary({ hsGrades: { '1a': true, '1b': false, '1c': true, '2a': true } })).toEqual({ hsGrades: '{"1a":true,"1b":false,"1c":true,"2a":true}' });
    expect(ruleSummary({ startGold: 'x'.repeat(200) }).startGold).toHaveLength(80);
  });

  it('is null where there is no warband or campaign in view – and empty where all is as the rules say', () => {
    const base = { pathname: '/account', steps: [], settings: { theme: 'chronicle', flavour: 'campaign', online: true, sync: 'off', role: null, viewport: '360×740', installed: false }, warbandHouse: undefined, campaignHouse: null };
    expect(buildContext({ ...base, hasWarband: false, hasCampaign: false }).houseRules).toEqual({ warband: null, campaign: null });
    expect(buildContext({ ...base, pathname: '/warbands/abc/house', hasWarband: true, hasCampaign: false }).houseRules).toEqual({ warband: {}, campaign: null });
    expect(buildContext({ ...base, pathname: '/warbands/abc/house', hasWarband: true, hasCampaign: false }).screen).toBe('/warbands/:id/house');
  });
});

describe('the sync as one line', () => {
  it('says the state and what waits', () => {
    expect(syncLine({ state: 'off' })).toBe('off');
    expect(syncLine({ state: 'idle', waiting: 2, conflicts: 0, at: 'x' })).toBe('idle, 2 waiting, 0 in conflict');
    expect(syncLine({ state: 'error', waiting: 1, conflicts: 0, message: 'x'.repeat(200) })).toBe(`error, 1 waiting, 0 in conflict: ${'x'.repeat(60)}`);
  });
});

describe('the snapshot at the moment of reporting', () => {
  it('reads the warband and the campaign in view and carries no name, note or title', async () => {
    const state = { ...sampleSave(), name: 'SECRET-NAME warband', house: { heroes: 7, notes: 'SECRET-NOTES' } };
    await db.warbands.add({ id: 'w-1', name: state.name as string, wb: state.wb as string, wbName: 'x', state, format: 2, createdAt: '2026-10-17T10:00:00.000Z', updatedAt: '2026-10-17T10:00:00.000Z', serverRev: 4 });
    note('screen', '/warbands/:id');
    const snap = await takeSnapshot('/warbands/w-1/trade', new Date('2026-10-17T12:00:00Z'));
    expect(snap.context.screen).toBe('/warbands/:id/trade');
    expect(snap.context.houseRules).toEqual({ warband: { heroes: 7 }, campaign: null });
    expect(snap.context.steps.map((s) => s.what)).toEqual(['/warbands/:id']);
    // the warband in view may be offered for attaching; its name is shown to its owner, never put in the context
    expect(snap.warband).toMatchObject({ id: 'w-1', name: 'SECRET-NAME warband', rev: 4 });
    expect(JSON.stringify({ context: snap.context, errors: snap.errors, device: snap.device })).not.toMatch(/SECRET/);
  });

  it('takes the role and the house rules of the campaign from what this device last saw of it', async () => {
    await db.meta.put({ key: campaignKey('c-1'), value: { role: 'leader', campaign: { houseRules: { rerollOne: true, notes: 'SECRET' } } } });
    const snap = await takeSnapshot('/campaign/c-1/world');
    expect(snap.context.settings.role).toBe('leader');
    expect(snap.context.houseRules).toEqual({ warband: null, campaign: { rerollOne: true } });
    expect(snap.warband).toBeNull();
  });

  it('is fine where there is nothing in view', async () => {
    const snap = await takeSnapshot('/account');
    expect(snap.context.houseRules).toEqual({ warband: null, campaign: null });
    expect(snap.context.settings).toMatchObject({ flavour: 'campaign', online: true });
    expect(snap.warband).toBeNull();
  });

  it('copies the warband as the save the app writes, for a report that attaches it', async () => {
    const state = sampleSave();
    await db.warbands.add({ id: 'w-2', name: 'x', wb: state.wb as string, wbName: 'x', state, format: 2, createdAt: '2026-10-17T10:00:00.000Z', updatedAt: '2026-10-17T10:00:00.000Z' });
    const copy = await warbandCopy('w-2');
    expect(copy).toMatchObject({ warbandId: 'w-2', rev: null });
    expect(copy!.save).toMatchObject({ wb: state.wb, name: 'The Silver Caravan' });
    expect(await warbandCopy('missing')).toBeNull();
    void data;
  });
});
