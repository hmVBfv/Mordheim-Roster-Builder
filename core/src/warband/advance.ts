/* Experience and advancement: experience, stat advances, skills, promotions
   (The Lad's Got Talent), member names, spells and marks, the leader, and
   the same for Hired Swords (legacy app.js incExp … setLeader, addHsAdv …
   addHsSpellFromAdv). Every action returns a new state. */
import type { StatKey } from '../data/types.ts';
import type { HireRecord, Model, WarbandState } from '../state/types.ts';
import { houseRules } from '../state/house.ts';
import type { Ctx } from '../rules/context.ts';
import { totalHeroes } from '../rules/costs.ts';
import { unitDef } from '../rules/lookup.ts';
import { canAdv, canBeLeader, hsCanAdv, isMarauderChief, isMarauderSeer, magicOfModel, memberCount, memberName, memberNamed, spellBase } from '../rules/profile.ts';
import { logEvent } from './log.ts';
import { findModel, nextModelUid, update, type WarbandDraft } from './update.ts';

const nameOf = (c: Ctx, m: Model) => m.name || unitDef(c, m.uid_def)?.name;

export function incExp(ctx: Ctx, uid: number, delta: number): WarbandState {
  return update(ctx, (d) => { const m = findModel(d, uid); if (m) m.exp = Math.max(0, (Number(m.exp) || 0) + delta); });
}

/** A stat advance, if allowed (henchmen once per stat, racial maxima). */
export function addAdvance(ctx: Ctx, uid: number, stat: StatKey): WarbandState {
  const m0 = findModel(ctx.s, uid);
  if (!m0 || !canAdv(ctx, m0, stat)) return ctx.s;
  return update(ctx, (d, c) => {
    const m = findModel(d, uid) as Model;
    m.adv = m.adv || {};
    m.adv[stat] = ((m.adv[stat] as number) || 0) + 1;
    logEvent(d, 'advance', `${nameOf(c, m)} advanced +1 ${stat}.`, { uid: m.uid, name: nameOf(c, m), uid_def: m.uid_def, stat, exp: Number(m.exp) || 0 });
  });
}

export function removeAdvance(ctx: Ctx, uid: number, stat: StatKey): WarbandState {
  return update(ctx, (d) => {
    const m = findModel(d, uid);
    if (m && m.adv && m.adv[stat]) {
      const v = Number(m.adv[stat]) - 1;
      m.adv[stat] = v;
      if (v <= 0) delete m.adv[stat];
    }
  });
}

/** Learns a skill typed in freely (trimmed; the same skill may be entered again). */
export function addSkill(ctx: Ctx, uid: number, value: string): WarbandState {
  const v = (value || '').trim();
  if (!v) return ctx.s;
  return update(ctx, (d, c) => {
    const m = findModel(d, uid);
    if (!m) return;
    m.skills = m.skills || [];
    m.skills.push(v);
    logEvent(d, 'advance', `${nameOf(c, m)} learned ${v}.`, { uid: m.uid, name: nameOf(c, m), uid_def: m.uid_def, skill: v, exp: Number(m.exp) || 0 });
  });
}

/** Learns a skill chosen from a list (never twice). */
export function addSkillFromList(ctx: Ctx, uid: number, value: string): WarbandState {
  if (!value || value === '—') return ctx.s;
  const m0 = findModel(ctx.s, uid);
  if (!m0 || (m0.skills || []).includes(value)) return ctx.s;
  return update(ctx, (d, c) => {
    const m = findModel(d, uid) as Model;
    m.skills = m.skills || [];
    m.skills.push(value);
    logEvent(d, 'advance', `${nameOf(c, m)} learned ${value}.`, { uid: m.uid, name: nameOf(c, m), uid_def: m.uid_def, skill: value, exp: Number(m.exp) || 0 });
  });
}

export function removeSkill(ctx: Ctx, uid: number, index: number): WarbandState {
  return update(ctx, (d) => { const m = findModel(d, uid); if (m && m.skills) m.skills.splice(index, 1); });
}

/** A promoted henchman picks two of the warband's Hero skill lists. */
export function togglePromoCat(ctx: Ctx, uid: number, cat: string): WarbandState {
  return update(ctx, (d) => {
    const m = findModel(d, uid);
    if (!m) return;
    m.promoCats = m.promoCats || [];
    const i = m.promoCats.indexOf(cat);
    if (i >= 0) m.promoCats.splice(i, 1);
    else if (m.promoCats.length < 2) m.promoCats.push(cat);
  });
}

