/* Intended difference from the legacy app (docs/behaviour-changes.md, "Halfling-Kochbuch",
   report #82): core raises the warband's maximum by one for the Halfling cookbook; legacy
   does not know the rule. The parity suites compare against legacy's answers for the
   maximum and for the warning about it, and leave everything else as it is. */
import * as core from '../../src/index.ts';
import type { Ctx } from '../../src/index.ts';


/** The maximum as legacy answers it: without the cookbook's one. */
export const legacyMax = (ctx: Ctx): number => core.warbandMax(ctx) - core.cookbookBonus(ctx);

/** The warnings with the one about the size of the warband as legacy words it. */
export function withLegacyMaxWarning(ctx: Ctx, warnings: string[]): string[] {
  if (!core.cookbookBonus(ctx)) return warnings;
  const mx = legacyMax(ctx);
  const count = core.totalModels(ctx);
  const at = warnings.findIndex((w) => w.startsWith('At most '));
  const legacy = count > mx ? `At most ${mx} models allowed (currently ${count}).` : null;
  if (at >= 0) return legacy ? warnings.map((w, i) => (i === at ? legacy : w)) : warnings.filter((_, i) => i !== at);
  return legacy ? [...warnings, legacy] : warnings;
}

