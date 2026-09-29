/* The post-battle sequence and selling wyrdstone (legacy app.js PB_LINK …
   pbExploreDice, WYRD_PRICE … wyrdPrice, pbSetStepDone, pbSellWyrd,
   pbClearWyrd). A guided checklist, not a dice roller: the steps unlock in
   the rulebook's order; the wyrdstone sale only reads a price from a table. */
import type { CampaignState, WarbandState } from '../state/types.ts';
import type { Ctx } from '../rules/context.ts';
import { goldTreasury, isHeroModel } from '../rules/costs.ts';
import { unitDef } from '../rules/lookup.ts';
import { campState, logEvent } from '../warband/log.ts';
import { update, type WarbandDraft } from '../warband/update.ts';

const camp = (ctx: Ctx): CampaignState => ctx.s.campaign ?? {};

/* ---- the post-battle sequence ---- */

/** Deep links to the relevant section on mordheimer.net. */
export const PB_LINK = {
  injuries: 'https://mordheimer.net/docs/campaigns#serious-injuries',
  experience: 'https://mordheimer.net/docs/tools#2-allocate-experience',
  exploration: 'https://mordheimer.net/docs/campaigns/income#exploration-chart',
  wyrdstone: 'https://mordheimer.net/docs/tools#4-sell-wyrdstone',
  veterans: 'https://mordheimer.net/docs/tools#5-check-available-veterans',
  rare: 'https://mordheimer.net/docs/tools#6-make-rarity-rolls-and-buy-rare-items',
  dramatis: 'https://mordheimer.net/docs/tools#7-look-for-dramatis-personae',
  recruits: 'https://mordheimer.net/docs/tools#8-hire-new-recruits--buy-common-items',
  equipment: 'https://mordheimer.net/docs/tools#9-reallocate-equipment',
  rating: 'https://mordheimer.net/docs/tools',
} as const;

/** The rulebook's steps in their fixed order: [key, title, link]. */
export const PB_STEPS: readonly (readonly [string, string, string])[] = [
  ['injuries', 'Injuries', PB_LINK.injuries],
  ['experience', 'Experience', PB_LINK.experience],
  ['exploration', 'Exploration', PB_LINK.exploration],
  ['wyrdstone', 'Sell wyrdstone', PB_LINK.wyrdstone],
  ['veterans', 'Available veterans', PB_LINK.veterans],
  ['rare', 'Rare items', PB_LINK.rare],
  ['dramatis', 'Dramatis Personae', PB_LINK.dramatis],
  ['recruits', 'Recruits & common items', PB_LINK.recruits],
  ['equipment', 'Reallocate equipment', PB_LINK.equipment],
  ['rating', 'Warband rating', PB_LINK.rating],
];
export const PB_ORDER: readonly string[] = PB_STEPS.map((s) => s[0]);

export interface WyrdSale { done: boolean; shards: number; gc: number; size: number }
export interface PostBattleState { done: Record<string, boolean>; wyrd: WyrdSale | null; [key: string]: unknown }

/** The round the sequence belongs to: the latest battle's, else the current stage. */
export function pbRound(ctx: Ctx): number {
  const c = camp(ctx);
  const rs = (c.battles ?? []).map((b) => Number(b.round) || 0);
  const latest = rs.length ? Math.max(...rs) : 0;
  return Math.max(latest, Number(c.round) || 0);
}

/** Progress of one round's sequence (empty if not started). */
export function postbattleState(ctx: Ctx, round?: number | null): PostBattleState {
  const r = round == null ? pbRound(ctx) : round;
  const st = (camp(ctx).postbattle as Record<string, PostBattleState> | undefined)?.[r];
  return st ? { ...st, done: st.done ?? {} } : { done: {}, wyrd: null };
}

export function pbStepDone(ctx: Ctx, step: string, round?: number | null): boolean {
  return !!postbattleState(ctx, round).done[step];
}

