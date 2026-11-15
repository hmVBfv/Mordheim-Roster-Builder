/* Statistics (plan P14): the numbers a chart plots for one warband at one
   moment. Pure and computed from the state alone, so a tag can freeze them
   (ADR 0003) and older tags can be filled in from their stored version. */
import type { WarbandState } from '../state/types.ts';
import type { PostBattleState } from './postbattle.ts';
import type { Ctx } from '../rules/context.ts';
import { goldCurrent, goldTreasury, isHeroModel } from '../rules/costs.ts';
import { warbandWorth } from '../rules/worth.ts';

export interface StageMetrics {
  /** Warband Worth (market value of men, gear, advances). */
  value: number;
  /** Gold in hand. */
  gold: number;
  /** What the stash holds: items at the price paid, as gold. */
  stash: number;
  /** Everything owned in gold: treasury (gold in hand plus gear) plus the stash. */
  wealth: number;
  /** Experience of the whole warband, and of its heroes alone. */
  exp: number;
  heroExp: number;
  /** Gold the dead took with them (the treasury entries made for them). */
  lost: number;
  /** Wyrdstone shards in the stash, and all ever found (stash plus sold). */
  wyrd: number;
  wyrdFound: number;
  /** Gold made, in total and by source: wyrdstone sold, goods sold, and other
      bookings in the warband's favour (adjustments: rewards, booty). */
  income: number;
  incomeWyrd: number;
  /** Gold from the places of the Exploration chart and from scenarios (the post-battle record, ADR 0032). */
  incomeLocations: number;
  incomeScenario: number;
  incomeGoods: number;
  incomeOther: number;
  /** Upkeep paid to Hired Swords and Dramatis Personae, and the list worth of what the steps found (items). */
  upkeepPaid: number;
  lootValue: number;
  /** Gold paid out of the ledger, by kind. */
  spentBuy: number;
  spentSearch: number;
  /** Items: pieces in the stash, and rare items – carried by warriors, and in the stash. */
  stashItems: number;
  rareCarried: number;
  rareStash: number;
}

const num = (x: unknown): number => Number(x) || 0;

/** The metrics of a warband as it stands now. */
export function stageMetrics(ctx: Ctx): StageMetrics {
  const s: WarbandState = ctx.s;
  let exp = 0, heroExp = 0;
  for (const m of s.models) {
    const e = num(m.exp);
    exp += e;
    if (isHeroModel(ctx, m)) heroExp += e;
  }
  for (const h of s.fallen ?? []) exp += num(h.m?.exp ?? h.exp);
  const stash = (s.stash?.items ?? []).reduce((t, it) => t + num(it.paid) * (num(it.qty) || 1), 0);
  const rounds = Object.values(((s.campaign as { postbattle?: Record<string, PostBattleState> } | undefined)?.postbattle) ?? {});
  const sold = rounds.map((p) => p?.wyrd).filter((w) => w && w.done);
  // what the rounds recorded with its origin (ADR 0032); a round without a record (an older one) is read from the sale alone
  const finds = rounds.flatMap((p) => p?.finds ?? []);
  const gold = (f: { kind: string; amount?: number }) => (f.kind === 'gold' ? num(f.amount) : 0);
  const from = (match: (src: string) => boolean) => finds.filter((f) => match(f.source) && gold(f) > 0).reduce((n, f) => n + gold(f), 0);
  const recordedSales = from((x) => x === 'wyrdstone');
  const unrecordedSales = rounds.filter((p) => p?.wyrd?.done && !(p.finds ?? []).some((f) => f.source === 'wyrdstone')).reduce((n, p) => n + num(p!.wyrd!.gc), 0);
  const wyrd = num(s.stash?.wyrd);
  const book = (kind: string, sign: 1 | -1) => (s.ledger ?? []).filter((e) => e.kind === kind && sign * num(e.amount) > 0)
    .reduce((t, e) => t + sign * num(e.amount), 0);
  const incomeWyrd = recordedSales + unrecordedSales, incomeGoods = book('sell', 1);
  const incomeLocations = from((x) => x.startsWith('location:')), incomeScenario = from((x) => x === 'scenario');
  // bookings in the warband's favour that name no origin (adjustments by hand: rewards, booty); those with an origin are counted above
  const incomeOther = (s.ledger ?? []).filter((e) => e.kind === 'adjust' && num(e.amount) > 0 && !e.source).reduce((n, e) => n + num(e.amount), 0);
  const upkeepPaid = 0 - finds.filter((f) => f.source === 'upkeep').reduce((n, f) => n + gold(f), 0);
  const lootValue = finds.filter((f) => f.kind === 'item').reduce((n, f) => n + num(f.worth) * (num(f.qty) || 1), 0);
  return {
    value: warbandWorth(ctx),
    gold: goldCurrent(ctx),
    stash,
    wealth: goldTreasury(ctx) + stash,
    exp, heroExp,
    lost: (s.fallen ?? []).reduce((t, f) => t + num(f.lostValue), 0),
    wyrd,
    wyrdFound: wyrd + sold.reduce((t, w) => t + num(w?.shards), 0),
    income: incomeWyrd + incomeLocations + incomeScenario + incomeGoods + incomeOther, incomeWyrd, incomeLocations, incomeScenario, incomeGoods, incomeOther, upkeepPaid, lootValue,
    spentBuy: book('buy', -1), spentSearch: book('search', -1),
    stashItems: (s.stash?.items ?? []).reduce((t, it) => t + (num(it.qty) || 1), 0),
    rareCarried: s.models.reduce((t, m) => t + Object.keys(m.rare ?? {}).length, 0),
    rareStash: (s.stash?.items ?? []).filter((it) => it.rare).reduce((t, it) => t + (num(it.qty) || 1), 0),
  };
}
