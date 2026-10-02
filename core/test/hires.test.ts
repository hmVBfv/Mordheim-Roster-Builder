/* Hiring from the Hire screen (phase 3d): why someone may not join, and
   hiring with the option chosen. New logic around the Roster Builder's
   hireHS / hireDP; these tests state the rules (rulebook p. 147 with the
   official errata). */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const band = (wb = 'merc') => core.newWarband(data, wb);

describe('who may join', () => {
  it('a Hired Sword this warband may hire, once', () => {
    const s = band();
    expect(core.hireProblem(ctx(s), 'hs', 'warlock')).toBe('');
    const n = core.hire(ctx(s), 'hs', 'warlock');
    expect(n.hired).toEqual([expect.objectContaining({ key: 'warlock', uid: 'hs1' })]);
    expect(core.hireProblem(ctx(n), 'hs', 'warlock')).toBe('already with the warband: one of each Hired Sword');
    expect(core.hire(ctx(n), 'hs', 'warlock')).toBe(n);
  });

  it('not one his rules keep away, with the reason', () => {
    // Witch Hunters hire no Warlock (rulebook p. 149)
    expect(core.hireProblem(ctx(band('wh')), 'hs', 'warlock')).toBe('not available to this warband type');
    expect(core.hire(ctx(band('wh')), 'hs', 'warlock')).toEqual(band('wh'));
  });

  it('not from a grade the warband does not play (house rule)', () => {
    const grade = data.HIREDSWORDS.warlock!.grade;
    const s = core.setHsGrade(ctx(band()), grade, false);
    expect(core.hireProblem(ctx(s), 'hs', 'warlock')).toBe(`grade ${grade} is not played by this warband (house rule)`);
  });

  it('Hired Swords do not count towards the warriors or Heroes (errata p. 147)', () => {
    let s = band();
    for (const id of ['capt', 'champ', 'champ', 'young', 'young']) s = core.addUnit(ctx(s), id);
    s = core.addUnit(ctx(s), 'warr');
    s = core.setQty(ctx(s), s.models.at(-1)!.uid, 5);
    s = core.hire(ctx(s), 'hs', 'warlock');
    expect(s.hired).toHaveLength(1);
    expect(core.totalHeroes(ctx(s))).toBe(5);
    expect(core.totalModels(ctx(s))).toBe(10);
  });

  it('one who takes a Hero’s place needs a free one', () => {
    let s = band();
    for (const id of ['capt', 'champ', 'champ', 'young', 'young']) s = core.addUnit(ctx(s), id);
    expect(core.hireProblem(ctx(s), 'hs', 'priestofmorr')).toBe('');
    s = structuredClone(s);
    s.house = { ...core.houseRules(s), heroes: 5 };
    expect(core.hireProblem(ctx(s), 'hs', 'priestofmorr')).toBe('he takes a Hero’s place, and the warband has its 5 Heroes');
  });

  it('gold is no reason: the roster warns when the warband spends more than it has', () => {
    let s = band();
    for (let i = 0; i < 3; i++) { s = core.addUnit(ctx(s), 'warr'); s = core.setQty(ctx(s), s.models.at(-1)!.uid, 5); }
    s = core.hire(ctx(s), 'hs', 'ogre', data.HIREDSWORDS.ogre!.opts!.choices[0]);
    s = core.hire(ctx(s), 'hs', 'warlock');
    s = core.hire(ctx(s), 'hs', 'freelancer');
    s = core.hire(ctx(s), 'hs', 'elfranger');
    s = core.hire(ctx(s), 'hs', 'pitfighter');
    expect(core.goldCurrent(ctx(s))).toBeLessThan(0);
    expect(core.warbandWarnings(ctx(s)).some((w) => w.startsWith('Not enough gold'))).toBe(true);
  });
});

describe('what is chosen when he is hired', () => {
  it('the Ogre’s weapons: chosen before, kept on the record', () => {
    const s = band();
    const ch = core.hireChoices(ctx(s), 'hs', 'ogre')!;
    expect(ch.label).toBe('Weapons');
    expect(core.hireProblem(ctx(s), 'hs', 'ogre')).toBe('choose weapons first');
    expect(core.hireProblem(ctx(s), 'hs', 'ogre', 'a pitchfork')).toBe('choose weapons first');
    const n = core.hire(ctx(s), 'hs', 'ogre', ch.choices[1]);
    expect(n.hired![0]!.opt).toBe(ch.choices[1]);
    expect(core.hsChosenEq(ctx(n), n.hired![0]!, data.HIREDSWORDS.ogre)).toContain(ch.choices[1]);
  });

  it('a character with several personas: which one, among those the warband may take', () => {
    const s = band('possessed');
    const ch = core.hireChoices(ctx(s), 'hs', 'emissary')!;
    expect(ch.choices).toContain('Mark of Nurgle');
    const n = core.hire(ctx(s), 'hs', 'emissary', 'Mark of Nurgle');
    expect(core.hsPersona(ctx(n), n.hired![0]!, data.HIREDSWORDS.emissary)!.name).toBe('Mark of Nurgle');
  });

  it('nothing to choose for most', () => {
    expect(core.hireChoices(ctx(band()), 'hs', 'warlock')).toBe(null);
    expect(core.hireChoices(ctx(band()), 'dp', 'nothing-like-this')).toBe(null);
    expect(core.hireProblem(ctx(band()), 'dp', 'nothing-like-this')).toBe('not in the rules data');
  });
});

describe('Dramatis Personae', () => {
  it('join once, if the warband may have them', () => {
    const s = band();
    const key = core.dpEligibility(ctx(s)).allowed.find((a) => !core.hireChoices(ctx(s), 'dp', a.key))!.key;
    const n = core.hire(ctx(s), 'dp', key);
    expect(n.dp).toEqual([expect.objectContaining({ key, uid: 'dp1' })]);
    expect(core.hireProblem(ctx(n), 'dp', key)).toBe('already with the warband');
    const no = core.dpEligibility(ctx(s)).blocked[0]!;
    expect(core.hireProblem(ctx(s), 'dp', no.key)).toBe(no.reason);
  });
});

it('leaves frozen inputs alone', () => {
  const deepFreeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.freeze(v); for (const x of Object.values(v)) deepFreeze(x); } return v; };
  const frozen = deepFreeze(structuredClone(band()));
  expect(() => { core.hire(ctx(frozen), 'hs', 'ogre', data.HIREDSWORDS.ogre!.opts!.choices[0]); core.hire(ctx(frozen), 'hs', 'warlock'); }).not.toThrow();
});
