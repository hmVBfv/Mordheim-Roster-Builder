/* What the roster screen shows, worked out by core's rules. Kept apart from
   the React components so it can be tested without drawing anything. */
import * as core from '@mordheim/core';
import type { GameData, HireRecord, Model, Profile, UnitDef, WarbandState } from '@mordheim/core';

export const STATS = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld'] as const;

/** The Roster Builder keeps a henchman group to five men (core setQty). */
export const GROUP_MAX = 5;

export interface StatCell { key: string; value: string; changed: boolean }

/** One step of the experience track: below the starting experience, reached,
    the next one, or still open. */
export interface XpStep { at: number; state: 'base' | 'on' | 'next' | 'open' }
/** The experience track as the Roster Builder draws it (legacy xpBar); null
    for those who gain no experience. `min`/`max` bound the stepper: never
    below the starting experience (unless the warrior already is), and a
    Hired Sword stops at the last step of the Henchmen's track. */
export interface XpView { value: number; steps: XpStep[]; next: number | null; min: number; max: number | null }

/** One man of a henchman group. */
export interface ManView { i: number; name: string; named: boolean }

/** Whether another man may join the group: what he costs, or why not. */
export type AddMan = { cost: number } | { why: string };

export interface WarriorView {
  key: string;
  uid: number;
  name: string;
  type: string;
  /** Men in a henchman group (1 for a Hero). */
  count: number;
  hero: boolean;
  promoted: boolean;
  leader: boolean;
  /** A Hero who may lead and does not yet. */
  canLead: boolean;
  /** He has fought his first battle: equipment at the Trading Post, no more
      mutations. Until then his own list is open (Rob, 02.10.2026). */
  fought: boolean;
  exp: number;
  xp: XpView | null;
  advanceDue: boolean;
  missGames: number;
  stats: StatCell[];
  save: string;
  equipment: string[];
  skills: string[];
  spells: string[];
  mutations: string[];
  /** Marauders: what the warband's Mark gives him (the Seer; the Chieftain once he took it). */
  mark: string[];
  injuries: string[];
  /** Blinded in both eyes: he must retire from the warband (rulebook, 31). */
  retire: boolean;
  /** Held captive (61): by whom, or '' when unknown; null when free. */
  captive: string | null;
  /** The men of a group, each by his name or the fallback ("Warriors 2"). */
  men: ManView[];
  /** For a group: another man, at what price or why not; null for a Hero. */
  addMan: AddMan | null;
}

export interface HireView {
  key: string; uid: string; name: string; type: string; kind: 'Hired Sword' | 'Dramatis Personae';
  exp: number; xp: XpView | null; advanceDue: boolean; stats: StatCell[];
  skills: string[]; spells: string[];
}

/** One line of the recruit list (legacy renderAddMenu). */
export interface RecruitUnit {
  id: string;
  name: string;
  /** Warriors of this type now (men for henchmen). */
  count: number;
  /** "any", "=1" (exactly, for the leader) or "0–3". */
  limit: string;
  cost: number;
  exp: number;
  /** The unit's special rules, as the Roster Builder shows them. */
  note: string;
  /** Why none may be recruited now, or null. */
  why: string | null;
}

export interface RecruitGroup { label: string; units: RecruitUnit[] }

export interface RosterView {
  name: string;
  type: string;
  rating: number;
  worth: number;
  gold: number;
  models: number;
  maxModels: number;
  heroes: WarriorView[];
  heroCount: number;
  heroMax: number;
  campaign: string | null;
  warnings: string[];
  henchmen: WarriorView[];
  hires: HireView[];
  fallen: string[];
  recruit: RecruitGroup[];
}

const show = (v: unknown) => (v == null || v === '' ? '–' : String(v));

function statCells(p: Profile | null, base: Profile | null | undefined, attacks?: string | number): StatCell[] {
  return STATS.map((k) => {
    const v = k === 'A' && attacks != null ? attacks : p?.[k];
    return { key: k, value: show(v), changed: base != null && p != null && String(p[k]) !== String(base[k]) };
  });
}

function track(thresholds: readonly number[], start: number, value: number, max: number | null = null): XpView {
  const next = thresholds.find((t) => t > value) ?? null;
  return {
    value, next, min: Math.min(start, value), max,
    steps: thresholds.map((at) => ({ at, state: at <= start ? 'base' : at <= value ? 'on' : at === next ? 'next' : 'open' })),
  };
}

