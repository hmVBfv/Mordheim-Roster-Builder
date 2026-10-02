/* What the advance sheet offers (phase 3c). */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { data } from '../test/data.ts';
import { advanceView, HENCH_TABLE, HERO_TABLE, rowFor, takenOf } from './advance.ts';
import { createWarband } from './view.ts';

const ctx = (s: WarbandState) => core.ctxOf(data, s);

function band() {
  let s = createWarband(data, 'merc', null, '');
  for (const id of ['capt', 'young', 'warr']) s = core.addUnit(ctx(s), id);
  const [capt, young, warr] = s.models.map((m) => m.uid) as [number, number, number];
  s = core.setQty(ctx(s), warr, 3);
  return { s, capt, young, warr };
}

describe('the advance tables', () => {
  it('cover 2 to 12 without a gap, for Heroes and Henchmen', () => {
    for (const t of [HERO_TABLE, HENCH_TABLE]) {
      for (let r = 2; r <= 12; r++) expect(rowFor(t, r)).not.toBeNull();
      expect(rowFor(t, 1)).toBeNull();
      expect(rowFor(t, 13)).toBeNull();
    }
    expect(rowFor(HERO_TABLE, 7)!.stats).toEqual(['WS', 'BS']);
    expect(rowFor(HENCH_TABLE, 11)!.kind).toBe('talent');
  });
});

describe('a Hero', () => {
  it('learns from his own lists; what he knows is marked', () => {
    const b = band();
    let s = b.s;
    const { young } = b;
    const v0 = advanceView(ctx(s), young)!;
    expect(v0.kind).toBe('hero');
    expect(v0.table).toBe(HERO_TABLE);
    // a Youngblood: Combat, Shooting and Speed
    expect(v0.skills.map((g) => g.label)).toEqual(['Combat', 'Shooting', 'Speed']);
    const first = v0.skills[0]!.items[0]!;
    s = core.addSkillFromList(ctx(s), young, first.key);
    expect(advanceView(ctx(s), young)!.skills[0]!.items[0]!.known).toBe(true);
    expect(takenOf(ctx(s), young)!.skills.map((x) => x.name)).toEqual([first.key]);
  });

  it('may not raise a characteristic past his race\'s maximum', () => {
    const b = band();
    let s = b.s;
    const { capt } = b;
    const mx = core.maxInfo(ctx(s), s.models[0]!)!.prof;
    const base = core.unitDef(ctx(s), 'capt')!.profile!.WS as number;
    for (let i = base; i < (mx.WS as number); i++) s = core.addAdvance(ctx(s), capt, 'WS');
    const v = advanceView(ctx(s), capt)!;
    expect(v.canRaise.WS).toBe(false);
    expect(v.canRaise.BS).toBe(true);
    expect(v.maxNote).toMatch(/^Maximum \(/);
  });

  it('a caster may take a spell instead of a skill', () => {
    const f = Object.keys(data.WARBANDS).map((k) => {
      let s = createWarband(data, k, null, '');
      const caster = data.WARBANDS[k]!.units.find((u) => u.t === 'hero' && core.casterLore(ctx(s), { uid: 0, uid_def: u.id } as core.Model));
      if (!caster) return null;
      s = core.addUnit(ctx(s), caster.id);
      return { s, uid: s.models[0]!.uid };
    }).find(Boolean)!;
    const v = advanceView(ctx(f.s), f.uid)!;
    expect(v.spells).toMatchObject({ own: false });
    expect(v.spells!.items.length).toBeGreaterThan(0);
  });
});

describe('a group', () => {
  it('rolls on the Henchmen table and may raise each characteristic once', () => {
    const b = band();
    let s = b.s;
    const { warr } = b;
    const v = advanceView(ctx(s), warr)!;
    expect(v.kind).toBe('hench');
    expect(v.table).toBe(HENCH_TABLE);
    s = core.addAdvance(ctx(s), warr, 'I');
    expect(advanceView(ctx(s), warr)!.canRaise.I).toBe(false);
  });

  it('offers its men for "The lad\'s got talent", with the Heroes\' lists', () => {
    const { s, warr } = band();
    const t = advanceView(ctx(s), warr)!.talent!;
    expect('men' in t && t.men.map((m) => m.name)).toEqual(['Warrior 1', 'Warrior 2', 'Warrior 3']);
    expect('men' in t && t.lists.map((l) => l.key)).toEqual(core.availHeroCats(ctx(s)));
  });

  it('cannot when the warband has all its Heroes', () => {
    const b = band();
    let s = b.s;
    const { warr } = b;
    s = core.setHouseNum(ctx(s), 'heroes', 2);
    expect(advanceView(ctx(s), warr)!.talent).toEqual({ why: 'the warband has all the Heroes it may have: roll again' });
  });
});

describe('a Hired Sword', () => {
  it('rolls on the Heroes table with his own lists', () => {
    let { s } = band();
    s = core.hireHS(ctx(s), 'ogre');
    const uid = s.hired![0]!.uid;
    const v = advanceView(ctx(s), uid)!;
    expect(v.kind).toBe('hire');
    expect(v.table).toBe(HERO_TABLE);
    expect(v.skills.length).toBeGreaterThan(0);
    s = core.addHsAdvance(ctx(s), uid, 'S');
    expect(takenOf(ctx(s), uid)!.advances).toEqual([{ stat: 'S', n: 1 }]);
  });
});
