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
const row = (key: string, nm: string) => Object.values(data.LISTS[key]!).flat().find((x) => x[0] === nm);
const cat = (de: string) => data.CATALOG.find((x) => x.de === de);

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
  it('Cursed Cavalcade: the Nightmare costs 30 gc at the founding, 95 gc at the Trading Post (Rob, C2)', () => {
    expect(row('ccArist', 'Nightmare')).toEqual(['Nightmare', 30, { start: true }]);
    expect(cat('Nightmare')).toMatchObject({ cost: 95, rare: 'Rare 11' });
  });
  it('Sons of Hashut: their obsidian weapon is renamed, 30 gc at the founding, 60 gc later (Rob, C3)', () => {
    expect(row('cdHero', 'Obsidianwaffe')).toBeUndefined();
    expect(row('cdHero', 'Zharr-Obsidianwaffe')).toEqual(['Zharr-Obsidianwaffe', 30, { start: true }]);
    expect(cat('Zharr-Obsidianwaffe')).toMatchObject({ cat: 'cc', cost: 60, rare: 'Rare 10' });
    expect(data.EQEN['Zharr-Obsidianwaffe']).toBe('Zharr obsidian weapon');
  });
  it('Tomb Guardians: the fixes the page implies (Rob, C4)', () => {
    expect(skill('tgSkills', 'Drive Chariot (Academic)')).toMatch(/Tomb Lord may learn it/);
    expect(data.WARBANDS.tombguardians!.rules).toMatch(/Home Ground:<\/b> \+1 die in the Exploration phase, in every campaign setting/);
    expect((data.LISTS.tgLord!.Fernkampf ?? []).map((x) => x[0])).not.toContain('Asp-Pfeile');
    expect((data.LISTS.tgLord!.Besonderes ?? []).map((x) => x[0])).toContain('Asp-Pfeile');
  });
  it('Ostermarkers: one Mercenary skill table for the whole warband, chosen at the founding (Rob, C6)', () => {
    const W = data.WARBANDS.ostermark!;
    expect(W.subtypes!.map((x) => x.name)).toEqual(['Reikland', 'Middenheim', 'Marienburg']);
    const merc = data.WARBANDS.merc!;
    const skSub = (w: typeof W, id: string) => w.units.find((u) => u.id === id)!.skSub as Record<string, string[]>;
    const keys = W.subtypes!.map((x) => x.key);
    ['reik', 'midd', 'mari'].forEach((city, i) => {
      expect(skSub(W, 'ochamp')[keys[i]!]).toEqual(skSub(merc, 'champ')[city]);
      expect(skSub(W, 'oyoung')[keys[i]!]).toEqual(skSub(merc, 'young')[city]);
    });
  });
  it('Shadow Warriors and Wood Elves: Ithilmar and the Nagarythe items at founding prices only (Rob, C7)', () => {
    for (const nm of ['Ithilmar-Schwert', 'Ithilmar-Speer', 'Ithilmar-Zweihandwaffe', 'Ithilmar-Rüstung', 'Standarte von Nagarythe', 'Kriegshorn von Nagarythe', 'Elfenwein', 'Elfenrunensteine']) expect(row('swHero', nm)?.[2], nm).toMatchObject({ start: true });
    expect(row('swHero', 'Ithilmar-Waffe')).toBeUndefined();
    expect(row('swHero', 'Ithilmar-Zweihandwaffe')?.[1]).toBe(30);
    for (const nm of ['Ithilmar-Schwert', 'Ithilmar-Speer', 'Ithilmar-Zweihandwaffe', 'Ithilmar-Rüstung']) expect(row('weHero', nm)?.[2], nm).toMatchObject({ start: true });
    expect(row('weHero', 'Elfenwein')?.[2]).toBeUndefined();
    expect(cat('Standarte von Nagarythe')).toMatchObject({ cost: '75+3D6', rare: 'Rare 9' });
    expect(cat('Kriegshorn von Nagarythe')).toMatchObject({ cost: '25+1D6', rare: 'Rare 6' });
  });
  it('Black Dwarfs: the Sorcerer may wear armour but performs no rituals in it, except in the Mechanical Suit (Rob, C8)', () => {
    expect(unit('blackdwarfs', 'sorcerer').sp).toMatch(/cannot perform rituals while wearing armour, except the Mechanical Suit/);
  });
  it('Black Dwarfs: the Mechanical Suit and the Engine of Chaos at founding prices', () => {
    expect(row('bdSorc', 'Mechanischer Anzug')).toEqual(['Mechanischer Anzug', 175, { start: true }]);
    for (const l of ['bdSorc', 'bdHero', 'bdGaoler', 'bdBull']) expect(row(l, 'Engine of Chaos')).toEqual(['Engine of Chaos', 125, { start: true }]);
  });
  it('Dwarfs: gromril armour at 75 gc and gromril weapons at three times the price only when founding', () => {
    for (const l of ['dwarfWarrior', 'dwarfRanger']) expect(row(l, 'Gromril-Rüstung')).toEqual(['Gromril-Rüstung', 75, { start: true }]);
    expect(data.UPGRADES['Gromril-Waffe']).toMatchObject({ mult: 4, start: { mult: 3, wb: ['dwarftreasure', 'dwarfrangers'] } });
    expect(data.UPGRADES['Dark-Elf-Klinge']).toMatchObject({ base: 20, start: { base: 15, wb: ['darkelves'] } });
  });
  it('Carnival of Chaos: daemonic instability, the Nurglings’ flies, the Plague Cart profiles', () => {
    expect(unit('carnival', 'plaguebearer').sp).toMatch(/Daemonic Instability/);
    expect(unit('carnival', 'nurgling').sp).toMatch(/Cloud of Flies/);
    expect((unit('carnival', 'cart').attached as { label: string }[]).map((x) => x.label)).toEqual(['Cart', 'Wheel', 'Horse', 'Guardian']);
  });
});
