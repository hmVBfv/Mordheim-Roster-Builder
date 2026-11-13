/* The rating over the battles of every warband of a campaign, one small line each (plan P7), and the line of one's own warband on its roster. A line
   needs two marks; with fewer there is nothing to draw and nothing is said. */
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

/** The line of one warband of the campaign. */
export function OwnRatingLine({ campaignId, warbandId }: { campaignId: string; warbandId: string }) {
  const mine = useRatings(campaignId).find((w) => w.warbandId === warbandId);
  if (!mine || mine.points.length < 2) return null;
  return <div className={ui.page}><Sparkline title="Rating over the battles" unit="rating" points={ratingSeries(mine.points)} /></div>;
}
