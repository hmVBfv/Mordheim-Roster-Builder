/* The rating over the battles of every warband of a campaign, one small line each (plan P7), and the line of one's own warband on its roster. A line
   needs two marks; with fewer there is nothing to draw and nothing is said. */
import { useState } from 'react';
import { GROUPS, METRICS, metricOf, seriesOf } from '../statistics/metrics.ts';
import { useStatistics } from '../statistics/useStatistics.ts';
import { Sparkline } from '../ui/Sparkline.tsx';
import ui from '../ui/ui.module.css';
import { ratingSeries } from './ratingSeries.ts';
import { useRatings } from './useRatings.ts';
import styles from './Campaign.module.css';

export function RatingLines({ id }: { id: string }) {
  const lines = useRatings(id).filter((w) => w.active && w.points.length >= 2);
  if (!lines.length) return null;
  return (
    <section className={styles.section} aria-labelledby="c-ratings">
      <h2 id="c-ratings">Rating over the battles</h2>
      <div className={styles.lines}>
        {lines.map((w) => <Sparkline key={w.warbandId} title={w.name} unit="rating" points={ratingSeries(w.points)} />)}
      </div>
    </section>
  );
}

/** The line of one warband of the campaign, for the rating or any other number the marks carry (plan P14). */
export function OwnRatingLine({ campaignId, warbandId }: { campaignId: string; warbandId: string }) {
  const [key, setKey] = useState('rating');
  const mine = useRatings(campaignId).find((w) => w.warbandId === warbandId);
  // the other numbers come from the statistics, read only when one is asked for
  const stats = useStatistics(key === 'rating' ? null : campaignId);
  const metric = metricOf(key);
  const own = key === 'rating'
    ? (mine && mine.points.length >= 2 ? ratingSeries(mine.points) : null)
    : seriesOf(stats.list, key).find((s) => s.warbandId === warbandId)?.points.map((p) => ({ label: p.label, value: p.value })) ?? null;
  if (!mine || mine.points.length < 2) return null;
  return (
    <div className={ui.page}>
      <label className={ui.field}>
        <span>Show over the battles</span>
        <select className={ui.input} value={key} onChange={(e) => setKey(e.target.value)}>
          {GROUPS.map((g) => <optgroup key={g} label={g}>{METRICS.filter((m) => m.group === g).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</optgroup>)}
        </select>
      </label>
      {own && own.length >= 2
        ? <Sparkline title={key === 'rating' ? 'Rating over the battles' : `${metric.label} over the battles`} unit={metric.unit || (key === 'rating' ? 'rating' : '')} points={own} />
        : <p className={ui.muted}>{stats.loaded || key === 'rating' ? 'Not enough marks carry this number yet.' : 'Loading the numbers…'}</p>}
    </div>
  );
}
