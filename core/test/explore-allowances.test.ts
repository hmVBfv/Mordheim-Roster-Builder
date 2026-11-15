/* N6 (docs/plan-postbattle.md): what skills, items, Hired Swords and districts change in the exploration roll – found on the warband, offered
   by name, used once, recorded. Rob approved the table of rules on 14.11.2026. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.ts';
import type { Casualty, WarbandState } from '../src/index.ts';
import { loadGameData } from '../src/node.ts';

const data = loadGameData();
const ctx = (s: WarbandState) => core.ctxOf(data, s);

function band(extra: (s: WarbandState, hero: number) => WarbandState = (s) => s): { s: WarbandState; hero: number } {
  let s = { ...core.newWarband(data, 'merc'), campaign: { on: true, round: 1, districts: {} } } as WarbandState;
  for (const u of data.WARBANDS.merc!.units.filter((x) => x.req)) s = core.addUnit(ctx(s), u.id);
  const hero = s.models.find((m) => core.isHeroModel(ctx(s), m))!.uid;
  return { s: extra(s, hero), hero };
}
const names = (s: WarbandState) => core.exploreAllowances(ctx(s), 1).map((a) => a.id);
const withSkill = (skill: string) => band((s, hero) => ({ ...s, models: s.models.map((m) => (m.uid === hero ? { ...m, skills: [...(m.skills ?? []), skill] } : m)) }));
const withHire = (key: string) => band((s) => ({ ...s, hired: [...(s.hired ?? []), { key, uid: `hs-${key}` }] }));
const withDistrict = (id: string, hold: 'foothold' | 'control') => band((s) => ({ ...s, campaign: { ...s.campaign, districts: { [id]: hold } } }));
const casualty = (uid: number | string): Casualty => ({ id: 1, round: 1, battleId: null, victim: { uid: uid as number, name: 'x', wb: 'merc', grade: '', value: null }, attacker: { uid: null, name: 'y', wb: '', grade: '', value: null }, result: 'recovered', detail: '', fallenId: null, note: '' });
const outOfAction = (s: WarbandState, uid: number | string): WarbandState => ({ ...s, campaign: { ...s.campaign, casualties: [casualty(uid)] } });

describe('the data of the rules', () => {
  it('every rule has an effect, a source and exactly one origin that exists', () => {
    for (const r of data.PB_EXPLORE_RULES) {
      expect((r.dice ?? 0) + (r.reroll ?? 0) + (r.adjust ?? 0) + (r.drop ?? 0), r.id).toBeGreaterThan(0);
      expect(Object.keys(r.from).filter((k) => k !== 'tier'), r.id).toHaveLength(1);
      expect(r.text.length, r.id).toBeGreaterThan(10);
      if (r.from.hs) expect(data.HIREDSWORDS[r.from.hs], r.id).toBeDefined();
      if (r.from.district) expect(data.DISTRICTS.some((d) => d.id === r.from.district), r.id).toBe(true);
      if (r.from.item) expect(core.itemInfo(data, r.from.item)?.name.toLowerCase(), r.id).toBe(r.from.item.toLowerCase());
    }
    expect(new Set(data.PB_EXPLORE_RULES.map((r) => r.id)).size).toBe(data.PB_EXPLORE_RULES.length);
  });
});

describe('what the warband offers', () => {
  it('nothing for a warband without any of them', () => {
    expect(names(band().s)).toEqual([]);
  });

  it('a Hero’s skill: Wyrdstone Hunter re-rolls a die, Resource Hunter changes one by 1', () => {
    expect(core.exploreAllowances(ctx(withSkill('Wyrdstone Hunter').s), 1)).toMatchObject([{ id: 'wyrdstonehunter', reroll: 1, dice: 0, adjust: 0, drop: 0 }]);
    expect(names(withSkill('Resource Hunter').s)).toEqual(['resourcehunter']);
  });

  it('a skill of a Hero who was taken out of action is not offered, he did not search', () => {
    const { s, hero } = withSkill('Wyrdstone Hunter');
    expect(names(outOfAction(s, hero))).toEqual([]);
  });

  it('a Hired Sword: the Beggar adds a die, the Dwarf Pathfinder adds a die and discards one', () => {
    expect(core.exploreAllowances(ctx(withHire('beggar').s), 1)).toMatchObject([{ id: 'beggar', dice: 1 }]);
    expect(core.exploreAllowances(ctx(withHire('dwarfpathfinder').s), 1)).toMatchObject([{ id: 'dwarfpathfinder', dice: 1, drop: 1 }]);
  });

  it('a Hired Sword who was put out of action is not offered where the rule says so, and is where it does not', () => {
    expect(names(outOfAction(withHire('beggar').s, 'hs-beggar'))).toEqual([]);
    expect(names(outOfAction(withHire('elfranger').s, 'hs-elfranger'))).toEqual(['elfranger']);
  });

  it('a district the warband holds: control of the Poor Quarter gives a die, a foothold does not', () => {
    expect(names(withDistrict('poorquarter', 'control').s)).toEqual(['poorquarter']);
    expect(names(withDistrict('poorquarter', 'foothold').s)).toEqual([]);
    expect(names(withDistrict('cityhall', 'foothold').s)).toEqual(['cityhall']);
    expect(names(withDistrict('cityhall', 'control').s)).toEqual(['cityhall']);
  });

  it('an item a Hero carries: a Compass lets the warband re-roll all the dice', () => {
    const { s } = band((st, hero) => core.addRare(ctx(st), hero, 'compass'));
    const a = core.exploreAllowances(ctx(s), 1);
    expect(a.map((x) => x.id)).toEqual(['compass']);
    expect(a[0]).toMatchObject({ reroll: 6 });
  });
});

describe('recording what was used', () => {
  it('the allowances used are kept with the roll', () => {
    const { s } = withHire('beggar');
    const t = core.recordExploration(ctx(s), 1, { rolled: [3, 3], by: 'entered', used: ['beggar'] });
    expect((t.campaign as { postbattle: Record<string, { explore: { used?: string[] } }> }).postbattle['1']!.explore.used).toEqual(['beggar']);
  });

  it('an allowance the warband does not have is refused', () => {
    const { s } = band();
    expect(core.explorationProblem(ctx(s), 1, { rolled: [3], by: 'entered', used: ['beggar'] })).toMatch(/beggar|allowance/i);
    expect(core.recordExploration(ctx(s), 1, { rolled: [3], by: 'entered', used: ['beggar'] })).toBe(s);
  });

  it('the same allowance twice is refused: each is used once', () => {
    const { s } = withHire('beggar');
    expect(core.explorationProblem(ctx(s), 1, { rolled: [3, 3], by: 'entered', used: ['beggar', 'beggar'] })).toBeTruthy();
  });
});

describe('every mention of the exploration in the data is a rule or an exception', () => {
  // the sentences of the data that talk about the Exploration chart, found by a scan; lore (intro, unitLore) is not a rule
  const root = fileURLToPath(new URL('../../data', import.meta.url));
  const files = ['abilities', 'campaign', 'dramatis', 'equipment', 'hiredswords', 'skills'].map((f) => join(root, `${f}.json`))
    .concat(['warbands/_shared', ...readdirSync(join(root, 'warbands'), { withFileTypes: true }).filter((d) => d.isDirectory()).flatMap((d) => readdirSync(join(root, 'warbands', d.name)).map((f) => `warbands/${d.name}/${f.replace(/\.json$/, '')}`))].map((f) => join(root, `${f}.json`)));
  const pattern = /exploration|\bexplore\b|wyrdstone dice|searching for wyrdstone|piece of wyrdstone|pieces found/i;
  const norm = (x: string) => x.replace(/<[^>]+>/g, '').replace(/[−–]/g, '-').replace(/\s+/g, ' ').toLowerCase();
  const found: string[] = [];
  const walk = (x: unknown, key = ''): void => {
    if (Array.isArray(x)) x.forEach((v) => walk(v, key));
    else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { if (k !== 'intro' && k !== 'unitLore') walk(v, k); }
    else if (typeof x === 'string' && pattern.test(x)) found.push(norm(x));
  };
  for (const f of files) walk(JSON.parse(readFileSync(f, 'utf8')));
  const pieces = [...data.PB_EXPLORE_RULES.flatMap((r) => r.match), ...data.PB_EXPLORE_EXCEPTIONS.map((e) => e[0])].map(norm);

  it('a sentence about the Exploration chart that is neither modelled nor named with its reason fails here', () => {
    expect(found.length).toBeGreaterThan(40);
    const open = found.filter((s) => !pieces.some((p) => s.includes(p)));
    expect(open).toEqual([]);
  });

  it('and a rule or exception that matches no sentence any more is stale', () => {
    const stale = pieces.filter((p) => !found.some((s) => s.includes(p)));
    expect(stale).toEqual([]);
  });

  it('each exception says why', () => {
    for (const [needle, why] of data.PB_EXPLORE_EXCEPTIONS) { expect(needle.length).toBeGreaterThan(8); expect(why.length, needle).toBeGreaterThan(20); }
  });
});

describe('lasting advantages of the places (N8)', () => {
  const withPerk = (perk: object) => band((s) => ({ ...s, campaign: { ...s.campaign, perks: [perk] } }) as WarbandState);
  it('an Entrance to the Catacombs re-rolls one die, every time', () => {
    const { s } = withPerk({ id: 'catacombs-entrance', text: 'x', round: 1, key: '6 6 6 6 6', unique: true, explore: { reroll: 1 } });
    expect(core.exploreAllowances(ctx(s), 2)).toMatchObject([{ id: 'perk:catacombs-entrance', reroll: 1 }]);
    const t = core.recordExploration(ctx(s), 2, { rolled: [3], by: 'entered', used: ['perk:catacombs-entrance'] });
    expect(core.exploreAllowances(ctx(t), 3).map((a) => a.id)).toEqual(['perk:catacombs-entrance']);
  });
  it('the straggler’s insight is used once: a die more, one discarded – then it is gone', () => {
    const { s } = withPerk({ id: 'straggler', text: 'x', round: 1, key: '4 4', explore: { dice: 1, drop: 1 } });
    expect(core.exploreAllowances(ctx(s), 2)).toMatchObject([{ id: 'perk:straggler', dice: 1, drop: 1 }]);
    const t = core.recordExploration(ctx(s), 2, { rolled: [3, 4], by: 'entered', used: ['perk:straggler'] });
    expect(core.exploreAllowances(ctx(t), 3)).toEqual([]);
  });
});
