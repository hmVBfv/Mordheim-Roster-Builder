/* The roster screen shows what core's rules say, for every kind of warband. */
import * as core from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { data, fixtures } from '../test/data.ts';
import { CHIPS_IN_ROW, createWarband, editableState, newWarbandChoice, rosterView, STATS, unitChips, unitRow } from './view.ts';

describe('roster view', () => {
  it.each(fixtures.filter((_, i) => i % 4 === 0).map((f) => [f.label, f] as const))('%s', (_l, f) => {
    const v = rosterView(data, f.state);
    const ctx = core.ctxOf(data, core.normalizeState(core.ctxOf(data, f.state)));
    expect(v.rating).toBe(core.totalRating(ctx));
    expect(v.gold).toBe(core.goldCurrent(ctx));
    expect(v.warnings).toEqual(core.warbandWarnings(ctx));
    expect(v.heroes.length + v.henchmen.length).toBe(ctx.s.models.length);
    for (const w of [...v.heroes, ...v.henchmen]) {
      expect(w.stats.map((c) => c.key)).toEqual([...STATS]);
      expect(w.name).not.toBe('');
    }
    expect(v.hires.length).toBe((ctx.s.hired ?? []).length + (ctx.s.dp ?? []).length);
  });

  /* Rob, 29.09.2026: experience was a bare number. The Roster Builder frames
     every step of the track, dashes those below the starting experience,
     fills those reached and marks the next one (legacy xpBar); Hired Swords
     follow the Henchmen's steps; Dramatis Personae gain none. */
  it('shows experience as the steps of the track', () => {
    let s = core.newWarband(data, 'merc');
    for (const id of ['capt', 'warr']) s = core.addUnit(core.ctxOf(data, s), id);
    s = core.hireHS(core.ctxOf(data, s), 'ogre');
    s = structuredClone(s);
    s.models[0]!.exp = 25;
    s.models[1]!.exp = 6;
    s.hired![0]!.exp = 5;
    const v = rosterView(data, s);
    const steps = (x: { steps: { at: number; state: string }[] } | null) => x?.steps.map((st) => `${st.at}:${st.state}`).join(' ');
    expect(steps(v.heroes[0]!.xp)).toBe('2:base 4:base 6:base 8:base 11:base 14:base 17:base 20:base 24:on 28:next 32:open 36:open 41:open 46:open 51:open 57:open 63:open 69:open 76:open 83:open 90:open');
    expect(v.heroes[0]!.xp?.next).toBe(28);
    expect(steps(v.henchmen[0]!.xp)).toBe('2:on 5:on 9:next 14:open');
    expect(steps(v.hires[0]!.xp)).toBe('2:on 5:on 9:next 14:open');
    expect(v.hires[0]!.advanceDue).toBe(true);
  });

  it('shows no track where there is no experience', () => {
    const noxp = fixtures.flatMap((f) => {
      const ctx = core.ctxOf(data, f.state);
      return f.state.models.filter((m) => core.unitDef(ctx, m.uid_def)?.noxp).map((m) => [f, m.uid] as const);
    })[0];
    expect(noxp).toBeDefined();
    const w = [...rosterView(data, noxp![0].state).henchmen, ...rosterView(data, noxp![0].state).heroes].find((x) => x.key === String(noxp![1]));
    expect(w?.xp).toBeNull();
    const dp = fixtures.map((f) => rosterView(data, f.state).hires.find((h) => h.kind === 'Dramatis Personae')).find(Boolean);
    expect(dp).toBeDefined();
    expect(dp!.xp).toBeNull();
  });

  it('marks what differs from the unit profile, and a group by its size', () => {
    const f = fixtures.find((x) => x.state.models.some((m) => Object.keys(m.adv ?? {}).length || (m.inj ?? []).some((j) => j.mod))) ?? fixtures[0]!;
    const v = rosterView(data, f.state);
    expect([...v.heroes, ...v.henchmen].some((w) => w.stats.some((c) => c.changed))).toBe(true);
    const g = fixtures.flatMap((x) => rosterView(data, x.state).henchmen).find((w) => w.count > 1);
    expect(g?.count).toBeGreaterThan(1);
  });
});

