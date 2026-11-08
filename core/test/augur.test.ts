/* The Augur of the Sisters of Sigmar (reports of 7.11.2026): her Blessed Sight is given in the words of her page, not shortened; she never wears
   armour, which is a rule of her page and a limit of her list; and, by the Ultimate FAQ, she ignores the injury Blinded in one eye (RAW yes, RAI no:
   Augurs are already blind), which counts as Full Recovery. */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: core.WarbandState) => core.ctxOf(data, s);

function band(...units: string[]) {
  let s = core.newWarband(data, 'sos');
  for (const u of units) s = core.addUnit(ctx(s), u);
  return s;
}
const uidOf = (s: core.WarbandState, def: string) => s.models.find((m) => m.uid_def === def)!.uid;

describe('Blessed Sight', () => {
  it('is the rule of the Augur\'s page, whole, on her unit and in the tooltip', () => {
    const augur = data.WARBANDS.sos!.units.find((u) => u.id === 'augur')!;
    const rules = core.ruleDefs(augur.sp ?? '', 'x');
    const sight = rules.find((r) => r.name === 'Blessed Sight')!;
    expect(sight.text).toBe('An Augur can re-roll any failed characteristic tests (climbing, resisting spells or any other reason), and any rolls to hit in close combat or shooting. You must accept the second result. In addition, an Augur can use her Blessed Sight to help the Sisterhood when they are searching the city for wyrdstone. If the Augur is not put out of action in the battle, you may roll two dice for her in the exploration phase and pick either dice as the result.');
    const s = band('augur');
    const a = core.modelAbilities(ctx(s), core.unitDef(ctx(s), 'augur')!, s.models[0]!);
    const chip = a.abilities.find((x) => x.name === 'Blessed Sight')!;
    expect(core.tooltipInfo(data, chip.key)?.text).toBe(sight.text);
  });

  it('the Matriarch\'s Leader and Prayers of Sigmar are given whole as well', () => {
    const rules = core.ruleDefs(data.WARBANDS.sos!.units.find((u) => u.id === 'matri')!.sp ?? '', 'x');
    expect(rules.find((r) => r.name === 'Leader')!.text).toBe('Any warband member within 6" of the Sigmarite Matriarch may use her Leadership characteristic when taking any Leadership tests.');
    expect(rules.find((r) => r.name === 'Prayers of Sigmar')!.text).toMatch(/start with one prayer generated at random\. In addition the Sigmarite Matriarchs may learn a new Prayer instead of a new skill\.$/);
  });
});

describe('the Augur never wears armour', () => {
  it('says so as a rule of her page', () => {
    const rules = core.ruleDefs(data.WARBANDS.sos!.units.find((u) => u.id === 'augur')!.sp ?? '', 'x');
    expect(rules.map((r) => r.name)).toEqual(['Weapons/Armour', 'Blessed Sight']);
    expect(rules[0]!.text).toBe('The Augurs may be equipped with weapons chosen from the Sisters of Sigmar Equipment list. They never wear armour.');
  });

  it('is offered no armour from her list, and may not be given any', () => {
    const s = band('augur', 'matri');
    const helm = (data.LISTS[core.unitDef(ctx(s), 'augur')!.eq as string]!['Rüstung'] ?? [])[0]![0];
    expect(core.listProblem(ctx(s), uidOf(s, 'augur'), helm, 1)).toBe('never wears armour');
    expect(core.setListQty(ctx(s), uidOf(s, 'augur'), helm, 1)).toBe(s);
    expect(core.listProblem(ctx(s), uidOf(s, 'matri'), helm, 1)).toBe('');
  });
});

describe('Blinded in one eye', () => {
  const blinded = { hero: { code: '31' as const } };

  it('does nothing to an Augur: Full Recovery', () => {
    const s = band('augur');
    const after = core.injure(ctx(s), s.models[0]!.uid, blinded);
    expect(after.models[0]!.inj ?? []).toEqual([]);
    expect(core.heroRollText(ctx(s), blinded.hero, s.models[0]!)).toBe('Blinded in one eye, but she is already blind: Full Recovery');
    expect(core.heroRollText(ctx(s), blinded.hero, null)).toBe('Blinded in one eye');
  });

  it('also does nothing to her inside Multiple Injuries', () => {
    const s = band('augur');
    const after = core.injure(ctx(s), s.models[0]!.uid, { hero: { code: '16-21', more: [{ code: '31' }, { code: '33' }] } });
    expect((after.models[0]!.inj ?? []).map((i) => i.code)).toEqual(['33']);
  });

  it('still blinds another Hero', () => {
    const s = band('matri');
    const after = core.injure(ctx(s), s.models[0]!.uid, blinded);
    expect((after.models[0]!.inj ?? []).map((i) => i.code)).toEqual(['31']);
  });
});
