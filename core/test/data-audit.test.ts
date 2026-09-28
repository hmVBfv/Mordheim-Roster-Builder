/* Values corrected in the audit against mordheimer.net (docs/rules-audit.md,
   part B). Each holds what the warband page says, so a later edit of the
   data cannot quietly bring the old value back. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const unit = (wb: string, id: string) => data.WARBANDS[wb]!.units.find((u) => u.id === id)!;
const list = (key: string) => Object.values(data.LISTS[key]!).flat().map(([n, p]) => `${data.EQEN[n.replace(' (1. gratis)', '')] ?? n} ${p}`);
const skill = (set: string, name: string) => data.SKILLSETS[set]!.skills.find((x) => x[0] === name)?.[1];

function profileIn(wb: string, subtype: string, id: string) {
  const s = { ...core.newWarband(data, wb), subtype } as WarbandState;
  const s2 = core.addUnit(core.ctxOf(data, s), id);
  const m = s2.models[s2.models.length - 1]!;
  return core.effProfile(core.ctxOf(data, s2), m)!;
}

describe('Mercenaries (grade-1a-warbands/mercenaries)', () => {
  it('Middenheim: Captain and Champions start with Strength 4', () => {
    expect(profileIn('merc', 'midd', 'capt').S).toBe(4);
    expect(profileIn('merc', 'midd', 'champ').S).toBe(4);
    expect(profileIn('merc', 'reik', 'capt').S).toBe(3);
  });
  it('Reikland: Marksmen +1 BS, Leadership within 12"', () => {
    expect(profileIn('merc', 'reik', 'mark').BS).toBe(4);
    expect(profileIn('merc', 'midd', 'mark').BS).toBe(3);
    expect(unit('merc', 'capt').sp).toMatch(/12" in a Reikland warband/);
  });
  it('Expert Swordsmen only when charging', () => expect(unit('merc', 'sword').sp).toMatch(/when charging/));
});

describe('other warbands', () => {
  it('Witch Hunters: the Warrior Priest has no Burn the Witch!', () => expect(unit('wh', 'priest').sp).not.toMatch(/Burn the Witch/));
  it('Ostlanders: Ruffians and the Ogre have Ld 10', () => {
    expect(unit('ostlander', 'ruffian').profile!.Ld).toBe(10);
    expect(unit('ostlander', 'ogre').profile!.Ld).toBe(10);
  });
  it("Orcs: 'Ere We Go! ignores Fear, not Terror", () => {
    expect(skill('orcSkills', "'Ere We Go!")).not.toMatch(/Terror/);
    expect(skill('blackOrcSkills', "'Ere We Go!")).not.toMatch(/Terror/);
  });
  it('Beastmen: Fearless covers fear and All Alone, not terror', () => expect(skill('beastmenSkills', 'Fearless')).not.toMatch(/terror/i));
  it('Dwarf Rangers: the Apprentice Runesmith takes weapons only', () => expect(unit('dwarfrangers', 'apprentice').noArmour).toBe(true));
  it('Lizardmen: the Kroxigor does not count as two; Saurus wear Bone Helmets', () => {
    expect(unit('lizardmen', 'kroxigor').sp).not.toMatch(/counts as 2/);
    expect(list('lizSaurus').some((x) => x.startsWith('Helmet'))).toBe(false);
  });
  it('Outlaws: Double-handed weapon 15 gc; henchmen lists without hero items; no special skills; Cleric Academic only', () => {
    expect(list('outlawEq')).toContain('Double-handed weapon 15');
    expect(unit('outlaws', 'outlaw').eq).toBe('outlawHen');
    expect(unit('outlaws', 'omarksman').eq).toBe('outlawMark');
    expect(list('outlawHen').join()).not.toMatch(/Hunting arrows|Forest Cloak|Long ?bow|Light armour/i);
    expect(list('outlawMark').join()).not.toMatch(/Forest Cloak/i);
    for (const id of ['banditleader', 'ochampion', 'ocleric', 'pettythief']) expect(unit('outlaws', id).sk).not.toContain('banditSkills');
    expect(unit('outlaws', 'ocleric').sk).toEqual(['academic']);
  });
  it('Pit Fighters: the Dwarf axe is for the Slayer, armour for the Ogre', () => {
    expect(unit('pitfighters', 'trollslayer').eq).toBe('pfSlayer');
    expect(list('pfOgre').join()).not.toMatch(/Dwarf axe/i);
    expect(list('pfSlayer').join()).toMatch(/Dwarf axe/i);
  });
  it('Amazons (Mordheim) have no special skill list', () => {
    for (const id of ['priestess', 'champion', 'totem']) expect(unit('amazons', id).sk).not.toContain('amazonSkills');
  });
  it('Amazons (Lustria): the Conch Shell Horn is equipment, not a rule', () => expect(unit('amazonslustria', 'piranhawarrior').sp).toBe(''));
  it('Cursed Cavalcade: its own special skills', () => {
    expect(data.SKILLSETS.cavalcadeSkills!.skills.map((x) => x[0])).toEqual(['Noblesse Oblige', 'Torturer', 'Duelist']);
  });
  it('Court of the Profane Pleasures: Wretches pay for every dagger', () => expect(Object.values(data.LISTS.cppWretch!).flat().map((x) => x[0])).not.toContain('Dolch (1. gratis)'));
  it('Carnival of Chaos: daemonic instability, the Nurglings’ flies, the Plague Cart profiles', () => {
    expect(unit('carnival', 'plaguebearer').sp).toMatch(/Daemonic Instability/);
    expect(unit('carnival', 'nurgling').sp).toMatch(/Cloud of Flies/);
    expect((unit('carnival', 'cart').attached as { label: string }[]).map((x) => x.label)).toEqual(['Cart', 'Wheel', 'Horse', 'Guardian']);
  });
});
