/* A warband's own stage beside its campaign's history (phase 4a5;
   behaviour-changes.md, decision 2 "Laufende Kampagne"). The group's saves
   from the Roster Builder stand at "Setup" with the campaign layer off,
   although they have fought several battles: the new builder asks where a
   running campaign stands rather than working it out – here the campaign
   says it. A warband that fought a battle of the history (played before
   the app) takes the stage after the history's last battle, once: no
   stage is closed on the way (no snapshots, no sat-out games served –
   those battles were not played here). From then on the stage moves as
   always, battle by battle in the aftermath. */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';

/** The campaign's history as the app reads it from the overview (campaign/api.ts historyOf). */
export interface HistoryOfCampaign { round: number; warbandIds: string[] }

/** The stage the warband should take from its campaign's history, or null when it stands there already (or fought none of it). */
export function stageBehind(s: WarbandState, warbandId: string, history: HistoryOfCampaign | null | undefined): number | null {
  if (!history?.round || !history.warbandIds.includes(warbandId)) return null;
  return (Number(s.campaign?.round) || 0) < history.round ? history.round : null;
}

/** The save at the campaign's stage: the campaign layer on, the stage set – nothing closed on the way. */
export function takeStage(c: core.Ctx, round: number): WarbandState {
  const on = c.s.campaign?.on ? c.s : core.setCampaignOn(c, true);
  return core.setRound(core.ctxOf(c.data, on), round);
}
