/* "Report a problem", always one tap away: a button in the header of every
   screen (docs/ui.md) and the sheet it opens. The snapshot of where the
   reporter is, the trail and the settings is taken when the button is
   pressed – a sheet that was open stays closed behind it, the trail
   remembers it. The form itself is loaded when first needed. */
import { lazy, Suspense, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { useSession } from '../account/session.ts';
import { ReportIcon } from '../ui/icons.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import styles from './Bugs.module.css';
import { takeSnapshot, type Snapshot } from './snapshot.ts';

const ReportForm = lazy(() => import('./ReportForm.tsx').then((m) => ({ default: m.ReportForm })));

export function ReportProblem() {
  // the report sheet itself leaves no trace in the trail
  const { ref, open, close } = useSheet(false);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const { pathname } = useLocation();
  const session = useSession();
  const who = session.status === 'in' ? session.user.id : '-';
  // a report that went out is done with: the next one starts with an empty form and an id of its own
  const [round, setRound] = useState(0);
  const sent = useRef(false);
  const start = () => {
    if (sent.current) { sent.current = false; setRound((r) => r + 1); }
    void takeSnapshot(pathname).then((s) => { setSnap(s); open(); });
  };
  return (
    <>
      <button type="button" className={styles.reportButton} onClick={start} aria-label="Report a problem" title="Report a problem"><ReportIcon /></button>
      <dialog ref={ref} className={ui.sheet} aria-labelledby="report-title">
        {/* another account on this device starts with a clean form: a draft never goes out in somebody else's name */}
        {snap && <Suspense fallback={null}><ReportForm key={`${who}:${round}`} snap={snap} close={() => close()} onSent={() => { sent.current = true; }} /></Suspense>}
      </dialog>
    </>
  );
}
