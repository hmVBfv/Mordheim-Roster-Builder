/* House-rule settings (legacy js/state.js setHouseNum … resetHouse). */
import type { HouseRules, WarbandState } from '../state/types.ts';
import { houseDefaults, houseRules } from '../state/house.ts';
import type { Ctx } from '../rules/context.ts';
import { update } from './update.ts';

type Keys<V> = { [K in keyof HouseRules]: HouseRules[K] extends V ? K : never }[keyof HouseRules];

/** A numeric house rule; empty means "not set". */
export function setHouseNum(ctx: Ctx, key: Keys<number | ''> | Keys<number>, v: unknown): WarbandState {
  return update(ctx, (d) => {
    const h = (d.house = { ...houseRules(d as WarbandState) }) as Record<string, unknown>;
    h[key] = v === '' || v == null ? '' : Math.max(0, Number(v) || 0);
  });
}

export function setHouseBool(ctx: Ctx, key: Keys<boolean>, v: unknown): WarbandState {
  return update(ctx, (d) => { const h = (d.house = { ...houseRules(d as WarbandState) }) as Record<string, unknown>; h[key] = !!v; });
}

export function setHouseStr(ctx: Ctx, key: Keys<string>, v: string | null | undefined): WarbandState {
  return update(ctx, (d) => { const h = (d.house = { ...houseRules(d as WarbandState) }) as Record<string, unknown>; h[key] = v || ''; });
}

export function setHouseNotes(ctx: Ctx, v: unknown): WarbandState {
  return update(ctx, (d) => { d.house = { ...houseRules(d as WarbandState), notes: String(v) }; });
}

export function resetHouse(ctx: Ctx): WarbandState {
  return update(ctx, (d) => { d.house = houseDefaults(); });
}
