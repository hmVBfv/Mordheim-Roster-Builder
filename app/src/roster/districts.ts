/* The districts of Mordheim a warband holds (phase 4a4; the Roster
   Builder's campaign panel): every district by area, what a foothold or
   control there gives, and what the warband holds – set by hand as the
   Roster Builder allowed (core setDistrict); after a battle of the
   campaign the map follows the outcome on its own. In a campaign on the
   server the others' footholds are known too, so control – the only
   foothold there – can be seen. Kept apart from React so it can be tested. */
import * as core from '@mordheim/core';
import type { GameData, WarbandState } from '@mordheim/core';

export type Hold = 'none' | 'foothold' | 'control';
export interface DistrictRow {
  id: string; name: string; hold: Hold;
  hardFought: boolean; abundance: boolean; gate: boolean;
  effects: { label: string; control: boolean }[];
  /** Other warbands of the campaign with a foothold here. */
  others: string[];
}
export interface DistrictsView { areas: { area: string; rows: DistrictRow[] }[]; held: number; active: { district: string; label: string }[] }

export function districtsView(data: GameData, s: WarbandState, others: { name: string; districts: { id: string }[] }[] = []): DistrictsView {
  const ctx = core.ctxOf(data, s);
  const areas = new Map<string, DistrictRow[]>();
  for (const d of data.DISTRICTS) {
    const area = String(d.area ?? 'Elsewhere');
    const row: DistrictRow = {
      id: d.id, name: d.name, hold: core.districtState(ctx, d.id) as Hold,
      hardFought: !!d.hardFought, abundance: !!d.abundance, gate: !!d.gate,
      effects: d.effects.map((e) => ({ label: e.label ?? '', control: e.tier === 'control' })),
      others: others.filter((o) => o.districts.some((x) => x.id === d.id)).map((o) => o.name),
    };
    areas.set(area, [...(areas.get(area) ?? []), row]);
  }
  return {
    areas: [...areas].map(([area, rows]) => ({ area, rows: rows.sort((a, b) => a.name.localeCompare(b.name)) })),
    held: data.DISTRICTS.filter((d) => core.districtState(ctx, d.id) !== 'none').length,
    active: core.activeDistrictEffects(ctx).map((e) => ({ district: e.district, label: e.label ?? '' })),
  };
}
