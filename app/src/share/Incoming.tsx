/* Copies other players sent, under "Open for you" on Home (Rob, 05.10.2026). */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { errorText } from '../account/api.ts';
import { ago } from '../account/time.ts';
import ui from '../ui/ui.module.css';
import styles from './Share.module.css';
import { declineShare, listShares, type Share } from './shares.ts';

export function Incoming() {
  const navigate = useNavigate();
  const [shares, setShares] = useState<Share[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    listShares().then((r) => setShares(r.incoming)).catch(() => setShares([]));
  }, []);
  useEffect(load, [load]);
  if (!shares || shares.length === 0) return <p className={ui.muted}>Nothing waiting. Questions, sealed notes and battles to write up will appear here once you are part of a campaign.</p>;
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await f(); } catch (e) { setError(e instanceof Error && !('status' in e) ? e.message : errorText(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <ul className={styles.list} aria-label="Sent to you">
        {shares.map((s) => (
          <li key={s.id}>
            <span>{s.from} sent you {s.name}<small>a copy of your own · {ago(s.createdAt)}</small></span>
            <span className={ui.row}>
              <button type="button" className={ui.button} disabled={busy}
                onClick={() => void run(async () => {
                  const [{ acceptShare }, { loadGameData }] = await Promise.all([import('./take.ts'), import('../game/gameData.ts')]);
                  const id = await acceptShare(await loadGameData(), s.id);
                  void navigate(`/warbands/${id}`);
                })}>Take it</button>
              <button type="button" className={ui.buttonQuiet} disabled={busy}
                onClick={() => void run(async () => { await declineShare(s.id); load(); })}>Decline</button>
            </span>
          </li>
        ))}
      </ul>
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
    </>
  );
}