const heroMaxOf = (ctx: core.Ctx) => Number(core.houseRules(ctx.s).heroes) || 6;

/** Why no further man may join this group (core setQty's limits), or ''. */
function addManBlock(ctx: core.Ctx, m: Model, def: UnitDef | null | undefined): string {
  const q = core.memberCount(m);
  if (q >= GROUP_MAX) return `the group is full with ${GROUP_MAX} men`;
  const umx = def ? core.unitMax(ctx, def) : null;
  if (def && umx != null && core.modelsOf(ctx, def.id) >= umx) return `the warband has all ${umx} it may have`;
  return '';
}

function warrior(ctx: core.Ctx, m: Model): WarriorView {
  const def = core.unitDef(ctx, m.uid_def);
  const hero = core.isHeroModel(ctx, m);
  const p = core.effProfile(ctx, m);
  const adv = core.advanceStatus(ctx, m);
  const count = hero ? 1 : core.memberCount(m);
  const leader = core.isLeaderModel(ctx, m);
  const block = hero ? '' : addManBlock(ctx, m, def);
  return {
    key: String(m.uid),
    uid: m.uid,
    name: m.name || def?.name || m.uid_def,
    type: def?.name ?? m.uid_def,
    count, hero,
    promoted: !!m.promoted,
    leader,
    canLead: !leader && core.canBeLeader(ctx, m),
    fought: core.warriorHasFought(ctx, m),
    exp: Number(m.exp) || 0,
    xp: adv && !adv.noxp ? track(adv.thresholds, adv.start, adv.xp) : null,
    advanceDue: !!adv?.due,
    missGames: Number(m.miss) || 0,
    stats: statCells(p, def?.profile, p ? core.aDisp(ctx, m, p) : undefined),
    save: core.svLabel(core.svOfModel(ctx, m)),
    equipment: [...core.eqDisplayParts(ctx, m), ...core.rareDisplayParts(ctx, m)],
    skills: [...(m.skills ?? [])],
    spells: (m.spells ?? []).map((s) => s.name),
    mutations: [...new Set(m.mut ?? [])].map((x) => {
      const n = (m.mut ?? []).filter((y) => y === x).length;
      return core.mutEN(ctx.data, x) + (n > 1 ? ` ×${n}` : '');
    }),
    mark: core.markRulesFor(ctx, m).map(([n]) => n),
    injuries: (m.inj ?? []).map((j) => j.name + core.injModText(j)),
    retire: (m.inj ?? []).filter((j) => j.code === '31').length >= 2,
    captive: m.captive ? m.captive.by : null,
    men: hero ? [] : core.memberNames(ctx, m).map((name, i) => ({ i, name, named: core.memberNamed(m, i) })),
    addMan: hero ? null : block ? { why: block } : { cost: core.henchRecruitCost(ctx, m) },
  };
}

function hire(ctx: core.Ctx, rec: HireRecord, kind: HireView['kind']): HireView | null {
  const e = kind === 'Hired Sword' ? ctx.data.HIREDSWORDS[rec.key] : ctx.data.DRAMATIS[rec.key];
  if (!e) return null;
  // Hired Swords gain experience on the Henchmen's steps; Dramatis Personae gain none
  const hs = kind === 'Hired Sword';
  return {
    key: `${kind}:${rec.uid}`, uid: rec.uid, name: rec.name || e.name, type: e.name, kind,
    exp: Number(rec.exp) || 0,
    xp: hs ? track(core.HS_ADV, 0, core.hsExp(rec), core.HS_XP_MAX) : null,
    advanceDue: hs && core.hsAdvanceStatus(ctx, rec, e).due,
    stats: statCells(core.hsEffProfile(rec, e), e.profile),
    skills: [...(rec.skills ?? [])],
    spells: (rec.spells ?? []).map((sp) => core.spellLabel(sp.name)),
  };
}

