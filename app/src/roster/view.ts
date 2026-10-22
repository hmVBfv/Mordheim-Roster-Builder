/* What the roster screen shows, worked out by core's rules. Kept apart from
   the React components so it can be tested without drawing anything. */
import * as core from '@mordheim/core';
import type { GameData, HireRecord, Model, Profile, UnitDef, WarbandState } from '@mordheim/core';
import { hireFacts, warriorFacts, type Fact } from './tips.ts';

export type { Fact, Tip } from './tips.ts';

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
export interface XpView {
  value: number; steps: XpStep[]; next: number | null; min: number; max: number | null;
  /** Advances earned in play and not yet taken: the last reached steps wait for them. */
  owed: number;
}

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
  /** His special rules (Leader, Fear, Large Target …); each word on the
      card carries its rule text for the bubble (tips.ts). */
  rules: Fact[];
  equipment: Fact[];
  skills: Fact[];
  spells: Fact[];
  mutations: Fact[];
  /** Marauders: what the warband's Mark gives him (the Seer; the Chieftain once he took it). */
  mark: Fact[];
  injuries: Fact[];
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
  rules: Fact[]; skills: Fact[]; spells: Fact[];
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
  fallen: FallenView;
  recruit: RecruitGroup[];
}

/** One line of the Fallen: a Hero, a henchman with a name of his own, or the nameless of one kind counted together. */
export interface FallenEntry { name: string; count: number; xp: number; equipment: string[]; worth: number }
/** The dead of one unit, Heroes and Henchmen apart (a promoted man stays with the Heroes). */
export interface FallenGroup { key: string; kind: 'hero' | 'hench'; unit: string; count: number; xpTotal: number; xpEarned: number; equipment: string[]; goldLost: number; entries: FallenEntry[] }
export interface FallenView { count: number; goldLost: number; xpLost: number; groups: FallenGroup[] }

/* The Fallen as the Roster Builder lists them (legacy renderFallen): grouped
   by the kind of death and the unit, Heroes one by one, henchmen by name or,
   without one, counted together when they carried the same and had the same
   experience. Gold is what was really lost (core.fallenGoldOf), experience
   lost only what was earned in play (core.fallenExpEarned). */
export function fallenView(ctx: core.Ctx): FallenView {
  const all = ctx.s.fallen ?? [];
  const byType = new Map<string, core.FallenRecord[]>();
  for (const e of all) {
    const key = `${e.kind}|${e.uid_def || e.m?.uid_def}`;
    byType.set(key, [...(byType.get(key) ?? []), e]);
  }
  const xpOf = (e: core.FallenRecord) => Number(e.m && e.m.exp != null ? e.m.exp : e.exp) || 0;
  const groups = [...byType].map(([key, grp]): FallenGroup => {
    const first = grp[0]!;
    const ud = first.uid_def || first.m.uid_def;
    const unit = (ud && core.unitDef(ctx, ud)?.name) || core.modelLabel(ctx, first.m);
    const entry = (e: core.FallenRecord): FallenEntry => ({ name: e.m.name || unit, count: 1, xp: Number(e.m.exp) || 0, equipment: core.fallenEqAgg(ctx, [e.m]), worth: core.fallenGoldOf(ctx, e) });
    let entries: FallenEntry[];
    if (first.kind === 'hero') entries = grp.map(entry);
    else {
      const named = grp.filter((e) => { const n = (e.m.name || '').trim(); return !!n && n !== unit; });
      const subs = new Map<string, FallenEntry>();
      for (const e of grp) {
        if (named.includes(e)) continue;
        const sig = core.fallenEqSig(e.m);
        const su = subs.get(sig) ?? { name: unit, count: 0, xp: Number(e.exp) || 0, equipment: core.fallenEqAgg(ctx, [e.m]), worth: 0 };
        su.count++;
        su.worth += core.fallenGoldOf(ctx, e);
        subs.set(sig, su);
      }
      entries = [...named.map(entry), ...subs.values()];
    }
    return {
      key, kind: first.kind, unit, count: grp.length,
      xpTotal: grp.reduce((n, e) => n + xpOf(e), 0),
      xpEarned: grp.reduce((n, e) => n + core.fallenExpEarned(ctx, e), 0),
      equipment: core.fallenEqAgg(ctx, grp.map((e) => e.m)),
      goldLost: grp.reduce((n, e) => n + core.fallenGoldOf(ctx, e), 0),
      entries,
    };
  });
  return { count: all.length, goldLost: core.fallenGoldLost(ctx), xpLost: core.fallenExpLost(ctx), groups };
}

const show = (v: unknown) => (v == null || v === '' ? '–' : String(v));

function statCells(p: Profile | null, base: Profile | null | undefined, attacks?: string | number): StatCell[] {
  return STATS.map((k) => {
    const v = k === 'A' && attacks != null ? attacks : p?.[k];
    return { key: k, value: show(v), changed: base != null && p != null && String(p[k]) !== String(base[k]) };
  });
}

