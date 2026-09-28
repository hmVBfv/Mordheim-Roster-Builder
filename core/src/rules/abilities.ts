/* Which abilities a warrior has, read from his rules text (legacy app.js
   abilityMentioned, the logic of abilitySection, skillNameList,
   skillChipsIn, fixedSkills). The interface draws these as chips with
   tooltips; deciding which apply is a rule. */
import type { GameData, HireEntry, ItemInfo, UnitDef } from '../data/types.ts';
import type { HireRecord, Model } from '../state/types.ts';
import type { Ctx } from './context.ts';
import { isHeroModel } from './costs.ts';
import { hsPersona } from './hire.ts';
import { casterLore, isLeaderModel } from './profile.ts';

/** Is an ability named in this text in a way that grants it? A mention in a
    denying clause ("is NOT a Large Target", "immune to All Alone tests",
    "never has to take All Alone tests", "no Leadership test for being All
    Alone") does not count. */
export function abilityMentioned(re: RegExp, text: unknown): boolean {
  const cl = String(text || '').replace(/<[^>]*>/g, ' ')
    .replace(/([.;:!?])\s+/g, '$1\u0001').replace(/\s+[-\u2013\u2014]\s+/g, '\u0001')
    .replace(/\s+(?:but|however|although|though|whereas|while|except)\s+/gi, '\u0001')
    .split('\u0001');
  for (const c of cl) {
    const i = c.search(re);
    if (i < 0) continue;
    if (!/\b(?:not|n't|immune to|exempt from|never (?:has|have|needs?) to)\b|\bno\b[^,;()]*\btests?\b/i.test(c.slice(0, i))) return true;
  }
  return false;
}

export function leaderRuleText(): string {
  return 'Friendly models within 6 inches may use the leader\u2019s (usually better) Leadership value for their Leadership tests.';
}

/* ---- which rule a name means, for this warrior ----
   Skills and special rules share names across warbands with different
   effects ("Infiltration", "Animosity", "Bellowing Roar"). A tooltip looked
   up by the bare name showed whichever came first in the data. So a chip
   carries a key that says whose rule it is, and the tooltip resolves it the
   same way the chip was chosen: the unit's own definition first, then a skill
   from the unit's own lists, then the general entry. */

/** A rule a text defines by name: "Name: what it does". */
export interface RuleDef { name: string; text: string; line: string }

/** The rules a text defines, in order: every "Name:" heading with its text
    (the headings the rules panel draws in bold). */
export function ruleDefs(text: unknown, line: string): RuleDef[] {
  const out: RuleDef[] = [];
  const segs = String(text || '').replace(/<br\s*\/?>/gi, ' ')
    .split(/(?<=[.!?)"\u201d;]|<\/b>)\s+(?=(?:<b>)?[A-Z][^:<>.]{1,36}:)/);
  for (const sg of segs) {
    const t = sg.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const m = t.match(/^([A-Z][^:<>.]{1,36}):\s*([\s\S]+)$/);
    if (m) out.push({ name: (m[1] as string).trim(), text: (m[2] as string).trim(), line });
  }
  return out;
}

/** A rule name for comparison: case, a parenthetical, punctuation and a
    plural do not matter ("Leader (12")" is "Leader", "Hirelings" is
    "Hireling", "Expert Swordsmen" is "Expert Swordsman"). */
export function ruleKey(name: string): string {
  return String(name).toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z']+/g, ' ').trim()
    .replace(/men$/, 'man').replace(/s$/, '');
}

/** Who a chip belongs to: a unit of a warband, or a Hired Sword or Dramatis
    Persona (with the persona he was hired as). */
export type RuleOwner =
  | { kind: 'unit'; wb: string; id: string }
  | { kind: 'hs' | 'dp'; key: string; persona: string };

const STD_LISTS = ['combat', 'shooting', 'academic', 'strength', 'speed'];

function ownerDefs(data: GameData, o: RuleOwner): RuleDef[] {
  if (o.kind === 'unit') {
    const W = data.WARBANDS[o.wb];
    const def = W?.units.find((u) => u.id === o.id);
    if (!W || !def) return [];
    return [...ruleDefs(def.sp, `Special rule \u00b7 ${def.name}`), ...ruleDefs(W.rules, `Warband rule \u00b7 ${W.name}`)];
  }
  const e = (o.kind === 'hs' ? data.HIREDSWORDS : data.DRAMATIS)[o.key];
  if (!e) return [];
  const pers = (e.personas as { name: string; sp?: string }[] | undefined)?.find((p) => p.name === o.persona);
  return [...ruleDefs(pers?.sp, `Special rule \u00b7 ${e.name}`), ...ruleDefs(e.sp, `Special rule \u00b7 ${e.name}`)];
}

/** The skill lists a unit learns from, its own special lists first. */
export function unitSkillLists(data: GameData, wb: string | null | undefined, def: UnitDef | undefined): string[] {
  const out: string[] = [];
  const add = (k: string | undefined) => { if (k && !out.includes(k) && (data.SKILLSETS[k] || data.SKILLLISTS[k])) out.push(k); };
  for (const c of def?.sk || []) if (!STD_LISTS.includes(c)) add(c);
  const ex = wb ? data.WBEXTRA[wb] as { skills?: string } | undefined : undefined;
  add(ex?.skills);
  for (const c of def?.sk || []) add(c);
  return out;
}

function skillIn(data: GameData, list: string, name: string): ItemInfo | null {
  const L = data.SKILLSETS[list] || data.SKILLLISTS[list];
  const e = L?.skills.find((x) => x[0].toLowerCase() === name.toLowerCase());
  return L && e ? { name: e[0], line: 'Skill \u00b7 ' + L.name, text: e[1] } : null;
}

/** The key of a skill this warrior has: the first of his own lists that has
    it, else any standard list, else any list at all; the bare name if none
    does. */
export function skillKey(data: GameData, wb: string | null | undefined, def: UnitDef | undefined, name: string): string {
  const lists = [...unitSkillLists(data, wb, def), ...Object.keys(data.SKILLLISTS), ...Object.keys(data.SKILLSETS)];
  for (const k of lists) if (skillIn(data, k, name)) return `skill|${k}|${name}`;
  return name;
}

function ownerSkillLists(data: GameData, o: RuleOwner): string[] {
  if (o.kind !== 'unit') return [];
  return unitSkillLists(data, o.wb, data.WARBANDS[o.wb]?.units.find((u) => u.id === o.id));
}

const ownerKey = (o: RuleOwner) => o.kind === 'unit' ? `${o.wb}|${o.id}` : `${o.kind}|${o.key}|${o.persona}`;

/** What an ability means for its owner: his own definition, else a skill of
    that name from his own lists, else the general entry. Null when the entry
    is the rule of a particular unit or warband (`own`) and this owner neither
    defines it nor is named in its `wb` list. */
export function abilityFor(data: GameData, o: RuleOwner, idx: number): (ItemInfo & { key: string }) | null {
  const entry = data.ABILITYINFO[idx];
  if (!entry) return null;
  const info = entry[1];
  const key = `abil|${ownerKey(o)}|${idx}`;
  const own = ownerDefs(data, o).find((d) => ruleKey(d.name) === ruleKey(info.name));
  if (own) return { name: info.name, line: own.line, text: own.text, key };
  for (const l of ownerSkillLists(data, o)) {
    const sk = skillIn(data, l, info.name);
    if (sk) return { ...sk, name: info.name, key };
  }
  if (info.own) {
    const scope = (info.wb as string[] | undefined) || [];
    const here = o.kind === 'unit' ? o.wb : `${o.kind}:${o.key}`;
    if (!scope.includes(here)) return null;
  }
  return { ...info, key };
}

/** The abilities a rules text grants its owner, as chips. */
export function abilityChips(data: GameData, o: RuleOwner, scan: string): (ItemInfo & { key: string })[] {
  let found: (ItemInfo & { key: string })[] = [];
  const seen = new Set<string>();
  data.ABILITYINFO.forEach(([re, info], i) => {
    if (seen.has(info.name) || !abilityMentioned(re, scan)) return;
    const c = abilityFor(data, o, i);
    if (!c) return;
    seen.add(info.name);
    found.push(c);
  });
  if (found.some((f) => f.name === 'Fearless')) found = found.filter((f) => f.name !== 'Fear' && f.name !== 'Terror');
  if (/immune to fear/i.test(scan) && !/causes? fear|fearsome/i.test(scan)) found = found.filter((f) => f.name !== 'Fear');
  return found;
}

/** A chip key back to what its tooltip shows ("abil|\u2026", "skill|\u2026"); null
    for anything else. */
export function keyedInfo(data: GameData, key: string): ItemInfo | null {
  const p = String(key).split('|');
  if (p[0] === 'skill' && p.length >= 3) return skillIn(data, p[1] as string, p.slice(2).join('|'));
  if (p[0] !== 'abil') return null;
  const idx = Number(p[p.length - 1]);
  const o: RuleOwner | null = p.length === 4 ? { kind: 'unit', wb: p[1] as string, id: p[2] as string }
    : p.length === 5 && (p[1] === 'hs' || p[1] === 'dp') ? { kind: p[1], key: p[2] as string, persona: p[3] as string } : null;
  if (!o) return null;
  const c = abilityFor(data, o, idx);
  if (c) { const rest: ItemInfo & { key?: string } = { ...c }; delete rest.key; return rest; }
  return data.ABILITYINFO[idx]?.[1] ?? null;
}

export interface ModelAbilities {
  /** The unit's special rules as they apply to this warrior (the Leader rule
      only on the leader). */
  sp: string;
  /** Abilities found in the rules and mutations, e.g. Fear, Large Target,
      each with the key its tooltip is looked up by. */
  abilities: (ItemInfo & { key: string })[];
  /** Special skill lists the unit may draw from (Heroes only use them). */
  skillSets: { key: string; name: string }[];
  isHero: boolean;
  /** Spell lore and spells, if a caster. */
  lore: string | null;
  /** Skills learned. */
  skills: string[];
  /** The tooltip key of each learned skill (same order). */
  skillKeys: string[];
}

/** What the abilities panel of a unit card shows. */
export function modelAbilities(ctx: Ctx, def: UnitDef, m: Model | null): ModelAbilities {
  let sp = def.sp || '';
  if (m && isHeroModel(ctx, m)) {
    if (!isLeaderModel(ctx, m)) sp = sp.replace(/(<b>\s*)?Leader:(<\/b>)?[^.]*\.\s*/i, '');
    else if (!/Leader:/i.test(sp)) sp = '<b>Leader:</b> ' + leaderRuleText() + ' ' + sp;
  }
  const muts = (m && m.mut) || [];
  // innate rules and mutations, in English so the ability patterns match
  const scan = sp + ' ' + muts.map((x) => ctx.data.MUTEN[x] || x).join(' ');
  const found = abilityChips(ctx.data, { kind: 'unit', wb: ctx.s.wb ?? '', id: def.id }, scan);
  const std = ['combat', 'shooting', 'academic', 'strength', 'speed'];
  const sets: { key: string; name: string }[] = [];
  const setSeen = new Set<string>();
  for (const c of def.sk || []) if (!std.includes(c) && ctx.data.SKILLSETS[c] && !setSeen.has(c)) { setSeen.add(c); sets.push({ key: c, name: ctx.data.SKILLSETS[c]!.name }); }
  const ex = ctx.s.wb ? ctx.data.WBEXTRA[ctx.s.wb] as { skills?: string } | undefined : undefined;
  if (ex && ex.skills && ctx.data.SKILLSETS[ex.skills] && !setSeen.has(ex.skills)) { setSeen.add(ex.skills); sets.push({ key: ex.skills, name: ctx.data.SKILLSETS[ex.skills]!.name }); }
  return {
    sp, abilities: found, skillSets: sets,
    isHero: def.t === 'hero' || !!(m && m.promoted),
    lore: m ? casterLore(ctx, m) : null,
    skills: (m && m.skills) || [],
    skillKeys: ((m && m.skills) || []).map((nm) => skillKey(ctx.data, ctx.s.wb, def, nm)),
  };
}

/* ---- skills named in rules texts ---- */

const SKILL_NAMES = new WeakMap<GameData, string[]>();

/** Every skill name of the standard lists, longest first. */
export function skillNameList(data: GameData): string[] {
  let out = SKILL_NAMES.get(data);
  if (!out) {
    const all: string[] = [];
    for (const c of Object.keys(data.SKILLLISTS)) (data.SKILLLISTS[c]!.skills || []).forEach((sk) => all.push(sk[0]));
    out = [...new Set(all)].sort((a, b) => b.length - a.length);
    SKILL_NAMES.set(data, out);
  }
  return out;
}

/** Skills named in a rules text ("Knife Fighter" and "Knife-Fighter" alike). */
export function skillChipsIn(data: GameData, sp: string): string[] {
  const out: string[] = [];
  for (const nm of skillNameList(data)) {
    const pat = nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[-\s]+/g, '[-\\s]+');
    const re = new RegExp('(^|[^A-Za-z])' + pat + '([^A-Za-z]|$)', 'i');
    if (re.test(sp)) out.push(nm);
  }
  return out;
}

/** Skills a Hired Sword always has, his persona's included. */
export function fixedSkills(ctx: Ctx, e: HireEntry, rec?: HireRecord | null): string[] {
  const p = (rec && e.personas) ? hsPersona(ctx, rec, e) : null;
  return [...((e.skills as string[] | undefined) || []), ...((p && (p.skills as string[] | undefined)) || [])];
}
