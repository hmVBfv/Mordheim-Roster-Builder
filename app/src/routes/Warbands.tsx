/* The warbands on this device. */
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useLocation, useNavigate } from 'react-router';
import { db, type StoredWarband } from '../db/db.ts';
import ui from '../ui/ui.module.css';
import { ImportSheet } from './ImportSheet.tsx';
import { WarbandList } from './WarbandList.tsx';
import { UndoToast } from '../ui/UndoToast.tsx';

export function Warbands() {
  const warbands = useLiveQuery(() => db.warbands.orderBy('updatedAt').reverse().toArray(), []);
  const navigate = useNavigate();
  const removed = (useLocation().state as { removed?: StoredWarband } | null)?.removed;
  return (
    <section className={ui.page}>
      <h1>Warbands</h1>
      <div className={ui.row}>
        <Link to="/warbands/new" className={ui.button}>New warband</Link>
        <ImportSheet quiet onImported={(id) => { void navigate(`/warbands/${id}`); }} />
      </div>
      {warbands && warbands.length === 0 && <p className={ui.muted}>No warband on this device yet. Start a new one, or import one from the Roster Builder.</p>}
      {warbands && warbands.length > 0 && <WarbandList warbands={warbands} />}
      {removed && (
        <UndoToast key={removed.id} text={`${removed.name} removed.`}
          onUndo={() => { void db.warbands.add(removed).then(() => navigate('/warbands', { replace: true, state: null })); }}
          onDone={() => { void navigate('/warbands', { replace: true, state: null }); }} />
      )}
    </section>
  );
}
