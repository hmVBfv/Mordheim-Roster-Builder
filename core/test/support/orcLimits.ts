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

/** Is the unit one whose limit hangs on others (`maxPer` in the data)? */
export const isRatioUnit = (ctx: Ctx, id: string): boolean => !!core.unitDef(ctx, id)?.maxPer;

const legacyData = new WeakMap<object, core.GameData>();
/** The data as the legacy app knows it: no unit hangs on others. */
function withoutMaxPer(d: core.GameData): core.GameData {
  let out = legacyData.get(d);
  if (!out) {
    const warbands = Object.fromEntries(Object.entries(d.WARBANDS).map(([k, w]) => [k, { ...w, units: w.units.map((u) => ({ ...u, maxPer: undefined })) }]));
    out = { ...d, WARBANDS: warbands } as core.GameData;
    legacyData.set(d, out);
  }
  return out;
}

/** The same state seen with the legacy app's maxima. */
export const legacyCtx = (ctx: Ctx): Ctx => core.ctxOf(withoutMaxPer(ctx.data), ctx.s);

/** What legacy answers for the unit's maximum. */
export function legacyUnitMax(ctx: Ctx, d: UnitDef): number | null | undefined {
  return d.maxPer ? d.max : core.unitMax(ctx, d);
}

/** The warnings legacy knows: not "Too many …" for these units. */
export function withoutRatioWarnings(wb: string | null | undefined, w: string[]): string[] {
  const names = (data.WARBANDS[wb as string]?.units ?? []).filter((u) => u.maxPer).map((u) => u.name);
  return names.length ? w.filter((x) => !names.some((n) => x.startsWith(`Too many ${n} (`))) : w;
}

/** A recruit-menu row as legacy shows it. */
export function legacyMenuRow(ctx: Ctx, d: UnitDef, row: unknown[]): unknown[] {
  if (!isRatioUnit(ctx, d.id)) return row;
  const [id, count, , , gone] = row as [string, number, string, boolean, boolean];
  const mx = d.max;
  return [id, count, mx == null ? 'any' : `0–${mx}`, !!gone || (mx != null && count >= mx), gone];
}
