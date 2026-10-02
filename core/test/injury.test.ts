/* An injury as rolled after a battle (V1, docs/behaviour-changes.md). New
   logic: the Roster Builder's two ways in disagreed, so these tests state
   the rules (mordheimer.net, Campaigns – Serious Injuries; UFAQ 10.2, 19;
   rulebook pp. 80–81, 107) instead of comparing with it. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { Casualty, HeroRoll, Model, WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const gold = (s: WarbandState) => core.goldCurrent(ctx(s));
const model = (s: WarbandState, uid: number) => s.models.find((m) => m.uid === uid) as Model;
const hero = (r: HeroRoll): core.InjuryRoll => ({ hero: r });

/** A Reikland warband after its first battle: Captain with sword and light
    armour, Champion, three Warriors; a casualty record waits for the
    Champion, put out of action by an Orc. */
function band(opts: { districts?: Record<string, core.DistrictHold>; casualty?: boolean } = {}) {
  let s = core.newWarband(data, 'merc');
  for (const id of ['capt', 'champ', 'warr']) s = core.addUnit(ctx(s), id);
  const [capt, champ, warr] = s.models.map((m) => m.uid) as [number, number, number];
  s = core.toggleEq(ctx(s), champ, 'Schwert', true);
  s = core.toggleEq(ctx(s), champ, 'Leichte Rüstung', true);
  s = core.setQty(ctx(s), warr, 3);
  s = core.setMemberName(ctx(s), warr, 1, 'Udo');
  s = structuredClone(s);
  s.campaign = { ...s.campaign, on: true, round: 1, districts: opts.districts ?? {} };
  if (opts.casualty !== false) {
    s = core.addCasualty(ctx(s), { victim: { uid: champ, name: 'Champion' }, attacker: { name: 'Gorbag', wb: 'orcs' } });
  }
  s = core.openLedger(ctx(s));
  return { s, capt, champ, warr };
}
const cas = (s: WarbandState) => s.campaign!.casualties!.at(-1) as Casualty;

describe('the chart', () => {
  it('reads a D66 tens die first, onto the rows of the chart', () => {
    expect(core.heroCodeOf('13')).toBe('11-15');
    expect(core.heroCodeOf(23)).toBe('23');
    expect(core.heroCodeOf('46')).toBe('41-55');
    expect(core.heroCodeOf('63')).toBe('62-63');
    expect(core.heroCodeOf('17')).toBe(null);
    expect(core.heroCodeOf('70')).toBe(null);
    expect(core.heroCodeOf('2')).toBe(null);
  });
});

