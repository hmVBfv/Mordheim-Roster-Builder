/* Bug 256 (Rob, 12.11.2026): the spell texts were one-line summaries and missed rules the page on mordheimer.net has – for Lure of Chaos the end
   of the control, the suicide and the own-side rules; for the Liche Priest's scrolls the range. The text of each spell is now the page's own, with the
   FAQ and errata worked in where they add something. These tests pin the details that were lost, the corrections the errata make, and that no
   copy-and-paste debris is left in a text. */
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const text = (list: string, name: string): string => {
  const hit = data.SPELLS[list]!.spells.find(([n]) => n.replace(/\s*\(.*\)\s*$/, '') === name);
  if (!hit) throw new Error(`no spell ${name} in ${list}`);
  return hit[1];
};

describe('the spell texts keep what the page says (bug 256)', () => {
  it('Lure of Chaos has the end of the control, the suicide and own-side rules, and the FAQ rulings', () => {
    const t = text('chaosRituals', 'Lure of Chaos');
    expect(t).toMatch(/until the model passes a Leadership test in his own recovery phase/);
    expect(t).toMatch(/may not commit suicide/);
    expect(t).toMatch(/will not fight warriors from the Chaos Mage's warband/);
    expect(t).toMatch(/move 1" apart/);
    expect(t).toMatch(/FAQ: .*Leader's Leadership/);
    expect(t).toMatch(/control several models at once/);
  });

  it('the Liche Priest\'s scrolls name their range, which the page gives in its italic line', () => {
    expect(text('lichePriest', "Tawosret's Scroll of Tomb Dust")).toMatch(/12"/);
    expect(text('lichePriest', "Neferre's Scroll of Quaking Horror")).toMatch(/within 12"/);
  });

  it('the errata are the rule: Silver Arrows cannot be cast in close combat, Shadowbind tests on 1D6+1', () => {
    const arrows = text('lesserMagic', 'Silver Arrows of Arha');
    expect(arrows).toMatch(/cannot be cast whilst in hand-to-hand combat/);
    expect(arrows).toMatch(/ignore movement, range and cover penalties/);
    expect(arrows).toMatch(/FAQ: .*even after running/);
    const bind = text('shadowMagic', 'Shadowbind');
    expect(bind).toMatch(/Strength test on 1D6\+1/);
    expect(bind).not.toMatch(/2D6/);
  });

  it('the FAQ is worked into the spells it is about', () => {
    expect(text('necromancy', 'Spell of Awakening')).toMatch(/FAQ: .*5 points plus the experience/);
    expect(text('prayersSigmar', 'Hammer of Sigmar')).toMatch(/FAQ: .*maintained for many turns/);
    expect(text('prayersSigmar', 'Soulfire')).toMatch(/FAQ: .*above and below/);
    expect(text('markTchar', "Tchar's Reward")).toMatch(/FAQ: .*Injury chart/);
    expect(text('markShornaal', "Shornaal's Temptation")).toMatch(/FAQ: .*Scarecrow/);
    expect(text('lesserMagic', 'Flight of Zimmeran')).toMatch(/FAQ: .*leave close combat/);
    expect(text('chaosRituals', 'Word of Pain')).toMatch(/FAQ: .*never cause critical hits/);
  });

  it('tables are worked into the text, so a result is not lost: Eye of Hashut, Eye of God, Sotec\'s Blessing', () => {
    expect(text('chaosDwarfMagic', 'Eye of Hashut')).toMatch(/1 = .*out of action.*2-5 = .*one of its attributes.*6 = .*all attributes/);
    expect(text('chaosRituals', 'Eye of God')).toMatch(/D6: 1 = .*2-5 = .*6 = /);
    expect(text('lizardmenMagic', "Sotec's Blessing")).toMatch(/1-2 = \+1 BS.*3-4 = Toughness \+1.*5-6 = Movement and Initiative \+1/);
  });

  it('a note about the source of a page is not a spell rule', () => {
    expect(text('lichePriest', "Horrebe's Curse of the Mummy")).not.toMatch(/original source material/);
  });

  it('the Marauder list uses the same text as the mark lists it repeats', () => {
    const marks = ['markTchar', 'markShornaal', 'markOnogal'].flatMap((k) => data.SPELLS[k]!.spells);
    const rows = data.SPELLS.marauderChaos!.spells.filter(([n]) => !n.startsWith('▸'));
    expect(rows.length).toBeGreaterThan(8);
    for (const [name, t] of rows) expect(marks.find(([n]) => n === name)?.[1], name).toBe(t);
  });

  it('no spell text carries page debris: link markers, table bars, broken characters, curly quotes, a missing full stop', () => {
    for (const [key, list] of Object.entries(data.SPELLS)) {
      for (const [name, t] of list.spells) {
        if (name.startsWith('▸')) continue;
        expect(t, `${key}: ${name}`).not.toMatch(/\[\[|\||�|[“”‘’]|\s{2}|\s\)/);
        expect(t, `${key}: ${name}`).toMatch(/[.!?)"]$/);
      }
    }
  });

  it('Dark Elf Magic is the page\'s list: the names and difficulties, and the Doombolt with its range and its leap', () => {
    expect(data.SPELLS.darkElfMagic!.spells.map(([n]) => n)).toEqual(['Doombolt (9)', 'Word of Pain (8)', 'Soul Stealer (9)', 'Flamesword (8)', 'Deathspasm (10)', 'Witch Flight (7)']);
    expect(text('darkElfMagic', 'Doombolt')).toMatch(/18" range and causes a Strength 5 hit.*next closest model within 6" is also hit on a 4\+/);
    expect(text('darkElfMagic', 'Flamesword')).toMatch(/\+2 bonus to the users Strength.*ignore armour saves/);
    expect(text('darkElfMagic', 'Deathspasm')).toMatch(/closest enemy model.*knocked down/);
    expect(data.SPELLS.darkElfMagic!.lore!.Flamesword).toMatch(/twisted black flames/);
  });

  it('the Dwarf Rangers\' runes and the Wood Elves\' incantations carry the pages\' full words', () => {
    expect(text('dwarfRunes', 'Rune of Warding')).toMatch(/4\+ save vs\. spells.*belt, armband.*1 gc/);
    expect(data.SPELLS.dwarfRunes!.note).toMatch(/roll of 2.*destroyed/s);
    expect(text('woodlandIncantations', 'Song of Thorns')).toMatch(/If no plants are present wooden chips fly.*2D6 S1 hits, range 8"/);
    expect(text('woodlandIncantations', 'Song of the Sun')).toMatch(/scorching desert.*within 18"/);
  });

  it('the Beastmen Shaman casts the Chaos Rituals, as the page says, not a list of his own', () => {
    expect(data.WBEXTRA.beastmen!.magic).toBe('chaosRituals');
    expect(data.SPELLS.beastLore).toBeUndefined();
  });

  it('the notes of three lists say who may cast from them', () => {
    expect(data.SPELLS.chaosRituals!.note).toMatch(/Daemons, Beastmen/);
    expect(data.SPELLS.amazonRituals!.note).toMatch(/Priestess/);
    expect(data.SPELLS.prayersTaal!.note).toMatch(/Light Armour/);
  });
});
