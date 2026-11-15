/* N10: the upkeep of Hired Swords and Dramatis Personae after a battle (mordheimer.net, Campaigns: Hired Swords – hire fee): paid after each
   battle he fights, the first included, or he leaves; dead or no longer wanted, he costs nothing. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

function band(hired: string[] = [], dp: string[] = [], ledger = false): WarbandState {
  let s = { ...core.newWarband(data, 'merc'), campaign: { on: true, round: 1, districts: {} } } as WarbandState;
  for (const u of data.WARBANDS.merc!.units.filter((x) => x.req)) s = core.addUnit(ctx(s), u.id);
  s = { ...s, hired: hired.map((k, i) => ({ key: k, uid: `hs${i}` })), dp: dp.map((k, i) => ({ key: k, uid: `dp${i}` })) } as WarbandState;
  return ledger ? core.openLedger(ctx(s)) : s;
}
const upkeepOf = (key: string) => data.HIREDSWORDS[key]!.upkeep as number;
const rec = (s: WarbandState) => (s.campaign as { postbattle?: Record<string, { upkeep?: { paid: { uid: string; gc: number }[]; dismissed: string[] }; finds?: { source: string; amount?: number; uid?: string }[] }> }).postbattle?.['1'];

describe('what is due', () => {
  it('one line for each Hired Sword and Dramatis Persona, with his upkeep', () => {
    const s = band(['elfranger', 'beggar'], ['marianna']);
    const due = core.upkeepDue(ctx(s), 1);
    expect(due.map((x) => [x.uid, x.kind, x.gc])).toEqual([['hs0', 'hs', upkeepOf('elfranger')], ['hs1', 'hs', upkeepOf('beggar')], ['dp0', 'dp', 75]]);
    expect(due.every((x) => !x.paid)).toBe(true);
  });

  it('nothing for a warband without hirelings', () => {
    expect(core.upkeepDue(ctx(band()), 1)).toEqual([]);
  });

  it('one who was put out of action is still due, one who was killed is not on the roster any more', () => {
    const s = band(['elfranger']);
    expect(core.upkeepDue(ctx(core.dismissHire(ctx(s), 'hs0', 'hs')), 1)).toEqual([]);
  });

  it('a Dramatis Persona paid in something else says so', () => {
    const s = band([], ['nicodemus']);
    const [d] = core.upkeepDue(ctx(s), 1);
    expect(d).toMatchObject({ uid: 'dp0', gc: 0 });
    expect(d!.note).toMatch(/wyrdstone/i);
  });
});

describe('paying', () => {
  it('takes the gold of the ones paid and records each with a find of its origin', () => {
    const s = band(['elfranger', 'beggar']);
    const before = core.goldCurrent(ctx(s));
    const t = core.payUpkeep(ctx(s), 1, ['hs0']);
    expect(core.goldCurrent(ctx(t))).toBe(before - upkeepOf('elfranger'));
    expect(rec(t)!.upkeep).toEqual({ paid: [{ uid: 'hs0', gc: upkeepOf('elfranger') }], dismissed: [] });
    expect(rec(t)!.finds).toEqual([expect.objectContaining({ kind: 'gold', source: 'upkeep', amount: -upkeepOf('elfranger'), uid: 'hs0' })]);
    expect(core.upkeepDue(ctx(t), 1).find((x) => x.uid === 'hs0')!.paid).toBe(true);
  });

  it('the same one is not paid twice', () => {
    const t = core.payUpkeep(ctx(band(['elfranger'])), 1, ['hs0']);
    expect(core.payUpkeep(ctx(t), 1, ['hs0'])).toBe(t);
  });

  it('with the ledger kept, a booking that names its origin', () => {
    const s = band(['elfranger'], [], true);
    const t = core.payUpkeep(ctx(s), 1, ['hs0']);
    expect(t.ledger!.at(-1)).toMatchObject({ kind: 'adjust', amount: -upkeepOf('elfranger'), source: 'upkeep' });
    expect(core.ledgerBalance(t)).toBe(core.goldCurrent(ctx(t)));
  });

  it('the gold is taken even if the treasury cannot bear it – the page warns, the player decides', () => {
    const s = band(['elfranger']);
    const poor = { ...s, stash: { ...s.stash, gold: core.goldTreasury(ctx(s)) - core.goldCurrent(ctx(s)) } } as WarbandState; // gold in hand 0
    expect(core.goldCurrent(ctx(poor))).toBe(0);
    expect(core.upkeepProblem(ctx(poor), 1, ['hs0'])).toMatch(/gold|afford/i);
    expect(core.goldCurrent(ctx(core.payUpkeep(ctx(poor), 1, ['hs0'])))).toBe(-upkeepOf('elfranger'));
  });

  it('a free one (Returning a Favour) costs nothing', () => {
    const s = band(['elfranger']);
    const t = core.payUpkeep(ctx(s), 1, ['hs0'], { free: ['hs0'] });
    expect(core.goldCurrent(ctx(t))).toBe(core.goldCurrent(ctx(s)));
    expect(rec(t)!.upkeep!.paid).toEqual([{ uid: 'hs0', gc: 0 }]);
  });

  it('taking it back gives the gold back and clears the record', () => {
    const s = band(['elfranger', 'beggar']);
    const t = core.payUpkeep(ctx(s), 1, ['hs0', 'hs1']);
    const back = core.undoUpkeep(ctx(t), 1);
    expect(core.goldCurrent(ctx(back))).toBe(core.goldCurrent(ctx(s)));
    expect(rec(back)?.upkeep?.paid ?? []).toEqual([]);
    expect(rec(back)?.finds ?? []).toEqual([]);
  });
});

describe('dismissing', () => {
  it('a hireling sent away is recorded and costs nothing', () => {
    const s = band(['elfranger', 'beggar']);
    const t = core.dismissUpkeep(ctx(s), 1, 'hs0');
    expect(t.hired!.map((h) => h.key)).toEqual(['beggar']);
    expect(rec(t)!.upkeep).toEqual({ paid: [], dismissed: ['hs0'] });
  });
});