describe('a Hero', () => {
  it('a lasting injury is written onto him and closes his casualty record', () => {
    const { s, champ } = band();
    const n = core.injure(ctx(s), champ, hero({ code: '22' }));
    expect(model(n, champ).inj).toEqual([expect.objectContaining({ code: '22', mod: { M: -1 } })]);
    expect(cas(n)).toMatchObject({ result: 'injured', code: '22', applied: true, detail: 'Leg Wound', injury: { hero: { code: '22' } } });
    expect(n.campaign!.log!.find((e) => e.data?.casualtyId === cas(n).id)!.text).toMatch(/Champion was wounded by Gorbag .* — Leg Wound\./);
  });

  it('the same roll from the casualty list does the same', () => {
    const { s, champ } = band();
    const byCard = core.injure(ctx(s), champ, hero({ code: '35', games: 2 }));
    const byList = core.injure(ctx(s), champ, hero({ code: '35', games: 2 }), { casualtyId: cas(s).id });
    expect(byList).toEqual(byCard);
  });

  it('23 and 25 ask a D6: 1 lasting, 2–6 he misses the next game', () => {
    const { s, champ } = band();
    expect(model(core.injure(ctx(s), champ, hero({ code: '23', d6: 1 })), champ).inj![0]!.code).toBe('23a');
    const light = model(core.injure(ctx(s), champ, hero({ code: '25', d6: 4 })), champ);
    expect(light.inj ?? []).toEqual([]);
    expect(light).toMatchObject({ miss: 1, missWhy: 'Smashed Leg' });
    expect(model(core.injure(ctx(s), champ, hero({ code: '24', d6: 5 })), champ).inj![0]!.code).toBe('24b');
  });

  it('Deep Wound: he misses the D3 games, nothing lasting (was lasting from the casualty list)', () => {
    const { s, champ } = band();
    const m = model(core.injure(ctx(s), champ, hero({ code: '35', games: 3 })), champ);
    expect(m.inj ?? []).toEqual([]);
    expect(m).toMatchObject({ miss: 3, missWhy: 'Deep Wound' });
  });

  it('Robbed: all his equipment is gone and nothing comes back; no lasting injury', () => {
    const { s, champ } = band();
    const n = core.injure(ctx(s), champ, hero({ code: '36' }));
    expect(model(n, champ).eq).toEqual({});
    expect(model(n, champ).inj ?? []).toEqual([]);
    expect(gold(n)).toBe(gold(s));
    expect(n.campaign!.log!.some((e) => /Robbed — all his equipment is lost/.test(e.text))).toBe(true);
  });

  it('Bitter Enmity: he hates whom the roll names', () => {
    const { s, champ } = band();
    const n = core.injure(ctx(s), champ, hero({ code: '56', d6: 2, hates: 'Gorbag' }));
    expect(model(n, champ).inj![0]).toMatchObject({ code: '56', name: 'Bitter Enmity (hates Gorbag)' });
    expect(core.injure(ctx(s), champ, hero({ code: '56', d6: 2 }))).toBe(s);
  });

  it('Survives Against the Odds: +1 experience (was none from the casualty list)', () => {
    const { s, champ } = band();
    const n = core.injure(ctx(s), champ, hero({ code: '66' }));
    expect(model(n, champ).exp).toBe((Number(model(s, champ).exp) || 0) + 1);
    expect(cas(n).result).toBe('injured');
  });

  it('Dead: he joins the Fallen with everything, the record points there', () => {
    const { s, champ } = band();
    const n = core.injure(ctx(s), champ, hero({ code: '11-15' }));
    expect(model(n, champ)).toBeUndefined();
    expect(n.fallen!.at(-1)).toMatchObject({ kind: 'hero', casualtyId: cas(n).id });
    expect(cas(n)).toMatchObject({ result: 'dead', fallenId: n.fallen!.length - 1, applied: true });
    expect(gold(n)).toBe(gold(s));
  });

  it('Multiple Injuries: each further result with its own follow-ups, all in the record', () => {
    const { s, champ } = band();
    const n = core.injure(ctx(s), champ, hero({ code: '16-21', more: [{ code: '22' }, { code: '23', d6: 3 }] }));
    expect(model(n, champ).inj!.map((j) => j.code)).toEqual(['22']);
    expect(model(n, champ).miss).toBe(1);
    expect(cas(n).detail).toBe('Multiple Injuries: Leg Wound; Arm Wound: misses the next game');
    // Dead, Captured and Multiple Injuries are rolled again
    for (const code of ['11-15', '61', '16-21'] as const) expect(core.injure(ctx(s), champ, hero({ code: '16-21', more: [{ code }] }))).toBe(s);
    expect(core.injure(ctx(s), champ, hero({ code: '16-21', more: [] }))).toBe(s);
  });

  describe('Captured', () => {
    it('exchanged: back with all his equipment', () => {
      const { s, champ } = band();
      const n = core.injure(ctx(s), champ, hero({ code: '61', captured: { fate: 'exchanged' } }));
      expect(model(n, champ).eq).toEqual(model(s, champ).eq);
      expect(gold(n)).toBe(gold(s));
    });

    it('ransomed: the ransom leaves the chest, booked in the ledger', () => {
      const { s, champ } = band();
      const n = core.injure(ctx(s), champ, hero({ code: '61', captured: { fate: 'ransomed', gold: 30 } }));
      expect(gold(n)).toBe(gold(s) - 30);
      expect(n.ledger!.at(-1)).toMatchObject({ kind: 'adjust', amount: -30, text: 'Ransom for Champion' });
    });

    it('never returned: lost with his equipment, among the Fallen', () => {
      const { s, champ } = band();
      const n = core.injure(ctx(s), champ, hero({ code: '61', captured: { fate: 'lost' } }));
      expect(model(n, champ)).toBeUndefined();
      expect(cas(n)).toMatchObject({ result: 'dead', detail: 'Captured and never returned' });
    });

    it('with the Gaol under control it becomes Full Recovery, without asking', () => {
      const { s, champ } = band({ districts: { gaol: 'control' } });
      const n = core.injure(ctx(s), champ, hero({ code: '61' }));
      expect(model(n, champ)).toEqual(model(s, champ));
      expect(cas(n)).toMatchObject({ result: 'recovered', detail: 'Captured, but freed from the Gaol: Full Recovery' });
      // a foothold is not enough
      expect(core.injure(ctx(band({ districts: { gaol: 'foothold' } }).s), champ, hero({ code: '61' }))).toEqual(band({ districts: { gaol: 'foothold' } }).s);
    });
  });

  describe('Sold to the Pits', () => {
    it('won: +50 gc and +2 experience, he keeps everything', () => {
      const { s, champ } = band();
      const n = core.injure(ctx(s), champ, hero({ code: '65', pit: { won: true } }));
      expect(gold(n)).toBe(gold(s) + 50);
      expect(model(n, champ).exp).toBe((Number(model(s, champ).exp) || 0) + 2);
      expect(model(n, champ).eq).toEqual(model(s, champ).eq);
    });

    it('lost: weapons and armour gone, then a roll on 11–35 with its own effects', () => {
      const { s, champ } = band();
      const n = core.injure(ctx(s), champ, hero({ code: '65', pit: { won: false, then: { code: '22' } } }));
      expect(model(n, champ).eq).toEqual({});
      expect(model(n, champ).inj!.map((j) => j.code)).toEqual(['22']);
      expect(gold(n)).toBe(gold(s));
      expect(core.injure(ctx(s), champ, hero({ code: '65', pit: { won: false, then: { code: '41-55' } } }))).toBe(s);
      const dead = core.injure(ctx(s), champ, hero({ code: '65', pit: { won: false, then: { code: '11-15' } } }));
      expect(cas(dead).result).toBe('dead');
    });

    it('with a foothold in the Amphitheatre he wins without a fight', () => {
      const { s, champ } = band({ districts: { amphitheatre: 'foothold' } });
      expect(gold(core.injure(ctx(s), champ, hero({ code: '65' })))).toBe(gold(s) + 50);
    });
  });

  describe('districts and the Peg Leg', () => {
    it('the Temple of Morr saves from Dead (D6 5+) only with a foothold', () => {
      const held = band({ districts: { templemorr: 'foothold' } });
      const n = core.injure(ctx(held.s), held.champ, hero({ code: '11-15', saved: 'morr' }));
      expect(model(n, held.champ)).toBeDefined();
      expect(cas(n)).toMatchObject({ result: 'recovered', detail: 'Dead, but the Temple of Morr returned him: Full Recovery' });
      const none = band();
      expect(core.injure(ctx(none.s), none.champ, hero({ code: '11-15', saved: 'morr' }))).toBe(none.s);
    });

    it('the Temple of Sigmar saves from 22–35, not from Robbed', () => {
      const { s, champ } = band({ districts: { templesigmar: 'control' } });
      expect(model(core.injure(ctx(s), champ, hero({ code: '34', saved: 'sigmar' })), champ).inj ?? []).toEqual([]);
      expect(core.injure(ctx(s), champ, hero({ code: '36', saved: 'sigmar' }))).toBe(s);
    });

    it('a Peg Leg ignores a Leg Wound only on a warrior who has one', () => {
      const { s, champ } = band();
      expect(core.injure(ctx(s), champ, hero({ code: '22', saved: 'peg' }))).toBe(s);
      const peg = structuredClone(s);
      model(peg, champ).eq = { ...model(peg, champ).eq, Holzbein: 1 };
      expect(model(core.injure(ctx(peg), champ, hero({ code: '22', saved: 'peg' })), champ).inj ?? []).toEqual([]);
    });
  });

  it('an incomplete roll changes nothing', () => {
    const { s, champ } = band();
    for (const r of [{ code: '23' }, { code: '35' }, { code: '35', games: 4 }, { code: '61' }, { code: '65' }, { code: '99' }] as HeroRoll[]) {
      expect(core.injure(ctx(s), champ, hero(r))).toBe(s);
      expect(core.heroRollProblem(ctx(s), model(s, champ), r)).toBeTruthy();
    }
    expect(core.injure(ctx(s), champ, { d6: 1 })).toBe(s); // a Hero rolls D66
  });

  it('without a casualty record one is written after the fact; outside a campaign none', () => {
    const { s, champ } = band({ casualty: false });
    const n = core.injure(ctx(s), champ, hero({ code: '33' }));
    expect(n.campaign!.casualties).toHaveLength(1);
    expect(cas(n)).toMatchObject({ result: 'injured', code: '33', victim: { uid: champ } });
    const off = structuredClone(s);
    off.campaign!.on = false;
    expect(core.injure(ctx(off), champ, hero({ code: '33' })).campaign!.casualties ?? []).toHaveLength(0);
  });
});

