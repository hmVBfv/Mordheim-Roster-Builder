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
  it('Mercenaries: the Wolfcloak in the list of Middenheim Heroes only; Hung: warhorses at 40 gc', () => {
    const names = (wb: string, sub: string, id: string) => {
      const s = { ...core.newWarband(data, wb), subtype: sub } as WarbandState;
      return Object.values(core.eqListFor(core.ctxOf(data, s), unit(wb, id)) ?? {}).flat();
    };
    expect(names('merc', 'midd', 'capt').find((x) => x[0] === 'Wolfsumhang')).toEqual(['Wolfsumhang', 10, { heroes: true, sub: ['midd'] }]);
    expect(names('merc', 'reik', 'capt').map((x) => x[0])).not.toContain('Wolfsumhang');
    expect(names('ostermark', 'skMidd', 'ocaptain').map((x) => x[0])).not.toContain('Wolfsumhang');
    expect(names('maraudersofchaos', 'hung', 'chieftain').find((x) => x[0] === 'Warhorse')?.[1]).toBe(40);
    expect(names('maraudersofchaos', 'norse', 'chieftain').map((x) => x[0])).not.toContain('Warhorse');
  });
  it('Dwarf Rangers never learn Arcane Lore (the page says so)', () => {
    const s = core.newWarband(data, 'dwarfrangers');
    const skills = core.skillListsFor(core.ctxOf(data, s), unit('dwarfrangers', 'runesmith')).flatMap(([, sk]) => sk.map((x) => x[0]));
    expect(skills).toContain('Battle Tongue');
    expect(skills).not.toContain('Arcane Lore');
  });
  it('Cursed Cavalcade: "61 Captured!" for an enemy Hero is re-rolled once they hold two Henchmen or five Thralls', () => {
    expect(data.WARBANDS.cavalcade!.rules).toMatch(/re-rolled once you have captured two Henchmen or hold five Captured Thralls/);
  });
  it('Lizardmen: sacred markings for Heroes, poisons for Skinks', () => {
    for (const [l, nm, pr] of [['lizSaurus', 'Übergroße Kiefer', 40], ['lizSaurus', 'Mal der Alten', 50], ['lizSkink', 'Giftdrüsen', 40], ['lizSkinkPr', 'Giftdrüsen', 40],
      ['lizSkink', 'Dunkles Gift für Geschosse', 20], ['lizSkinkPr', 'Schwarzer Lotus für Geschosse', 10]] as const) expect(row(l, nm), nm).toEqual([nm, pr, { heroes: true }]);
    expect(row('lizSkinkHen', 'Reptiliengift')).toEqual(['Reptiliengift', 5]);
    expect(row('lizSaurus', 'Giftdrüsen')).toBeUndefined();
  });
  it('Carnival of Chaos: daemonic instability, the Nurglings’ flies, the Plague Cart profiles', () => {
    expect(unit('carnival', 'plaguebearer').sp).toMatch(/Daemonic Instability/);
    expect(unit('carnival', 'nurgling').sp).toMatch(/Cloud of Flies/);
    expect((unit('carnival', 'cart').attached as { label: string }[]).map((x) => x.label)).toEqual(['Cart', 'Wheel', 'Horse', 'Guardian']);
  });
});

/* docs/rules-audit.md, E: the catalogue's restrictions ("Dwarfs only") were
   text only, and the Trading Post offered such items to anyone. */
