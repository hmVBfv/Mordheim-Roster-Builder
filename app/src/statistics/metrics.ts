/* What the statistics can plot (plan P14): each number a mark carries, with its words and its unit, in groups; and the series of one number over
   the marks of every warband. Pure, for the chart. */
import type { StatMetrics, WarbandStatistics } from '../campaign/api.ts';

export interface MetricDef { key: string; label: string; group: string; unit: string; /** What it counts, in a sentence (the chart's description). */ about: string }

export const METRICS: MetricDef[] = [
  { key: 'rating', label: 'Warband rating', group: 'Strength', unit: '', about: 'The rating of the warband at each mark.' },
  { key: 'battles', label: 'Battles fought', group: 'Strength', unit: '', about: 'The battles the warband took part in so far; a round sat out does not count.' },
  { key: 'value', label: 'Warband value', group: 'Strength', unit: 'gc', about: 'The worth of men, gear and advances at list prices.' },
  { key: 'models', label: 'Models', group: 'Strength', unit: '', about: 'The men on the roster.' },
  { key: 'heroes', label: 'Heroes', group: 'Strength', unit: '', about: 'The Heroes on the roster.' },
  { key: 'wealth', label: 'Total gold value incl. stash', group: 'Wealth', unit: 'gc', about: 'Everything owned in gold: the treasury (gold in hand and gear) plus the stash.' },
  { key: 'gold', label: 'Gold in hand', group: 'Wealth', unit: 'gc', about: 'The treasury less what the warband owns.' },
  { key: 'spent', label: 'Gear and men owned', group: 'Wealth', unit: 'gc', about: 'What the warband owns, at its cost.' },
  { key: 'stash', label: 'Stash value', group: 'Wealth', unit: 'gc', about: 'The items in the stash at the price paid.' },
  { key: 'stashItems', label: 'Items in the stash', group: 'Wealth', unit: '', about: 'The pieces in the stash.' },
  { key: 'rareCarried', label: 'Rare items carried', group: 'Wealth', unit: '', about: 'Rare items held by warriors.' },
  { key: 'rareStash', label: 'Rare items in the stash', group: 'Wealth', unit: '', about: 'Rare items in the stash.' },
  { key: 'exp', label: 'Experience, whole warband', group: 'Experience', unit: '', about: 'The experience of all warriors, the fallen included.' },
  { key: 'heroExp', label: 'Experience, Heroes', group: 'Experience', unit: '', about: 'The experience of the Heroes alone.' },
  { key: 'fallen', label: 'Fallen', group: 'Losses', unit: '', about: 'Warriors who have fallen.' },
  { key: 'lostTotal', label: 'Total gold lost', group: 'Losses', unit: 'gc', about: 'All gold lost: the fallen\'s gear, gear stripped without a death, ransoms and losses at places.' },
  { key: 'lost', label: 'Loss value: the fallen', group: 'Losses', unit: 'gc', about: 'What the fallen took with them, in gold.' },
  { key: 'lostGear', label: 'Loss: gear stripped', group: 'Losses', unit: 'gc', about: 'Gear lost without a death: Robbed, a lost pit fight.' },
  { key: 'lostRansom', label: 'Loss: ransoms paid', group: 'Losses', unit: 'gc', about: 'Gold paid to get a captured Hero back.' },
  { key: 'lostLocations', label: 'Loss: places and scenarios', group: 'Losses', unit: 'gc', about: 'Gold lost to places of the Exploration chart and to scenarios.' },
  { key: 'wyrd', label: 'Wyrdstone in the stash', group: 'Wyrdstone', unit: '', about: 'Shards held at the mark.' },
  { key: 'wyrdFound', label: 'Wyrdstone found', group: 'Wyrdstone', unit: '', about: 'Shards found so far: held plus sold.' },
  { key: 'income', label: 'Income, total', group: 'Income', unit: 'gc', about: 'Gold made from the game so far, all sources.' },
  { key: 'incomeWyrd', label: 'Income: wyrdstone sold', group: 'Income', unit: 'gc', about: 'Gold from selling wyrdstone.' },
  { key: 'incomeLocations', label: 'Income: places found', group: 'Income', unit: 'gc', about: 'Gold from the places of the Exploration chart.' },
  { key: 'incomeScenario', label: 'Income: scenarios', group: 'Income', unit: 'gc', about: 'Gold from scenarios.' },
  { key: 'incomePit', label: 'Income: pit fights', group: 'Income', unit: 'gc', about: 'Gold from pit fights won (Sold to the Pits).' },
  { key: 'incomeGoods', label: 'Income: goods sold', group: 'Income', unit: 'gc', about: 'Gold from selling goods.' },
  { key: 'incomeOther', label: 'Income: other', group: 'Income', unit: 'gc', about: 'Other bookings in the warband’s favour without an origin.' },
  { key: 'lootValue', label: 'Value of found items', group: 'Income', unit: 'gc', about: 'The list price of the items the aftermath steps found.' },
  { key: 'upkeepPaid', label: 'Upkeep paid', group: 'Spending', unit: 'gc', about: 'Upkeep paid to Hired Swords and Dramatis Personae.' },
  { key: 'spentBuy', label: 'Spent on buying', group: 'Spending', unit: 'gc', about: 'Gold spent on items.' },
  { key: 'spentSearch', label: 'Spent on searching', group: 'Spending', unit: 'gc', about: 'Gold spent on looking for rare items.' },
];

