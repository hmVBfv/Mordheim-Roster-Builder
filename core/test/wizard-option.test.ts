/* A Hero who may become a Wizard for a price (report of 5.11.2026): the Lustrian Reavers' Jungle Shadow (+30 gc, no starting Light Armour, one
   Lesser Magic spell) and the Cavalcade's Twisted Scholar (+10 gc). By default they are no Wizard. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);
const start = (wb: string, id: string) => {
  const s = core.addUnit(ctx(core.newWarband(data, wb)), id);
  return { s, uid: s.models[0]!.uid };
};
const model = (s: WarbandState, uid: number) => s.models.find((m) => m.uid === uid)!;

describe('data: who may become a Wizard', () => {
  it('names the price, and what goes', () => {
    expect(core.unitDef(ctx(start('reavers', 'shadow').s), 'shadow')!.wizardOption).toEqual({ cost: 30, drop: 'Light Armour' });
    expect(core.unitDef(ctx(start('cavalcade', 'scholar').s), 'scholar')!.wizardOption).toEqual({ cost: 10 });
  });

  it('is set on every unit whose rules say a Hero may be made a Wizard for gold', () => {
    const said = Object.entries(data.WARBANDS).flatMap(([k, w]) => w.units.filter((u) => /(?:pay|for)\s*\+\s*\d+\s*(?:gc|gold)[^.]*\bWizard\b|\bWizard\b[^.]*\+\s*\d+\s*(?:gc|gold)/i.test(u.sp ?? '')).map((u) => `${k}/${u.id}`));
    const has = Object.entries(data.WARBANDS).flatMap(([k, w]) => w.units.filter((u) => u.wizardOption).map((u) => `${k}/${u.id}`));
    expect(has.sort()).toEqual(said.sort());
  });
});

describe('the Jungle Shadow', () => {
  it('is no Wizard to begin with: no magic, no spell, his price and his Light Armour', () => {
    const { s, uid } = start('reavers', 'shadow');
    const m = model(s, uid);
    expect(core.casterLore(ctx(s), m)).toBeNull();
    expect(core.magicOfModel(ctx(s), m)).toBeNull();
    expect(core.unitGear(ctx(s), m)).toContain('Light Armour');
    expect(core.modelUnitCost(ctx(s), m)).toBe(90);
  });

  it('as a Wizard costs 30 gc more, loses the Light Armour and casts from the Lesser Magic', () => {
    const { s, uid } = start('reavers', 'shadow');
    const t = core.setWizard(ctx(s), uid, true);
    const m = model(t, uid);
    expect(core.modelUnitCost(ctx(t), m)).toBe(120);
    expect(core.unitGear(ctx(t), m)).toEqual(['Javelins', 'Dagger', 'Dagger']);
    expect(core.casterLore(ctx(t), m)).toBe('lesserMagic');
    expect(core.spellStartCount(ctx(t), core.unitDef(ctx(t), 'shadow'), m)).toBe(1);
    expect(core.eqDisplayItems(ctx(t), m).map((x) => x.label)).not.toContain('Light Armour');
    expect(core.goldCurrent(ctx(t))).toBe(core.goldCurrent(ctx(s)) - 30);
  });

  it('chooses his one spell from the list (rolled at the table), and a Wizard no more forgets it', () => {
    const { s, uid } = start('reavers', 'shadow');
    let t = core.setWizard(ctx(s), uid, true);
    const spell = data.SPELLS.lesserMagic!.spells[0]![0];
    t = core.addSpell(ctx(t), uid, spell);
    expect(model(t, uid).spells).toHaveLength(1);
    const back = core.setWizard(ctx(t), uid, false);
    expect(model(back, uid).spells ?? []).toEqual([]);
    expect(core.modelUnitCost(ctx(back), model(back, uid))).toBe(90);
    expect(core.unitGear(ctx(back), model(back, uid))).toContain('Light Armour');
  });

  it('is refused for a unit with no such option', () => {
    const { s, uid } = start('reavers', 'conqueror');
    expect(core.setWizard(ctx(s), uid, true)).toBe(s);
  });
});

describe('the Twisted Scholar', () => {
  it('is a Wizard for 10 gc and otherwise none', () => {
    const { s, uid } = start('cavalcade', 'scholar');
    expect(core.casterLore(ctx(s), model(s, uid))).toBeNull();
    const t = core.setWizard(ctx(s), uid, true);
    expect(core.casterLore(ctx(t), model(t, uid))).toBe('lesserMagic');
    expect(core.modelUnitCost(ctx(t), model(t, uid))).toBe(core.modelUnitCost(ctx(s), model(s, uid)) + 10);
  });
});
