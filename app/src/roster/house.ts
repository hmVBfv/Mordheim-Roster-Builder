/* A warband's house rules (phase 3e, mockup docs/mockups/house-rules.html):
   every house rule of the Roster Builder in its groups, each with what the
   rules as written say. Off always means as written – so "Enforce
   equipment list", on by default, is offered the other way round as
   "Equipment beyond the lists". Switching a rule on starts it at a sensible
   value; its value then moves in steps. The changes are core's own house
   rule actions (setHouseNum, setHouseBool, setHsGrade …). */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';

type Kind = 'bool' | 'gc' | 'n' | 'pct' | 'price' | 'plus' | 'grades';

interface RuleDef {
  key: string;
  group: string;
  label: string;
  kind: Kind;
  /** What the rules as written say; a function when it depends on the warband. */
  std: string | ((plain: core.Ctx) => string);
  /** What the rule does when on, if the label does not say it. */
  on?: string;
  start?: number;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  grades?: string[];
}

export const GROUPS = [
  ['comp', 'The warband'], ['lead', 'Leader and advances'], ['cost', 'Prices'],
  ['access', 'What may be bought and carried'], ['hire', 'Hired Swords and Dramatis Personae'], ['show', 'Display'],
] as const;

const RULES: RuleDef[] = [
  { key: 'startGold', group: 'comp', label: 'Starting gold', kind: 'gc', std: (c) => `the warband’s own: ${core.startGold(c)} gc`, step: 50, min: 0, max: 5000 },
  { key: 'min', group: 'comp', label: 'Fewest models', kind: 'n', std: (c) => `the warband’s own: ${core.warbandDef(c)?.min ?? 3}`, step: 1, min: 1, max: 30 },
  { key: 'max', group: 'comp', label: 'Most models', kind: 'n', std: (c) => `the warband’s own: ${core.warbandMax(c)}`, step: 1, min: 1, max: 40 },
  { key: 'heroes', group: 'comp', label: 'Most Heroes', kind: 'n', std: '6', start: 5, step: 1, min: 1, max: 12 },
  { key: 'rangedCap', group: 'comp', label: 'Limit models with ranged weapons', kind: 'pct', std: 'no limit', start: 50, step: 5, min: 0, max: 100, unit: '% of the models at most' },
  { key: 'hireNewLeader', group: 'lead', label: 'A new leader may be hired', kind: 'bool', std: 'when the leader dies, the Hero with the highest Leadership takes over; no new leader can be hired' },
  { key: 'allSkills', group: 'lead', label: 'Heroes choose from every skill list', kind: 'bool', std: 'only from the lists of their type', on: 'Combat, Shooting, Academic, Strength and Speed for every Hero' },
  { key: 'priceAll', group: 'cost', label: 'All equipment', kind: 'price', std: '100 %', start: 80 },
  { key: 'priceArmour', group: 'cost', label: 'Armour', kind: 'price', std: '100 %', start: 80 },
  { key: 'priceBP', group: 'cost', label: 'Blackpowder weapons', kind: 'price', std: '100 %', start: 120 },
  { key: 'priceMissile', group: 'cost', label: 'Missile weapons', kind: 'price', std: '100 %', start: 120 },
  { key: 'clubSurcharge', group: 'cost', label: 'Clubs, maces and hammers', kind: 'plus', std: 'the list price', start: 2, step: 1, min: 1, max: 50 },
  { key: 'slingSurcharge', group: 'cost', label: 'Slings', kind: 'plus', std: 'the list price', start: 2, step: 1, min: 1, max: 50 },
  { key: 'freeDagger', group: 'cost', label: 'All daggers free', kind: 'bool', std: 'each warrior’s first dagger is free' },
  { key: 'anyEq', group: 'access', label: 'Equipment beyond the lists', kind: 'bool', std: 'the roster warns when a warrior carries what his list does not offer', on: 'no warning; saved as “Enforce equipment list: off”' },
  { key: 'freeMarket', group: 'access', label: 'Free market', kind: 'bool', std: 'only rare items the warband’s lists and rules allow are on offer', on: 'every rare and trading-post item is on offer' },
  { key: 'miscHench', group: 'access', label: 'Henchmen may take miscellaneous equipment', kind: 'bool', std: 'Heroes only' },
  { key: 'rerollOne', group: 'access', label: 'One re-roll item per warband', kind: 'bool', std: 'no limit', on: 'a second Lucky charm, rabbit’s foot, relic or familiar is warned about' },
  { key: 'hsGrades', group: 'hire', label: 'Hired Sword grades played', kind: 'grades', std: 'all grades', grades: ['1a', '1b', '1c', '2a'] },
  { key: 'dpGrades', group: 'hire', label: 'Dramatis Personae grades played', kind: 'grades', std: 'all grades', grades: ['core', '1a', '1b', '1c', '2a'] },
  { key: 'hsEquip', group: 'hire', label: 'They may buy equipment', kind: 'bool', std: 'their equipment is fixed', on: 'from the warband’s Hero equipment list' },
  // a display setting the Roster Builder kept with the house rules (proposed for More)
  { key: 'showRarity', group: 'show', label: 'Show rarity on the cards', kind: 'bool', std: 'off' },
];

export interface RuleView {
  key: string;
  group: string;
  label: string;
  kind: Kind;
  std: string;
  on: boolean;
  /** What it does when on, if the label does not say it. */
  effect: string;
  /** The value shown when on ('' for a switch); grades: which are played. */
  value: string;
  unit: string;
  grades: { grade: string; played: boolean }[];
  /** Armour only: body armour only. */
  bodyOnly: boolean | null;
  canLess: boolean;
  canMore: boolean;
}