function track(thresholds: readonly number[], start: number, value: number, max: number | null = null, owed = 0): XpView {
  const next = thresholds.find((t) => t > value) ?? null;
  return {
    value, next, min: Math.min(start, value), max, owed,
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
  const facts = warriorFacts(ctx, m);
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
    xp: adv && !adv.noxp ? track(adv.thresholds, adv.start, adv.xp, null, Math.max(0, adv.earned - adv.applied)) : null,
    advanceDue: !!adv?.due,
    missGames: Number(m.miss) || 0,
    stats: statCells(p, def?.profile, p ? core.aDisp(ctx, m, p) : undefined),
    save: core.svLabel(core.svOfModel(ctx, m)),
    ...facts,
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
  const facts = hireFacts(ctx, rec, e, hs ? 'hs' : 'dp', rec.key);
  const adv = hs ? core.hsAdvanceStatus(ctx, rec, e) : null;
  return {
    key: `${kind}:${rec.uid}`, uid: rec.uid, name: rec.name || e.name, type: e.name, kind,
    exp: Number(rec.exp) || 0,
    xp: hs && adv ? track(core.HS_ADV, 0, core.hsExp(rec), core.HS_XP_MAX, Math.max(0, adv.earned - adv.applied)) : null,
    advanceDue: !!adv?.due,
    stats: statCells(core.hsEffProfile(rec, e), e.profile),
    ...facts,
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
    else if (umx != null && (st?.count ?? 0) >= umx) {
      // the Orc Mob's two ratios say what the limit rests on (report #46)
      const ratio = ctx.s.wb === 'orcmob' ? ({ goblin: 'at most two Goblins for each Orc', squig: 'never more Cave Squigs than Goblins' } as Record<string, string>)[u.id] : undefined;
      why = u.req ? 'the warband has its leader' : ratio ? `${ratio}: the warband has all ${umx} it may have` : `the warband has all ${umx} it may have`;
    }
    else if (hero && heroesFull) why = `the warband has its ${heroMaxOf(ctx)} Heroes`;
    return { id: u.id, name: u.name, count: st?.count ?? 0, limit: st?.limit ?? 'any', cost: core.unitBaseCost(ctx, u), exp: Number(u.exp) || 0, note: plainNote(u.sp), why };
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

/* ---------- the list: one compact row per warrior ---------- */

export type Tone = 'plain' | 'gold' | 'danger';
export interface Chip { label: string; tone: Tone }

/** What the list shows of one warrior or hired one: name, the whole profile,
    experience, what sets him apart and what he carries – at a glance. */
export interface UnitRow {
  key: string;
  kind: 'hero' | 'hench' | 'hired';
  name: string;
  /** Men in a henchman group; null for anyone else. */
  count: number | null;
  /** The line after the name: his type, or what kind of unit he is. */
  sub: string | null;
  stats: StatCell[];
  /** The armour save; null for those who show none (hired ones). */
  save: string | null;
  xp: XpView | null;
  exp: number;
  /** An advance waits to be taken. */
  ready: boolean;
  /** Leader, injuries, captivity … at most `CHIPS_IN_ROW`; the rest is counted. */
  chips: Chip[];
  chipsMore: number;
  /** Equipment and special rules in one line ("" when he carries nothing). */
  carries: string;
}

export const CHIPS_IN_ROW = 4;

export const isWarrior = (u: WarriorView | HireView): u is WarriorView => 'hero' in u;

/** What sets a warrior apart, in the order it matters (all of it; the row cuts it). */
export function unitChips(u: WarriorView | HireView): Chip[] {
  if (!isWarrior(u)) return [];
  const out: Chip[] = [];
  if (u.leader) out.push({ label: 'Leader', tone: 'gold' });
  if (u.promoted) out.push({ label: 'Promoted', tone: 'plain' });
  if (u.captive != null) out.push({ label: u.captive ? `Captive of ${u.captive}` : 'Captive', tone: 'danger' });
  if (u.retire) out.push({ label: 'Blind: must retire', tone: 'danger' });
  if (u.missGames > 0) out.push({ label: `Misses ${u.missGames} game${u.missGames > 1 ? 's' : ''}`, tone: 'danger' });
  for (const f of u.injuries) out.push({ label: f.label, tone: 'danger' });
  return out;
}

export function unitRow(u: WarriorView | HireView): UnitRow {
  const chips = unitChips(u);
  if (isWarrior(u)) {
    const group = !u.hero;
    return {
      key: u.key, kind: group ? 'hench' : 'hero', name: u.name, count: group ? u.count : null,
      sub: group ? (u.name !== u.type ? `${u.type} · group` : 'Henchman group') : u.name !== u.type ? u.type : null,
      stats: u.stats, save: u.save, xp: u.xp, exp: u.exp, ready: u.advanceDue,
      chips: chips.slice(0, CHIPS_IN_ROW), chipsMore: Math.max(0, chips.length - CHIPS_IN_ROW),
      carries: [...u.equipment, ...u.rules].map((f) => f.label).join(' · '),
    };
  }
  return {
    key: u.key, kind: 'hired', name: u.name, count: null,
    sub: `${u.kind}${u.name !== u.type ? ` · ${u.type}` : ''}`,
    stats: u.stats, save: null, xp: u.xp, exp: u.exp, ready: u.advanceDue,
    chips: [], chipsMore: 0,
    carries: u.rules.map((f) => f.label).join(' · '),
  };
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
    fallen: fallenView(ctx),
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
/* The data marks rule names with <b>; the recruit list shows plain text. */
const plainNote = (sp: string | undefined) => (sp ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<\/?[a-z][^>]*>/gi, '').replace(/\s{2,}/g, ' ').trim();

export function createWarband(data: GameData, key: string, subtype: string | null, name: string): WarbandState {
  let s = core.newWarband(data, key);
  if (subtype && subtype !== s.subtype) s = core.pickSubtype(core.ctxOf(data, s), subtype);
  const nm = name.trim();
  if (nm) s = core.setWarbandName(core.ctxOf(data, s), nm);
  return editableState(data, s);
}
