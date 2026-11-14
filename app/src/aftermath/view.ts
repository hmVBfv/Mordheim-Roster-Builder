/* What the aftermath screen shows of one battle (phase 4a4; concept.md 4.2,
   docs/mockups/changes.html): the Roster Builder's post-battle sequence on
   the save, read by core for the battle's round – who still rolls an
   injury, the experience held, the exploration dice, the wyrdstone sale.
   Kept apart from React so it can be tested. */
import * as core from '@mordheim/core';
import type { Casualty, GameData, WarbandState } from '@mordheim/core';
import { rosterView } from '../roster/view.ts';
import { localBattle, type LocalBattle } from './takeover.ts';

export interface StepView { key: string; title: string; link: string; done: boolean; active: boolean; locked: boolean; /** What the step has brought so far, in a few words; null while there is nothing to say. */ summary: string | null }
export interface CasualtyView {
  id: number; text: string; result: string; ours: boolean; uid: number | null; hero: boolean; open: boolean;
  /** The victim's name, the roll as it was made ('' while pending) and what it means (core's wording of the result). */
  name: string; roll: string; meaning: string;
  /** Who put him out of action, with his warband ('' if unknown). */
  by: string;
}

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

/** The result line of each step, from the save: what it has brought so far (N2). Null where there is nothing to say yet. */
function stepSummaries(ctx: core.Ctx, round: number, o: { casualties: CasualtyView[]; xpAwarded: boolean; pendingXp: number; shards: number; sold: core.WyrdSale | null; rating: number }): Record<string, string | null> {
  const ours = o.casualties.filter((c) => c.ours);
  const rolled = ours.filter((c) => c.result !== 'pending').length;
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const bookings = (ctx.s.ledger ?? []).filter((e) => e.round === round);
  const searches = bookings.filter((e) => e.kind === 'search');
  const buys = bookings.filter((e) => e.kind === 'buy');
  const vet = core.veteransOf(ctx);
  return {
    injuries: ours.length === 0 ? 'No casualties' : `${rolled} of ${ours.length} rolled`,
    experience: !o.xpAwarded ? null : o.pendingXp > 0 ? `${plural(o.pendingXp, 'point')} held` : 'Written onto the roster',
    exploration: o.shards > 0 ? `${plural(o.shards, 'shard')} in the stash` : null,
    wyrdstone: o.sold ? `Sold ${plural(o.sold.shards, 'shard')} for ${o.sold.gc} gc` : null,
    veterans: vet ? `Roll ${vet.roll}, ${vet.spent} used` : null,
    rare: searches.length ? `${plural(searches.length, 'search')}, ${searches.filter((e) => e.found).length} found` : null,
    recruits: buys.length ? `${plural(buys.length, 'purchase')} for ${-buys.reduce((n, e) => n + e.amount, 0)} gc` : null,
    rating: `Rating ${o.rating}`,
  };
}

/** The battle's aftermath on the save – null until the battle is taken over. */
export function aftermathView(data: GameData, s: WarbandState, battleId: string): AftermathView | null {
  const local = localBattle(s, battleId);
  if (!local) return null;
  const ctx = core.ctxOf(data, s);
  const round = Number(local.round) || 0;
  const pb = core.postbattleState(ctx, round);
  const active = core.pbActiveStep(ctx, round);
  const cas: Casualty[] = (s.campaign?.casualties ?? []).filter((c) => c.battleId === local.id);
  const casualties = cas.map((c) => {
    const ours = core.casualtyIsOurs(c);
    const onRoster = ours && s.models.some((m) => m.uid === c.victim.uid);
    return { id: c.id, text: core.casualtyText(ctx, c), result: c.result, name: c.victim.name || 'a warrior', roll: c.code ?? '', meaning: c.detail || '', by: c.attacker.name ? `${c.attacker.name}${c.attacker.wb ? ` (${core.wbName(ctx, c.attacker.wb)})` : ''}` : '', ours, uid: c.victim.uid ?? null, hero: core.casualtyIsHero(ctx, c), open: ours && onRoster && c.result === 'pending' };
  });
  const v = rosterView(data, s);
  const size = core.warbandSize(ctx);
  const ex = core.pbExploreDice(ctx, round);
  const rating = core.totalRating(ctx);
  const summaries = stepSummaries(ctx, round, { casualties, xpAwarded: !!local.xpAwarded, pendingXp: core.pendingXp(ctx).length ? core.pendingXp(ctx).reduce((n, x) => n + x.amount, 0) : 0, shards: Number(s.stash?.wyrd) || 0, sold: pb.wyrd?.done ? pb.wyrd : null, rating });
  const steps = core.PB_STEPS.map(([key, title, link], i) => ({ key, title, link, done: !!pb.done[key], active: i === active, locked: i > active, summary: summaries[key] ?? null }));
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
    rating,
    gold: core.goldCurrent(ctx),
  };
}

/** Grants the battle's experience once, and counts the battle for those who took part: +1 to whoever survived, +1 to the leader if it was won (core awardBattleXp), noted on the battle. */
export function grantBattleXp(data: GameData, ctx: core.Ctx, localId: number): WarbandState {
  const s = core.awardBattleXp(ctx, localId);
  // the same step counts the battle for each who took part (#166); the button is gone once it was granted, so it is counted once
  return core.editBattle(core.ctxOf(data, core.countBattle(core.ctxOf(data, s), localId)), localId, { xpAwarded: true });
}
