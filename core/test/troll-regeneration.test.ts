/* Report of 7.11.2026: the Troll's Regeneration lacked the part after the battle. Every Troll has the rule as the page of the Black Orcs words it
   (mordheimer.net, special rules): the wound ignored on 4+, the fire exception, and no roll for Injury after a battle unless a flaming weapon
   or spell took it out of action. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: core.WarbandState) => core.ctxOf(data, s);

describe('the Regeneration of a Troll', () => {
  for (const [wb, id] of [['blackorcs', 'botroll'], ['orcmob', 'troll'], ['nightgoblins', 'troll']] as const) {
    it(`tells the whole rule on the ${wb} Troll`, () => {
      let s = core.newWarband(data, wb);
      for (const u of wb === 'blackorcs' ? ['bboss', id] : wb === 'orcmob' ? ['boss', id] : ['boss', id]) s = core.addUnit(ctx(s), u);
      const m = s.models.find((x) => x.uid_def === id)!;
      const regen = core.modelAbilities(ctx(s), core.unitDef(ctx(s), id)!, m).abilities.find((a) => a.name === 'Regeneration')!;
      expect(regen.text).toMatch(/4 or more the wound is ignored/);
      expect(regen.text).toMatch(/may not regenerate wounds caused by fire or fire-based magic/);
      expect(regen.text).toMatch(/never roll for Injury after a battle, unless they were taken Out of Action by a Flaming weapon or spell/);
      expect(regen.text).toMatch(/Then they roll after the battle as a normal Henchman/);
    });
  }

  /* Rob, 7.11.2026: the Night Goblins' Troll said it never rolls for Injury after a battle, without the exception for flames; the creator overlooked it,
     the Troll is the same as the others. */
  it('has no other word of its own on the injury roll after a battle: the Regeneration rule says it', () => {
    const bad: string[] = [];
    for (const [wb, w] of Object.entries(data.WARBANDS)) for (const u of w.units) if (/troll/i.test(u.name) && /never rolls? for injury/i.test(String(u.sp))) bad.push(`${wb}/${u.id}`);
    expect(bad).toEqual([]);
  });
});
