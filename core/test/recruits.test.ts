/* New recruits during a campaign and their list, and mutations (Rob,
   02.10.2026, on the Ultimate FAQ; rulebook, New recruits; UFAQ on
   mutations). New logic: the tests state the rulings. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { Model, WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const model = (s: WarbandState, uid: number) => s.models.find((m) => m.uid === uid) as Model;
const at = (s: WarbandState, round: number): WarbandState => ({ ...s, campaign: { ...s.campaign, on: true, round } });

describe('a recruit\'s own list', () => {
  /** Reikland founded with a Captain; after battle 1 a Youngblood joins. */
  function band() {
    let s = core.newWarband(data, 'merc');
    s = core.addUnit(ctx(s), 'capt');
    s = at(s, 1);
    s = core.recruitUnit(ctx(s), 'young');
    const [capt, young] = s.models.map((m) => m.uid) as [number, number];
    return { s, capt, young };
  }

  it('notes the round he joined in; a founding warrior has none', () => {
    const { s, capt, young } = band();
    expect(model(s, young).joined).toBe(1);
    expect(model(s, capt).joined).toBeUndefined();
    const founding = core.recruitUnit(ctx(core.newWarband(data, 'merc')), 'capt');
    expect(founding.models[0]!.joined).toBeUndefined();
  });

  it('stays open until his own first battle', () => {
    const { s, capt, young } = band();
    expect(core.warriorHasFought(ctx(s), model(s, capt))).toBe(true);
    expect(core.warriorHasFought(ctx(s), model(s, young))).toBe(false);
    expect(core.isNewRecruit(ctx(s), model(s, young))).toBe(true);
    expect(model(core.setListQty(ctx(s), young, 'Schwert', 1), young).eq?.Schwert).toBe(1);
    expect(core.listProblem(ctx(s), capt, 'Schwert', 1)).toBe('after his first battle he trades at the Trading Post');
    expect(core.setListQty(ctx(s), capt, 'Schwert', 1)).toBe(s);
    const later = at(s, 2);
    expect(core.warriorHasFought(ctx(later), model(later, young))).toBe(true);
    expect(core.setListQty(ctx(later), young, 'Schwert', 1)).toBe(later);
  });

  it('common items freely at the list price, rare ones only by searching', () => {
    const { s, young } = band();
    const rare = Object.values(core.eqListFor(ctx(s), core.unitDef(ctx(s), 'young'))!).flat().map(([nm]) => nm).find((nm) => core.tradeKind(ctx(s), nm).kind === 'rare')!;
    expect(rare).toBeTruthy();
    expect(core.listProblem(ctx(s), young, rare, 1)).toBe('rare: only through a search at the Trading Post');
    // the founding warband takes them from its list
    let f = core.newWarband(data, 'merc');
    f = core.addUnit(ctx(f), 'young');
    expect(core.listProblem(ctx(f), f.models[0]!.uid, rare, 1)).toBe('');
  });

  it('the price is the list\'s, booked in the ledger', () => {
    const { s, young } = band();
    const l = core.openLedger(ctx(s));
    const bought = core.settle(ctx(l), core.setListQty(ctx(l), young, 'Schwert', 1), { text: 'Sword' });
    expect(core.goldCurrent(ctx(bought))).toBe(core.goldCurrent(ctx(l)) - 10);
    expect(bought.ledger!.at(-1)).toMatchObject({ amount: -10, text: 'Sword' });
  });
});

describe('mutations', () => {
  function cult(round = 0) {
    let s = core.newWarband(data, 'possessed');
    s = at(s, round);
    s = core.recruitUnit(ctx(s), 'mut');
    return { s, mut: s.models[0]!.uid };
  }

  it('the same one more than once, where the effects add up (UFAQ)', () => {
    const c = cult();
    const { mut } = c;
    let { s } = c;
    s = core.setMutationCount(ctx(s), mut, 'Schwarzblut', 2);
    expect(model(s, mut).mut).toEqual(['Schwarzblut', 'Schwarzblut']);
    expect(core.mutCost(ctx(s), model(s, mut))).toBe(30 + 60);
    expect(core.mutationProblem(ctx(s), mut, 'Dämonenseele', 2)).toBe('once only');
  });

  it('a claw or tentacle needs an arm: two, and one more for every Extra Arm', () => {
    const c = cult();
    const { mut } = c;
    let { s } = c;
    s = core.setMutationCount(ctx(s), mut, 'Große Klaue', 1);
    s = core.setMutationCount(ctx(s), mut, 'Tentakel', 1);
    expect(core.mutationMax(model(s, mut), 'Tentakel')).toBe(1);
    expect(core.mutationProblem(ctx(s), mut, 'Tentakel', 2)).toBe('he has no free arm for it');
    s = core.setMutationCount(ctx(s), mut, 'Zusätzlicher Arm', 1);
    s = core.setMutationCount(ctx(s), mut, 'Tentakel', 2);
    expect(model(s, mut).mut!.filter((x) => x === 'Tentakel')).toHaveLength(2);
    expect(core.mutationProblem(ctx(s), mut, 'Zusätzlicher Arm', 0)).toBe('a claw or tentacle grows from it');
  });

  it('bought as he is hired, also mid-campaign; no more after his first battle', () => {
    const { s, mut } = cult(1);
    expect(core.mutationProblem(ctx(s), mut, 'Stacheln', 1)).toBe('');
    const later = at(s, 2);
    expect(core.mutationProblem(ctx(later), mut, 'Stacheln', 1)).toBe('mutations are bought when a warrior is hired');
  });

  it('the Mutant skill gives one, at any time', () => {
    let s = at(core.newWarband(data, 'beastmen'), 3);
    s = core.addUnit(ctx(s), 'chief');
    const uid = s.models[0]!.uid;
    s = core.addSkillFromList(ctx(s), uid, 'Mutant');
    s = core.setMutationCount(ctx(s), uid, 'Stacheln', 1);
    expect(model(s, uid).mut).toEqual(['Stacheln']);
    expect(core.mutationProblem(ctx(s), uid, 'Tentakel', 1)).toBe('the Mutant skill gives one mutation');
  });

  it('a Hero without them takes none', () => {
    let s = core.newWarband(data, 'merc');
    s = core.addUnit(ctx(s), 'capt');
    expect(core.setMutationCount(ctx(s), s.models[0]!.uid, 'Stacheln', 1)).toBe(s);
  });
});
