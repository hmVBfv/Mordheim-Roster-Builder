/* core/changes: comparing two states of a warband and matching every change
   with its cause. New logic, so it is tested on its own terms: small stories
   told with core's actions, then invariants over random walks. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { Change, WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';
import { freshWalks, randomStep, useLegacy } from './parity/walk.ts';
import { rng } from './support/random.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

function start(): WarbandState {
  let s: WarbandState = { ...core.newWarband(data, 'merc'), name: 'Silver Caravan', campaign: { on: true, districts: {} } };
  for (const u of ['capt', 'champ', 'warr']) s = core.addUnit(ctx(s), u);
  s = core.setQty(ctx(s), s.models[2]!.uid, 3);
  return s;
}

/** The changes from `a` to `b`, matched with what `b` recorded since `a`. */
function changes(a: WarbandState, b: WarbandState): core.ReconciledChange[] {
  const since = (xs: { id: number }[] | undefined, ys: { id: number }[] | undefined) => (ys ?? []).filter((y) => !(xs ?? []).some((x) => x.id === y.id));
  return core.reconcile(core.diffWarbands(data, a, b, 1), {
    log: since(a.campaign?.log, b.campaign?.log) as core.LogEntry[],
    casualties: since(a.campaign?.casualties, b.campaign?.casualties) as core.Casualty[],
  });
}
const kinds = (cs: Change[]) => cs.map((c) => c.kind);
const one = (cs: core.ReconciledChange[], kind: string) => { const c = cs.filter((x) => x.kind === kind); expect(c, kind).toHaveLength(1); return c[0]!; };

