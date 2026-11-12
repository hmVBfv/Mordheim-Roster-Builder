/* The rating of a warband over its marks: the start, then after each battle (a round it sat out keeps the number it had). Pure, for the chart. */
import type { SparkPoint } from '../ui/Sparkline.tsx';
import type { Tag } from './api.ts';

export function ratingSeries(tags: Tag[]): SparkPoint[] {
  const order = [...tags].sort((a, b) => a.round - b.round || a.createdAt.localeCompare(b.createdAt));
  return order.map((t) => ({
    label: t.kind === 'start' ? (t.round === 0 ? 'Start' : `Start, round ${t.round}`) : t.kind === 'sat_out' ? `Round ${t.round}, sat out` : `After battle ${t.round}`,
    value: t.totals.rating,
  }));
}
