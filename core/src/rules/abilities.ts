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
    denying clause ("is NOT a Large Target", "immune to psychology") does
    not count. */
export function abilityMentioned(re: RegExp, text: unknown): boolean {
  const cl = String(text || '').replace(/<[^>]*>/g, ' ')
    .replace(/([.;:!?])\s+/g, '$1\u0001').replace(/\s+[-\u2013\u2014]\s+/g, '\u0001')
    .replace(/\s+(?:but|however|although|though|whereas|while|except)\s+/gi, '\u0001')
    .split('\u0001');
  for (const c of cl) {
    const i = c.search(re);
    if (i < 0) continue;
    if (!/\b(?:not|n't)\b/i.test(c.slice(0, i))) return true;
  }
  return false;
}

export function leaderRuleText(): string {
  return 'Friendly models within 6 inches may use the leader\u2019s (usually better) Leadership value for their Leadership tests.';
}

export interface ModelAbilities {
  /** The unit's special rules as they apply to this warrior (the Leader rule
      only on the leader). */
  sp: string;
  /** Abilities found in the rules and mutations, e.g. Fear, Large Target. */
  abilities: ItemInfo[];
  /** Special skill lists the unit may draw from (Heroes only use them). */
  skillSets: { key: string; name: string }[];
  isHero: boolean;
  /** Spell lore and spells, if a caster. */
  lore: string | null;
  /** Skills learned. */
  skills: string[];
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
  let found: ItemInfo[] = [];
  const seen = new Set<string>();
  for (const [re, info] of ctx.data.ABILITYINFO) if (abilityMentioned(re, scan) && !seen.has(info.name)) { seen.add(info.name); found.push(info); }
  if (found.some((f) => f.name === 'Fearless')) found = found.filter((f) => f.name !== 'Fear' && f.name !== 'Terror');
  if (/immune to fear/i.test(scan) && !/causes? fear|fearsome/i.test(scan)) found = found.filter((f) => f.name !== 'Fear');
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
