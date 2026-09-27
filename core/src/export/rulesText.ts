/* Rule and item texts in English for exports and tooltips (legacy app.js
   enItem, abilityEN, translateTerms, ruleNameEN, enRules, mutEN, raceEN,
   injModText, skillText, markRulesFor, leaderRuleText, houseDeviations,
   attachedBlocks, eqDisplayParts, eqSummaryParts, rareDisplayParts,
   fallenEqAgg; info.js abilityInfo, skillInfo, spellInfo). The data keeps
   German names as keys; everything a player reads is English. */
import type { GameData, HireEntry, ItemInfo, Profile, UnitDef } from '../data/types.ts';
import type { Injury, Model } from '../state/types.ts';
import { houseDefaults, houseRules } from '../state/house.ts';
import type { Ctx } from '../rules/context.ts';
import { daggerNameFor, inlineUpgradeActive } from '../rules/equipment.ts';
import { eqListFor, spellLabel, unitDef } from '../rules/lookup.ts';
import { hsSpecialSkills, isMarauderChief, isMarauderSeer } from '../rules/profile.ts';

/** English name of an item (German key, with or without the free-dagger mark). */
export function enItem(data: GameData, name: string): string {
  const n = String(name).replace(' (1. gratis)', '').trim();
  if (data.EQEN[n]) return data.EQEN[n] as string;
  const base = n.replace(/\s*\(.*\)$/, '').trim();
  if (data.EQEN[base]) return data.EQEN[base] as string;
  const m = n.match(/^(.*?)\s*\(([^)]+)\)$/);
  if (m) {
    const a = (m[1] as string).trim(), b = (m[2] as string).trim();
    const asA = /^[\x20-\x7E]+$/.test(a), asB = /^[\x20-\x7E]+$/.test(b);
    if (asA && !asB) return a;
    if (asB && !asA) return b;
    return a;
  }
  return n;
}

export function abilityEN(data: GameData, nm: string): string {
  const m = nm.match(/\(([^)]+)\)\s*$/);
  if (m) return (m[1] as string).trim();
  return data.ABILEN[nm] || nm;
}

export function mutEN(data: GameData, nm: string): string {
  return data.MUTEN[nm] || nm;
}

export function raceEN(data: GameData, k: string | null | undefined): string {
  return k ? (data.RACE_EN[k] || k) : '';
}

/** "(−1 M)" for an injury that changes characteristics. */
export function injModText(j: Injury): string {
  return j.mod ? ' (' + Object.entries(j.mod).map(([k, v]) => ((v as number) > 0 ? '+' : '') + v + ' ' + k).join(', ') + ')' : '';
}

/* German description fragments → English, longest first; built once per data set. */
const TERMS = new WeakMap<GameData, [string, string][]>();
function terms(data: GameData): [string, string][] {
  let t = TERMS.get(data);
  if (!t) {
    t = ([] as [string, string][]).concat(Object.entries(data.NAMEEN), data.TERMEN, [
      ['zählt als 2 Modelle', 'counts as 2 models'], ['Nur Hellebarde', 'Only a halberd'],
      ['keine Erfahrung', 'gains no experience'], ['Keine Ausrüstung', 'No equipment'],
      ['Keine Waffen/Rüstung', 'No weapons/armour'], ['zählt als', 'counts as'], ['Modelle', 'models'],
    ]).sort((a, b) => b[0].length - a[0].length);
    TERMS.set(data, t);
  }
  return t;
}

export function translateTerms(data: GameData, text: string): string {
  let s = text;
  for (const [de, en] of terms(data)) if (s.indexOf(de) >= 0) s = s.split(de).join(en);
  return s;
}

/* ---- lookups (info.js) ---- */

export function abilityInfo(data: GameData, nm: string): ItemInfo | null {
  const s = String(nm);
  for (const [, info] of data.ABILITYINFO) if (info.name === s) return info;
  for (const [re, info] of data.ABILITYINFO) if (re.test(s)) return info;
  return null;
}

export function skillInfo(data: GameData, nm: string): ItemInfo | null {
  const lists = [...Object.values(data.SKILLLISTS), ...Object.values(data.SKILLSETS)];
  for (const L of lists) {
    const e = (L.skills || []).find((x) => x[0] === nm);
    if (e) return { name: e[0], line: 'Skill · ' + L.name, text: e[1] };
  }
  return null;
}

