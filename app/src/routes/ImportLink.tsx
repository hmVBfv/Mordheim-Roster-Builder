/* What "Send to campaign server" brings (concept.md 4.11): the Quick Build
   opens /import#<the save>; the save stays in the fragment and leaves the
   address bar at once. The player sees what it is and chooses: a new
   warband, or the next version of one of theirs. */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { errorText } from '../account/api.ts';
import { useSession } from '../account/session.ts';
import { db } from '../db/db.ts';
import { useGameData } from '../game/useGameData.ts';
import { decodeSave } from '../share/link.ts';
import { newOwnership, useWarbands } from '../sync/local.ts';
import { requestSync } from '../sync/runner.ts';
import { importAsVersion } from '../sync/versions.ts';
import ui from '../ui/ui.module.css';
import styles from '../account/Account.module.css';

let taken = '';
/** The fragment leaves the address bar at once (and the history with it). */
function takeFragment(): string {
  if (location.hash.length > 1) {
    taken = location.hash.slice(1);
    history.replaceState(history.state, '', location.pathname + location.search);
  }
  return taken;
}

function Preview({ state }: { state: WarbandState }) {
  const data = useGameData();
  const session = useSession();
  const navigate = useNavigate();
  const mine = useWarbands();
  const signedIn = session.status === 'in';
  const same = useMemo(() => (mine ?? []).filter((w) => w.wb === state.wb && (signedIn ? w.ownerId : true)), [mine, state.wb, signedIn]);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wb = data.WARBANDS[state.wb as string];
  const ctx = core.ctxOf(data, state);
  const warriors = state.models.reduce((n, m) => n + (Number(m.qty) || 1), 0);

  const addNew = async () => {
    setBusy(true);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await db.warbands.add({ id, name: state.name || wb?.name || 'Warband', wb: state.wb as string, wbName: wb?.name ?? String(state.wb), state, format: core.FORMAT, createdAt: now, updatedAt: now, ...newOwnership('import') });
    requestSync();
    taken = '';
    void navigate(`/warbands/${id}`, { replace: true });
  };
  const asVersion = async () => {
    const rec = same.find((w) => w.id === target);
    if (!rec) return;
    setBusy(true);
    setError(null);
    try {
      const r = await importAsVersion(data, rec, state);
      if (!r.ok) { setError(`Version ${r.headRev} of that warband was saved on another device meanwhile. Add this one as a new warband instead, or open that warband first.`); return; }
      taken = '';
      void navigate(`/warbands/${rec.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error && !('status' in e) ? e.message : errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={ui.card}>
        <h2>{state.name || wb?.name}</h2>
        <p className={ui.muted}>{wb?.name ?? String(state.wb)} · {warriors} warrior{warriors === 1 ? '' : 's'} · rating {core.totalRating(ctx)}</p>
      </div>
      {!signedIn && <p className={ui.muted}>Not signed in: it is kept on this device. Signed in, it goes into your account and to your other devices.</p>}
      <div className={ui.row}>
        <button type="button" className={ui.button} disabled={busy} onClick={() => void addNew()}>Add as a new warband</button>
      </div>
      {same.length > 0 && (
        <form className={`${ui.card} ${styles.form}`} onSubmit={(e) => { e.preventDefault(); void asVersion(); }}>
          <label className={ui.field}>
            <span>…or as the next version of</span>
            <select className={ui.select} value={target} onChange={(e) => setTarget(e.target.value)} required>
              <option value="" disabled>Choose a warband…</option>
              {same.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <div className={ui.row}><button type="submit" className={ui.buttonQuiet} disabled={busy || !target}>Make it the next version</button></div>
          <p className={ui.muted}>The warband’s earlier versions stay.</p>
        </form>
      )}
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
    </>
  );
}

function Reader({ fragment }: { fragment: string }) {
  const data = useGameData();
  const [state, setState] = useState<WarbandState | null | 'reading'>('reading');
  useEffect(() => {
    let live = true;
    void decodeSave(fragment).then((raw) => {
      if (!live) return;
      const r = raw ? core.loadSave(data, raw) : null;
      setState(r && r.ok ? r.state : null);
    });
    return () => { live = false; };
  }, [data, fragment]);
  if (state === 'reading') return <p className={ui.muted}>Reading the warband…</p>;
  if (!state) return <p className={`${ui.message} ${ui.error}`} role="alert">This link holds no warband this app can read. Send it again from the Quick Build, or use Import with the file or the text.</p>;
  return <Preview state={state} />;
}

export function ImportLink() {
  const [fragment] = useState(takeFragment);
  return (
    <section className={ui.page}>
      <div>
        <h1>From the Quick Build</h1>
      </div>
      {fragment ? (
        <Suspense fallback={<p className={ui.muted}>Loading the rules…</p>}>
          <Reader fragment={fragment} />
        </Suspense>
      ) : (
        <>
          <p className={ui.muted}>This page takes a warband sent from the Quick Build (“Send to campaign server” on its Export screen).</p>
          <div className={ui.row}><Link className={ui.buttonQuiet} to="/warbands">Your warbands</Link></div>
        </>
      )}
    </section>
  );
}
