/* A Spellcaster filter for the Hire lists (wish #120, Rob, 28.10.2026): who among the Hired Swords and the Dramatis Personae casts
   spells or prayers – a spell list of his own, or the rules text names a Wizard, Prayers or Funerary Rites. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const names = (table: Record<string, core.HireEntry>) => Object.values(table).filter((e) => core.hireIsCaster(e)).map((e) => e.name).sort();

describe('who is a spellcaster among the hires', () => {
  it('the Hired Swords with a spell list, and the priests that pray', () => {
    const list = names(data.HIREDSWORDS);
    for (const n of ['Warlock', 'Elf Mage', 'Norse Shaman', 'Warrior Priest of Sigmar', 'Witch', 'Dark Mage', 'The Fallen Sister', 'Wolf Priest of Ulric', 'Priest of Morr']) expect(list, n).toContain(n);
    for (const n of ['Dwarf Pathfinder', 'Gaoler', 'Tomb Robber', 'Bone Goliath']) expect(list, n).not.toContain(n);
  });

  it('the Dramatis Personae who cast, and not those who only resist magic', () => {
    const list = names(data.DRAMATIS);
    for (const n of ['Dark Emissary', 'Truthsayer']) expect(list.some((x) => x.includes(n)), n).toBe(true);
    expect(list.some((x) => x.includes('Abdul')), 'Abdul Alhazred, a Master Wizard').toBe(true);
    expect(list.some((x) => x.includes('Belandysh')), 'Belandysh resists fire').toBe(false);
    expect(list.some((x) => x.includes('Gwen')), 'Busty Gwen').toBe(false);
  });
});
