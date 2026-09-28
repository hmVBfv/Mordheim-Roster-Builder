/* Which rule a name means, for this warrior (docs/rules-audit.md, part A).
   Skills and abilities share names across warbands with different effects;
   the tooltip must show the one this warrior has, not the first in the data. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { Model, WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

/** A warband with one warrior of the given unit, and that warrior. */
function warrior(wb: string, unit: string, patch: Partial<Model> = {}): { s: WarbandState; m: Model } {
  let s = core.newWarband(data, wb);
  s = core.addUnit(ctx(s), unit);
  const m = { ...s.models[s.models.length - 1]!, ...patch };
  s = { ...s, models: s.models.map((x) => (x.uid === m.uid ? m : x)) };
  return { s, m };
}

function abilities(wb: string, unit: string, patch: Partial<Model> = {}) {
  const { s, m } = warrior(wb, unit, patch);
  return core.modelAbilities(ctx(s), core.unitDef(ctx(s), m.uid_def)!, m);
}

/** What the tooltip of a chip shows. */
const tip = (key: string) => core.tooltipInfo(data, key);
const chip = (a: core.ModelAbilities, name: string) => a.abilities.find((x) => x.name === name);
const skillTip = (a: core.ModelAbilities, name: string) => tip(a.skillKeys[a.skills.indexOf(name)]!);

describe('skills: the list of this warrior first', () => {
  it('Infiltration of a Skaven is the Skaven skill', () => {
    const a = abilities('skaven', 'adept', { skills: ['Infiltration'] });
    const want = data.SKILLSETS.skavenSkills!.skills.find((x) => x[0] === 'Infiltration')![1];
    expect(skillTip(a, 'Infiltration')?.text).toBe(want);
  });

  it('Bellowing Roar of a Beastman Chief is the Beastmen skill, not the Ogre one', () => {
    const a = abilities('beastmen', 'chief', { skills: ['Bellowing Roar'] });
    expect(skillTip(a, 'Bellowing Roar')?.line).toBe('Skill · ' + data.SKILLSETS.beastmenSkills!.name);
  });

  it('a skill is never shown as an item of a similar name', () => {
    const a = abilities('pirates', 'pcaptain', { skills: ['Swashbuckler'] });
    expect(skillTip(a, 'Swashbuckler')?.line).toMatch(/^Skill · /);
  });

  it('a standard skill still resolves', () => {
    const a = abilities('caravans', 'knight', { skills: ['Mighty Blow'] });
    expect(skillTip(a, 'Mighty Blow')?.line).toBe('Skill · Strength');
  });
});

describe('abilities: the rule as this unit defines it', () => {
  it('the Knights Vanguard chip shows their own Lightning Reflexes', () => {
    const a = abilities('caravans', 'knight');
    const c = chip(a, 'Lightning Reflexes')!;
    expect(tip(c.key)?.text).toMatch(/When charged, strikes first/);
  });

  it('the Senior Gunnery Officer leads within 12"', () => {
    const a = abilities('gunnery', 'sgo');
    expect(tip(chip(a, 'Leader')!.key)?.text).toMatch(/12"/);
  });

  it('Night Goblins get the Animosity of their own warband', () => {
    const a = abilities('nightgoblins', 'nightgob');
    expect(tip(chip(a, 'Animosity')!.key)?.text).toMatch(/Only Night Goblins are affected/);
  });
});

describe('abilities: no chip for a rule the unit only mentions', () => {
  it('a Witch-Hunter in the text is not the Hunter skill', () => {
    expect(chip(abilities('outlaws', 'ocleric'), 'Hunter')).toBeUndefined();
    expect(chip(abilities('reavers', 'shadow'), 'Hunter')).toBeUndefined();
  });

  it('"May Ride" is not the Outriders\' Ride skill', () => {
    expect(chip(abilities('forestgoblins', 'fgchief'), 'Ride')).toBeUndefined();
  });

  it('a unit exempt from All Alone does not get its chip', () => {
    expect(chip(abilities('bretonnian', 'paladin'), 'All Alone')).toBeUndefined();
    expect(chip(abilities('hochland', 'blackheart'), 'All Alone')).toBeUndefined();
  });
});

describe('exports: the warrior\'s own skill text', () => {
  it('the Tabletop Simulator card of a Beastman Chief carries the Beastmen Bellowing Roar', () => {
    const { s, m } = warrior('beastmen', 'chief', { skills: ['Bellowing Roar'] });
    const want = data.SKILLSETS.beastmenSkills!.skills.find((x) => x[0] === 'Bellowing Roar')![1];
    expect(core.ttsText(ctx(s), m)).toContain(`Bellowing Roar: ${want}`);
  });
});