/* Phase 3a: what the screen needs to change a roster. */
describe('editing a roster', () => {
  const ctx = (s: core.WarbandState) => core.ctxOf(data, s);
  const fresh = () => createWarband(data, 'merc', null, 'The Grey Company');

  it('starts a warband as the Roster Builder does: name, variant and its gold', () => {
    const s = fresh();
    expect(s.name).toBe('The Grey Company');
    expect(rosterView(data, s).gold).toBe(data.WARBANDS.merc!.gold);
    const t = createWarband(data, 'tileans', 'trantio', '  ');
    expect(t.subtype).toBe('trantio');
    expect(t.name).toBe(data.WARBANDS.tileans!.name);
    const trantio = data.WARBANDS.tileans!.subtypes!.find((x) => x.key === 'trantio')!;
    expect(rosterView(data, t).gold).toBe(trantio.gold);
    expect(newWarbandChoice(data, 'merc')?.subtypes.map((x) => x.key)).toEqual(['reik', 'midd', 'mari']);
    expect(newWarbandChoice(data, 'nope')).toBeNull();
  });

  it('lists the units to recruit, grouped, with limits, prices and why not', () => {
    let s = fresh();
    const unit = (id: string) => rosterView(data, s).recruit.flatMap((g) => g.units).find((u) => u.id === id)!;
    expect(rosterView(data, s).recruit.map((g) => g.label)).toEqual(['Heroes', 'Henchmen']);
    expect(unit('capt')).toMatchObject({ limit: '=1', cost: core.unitBaseCost(ctx(s), core.unitDef(ctx(s), 'capt')!), why: null });
    s = core.addUnit(ctx(s), 'capt');
    expect(unit('capt').why).toBe('the warband has its leader');
    s = core.addUnit(ctx(s), 'champ');
    s = core.addUnit(ctx(s), 'champ');
    expect(unit('champ').why).toBe('the warband has all 2 it may have');
    s = core.setHouseNum(ctx(s), 'heroes', 3);
    expect(unit('young').why).toBe('the warband has its 3 Heroes');
    expect(unit('warr').why).toBeNull();
  });

  it('a limit that hangs on other units shows its current maximum and says why nothing more may join (#46)', () => {
    let s = createWarband(data, 'orcmob', null, 'Test');
    s = core.addUnit(ctx(s), 'boss');
    s = core.addUnit(ctx(s), 'goblin');
    s = core.setQty(ctx(s), s.models.find((m) => m.uid_def === 'goblin')!.uid, 2);
    const unit = (w: core.WarbandState, id: string) => rosterView(data, w).recruit.flatMap((g) => g.units).find((u) => u.id === id)!;
    expect(unit(s, 'goblin')).toMatchObject({ limit: '0–2', why: "the warband has all 2 it may have: at most 2 for each Orc Boss, Orc Shaman, Orc Big 'Un or Orc Boyz in the warband (1 now)" });
    expect(unit(s, 'squig')).toMatchObject({ limit: '0–2', why: null });
    const l = core.addUnit(ctx(createWarband(data, 'lizardmen', null, 'Test')), 'skinkpriest');
    expect(unit(l, 'saurusbrave')).toMatchObject({ limit: '0–0', why: 'the warband has all 0 it may have: never more than the Skink Brave in the warband (0 now)' });
  });

  it('shows the recruit notes of every warband as plain text, without markup', () => {
    const marked = Object.keys(data.WARBANDS).flatMap((key) => {
      const s = createWarband(data, key, null, 'Test');
      return rosterView(data, s).recruit.flatMap((g) => g.units).filter((u) => /<[^>]*>/.test(u.note)).map((u) => `${key}/${u.id}`);
    });
    expect(marked).toEqual([]);
    const goblin = rosterView(data, createWarband(data, 'orcmob', null, 'Test')).recruit.flatMap((g) => g.units).find((u) => u.id === 'goblin')!;
    expect(goblin.note).toContain('Not Orcs: Orcs expect little');
  });

  it('offers another man at his price, until the group or the unit is full', () => {
    let s = core.addUnit(ctx(fresh()), 'warr');
    const uid = s.models[0]!.uid;
    s = core.setModelExp(ctx(s), uid, 3);
    const group = () => rosterView(data, s).henchmen[0]!;
    expect(group().addMan).toEqual({ cost: core.henchRecruitCost(ctx(s), s.models[0]!) });
    s = core.setQty(ctx(s), uid, 5);
    expect(group().addMan).toEqual({ why: 'the group is full with 5 men' });
    expect(group().men.map((m) => m.name)).toEqual(core.memberNames(ctx(s), s.models[0]!));
    s = core.setMemberName(ctx(s), uid, 1, 'Bruno');
    expect(group().men.map((m) => m.named)).toEqual([false, true, false, false, false]);
    // a unit with a maximum: Marksmen, at most 7 in a Reikland warband
    let m = core.addUnit(ctx(fresh()), 'mark');
    const max = core.unitMax(ctx(m), core.unitDef(ctx(m), 'mark')!)!;
    m = core.setQty(ctx(m), m.models[0]!.uid, 5);
    m = core.addUnit(ctx(m), 'mark');
    m = core.setQty(ctx(m), m.models[1]!.uid, max - 5);
    expect(rosterView(data, m).henchmen[1]!.addMan).toEqual({ why: `the warband has all ${max} it may have` });
  });

  it('bounds the experience stepper: not below the start, a Hired Sword not past 14', () => {
    let s = core.addUnit(ctx(fresh()), 'capt');
    s = core.hireHS(ctx(s), 'ogre');
    const v = rosterView(data, s);
    expect(v.heroes[0]!.xp).toMatchObject({ value: 20, min: 20, max: null });
    expect(v.hires[0]!.xp).toMatchObject({ value: 0, min: 0, max: 14 });
    // a warrior below his starting experience (an old save) is not trapped
    s = core.setModelExp(ctx(s), s.models[0]!.uid, 5);
    expect(rosterView(data, s).heroes[0]!.xp).toMatchObject({ value: 5, min: 5 });
  });

  it('knows who may lead: a Hero who may, and does not yet', () => {
    let s = core.addUnit(ctx(fresh()), 'capt');
    s = core.addUnit(ctx(s), 'champ');
    const [capt, champ] = rosterView(data, s).heroes;
    expect(capt).toMatchObject({ leader: true, canLead: false });
    expect(champ).toMatchObject({ leader: false, canLead: true });
    expect(rosterView(data, core.setLeader(ctx(s), champ!.uid)).heroes.map((w) => w.leader)).toEqual([false, true]);
  });

  it('shows the worth of the warband', () => {
    const f = fixtures.find((x) => x.state.models.length > 3)!;
    expect(rosterView(data, f.state).worth).toBe(core.warbandWorth(core.ctxOf(data, editableState(data, f.state))));
  });

  it('counts the advances earned and not yet taken, so the bar can mark them', () => {
    let s = core.addUnit(ctx(fresh()), 'capt');
    s = core.addUnit(ctx(s), 'warr');
    s = core.hireHS(ctx(s), 'ogre');
    const uid = s.models[0]!.uid;
    // the Captain starts on 20: steps 24 and 28 reached make two advances waiting
    s = core.setModelExp(ctx(s), uid, 29);
    expect(rosterView(data, s).heroes[0]!.xp).toMatchObject({ owed: 2 });
    s = core.addAdvance(ctx(s), uid, 'WS');
    expect(rosterView(data, s).heroes[0]!.xp).toMatchObject({ owed: 1 });
    s = core.addAdvance(ctx(s), uid, 'I');
    expect(rosterView(data, s).heroes[0]!.xp).toMatchObject({ owed: 0 });
    expect(rosterView(data, s).heroes[0]!.advanceDue).toBe(false);
    // a Henchman group and a Hired Sword the same
    s = core.setModelExp(ctx(s), s.models[1]!.uid, 6);
    s = core.setHsExp(ctx(s), s.hired![0]!.uid, 3);
    const v = rosterView(data, s);
    expect(v.henchmen[0]!.xp).toMatchObject({ owed: 2 });
    expect(v.hires[0]!.xp).toMatchObject({ owed: 1 });
    // nothing to be taken: none owed
    expect(rosterView(data, core.addUnit(ctx(fresh()), 'capt')).heroes[0]!.xp).toMatchObject({ owed: 0 });
  });
});

