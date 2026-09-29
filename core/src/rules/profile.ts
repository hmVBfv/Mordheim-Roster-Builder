/* Profiles, racial maxima, experience and advancement, skills, spells,
   henchman members and the leader (legacy app.js "ERFAHRUNG / AUFSTIEG",
   member naming, spells, leader, Hired Sword advancement). Read-only. */
import type { HireEntry, Persona, Profile, StatKey, UnitDef } from '../data/types.ts';
import type { HireRecord, Model } from '../state/types.ts';
import { houseRules } from '../state/house.ts';
import type { Ctx } from './context.ts';
import { isHeroModel } from './costs.ts';
import { hsExp, hsPersona } from './hire.ts';
import { unitDef, warbandDef } from './lookup.ts';
import { statNum } from './saves.ts';

export const STATS: StatKey[] = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld'];

/** Experience thresholds at which an advance is due. */
export function xpThresholds(hero: boolean): number[] {
  return hero ? [2, 4, 6, 8, 11, 14, 17, 20, 24, 28, 32, 36, 41, 46, 51, 57, 63, 69, 76, 83, 90] : [2, 5, 9, 14];
}

/** Summed stat changes from injuries. */
export function injMods(m: Model): Partial<Record<StatKey, number>> {
  const o: Record<string, number> = {};
  (m.inj || []).forEach((j) => { if (j.mod) for (const k of Object.keys(j.mod)) o[k] = (o[k] || 0) + (j.mod as Record<string, number>)[k]!; });
  return o;
}

/** Advances plus injuries, per stat (only non-zero). */
export function netMod(m: Model): Partial<Record<StatKey, number>> {
  const adv = m.adv || {};
  const inj = injMods(m);
  const o: Partial<Record<StatKey, number>> = {};
  STATS.forEach((k) => { const v = (Number(adv[k]) || 0) + (Number(inj[k]) || 0); if (v) o[k] = v; });
  return o;
}

/** The profile as it stands: base, subtype changes, advances and injuries.
    String values ("3(4)", "D6") get the change appended ("3(4)+1"). */
export function effProfile(ctx: Ctx, m: Model): Profile | null {
  const def = unitDef(ctx, m.uid_def);
  if (!def || !def.profile) return null;
  const mod = netMod(m);
  const sub = (def.profSub && ctx.s.subtype != null && def.profSub[ctx.s.subtype]) || {};
  const out: Profile = {};
  for (const k of Object.keys(def.profile) as StatKey[]) {
    const base = def.profile[k] as number | string;
    const b = (Number(mod[k]) || 0) + (Number((sub as Record<string, unknown>)[k]) || 0);
    out[k] = b ? (typeof base === 'number' ? base + b : base + (b > 0 ? '+' : '') + b) : base;
  }
  return out;
}

/** Combined modifier for display colouring: net changes plus subtype. */
export function dispMod(ctx: Ctx, m: Model): Record<StatKey, number> {
  const def = unitDef(ctx, m.uid_def);
  const mod = netMod(m);
  const sub = (def && def.profSub && ctx.s.subtype != null && def.profSub[ctx.s.subtype]) || {};
  const o = {} as Record<StatKey, number>;
  STATS.forEach((k) => { o[k] = (Number(mod[k]) || 0) + (Number((sub as Record<string, unknown>)[k]) || 0); });
  return o;
}

/** Attacks as shown: "1+1" for units with a bite. */
export function aDisp(ctx: Ctx, m: Model, p: Profile): string | number | undefined {
  const def = unitDef(ctx, m.uid_def);
  const a = p.A;
  return def && def.bite ? a + '+' + def.bite : a;
}

export interface MaxInfo { prof: Profile; label: string; key?: string }