/** The recruit list, grouped as the Roster Builder groups it. */
function recruitList(ctx: core.Ctx): RecruitGroup[] {
  const wb = core.warbandDef(ctx);
  if (!wb) return [];
  const heroesFull = core.totalHeroes(ctx) >= heroMaxOf(ctx);
  const line = (u: UnitDef, hero: boolean): RecruitUnit => {
    const st = core.recruitStatus(ctx, u.id);
    const umx = st?.max;
    let why: string | null = null;
    if (st?.leaderGone) why = 'the leader has fallen; a surviving Hero takes command';
    else if (umx != null && (st?.count ?? 0) >= umx) why = u.req ? 'the warband has its leader' : `the warband has all ${umx} it may have`;
    else if (hero && heroesFull) why = `the warband has its ${heroMaxOf(ctx)} Heroes`;
    return { id: u.id, name: u.name, count: st?.count ?? 0, limit: st?.limit ?? 'any', cost: core.unitBaseCost(ctx, u), exp: Number(u.exp) || 0, note: u.sp ?? '', why };
  };
  const groups: [string, (u: UnitDef) => boolean, boolean][] = [
    ['Heroes', (u) => u.t === 'hero' && !u.vehicle, true],
    ['Henchmen', (u) => u.t === 'hen' && !u.vehicle, false],
    ['Vehicles (count as equipment)', (u) => !!u.vehicle, false],
  ];
  return groups
    .map(([label, f, hero]) => ({ label, units: wb.units.filter(f).map((u) => line(u, hero)) }))
    .filter((g) => g.units.length);
}

/** The state as the screens use it: read and tidied by core, as on load. */
export function editableState(data: GameData, s: WarbandState): WarbandState {
  return core.normalizeState(core.ctxOf(data, s));
}

export function rosterView(data: GameData, s: WarbandState): RosterView {
  const ctx = core.ctxOf(data, editableState(data, s));
  const wb = core.warbandDef(ctx);
  const sub = wb?.subtypes?.find((x) => x.key === ctx.s.subtype);
  const models = ctx.s.models.map((m) => warrior(ctx, m));
  const camp = ctx.s.campaign;
  const heroes = models.filter((w) => w.hero);
  return {
    name: ctx.s.name || wb?.name || 'Warband',
    type: [wb?.name ?? String(ctx.s.wb), sub?.name].filter(Boolean).join(' – '),
    rating: core.totalRating(ctx),
    worth: core.warbandWorth(ctx),
    gold: core.goldCurrent(ctx),
    models: core.totalModels(ctx),
    maxModels: core.warbandMax(ctx),
    campaign: camp?.on ? core.roundLabel(camp.round) : null,
    warnings: core.warbandWarnings(ctx),
    heroes,
    heroCount: core.totalHeroes(ctx),
    heroMax: heroMaxOf(ctx),
    henchmen: models.filter((w) => !w.hero),
    hires: [
      ...(ctx.s.hired ?? []).map((h) => hire(ctx, h, 'Hired Sword')),
      ...(ctx.s.dp ?? []).map((h) => hire(ctx, h, 'Dramatis Personae')),
    ].filter((x): x is HireView => !!x),
    fallen: (ctx.s.fallen ?? []).map((f) => core.modelLabel(ctx, f.m)),
    recruit: recruitList(ctx),
  };
}

/** The warband picker of a new roster: grouped by grade (core). */
export interface NewWarbandChoice { key: string; name: string; gold: number; subtypeLabel: string | null; subtypes: { key: string; name: string; gold: number }[] }

export function newWarbandChoice(data: GameData, key: string): NewWarbandChoice | null {
  const wb = data.WARBANDS[key];
  if (!wb) return null;
  const subtypes = (wb.subtypes ?? []).map((x) => ({ key: x.key, name: x.name ?? x.key, gold: Number(x.gold ?? wb.gold) || 0 }));
  return { key, name: wb.name, gold: Number(wb.gold) || 0, subtypeLabel: subtypes.length ? (wb.subtypeLabel ?? 'Variant') : null, subtypes };
}

/** A fresh roster, as the Roster Builder starts one (chooseWb, then the
    chosen subtype and the name). */
export function createWarband(data: GameData, key: string, subtype: string | null, name: string): WarbandState {
  let s = core.newWarband(data, key);
  if (subtype && subtype !== s.subtype) s = core.pickSubtype(core.ctxOf(data, s), subtype);
  const nm = name.trim();
  if (nm) s = core.setWarbandName(core.ctxOf(data, s), nm);
  return editableState(data, s);
}