describe('Henchmen and Hired Swords roll a D6', () => {
  it('1–2: the man rolled for is dead, by his name; his record closes', () => {
    const b = band({ casualty: false });
    const { warr } = b;
    const s = core.addCasualty(ctx(b.s), { victim: { uid: warr, name: 'Udo', memberIdx: 1 }, attacker: { name: 'Gorbag' } });
    const n = core.injure(ctx(s), warr, { d6: 2, member: 1 });
    expect(core.memberNames(ctx(n), model(n, warr))).not.toContain('Udo');
    expect(model(n, warr).qty).toBe(2);
    expect(n.fallen!.at(-1)).toMatchObject({ kind: 'hench', memberName: 'Udo' });
    expect(cas(n)).toMatchObject({ result: 'dead', applied: true, injury: { d6: 2, member: 1 } });
    expect(gold(n)).toBe(gold(s));
  });

  it('3–6: he fights on', () => {
    const b = band({ casualty: false });
    const { warr } = b;
    const s = core.addCasualty(ctx(b.s), { victim: { uid: warr, name: 'Udo', memberIdx: 1 } });
    const n = core.injure(ctx(s), warr, { d6: 5, member: 1 });
    expect(n.models).toEqual(s.models);
    expect(cas(n)).toMatchObject({ result: 'recovered', detail: 'fights on' });
    expect(core.injure(ctx(s), warr, { d6: 5, member: 3 })).toBe(s);
  });

  it('a Hired Sword: 1–2 dead and gone, 3–6 nothing changes', () => {
    let { s } = band();
    s = core.hireHS(ctx(s), 'ogre');
    const uid = s.hired![0]!.uid;
    const n = core.injure(ctx(s), uid, { d6: 1 });
    expect(n.hired).toEqual([]);
    expect(n.campaign!.log!.at(-1)!.text).toMatch(/\(Hired Sword\) was slain\./);
    expect(core.injure(ctx(s), uid, { d6: 4 })).toBe(s);
  });
});