describe('the row of a warrior in the list', () => {
  const ctx = (s: core.WarbandState) => core.ctxOf(data, s);
  const fresh = () => createWarband(data, 'merc', null, 'The Grey Company');
  const band = () => {
    let s = core.addUnit(ctx(fresh()), 'capt');
    s = core.addUnit(ctx(s), 'warr');
    s = core.hireHS(ctx(s), 'ogre');
    return rosterView(data, s);
  };

  it('has his name, what he is, the whole profile and his experience', () => {
    const v = band();
    const [hero] = v.heroes;
    const row = unitRow(hero!);
    expect(row).toMatchObject({ kind: 'hero', name: hero!.name, count: null, sub: null, exp: 20, ready: false, chipsMore: 0 });
    expect(row.stats.map((c) => c.key)).toEqual([...STATS]);
    expect(row.save).toBe(hero!.save);
    expect(row.xp).toBe(hero!.xp);
    // a Hero with a name of his own shows what he is
    expect(unitRow({ ...hero!, name: 'Ulrich the Grey' }).sub).toBe(hero!.type);
  });

  it('shows a group by its men and a hired one by his kind, without a save', () => {
    const v = band();
    const group = unitRow(v.henchmen[0]!);
    expect(group).toMatchObject({ kind: 'hench', count: 1, sub: 'Henchman group' });
    expect(unitRow({ ...v.henchmen[0]!, name: 'The Dogs' }).sub).toBe(`${v.henchmen[0]!.type} · group`);
    const hired = unitRow(v.hires[0]!);
    expect(hired).toMatchObject({ kind: 'hired', count: null, sub: 'Hired Sword', save: null, chips: [] });
    expect(unitRow({ ...v.hires[0]!, name: 'Grunt' }).sub).toBe(`Hired Sword · ${v.hires[0]!.type}`);
  });

  it('carries his equipment and special rules in one line, and says when an advance is ready', () => {
    const v = band();
    const hero = v.heroes[0]!;
    expect(unitRow(hero).carries).toBe([...hero.equipment, ...hero.rules].map((f) => f.label).join(' · '));
    expect(unitRow({ ...hero, advanceDue: true }).ready).toBe(true);
    expect(unitRow(v.hires[0]!).carries).toBe(v.hires[0]!.rules.map((f) => f.label).join(' · '));
  });

  it('puts what sets him apart in chips, the danger ones marked, and counts those that do not fit', () => {
    const hero = band().heroes[0]!;
    const all = { ...hero, leader: true, promoted: true, captive: 'Anna', missGames: 2, retire: true, injuries: [{ label: 'Leg Wound', tips: [] }] };
    expect(unitChips(all)).toEqual([
      { label: 'Leader', tone: 'gold' }, { label: 'Promoted', tone: 'plain' }, { label: 'Captive of Anna', tone: 'danger' },
      { label: 'Blind: must retire', tone: 'danger' }, { label: 'Misses 2 games', tone: 'danger' }, { label: 'Leg Wound', tone: 'danger' },
    ]);
    const row = unitRow(all);
    expect(row.chips).toHaveLength(CHIPS_IN_ROW);
    expect(row.chipsMore).toBe(2);
    expect(unitChips({ ...hero, leader: false, captive: '' }).map((c) => c.label)).toEqual(['Captive']);
    expect(unitChips({ ...hero, leader: false })).toEqual([]);
    expect(unitChips({ ...hero, leader: false, missGames: 1 }).map((c) => c.label)).toEqual(['Misses 1 game']);
  });
});

