/* The rule texts behind the words on a roster card (Rob, 02.10.2026: the
   Roster Builder's tooltips are "essential and must be in"). Each word
   carries what core's lookups say about it – the same texts as the Trading
   Post and the Roster Builder show. */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { data, fixtures } from '../test/data.ts';
import { rosterView, type Fact } from './view.ts';

const ctx = (s: WarbandState) => core.ctxOf(data, s);
const byLabel = (facts: Fact[], label: string) => facts.find((f) => f.label === label);

describe('rule texts on the card', () => {
  it('a Captain: his rules in his own words, his sword, his skill, his injury', () => {
    let s = core.newWarband(data, 'merc');
    s = core.addUnit(ctx(s), 'capt');
    const uid = s.models[0]!.uid;
    s = core.setEqQty(ctx(s), uid, 'Schwert', 1);
    s = structuredClone(s);
    const skill = data.SKILLLISTS.combat!.skills[0]![0];
    s.models[0]!.skills = [skill];
    s.models[0]!.inj = [{ code: '22', name: 'Leg Wound', mod: { M: -1 } }, { name: 'Old Battle Wound' }, { name: 'Lost his hat' }];
    const w = rosterView(data, s).heroes[0]!;

    const leader = byLabel(w.rules, 'Leader')!;
    // the Mercenary Captain's own rule, not the general one: 12" in Reikland
    expect(leader.tips[0]).toMatchObject({ name: 'Leader', line: 'Special rule · Mercenary Captain' });
    expect(leader.tips[0]!.text).toContain('Reikland');

    expect(byLabel(w.equipment, 'Sword')!.tips).toEqual([{ name: 'Sword', line: 'Close combat · Strength: as user', text: expect.stringContaining('Parry') }]);
    expect(byLabel(w.equipment, 'Dagger')!.tips[0]!.name).toBe('Dagger');

    expect(byLabel(w.skills, skill)!.tips[0]).toMatchObject({ name: skill, line: 'Skill · Combat' });

    expect(byLabel(w.injuries, 'Leg Wound (-1 M)')!.tips).toEqual([{ name: 'Leg Wound', line: 'Serious injury · 22', text: 'Movement permanently −1.' }]);
    // an older save kept only the name
    expect(byLabel(w.injuries, 'Old Battle Wound')!.tips[0]).toMatchObject({ name: 'Old Battle Wound', line: 'Serious injury · 32' });
    // an injury the chart does not know stays a word
    expect(byLabel(w.injuries, 'Lost his hat')!.tips).toEqual([]);
  });

  it('a Rat Ogre: Fear, Large Target, Stupidity', () => {
    let s = core.newWarband(data, 'skaven');
    s = core.addUnit(ctx(s), 'ogre');
    const w = rosterView(data, s).henchmen[0]!;
    expect(w.rules.map((f) => f.label)).toEqual(expect.arrayContaining(['Fear', 'Large Target', 'Stupidity']));
    for (const f of w.rules) expect(f.tips[0]!.text).not.toBe('');
  });

  it('a mutation explains itself once: on its own line, not again among the rules', () => {
    let s = core.newWarband(data, 'possessed');
    const mutant = data.WARBANDS.possessed!.units.find((u) => u.mut)!;
    s = core.addUnit(ctx(s), mutant.id);
    s = structuredClone(s);
    s.models[0]!.mut = ['Dämonenseele'];
    const w = rosterView(data, s).heroes[0]!;
    expect(byLabel(w.mutations, 'Daemon Soul')!.tips[0]).toMatchObject({ name: 'Daemon Soul', text: expect.stringContaining('4+') });
    expect(byLabel(w.rules, 'Daemon Soul')).toBeUndefined();
  });

  it('a Hired Sword: his rules and his skills, his own wording first', () => {
    let s = core.newWarband(data, 'merc');
    s = core.hireHS(ctx(s), 'ogre');
    const h = rosterView(data, s).hires[0]!;
    expect(h.rules.map((f) => f.label)).toEqual(expect.arrayContaining(['Fear', 'Large Target']));
    for (const f of [...h.rules, ...h.skills]) expect(f.tips.length).toBeGreaterThan(0);
  });

  /* Every warband of the fixtures: the texts are plain, and nearly every
     word that names something has one. */
  it('for every kind of warband', () => {
    let words = 0, explained = 0;
    for (const f of fixtures) {
      const v = rosterView(data, f.state);
      const facts = [
        ...[...v.heroes, ...v.henchmen].flatMap((w) => [...w.rules, ...w.equipment, ...w.skills, ...w.spells, ...w.mutations, ...w.mark, ...w.injuries]),
        ...v.hires.flatMap((h) => [...h.rules, ...h.skills, ...h.spells]),
      ];
      for (const x of facts) {
        expect(x.label, f.label).not.toBe('');
        words++;
        if (x.tips.length) explained++;
        for (const t of x.tips) {
          expect(t.text, `${f.label}: ${x.label}`).not.toMatch(/<[a-z/]/i);
          expect(t.name, `${f.label}: ${x.label}`).not.toBe('');
        }
      }
    }
    expect(words).toBeGreaterThan(500);
    // what stays a word: the fixtures' made-up spells, a few Hired Swords'
    // skills the data has no text for, a warhound
    expect(explained / words).toBeGreaterThan(0.95);
  });
});
