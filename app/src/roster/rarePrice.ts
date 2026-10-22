/* The price of a rare item as the list shows it (wish #24): a fixed price and a dice price both carry their unit,
   a dice price also what it comes to on average. The catalogue writes prices in the Roster Builder's German-leaning
   shapes ("25+1D6 (Paar 46+2D6)", "4× Preis"); this turns them into what a player reads. Pure, so it can be tested. */

export function priceText(cost: number | string): string {
  if (typeof cost === 'number') return `${cost} gc`;
  const c = cost.trim();
  if (!c) return '—';
  if (/[a-z]{3,}/i.test(c) && !/Preis|Paar/.test(c)) return c; // priced in something else (warp tokens)
  const mult = /^(\d+)\s*[×x]\s*Preis$/i.exec(c);
  if (mult) return `${mult[1]} × price`;
  const pair = /^(.*?)\s*\(Paar\s+(.+)\)$/.exec(c);
  if (pair) return `${priceText(pair[1]!)} (pair ${priceText(pair[2]!)})`;
  return `${c.replace(/\s*\/\s*/g, ' / ')} gc`;
}

/** The lowest and highest a dice price can come to, or null for a fixed price and for one that is not dice. */
export function priceRange(cost: number | string): [number, number] | null {
  if (typeof cost === 'number') return null;
  const main = cost.replace(/\s*\(.*\)\s*$/, '');
  const m = /^(\d+)?\s*\+\s*(\d*)D(\d+)(?:\s*[×x]\s*(\d+))?$/i.exec(main.trim());
  if (!m) return null;
  const dice = Number(m[2] || 1);
  const sides = Number(m[3]);
  const base = Number(m[1] ?? 0);
  const mult = Number(m[4] ?? 1);
  return [base + dice * mult, base + dice * sides * mult];
}

/** What a dice price comes to on average (it orders the lists), or null for a fixed price and for one that is not dice. */
export function priceAverage(cost: number | string): number | null {
  const r = priceRange(cost);
  return r ? (r[0] + r[1]) / 2 : null;
}
