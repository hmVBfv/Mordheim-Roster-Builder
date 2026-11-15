/* Rules that ask for a roll after a battle (Rob, 15.11.2026): the Marauders' Eye of the Gods and the Huckster's Slick Operator. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const dice = (...v: number[]): core.Rolled => ({ value: v, by: 'entered' });
const rec = (s: WarbandState) => (s.campaign as { postbattle?: Record<string, { duties?: { rolled?: { id: string; outcome: string; total: number }[] }; finds?: { source: string; amount?: number }[] }> }).postbattle?.[1];

function marauders(tribe: 'norse' | 'kurgan' = 'kurgan', extra: string[] = []): WarbandState {
  let s = { ...core.newWarband(data, 'maraudersofchaos'), budget: 5000, subtype: tribe, campaign: { on: true, round: 1, districts: {} } } as WarbandState;
  for (const id of ['chieftain', ...extra]) s = core.addUnit(ctx(s), id);
  return core.openLedger(ctx(s));
}
function huckster(): WarbandState {
  let s = { ...core.newWarband(data, 'hochland'), budget: 5000, campaign: { on: true, round: 1, districts: {} } } as WarbandState;
  for (const id of ['prince', 'huckster']) s = core.addUnit(ctx(s), id);
  return core.openLedger(ctx(s));
}

describe('Eye of the Gods', () => {
  it('is due for the leader of a Marauders warband, and nowhere else', () => {
    const s = marauders();
    expect(core.rollDutiesDue(ctx(s), 1).map((d) => [d.id, d.resolved])).toEqual([['eye-of-the-gods', null]]);
    expect(core.rollDutiesDue(ctx(core.newWarband(data, 'merc')), 1)).toEqual([]);
  });

  it('needs 12, 13 for the Norse, one less with Tattooed Body', () => {
    expect(core.eyeThreshold(ctx(marauders('kurgan')))).toBe(12);
    expect(core.eyeThreshold(ctx(marauders('norse')))).toBe(13);
    const tattoo = (s: WarbandState): WarbandState => ({ ...s, models: s.models.map((m) => (m.uid_def === 'chieftain' ? { ...m, skills: ['Tattooed Body'] } : m)) });
    expect(core.eyeThreshold(ctx(tattoo(marauders('kurgan'))))).toBe(10);
    expect(core.eyeThreshold(ctx(tattoo(marauders('norse'))))).toBe(11);
  });

  it('a lost battle on 12+ turns the leader into a Spawn: gear and experience gone, gold unchanged, one Spawn only', () => {
    const s = marauders('kurgan', ['marauder']);
    const gold = core.goldCurrent(ctx(s));
    const t = core.resolveRollDuty(ctx(s), 1, 'eye-of-the-gods', { result: 'lost', count: 2, roll: dice(5, 5) });
    expect(t.models.some((m) => m.uid_def === 'chieftain')).toBe(false);
    expect(t.models.filter((m) => m.uid_def === 'spawn')).toHaveLength(1);
    expect(core.goldCurrent(ctx(t))).toBe(gold);
    expect(rec(t)!.duties!.rolled![0]).toMatchObject({ id: 'eye-of-the-gods', outcome: 'spawn', total: 12 });
    expect(rec(t)!.finds!.some((f) => f.source === 'duty:eye-of-the-gods')).toBe(true);
    // with a Spawn already the leader is simply erased
    const again = core.resolveRollDuty(ctx(marauders('kurgan', ['spawn'])), 1, 'eye-of-the-gods', { result: 'lost', count: 4, roll: dice(4, 4) });
    expect(again.models.filter((m) => m.uid_def === 'spawn')).toHaveLength(1);
    expect(again.models.some((m) => m.uid_def === 'chieftain')).toBe(false);
  });

  it('a won battle on 12+ gives a Mark of the leader’s choice, and the test is then no longer taken', () => {
    const s = marauders();
    expect(core.rollDutyProblem(ctx(s), 1, 'eye-of-the-gods', { result: 'won', count: 3, roll: dice(5, 4) })).toBe('Choose the Mark.');
    const t = core.resolveRollDuty(ctx(s), 1, 'eye-of-the-gods', { result: 'won', count: 3, roll: dice(5, 4), mark: 'serpent' });
    expect(t.mark).toBe('serpent');
    expect(rec(t)!.duties!.rolled![0]!.outcome).toBe('mark');
    expect(core.rollDutiesDue(ctx(t), 2)).toEqual([]);
    expect(core.rollDutiesDue(ctx(t), 1)[0]!.resolved).not.toBeNull(); // the result of this round stays shown
    // taken back: the Mark goes, the question returns
    const u = core.undoRollDuty(ctx(t), 1, 'eye-of-the-gods');
    expect(u.mark || '').toBe('');
    expect(core.rollDutiesDue(ctx(u), 1)[0]!.resolved).toBeNull();
  });

  it('below the number nothing happens; a draw adds nothing; a leader who did not fight rolls nothing', () => {
    const s = marauders();
    expect(rec(core.resolveRollDuty(ctx(s), 1, 'eye-of-the-gods', { result: 'lost', count: 1, roll: dice(5, 5) }))!.duties!.rolled![0]).toMatchObject({ outcome: 'nothing', total: 11 });
    const draw = core.resolveRollDuty(ctx(s), 1, 'eye-of-the-gods', { result: 'draw', count: 5, roll: dice(6, 5) });
    expect(rec(draw)!.duties!.rolled![0]).toMatchObject({ outcome: 'nothing', total: 11 });
    const idle = core.resolveRollDuty(ctx(s), 1, 'eye-of-the-gods', { leaderFought: false });
    expect(rec(idle)!.duties!.rolled![0]!.outcome).toBe('not-in-effect');
    expect(idle.models.some((m) => m.uid_def === 'chieftain')).toBe(true);
  });

  it('refuses bad dice and does not settle twice', () => {
    const s = marauders();
    expect(core.resolveRollDuty(ctx(s), 1, 'eye-of-the-gods', { result: 'lost', count: 0, roll: dice(7, 1) })).toBe(s);
    expect(core.rollDutyProblem(ctx(s), 1, 'eye-of-the-gods', { result: 'lost', count: -1, roll: dice(1, 1) })).toMatch(/count/);
    const t = core.resolveRollDuty(ctx(s), 1, 'eye-of-the-gods', { result: 'lost', count: 0, roll: dice(1, 1) });
    expect(core.rollDutyProblem(ctx(t), 1, 'eye-of-the-gods', { result: 'lost', count: 0, roll: dice(1, 1) })).toMatch(/settled/);
  });
});

describe('Slick Operator', () => {
  it('on 2–6 the warband gains the 2D6, booked with its origin, and the gold can be taken back', () => {
    const s = huckster();
    const gold = core.goldCurrent(ctx(s));
    const t = core.resolveRollDuty(ctx(s), 1, 'slick-operator', { roll: dice(4), gold: dice(3, 5) });
    expect(core.goldCurrent(ctx(t))).toBe(gold + 8);
    expect(t.ledger!.some((e) => e.source === 'duty:slick-operator' && e.amount === 8)).toBe(true);
    expect(core.stageMetrics(ctx(t)).incomeOther).toBe(core.stageMetrics(ctx(s)).incomeOther + 8); // the gold a rule brings is income, not lost
    const u = core.undoRollDuty(ctx(t), 1, 'slick-operator');
    expect(core.goldCurrent(ctx(u))).toBe(gold);
  });

  it('on a 1 the Huckster misses the next game', () => {
    const s = huckster();
    const t = core.resolveRollDuty(ctx(s), 1, 'slick-operator', { roll: dice(1) });
    expect(t.models.find((m) => m.uid_def === 'huckster')!.miss).toBe(1);
    expect(core.goldCurrent(ctx(t))).toBe(core.goldCurrent(ctx(s)));
    expect(core.undoRollDuty(ctx(t), 1, 'slick-operator').models.find((m) => m.uid_def === 'huckster')!.miss ?? 0).toBe(0);
  });

  it('asks for the gold dice on 2–6 and is due only with a Huckster', () => {
    const s = huckster();
    expect(core.rollDutyProblem(ctx(s), 1, 'slick-operator', { roll: dice(3) })).toMatch(/2D6/);
    expect(core.rollDutiesDue(ctx(core.newWarband(data, 'hochland')), 1)).toEqual([]);
  });

  it('keeps the rolls when the phase is marked done', () => {
    const t = core.resolveRollDuty(ctx(huckster()), 1, 'slick-operator', { roll: dice(1) });
    expect(rec(core.setDutiesDone(ctx(t), 1, true))!.duties!.rolled).toHaveLength(1);
  });
});

describe('Eye of the Gods reads the battle record', () => {
  const side = (uid: number | null, name = 'x') => ({ uid, name, wb: '', grade: '', value: null });
  const cas = (id: number, victim: number | null, attacker: number | null) => ({ id, round: 1, battleId: 1, victim: side(victim), attacker: side(attacker), result: 'dead', detail: '', fallenId: null, note: '' });
  const withRecord = (s: WarbandState, outcome: string, casualties: ReturnType<typeof cas>[]): WarbandState =>
    ({ ...s, campaign: { ...s.campaign, battles: [{ id: 1, round: 1, outcome }], casualties } } as WarbandState);

  it('a won battle: the enemy models the leader put out of action, and not those another man took', () => {
    const s = marauders('kurgan', ['champion']);
    const lead = core.leaderUid(ctx(s))!, other = s.models.find((m) => m.uid !== lead)!.uid;
    const t = withRecord(s, 'Victory', [cas(1, null, lead), cas(2, null, lead), cas(3, null, other), cas(4, other, lead)]);
    expect(core.eyeSuggest(ctx(t), 1)).toMatchObject({ result: 'won', count: 2, leaderFought: true });
  });

  it('a lost battle: the own Heroes out of action, a dead one included', () => {
    const s = marauders('kurgan', ['champion', 'marauder']);
    const lead = core.leaderUid(ctx(s))!;
    const champ = s.models.find((m) => m.uid_def === 'champion')!.uid, man = s.models.find((m) => m.uid_def === 'marauder')!.uid;
    const t = withRecord(s, 'Defeat', [cas(1, champ, null), cas(2, man, null), cas(3, lead, null)]);
    expect(core.eyeSuggest(ctx(t), 1)).toMatchObject({ result: 'lost', count: 2 });
    expect(core.eyeSuggest(ctx(withRecord(s, 'Routed', [])), 1)).toMatchObject({ result: 'lost', count: 0 });
    expect(core.eyeSuggest(ctx(withRecord(s, 'Draw', [])), 1)).toMatchObject({ result: 'draw', count: 0 });
    expect(core.eyeSuggest(ctx(s), 1).result).toBeUndefined();
  });

  it('a leader who has to miss games did not fight', () => {
    const s = marauders();
    const t = { ...s, models: s.models.map((m) => (m.uid_def === 'chieftain' ? { ...m, miss: 1 } : m)) };
    expect(core.eyeSuggest(ctx(t), 1).leaderFought).toBe(false);
  });
});

describe('Eye of the Gods and a new leader', () => {
  const marked = (): WarbandState => core.resolveRollDuty(ctx(marauders('kurgan', ['champion'])), 1, 'eye-of-the-gods', { result: 'won', count: 3, roll: dice(5, 4), mark: 'serpent' });

  it('the Mark ends the test for this leader, but a new leader must prove himself again', () => {
    const s = marked();
    expect(core.rollDutiesDue(ctx(s), 2)).toEqual([]);
    const gone = { ...s, models: s.models.filter((m) => m.uid_def !== 'chieftain') };
    expect(core.rollDutiesDue(ctx(gone), 2).map((d) => d.id)).toEqual(['eye-of-the-gods']);
  });

  it('a warband that follows a Mark takes that one again, or Chaos Undivided – not a different one; taking it back restores the Mark it had', () => {
    const s = marked();
    const gone = { ...s, models: s.models.filter((m) => m.uid_def !== 'chieftain') };
    const input = { result: 'won' as const, count: 3, roll: dice(5, 4) };
    expect(core.rollDutyProblem(ctx(gone), 2, 'eye-of-the-gods', { ...input, mark: 'eagle' })).toMatch(/already follows a Mark/);
    expect(core.rollDutyProblem(ctx(gone), 2, 'eye-of-the-gods', { ...input, mark: 'serpent' })).toBeNull();
    const t = core.resolveRollDuty(ctx(gone), 2, 'eye-of-the-gods', { ...input, mark: 'undivided' });
    expect(t.mark).toBe('undivided');
    expect(core.undoRollDuty(ctx(t), 2, 'eye-of-the-gods').mark).toBe('serpent');
  });
});

describe('Slick Operator and Banditry', () => {
  it('a Huckster with the Banditry skill cannot use Slick Operator: the two may not be combined', () => {
    const s = huckster();
    const t = { ...s, models: s.models.map((m) => (m.uid_def === 'huckster' ? { ...m, skills: ['Banditry'] } : m)) };
    const [d] = core.rollDutiesDue(ctx(t), 1);
    expect(d!.blocked).toMatch(/Banditry/);
    expect(core.rollDutyProblem(ctx(t), 1, 'slick-operator', { roll: dice(1) })).toMatch(/Banditry/);
    expect(core.resolveRollDuty(ctx(t), 1, 'slick-operator', { roll: dice(1) })).toBe(t);
    expect(core.rollDutiesDue(ctx(s), 1)[0]!.blocked).toBeUndefined();
  });
});

describe('a Mark the Seer chose is the warband’s, not the leader’s', () => {
  const seerMark = (): WarbandState => ({ ...marauders('kurgan', ['seer']), mark: 'serpent' });

  it('the Chieftain still rolls, and a win may give him only that Mark or Chaos Undivided', () => {
    const s = seerMark();
    expect(core.rollDutiesDue(ctx(s), 1).map((d) => d.id)).toEqual(['eye-of-the-gods']);
    const input = { result: 'won' as const, count: 3, roll: dice(5, 4) };
    expect(core.rollDutyProblem(ctx(s), 1, 'eye-of-the-gods', { ...input, mark: 'crow' })).toMatch(/already follows a Mark/);
    expect(core.rollDutyProblem(ctx(s), 1, 'eye-of-the-gods', { ...input, mark: 'serpent' })).toBeNull();
    const t = core.resolveRollDuty(ctx(s), 1, 'eye-of-the-gods', { ...input, mark: 'serpent' });
    expect(t.mark).toBe('serpent');
    expect(core.rollDutiesDue(ctx(t), 2)).toEqual([]); // now it is his: no more rolling
  });

  it('a leader who already has the warband’s Mark says so: no roll, and no more tests', () => {
    const s = seerMark();
    const t = core.resolveRollDuty(ctx(s), 1, 'eye-of-the-gods', { alreadyMarked: true });
    expect(rec(t)!.duties!.rolled![0]).toMatchObject({ outcome: 'has-mark' });
    expect(t.mark).toBe('serpent');
    expect(core.rollDutiesDue(ctx(t), 2)).toEqual([]);
    expect(core.rollDutyProblem(ctx(marauders()), 1, 'eye-of-the-gods', { alreadyMarked: true })).toBe('The warband has no Mark.');
    expect(core.rollDutiesDue(ctx(core.undoRollDuty(ctx(t), 1, 'eye-of-the-gods')), 1)[0]!.resolved).toBeNull();
  });
});
