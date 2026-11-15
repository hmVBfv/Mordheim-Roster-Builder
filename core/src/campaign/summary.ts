/* The balance of a post-battle round (N13, docs/plan-postbattle.md): what the round's steps brought and cost, from the save alone – so every
   member of the campaign can read it, and the server can freeze it with the mark (ADR 0003). Pure. */
import type { Casualty, WarbandState } from '../state/types.ts';
import type { Ctx } from '../rules/context.ts';
import { stageSnapshots, stageTotals, type StageTotals } from './stages.ts';
import type { Find, PostBattleState } from './postbattle.ts';

export interface RoundSummary {
  round: number;
  /** Our casualties of the round, by what the rolls made of them. */
  injuries: { total: number; pending: number; dead: number; injured: number; recovered: number };
  /** Experience entered in the round, and the underdog bonus and scenario points among it. */
  experience: { points: number; underdog: number; scenario: number };
  /** The exploration roll, if one was recorded. */
  exploration: { dice: number; total: number; shards: number; location: string | null; by: 'entered' | 'app' } | null;
  /** Shards found (exploration and places), sold, and held now. */
  wyrd: { found: number; sold: number; held: number };
  /** Gold made, by source. */
  income: { wyrdstone: number; locations: number; scenario: number; goods: number; other: number; total: number };
  /** Gold spent, by kind. */
  spending: { upkeep: number; buys: number; searches: number; recruits: number; total: number };
  /** Everything the steps recorded with its origin, and the worth of the items among it. */
  finds: Find[];
  lootValue: number;
  /** The stage before the battle (the snapshot) and now; null where there is no snapshot. */
  before: StageTotals | null;
  after: StageTotals;
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
/** A sum turned round (money spent is a positive number), without a negative zero. */
const neg = (xs: number[]): number => 0 - sum(xs);

export function postBattleSummary(ctx: Ctx, round: number): RoundSummary {
  const s: WarbandState = ctx.s;
  const rec = (s.campaign as { postbattle?: Record<string, PostBattleState> } | undefined)?.postbattle?.[round];
  const finds = rec?.finds ?? [];
  const book = (kind: string) => (s.ledger ?? []).filter((e) => (Number(e.round) || 0) === round && e.kind === kind);
  const cas = ((s.campaign?.casualties ?? []) as Casualty[]).filter((c) => c.round === round && c.victim?.uid != null);
  const gold = (f: Find) => (f.kind === 'gold' ? (f.amount ?? 0) : 0);
  const bySource = (match: (src: string) => boolean) => sum(finds.filter((f) => match(f.source) && gold(f) > 0).map(gold));
  const wyrdstone = bySource((x) => x === 'wyrdstone'), locations = bySource((x) => x.startsWith('location:')), scenario = bySource((x) => x === 'scenario');
  const goods = sum(book('sell').filter((e) => e.amount > 0).map((e) => e.amount));
  const other = sum(book('adjust').filter((e) => e.amount > 0 && !e.source).map((e) => e.amount));
  const upkeep = neg(finds.filter((f) => f.source === 'upkeep').map(gold));
  const buys = neg(book('buy').map((e) => e.amount)), searches = neg(book('search').map((e) => e.amount)), recruits = neg(book('roster').filter((e) => e.amount < 0).map((e) => e.amount));
  const ex = rec?.explore;
  const sold = rec?.wyrd?.done ? rec.wyrd.shards : 0;
  const snap = stageSnapshots(ctx)[String(round - 1)];
  return {
    round,
    injuries: { total: cas.length, pending: cas.filter((c) => c.result === 'pending').length, dead: cas.filter((c) => c.result === 'dead').length, injured: cas.filter((c) => c.result === 'injured').length, recovered: cas.filter((c) => c.result === 'recovered').length },
    experience: {
      points: sum((s.campaign?.xp ?? []).filter((x) => x.round === round).map((x) => x.amount)),
      underdog: Number(rec?.xp?.underdog) || 0, scenario: sum((rec?.xp?.scenario ?? []).map((x) => Number(x.amount) || 0)),
    },
    exploration: ex ? { dice: ex.rolled.value.length, total: ex.total, shards: ex.shards, location: ex.location, by: ex.rolled.by } : null,
    wyrd: { found: (ex?.shards ?? 0) + sum(finds.filter((f) => f.kind === 'wyrd' && f.source !== 'explore').map((f) => f.amount ?? 0)), sold, held: Number(s.stash?.wyrd) || 0 },
    income: { wyrdstone, locations, scenario, goods, other, total: wyrdstone + locations + scenario + goods + other },
    spending: { upkeep, buys, searches, recruits, total: upkeep + buys + searches + recruits },
    finds,
    lootValue: sum(finds.filter((f) => f.kind === 'item').map((f) => (f.worth ?? 0) * (f.qty ?? 1))),
    before: snap?.totals ?? null,
    after: stageTotals(ctx),
  };
}