/* Rob, 19.10.2026: the Fallen showed only names; gold, equipment and the
   experience lost with them belong there, as in the Roster Builder. */
describe('the Fallen', () => {
  const c = (s: core.WarbandState) => core.ctxOf(data, s);
  /** A Captain, a Champion "Magda" (11 Exp, a sword bought) and three Warriors, one of them "Otto". */
  function band(): core.WarbandState {
    let s = createWarband(data, 'merc', null, 'The Grey Company');
    for (const id of ['capt', 'champ', 'warr']) s = core.addUnit(c(s), id);
    s = core.setQty(c(s), s.models[2]!.uid, 3);
    s = core.setMemberName(c(s), s.models[2]!.uid, 1, 'Otto');
    s = structuredClone(s);
    s.models[1]!.name = 'Magda';
    s.models[1]!.exp = 11;
    s.models[2]!.exp = 2;
    return s;
  }

  it('lists nothing while nobody has fallen', () => {
    const v = rosterView(data, band()).fallen;
    expect(v).toEqual({ count: 0, goldLost: 0, xpLost: 0, groups: [] });
  });

  it('groups the dead by Hero and Henchman and unit, with experience, equipment and gold lost', () => {
    let s = band();
    const champ = s.models[1]!.uid, warr = s.models[2]!.uid;
    s = core.killHero(c(s), champ);
    s = core.killHenchMember(c(s), warr, 0);
    s = core.killHenchMember(c(s), warr, 0); // Otto, now first of the group
    s = core.killHenchMember(c(s), warr, 0);
    const v = rosterView(data, s).fallen;
    const ctx = c(core.normalizeState(c(s)));
    expect(v.count).toBe(4);
    expect(v.goldLost).toBe(core.fallenGoldLost(ctx));
    expect(v.xpLost).toBe(core.fallenExpLost(ctx));
    expect(v.xpLost).toBe(9); // Magda earned 3 beyond her starting 8, each Warrior 2
    expect(v.groups.map((g) => [g.kind, g.unit, g.count])).toEqual([['hero', 'Champion', 1], ['hench', 'Warrior', 3]]);
    const [hero, hench] = v.groups as [typeof v.groups[0], typeof v.groups[0]];
    expect(hero.entries).toEqual([{ name: 'Magda', count: 1, xp: 11, equipment: core.fallenEqAgg(ctx, [ctx.s.fallen![0]!.m]), worth: core.fallenGoldOf(ctx, ctx.s.fallen![0]!) }]);
    expect(hero.xpEarned).toBe(3);
    // a man with a name of his own is remembered by it; the nameless are counted together
    expect(hench.entries.map((e) => [e.name, e.count, e.xp])).toEqual([['Otto', 1, 2], ['Warrior', 2, 2]]);
    expect(hench.goldLost).toBe(hench.entries.reduce((n, e) => n + e.worth, 0));
    expect(hench.xpTotal).toBe(6);
    expect(hench.equipment).toEqual(core.fallenEqAgg(ctx, ctx.s.fallen!.slice(1).map((f) => f.m)));
  });

  /* Wish #77: a planner shows its value in place of the gold in hand, and what each model's advances would need. */
  it('a planner shows its value, no gold to run out of, and the experience its advances need', () => {
    const made = createWarband(data, 'merc', null, 'The Late Company', true);
    expect(made.planner).toBe(true);
    expect(createWarband(data, 'merc', null, 'Plain').planner).toBeUndefined();
    let s = made;
    for (const id of ['capt', 'champ', 'warr']) s = core.addUnit(core.ctxOf(data, s), id);
    const champ = s.models.find((m) => m.uid_def === 'champ')!.uid;
    for (const st of ['S', 'T', 'W'] as const) s = core.addAdvance(core.ctxOf(data, s), champ, st);
    s = { ...s, stash: { ...s.stash!, gold: 5 } };
    const v = rosterView(data, s);
    expect(v.planner).toBe(true);
    expect(v.value).toBe(core.totalSpent(core.ctxOf(data, editableState(data, s))));
    expect(v.warnings.some((w) => /Not enough gold/.test(w))).toBe(false);
    expect(v.heroes.find((h) => h.uid === champ)!.expNeeded).toBeGreaterThan(0);
    // an ordinary warband has neither
    const plain = rosterView(data, core.addUnit(core.ctxOf(data, core.newWarband(data, 'merc')), 'capt'));
    expect(plain.planner).toBe(false);
    expect(plain.heroes[0]!.expNeeded).toBeNull();
  });
});

const ctx = (s: core.WarbandState) => core.ctxOf(data, s);

describe('the size bonus of a Halfling Scout stands apart from the maximum (#82)', () => {
  it('the maximum is the warband’s own, the bonus is named, the sum still limits', () => {
    const s = core.addUnit(ctx(core.newWarband(data, 'wh')), 'capt');
    const plain = rosterView(data, s);
    expect(plain).toMatchObject({ maxModels: 12, maxBonus: 0 });
    const scout = rosterView(data, core.hireHS(ctx(s), 'halfling'));
    expect(scout).toMatchObject({ maxModels: 13, maxBonus: 1 });
  });

  it('a house rule that sets the maximum names no bonus', () => {
    let s = core.addUnit(ctx(core.newWarband(data, 'wh')), 'capt');
    s = core.hireHS(ctx(s), 'halfling');
    s = core.setHouseNum(ctx(s), 'max', 10);
    expect(rosterView(data, s)).toMatchObject({ maxModels: 10, maxBonus: 0 });
  });
});