export function spellInfo(data: GameData, nm: string): ItemInfo | null {
  const lbl = spellLabel(nm);
  for (const k of Object.keys(data.SPELLS)) {
    for (const s of data.SPELLS[k]!.spells) {
      if (String(s[0])[0] === '▸') continue;
      if (spellLabel(s[0]) === lbl) return { name: lbl, line: 'Spell · ' + data.SPELLS[k]!.name, text: s[1] };
    }
  }
  return null;
}

export function ruleNameEN(data: GameData, name: string): string {
  if (data.NAMEEN[name]) return data.NAMEEN[name] as string;
  const gi = abilityInfo(data, name);
  if (gi) return abilityEN(data, gi.name);
  return translateTerms(data, name);
}

/** A unit's special-rules blurb as a list of English "Name: text" clauses. */
export function enRules(data: GameData, sp: string | null | undefined): string[] {
  if (!sp) return [];
  const s = String(sp).replace(/<br\s*\/?>/gi, ' ').replace(/<\/?[a-z][^>]*>/gi, '').replace(/\s{2,}/g, ' ').trim();
  const clauses = s.split(/\.\s+(?=[A-ZÄÖÜ„])/).map((c) => c.replace(/\.\s*$/, '').trim()).filter(Boolean);
  return clauses.map((c) => {
    const ci = c.indexOf(':');
    if (ci >= 0) { const name = c.slice(0, ci).trim(), desc = c.slice(ci + 1).trim(); return `${ruleNameEN(data, name)}: ${translateTerms(data, desc)}`; }
    return translateTerms(data, c);
  });
}

/** A special skill of a Hired Sword, by name. */
export function hsSpecialText(e: HireEntry | null | undefined, nm: string): string {
  const f = hsSpecialSkills(e).find((x) => x[0] === nm);
  return f ? f[1] : '';
}

/** The text of a skill (a Hired Sword's own version first). */
export function skillText(data: GameData, nm: string, e?: HireEntry | null): string {
  if (e) { const t = hsSpecialText(e, nm); if (t) return t; }
  const si = skillInfo(data, nm);
  if (!si) return '';
  return si.text || si.name || '';
}

/** The rules the Marauder mark gives this warrior: [name, text][]. */
export function markRulesFor(ctx: Ctx, m: Model | null | undefined): [string, string][] {
  const k = ctx.s.mark;
  const rules = k ? (ctx.data.MARK_RULES[k] as { seer?: [string, string][]; leader?: [string, string][] } | undefined) : undefined;
  if (!k || !rules || !m) return [];
  const d = unitDef(ctx, m.uid_def);
  if (!d) return [];
  if (isMarauderSeer(ctx, d)) return rules.seer || [];
  if (isMarauderChief(ctx, d) && m.caster) return rules.leader || [];
  return [];
}


/* ---- house rules as declared on exports ---- */

export function hrIsDefault(ctx: Ctx, k: string): boolean {
  return JSON.stringify((houseRules(ctx.s) as unknown as Record<string, unknown>)[k]) === JSON.stringify((houseDefaults() as unknown as Record<string, unknown>)[k]);
}

/** Every house rule that differs from the default, worded for the export. */
export function houseDeviations(ctx: Ctx): { key: string; label: string; value: string }[] {
  const d = houseDefaults() as unknown as Record<string, unknown>;
  const h = houseRules(ctx.s) as unknown as Record<string, unknown>;
  const out: { key: string; label: string; value: string }[] = [];
  for (const k of Object.keys(d)) {
    if (k === 'notes') continue;
    if (JSON.stringify(h[k]) !== JSON.stringify(d[k])) {
      let v: unknown = h[k];
      if (k === 'eqLimitOn') v = h[k] ? 'enforced' : 'NOT enforced (equipment beyond the list allowed)';
      else if (k === 'hireNewLeader') v = h[k] ? 'allowed (may re-hire a leader after the original is slain)' : null;
      else if (typeof v === 'boolean') v = v ? 'on' : 'off';
      else if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        const off = Object.keys(o).filter((x) => o[x] === false);
        v = off.length ? 'excluded: ' + off.join(', ') : null;
      }
      if (v != null && v !== '') out.push({ key: k, label: ctx.data.HR_LABELS[k] || k, value: String(v) });
    }
  }
  if (h.notes) out.push({ key: 'notes', label: 'Notes', value: String(h.notes) });
  return out;
}

export function houseSummary(ctx: Ctx): string[] {
  return houseDeviations(ctx).map((x) => x.label + ': ' + x.value);
}

/* ---- what a warrior carries, in words ---- */

export interface AttachedBlock { label: string; icon?: string; profile?: Profile; note?: string; qty?: number; [key: string]: unknown }

