/* An item of an equipment list whose price has dice in it (Rob, 13.11.2026: "15 + D6 gc", "25 + 3D6 gc"). Its row carries `dice: 'D6' | '2D6' | '3D6'` and the
   base price; the player enters what each piece cost – always the total, only within the range the dice allow – or has it rolled. Until a price is
   entered a piece counts at its base price, as the old app counts it (parity), and the sheet says that the dice are still to roll. Pure: a roll is
   the interface's, the rules take the number. */
import type { EntryFlags } from '../data/types.ts';
import type { Model } from '../state/types.ts';

export interface DicePrice { dice: number; min: number; max: number }

/** "D6" → one die, "3D6" → three; anything else is no dice price. */
export function diceCount(spec: string | undefined): number {
  const m = /^(\d*)D6$/i.exec(spec ?? '');
  return m ? Number(m[1] || 1) : 0;
}

/** The range of the total price of a piece: the base and what the dice add (n to 6n). */
export function dicePrice(price: number, flags: EntryFlags | undefined): DicePrice | null {
  const n = diceCount(flags?.dice);
  return n ? { dice: n, min: price + n, max: price + 6 * n } : null;
}

/** What each of `qty` pieces of a list item cost: the total entered for it, else the base price. */
export function pieceTotals(m: Model, nm: string, price: number, qty: number): { paid: number | null; total: number }[] {
  const entered = m.eqPaid?.[nm] ?? [];
  return Array.from({ length: qty }, (_, i) => { const p = entered[i]; return { paid: typeof p === 'number' ? p : null, total: typeof p === 'number' ? p : price }; });
}

/** The total of all pieces of a list item. */
export const diceItemCost = (m: Model, nm: string, price: number, qty: number): number => pieceTotals(m, nm, price, qty).reduce((a, p) => a + p.total, 0);

/** A total clamped into the range the dice allow, whole gold crowns. */
export const clampPaid = (d: DicePrice, gc: unknown): number => Math.min(d.max, Math.max(d.min, Math.round(Number(gc) || d.min)));
