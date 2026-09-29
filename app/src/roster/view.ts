/* What the roster screen shows, worked out by core's rules. Kept apart from
   the React components so it can be tested without drawing anything. */
import * as core from '@mordheim/core';
import type { GameData, HireRecord, Model, Profile, WarbandState } from '@mordheim/core';

export const STATS = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld'] as const;

export interface StatCell { key: string; value: string; changed: boolean }

/** One step of the experience track: below the starting experience, reached,
    the next one, or still open. */
export interface XpStep { at: number; state: 'base' | 'on' | 'next' | 'open' }
/** The experience track as the Roster Builder draws it (legacy xpBar); null
    for those who gain no experience. */
export interface XpView { value: number; steps: XpStep[]; next: number | null }

export interface WarriorView {
  key: string;
  name: string;
  type: string;
  /** Men in a henchman group (1 for a Hero). */
  count: number;
  hero: boolean;
  promoted: boolean;
  leader: boolean;
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
  injuries: string[];
  /** Named men of a group. */
  members: string[];
}

export interface HireView {
  key: string; name: string; type: string; kind: 'Hired Sword' | 'Dramatis Personae';
  exp: number; xp: XpView | null; advanceDue: boolean; stats: StatCell[];
}

export interface RosterView {
  name: string;
  type: string;
  rating: number;
  gold: number;
  models: number;
  maxModels: number;
  campaign: string | null;
  warnings: string[];
  heroes: WarriorView[];
  henchmen: WarriorView[];
  hires: HireView[];
  fallen: string[];
}

const show = (v: unknown) => (v == null || v === '' ? '–' : String(v));

function statCells(p: Profile | null, base: Profile | null | undefined, attacks?: string | number): StatCell[] {
  return STATS.map((k) => {
    const v = k === 'A' && attacks != null ? attacks : p?.[k];
    return { key: k, value: show(v), changed: base != null && p != null && String(p[k]) !== String(base[k]) };
  });
}

function track(thresholds: readonly number[], start: number, value: number): XpView {
  const next = thresholds.find((t) => t > value) ?? null;
  return {
    value, next,
    steps: thresholds.map((at) => ({ at, state: at <= start ? 'base' : at <= value ? 'on' : at === next ? 'next' : 'open' })),
  };
}

function warrior(ctx: core.Ctx, m: Model): WarriorView {
  const def = core.unitDef(ctx, m.uid_def);
  const hero = core.isHeroModel(ctx, m);
  const p = core.effProfile(ctx, m);
  const adv = core.advanceStatus(ctx, m);
  const count = hero ? 1 : Math.max(1, Number(m.qty) || 1);
  return {
    key: String(m.uid),
    name: m.name || def?.name || m.uid_def,
    type: def?.name ?? m.uid_def,
    count, hero,
    promoted: !!m.promoted,
    leader: core.isLeaderModel(ctx, m),
    exp: Number(m.exp) || 0,
    xp: adv && !adv.noxp ? track(adv.thresholds, adv.start, adv.xp) : null,
    advanceDue: !!adv?.due,
    missGames: Number(m.miss) || 0,
    stats: statCells(p, def?.profile, p ? core.aDisp(ctx, m, p) : undefined),
    save: core.svLabel(core.svOfModel(ctx, m)),
    equipment: [...core.eqDisplayParts(ctx, m), ...core.rareDisplayParts(ctx, m)],
    skills: [...(m.skills ?? [])],
    spells: (m.spells ?? []).map((s) => s.name),
    mutations: (m.mut ?? []).map((x) => core.mutEN(ctx.data, x)),
    injuries: (m.inj ?? []).map((j) => j.name + core.injModText(j)),
    members: hero ? [] : (m.names ?? []).filter(Boolean).length ? core.memberNames(ctx, m) : [],
  };
}

function hire(ctx: core.Ctx, rec: HireRecord, kind: HireView['kind']): HireView | null {
  const e = kind === 'Hired Sword' ? ctx.data.HIREDSWORDS[rec.key] : ctx.data.DRAMATIS[rec.key];
  if (!e) return null;
  // Hired Swords gain experience on the Henchmen's steps; Dramatis Personae gain none
  const hs = kind === 'Hired Sword';
  return {
    key: `${kind}:${rec.uid}`, name: rec.name || e.name, type: e.name, kind,
    exp: Number(rec.exp) || 0,
    xp: hs ? track(core.HS_ADV, 0, core.hsExp(rec)) : null,
    advanceDue: hs && core.hsAdvanceStatus(ctx, rec, e).due,
    stats: statCells(core.hsEffProfile(rec, e), e.profile),
  };
}

export function rosterView(data: GameData, s: WarbandState): RosterView {
  const ctx = core.ctxOf(data, core.normalizeState(core.ctxOf(data, s)));
  const wb = core.warbandDef(ctx);
  const sub = wb?.subtypes?.find((x) => x.key === ctx.s.subtype);
  const models = ctx.s.models.map((m) => warrior(ctx, m));
  const camp = ctx.s.campaign;
  return {
    name: ctx.s.name || wb?.name || 'Warband',
    type: [wb?.name ?? String(ctx.s.wb), sub?.name].filter(Boolean).join(' – '),
    rating: core.totalRating(ctx),
    gold: core.goldCurrent(ctx),
    models: core.totalModels(ctx),
    maxModels: core.warbandMax(ctx),
    campaign: camp?.on ? core.roundLabel(camp.round) : null,
    warnings: core.warbandWarnings(ctx),
    heroes: models.filter((w) => w.hero),
    henchmen: models.filter((w) => !w.hero),
    hires: [
      ...(ctx.s.hired ?? []).map((h) => hire(ctx, h, 'Hired Sword')),
      ...(ctx.s.dp ?? []).map((h) => hire(ctx, h, 'Dramatis Personae')),
    ].filter((x): x is HireView => !!x),
    fallen: (ctx.s.fallen ?? []).map((f) => core.modelLabel(ctx, f.m)),
  };
}
