/* Report of 6.11.2026: the Saurus name "Scaly Skin" and have the natural save in their stats; the Skinks have the same rule on the warband's page
   (6+) but neither the word nor the save. Every unit the warband's natural-save rule holds for names it. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: core.WarbandState) => core.ctxOf(data, s);

describe('the natural save of the Lizardmen', () => {
  const unit = (id: string) => {
    // the warband's own limits come first: a priest, a Skink to stand beside a Saurus
    let s = core.newWarband(data, 'lizardmen');
    for (const u of ['skinkpriest', 'skinkbrave', id]) s = core.addUnit(ctx(s), u);
    return { s, m: s.models.find((x) => x.uid_def === id)!, def: core.unitDef(ctx(s), id)! };
  };

  it('is 5+ for the Saurus and 6+ for every kind of Skink, each naming Scaly Skin', () => {
    for (const [id, sv] of [['saurusbrave', 5], ['saurustotem', 5], ['skinkbrave', 6], ['greatcrest', 6], ['skinkpriest', 6]] as const) {
      const { s, m, def } = unit(id);
      expect(core.svOfModel(ctx(s), m), `${id} save`).toBe(sv);
      expect(core.modelAbilities(ctx(s), def, m).abilities.map((a) => a.name), `${id} rule`).toContain('Scaly Skin');
    }
  });
});