describe('catalogue restrictions', () => {
  // texts that are notes about price or rarity, or restrictions the warband
  // cannot express (the mount, the Khemri setting), not a list of who may buy
  const NOTES = ['1st free', '(Arabian/Khemri)', 'Common for Amazons (Lustria)', 'Common if warband includes Goblins',
    'Rare 6 for Warrior-Priests/Sisters', 'Warhorses only', 'cavalry only'];
  it('every restriction text has its data, or is a note', () => {
    const open = data.CATALOG.filter((x) => x.wb && !x.only && !NOTES.includes(x.wb)).map((x) => `${x.en}: ${x.wb}`);
    expect(open).toEqual([]);
    expect(data.CATALOG.filter((x) => x.only && NOTES.includes(x.wb)).map((x) => x.en)).toEqual([]);
  });
  it('names only warbands, variants and units that exist', () => {
    const bad: string[] = [];
    for (const x of data.CATALOG) {
      for (const e of [...(x.only?.wb ?? []), ...(x.only?.notWb ?? [])]) {
        const [w = '', units] = e.split('/');
        const [k = '', sub] = w.split(':');
        const wb = data.WARBANDS[k];
        if (!wb) { bad.push(`${x.en}: ${k}`); continue; }
        if (sub && !(wb.subtypes ?? []).some((s) => s.key === sub)) bad.push(`${x.en}: ${k}:${sub}`);
        for (const u of units ? units.split(',') : []) if (!wb.units.some((y) => y.id === u)) bad.push(`${x.en}: ${k}/${u}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it('Hired Swords of a race named in "hires" exist; Dwarfs only includes Dwarf Hired Swords', () => {
    const races = new Set([...Object.values(data.HIREDSWORDS), ...Object.values(data.DRAMATIS)].map((e) => e.race));
    const bad = data.CATALOG.flatMap((x) => (x.only?.hires ?? []).filter((r) => !races.has(r)).map((r) => `${x.en}: ${r}`));
    expect(bad).toEqual([]);
    // Rob, 29.09.2026: "Dwarfs only" holds for Dwarfs as Hired Swords too
    expect(data.CATALOG.filter((x) => x.wb === 'Dwarfs only').map((x) => x.only?.hires)).toEqual([['dwarf']]);
  });
  it('the Trading Post keeps to them', () => {
    const offered = (wb: string, sub: string | null, id: string, eq: string[] = []) => {
      let s = { ...core.newWarband(data, wb), subtype: sub } as WarbandState;
      s = core.addUnit(core.ctxOf(data, s), id);
      const uid = s.models[s.models.length - 1]!.uid;
      for (const e of eq) s = core.setEqQty(core.ctxOf(data, s), uid, e, 1);
      const m = s.models.find((x) => x.uid === uid)!;
      return core.rareEligibleItems(core.ctxOf(data, s), m).map((x) => x.en);
    };
    const merc = offered('merc', 'reik', 'capt', ['Schwert']);
    for (const x of ['Dwarf axe', 'Censer', 'Starblade', 'Trident', 'Pike']) expect(merc, x).not.toContain(x);
    expect(merc).toContain('Rapier');
    expect(offered('merc', 'midd', 'capt', ['Schwert'])).not.toContain('Rapier');
    expect(offered('hochland', null, 'prince')).toContain('Main gauche');
    expect(offered('skaven', null, 'runner')).toContain('Weeping blades');
    // who has the item in his own list keeps it, whatever the text says
    expect(cat('Zwergenaxt')?.only?.wb).toContain('pitfighters/trollslayer');
    expect(offered('kislev', null, 'capt')).toContain('Vodka');
    expect(offered('kislev', null, 'warrior')).not.toContain('Vodka');
    expect(offered('undead', null, 'vamp', ['Schwert'])).not.toContain('Garlic');
  });
});

/* Rob, 30.09.2026: "Bei den Rare Searches moechte ich auch sehen, was die
   Gegenstaende machen." 58 items of the catalogue had no rules text, so
   neither app could say what they do (mostly miscellaneous equipment:
   lantern, banner, tarot cards, the Mordheim map ...). */
describe('rules texts of the catalogue', () => {
  it('every item of the catalogue says what it does', () => {
    const bare = data.CATALOG.filter((x) => !core.itemInfo(data, x.de) && !core.itemInfo(data, x.en)).map((x) => x.en);
    expect(bare).toEqual([]);
  });
  it('an item gets its own text, not a neighbour\'s', () => {
    const name = (n: string) => core.itemInfo(data, n)?.name;
    expect(name('Banner')).toBe('Banner');
    expect(name('Clan Pestilens banner')).toBe('Clan Pestilens Banner');
    expect(name('Familiar')).toBe('Familiar');
    expect(name('Scroll of the Rat Familiar')).toBe('Scroll of the Rat Familiar');
    expect(name('Obsidianwaffe')).toBe('Obsidian weapon');
    expect(name('Zharr obsidian weapon')).toBe('Zharr obsidian weapon');
    expect(name('War Horn of Nagarythe')).toBe('War horn of Nagarythe');
    expect(name('Kleine Leiter')).toBe('Small ladder');
    expect(name('Große Leiter')).toBe('Large ladder');
  });
  // these showed the text of a plainer weapon whose pattern matched first
  // (the sword breaker the sword's, the Hammer of witches – a book – the mace's)
  it('a special weapon is not mistaken for the plain one', () => {
    const name = (n: string) => core.itemInfo(data, n)?.name;
    expect(name('Schwertbrecher')).toBe('Sword breaker');
    expect(name('Zwergenaxt')).toBe('Dwarf axe');
    expect(name('Disease Dagger')).toBe('Disease dagger');
    expect(name('Hexenhammer')).toBe('Hammer of witches');
    expect(name('Reiterhammer')).toBe("Horseman's hammer");
    expect(name('Sigmaritischer Kriegshammer')).toBe('Sigmarite warhammer');
    expect(name('Harpunenarmbrust')).toBe('Harpoon Crossbow');
    expect(name('Ostländer DL-Jagdbüchse')).toBe('Ostlander double-barrelled hunting rifle');
    expect(name('Ostländer DL-Pistole')).toBe('Ostlander double-barrelled pistol');
    // and the plain ones keep theirs
    expect(name('Schwert')).toBe('Sword');
    expect(name('Axt')).toBe('Axe');
    expect(name('Dolch')).toBe('Dagger');
    expect(name('Streitkolben')).toBe('Mace / Hammer / Club');
    expect(name('Armbrust')).toBe('Crossbow');
    expect(name('Pistole')).toBe('Pistol');
  });
  it('the brazier iron counts as two-handed, from its text', () => {
    const s = core.newWarband(data, 'wh');
    expect(core.isTwoHanded(core.ctxOf(data, s), 'Brazier Iron')).toBe(true);
  });
});
