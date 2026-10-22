/* Intended difference from the legacy app (docs/behaviour-changes.md, "Einheiten,
   deren Grenze an andere hängt", report #46): core limits some units by the size
   of others (Orc Mob Goblins and Squigs, Night Goblin Squigs, Black Orc Shootaz,
   Bretonnian Squires, Lizardmen Saurus Braves, Pirate Swabbies); legacy has the
   data's plain maxima. The parity suites compare against legacy's answers for
   exactly these units of exactly these warbands and leave everything else as it
   is. */
import * as core from '../../src/index.ts';
import type { Ctx, UnitDef } from '../../src/index.ts';
import { data } from './canon.ts';

/** Is the unit one whose limit hangs on others in this warband? */
export const isRatioUnit = (ctx: Ctx, id: string): boolean => core.ratioUnitIds(ctx.s.wb).includes(id);

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

/** The warnings legacy knows: not "Too many …" for these units. */
export function withoutRatioWarnings(wb: string | null | undefined, w: string[]): string[] {
  const names = core.ratioUnitIds(wb).map((id) => data.WARBANDS[wb as string]?.units.find((u) => u.id === id)?.name).filter(Boolean) as string[];
  return names.length ? w.filter((x) => !names.some((n) => x.startsWith(`Too many ${n} (`))) : w;
}

/** A recruit-menu row as legacy shows it. */
export function legacyMenuRow(ctx: Ctx, d: UnitDef, row: unknown[]): unknown[] {
  if (!isRatioUnit(ctx, d.id)) return row;
  const [id, count, , , gone] = row as [string, number, string, boolean, boolean];
  const mx = d.max;
  return [id, count, mx == null ? 'any' : `0–${mx}`, !!gone || (mx != null && count >= mx), gone];
}