/** Steps completed from the top without a gap — the one after is active. */
export function pbActiveStep(ctx: Ctx, round?: number | null): number {
  const d = postbattleState(ctx, round).done;
  let i = 0;
  while (i < PB_ORDER.length && d[PB_ORDER[i] as string]) i++;
  return i;
}

/** Did we win a battle this round? Our side (key 'me'), else the old single outcome. */
export function pbWonThisRound(ctx: Ctx, round?: number | null): boolean {
  const r = round == null ? pbRound(ctx) : round;
  return (camp(ctx).battles ?? []).filter((b) => Number(b.round) === r).some((b) => {
    const sides = b.sides as { key?: string; outcome?: string }[] | undefined;
    if (Array.isArray(sides) && sides.length) { const me = sides.find((s) => s.key === 'me'); if (me) return /victor/i.test(me.outcome || ''); }
    return /victor/i.test((b.outcome as string) || '');
  });
}

/** Our warriors taken out of action this round (whatever the injury roll said). */
export function pbHeroesOOA(ctx: Ctx, round?: number | null): Set<number> {
  const r = round == null ? pbRound(ctx) : round;
  const s = new Set<number>();
  for (const x of camp(ctx).casualties ?? []) if (x.round === r && x.victim && x.victim.uid != null) s.add(x.victim.uid);
  return s;
}

/** The Heroes who may search for wyrdstone, by name. */
export function pbSearchingHeroes(ctx: Ctx, round?: number | null): string[] {
  const ooa = pbHeroesOOA(ctx, round);
  return ctx.s.models.filter((m) => isHeroModel(ctx, m) && !ooa.has(m.uid)).map((m) => (m.name || unitDef(ctx, m.uid_def)?.name) as string);
}

/** Exploration dice from the roster: one per searching Hero, one for a win,
    at most six (dice from skills and equipment come on top). */
export function pbExploreDice(ctx: Ctx, round?: number | null): { survivors: number; winDie: number; base: number; capped: number } {
  const survivors = pbSearchingHeroes(ctx, round).length;
  const winDie = pbWonThisRound(ctx, round) ? 1 : 0;
  const base = survivors + winDie;
  return { survivors, winDie, base, capped: Math.min(6, base) };
}

/* ---- wyrdstone (mordheimer, Income) ----
   The TOTAL gold for selling that many shards at once (1..8, the last row
   covering 8 or more), by warband size band. */
export const WYRD_PRICE: readonly (readonly number[])[] = [
  [45, 40, 35, 30, 30, 25],
  [60, 55, 50, 45, 40, 35],
  [75, 70, 65, 60, 55, 50],
  [90, 80, 70, 65, 60, 55],
  [110, 100, 90, 80, 70, 65],
  [120, 110, 100, 90, 80, 70],
  [145, 130, 120, 110, 100, 90],
  [155, 140, 130, 120, 110, 100],
];
export const WYRD_BANDS: readonly (readonly [number, string])[] = [[3, '1–3'], [6, '4–6'], [9, '7–9'], [12, '10–12'], [15, '13–15'], [99, '16+']];

export function wyrdSizeBand(n: unknown): number {
  const v = Number(n) || 0;
  for (let i = 0; i < WYRD_BANDS.length; i++) if (v <= (WYRD_BANDS[i] as readonly [number, string])[0]) return i;
  return WYRD_BANDS.length - 1;
}

/** Models the warband fields, Hired Swords included: mouths to feed. */
export function warbandSize(ctx: Ctx): number {
  let n = ctx.s.models.reduce((s, m) => { const d = unitDef(ctx, m.uid_def); return s + ((d && d.t === 'hen') ? (Number(m.qty) || 1) : 1); }, 0);
  n += (ctx.s.hired ?? []).length + (ctx.s.dp ?? []).length;
  return n;
}