/** Racial maximum profile of a model (Chosen of Chaos use the Warrior of Chaos maxima). */
export function maxInfo(ctx: Ctx, m: Model): MaxInfo | null {
  const def = unitDef(ctx, m.uid_def);
  if (!def) return null;
  if (m.skills && m.skills.some((s) => /chosen of chaos/i.test(s))) return { prof: ctx.data.MAXPROF.woc as Profile, label: 'Chaoskrieger' };
  const key = ctx.s.wb + '/' + def.id;
  let r: string | null;
  if (Object.prototype.hasOwnProperty.call(ctx.data.UNITRACE, key)) r = ctx.data.UNITRACE[key] as string;
  else r = ctx.data.WBRACE[ctx.s.wb ?? ''] || null;
  return r ? { prof: ctx.data.MAXPROF[r] as Profile, label: ctx.data.RACELABEL[r] || r, key: r } : null;
}

/** May this stat still be advanced? Henchmen once per stat; nobody past the
    racial maximum; string base values are not limited. */
export function canAdv(ctx: Ctx, m: Model, stat: StatKey): boolean {
  const def = unitDef(ctx, m.uid_def);
  const base = def && def.profile ? def.profile[stat] : undefined;
  if (typeof base !== 'number') return true;
  if (!isHeroModel(ctx, m) && (Number((m.adv || {})[stat]) || 0) >= 1) return false;
  const mi = maxInfo(ctx, m);
  const lim = mi?.prof[stat];
  if (mi && typeof lim === 'number' && base + (Number((m.adv || {})[stat]) || 0) >= lim) return false;
  return true;
}

/* ---- casters ---- */

export function isMarauderSeer(ctx: Ctx, def: UnitDef | undefined): boolean {
  return ctx.s.wb === 'maraudersofchaos' && !!def && /\bWizard\b/.test(def.sp || '');
}

export function isMarauderChief(ctx: Ctx, def: UnitDef | undefined): boolean {
  return ctx.s.wb === 'maraudersofchaos' && !!def && /\bLeader\b/.test(def.sp || '');
}

export function markName(ctx: Ctx, k: string): string {
  const x = ctx.data.MARAUDER_MARKS.find((mk) => mk[0] === k);
  return x ? x[1] : '';
}

/** The spell list granted by the warband's Mark (Marauders of Chaos). */
export function markLore(ctx: Ctx): string | null {
  const x = ctx.data.MARAUDER_MARKS.find((mk) => mk[0] === ctx.s.mark);
  return x ? x[2] : null;
}

/** A warband's built-in magic for units whose rules make them casters. */
export function casterMagic(ctx: Ctx, def: UnitDef): string | null {
  const ex = ctx.data.WBEXTRA[ctx.s.wb ?? ''] as { magic?: string } | undefined;
  if (!ex || !ex.magic || !ctx.data.SPELLS[ex.magic]) return null;
  if (def.sp && /\bWizard\b|Prayers of\b|Disciple of Sigmar/i.test(def.sp)) return ex.magic;
  return null;
}

/** The spell list a model casts from, if any. */
export function casterLore(ctx: Ctx, m: Model | null | undefined): string | null {
  if (!m) return null;
  const def = unitDef(ctx, m.uid_def);
  if (isMarauderSeer(ctx, def)) return markLore(ctx);
  if (isMarauderChief(ctx, def)) return m.caster ? markLore(ctx) : null;
  const inh = def ? casterMagic(ctx, def) : null;
  if (inh) return inh;
  if (m.caster) return m.lore || (ctx.data.WBEXTRA[ctx.s.wb ?? ''] as { magic?: string } | undefined)?.magic || null;
  return null;
}

export function magicOfModel(ctx: Ctx, m: Model): string | null {
  const def = unitDef(ctx, m.uid_def);
  if (!def) return null;
  if (m.magic && ctx.data.SPELLS[m.magic]) return m.magic;
  if (def.magic && ctx.data.SPELLS[def.magic]) return def.magic;
  return null;
}

/** Marauders: the Mark decides the starting spells (Tchar seer 2, Khorne
    seer 0, others 1; the chief casts only with Tchar). */
