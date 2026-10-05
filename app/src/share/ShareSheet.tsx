/* "Share…" on the roster (Rob, 05.10.2026): a copy straight to another
   player, or a short code to give them. Always a copy – theirs to change,
   yours stays as it is and private. */
import type { GameData, WarbandState } from '@mordheim/core';
import { useState } from 'react';
import { errorText } from '../account/api.ts';
import { stamp } from '../account/time.ts';
import { useOnline } from '../app/SyncState.tsx';
import type { StoredWarband } from '../db/db.ts';
import { copyText } from '../ui/files.ts';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import styles from './Share.module.css';
import { listPeople, listShares, revokeShare, type Person, type Share } from './shares.ts';
import { makeCode, sendCopy } from './take.ts';

export function ShareSheet({ data, rec, state, onNotice }: { data: GameData; rec: StoredWarband; state: WarbandState; onNotice: (t: string) => void }) {
  const { ref, open, close } = useSheet();
  const online = useOnline();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [sent, setSent] = useState<Share[]>([]);
  const [to, setTo] = useState('');
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const warbandId = rec.serverRev !== undefined ? rec.id : undefined;

  const load = () => {
    setError(null);
    Promise.all([listPeople(), listShares()])
      .then(([p, s]) => {
        setPeople(p);
        const now = new Date().toISOString();
        setSent(s.outgoing.filter((x) => !x.revokedAt && x.expiresAt > now && (x.code || !x.answeredAt)));
      })
      .catch((e: unknown) => setError(errorText(e)));
  };
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await f(); } catch (e) { setError(e instanceof Error && !('status' in e) ? e.message : errorText(e)); } finally { setBusy(false); }
  };
  const who = people?.find((p) => p.id === to);

  return (
    <>
      <button type="button" className={ui.buttonQuiet} onClick={() => { setCode(null); setTo(''); load(); open(); }}>Share…</button>
      <dialog ref={ref} className={ui.sheet} aria-labelledby="share-title">
        <div className={ui.page}>
          <h2 id="share-title">Share {rec.name}</h2>
          <p className={ui.muted}>The other player gets a copy of their own. This one stays as it is, and yours alone.</p>
          {!online && <p className={ui.message}>Sharing needs the connection.</p>}

          <form className={styles.section} onSubmit={(e) => { e.preventDefault(); void run(async () => { await sendCopy(data, state, to, warbandId); close(() => onNotice(`Sent to ${who?.displayName ?? 'them'}. It waits under “Open for you”.`)); }); }}>
            <h3>Send a copy to</h3>
            {people && people.length === 0 && <p className={ui.muted}>Nobody else has an account yet.</p>}
            {people && people.length > 0 && (
              <fieldset className={styles.people}>
                <legend className="visually-hidden">Player</legend>
                {people.map((p) => (
                  <label key={p.id} className={styles.person}>
                    <input type="radio" name="share-to" value={p.id} checked={to === p.id} onChange={() => setTo(p.id)} />
                    <span>{p.displayName}{p.displayName !== p.username && <small> · {p.username}</small>}</span>
                  </label>
                ))}
              </fieldset>
            )}
            <div className={ui.row}><button type="submit" className={ui.button} disabled={busy || !online || !to}>Send the copy</button></div>
          </form>

          <section className={styles.section} aria-labelledby="share-code-h">
            <h3 id="share-code-h">Or a share code</h3>
            {code ? (
              <>
                <p className={styles.code} aria-label="Share code">{code.code}</p>
                <div className={ui.row}>
                  <button type="button" className={ui.button} onClick={() => { void copyText(code.code).then((ok) => onNotice(ok ? 'Code copied.' : 'Select the code and copy it.')); }}>Copy the code</button>
                </div>
                <p className={ui.muted}>Anyone with an account here enters it under Warbands → “Enter a share code” and gets a copy, until {stamp(code.expiresAt)}. Shown only now.</p>
              </>
            ) : (
              <div className={ui.row}>
                <button type="button" className={ui.buttonQuiet} disabled={busy || !online}
                  onClick={() => void run(async () => { const c = await makeCode(data, state, warbandId); setCode(c); load(); })}>Make a share code</button>
              </div>
            )}
          </section>

          {sent.length > 0 && (
            <section className={styles.section} aria-labelledby="share-sent-h">
              <h3 id="share-sent-h">Shared and still open</h3>
              <ul className={styles.list}>
                {sent.map((s) => (
                  <li key={s.id}>
                    <span>{s.name}<small>{s.code ? `code · taken ${s.uses}×` : `to ${s.to}`} · until {stamp(s.expiresAt)}</small></span>
                    <button type="button" className={ui.buttonQuiet} disabled={busy}
                      onClick={() => void run(async () => { await revokeShare(s.id); onNotice('Taken back.'); load(); })}>Take back</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
          <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => close()}>Close</button></div>
        </div>
      </dialog>
    </>
  );
}
