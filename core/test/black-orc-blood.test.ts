/* Report of 7.11.2026: "Black Orc Blood" – one Young'un may be upgraded for 10 gc, which lets him take the Proven Warrior skill and become a
   full Black Orc – was only a line of text. A unit may offer an upgrade for gold (`upgradeOption`); one Young'un takes it, only he may choose the
   skill it names, and with the skill he counts as a Black Orc: his equipment, skill lists and rules are theirs, his profile and price stay his own. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: core.WarbandState) => core.ctxOf(data, s);

/** The Boss and two Young'uns; the first has the 25 experience the skill asks for. */
function band() {
  let s = core.newWarband(data, 'blackorcs');
  for (const u of ['bboss', 'young', 'young']) s = core.addUnit(ctx(s), u);
  const [, a, b] = s.models;
  s = core.setModelExp(ctx(s), a!.uid, 25);
  return { s, a: a!.uid, b: b!.uid };
}
const model = (s: core.WarbandState, uid: number) => s.models.find((m) => m.uid === uid)!;

describe('the Black Orc Blood upgrade of a Young\'un', () => {
  it('costs 10 gc, for one Young\'un of the warband and no other unit', () => {
    const { s, a, b } = band();
    const before = core.modelUnitCost(ctx(s), model(s, a));
    const s1 = core.setUnitUpgrade(ctx(s), a, true);
    expect(core.modelUnitCost(ctx(s1), model(s1, a))).toBe(before + 10);
    expect(model(s1, a).upgraded).toBe(true);
    // the second Young'un may not (and has not the experience either), the Boss may not
    expect(core.setUnitUpgrade(ctx(core.setModelExp(ctx(s1), b, 25)), b, true)).toEqual(core.setModelExp(ctx(s1), b, 25));
    expect(core.setUnitUpgrade(ctx(s1), s1.models[0]!.uid, true)).toBe(s1);
    // taken back, the price is back
    const s2 = core.setUnitUpgrade(ctx(s1), a, false);
    expect(core.modelUnitCost(ctx(s2), model(s2, a))).toBe(before);
    expect(model(s2, a).upgraded).toBeFalsy();
  });

  it('is the only way to the Proven Warrior skill', () => {
    const { s, a } = band();
    expect(core.lockedSkills(ctx(s), model(s, a))).toContain('Proven Warrior');
    expect(core.addSkillFromList(ctx(s), a, 'Proven Warrior')).toBe(s);
    const s1 = core.setUnitUpgrade(ctx(s), a, true);
    expect(core.lockedSkills(ctx(s1), model(s1, a))).not.toContain('Proven Warrior');
  });

  it('makes him a Black Orc with the skill: their rules, equipment and skill lists, his own profile and price', () => {
    const { s, a } = band();
    let t = core.setUnitUpgrade(ctx(s), a, true);
    const young = core.effProfile(ctx(t), model(t, a));
    const price = core.modelUnitCost(ctx(t), model(t, a));
    t = core.addSkillFromList(ctx(t), a, 'Proven Warrior');
    const m = model(t, a);
    expect(m.uid_def).toBe('borc');
    expect(m.statsOf).toBe('young');
    expect(core.effProfile(ctx(t), m)).toEqual(young);
    expect(core.modelUnitCost(ctx(t), m)).toBe(price);
    expect(core.unitDef(ctx(t), 'borc')!.sk).toContain('strength');
    expect(core.eqListFor(ctx(t), core.unitDef(ctx(t), m.uid_def)!)).toBe(core.eqListFor(ctx(t), core.unitDef(ctx(t), 'borc')!));
    // he cannot give the upgrade back as a Black Orc, and losing the skill makes him a Young'un again
    expect(core.setUnitUpgrade(ctx(t), a, false)).toBe(t);
    const back = core.removeSkill(ctx(t), a, model(t, a).skills!.indexOf('Proven Warrior'));
    expect(model(back, a).uid_def).toBe('young');
    expect(model(back, a).statsOf).toBeUndefined();
  });

  /* Rob, 7.11.2026, from the skill's text on mordheimer.net: "This skill may only be taken by a Young'un with the Black Orc blood ability and 25
     experience." The upgrade waits for the experience, and says why. */
  it('is bought from 25 experience, and says what is missing before', () => {
    let s = core.newWarband(data, 'blackorcs');
    for (const u of ['bboss', 'young']) s = core.addUnit(ctx(s), u);
    const uid = s.models[1]!.uid;
    expect(core.upgradeBlock(ctx(s), uid)).toMatch(/25 experience/);
    expect(core.setUnitUpgrade(ctx(s), uid, true)).toBe(s);
    s = core.setModelExp(ctx(s), uid, 24);
    expect(core.upgradeBlock(ctx(s), uid)).not.toBeNull();
    s = core.setModelExp(ctx(s), uid, 25);
    expect(core.upgradeBlock(ctx(s), uid)).toBeNull();
    expect(model(core.setUnitUpgrade(ctx(s), uid, true), uid).upgraded).toBe(true);
  });

  /* "... the model is now considered a full Black Orc Warrior (yet still retains the title of Young'un)": he has their rules, equipment and skill
     lists, and is counted as what his title says. */
  it('keeps the title of a Young\'un: he counts against the limit of Young\'uns, not of Black Orcs', () => {
    const { s, a } = band();
    const t = core.addSkillFromList(ctx(core.setUnitUpgrade(ctx(s), a, true)), a, 'Proven Warrior');
    expect(model(t, a).uid_def).toBe('borc');
    expect(core.countOf(ctx(t), 'young')).toBe(2);
    expect(core.countOf(ctx(t), 'borc')).toBe(0);
    expect(core.unitSummary(ctx(t)).heroes.find((r) => r.name === 'Young\'un')!.n).toBe(2);
  });
});
