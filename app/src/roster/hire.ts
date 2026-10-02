/* What the Hire screen shows (phase 3d, mockup docs/mockups/hire.html):
   every Hired Sword and Dramatis Persona with his fee, upkeep and whether
   he may join this warband – and why not – and for the one picked,
   everything about him. Worked out by core (hireProblem, hireChoices, the
   Roster Builder's prices); kept apart from React to be tested on its own. */
import * as core from '@mordheim/core';
import type { HireEntry, HireRecord } from '@mordheim/core';
import { hireFacts, type Fact } from './tips.ts';
import { STATS, type StatCell } from './view.ts';

export type HireKind = core.HireKind;

/** One line of the list. */
export interface HireRow {
  kind: HireKind;
  key: string;
  name: string;
  grade: string;
  race: string;
  /** The fee now (a district may halve it), and as printed. */
  fee: number;
  baseFee: number;
  upkeep: number;
  rating: number;
  /** Why he may not join now ('' when he may); a choice still to be made
      in the sheet is not a reason here. */
  why: string;
  /** Already with the warband. */
  hired: boolean;
  /** A Dramatis Persona who stays for one battle. */
  wanderer: boolean;
  /** For the characteristic filter. */
  entry: HireEntry;
}

/** The grades of each list, in the order of the rules data. */
export function gradesOf(ctx: core.Ctx, kind: HireKind): string[] {
  const order = kind === 'hs' ? ctx.data.HS_GRADE_ORDER : ctx.data.DP_GRADE_ORDER;
  const table = kind === 'hs' ? ctx.data.HIREDSWORDS : ctx.data.DRAMATIS;
  const used = new Set(Object.values(table).map((e) => e.grade));
  return [...order.filter((g) => used.has(g)), ...[...used].filter((g) => !order.includes(g))];
}

function upkeepOf(ctx: core.Ctx, kind: HireKind, key: string, e: HireEntry): number {
  return kind === 'hs' ? core.hsUpkeepFor(ctx, key) : Number(e.upkeep) || 0;
}

export function hireRows(ctx: core.Ctx, kind: HireKind): HireRow[] {
  const table = kind === 'hs' ? ctx.data.HIREDSWORDS : ctx.data.DRAMATIS;
  return Object.keys(table).map((key) => {
    const e = table[key]!;
    const ch = core.hireChoices(ctx, kind, key);
    const why = core.hireProblem(ctx, kind, key, ch?.choices[0]);
    return {
      kind, key, name: e.name, grade: e.grade, race: core.raceEN(ctx.data, e.race),
      fee: kind === 'hs' ? core.hsHireCost(ctx, key) : core.dpHireCost(ctx, key),
      baseFee: Number(e.hire) || 0,
      upkeep: upkeepOf(ctx, kind, key, e),
      rating: Number(e.rating) || 0,
      why,
      hired: (kind === 'hs' ? core.hsCount(ctx, key) : core.dpCount(ctx, key)) > 0,
      wanderer: !!e.wanderer,
      entry: e,
    };
  });
}

export type HireOrder = 'name' | 'fee' | 'rating';

/** The list as filtered on the screen. "Only those this warband may hire"
    keeps those already with it, marked. */
export interface HireFilters {
  q: string;
  grades: ReadonlySet<string>;
  only: boolean;
  order: HireOrder;
  /** A characteristic compared, as in the Roster Builder (either profile of
      a pair counts); no stat or no value: no filter. */
  stat?: core.HireFilter;
}

export function filterRows(rows: HireRow[], f: HireFilters): HireRow[] {
  const q = f.q.trim().toLowerCase();
  const stat = { ...f.stat, q: '' };
  return rows
    .filter((r) => f.grades.has(r.grade) && (!f.only || !r.why || r.hired) && (!q || `${r.name} ${r.race}`.toLowerCase().includes(q)) && core.passStatFilter(r.entry, stat))
    .sort((a, b) => (f.order === 'name' ? 0 : a[f.order] - b[f.order]) || a.name.localeCompare(b.name));
}

/** The sheet of one Hired Sword or Dramatis Persona. */
export interface HireDetail {
  row: HireRow;
  src: string;
  /** His profile, and a second one (a pair hired together), if any; then
      both are named. */
  stats: StatCell[];
  first: string | null;
  second: { name: string; stats: StatCell[] } | null;
  equipment: string;
  skillLists: string[];
  experience: string;
  rules: Fact[];
  skills: Fact[];
  note: string;
  /** What has to be chosen before he is hired. */
  choices: { label: string; choices: string[] } | null;
  /** The district that halves his fee, if one does. */
  discount: string | null;
  /** He lets the warband have more warriors. */
  sizeBonus: number;
  /** He takes a Hero's place. */
  slot: boolean;
}

const cells = (p: core.Profile | undefined): StatCell[] => STATS.map((k) => ({ key: k, value: p?.[k] == null ? '–' : String(p[k]), changed: false }));

export function hireDetail(ctx: core.Ctx, kind: HireKind, key: string, opt?: string): HireDetail | null {
  const e = core.hireEntry(ctx, kind, key);
  const row = hireRows(ctx, kind).find((r) => r.key === key);
  if (!e || !row) return null;
  const rec: HireRecord = { key, uid: '', ...(opt ? { opt } : {}) };
  const facts = hireFacts(ctx, rec, e, kind, key);
  const persona = core.hsPersona(ctx, rec, e);
  const p2 = e.profile2 as { name?: string; p?: core.Profile } | undefined;
  const lists = [...(e.sk ?? [])].map((k) => ctx.data.SKILLLISTS[k]?.name ?? ctx.data.SKILLSETS[k]?.name ?? k);
  const district = core.activeDistrictEffects(ctx).find((x) => x.kind === 'hireHalf' && (x.keys ?? []).includes(key));
  return {
    row,
    src: e.src ?? '',
    stats: cells((persona?.profile as core.Profile | undefined) ?? e.profile),
    first: p2?.p ? String(e.profileName ?? e.name) : null,
    second: p2?.p ? { name: p2.name ?? 'Second', stats: cells(p2.p) } : null,
    equipment: core.hsChosenEq(ctx, rec, e),
    skillLists: lists,
    experience: e.noXP
      ? 'gains none'
      : 'as a Henchman (steps at 2, 5, 9 and 14); an advance is rolled on the Heroes’ table, skills from his lists',
    rules: facts.rules,
    skills: facts.skills,
    note: String(e.upkeepNote ?? ''),
    choices: core.hireChoices(ctx, kind, key),
    discount: district ? district.district : null,
    sizeBonus: Number(e.sizeBonus) || 0,
    slot: !!e.slot,
  };
}

/** The figures over the list. */
export interface HireFigures { gold: number; upkeep: number; hired: number; locked: boolean }

export function hireFigures(ctx: core.Ctx): HireFigures {
  return {
    gold: core.goldCurrent(ctx),
    upkeep: core.hsUpkeepTotal(ctx) + core.dpUpkeepTotal(ctx),
    hired: (ctx.s.hired ?? []).length + (ctx.s.dp ?? []).length,
    locked: core.tradeLocked(ctx),
  };
}
