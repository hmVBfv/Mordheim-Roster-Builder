/* Intended difference from the legacy app (docs/behaviour-changes.md, "Orc Mob:
   Goblins und Cave Squigs", report #46): core limits the Goblins of an Orc Mob
   to two for each Orc and its Cave Squigs to the Goblins; legacy has the data's
   plain maxima (Goblins: any number, Squigs: 5). The parity suites compare
   against legacy's answers for exactly these two units of exactly this warband
   and leave everything else as it is. */
import * as core from '../../src/index.ts';
import type { Ctx, UnitDef } from '../../src/index.ts';

/** Goblin Warriors and Cave Squigs of an Orc Mob. */
export const isRatioUnit = (ctx: Ctx, id: string): boolean => ctx.s.wb === 'orcmob' && (id === 'goblin' || id === 'squig');

/** What legacy answers for the unit's maximum. */
export function legacyUnitMax(ctx: Ctx, d: UnitDef): number | null | undefined {
  return isRatioUnit(ctx, d.id) ? d.max : core.unitMax(ctx, d);
}

/** Would core's ratio limit refuse (or cut) what legacy accepts: `count` men of the unit? */
export function ratioBinds(ctx: Ctx, id: string, count: number): boolean {
  const d = core.unitDef(ctx, id);
  if (!d || !isRatioUnit(ctx, id)) return false;
  const mx = core.unitMax(ctx, d);
  return mx != null && count > mx;
}

/** The warnings legacy knows: not the ratio ones. */
export const withoutRatioWarnings = (wb: string | null | undefined, w: string[]): string[] => (wb === 'orcmob' ? w.filter((x) => !/^Too many (Goblin|Cave Squig) \(/.test(x)) : w);

/** A recruit-menu row as legacy shows it. */
export function legacyMenuRow(ctx: Ctx, d: UnitDef, row: unknown[]): unknown[] {
  if (!isRatioUnit(ctx, d.id)) return row;
  const [id, count, , , gone] = row as [string, number, string, boolean, boolean];
  const mx = d.max;
  return [id, count, mx == null ? 'any' : `0–${mx}`, !!gone || (mx != null && count >= mx), gone];
}
