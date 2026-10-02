/* More men for a henchman group, and the veterans roll (rulebook, Campaigns –
   New recruits and existing Henchmen groups; post-battle step 5). New
   logic: these tests state the rule. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { Model, WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const model = (s: WarbandState, uid: number) => s.models.find((m) => m.uid === uid) as Model;

/** Reikland: a Captain and two groups of two Warriors, one with 3
    experience, one fresh; `round` 1 = after the first battle. */
function band(round = 1) {
  let s = core.newWarband(data, 'merc');
  for (const id of ['capt', 'warr', 'warr']) s = core.addUnit(ctx(s), id);
  const [, vets, fresh] = s.models.map((m) => m.uid) as [number, number, number];
  s = core.setQty(ctx(s), vets, 2);
  s = core.setQty(ctx(s), fresh, 2);
  s = core.setModelExp(ctx(s), vets, 3);
  s = structuredClone(s);
  s.campaign = { ...s.campaign, on: round > 0, round };
  return { s, vets, fresh };
}

describe('the veterans roll', () => {
  it('is not needed while the warband is founded', () => {
    const { s, vets } = band(0);
    expect(core.needsVeterans(ctx(s), model(s, vets))).toBe(false);
    const n = core.addMen(ctx(s), vets, 2);
    expect(model(n, vets).qty).toBe(4);
    expect(core.veteransOf(ctx(n))).toBe(null);
  });

  it('is needed after the first battle, for a group with experience only', () => {
    const { s, vets, fresh } = band();
    expect(core.needsVeterans(ctx(s), model(s, vets))).toBe(true);
    expect(core.needsVeterans(ctx(s), model(s, fresh))).toBe(false);
    expect(core.moreMenProblem(ctx(s), vets, 1)).toBe('the veterans roll of this round');
    expect(core.addMen(ctx(s), vets, 1)).toBe(s);
    expect(model(core.addMen(ctx(s), fresh, 3), fresh).qty).toBe(5);
  });

  it('new men together bring at most the roll; the rest is kept for this round', () => {
    const { s, vets } = band();
    const r = core.setVeteransRoll(ctx(s), 7);
    expect(core.veteransOf(ctx(r))).toEqual({ roll: 7, spent: 0 });
    // 3 men × 3 experience = 9 > 7
    expect(core.moreMenProblem(ctx(r), vets, 3)).toBe('3 men bring 9 experience; 7 of the roll of 7 are left');
    const two = core.addMen(ctx(r), vets, 2);
    expect(model(two, vets)).toMatchObject({ qty: 4, exp: 3 });
    expect(core.veteransOf(ctx(two))).toEqual({ roll: 7, spent: 6 });
    expect(core.moreMenProblem(ctx(two), vets, 1)).toBe('1 man brings 3 experience; 1 of the roll of 7 is left');
  });

  it('each new man costs his unit, his gear and 2 gc for each point of the group\'s experience', () => {
    const { s, vets } = band();
    const r = core.setVeteransRoll(ctx(s), 12);
    const each = core.henchRecruitCost(ctx(r), model(r, vets));
    expect(core.henchRecruitSurcharge(ctx(r), model(r, vets))).toBe(6);
    const n = core.addMen(ctx(r), vets, 2);
    expect(core.goldCurrent(ctx(n))).toBe(core.goldCurrent(ctx(r)) - 2 * each);
  });

  it('a correction of the roll may not fall below what is used', () => {
    const { s, vets } = band();
    const r = core.addMen(ctx(core.setVeteransRoll(ctx(s), 9)), vets, 2);
    expect(core.setVeteransRoll(ctx(r), 5)).toBe(r);
    expect(core.veteransOf(ctx(core.setVeteransRoll(ctx(r), 8)))).toEqual({ roll: 8, spent: 6 });
    for (const bad of [1, 13, 2.5]) expect(core.setVeteransRoll(ctx(s), bad)).toBe(s);
  });

  it('a new round needs a new roll', () => {
    const { s, vets } = band();
    const r = core.addMen(ctx(core.setVeteransRoll(ctx(s), 12)), vets, 1);
    const next = structuredClone(r);
    next.campaign!.round = 2;
    expect(core.veteransOf(ctx(next))).toBe(null);
    expect(core.addMen(ctx(next), vets, 1)).toBe(next);
  });
});

describe('more men', () => {
  it('stay within five to a group and the warband\'s limits, and get their names', () => {
    const { s, fresh } = band();
    expect(core.moreMenMax(ctx(s), model(s, fresh))).toBe(3);
    expect(core.addMen(ctx(s), fresh, 4)).toBe(s);
    const n = core.addMen(ctx(s), fresh, 2, ['Kurt', '']);
    expect(core.memberNames(ctx(n), model(n, fresh))).toEqual(['Warrior 1', 'Warrior 2', 'Kurt', 'Warrior 4']);
  });

  it('a Hero takes none', () => {
    const { s } = band();
    const capt = s.models[0]!.uid;
    expect(core.moreMenMax(ctx(s), model(s, capt))).toBe(0);
    expect(core.addMen(ctx(s), capt, 1)).toBe(s);
  });

  it('survive saving and loading with the roll', () => {
    const { s, vets } = band();
    const r = core.addMen(ctx(core.setVeteransRoll(ctx(s), 8)), vets, 1);
    const back = core.loadSave(data, JSON.parse(JSON.stringify(core.writeSave(ctx(r)))));
    expect(back.ok && core.veteransOf(ctx(back.state))).toEqual({ roll: 8, spent: 3 });
  });
});

it('leaves frozen inputs alone', () => {
  const { s, vets, fresh } = band();
  const deepFreeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.freeze(v); for (const x of Object.values(v)) deepFreeze(x); } return v; };
  const frozen = deepFreeze(structuredClone(core.setVeteransRoll(ctx(s), 10)));
  expect(() => {
    core.setVeteransRoll(ctx(frozen), 11);
    core.addMen(ctx(frozen), vets, 2, deepFreeze(['A', 'B']));
    core.addMen(ctx(frozen), fresh, 1);
  }).not.toThrow();
});
