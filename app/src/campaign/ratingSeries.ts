/* The rating of a warband over its marks: the start, then after each battle (a round it sat out keeps the number it had). Pure, for the chart. */
import type { SparkPoint } from '../ui/Sparkline.tsx';

interface Mark { kind: string; round: number; rating: number; at: string }

export function ratingSeries(marks: Mark[]): SparkPoint[] {
  const order = [...marks].sort((a, b) => a.round - b.round || a.at.localeCompare(b.at));
  return order.map((t) => ({
    label: t.kind === 'start' ? (t.round === 0 ? 'Start' : `Start, round ${t.round}`) : t.kind === 'sat_out' ? `Round ${t.round}, sat out` : `After battle ${t.round}`,
    value: t.rating,
  }));
}
