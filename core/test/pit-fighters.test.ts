/* Pit Fighters (report of 2.11.2026, Rob's answers): a man of the warband – the King, a Veteran, a Pit Fighter, a Pursuer – picks one
   fixed fighting style (a set of equipment: helmet, dagger and the rest); the dagger is the one in the set, so it is not bought on its
   own. A warband without a style for each of its men is not legal. The Troll Slayer and the Ogre choose from their own short lists. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const add = (s: WarbandState, id: string) => core.addUnit(ctx(s), id);
const model = (s: WarbandState, id: string) => s.models.find((m) => m.uid_def === id)!;
const STYLE = 'Orc-Stil (Helm/Dolch/Axt/Schild)';
const STYLE2 = 'Empire-Stil (Helm/Dolch/Zweihandw./Leichte R.)';
const style = (s: WarbandState) => core.warbandWarnings(ctx(s)).filter((w) => /fighting style/i.test(w));

describe('the dagger of a Pit Fighter', () => {
  it('is the one in his set: it is not offered on its own, to anybody of the warband, and still is to the others', () => {
    let s = core.newWarband(data, 'pitfighters');
    for (const id of ['pitking', 'pitveteran', 'pitfighter', 'pursuer']) s = add(s, id);
    for (const m of s.models) expect(core.rareEligibleItems(ctx(s), m).some((i) => i.de === 'Dolch'), m.uid_def).toBe(false);
    // the item itself is still there for warriors of other warbands whose list has no dagger of its own
    const offered = Object.keys(data.WARBANDS).filter((k) => k !== 'pitfighters').some((k) => {
      let w = core.newWarband(data, k);
      for (const u of data.WARBANDS[k]!.units.slice(0, 3)) w = core.addUnit(ctx(w), u.id);
      return w.models.some((m) => core.rareEligibleItems(ctx(w), m).some((i) => i.de === 'Dolch'));
    });
    expect(offered).toBe(true);
  });

  it('is still the first one free for the Troll Slayer and the Ogre, who choose from their own lists', () => {
    let s = core.newWarband(data, 'pitfighters');
    s = add(add(s, 'trollslayer'), 'ogrepit');
    for (const id of ['trollslayer', 'ogrepit']) {
      const list = core.eqListFor(ctx(s), core.unitDef(ctx(s), id))!;
      expect(list.Nahkampf!.some(([nm]) => nm === 'Dolch (1. gratis)'), id).toBe(true);
    }
  });
});

describe('the fighting style of a Pit Fighter warband', () => {
  it('has to be chosen for each man: a warband without one is not legal, and says who lacks it', () => {
    let s = core.newWarband(data, 'pitfighters');
    s = add(s, 'pitking');
    expect(style(s)).toEqual([expect.stringMatching(/Pit King.*fighting style/i)]);
    s = core.setEqQty(ctx(s), model(s, 'pitking').uid, STYLE, 1);
    expect(style(s)).toEqual([]);
  });

  it('counts a group man by man: three men need three styles, which may differ', () => {
    let s = core.newWarband(data, 'pitfighters');
    s = add(s, 'pitfighter');
    s = core.setQty(ctx(s), model(s, 'pitfighter').uid, 3);
    s = core.setEqQty(ctx(s), model(s, 'pitfighter').uid, STYLE, 2);
    expect(style(s)).toEqual([expect.stringMatching(/2 of 3/)]);
    s = core.setEqQty(ctx(s), model(s, 'pitfighter').uid, STYLE2, 1);
    expect(style(s)).toEqual([]);
  });

  it('is not asked of the Troll Slayer and the Ogre, nor of any other warband', () => {
    let s = core.newWarband(data, 'pitfighters');
    s = add(add(s, 'trollslayer'), 'ogrepit');
    expect(style(s)).toEqual([]);
    expect(style(add(core.newWarband(data, 'merc'), 'capt'))).toEqual([]);
  });
});
