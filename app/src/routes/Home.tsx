/* The start: what waits for the player, then their warbands (docs/ui.md §1.5). */
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router';
import { db } from '../db/db.ts';
import { FLAVOUR } from '../flavour.ts';
import ui from '../ui/ui.module.css';
import { ImportSheet } from './ImportSheet.tsx';
import { WarbandList } from './WarbandList.tsx';

export function Home() {
  const recent = useLiveQuery(() => db.warbands.orderBy('updatedAt').reverse().limit(3).toArray(), []);
  const navigate = useNavigate();
  return (
    <section className={ui.page}>
      {FLAVOUR === 'campaign' && (
        <div className={ui.card}>
          <h2>Open for you</h2>
          <p className={ui.muted}>Nothing waiting. Questions, sealed notes and battles to write up will appear here once you are part of a campaign.</p>
        </div>
      )}
      <div>
        <h2>Your warbands</h2>
        {recent && recent.length > 0 ? <WarbandList warbands={recent} /> : recent && <p className={ui.muted}>None on this device yet.</p>}
      </div>
      <div className={ui.row}>
        <ImportSheet onImported={(id) => { void navigate(`/warbands/${id}`); }} />
        {recent && recent.length > 0 && <Link to="/warbands" className={ui.buttonQuiet}>All warbands</Link>}
      </div>
    </section>
  );
}
