/* The exploration roll of the post-battle sequence (N5, docs/plan-postbattle.md; mordheimer.net, Campaigns: Income – "exploration procedure"
   and "rolling multiples"). One D6 for each Hero who was not taken out of action, one more for a win (core pbExploreDice); at most six of the
   dice rolled are kept. Their total gives the shards found (chart), and two or more of a number an unusual place. The dice come in as numbers:
   core never rolls (the interface does, or the player types what the table showed). Everything the roll brought is recorded in the round
   (ADR 0032) and can be taken back. */
import type { WarbandState } from '../state/types.ts';
import type { Ctx } from '../rules/context.ts';
import type { GameData } from '../data/types.ts';
import { logEvent } from '../warband/log.ts';
import { update } from '../warband/update.ts';
import { postbattleOn, type Find, type PostBattleState, type Rolled } from './postbattle.ts';

/** At most six dice are picked out of all the dice rolled, even where more are allowed. */
export const EXPLORE_DICE_MAX = 6;

/** The chart "Number of wyrdstone shards found": a range of totals ('1–5', '36+') gives a number of shards. */
export function exploreShards(data: GameData, total: number): number {
  const t = Math.floor(Number(total) || 0);
  if (t < 1) return 0;
  for (const [range, shards] of data.PB_EXPLORE_SHARDS) {
    const m = /^(\d+)(?:[–-](\d+)|\+)?$/.exec(range.trim());
    if (!m) continue;
    const lo = Number(m[1]);
    const hi = m[2] != null ? Number(m[2]) : (range.includes('+') ? Infinity : lo);
    if (t >= lo && t <= hi) return shards;
  }
  return 0;
}

export interface Multiple { count: number; face: number; key: string }

/** The unusual place the dice lead to: the most numerous multiple counts, and of two of one size the higher number. `key` is the place's
    key in the chart ('5 5 5'). Null when no number came up twice. */
export function exploreMultiple(dice: readonly number[]): Multiple | null {
  const per = new Map<number, number>();
  for (const d of dice) per.set(d, (per.get(d) ?? 0) + 1);
  let best: Multiple | null = null;
  for (const [face, count] of per) {
    if (count < 2) continue;
    if (!best || count > best.count || (count === best.count && face > best.face)) best = { count, face, key: Array(count).fill(String(face)).join(' ') };
  }
  return best;
}

export interface ExploreResult { total: number; shards: number; location: string | null }

/** What the dice that were kept come to. */
export function exploreResult(data: GameData, kept: readonly number[]): ExploreResult {
  const total = kept.reduce((n, d) => n + d, 0);
  return { total, shards: exploreShards(data, total), location: exploreMultiple(kept)?.key ?? null };
}

export interface ExploreInput {
  /** Every die rolled. */
  rolled: readonly number[];
  /** The dice kept (at most six); by default the best six. */
  kept?: readonly number[];
  by: Rolled['by'];
}

const isDie = (d: unknown): d is number => Number.isInteger(d) && (d as number) >= 1 && (d as number) <= 6;

/** The best dice, at most six, highest first. */
export function bestDice(rolled: readonly number[]): number[] {
  return [...rolled].sort((a, b) => b - a).slice(0, EXPLORE_DICE_MAX);
}

const roundRec = (s: WarbandState, round: number): PostBattleState | undefined =>
  (s.campaign as { postbattle?: Record<string, PostBattleState> } | undefined)?.postbattle?.[round];

/** Why this roll cannot be recorded (null if it can): a die that is not a die, a kept die that was not rolled, too many kept, or – when an
    earlier roll is to be replaced – shards of it that are no longer in the stash. */
export function explorationProblem(ctx: Ctx, round: number, input: ExploreInput): string | null {
  if (!input.rolled.length) return 'Roll at least one die.';
  if (!input.rolled.every(isDie)) return 'Every die shows 1 to 6.';
  const kept = input.kept ?? bestDice(input.rolled);
  if (!kept.length) return 'Keep at least one die.';
  if (kept.length > EXPLORE_DICE_MAX) return `Keep at most ${EXPLORE_DICE_MAX} dice.`;
  const pool = [...input.rolled];
  for (const k of kept) {
    const i = pool.indexOf(k);
    if (i < 0) return 'A kept die was not rolled.';
    pool.splice(i, 1);
  }
  const before = roundRec(ctx.s, round)?.explore;
  if (before && (Number(ctx.s.stash?.wyrd) || 0) < before.shards) return `The ${before.shards} shards of the first roll are no longer all in the stash: put them back, then roll again.`;
  return null;
}

const nextFindId = (finds: Find[]): number => finds.reduce((n, f) => Math.max(n, f.id), 0) + 1;

/** Takes the exploration of the round off the stash and the round's finds (draft level). */
function takeBack(d: WarbandState, rec: PostBattleState): void {
  const was = rec.explore;
  if (!was) return;
  d.stash = d.stash ?? { wyrd: 0, gold: null, items: [] };
  d.stash.wyrd = Math.max(0, (Number(d.stash.wyrd) || 0) - was.shards);
  rec.finds = (rec.finds ?? []).filter((f) => f.source !== 'explore');
  delete rec.explore;
}

/** Records the exploration of the round: the dice, the result, the shards into the stash, a find with its origin. A second roll replaces the
    first. A roll that cannot be recorded (see explorationProblem) leaves the state as it was. */
export function recordExploration(ctx: Ctx, round: number, input: ExploreInput): WarbandState {
  if (explorationProblem(ctx, round, input)) return ctx.s;
  const kept = [...(input.kept ?? bestDice(input.rolled))];
  const result = exploreResult(ctx.data, kept);
  return update(ctx, (d, c) => {
    const rec = postbattleOn(d, c, round);
    takeBack(d as unknown as WarbandState, rec);
    d.stash = d.stash ?? { wyrd: 0, gold: null, items: [] };
    d.stash.wyrd = (Number(d.stash.wyrd) || 0) + result.shards;
    const text = `Explored with ${kept.join(', ')} (${result.total}): ${result.shards} shard${result.shards === 1 ? '' : 's'}${result.location ? `, an unusual place (${result.location})` : ''}.`;
    rec.explore = { rolled: { value: [...input.rolled], by: input.by }, kept, total: result.total, shards: result.shards, location: result.location };
    rec.finds = [...(rec.finds ?? []), { id: nextFindId(rec.finds ?? []), kind: 'wyrd', source: 'explore', amount: result.shards, text: `Found ${result.shards} shard${result.shards === 1 ? '' : 's'} exploring.` } satisfies Find];
    logEvent(d, 'explore', text, { round });
  });
}

/** Takes the exploration back: the shards leave the stash, the record and its find go. Nothing to take back leaves the state as it was. */
export function clearExploration(ctx: Ctx, round: number): WarbandState {
  const rec = roundRec(ctx.s, round);
  if (!rec?.explore) return ctx.s;
  if ((Number(ctx.s.stash?.wyrd) || 0) < rec.explore.shards) return ctx.s;
  return update(ctx, (d, c) => {
    takeBack(d as unknown as WarbandState, postbattleOn(d, c, round));
  });
}