export function marauderStartSpells(ctx: Ctx, m: Model | null | undefined): number | null {
  if (ctx.s.wb !== 'maraudersofchaos' || !m) return null;
  const d = unitDef(ctx, m.uid_def);
  if (!d) return null;
  const mk = ctx.s.mark || '';
  if (isMarauderSeer(ctx, d)) { if (mk === 'khorne') return 0; if (mk === 'eagle') return 2; return 1; }
  if (isMarauderChief(ctx, d)) return mk === 'eagle' && m.caster ? 1 : 0;
  return null;
}

/** How many spells a unit starts with (the rest were advances). */
export function spellStartCount(ctx: Ctx, defOrEntry: { sp?: string } | null | undefined, m?: Model | null): number {
  const mm = marauderStartSpells(ctx, m);
  if (mm !== null && mm !== undefined) return mm;
  const sp = (defOrEntry && defOrEntry.sp) || '';
  const w: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, all: 6 };
  const mt = /\b(one|two|three|four|five|six|all|\d+)\s+(?:[A-Za-z'-]+\s+){0,3}(?:spells?|prayers?|runes?|rituals?)\b/i.exec(sp);
  if (mt) { const v = String(mt[1]).toLowerCase(); return w[v] != null ? w[v] : Number(v) || 1; }
  if (/\b(?:wizard|prayers?|priest|magician)\b/i.test(sp)) return 1;
  return 0;
}

/** Difficulty in brackets: "Word of Pain (7)" → 7. */
export function spellBase(name: string): number | null {
  const m = String(name).match(/\((\d+)\)/);
  return m ? parseInt(m[1] as string, 10) : null;
}

export function spellEffect(ctx: Ctx, name: string, lore?: string | null): string {
  const l = lore || (ctx.data.WBEXTRA[ctx.s.wb ?? ''] as { magic?: string } | undefined)?.magic;
  if (!l || !ctx.data.SPELLS[l]) return '';
  const e = ctx.data.SPELLS[l]!.spells.find((s) => s[0] === name);
  return e ? e[1] : '';
}

export function spellEffDiff(s: { name: string; red?: number }): number | null {
  const b = spellBase(s.name);
  return b != null ? Math.max(2, b - (s.red || 0)) : null;
}

/* ---- advancement status ---- */

export interface AdvanceStatus {
  hero: boolean;
  noxp: boolean;
  xp: number;
  start: number;
  thresholds: number[];
  /** Advances earned in play (thresholds above the starting experience). */
  earned: number;
  /** Advances taken: stat advances, skills, and spells beyond the start. */
  applied: number;
  due: boolean;
  next: number | null;
}

/** Where a model stands on the experience track (legacy xpBar, minus HTML). */
export function advanceStatus(ctx: Ctx, m: Model): AdvanceStatus | null {
  const def = unitDef(ctx, m.uid_def);
  if (!def) return null;
  const hero = isHeroModel(ctx, m);
  const th = xpThresholds(hero);
  const xp = Number(m.exp) || 0;
  const start = Number(def.exp) || 0;
  const earned = th.filter((t) => t > start && t <= xp).length;
  const next = th.find((t) => t > xp) ?? null;
  const adv = m.adv || {}, skills = m.skills || [];
  const spellStart = spellStartCount(ctx, def, m);
  const sel = m.spells || [];
  const spellAdv = Math.max(0, sel.length - spellStart) + sel.reduce((a, sp) => a + (Number(sp.red) || 0), 0);
  const applied = Object.values(adv).reduce((s: number, v) => s + (Number(v) || 0), 0) + skills.length + spellAdv;
  return { hero, noxp: !!def.noxp, xp, start, thresholds: th, earned, applied, due: earned > applied, next };
}

/* ---- skills ---- */

export type SkillGroup = [label: string, skills: [string, string][]];

/** The skill lists a unit may learn from (house rule: all standard lists). */
export function skillListsFor(ctx: Ctx, def: UnitDef): SkillGroup[] {
  const out: SkillGroup[] = [];
  let cats = (def.skSub && ctx.s.subtype != null && def.skSub[ctx.s.subtype]) || def.sk || ['combat', 'shooting', 'academic', 'strength', 'speed'];
  if (houseRules(ctx.s).allSkills) cats = ['combat', 'shooting', 'academic', 'strength', 'speed'];
  cats.forEach((c) => {
    const L = ctx.data.SKILLLISTS[c] ?? ctx.data.SKILLSETS[c];
    if (L) out.push(['[' + L.name + ']', L.skills]);
  });
  const ex = ctx.data.WBEXTRA[ctx.s.wb ?? ''] as { skills?: string } | undefined;
  const set = ex?.skills ? ctx.data.SKILLSETS[ex.skills] : undefined;
  if (ex && ex.skills && set && !def.noWbSkills && !cats.includes(ex.skills)) out.push(['[' + set.name + ']', set.skills]);
  // skills the warband may never learn (Dwarf Rangers: Arcane Lore)
  const no = warbandDef(ctx)?.noSkills ?? [];
  return no.length ? out.map(([lab, sk]): SkillGroup => [lab, sk.filter((s) => !no.includes(s[0]))]) : out;
}

/** Standard skill lists any Hero of this warband uses — what a promoted
    henchman may choose two of. */
export function availHeroCats(ctx: Ctx): string[] {
  const wb = warbandDef(ctx);
  const set = new Set<string>();
  const std = ctx.data.STD_CATS;
  (wb?.units || []).forEach((u) => {
    if (u.t === 'hero') {
      const c = (u.skSub && ctx.s.subtype != null && u.skSub[ctx.s.subtype]) || u.sk || std;
      c.forEach((x) => { if (std.includes(x)) set.add(x); });
    }
  });
  if (!set.size) std.forEach((x) => set.add(x));
  return std.filter((x) => set.has(x));
}

export function promotedSkillLists(ctx: Ctx, m: Model | null | undefined): SkillGroup[] {
  const cats = (m && m.promoCats) || [];
  const out: SkillGroup[] = [];
  cats.forEach((c) => { const L = ctx.data.SKILLLISTS[c]; if (L) out.push(['[' + L.name + ']', L.skills]); });
  const ex = ctx.data.WBEXTRA[ctx.s.wb ?? ''] as { skills?: string } | undefined;
  const set = ex?.skills ? ctx.data.SKILLSETS[ex.skills] : undefined;
  if (ex && ex.skills && set) out.push(['[' + set.name + ']', set.skills]);
  return out;
}

/* ---- henchman members ---- */

export function memberCount(m: Model | null | undefined): number {
  return Math.max(1, Number(m && m.qty) || 1);
}

export function memberDefaultName(ctx: Ctx, m: Model, i: number): string {
  const def = unitDef(ctx, m.uid_def);
  const base = (def && def.name) || 'Warrior';
  return memberCount(m) > 1 ? `${base} ${i + 1}` : base;
}

export function memberName(ctx: Ctx, m: Model, i: number): string {
  const n = ((m && m.names && m.names[i]) || '').trim();
  return n || memberDefaultName(ctx, m, i);
}

/** Does this member have a name of his own (rather than the fallback)? */
export function memberNamed(m: Model | null | undefined, i: number): boolean {
  return !!(m && m.names && (m.names[i] || '').trim());
}

export function memberNames(ctx: Ctx, m: Model): string[] {
  return Array.from({ length: memberCount(m) }, (_, i) => memberName(ctx, m, i));
}

/* ---- the leader ---- */

export function canBeLeader(ctx: Ctx, m: Model): boolean {
  const def = unitDef(ctx, m.uid_def);
  if (!def) return false;
  if (!isHeroModel(ctx, m)) return false;
  return !/never become the warband leader|may not be the leader|cannot be the leader|never be the warband leader/i.test(def.sp || '');
}

function leadership(ctx: Ctx, m: Model): number {
  const p = effProfile(ctx, m);
  if (!p) return 0;
  return Number(statNum(p.Ld)) || 0;
}

/** Who leads if nobody was chosen: the natural leader; among the Undead the
    Necromancer; otherwise the eligible Hero with the best Leadership, then
    the most experience. */
export function defaultLeaderUid(ctx: Ctx): number | null {
  const nat = ctx.s.models.find((m) => { const d = unitDef(ctx, m.uid_def); return !!d && /\bLeader:/.test(d.sp || ''); });
  if (nat) return nat.uid;
  if (ctx.s.wb === 'undead') {
    const necro = ctx.s.models.find((m) => m.uid_def === 'necro' && canBeLeader(ctx, m));
    if (necro) return necro.uid;
  }
  const cands = ctx.s.models.filter((m) => canBeLeader(ctx, m));
  if (!cands.length) return null;
  cands.sort((a, b) => leadership(ctx, b) - leadership(ctx, a) || (Number(b.exp) || 0) - (Number(a.exp) || 0) || a.uid - b.uid);
  return cands[0]?.uid ?? null;
}

export function leaderUid(ctx: Ctx): number | null {
  if (ctx.s.leaderUid) {
    const m = ctx.s.models.find((x) => x.uid === ctx.s.leaderUid);
    if (m && canBeLeader(ctx, m)) return ctx.s.leaderUid;
  }
  return defaultLeaderUid(ctx);
}

export function isLeaderModel(ctx: Ctx, m: Model | null | undefined): boolean {
  return !!m && m.uid === leaderUid(ctx);
}

/* ---- Hired Sword advancement ---- */

export function hsSpecialSkills(e: HireEntry | null | undefined): [string, string][] {
  return (e && e.hsSpecial) || [];
}

export function hsRaceMax(ctx: Ctx, e: HireEntry | null | undefined): Profile | null {
  return e && e.race && ctx.data.MAXPROF[e.race] ? (ctx.data.MAXPROF[e.race] as Profile) : null;
}

export function hsSkillCats(ctx: Ctx, rec: HireRecord, e: HireEntry): string[] {
  const p: Persona | null = hsPersona(ctx, rec, e);
  return (p && p.sk) || e.sk || [];
}

export function hsEffProfile(rec: HireRecord | null | undefined, e: HireEntry | null | undefined): Profile {
  const p: Record<string, unknown> = { ...((e && e.profile) || {}) };
  const adv = (rec && rec.adv) || {};
  STATS.forEach((k) => {
    const d = Number(adv[k]) || 0;
    if (!d) return;
    const b = Number(p[k]);
    if (!isNaN(b)) p[k] = b + d;
  });
  return p as Profile;
}

export function hsCanAdv(ctx: Ctx, rec: HireRecord, e: HireEntry | null | undefined, stat: StatKey): boolean {
  const mx = hsRaceMax(ctx, e);
  if (!mx) return true;
  const cur = Number(hsEffProfile(rec, e)[stat]), lim = Number(mx[stat]);
  return isNaN(cur) || isNaN(lim) ? true : cur < lim;
}

/** Hired Swords advance on the henchman track (2/5/9/14) with Hero advances. */
export function hsAdvanceStatus(ctx: Ctx, rec: HireRecord, e: HireEntry | null | undefined): { earned: number; applied: number; due: boolean } {
  const th = [2, 5, 9, 14];
  const xp = hsExp(rec), earned = th.filter((t) => t <= xp).length;
  const adv = rec.adv || {}, skills = rec.skills || [];
  const sp = rec.spells || [];
  const spAdv = Math.max(0, sp.length - spellStartCount(ctx, e)) + sp.reduce((a, x) => a + (Number(x.red) || 0), 0);
  const applied = Object.values(adv).reduce((a: number, v) => a + (Number(v) || 0), 0) + skills.length + spAdv;
  return { earned, applied, due: earned > applied };
}
