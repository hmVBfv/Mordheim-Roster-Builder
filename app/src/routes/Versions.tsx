/* The versions of a warband (phase 3h; docs/ui.md "Warband: Roster ·
   Story · Versions"): save one on purpose, with a note; see them all; make
   an older one the newest again, or the start of a copy. Campaign app, a
   warband of the signed-in account. */
import { useLiveQuery } from 'dexie-react-hooks';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { errorText } from '../account/api.ts';
import { useSession } from '../account/session.ts';
import { stamp } from '../account/time.ts';
import { useOnline } from '../app/SyncState.tsx';
import { db, type StoredWarband } from '../db/db.ts';
import { useGameData } from '../game/useGameData.ts';
import trade from '../roster/Trade.module.css';
import styles from '../account/Account.module.css';
import { syncNow } from '../sync/runner.ts';
import { isWaiting } from '../sync/pending.ts';
import { listVersions, loadNewest, makeCopy, restoreVersion, saveVersion, versionState, type VersionInfo } from '../sync/versions.ts';
import { useNotice } from '../ui/Notice.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';

const SOURCE: Record<VersionInfo['source'], string> = { save: 'saved', import: 'imported', copy: 'copied', restore: 'brought back', migration: 'converted' };

function Body({ rec }: { rec: StoredWarband }) {
  const data = useGameData();
  const online = useOnline();
  const navigate = useNavigate();
  const [notice, notify] = useNotice();
  const { ref, open, close } = useSheet();
  const [versions, setVersions] = useState<VersionInfo[] | null>(null);
  const [chosen, setChosen] = useState<VersionInfo | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState<number | null>(null);

  const load = useCallback(() => {
    if (rec.serverRev === undefined) return;
    listVersions(rec.id).then((v) => { setVersions(v); setError(null); }).catch((e: unknown) => setError(errorText(e)));
  }, [rec.id, rec.serverRev]);
  useEffect(load, [load]);

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await f(); } catch (e) { setError(e instanceof Error && !('status' in e) ? e.message : errorText(e)); } finally { setBusy(false); }
  };
  const save = () => run(async () => {
    const r = await saveVersion(data, rec, note);
    if (!r.ok) { setStale(r.headRev); return; }
    setNote('');
    notify(`Version ${r.rev} saved.`);
    load();
  });

  if (rec.serverRev === undefined) {
    return (
      <>
        <p className={ui.message}>This warband is not on the campaign server yet{rec.ownerId ? ' – it goes there with the next sync.' : '. Keep it in your account (Warbands) to give it versions.'}</p>
        {rec.ownerId && <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => void syncNow()}>Sync now</button></div>}
      </>
    );
  }

  return (
    <>
      <form className={`${ui.card} ${styles.form}`} onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <p className={ui.muted}>Every change is kept as you go. A version marks a state worth keeping – before a battle, after the post-battle sequence – and stays for good.</p>
        <label className={ui.field}>
          <span>A note for this version (optional)</span>
          <input className={ui.input} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. before the battle at the Docks" />
        </label>
        <div className={ui.row}>
          <button type="submit" className={ui.button} disabled={busy || !online || !!rec.conflict}>Save a version</button>
        </div>
        {!online && <p className={ui.muted}>Versions need the connection; your changes are kept on this device meanwhile.</p>}
        {rec.conflict && <p className={ui.error}>First decide on the roster which state to keep.</p>}
        {stale !== null && (
          <div className={ui.message} role="alert">
            <p>Version {stale} was saved on another device meanwhile. Take it (the changes here go), or keep the changes here as a copy.</p>
            <div className={ui.row}>
              <button type="button" className={ui.buttonQuiet} disabled={busy} onClick={() => void run(async () => { await loadNewest(data, rec); setStale(null); notify(`Version ${stale} taken.`); load(); })}>Take version {stale}</button>
              <button type="button" className={ui.buttonQuiet} disabled={busy} onClick={() => void run(async () => { const id = await makeCopy(rec); setStale(null); void navigate(`/warbands/${id}`); })}>Keep mine as a copy</button>
            </div>
          </div>
        )}
      </form>
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      <section className={styles.section} aria-labelledby="ver-h">
        <h2 id="ver-h">Versions</h2>
        {versions && (
          <ul className={styles.rows} aria-label="Versions">
            {versions.map((v) => (
              <li key={v.rev}>
                <span>
                  Version {v.rev}{v.rev === rec.serverRev ? ' · this one' : ''}
                  <small>{stamp(v.createdAt)} · {SOURCE[v.source]}{v.createdBy ? ` by ${v.createdBy}` : ''}{v.note ? ` · “${v.note}”` : ''}</small>
                </span>
                <button type="button" className={ui.buttonQuiet} aria-label={`Version ${v.rev}: what to do`} onClick={() => { setChosen(v); open(); }}>⋯</button>
              </li>
            ))}
          </ul>
        )}
        {rec.serverRev !== undefined && isWaiting(rec) && <p className={ui.muted}>Changes since version {rec.serverRev} are kept as a draft; save a version to mark them.</p>}
      </section>
      <dialog ref={ref} className={ui.sheet} aria-labelledby="ver-title">
        {chosen && (
          <div className={ui.page}>
            <h2 id="ver-title">Version {chosen.rev}</h2>
            <p className={ui.muted}>{stamp(chosen.createdAt)} · {SOURCE[chosen.source]}{chosen.createdBy ? ` by ${chosen.createdBy}` : ''}{chosen.note ? ` · “${chosen.note}”` : ''}</p>
            <ul className={styles.rows}>
              <li>
                <span>Make it the newest<small>As a new version; nothing in the history changes. Changes since the newest version go.</small></span>
                <button type="button" className={ui.buttonQuiet} disabled={busy || !online || chosen.rev === rec.serverRev || !!rec.conflict}
                  onClick={() => void run(async () => {
                    const r = await restoreVersion(data, rec, chosen.rev);
                    if (!r.ok) { close(() => setStale(r.headRev)); return; }
                    close(() => { notify(`Version ${chosen.rev} is the newest again (version ${r.rev}).`); load(); });
                  })}>Bring back</button>
              </li>
              <li>
                <span>Start a copy from it<small>A new warband of its own, e.g. for a campaign start; this one stays as it is.</small></span>
                <button type="button" className={ui.buttonQuiet} disabled={busy || !online}
                  onClick={() => void run(async () => {
                    const id = await makeCopy(rec, await versionState(data, rec.id, chosen.rev), chosen.rev);
                    close(() => void navigate(`/warbands/${id}`));
                  })}>Make a copy</button>
              </li>
            </ul>
            {error && <p className={ui.error} role="alert">{error}</p>}
            <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => close()}>Close</button></div>
          </div>
        )}
      </dialog>
      {notice}
    </>
  );
}

export function Versions() {
  const { id = '' } = useParams();
  const session = useSession();
  const rec = useLiveQuery(async () => (await db.warbands.get(id)) ?? null, [id]);
  if (rec === undefined) return null;
  const head = (
    <div>
      <Link to={`/warbands/${id}`} className={trade.back}>‹ {rec?.name ?? 'Warband'}</Link>
      <h1>Versions</h1>
    </div>
  );
  if (rec === null || rec.removedAt) return <section className={ui.page}>{head}<p className={ui.muted}>This warband is not stored here (any more).</p></section>;
  if (session.status !== 'in' && session.status !== 'unreachable') {
    return (
      <section className={ui.page}>
        {head}
        <p className={ui.message}>Versions live on the campaign server: sign in first.</p>
        <div className={ui.row}><Link className={ui.button} to={`/sign-in?next=/warbands/${id}/versions`}>Sign in</Link></div>
      </section>
    );
  }
  return (
    <section className={ui.page}>
      {head}
      <Suspense fallback={<p className={ui.muted}>Loading the rules…</p>}>
        <Body rec={rec} />
      </Suspense>
    </section>
  );
}