const D = core.houseDefaults() as unknown as Record<string, unknown>;
const hr = (s: WarbandState) => core.houseRules(s) as unknown as Record<string, unknown>;

function isOn(h: Record<string, unknown>, r: RuleDef): boolean {
  if (r.key === 'anyEq') return h.eqLimitOn === false;
  if (r.key === 'rangedCap') return !!h.rangedCapOn;
  if (r.kind === 'grades') return Object.values((h[r.key] ?? {}) as Record<string, boolean>).some((v) => v === false);
  if (r.kind === 'bool') return !!h[r.key];
  return String(h[r.key]) !== String(D[r.key]);
}

function valueOf(h: Record<string, unknown>, r: RuleDef): string {
  const v = h[r.key];
  switch (r.kind) {
    case 'price': return `${v} %`;
    case 'gc': return `${v} gc`;
    case 'plus': return `+${v} gc each`;
    case 'pct': return `${v} %`;
    case 'n': return String(v);
    default: return '';
  }
}

const bounds = (r: RuleDef) => (r.kind === 'price' ? { min: 25, max: 200, step: 5 } : { min: r.min ?? 0, max: r.max ?? 999, step: r.step ?? 1 });

export function houseView(data: core.GameData, s: WarbandState): { groups: { key: string; label: string; rules: RuleView[] }[]; count: number } {
  const h = hr(s);
  const plain = core.ctxOf(data, { ...s, house: core.houseDefaults() });
  const rules = RULES.map((r): RuleView => {
    const on = isOn(h, r);
    const b = bounds(r);
    const n = Number(h[r.key]);
    const grades = r.grades?.map((g) => ({ grade: g, played: ((h[r.key] ?? {}) as Record<string, boolean>)[g] !== false })) ?? [];
    return {
      key: r.key, group: r.group, label: r.label, kind: r.kind,
      std: typeof r.std === 'function' ? r.std(plain) : r.std,
      on, effect: r.on ?? '', value: on ? valueOf(h, r) : '', unit: r.unit ?? '', grades,
      bodyOnly: r.key === 'priceArmour' && on ? !!h.armourBodyOnly : null,
      canLess: on && r.kind !== 'bool' && r.kind !== 'grades' && n - b.step >= b.min,
      canMore: on && r.kind !== 'bool' && r.kind !== 'grades' && n + b.step <= b.max,
    };
  });
  return {
    groups: GROUPS.map(([key, label]) => ({ key, label, rules: rules.filter((r) => r.group === key) })),
    count: rules.filter((r) => r.on).length,
  };
}

const ruleOf = (key: string) => RULES.find((r) => r.key === key);

/** Switches a house rule on (at its starting value) or back to the rules as written. */
export function setRule(ctx: core.Ctx, key: string, on: boolean): WarbandState {
  const r = ruleOf(key);
  if (!r || r.kind === 'grades') return ctx.s;
  const num = (k: Parameters<typeof core.setHouseNum>[1], v: unknown) => core.setHouseNum(ctx, k, v);
  switch (r.key) {
    case 'anyEq': return core.setHouseBool(ctx, 'eqLimitOn', !on);
    case 'rangedCap': {
      const s = core.setHouseBool(ctx, 'rangedCapOn', on);
      return core.setHouseNum(core.ctxOf(ctx.data, s), 'rangedCap', on ? r.start : 0);
    }
    case 'priceArmour': {
      const s = num('priceArmour', on ? r.start : 100);
      return on ? s : core.setHouseBool(core.ctxOf(ctx.data, s), 'armourBodyOnly', false);
    }
  }
  if (r.kind === 'bool') return core.setHouseBool(ctx, r.key as Parameters<typeof core.setHouseBool>[1], on);
  if (!on) return num(r.key as Parameters<typeof core.setHouseNum>[1], D[r.key]);
  // a rule without a fixed start begins where the warband stands now
  const plain = core.ctxOf(ctx.data, { ...ctx.s, house: core.houseDefaults() });
  const start = r.start ?? (r.key === 'startGold' ? core.startGold(plain) + 100 : r.key === 'min' ? (core.warbandDef(plain)?.min ?? 3) + 1 : core.warbandMax(plain) - 1);
  return num(r.key as Parameters<typeof core.setHouseNum>[1], start);
}

/** Moves a rule's value by one step (up or down), within its bounds. */
export function stepRule(ctx: core.Ctx, key: string, dir: 1 | -1): WarbandState {
  const r = ruleOf(key);
  if (!r || r.kind === 'bool' || r.kind === 'grades' || !isOn(hr(ctx.s), r)) return ctx.s;
  const b = bounds(r);
  const v = Number(hr(ctx.s)[r.key]) + dir * b.step;
  if (v < b.min || v > b.max) return ctx.s;
  return core.setHouseNum(ctx, r.key as Parameters<typeof core.setHouseNum>[1], v);
}

/** Armour at its house price: body armour only, or helmets and shields too. */
export function setBodyOnly(ctx: core.Ctx, on: boolean): WarbandState {
  return core.setHouseBool(ctx, 'armourBodyOnly', on);
}

/** Plays a grade of Hired Swords or Dramatis Personae, or not. */
export function setGrade(ctx: core.Ctx, key: 'hsGrades' | 'dpGrades', grade: string, played: boolean): WarbandState {
  return key === 'hsGrades' ? core.setHsGrade(ctx, grade, played) : core.setDpGrade(ctx, grade, played);
}

/** The declaration every export carries (core houseDeviations). */
export function declaration(ctx: core.Ctx): string {
  const d = core.houseDeviations(ctx);
  return d.length ? `House rules: ${d.map((x) => `${x.label}: ${x.value}`).join('; ')}` : '';
}