/** Names one member of a henchman group; the list stays aligned with the count. */
export function setMemberName(ctx: Ctx, uid: number, i: number, v: unknown): WarbandState {
  return update(ctx, (d) => {
    const m = findModel(d, uid);
    if (!m) return;
    if (!Array.isArray(m.names)) m.names = [];
    while (m.names.length < memberCount(m)) m.names.push('');
    m.names[i] = String(v || '').trim();
    if (m.names.every((x) => !x)) delete m.names;
  });
}

/** Removes one member's name and closes the gap. */
export function dropMemberName(m: Model, i: number): void {
  if (!Array.isArray(m.names)) return;
  m.names.splice(i, 1);
  if (!m.names.some((x) => (x || '').trim())) delete m.names;
}

/** The Lad's Got Talent: member `i` (default: the last) leaves the group as a
    Hero, taking his name with him. Refused at the Hero limit. */
export function promoteHench(ctx: Ctx, uid: number, i?: number | null): WarbandState {
  const m0 = findModel(ctx.s, uid);
  if (!m0) return ctx.s;
  if (totalHeroes(ctx) >= (Number(houseRules(ctx.s).heroes) || 6)) return ctx.s;
  return update(ctx, (d, c) => {
    const m = findModel(d, uid) as Model;
    const def = unitDef(c, m.uid_def);
    const idx = i == null ? memberCount(m) - 1 : Number(i) || 0;
    const who = memberName(c, m, idx);
    const named = memberNamed(m, idx);
    let heroUid = m.uid;
    if (memberCount(m) > 1) {
      m.qty = memberCount(m) - 1;
      dropMemberName(m, idx);
      heroUid = nextModelUid(d);
      d.models.push({
        uid: heroUid, uid_def: m.uid_def,
        name: named ? who : m.name ? m.name + ' (Hero)' : (def?.name ?? '') + ' (Hero)',
        exp: Number(m.exp) || 0, qty: 1,
        eq: JSON.parse(JSON.stringify(m.eq || {})) as Model['eq'], mut: [...(m.mut || [])], adv: { ...(m.adv || {}) },
        skills: [...(m.skills || [])], inj: [...(m.inj || [])], spells: [...(m.spells || [])],
        miss: Number(m.miss) || 0, promoted: true, promoCats: def?.promoCatsFixed ? [...def.promoCatsFixed] : [],
      });
    } else {
      m.promoted = true;
      m.promoCats = def?.promoCatsFixed ? [...def.promoCatsFixed] : m.promoCats || [];
      if (named && !m.name) { m.name = who; delete m.names; }
    }
    logEvent(d, 'promote', `${who} was promoted to Hero (The Lad's Got Talent).`, { uid: heroUid, name: who, uid_def: m.uid_def, exp: Number(m.exp) || 0 });
  });
}

export function unpromote(ctx: Ctx, uid: number): WarbandState {
  return update(ctx, (d) => { const m = findModel(d, uid); if (m) delete m.promoted; });
}

/* ---- spells ---- */

/** Learns a spell from the caster's list (once). */
export function addSpell(ctx: Ctx, uid: number, name: string): WarbandState {
  if (!name || name === '—') return ctx.s;
  const m0 = findModel(ctx.s, uid);
  if (!m0 || (m0.spells || []).some((s) => s.name === name)) return ctx.s;
  return update(ctx, (d) => { const m = findModel(d, uid) as Model; m.spells = m.spells || []; m.spells.push({ name, red: 0 }); });
}

/** Learns a spell as an advance (units with their own magic). */
export function addSpellFromAdvance(ctx: Ctx, uid: number, name: string): WarbandState {
  if (!name || name === '—') return ctx.s;
  const m0 = findModel(ctx.s, uid);
  if (!m0 || !magicOfModel(ctx, m0) || (m0.spells || []).some((x) => x.name === name)) return ctx.s;
  return update(ctx, (d) => { const m = findModel(d, uid) as Model; m.spells = m.spells || []; m.spells.push({ name }); });
}

export function removeSpell(ctx: Ctx, uid: number, index: number): WarbandState {
  return update(ctx, (d) => { const m = findModel(d, uid); if (m && m.spells) m.spells.splice(index, 1); });
}

/** Lowers (or raises back) a spell's difficulty; never below 2. */
export function spellReduce(ctx: Ctx, uid: number, index: number, delta: number): WarbandState {
  return update(ctx, (d) => {
    const s = findModel(d, uid)?.spells?.[index];
    if (!s) return;
    const b = spellBase(s.name);
    s.red = Math.max(0, (s.red || 0) + delta);
    if (b != null) s.red = Math.min(s.red, b - 2);
  });
}

