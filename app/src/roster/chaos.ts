/* Mutations, Blessings of Nurgle and the Marks of Chaos (phase 3c): what
   their sheets show, worked out by core. The screens are built from the
   app's own patterns (a list of toggles, a pick list), so the app is their
   mockup (docs/roadmap.md, phase 3). */
import * as core from '@mordheim/core';

export interface MutationItem {
  key: string; name: string; price: number; text: string;
  /** How many he has, and why not one more or one less ('' = may). */
  count: number; more: string; less: string;
}

export interface MutationView {
  uid: number;
  name: string;
  /** "Mutations" or "Blessings of Nurgle". */
  label: string;
  /** One word for one of them. */
  one: string;
  /** He may have them through the Mutant skill, not his unit's rules. */
  viaSkill: boolean;
  /** His rules ask for at least one (a Mutant, a Tainted One). */
  required: boolean;
  items: MutationItem[];
  /** What the chosen ones cost: the dearest at its price, every further
      one double (core mutCost). */
  cost: number;
  /** After his first battle: no more mutations (unless by the Mutant skill). */
  locked: boolean;
}

export function mutationView(ctx: core.Ctx, uid: number): MutationView | null {
  const m = ctx.s.models.find((x) => x.uid === uid);
  const def = m ? core.unitDef(ctx, m.uid_def) : null;
  const kind = m ? core.mutKindFor(ctx, m) : null;
  if (!m || !def || !kind) return null;
  const set = ctx.data.MUTSETS[kind] ?? ctx.data.MUTATIONS;
  const chosen = m.mut ?? [];
  return {
    uid, name: m.name || def.name,
    label: ctx.data.MUTLABEL[kind] ?? 'Mutations',
    one: kind === 'nurgle' ? 'blessing' : 'mutation',
    viaSkill: !def.mut,
    required: !!def.mutReq,
    items: set.map(([key, price]) => {
      const name = core.mutEN(ctx.data, key);
      const count = chosen.filter((x) => x === key).length;
      return {
        key, name, price, text: core.abilityInfo(ctx.data, name)?.text ?? '', count,
        more: core.mutationProblem(ctx, uid, key, count + 1),
        less: count ? core.mutationProblem(ctx, uid, key, count - 1) : 'none to take back',
      };
    }),
    cost: core.mutCost(ctx, m),
    locked: !!def.mut && core.warriorHasFought(ctx, m),
  };
}

/** The Marks of the Marauders of Chaos: the Seer's choice sets the
    warband's god; the Chieftain may take the same Mark later. */
export interface MarkView {
  mark: string;
  options: { key: string; name: string; magic: boolean }[];
  /** What the chosen Mark gives the Seer, and the Chieftain once he takes it. */
  seerRules: [string, string][];
  leaderRules: [string, string][];
}

export function markView(ctx: core.Ctx): MarkView | null {
  if (ctx.s.wb !== 'maraudersofchaos') return null;
  const mark = ctx.s.mark || '';
  const rules = mark ? (ctx.data.MARK_RULES[mark] as { seer?: [string, string][]; leader?: [string, string][] } | undefined) : undefined;
  return {
    mark,
    options: ctx.data.MARAUDER_MARKS.map(([key, name, lore]) => ({ key, name, magic: !!lore })),
    seerRules: rules?.seer ?? [],
    leaderRules: rules?.leader ?? [],
  };
}

/** Is this warrior the Seer, or the Chieftain, of a Marauder warband? */
export function markRole(ctx: core.Ctx, uid: number): 'seer' | 'chief' | null {
  const m = ctx.s.models.find((x) => x.uid === uid);
  const def = m ? core.unitDef(ctx, m.uid_def) : undefined;
  if (core.isMarauderSeer(ctx, def)) return 'seer';
  if (core.isMarauderChief(ctx, def)) return 'chief';
  return null;
}
