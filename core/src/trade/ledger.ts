/* The gold ledger (V7, docs/behaviour-changes.md "V4 bis V7"). New logic,
   not a port of the Roster Builder.

   Until its first battle a warband is being founded: gold in hand is the
   treasury less what the warband owns, as in the Roster Builder, and every
   purchase can be taken back at full price. From the first battle on
   (warbandHasFought) gold in hand is the sum of the ledger's bookings; each
   says why. The treasury (`stash.gold`) is kept so that the Roster
   Builder's formula still gives the same figure – gold in hand = treasury −
   what the warband owns – so a save stays readable by the old app, and a
   change of prices (a house rule, a district) no longer moves the gold.

   Actions of the Roster Builder (recruiting, hiring, …) run unchanged; what
   they did to gold in hand is then booked by `settle`, or undone by
   `keepGold` where no gold should move (giving an item to the stash). */
import type { LedgerEntry, LedgerKind, WarbandState } from '../state/types.ts';
import { ctxOf, type Ctx } from '../rules/context.ts';
import { goldCurrent, totalSpent } from '../rules/costs.ts';
import { warbandHasFought } from '../rules/equipment.ts';
import { update, type WarbandDraft } from '../warband/update.ts';

/** Is the ledger kept for this warband? */
export function ledgerOn(s: WarbandState): boolean {
  return Array.isArray(s.ledger);
}

/** Gold in hand by the ledger: the sum of its bookings. */
export function ledgerBalance(s: WarbandState): number {
  return (s.ledger ?? []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

/** Has trading taken the place of the equipment lists (V5)? From the
    warband's first battle on: rare items only by searching, selling at half
    price, the ledger. Rob, 29.09.2026: for the whole warband at once. */
export function tradeLocked(ctx: Ctx): boolean {
  return warbandHasFought(ctx);
}

/** What a booking needs besides its amount and kind. */
export type Booking = Omit<LedgerEntry, 'id' | 'kind' | 'amount' | 'round'>;

const roundOf = (s: WarbandState | WarbandDraft) => Number(s.campaign?.round) || 0;

function nextId(d: WarbandDraft): number {
  return (d.ledger ?? []).reduce((m, e) => Math.max(m, Number(e.id) || 0), 0) + 1;
}

/** Sets the treasury so that the Roster Builder's formula gives the ledger's
    balance. `c` reads the draft. */
export function syncTreasury(d: WarbandDraft, c: Ctx): void {
  if (!Array.isArray(d.ledger)) return;
  d.stash = d.stash ?? { wyrd: 0, gold: 0, items: [] };
  d.stash.gold = ledgerBalance(d as WarbandState) + totalSpent(c);
}

/** Adds a booking to a draft (the ledger must be on) and keeps the treasury
    in step. Zero amounts are kept only for searches (a Hero looked and found
    nothing). */
export function bookOn(d: WarbandDraft, c: Ctx, kind: LedgerKind, amount: number, b: Booking): LedgerEntry | null {
  if (!Array.isArray(d.ledger)) return null;
  const amt = Math.round(Number(amount) || 0);
  if (!amt && kind !== 'search' && kind !== 'open') { syncTreasury(d, c); return null; }
  const e: LedgerEntry = { id: nextId(d), kind, amount: amt, text: b.text, round: roundOf(d) };
  for (const k of ['uid', 'item', 'qty', 'found'] as const) if (b[k] !== undefined) (e as unknown as Record<string, unknown>)[k] = b[k];
  d.ledger.push(e);
  syncTreasury(d, c);
  return e;
}

/** Starts the ledger with gold in hand as it stands. Nothing happens if it
    is already kept. */
export function openLedger(ctx: Ctx, text = 'Gold in hand when the ledger began'): WarbandState {
  if (ledgerOn(ctx.s)) return ctx.s;
  const opening = goldCurrent(ctx);
  return update(ctx, (d, c) => {
    d.ledger = [];
    bookOn(d, c, 'open', opening, { text });
  });
}

/** The ledger opened if trading has begun and it is not yet kept – what the
    screens call before the first change after the first battle. */
export function ensureLedger(ctx: Ctx): WarbandState {
  return tradeLocked(ctx) && !ledgerOn(ctx.s) ? openLedger(ctx) : ctx.s;
}

/** Books whatever an action of the Roster Builder did to gold in hand (a
    recruit's price, a hire, a correction by hand), under `text`. Without a
    ledger the state is returned as it is. */
export function settle(ctx: Ctx, next: WarbandState, b: Booking, kind: LedgerKind = 'roster'): WarbandState {
  if (!ledgerOn(next)) return next;
  const c = ctxOf(ctx.data, next);
  const delta = goldCurrent(c) - ledgerBalance(next);
  if (!delta) return next;
  return update(c, (d, dc) => { bookOn(d, dc, kind, delta, b); });
}

/** Undoes what an action did to gold in hand: the treasury follows the
    ledger again (an item into the stash, a price change, a dismissal). */
export function keepGold(ctx: Ctx, next: WarbandState): WarbandState {
  if (!ledgerOn(next)) return next;
  const c = ctxOf(ctx.data, next);
  if (goldCurrent(c) === ledgerBalance(next)) return next;
  return update(c, (d, dc) => { syncTreasury(d, dc); });
}

/** A booking of its own: income, upkeep, a ransom, a correction. */
export function bookGold(ctx: Ctx, amount: number, b: Booking, kind: LedgerKind = 'adjust'): WarbandState {
  const s = ensureLedger(ctx);
  if (!ledgerOn(s)) return ctx.s;
  return update(ctxOf(ctx.data, s), (d, c) => { bookOn(d, c, kind, amount, b); });
}
