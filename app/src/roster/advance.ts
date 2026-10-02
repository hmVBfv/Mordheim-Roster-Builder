/* What the advance sheet shows (phase 3c): the advance tables of the
   rulebook (Heroes and Henchmen; Hired Swords roll on the Heroes' table),
   and for one warrior which characteristics may still rise, the skills and
   spells he may learn and whether a man of a group may be promoted. Worked
   out by core; kept apart from React so it can be tested. */
import * as core from '@mordheim/core';
import type { HireRecord, Model, StatKey } from '@mordheim/core';

/** One row of an advance table: the 2D6 it covers and what it gives. */
export interface AdvRow {
  from: number;
  to: number;
  label: string;
  kind: 'skill' | 'stat' | 'talent';
  /** The characteristics on offer; with two, the rulebook's D6 or choice decides. */
  stats?: StatKey[];
  how?: string;
}

/* Rulebook, Experience – Advances (mordheimer.net, Campaigns – Experience). */
export const HERO_TABLE: AdvRow[] = [
  { from: 2, to: 5, label: 'New skill', kind: 'skill' },
  { from: 6, to: 6, label: '+1 Strength or +1 Attack', kind: 'stat', stats: ['S', 'A'], how: 'Roll a D6: 1–3 Strength, 4–6 Attack.' },
  { from: 7, to: 7, label: '+1 Weapon Skill or +1 Ballistic Skill', kind: 'stat', stats: ['WS', 'BS'], how: 'Choose one.' },
  { from: 8, to: 8, label: '+1 Initiative or +1 Leadership', kind: 'stat', stats: ['I', 'Ld'], how: 'Roll a D6: 1–3 Initiative, 4–6 Leadership.' },
  { from: 9, to: 9, label: '+1 Wound or +1 Toughness', kind: 'stat', stats: ['W', 'T'], how: 'Roll a D6: 1–3 Wound, 4–6 Toughness.' },
  { from: 10, to: 12, label: 'New skill', kind: 'skill' },
];

export const HENCH_TABLE: AdvRow[] = [
  { from: 2, to: 4, label: '+1 Initiative', kind: 'stat', stats: ['I'] },
  { from: 5, to: 5, label: '+1 Strength', kind: 'stat', stats: ['S'] },
  { from: 6, to: 7, label: '+1 Ballistic Skill or +1 Weapon Skill', kind: 'stat', stats: ['BS', 'WS'], how: 'Choose one.' },
  { from: 8, to: 8, label: '+1 Attack', kind: 'stat', stats: ['A'] },
  { from: 9, to: 9, label: '+1 Leadership', kind: 'stat', stats: ['Ld'] },
  { from: 10, to: 12, label: "The lad's got talent", kind: 'talent' },
];

export const STAT_NAMES: Record<string, string> = { M: 'Movement', WS: 'Weapon Skill', BS: 'Ballistic Skill', S: 'Strength', T: 'Toughness', W: 'Wound', I: 'Initiative', A: 'Attack', Ld: 'Leadership' };

export function rowFor(table: AdvRow[], roll: number): AdvRow | null {
  return Number.isInteger(roll) && roll >= 2 && roll <= 12 ? table.find((r) => roll >= r.from && roll <= r.to) ?? null : null;
}

export interface Choice { key: string; name: string; text: string; known: boolean }
export interface ChoiceGroup { label: string; items: Choice[] }

/** What a warrior may take as an advance. */
export interface AdvanceView {
  kind: 'hero' | 'hench' | 'hire';
  /** model uid, or a Hired Sword's uid */
  id: number | string;
  name: string;
  earned: number;
  applied: number;
  table: AdvRow[];
  /** Characteristics still below the maximum (a Henchman: once each). */
  canRaise: Partial<Record<StatKey, boolean>>;
  maxNote: string;
  skills: ChoiceGroup[];
  /** The lore he casts from, with its spells; null for those who cast none.
      `own`: the unit's own magic (core addSpellFromAdvance), else a
      wizard's lore (core addSpell), as the Roster Builder adds them. */
  spells: { lore: string; own: boolean; items: Choice[] } | null;
  /** A group: who may be promoted, or why none can. */
  talent: { men: { i: number; name: string }[]; lists: { key: string; name: string }[]; fixed: string[] | null } | { why: string } | null;
}

const STATS: StatKey[] = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld'];
const clean = (label: string) => label.replace(/[[\]]/g, '');

function groups(lists: core.SkillGroup[], known: string[]): ChoiceGroup[] {
  return lists.map(([label, skills]) => ({
    label: clean(label),
    items: skills.filter(([n]) => !String(n).startsWith('▸')).map(([n, t]) => ({ key: n, name: n, text: t, known: known.includes(n) })),
  }));
}

function spellChoices(ctx: core.Ctx, lore: string | null, own: boolean, known: { name: string }[]): AdvanceView['spells'] {
  const l = lore ? ctx.data.SPELLS[lore] : undefined;
  if (!l) return null;
  return {
    lore: l.name, own,
    items: l.spells.filter(([n]) => !String(n).startsWith('▸')).map(([n, t]) => ({ key: n, name: core.spellLabel(n), text: t, known: known.some((s) => s.name === n) })),
  };
}

/* The Roster Builder's reading of a unit's rules: some Henchmen may gain
   experience but never become Heroes (legacy advSection). */
