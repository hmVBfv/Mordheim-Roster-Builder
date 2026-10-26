/* The warbands: in the campaign app with an account those of the account
   (synced, phase 3h) and those made on this device while nobody was signed
   in, which can join the account. */
import { lazy, Suspense, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useSession } from '../account/session.ts';
import type { StoredWarband } from '../db/db.ts';
import { keepInAccount, restoreWarband, useWarbands } from '../sync/local.ts';
import { Empty } from '../art/Pixels.tsx';
import ui from '../ui/ui.module.css';
import { useNotice } from '../ui/Notice.tsx';
import { Group } from '../ui/Group.tsx';
import { UndoToast } from '../ui/UndoToast.tsx';
import { ImportSheet } from './ImportSheet.tsx';
import { CodeSheet } from '../share/CodeSheet.tsx';
import { Incoming } from '../share/Incoming.tsx';
import { WarbandList } from './WarbandList.tsx';

const GroupedWarbands = lazy(() => import('./GroupedWarbands.tsx'));

export function Warbands() {
  const warbands = useWarbands();
  const session = useSession();
  const navigate = useNavigate();
  const [notice, notify] = useNotice();
  const [busy, setBusy] = useState(false);
  const removed = (useLocation().state as { removed?: StoredWarband } | null)?.removed;
  const signedIn = session.status === 'in';
  const deviceOnly = signedIn ? (warbands ?? []).filter((w) => !w.ownerId) : [];
  // planners (#77) are a kind of their own: a section under the warbands
  const planners = (warbands ?? []).filter((w) => w.state.planner);
  const played = (warbands ?? []).filter((w) => !w.state.planner);
  return (
    <section className={ui.page}>
      <h1>Warbands</h1>
      <div className={ui.row}>
        <Link to="/warbands/new" className={ui.button}>New warband</Link>
        <ImportSheet quiet onImported={(id) => { void navigate(`/warbands/${id}`); }} />
        {signedIn && <CodeSheet />}
      </div>
      {signedIn && <Incoming nothing={false} />}
      {deviceOnly.length > 0 && (
        <div className={ui.card}>
          <p>{deviceOnly.length === 1 ? 'One warband is' : `${deviceOnly.length} warbands are`} only on this device. In your account {deviceOnly.length === 1 ? 'it is' : 'they are'} on your other devices too, and kept on the server.</p>
          <div className={ui.row}>
            <button type="button" className={ui.button} disabled={busy}
              onClick={() => { setBusy(true); void keepInAccount(deviceOnly.map((w) => w.id)).then((n) => notify(`${n === 1 ? 'One warband' : `${n} warbands`} added to your account.`)).finally(() => setBusy(false)); }}>
              Keep {deviceOnly.length === 1 ? 'it' : 'them'} in my account
            </button>
          </div>
        </div>
      )}
      {warbands && warbands.length === 0 && <Empty scene="fire" title="No warband yet.">Start a new one, or import one from the Roster Builder.</Empty>}
      {played.length > 0 && !signedIn && <WarbandList warbands={played} grid />}
      {played.length > 0 && signedIn && (
        <Suspense fallback={<WarbandList warbands={played} marks grid />}>
          <GroupedWarbands warbands={played} notify={notify} />
        </Suspense>
      )}
      {planners.length > 0 && (
        <Group id="planners-h" title="Planners">
          <p className={ui.muted}>To plan a strong late-game warband: no gold limit, advances without experience. They do not take part in a campaign.</p>
          <WarbandList warbands={planners} marks={signedIn} grid />
        </Group>
      )}
      {removed && (
        <UndoToast key={removed.id} text={`${removed.name} removed.`}
          onUndo={() => { void restoreWarband(removed).then(() => navigate('/warbands', { replace: true, state: null })); }}
          onDone={() => { void navigate('/warbands', { replace: true, state: null }); }} />
      )}
      {notice}
    </section>
  );
}
