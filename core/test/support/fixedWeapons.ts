/* A unit's fixed weapons (the Slayer's swords, the Kroxigor's halberd: `gear`) take a weapon upgrade, and core lists them among the weapons an
   upgrade may go on. Legacy knows only the weapons that were bought, so the parity tests compare those: the fixed ones are left out of the
   weapons and the targets, by name, and nothing else (docs/behaviour-changes.md, "Das Echsenschwert …"). Its own tests are in
   core/test/lizardman-sword.test.ts. */
import type { Ctx, Model } from '../../src/index.ts';
import * as core from '../../src/index.ts';

/** True for a weapon that is only there as the unit's fixed gear, not bought from his list. */
export function isFixedOnly(ctx: Ctx, m: Model, nm: string): boolean {
  return core.unitGear(ctx, m).includes(nm) && !(Number(m.eq?.[nm]) > 0);
}

/** An upgrade the catalogue keeps for one unit (the Slayer's Lizardman Sword) is offered to that unit only; legacy offers it to any Hero of the
    warband who carries a sword. The parity tests take it off legacy's list for the others. */
export function keptForOtherUnit(ctx: Ctx, m: Model, de: string): boolean {
  const it = ctx.data.CATALOG.find((x) => x.de === de);
  return !!it && !core.catalogAllowed(ctx, it, m);
}
