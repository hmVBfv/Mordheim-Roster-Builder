/* "Enter a share code" on Warbands (Rob, 05.10.2026): instead of a file,
   the short code another player made – look at it, then take a copy. */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { errorText } from '../account/api.ts';
import { useOnline } from '../app/SyncState.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import styles from './Share.module.css';
import { peekCode, type CodeLook } from './shares.ts';

export function CodeSheet() {
  const { ref, open, close } = useSheet();
  const online = useOnline();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [look, setLook] = useState<CodeLook | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await f(); } catch (e) { setError(e instanceof Error && !('status' in e) ? e.message : errorText(e)); } finally { setBusy(false); }
  };
  const peek = () => run(async () => setLook(await peekCode(code)));
  const take = () => run(async () => {
    const [{ redeemCode }, { loadGameData }] = await Promise.all([import('./take.ts'), import('../game/gameData.ts')]);
    const id = await redeemCode(await loadGameData(), code);
    close(() => void navigate(`/warbands/${id}`));
  });
  return (
    <>
      <button type="button" className={ui.buttonQuiet} onClick={() => { setCode(''); setLook(null); setError(null); open(); }}>Enter a share code</button>
      <dialog ref={ref} className={ui.sheet} aria-labelledby="code-title">
        <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void (look ? take() : peek()); }}>
          <h2 id="code-title">Enter a share code</h2>
          <label className={ui.field}>
            <span>The code another player gave you</span>
            <input className={`${ui.input} ${styles.codeInput}`} value={code} maxLength={12} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="XXXX-XXXX"
              onChange={(e) => { setCode(e.target.value); setLook(null); }} required autoFocus />
          </label>
          {look && (
            <div className={ui.card}>
              <strong>{look.name}</strong>
              <p className={ui.muted}>from {look.from} · you get a copy of your own</p>
            </div>
          )}
          {!online && <p className={ui.message}>Codes need the connection.</p>}
          {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
          <div className={ui.row}>
            <button type="submit" className={ui.button} disabled={busy || !online || code.replace(/[^0-9a-z]/gi, '').length < 8}>{look ? 'Add the copy' : 'Look it up'}</button>
            <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