describe('purity', () => {
  it('leaves frozen inputs and the roll itself untouched', () => {
    const b = band({ districts: { templemorr: 'foothold' } });
    const { champ, warr } = b;
    const s = core.hireHS(ctx(b.s), 'ogre');
    const deepFreeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.freeze(v); for (const x of Object.values(v)) deepFreeze(x); } return v; };
    const frozen = deepFreeze(structuredClone(s));
    const rolls: HeroRoll[] = [
      { code: '11-15' }, { code: '11-15', saved: 'morr' }, { code: '16-21', more: [{ code: '36' }, { code: '56', d6: 6, hates: 'Orcs' }] },
      { code: '61', captured: { fate: 'ransomed', gold: 20 } }, { code: '61', captured: { fate: 'lost' } },
      { code: '65', pit: { won: false, then: { code: '35', games: 1 } } }, { code: '66' },
    ].map((r) => deepFreeze(r as HeroRoll));
    expect(() => {
      for (const r of rolls) core.injure(ctx(frozen), champ, { hero: r });
      core.injure(ctx(frozen), warr, deepFreeze({ d6: 1, member: 2 }));
      core.injure(ctx(frozen), frozen.hired![0]!.uid, deepFreeze({ d6: 1 }));
    }).not.toThrow();
    // the record keeps a copy, not the caller's object
    const r = { code: '22' } as HeroRoll;
    const n = core.injure(ctx(s), champ, { hero: r });
    expect((cas(n).injury as { hero: HeroRoll }).hero).not.toBe(r);
  });
});
