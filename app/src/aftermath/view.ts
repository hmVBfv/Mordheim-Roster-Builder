/* What the aftermath screen shows of one battle (phase 4a4; concept.md 4.2,
   docs/mockups/changes.html): the Roster Builder's post-battle sequence on
   the save, read by core for the battle's round – who still rolls an
   injury, the experience held, the exploration dice, the wyrdstone sale.
   Kept apart from React so it can be tested. */
import * as core from '@mordheim/core';
import type { Casualty, GameData, WarbandState } from '@mordheim/core';
import { rosterView } from '../roster/view.ts';
import { localBattle, type LocalBattle } from './takeover.ts';

export interface StepView { key: string; title: string; link: string; done: boolean; active: boolean; locked: boolean }
export interface CasualtyView { id: number; text: string; result: string; ours: boolean; uid: number | null; hero: boolean; open: boolean }

export interface AftermathView {
  local: LocalBattle;
  round: number;
  steps: StepView[];
  casualties: CasualtyView[];
  /** Ours, still to roll. */
  toRoll: number;
  xpAwarded: boolean;
  pendingXp: { id: number; name: string; amount: number; reason: string }[];
  /** Deaths recorded by hand, not yet taken off the roster. */
  deathsToApply: number;
  advancesDue: string[];
  explore: { capped: number; base: number; survivors: number; winDie: number; searching: string[] };
  wyrd: { shards: number; size: number; band: string; sold: core.WyrdSale | null; price: (n: number) => number };
  rating: number;
  gold: number;
}

/** The battle's aftermath on the save – null until the battle is taken over. */
export function aftermathView(data: GameData, s: WarbandState, battleId: string): AftermathView | null {
  const local = localBattle(s, battleId);
  if (!local) return null;
  const ctx = core.ctxOf(data, s);
  const round = Number(local.round) || 0;
  const pb = core.postbattleState(ctx, round);
  const active = core.pbActiveStep(ctx, round);
  const steps = core.PB_STEPS.map(([key, title, link], i) => ({ key, title, link, done: !!pb.done[key], active: i === active, locked: i > active }));
  const cas: Casualty[] = (s.campaign?.casualties ?? []).filter((c) => c.battleId === local.id);
  const casualties = cas.map((c) => {
    const ours = core.casualtyIsOurs(c);
    const onRoster = ours && s.models.some((m) => m.uid === c.victim.uid);
    return { id: c.id, text: core.casualtyText(ctx, c), result: c.result, ours, uid: c.victim.uid ?? null, hero: core.casualtyIsHero(ctx, c), open: ours && onRoster && c.result === 'pending' };
  });
  const v = rosterView(data, s);
  const size = core.warbandSize(ctx);
  const ex = core.pbExploreDice(ctx, round);
  return {
    local, round, steps, casualties,
    toRoll: casualties.filter((c) => c.open).length,
    xpAwarded: !!local.xpAwarded,
    pendingXp: core.pendingXp(ctx).map((x) => ({ id: x.id, name: x.name, amount: x.amount, reason: x.reason })),
    deathsToApply: core.outstandingCasualties(ctx, round).length,
    advancesDue: [...v.heroes, ...v.henchmen, ...v.hires].filter((w) => w.advanceDue).map((w) => w.name),
    explore: { capped: ex.capped, base: ex.base, survivors: ex.survivors, winDie: ex.winDie, searching: core.pbSearchingHeroes(ctx, round) },
    wyrd: {
      shards: Number(s.stash?.wyrd) || 0, size, band: core.WYRD_BANDS[core.wyrdSizeBand(size)]?.[1] ?? '',
      sold: pb.wyrd?.done ? pb.wyrd : null, price: (n: number) => core.wyrdPrice(ctx, n, size),
    },
    rating: core.totalRating(ctx),
    gold: core.goldCurrent(ctx),
  };
}

/** Grants the battle's experience once: +1 to whoever survived, +1 to the leader if it was won (core awardBattleXp), noted on the battle. */
export function grantBattleXp(data: GameData, ctx: core.Ctx, localId: number): WarbandState {
  const s = core.awardBattleXp(ctx, localId);
  return core.editBattle(core.ctxOf(data, s), localId, { xpAwarded: true });
}
