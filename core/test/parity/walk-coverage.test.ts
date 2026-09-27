/* Coverage of the action walk, and core-only action behaviour.
 *
 * The walks are replayed with core alone — the steps depend only on the core
 * state, so the sequences are the ones the parity files check against the
 * legacy app. Parity only means something if those sequences exercise the
 * actions: each must have changed a state a minimum number of times. */
import { describe, expect, it } from 'vitest';
import * as core from '../../src/index.ts';
import type { WarbandState } from '../../src/index.ts';
import { ACTIONS, data, effective, fixtureWalks, freshWalks, runSequence, useLegacy } from './walk.ts';

describe('action coverage', () => {
  it('every action changed a state often enough', () => {
    useLegacy(null);
    for (const w of [...freshWalks(), ...fixtureWalks()]) runSequence(w.label, w.start, w.seed, false);
    const minimum = 10;
    const low = ACTIONS.filter((a) => (effective.get(a) ?? 0) < minimum).map((a) => `${a}: ${effective.get(a) ?? 0}`);
    expect(low).toEqual([]);
  });
});

describe('roster actions without a legacy counterpart', () => {
  it('setWarbandName renames the warband', () => {
    const s = core.newWarband(data, 'merc');
    expect(core.setWarbandName(core.ctxOf(data, s), 'Die Silberne Karavane').name).toBe('Die Silberne Karavane');
  });

  it('never reuses a model uid after a removal', () => {
    let s = core.newWarband(data, 'merc');
    const ctx = () => core.ctxOf(data, s);
    s = core.addUnit(ctx(), 'capt');
    s = core.addUnit(ctx(), 'champ');
    const second = s.models[1]?.uid as number;
    s = core.removeUnit(ctx(), second);
    s = core.addUnit(ctx(), 'champ');
    expect(s.models.map((m) => m.uid)).not.toContain(undefined);
    expect(s.models[1]?.uid).toBeGreaterThan(second);
  });

  it('never reuses a chronicle id after a deletion', () => {
    let s: WarbandState = { ...core.newWarband(data, 'merc'), campaign: { on: true, districts: {} } };
    const ctx = () => core.ctxOf(data, s);
    s = core.addUnit(ctx(), 'capt');
    s = core.addUnit(ctx(), 'champ');
    const ids = (s.campaign?.log ?? []).map((e) => e.id);
    s = { ...s, campaign: { ...s.campaign, log: (s.campaign?.log ?? []).slice(0, 1) } };
    s = core.addUnit(ctx(), 'champ');
    const last = (s.campaign?.log ?? []).at(-1)?.id as number;
    expect(last).toBeGreaterThan(Math.max(...ids));
  });

  it('actions return new states and leave the input untouched', () => {
    const s = Object.freeze(core.newWarband(data, 'merc')) as WarbandState;
    const next = core.addUnit(core.ctxOf(data, s), 'capt');
    expect(next).not.toBe(s);
    expect(s.models).toHaveLength(0);
    expect(next.models).toHaveLength(1);
  });

  it('a refused action returns the very same state', () => {
    const s = core.newWarband(data, 'merc');
    expect(core.addUnit(core.ctxOf(data, s), 'no-such-unit')).toBe(s);
    expect(core.hireHS(core.ctxOf(data, s), 'no-such-hs')).toBe(s);
  });
});


describe('casualty actions without a legacy counterpart', () => {
  it('never hands out a casualty or experience id again, even in a save without logSeq', () => {
    // A legacy save: the casualty's chronicle entry was deleted by hand, so
    // the highest id left is the casualty's (legacy would reuse it).
    let s: WarbandState = { ...core.newWarband(data, 'merc'), campaign: { on: true, districts: {} } };
    const ctx = () => core.ctxOf(data, s);
    s = core.addUnit(ctx(), 'capt');
    s = core.addCasualty(ctx(), { victim: { name: 'Clanrat', wb: 'skaven' }, attacker: { uid: s.models[0]!.uid, name: 'Captain' } });
    const camp = s.campaign!;
    const taken = [...(camp.casualties ?? []).map((r) => r.id), ...(camp.xp ?? []).map((x) => x.id)];
    s = { ...s, campaign: { ...camp, log: [], logSeq: undefined } };
    s = core.addCasualty(ctx(), { victim: { name: 'Clanrat', wb: 'skaven' } });
    expect((s.campaign?.casualties ?? []).at(-1)!.id).toBeGreaterThan(Math.max(...taken));
  });

  it('asks nothing: the answers to the chart\'s questions are arguments', () => {
    let s: WarbandState = core.newWarband(data, 'merc');
    const ctx = () => core.ctxOf(data, s);
    s = core.addUnit(ctx(), 'capt');
    s = core.stashSet(ctx(), 'gold', 300);
    const uid = s.models[0]!.uid;
    const ransomed = core.addInjury(ctx(), uid, '61', { captiveReturns: true, ransom: 40 });
    expect(ransomed.stash?.gold).toBe(260);
    const lost = core.addInjury(ctx(), uid, '61', { captiveReturns: false });
    expect(lost.models).toHaveLength(0);
    expect(lost.fallen?.[0]?.kind).toBe('hero');
    expect(core.addInjury(ctx(), uid, '35', { deepWoundGames: 3 }).models[0]!.miss).toBe(3);
    expect(core.addInjury(ctx(), uid, 'no-such-code')).toBe(s);
  });
});