export function wyrdPrice(ctx: Ctx, shards: unknown, size?: number | null): number {
  const n = Math.max(1, Math.min(8, Number(shards) || 1));
  const band = wyrdSizeBand(size == null ? warbandSize(ctx) : size);
  return (WYRD_PRICE[n - 1] as readonly number[])[band] as number;
}

/* ---- the post-battle sequence ---- */

function postbattleOn(d: WarbandDraft, c: Ctx, round?: number | null): PostBattleState {
  const camp = campState(d) as CampaignState & { postbattle?: Record<string, PostBattleState> };
  if (!camp.postbattle) camp.postbattle = {};
  const r = round == null ? pbRound(c) : round;
  if (!camp.postbattle[r]) camp.postbattle[r] = { done: {}, wyrd: null };
  const s = camp.postbattle[r] as PostBattleState;
  if (!s.done) s.done = {};
  return s;
}

/** Ticks a step off (only when every step before it is done) or back (only
    when nothing after it is done), so the order holds both ways. */
export function setPostBattleStep(ctx: Ctx, step: string, on: boolean, round?: number | null): WarbandState {
  const idx = PB_ORDER.indexOf(step);
  if (idx < 0) return ctx.s;
  const r = round == null ? pbRound(ctx) : round;
  const done = ((ctx.s.campaign as { postbattle?: Record<string, PostBattleState> } | undefined)?.postbattle?.[r]?.done) ?? {};
  if (on) { for (let k = 0; k < idx; k++) if (!done[PB_ORDER[k] as string]) return ctx.s; }
  else { for (let k = idx + 1; k < PB_ORDER.length; k++) if (done[PB_ORDER[k] as string]) return ctx.s; }
  return update(ctx, (d, c) => {
    const st = postbattleOn(d, c, r);
    if (on) st.done[step] = true;
    else delete st.done[step];
  });
}

/** Sells wyrdstone once per sequence: the gold goes to the treasury, the
    shards leave the stash, and the sale is recorded so it can be undone. */
export function sellWyrdstone(ctx: Ctx, round: number | null | undefined, shards: unknown): WarbandState {
  const r = round == null ? pbRound(ctx) : round;
  const sold = (ctx.s.campaign as { postbattle?: Record<string, PostBattleState> } | undefined)?.postbattle?.[r]?.wyrd;
  if (sold && sold.done) return ctx.s;
  const have = Number((ctx.s.stash || {}).wyrd) || 0;
  const n = Math.max(1, Math.min(have, Number(shards) || 0));
  if (have < 1 || n < 1) return ctx.s;
  return update(ctx, (d, c) => {
    const st = postbattleOn(d, c, r);
    const size = warbandSize(c);
    const gc = wyrdPrice(c, n, size);
    d.stash = d.stash || { wyrd: 0, gold: null, items: [] };
    d.stash.gold = goldTreasury(c) + gc;
    d.stash.wyrd = have - n;
    st.wyrd = { done: true, shards: n, gc, size };
    logEvent(d, 'income', `Sold ${n} wyrdstone shard${n === 1 ? '' : 's'} for ${gc} gc.`, { round });
  });
}

/** Takes a sale back: the gold leaves the treasury, the shards return. */
export function undoWyrdstoneSale(ctx: Ctx, round?: number | null): WarbandState {
  const r = round == null ? pbRound(ctx) : round;
  const w = (ctx.s.campaign as { postbattle?: Record<string, PostBattleState> } | undefined)?.postbattle?.[r]?.wyrd;
  if (!w || !w.done) return ctx.s;
  return update(ctx, (d, c) => {
    const st = postbattleOn(d, c, r);
    d.stash = d.stash || { wyrd: 0, gold: null, items: [] };
    d.stash.gold = Math.max(0, goldTreasury(c) - (Number(w.gc) || 0));
    d.stash.wyrd = (Number(d.stash.wyrd) || 0) + (Number(w.shards) || 0);
    st.wyrd = null;
  });
}
