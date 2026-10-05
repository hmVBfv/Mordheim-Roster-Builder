/* The warbands: in the campaign app with an account those of the account
   (synced, phase 3h) and those made on this device while nobody was signed
   in, which can join the account. */
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useSession } from '../account/session.ts';
import type { StoredWarband } from '../db/db.ts';
import { keepInAccount, restoreWarband, useWarbands } from '../sync/local.ts';
import ui from '../ui/ui.module.css';
import { useNotice } from '../ui/Notice.tsx';
import { UndoToast } from '../ui/UndoToast.tsx';
import { ImportSheet } from './ImportSheet.tsx';
import { CodeSheet } from '../share/CodeSheet.tsx';
import { WarbandList } from './WarbandList.tsx';

export function Warbands() {
  const warbands = useWarbands();
  const session = useSession();
  const navigate = useNavigate();
  const [notice, notify] = useNotice();
  const [busy, setBusy] = useState(false);
  const removed = (useLocation().state as { removed?: StoredWarband } | null)?.removed;
  const signedIn = session.status === 'in';
  const deviceOnly = signedIn ? (warbands ?? []).filter((w) => !w.ownerId) : [];
  return (
    <section className={ui.page}>
      <h1>Warbands</h1>
      <div className={ui.row}>
        <Link to="/warbands/new" className={ui.button}>New warband</Link>
        <ImportSheet quiet onImported={(id) => { void navigate(`/warbands/${id}`); }} />
        {signedIn && <CodeSheet />}
      </div>
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
      {warbands && warbands.length === 0 && <p className={ui.muted}>No warband yet. Start a new one, or import one from the Roster Builder.</p>}
      {warbands && warbands.length > 0 && <WarbandList warbands={warbands} marks={signedIn} />}
      {removed && (
        <UndoToast key={removed.id} text={`${removed.name} removed.`}
          onUndo={() => { void restoreWarband(removed).then(() => navigate('/warbands', { replace: true, state: null })); }}
          onDone={() => { void navigate('/warbands', { replace: true, state: null }); }} />
      )}
      {notice}
    </section>
  );
}
