/* What a warband can learn to cast (wish of 8.11.2026): the spell schools its own units cast from, and the school of each Hired Sword and
   Dramatis Personae while he is on the roster – derived from the roster, so a school goes with the man who brought it. */
import type { UnitDef } from '../data/types.ts';
import type { Ctx } from './context.ts';
import { casterMagic, markLore } from './profile.ts';
import { warbandDef } from './lookup.ts';

export interface SpellEntry {
  name: string;
  /** "9", "Auto" – what stands in the brackets after the name; '' where nothing does. */
  difficulty: string;
  text: string;
  /** The line of lore of the page on mordheimer.net, or null where the page has none. */
  lore: string | null;
  /** A line that only names a group of spells (the Marauders' Marks), not a spell. */
  heading?: boolean;
}

export interface SpellSchool { key: string; name: string; note: string | null; spells: SpellEntry[] }

/** The warband's own schools (`label` null), then one source for each Hired Sword and Dramatis Personae on the roster who has one. */
export interface SpellSource { label: string | null; schools: SpellSchool[] }

function schoolOf(ctx: Ctx, key: string): SpellSchool | null {
  const list = ctx.data.SPELLS[key];
  if (!list) return null;
  return {
    key, name: list.name, note: list.note ?? null,
    spells: list.spells.map(([full, text]) => {
      const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(full);
      const name = m ? m[1]! : full;
      if (full.startsWith('▸')) return { name: full.replace(/^▸\s*/, ''), difficulty: '', text, lore: null, heading: true };
      return { name, difficulty: m ? m[2]! : '', text, lore: list.lore?.[name] ?? null };
    }),
  };
}

/** The schools a unit of the warband can cast from: its own rules, the Wizard it may be made, the Mark of the Marauders. */
function schoolKeysOf(ctx: Ctx, def: UnitDef): string[] {
  const ex = ctx.data.WBEXTRA[ctx.s.wb ?? ''] as { magic?: string } | undefined;
  const out: string[] = [];
  if (def.magic && ctx.data.SPELLS[def.magic]) out.push(def.magic);
  const inherent = casterMagic(ctx, def);
  if (inherent) out.push(inherent);
  else if (def.wizardOption && ex?.magic && ctx.data.SPELLS[ex.magic]) out.push(ex.magic);
  // a Marauder's Seer casts from the Mark of the warband once it has one
  if (ctx.s.wb === 'maraudersofchaos' && out[0] === 'marauderChaos') {
    const mark = markLore(ctx);
    if (mark && ctx.data.SPELLS[mark]) return [mark];
  }
  return out;
}

/** The keys of the schools the units of the warband cast from. */
export function ownSchoolKeys(ctx: Ctx): string[] {
  return [...new Set((warbandDef(ctx)?.units ?? []).flatMap((u) => schoolKeysOf(ctx, u)))];
}

export function warbandSpells(ctx: Ctx): SpellSource[] {
  const out: SpellSource[] = [];
  const keys = ownSchoolKeys(ctx);
  const own = keys.map((k) => schoolOf(ctx, k)).filter((x): x is SpellSchool => !!x);
  if (own.length) out.push({ label: null, schools: own });
  for (const [list, kind, recs] of [[ctx.data.HIREDSWORDS, 'Hired Sword', ctx.s.hired ?? []], [ctx.data.DRAMATIS, 'Dramatis Personae', ctx.s.dp ?? []]] as const) {
    for (const h of recs) {
      const def = (list as Record<string, { name?: string; magic?: string }>)[h.key];
      const school = def?.magic ? schoolOf(ctx, def.magic) : null;
      if (school) out.push({ label: `${h.name || def?.name || h.key} · ${kind}`, schools: [school] });
    }
  }
  return out;
}