const NO_PROMOTION = /never become a hero|cannot become a hero|can never become a hero|may never become heroes|lowest of the low|executes the slave|runts:/i;
const WEAK = /may not choose strength|\bweak:/i;

function warriorView(ctx: core.Ctx, m: Model): AdvanceView | null {
  const def = core.unitDef(ctx, m.uid_def);
  if (!def || def.noxp || !def.profile) return null;
  const st = core.advanceStatus(ctx, m)!;
  const hero = core.isHeroModel(ctx, m);
  const mi = core.maxInfo(ctx, m);
  const canRaise: Partial<Record<StatKey, boolean>> = {};
  for (const k of STATS) canRaise[k] = core.canAdv(ctx, m, k);
  const maxNote = mi ? `Maximum (${mi.label}): ${STATS.map((k) => `${k} ${mi.prof[k]}`).join(' · ')}${hero ? '' : '; a Henchman raises each characteristic once'}.` : 'No racial maximum on file: keep track by hand.';
  const known = m.skills ?? [];
  const base: AdvanceView = {
    kind: hero ? 'hero' : 'hench', id: m.uid, name: m.name || def.name, earned: st.earned, applied: st.applied,
    table: hero ? HERO_TABLE : HENCH_TABLE, canRaise, maxNote, skills: [], spells: null, talent: null,
  };
  if (hero) {
    const lists = m.promoted ? core.promotedSkillLists(ctx, m) : core.skillListsFor(ctx, def);
    const own = core.magicOfModel(ctx, m);
    return { ...base, skills: groups(lists, known), spells: spellChoices(ctx, own ?? core.casterLore(ctx, m), !!own, m.spells ?? []) };
  }
  // a group: may one of its men be promoted?
  let talent: AdvanceView['talent'];
  if (def.noPromote || NO_PROMOTION.test(def.sp ?? '')) talent = { why: `a ${def.name} can never become a Hero` };
  else if (core.totalHeroes(ctx) >= (Number(core.houseRules(ctx.s).heroes) || 6)) talent = { why: 'the warband has all the Heroes it may have: roll again' };
  else {
    let lists = core.availHeroCats(ctx);
    if (WEAK.test(def.sp ?? '')) lists = lists.filter((c) => c !== 'strength');
    talent = {
      men: core.memberNames(ctx, m).map((name, i) => ({ i, name })),
      lists: lists.map((c) => ({ key: c, name: ctx.data.SKILLLISTS[c]?.name ?? c })),
      fixed: def.promoCatsFixed ? def.promoCatsFixed.map((c) => ctx.data.SKILLLISTS[c]?.name ?? c) : null,
    };
  }
  return { ...base, talent };
}

function hireView(ctx: core.Ctx, rec: HireRecord): AdvanceView | null {
  const e = ctx.data.HIREDSWORDS[rec.key];
  if (!e) return null;
  const st = core.hsAdvanceStatus(ctx, rec, e);
  const canRaise: Partial<Record<StatKey, boolean>> = {};
  for (const k of STATS) canRaise[k] = core.hsCanAdv(ctx, rec, e, k);
  const mx = core.hsRaceMax(ctx, e);
  const known = rec.skills ?? [];
  const lists: core.SkillGroup[] = core.hsSkillCats(ctx, rec, e).map((c) => ctx.data.SKILLLISTS[c]).filter((l) => !!l).map((l) => [l!.name, l!.skills]);
  const special = core.hsSpecialSkills(e);
  if (special.length) lists.push(['Special skills', special]);
  return {
    kind: 'hire', id: rec.uid, name: rec.name || e.name, earned: st.earned, applied: st.applied, table: HERO_TABLE, canRaise,
    maxNote: mx ? `Maximum: ${STATS.map((k) => `${k} ${mx[k]}`).join(' · ')}.` : 'No racial maximum on file: keep track by hand.',
    skills: groups(lists, known), spells: spellChoices(ctx, e.magic ?? null, true, rec.spells ?? []), talent: null,
  };
}

/** The advance sheet of a warrior (model uid) or a Hired Sword (its uid). */
export function advanceView(ctx: core.Ctx, id: number | string): AdvanceView | null {
  if (typeof id === 'number') {
    const m = ctx.s.models.find((x) => x.uid === id);
    return m ? warriorView(ctx, m) : null;
  }
  const rec = (ctx.s.hired ?? []).find((h) => h.uid === id);
  return rec ? hireView(ctx, rec) : null;
}

/** What a warrior has taken, to correct by hand. */
export interface Taken { advances: { stat: StatKey; n: number }[]; skills: { i: number; name: string; text: string }[]; spells: { i: number; name: string; red: number }[] }

export function takenOf(ctx: core.Ctx, id: number | string): Taken | null {
  const src = typeof id === 'number' ? ctx.s.models.find((x) => x.uid === id) : (ctx.s.hired ?? []).find((h) => h.uid === id);
  if (!src) return null;
  const adv = (src.adv ?? {}) as Partial<Record<StatKey, number>>;
  return {
    advances: STATS.filter((k) => Number(adv[k]) > 0).map((k) => ({ stat: k, n: Number(adv[k]) })),
    skills: (src.skills ?? []).map((name, i) => ({ i, name, text: core.skillInfo(ctx.data, name)?.text ?? '' })),
    spells: (src.spells ?? []).map((sp, i) => ({ i, name: core.spellLabel(sp.name), red: Number(sp.red) || 0 })),
  };
}