/** Makes a hero a caster (starting on the warband's own magic). */
export function setCaster(ctx: Ctx, uid: number, on: boolean): WarbandState {
  return update(ctx, (d, c) => {
    const m = findModel(d, uid);
    if (!m) return;
    m.caster = !!on;
    if (on && !m.lore) m.lore = (c.data.WBEXTRA[c.s.wb ?? ''] as { magic?: string } | undefined)?.magic || '';
  });
}

/** Changes a caster's lore; a different lore forgets the spells. */
export function setLore(ctx: Ctx, uid: number, v: string): WarbandState {
  return update(ctx, (d) => {
    const m = findModel(d, uid);
    if (!m) return;
    if ((m.lore || '') !== (v || '')) m.spells = [];
    m.lore = v || '';
  });
}

/** Marauders of Chaos: the warband's Mark; seer and chief forget their spells. */
export function setMark(ctx: Ctx, v: string | null): WarbandState {
  return update(ctx, (d, c) => {
    d.mark = v || '';
    for (const m of d.models) {
      const def = unitDef(c, m.uid_def);
      if (isMarauderSeer(c, def) || isMarauderChief(c, def)) m.spells = [];
    }
  });
}

/** Chooses the leader among the heroes who may lead. */
export function setLeader(ctx: Ctx, uid: number): WarbandState {
  const m = findModel(ctx.s, uid);
  if (!m || !canBeLeader(ctx, m)) return ctx.s;
  return update(ctx, (d) => { d.leaderUid = uid; });
}

/* ---- Hired Swords ---- */

const hired = (d: WarbandDraft | WarbandState, uid: string): HireRecord | undefined => (d.hired ?? []).find((h) => h.uid === uid);
const hiredOrDp = (d: WarbandDraft | WarbandState, uid: string): HireRecord | undefined => hired(d, uid) ?? (d.dp ?? []).find((x) => x.uid === uid);

export function addHsAdvance(ctx: Ctx, uid: string, stat: StatKey): WarbandState {
  const r0 = hired(ctx.s, uid);
  if (!r0 || !hsCanAdv(ctx, r0, ctx.data.HIREDSWORDS[r0.key], stat)) return ctx.s;
  return update(ctx, (d) => { const r = hired(d, uid) as HireRecord; if (!r.adv) r.adv = {}; r.adv[stat] = (Number(r.adv[stat]) || 0) + 1; });
}

export function removeHsAdvance(ctx: Ctx, uid: string, stat: StatKey): WarbandState {
  return update(ctx, (d) => {
    const r = hired(d, uid);
    if (!r || !r.adv) return;
    r.adv[stat] = (Number(r.adv[stat]) || 0) - 1;
    if ((r.adv[stat] as number) <= 0) delete r.adv[stat];
  });
}

export function removeHsSkillAt(ctx: Ctx, uid: string, index: number): WarbandState {
  return update(ctx, (d) => { const r = hired(d, uid); if (r) (r.skills || []).splice(index, 1); });
}

/** Adds a spell to a casting Hired Sword or Dramatis Personae (once). */
export function addHsSpell(ctx: Ctx, uid: string, name: string): WarbandState {
  const r0 = hiredOrDp(ctx.s, uid);
  if (!r0) return ctx.s;
  const e = ctx.data.HIREDSWORDS[r0.key] || ctx.data.DRAMATIS[r0.key];
  if (!e || !e.magic) return ctx.s;
  if (!name || name === '—') return ctx.s;
  if ((r0.spells || []).some((x) => x.name === name)) return ctx.s;
  return update(ctx, (d) => { const r = hiredOrDp(d, uid) as HireRecord; r.spells = r.spells || []; r.spells.push({ name }); });
}

export function removeHsSpell(ctx: Ctx, uid: string, index: number): WarbandState {
  return update(ctx, (d) => { const r = hiredOrDp(d, uid); if (r) (r.spells || []).splice(index, 1); });
}

export function hsSpellReduce(ctx: Ctx, uid: string, index: number, delta: number): WarbandState {
  return update(ctx, (d) => {
    const sp = hiredOrDp(d, uid)?.spells?.[index];
    if (!sp) return;
    const b = spellBase(sp.name);
    sp.red = Math.max(0, (sp.red || 0) + delta);
    if (b != null) sp.red = Math.min(sp.red, b - 2);
  });
}
