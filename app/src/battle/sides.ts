/* Who can go out of action, and who put them there (phase 4a2): the
   warriors of the warbands that fought, henchmen man by man and the Fallen
   too, as the Roster Builder's battle form lists them (core sideModels). */
import * as core from '@mordheim/core';
import type { GameData, WarbandState } from '@mordheim/core';
import type { Side } from './api.ts';

export interface Pick { key: string; label: string; side: Side }

export function warriorsOf(data: GameData, state: WarbandState, warbandId: string): Pick[] {
  return core.sideModels(core.ctxOf(data, state), null, 'me').map((m) => ({
    key: m.dead ? `f${m.fallenIdx}` : `${m.uid}:${m.idx}`,
    label: m.dead ? `${m.label} (fallen)` : m.label,
    side: {
      warbandId, uid: m.uid, name: m.label, grade: m.hero ? 'hero' : 'hench', wb: String(state.wb),
      ...(m.dead ? { fallenIdx: m.fallenIdx } : { idx: m.idx }),
    },
  }));
}

/** The key of a side within its warband's list, to show a recorded casualty in the form again. */
export const keyOf = (s: Side) => (s.fallenIdx != null ? `f${s.fallenIdx}` : s.uid != null ? `${s.uid}:${s.idx ?? 0}` : '');
