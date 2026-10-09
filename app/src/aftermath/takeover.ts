/* Taking a closed battle over into the warband's save (phase 4a4, ADR 0016):
   the save's own campaign layer is where core computes the aftermath – the
   Roster Builder's mechanics, 1:1. Once per battle (the battle in the save
   carries the server's id):
   - the campaign layer on, and the stage moved on to the battle's round
     (each stage closed with its snapshot, as "Next stage" did);
   - the battle recorded through the Roster Builder's battle form (core
     saveBattleDraft): every side with its outcome, the casualties this
     warband was part of – as victim or as attacker – and the map following
     the outcome. A warrior already among the Fallen is recorded dead and
     tied to his entry; the surroundings earn nobody experience. */
import * as core from '@mordheim/core';
import type { BattleDraft, DraftCasualty, GameData, WarbandState } from '@mordheim/core';
import { OUTCOME_NAMES, type BattleView, type CasualtyPayload, type Side } from '../battle/api.ts';
import { keyOf } from '../battle/sides.ts';

export interface LocalBattle { id: number; round: number; serverId: string; xpAwarded?: boolean }

/** The save's battle taken over from the server, if it is there. */
export function localBattle(s: WarbandState, battleId: string): LocalBattle | null {
  return ((s.campaign?.battles ?? []).find((x) => (x as { serverId?: unknown }).serverId === battleId) as LocalBattle | undefined) ?? null;
}

/** Our warrior as the form picks him now: as at the game night, else (the roster changed since) by his uid, else by his name. */
function pickOf(opts: core.SideModel[], s: Side): string {
  const key = (o: core.SideModel) => (o.dead ? `f${o.fallenIdx}` : `${o.uid}:${o.idx}`);
  const k = keyOf(s);
  const hit = opts.find((o) => key(o) === k)
    ?? (s.uid != null ? opts.find((o) => !o.dead && o.uid === s.uid) : undefined)
    ?? opts.find((o) => o.label === s.name);
  return hit ? key(hit) : '';
}

/** The battle as the Roster Builder's form would hold it. */
export function draftOf(data: GameData, s: WarbandState, view: BattleView, warbandId: string): BattleDraft {
  const ctx = core.ctxOf(data, s);
  const ours = core.sideModels(ctx, null, 'me');
  const sides = view.participants.map((p) => ({ key: p.warbandId === warbandId ? 'me' : '', name: p.name, wb: p.wbType, outcome: p.outcome ? OUTCOME_NAMES[p.outcome] : '' }));
  const sideIdx = (x: Side) => Math.max(0, view.participants.findIndex((p) => p.warbandId === x.warbandId));
  const cas: DraftCasualty[] = [];
  for (const e of view.entries) {
    if (e.kind !== 'casualty') continue;
    const c = e.payload as CasualtyPayload;
    const victimOurs = c.victim.warbandId === warbandId;
    const attackerOurs = !!c.attacker && !c.attacker.env && c.attacker.warbandId === warbandId;
    if (!victimOurs && !attackerOurs) continue;
    const a = c.attacker;
    cas.push({
      vSide: sideIdx(c.victim), vPick: victimOurs ? pickOf(ours, c.victim) : '', vName: c.victim.name,
      aSide: !a ? '' : a.env ? 'env' : sideIdx(a), aPick: attackerOurs && a ? pickOf(ours, a) : '', aName: a && !a.env ? a.name : '',
      note: c.note,
    });
  }
  return { round: view.battle.round, district: view.battle.district, notes: view.battle.title, sides, cas };
}

/** The save with the battle taken over (the same save when it is there already). */
export function takeOverBattle(data: GameData, s0: WarbandState, view: BattleView, warbandId: string, today: string): WarbandState {
  if (localBattle(s0, view.battle.id)) return s0;
  const ctx = (s: WarbandState) => core.ctxOf(data, s);
  let s = s0;
  if (!s.campaign?.on) s = core.setCampaignOn(ctx(s), true);
  while ((Number(s.campaign?.round) || 0) < view.battle.round) s = core.advanceRound(ctx(s), today);
  s = core.saveBattleDraft(ctx(s), null, draftOf(data, s, view, warbandId)).s;
  const local = (s.campaign?.battles ?? []).at(-1) as { id: number };
  return core.editBattle(ctx(s), local.id, { serverId: view.battle.id });
}
