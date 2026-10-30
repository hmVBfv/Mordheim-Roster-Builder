/* Wish #166 (Rob, 30.10.2026): a counter of the battles each model or unit has taken part in, which also tells the Fallen after how many
   battles they fell. Counted when the battle's experience is granted (once for each battle, the aftermath guards that). */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { Casualty, FallenRecord, WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

/** A Captain, a Champion and a group of two Warriors in a campaign, round 1, one battle recorded. */
function band() {
  let s = core.newWarband(data, 'merc');
  for (const id of ['capt', 'champ', 'warr']) s = core.addUnit(ctx(s), id);
  s = core.setQty(ctx(s), s.models[2]!.uid, 2);
  s = structuredClone(s);
  s.campaign = { ...s.campaign, on: true, round: 1, districts: {} };
  s = core.addBattle(ctx(s), { round: 1, outcome: 'Victory' });
  const [capt, champ, warr] = s.models.map((m) => m.uid) as [number, number, number];
  return { s, capt, champ, warr, battle: (s.campaign!.battles as { id: number }[])[0]!.id };
}
const battlesOf = (s: WarbandState, uid: number) => s.models.find((m) => m.uid === uid)!.battles;

describe('counting a battle', () => {
  it('adds one to every model and every group that took part, and to nobody before', () => {
    const { s, capt, champ, warr, battle } = band();
    expect([capt, champ, warr].map((u) => battlesOf(s, u))).toEqual([undefined, undefined, undefined]);
    const t = core.countBattle(ctx(s), battle);
    expect([capt, champ, warr].map((u) => battlesOf(t, u))).toEqual([1, 1, 1]);
    const u = core.countBattle(ctx(t), battle);
    expect(battlesOf(u, capt)).toBe(2);
  });

  it('leaves out the one who sat it out (games to miss)', () => {
    const { s, capt, champ, battle } = band();
    const t = structuredClone(s);
    t.models.find((m) => m.uid === champ)!.miss = 1;
    const u = core.countBattle(ctx(t), battle);
    expect(battlesOf(u, champ)).toBeUndefined();
    expect(battlesOf(u, capt)).toBe(1);
  });

  it('counts the one who fell in it too, in the Fallen where he already is: he fell after that many battles', () => {
    let { s } = band();
    const { champ, capt, battle } = band();
    s = core.countBattle(ctx(s), battle); // an earlier battle
    s = core.addBattle(ctx(s), { round: 2, outcome: 'Defeat' });
    s = structuredClone(s);
    s.campaign = { ...s.campaign, round: 2 };
    const second = (s.campaign!.battles as { id: number }[]).at(-1)!.id;
    s = core.addCasualty(ctx(s), { victim: { uid: champ, name: '' }, attacker: { name: 'Gorbag' } });
    s = core.resolveCasualtyRoll(ctx(s), (s.campaign!.casualties as Casualty[]).at(-1)!.id, '11-15');
    expect(s.models.some((m) => m.uid === champ)).toBe(false);
    s = core.countBattle(ctx(s), second);
    const dead = (s.fallen as FallenRecord[]).find((f) => f.m.uid === champ)!;
    expect(dead.m.battles).toBe(2);
    expect(battlesOf(s, capt)).toBe(2);
  });

  it('does nothing outside a campaign', () => {
    const { s, capt } = band();
    const t = structuredClone(s);
    t.campaign = { ...t.campaign, on: false };
    expect(battlesOf(core.countBattle(ctx(t), null), capt)).toBeUndefined();
  });
});

describe('setting the count by hand', () => {
  it('for a warband that played before the counter, never below nothing, never a fraction', () => {
    const { s, capt } = band();
    expect(battlesOf(core.setModelBattles(ctx(s), capt, 4), capt)).toBe(4);
    expect(battlesOf(core.setModelBattles(ctx(s), capt, -3), capt)).toBe(0);
    expect(battlesOf(core.setModelBattles(ctx(s), capt, 2.7), capt)).toBe(3);
  });
});