describe('diffWarbands and reconcile', () => {
  it('finds nothing between a state and itself', () => {
    const s = start();
    expect(core.diffWarbands(data, s, s, 1)).toEqual([]);
  });

  it('a recruit, with the recruit event behind it', () => {
    const a = start(), b = core.addUnit(ctx(a), 'mark');
    const c = one(changes(a, b), 'recruited');
    expect(c).toMatchObject({ uid: b.models[3]!.uid, payload: { uid_def: 'mark', grade: 'hench' }, unexplained: false });
    expect(c.eventRef).toMatch(/^evt:/);
    expect(c.changeKey).toBe(`1:${b.models[3]!.uid}:recruited:mark`);
    expect(kinds(changes(a, b))).toEqual(expect.arrayContaining(['gold', 'rating', 'worth']));
  });

  it('an advance is explained; the same value typed in is not', () => {
    const a = core.setModelExp(ctx(start()), start().models[1]!.uid, 12);
    const uid = a.models[1]!.uid;
    const rolled = core.addAdvance(ctx(a), uid, 'WS');
    expect(one(changes(a, rolled), 'stat')).toMatchObject({ payload: { stat: 'WS', before: 0, after: 1 }, unexplained: false, changeKey: `1:${uid}:stat:WS` });
    const typed = { ...a, models: a.models.map((m) => (m.uid === uid ? { ...m, adv: { WS: 1 } } : m)) };
    expect(one(changes(a, typed), 'stat')).toMatchObject({ unexplained: true, eventRef: null });
  });

  it('two points in one stat need two advances', () => {
    const a = start(), uid = a.models[0]!.uid;
    const once = core.addAdvance(ctx(a), uid, 'S');
    const twice = { ...once, models: once.models.map((m) => (m.uid === uid ? { ...m, adv: { S: 2 } } : m)) };
    expect(one(changes(a, twice), 'stat').unexplained).toBe(true);
    expect(one(changes(a, core.addAdvance(ctx(once), uid, 'S')), 'stat').unexplained).toBe(false);
  });

  it('a crafted gain of 1e15 (or Infinity) is unexplained at once – it never loops point by point (security review INPUT-1)', () => {
    const a = start(), uid = a.models[0]!.uid;
    const once = core.addAdvance(ctx(a), uid, 'S');
    for (const gain of [1e15, 'Infinity']) {
      const huge = { ...once, models: once.models.map((m) => (m.uid === uid ? { ...m, adv: { S: gain } } : m)) } as WarbandState;
      const t = performance.now();
      expect(one(changes(a, huge), 'stat')).toMatchObject({ unexplained: true, eventRef: null });
      expect(performance.now() - t).toBeLessThan(1000);
    }
  });

  it('skills: learned by advance, repeated, and taken away', () => {
    const a = start(), uid = a.models[0]!.uid;
    const b = core.addSkillFromList(ctx(a), uid, 'Strike to Injure');
    expect(one(changes(a, b), 'skill')).toMatchObject({ payload: { skill: 'Strike to Injure', added: true }, unexplained: false });
    const c = core.addSkill(ctx(b), uid, 'Strike to Injure');
    expect(one(changes(b, c), 'skill').changeKey).toBe(`1:${uid}:skill:Strike to Injure#2`);
    const d = core.removeSkill(ctx(b), uid, 0);
    expect(one(changes(b, d), 'skill')).toMatchObject({ changeKey: `1:${uid}:skill:-Strike to Injure`, payload: { added: false }, unexplained: true });
  });

  it('a Hero dies: one death, tied to its casualty record, and no "released"', () => {
    const a = start(), uid = a.models[1]!.uid;
    const b = core.killHero(ctx(a), uid);
    const cs = changes(a, b);
    expect(kinds(cs)).not.toContain('released');
    expect(one(cs, 'died')).toMatchObject({ uid, payload: { hero: true }, unexplained: false });
    expect(one(cs, 'died').eventRef).toMatch(/^cas:/);
  });

  it('a henchman dies: the smaller group is explained by the death', () => {
    const a = start(), uid = a.models[2]!.uid;
    const b = core.killHenchMember(ctx(a), uid, 1);
    const cs = changes(a, b);
    expect(one(cs, 'died')).toMatchObject({ uid, payload: { hero: false, memberIdx: 1 } });
    expect(one(cs, 'group_size')).toMatchObject({ payload: { before: 3, after: 2 }, unexplained: false });
  });

  it('The Lad\'s Got Talent is a promotion, not a recruit', () => {
    const a = start(), uid = a.models[2]!.uid;
    const b = core.promoteHench(ctx(a), uid, 0);
    const cs = changes(a, b);
    expect(kinds(cs)).not.toContain('recruited');
    expect(one(cs, 'promoted')).toMatchObject({ payload: { fromUid: uid }, unexplained: false });
    expect(one(cs, 'group_size').unexplained).toBe(false);
  });

  it('an injury from the chart is tied to its casualty record', () => {
    const a = start(), uid = a.models[1]!.uid;
    const b = core.addInjury(ctx(a), uid, '26');
    expect(one(changes(a, b), 'injury')).toMatchObject({ payload: { code: '26', injury: 'Chest Wound', added: true }, unexplained: false });
  });

  it('shopping needs no event; a rare item bought is logged', () => {
    const a = start(), uid = a.models[0]!.uid;
    const b = core.toggleEq(ctx(a), uid, 'Schwert', true);
    expect(one(changes(a, b), 'gear_added')).toMatchObject({ payload: { item: 'Schwert', before: 0, after: 1 }, unexplained: false });
    const rare = core.rareEligibleItems(ctx(a), a.models[0]!)[0]!.de;
    expect(one(changes(a, core.addRare(ctx(a), uid, rare)), 'rare_added').unexplained).toBe(false);
  });

  it('experience from the battle is explained; typed in, it is not', () => {
    const a = start(), uid = a.models[0]!.uid;
    const earned = core.applyPendingXp(ctx(core.grantXp(ctx(a), uid, 2, 'survived')));
    expect(one(changes(a, earned), 'experience')).toMatchObject({ payload: { gained: 2 }, unexplained: false });
    expect(one(changes(a, core.setModelExp(ctx(a), uid, 22)), 'experience').unexplained).toBe(true);
  });

  it('districts, house rules, hires and the warband\'s name', () => {
    const a = start();
    const id = data.DISTRICTS[0]!.id;
    expect(one(changes(a, core.claimFoothold(ctx(a), id)), 'district')).toMatchObject({ payload: { before: 'none', after: 'foothold' }, unexplained: false });
    expect(one(changes(a, core.setDistrict(ctx(a), id, 'control')), 'district').unexplained).toBe(true);
    expect(one(changes(a, core.setHouseBool(ctx(a), 'freeDagger', true)), 'house_rules')).toMatchObject({ payload: { rule: 'freeDagger', before: false, after: true }, unexplained: true });
    const key = core.hireEligibility(ctx(a)).allowed[0]!.key;
    const hired = core.hireHS(ctx(a), key);
    const h = one(changes(a, hired), 'hired');
    expect(h.hireUid).toBe(hired.hired![0]!.uid);
    expect(h.changeKey).toBe(`1:${hired.hired![0]!.uid}:hired:${key}`);
    expect(one(changes(hired, core.unhireHS(ctx(hired), hired.hired![0]!.uid)), 'released').payload).toMatchObject({ hire: true });
    expect(one(changes(a, core.setWarbandName(ctx(a), 'Gold Caravan')), 'renamed')).toMatchObject({ uid: null, changeKey: '1:wb:renamed:name' });
  });

  it('counts the story changes still waiting for the player\'s words', () => {
    const a = start(), uid = a.models[1]!.uid;
    const b = core.addAdvance(ctx(core.killHero(ctx(a), a.models[0]!.uid)), uid, 'I');
    const cs = changes(a, b);
    const open = core.missingExplanations(cs, {});
    expect(kinds(open).sort()).toEqual(['died', 'stat']);
    const statKey = cs.find((c) => c.kind === 'stat')!.changeKey;
    expect(kinds(core.missingExplanations(cs, { [statKey]: 'He watched the captain fall and swore it would not happen again.' }))).toEqual(['died']);
  });
});

describe('diffWarbands over random walks', () => {
  it('keys are unique, warriors real, and nothing changes against itself', () => {
    useLegacy(null);
    for (const w of freshWalks().filter((_, i) => i % 3 === 0)) {
      const r = rng(7);
      let s = core.normalizeState(ctx(structuredClone(w.start.core)));
      let marked = s;
      for (let i = 0; i < 120; i++) {
        const step = randomStep(r, data, s);
        if (!step) continue;
        s = step[2](ctx(s));
        if (i % 30 !== 29) continue;
        const cs = core.diffWarbands(data, marked, s, 2);
        const keys = cs.map((c) => c.changeKey);
        expect(new Set(keys).size, `${w.label}: unique keys`).toBe(keys.length);
        const uids = new Set([...marked.models, ...s.models, ...(s.fallen ?? []).map((f) => f.m)].map((m) => m.uid));
        for (const c of cs) if (c.uid != null) expect(uids.has(c.uid), `${w.label}: ${c.changeKey}`).toBe(true);
        expect(core.diffWarbands(data, s, s, 2)).toEqual([]);
        const rec = core.reconcile(cs, { log: s.campaign?.log ?? [], casualties: s.campaign?.casualties ?? [] });
        const refs = rec.map((c) => c.eventRef).filter(Boolean);
        expect(new Set(refs).size, `${w.label}: evidence used once`).toBe(refs.length);
        marked = s;
      }
    }
  });
});