export const GROUPS = [...new Set(METRICS.map((m) => m.group))];
export const metricOf = (key: string): MetricDef => METRICS.find((m) => m.key === key) ?? METRICS[0]!;

export interface Point { round: number; label: string; value: number }
export interface Series { warbandId: string; name: string; active: boolean; points: Point[] }

/** The name a mark has on the axis. */
export function markLabel(kind: string, round: number): string {
  return kind === 'start' ? (round === 0 ? 'Start' : `Start, round ${round}`) : kind === 'sat_out' ? `Round ${round}, sat out` : `After battle ${round}`;
}

/** The series of one number over the marks of each warband, in the order of the rounds; a mark that does not carry the number is left out. */
export function seriesOf(stats: WarbandStatistics[], key: string): Series[] {
  return stats.map((w) => ({
    warbandId: w.warbandId, name: w.name, active: w.active,
    points: [...w.points].sort((a, b) => a.round - b.round || a.at.localeCompare(b.at))
      .filter((p) => typeof (p.metrics as StatMetrics)[key] === 'number')
      .map((p) => ({ round: p.round, label: markLabel(p.kind, p.round), value: (p.metrics as StatMetrics)[key] as number })),
  })).filter((s) => s.points.length > 0);
}

/** A number as the chart writes it: whole numbers with thousands kept simple, the unit after. */
export function fmt(v: number, unit: string): string {
  const n = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return unit ? `${n} ${unit}` : n;
}

/** Round figures for an axis: from 0 (or the lowest, if the numbers go below) to a top that is a clean step above the highest. */
export function niceScale(values: number[]): { min: number; max: number; ticks: number[] } {
  const lo = Math.min(0, ...values), hi = Math.max(1, ...values);
  const span = hi - lo;
  const raw = span / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) ?? 10 * mag;
  const min = Math.floor(lo / step) * step, max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { min, max, ticks };
}

/** The latest value of a number for each warband, for the comparison of two (a warband without the number is left out). */
export function latestOf(stats: WarbandStatistics[], key: string): Map<string, number> {
  return new Map(seriesOf(stats, key).map((s) => [s.warbandId, s.points.at(-1)!.value]));
}

/** One cell of a CSV file: quoted when it holds a separator, a quote or a line break; a leading =, +, - or @ is kept from being read as a formula. */
const cell = (v: string | number): string => {
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Every number of every mark as CSV: one row for each warband and mark, one column for each number. */
export function toCsv(stats: WarbandStatistics[]): string {
  const keys = METRICS.map((m) => m.key);
  const rows: (string | number)[][] = [['warband', 'round', 'mark', ...keys]];
  for (const w of stats) {
    for (const p of [...w.points].sort((a, b) => a.round - b.round || a.at.localeCompare(b.at))) {
      const m = p.metrics as Record<string, unknown>;
      rows.push([w.name, p.round, markLabel(p.kind, p.round), ...keys.map((k) => (typeof m[k] === 'number' ? (m[k] as number) : ''))]);
    }
  }
  return rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';
}

/** Adds `battles` to every mark: the battles the warband fought up to it, counted from its own marks (one 'after battle' mark each; a round sat out or a start is none). */
export function withBattles(stats: WarbandStatistics[]): WarbandStatistics[] {
  return stats.map((w) => {
    const order = [...w.points].sort((a, b) => a.round - b.round || a.at.localeCompare(b.at));
    let n = 0;
    const count = new Map(order.map((p) => [p, (n += p.kind === 'after_battle' ? 1 : 0)]));
    // a mark frozen before the losses were told apart has only the fallen's: its total is that, so the line does not start in the middle
    return { ...w, points: w.points.map((p) => ({ ...p, metrics: { ...p.metrics, battles: count.get(p)!, ...(p.metrics.lostTotal === undefined && typeof p.metrics.lost === 'number' ? { lostTotal: p.metrics.lost } : {}) } })) };
  });
}