/** Mounts and attached creatures that come with a warrior. */
export function attachedBlocks(ctx: Ctx, def: UnitDef | null | undefined, m: Model | null | undefined): AttachedBlock[] {
  const out: AttachedBlock[] = [];
  if (def && def.attached) for (const a of def.attached as AttachedBlock[]) out.push(a);
  if (m && m.eq) {
    for (const nm of Object.keys(m.eq)) {
      const mount = ctx.data.MOUNTS[nm] as AttachedBlock | undefined;
      if ((Number(m.eq[nm]) || 0) > 0 && mount) out.push({ label: mount.label, icon: mount.icon, profile: mount.profile, note: mount.note, qty: Number(m.eq[nm]) || 1 });
    }
  }
  return out;
}

/** Fixed gear and list equipment in German item names (legacy summary). */
export function eqSummaryParts(ctx: Ctx, m: Model): string[] {
  const def = unitDef(ctx, m.uid_def);
  const out: string[] = [];
  if (!def) return out;
  if (def.gear) def.gear.forEach((g) => out.push(g));
  if (def.eq) {
    const list = eqListFor(ctx, def) ?? {};
    for (const cat of Object.keys(list)) for (const [nm] of list[cat] ?? []) {
      const qty = Number((m.eq ?? {})[nm]) || 0;
      if (!qty) continue;
      out.push((qty > 1 ? qty + '× ' : '') + nm.replace(' (1. gratis)', ''));
    }
  }
  return out;
}

/** Fixed gear and list equipment in English, braces of pistols as one, and
    inline weapon upgrades on their weapon. */
export function eqDisplayParts(ctx: Ctx, m: Model): string[] {
  const def = unitDef(ctx, m.uid_def);
  const out: string[] = [];
  if (!def) return out;
  if (def.gear) def.gear.forEach((g) => out.push(g));
  if (def.eq) {
    const list = eqListFor(ctx, def) ?? {};
    for (const cat of Object.keys(list)) for (const [nm] of list[cat] ?? []) {
      if (ctx.data.BRACE_HIDE[nm]) continue;
      const qty = Number((m.eq ?? {})[nm]) || 0;
      if (!qty) continue;
      const base = nm.replace(' (1. gratis)', '');
      const ups = m.rare ? Object.keys(m.rare).filter((de) => inlineUpgradeActive(ctx, de) && m.rare![de]!.on === nm) : [];
      const us = ups.length ? ` [${ups.map((de) => enItem(ctx.data, de)).join(', ')}]` : '';
      const plural = ctx.data.BRACE_PLURAL[base];
      if (plural && qty >= 2) {
        out.push('Brace of ' + plural);
        if (qty > 2) out.push((qty - 2) + '× ' + enItem(ctx.data, base));
      } else out.push((qty > 1 ? qty + '× ' : '') + enItem(ctx.data, base) + us);
    }
  }
  return out;
}

/** Rare and magic items carried on their own (inline upgrades show on their weapon). */
export function rareDisplayParts(ctx: Ctx, m: Model): string[] {
  const out: string[] = [];
  const r = m.rare || {};
  for (const de of Object.keys(r)) {
    if (inlineUpgradeActive(ctx, de)) continue;
    const it = ctx.data.CATALOG.find((x) => x.de === de);
    const q = Number(r[de]!.q) || 1;
    out.push((q > 1 ? q + '× ' : '') + (it ? it.en : de));
  }
  return out;
}

/** Equipment of a set of fallen as "N× Item", the free dagger marked. */
export function fallenEqAgg(ctx: Ctx, models: Model[]): string[] {
  const def = models[0] && unitDef(ctx, models[0].uid_def);
  const freeName = def ? daggerNameFor(ctx, def) : null;
  const freeBase = freeName ? freeName.replace(' (1. gratis)', '') : null;
  const tally: Record<string, number> = {};
  let freeCount = 0;
  for (const m of models) {
    for (const part of eqDisplayParts(ctx, m) || []) tally[part] = (tally[part] || 0) + 1;
    if (freeName && Number((m.eq || {})[freeName]) > 0) freeCount++;
  }
  const out: string[] = [];
  for (const part of Object.keys(tally)) {
    const n = tally[part] as number;
    if (freeBase && part === enItem(ctx.data, freeBase) && freeCount > 0) {
      const paid = n - freeCount;
      if (freeCount > 0) out.push(`${freeCount > 1 ? freeCount + '× ' : ''}${part} (free)`);
      if (paid > 0) out.push(`${paid > 1 ? paid + '× ' : ''}${part}`);
    } else out.push(`${n > 1 ? n + '× ' : ''}${part}`);
  }
  return out;
}
