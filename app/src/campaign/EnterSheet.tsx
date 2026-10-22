/* Entering one of one's own warbands in a campaign (phase 4a1): a copy goes
   in, the warband stays free; or a new warband is started for the campaign. */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { errorText } from '../account/api.ts';
import { useSession } from '../account/session.ts';
import { useWarbands } from '../sync/local.ts';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import type { CampaignView } from './api.ts';
import styles from './Campaign.module.css';

/** Entering one of one's own warbands: a copy goes in, the warband stays free. */
export function EnterSheet({ id, onDone }: { id: string; onDone: (v: CampaignView) => void }) {
  const { ref, open, close } = useSheet();
  const navigate = useNavigate();
  const session = useSession();
  const me = session.status === 'in' ? session.user.id : undefined;
  const free = (useWarbands() ?? []).filter((w) => w.ownerId === me && !w.campaignId && !w.conflict);
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const rec = free.find((w) => w.id === chosen);
    if (!rec) return;
    setBusy(true);
    setError(null);
    try {
      const [{ enterWarband }, { loadGameData }] = await Promise.all([import('./enter.ts'), import('../game/gameData.ts')]);
      const r = await enterWarband(await loadGameData(), id, rec);
      onDone(r.campaign);
      close(() => void navigate(`/warbands/${r.id}`));
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <button type="button" className={ui.button} onClick={() => { setChosen(''); setError(null); open(); }}>Enter a warband</button>
      <dialog ref={ref} className={ui.sheet} aria-labelledby="enter-title">
        <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <h2 id="enter-title">Enter a warband</h2>
          <p className={ui.muted}>A copy goes into the campaign, under the campaign’s house rules; the warband you pick stays as it is, for other games. A leader confirms the copy, and its start is marked.</p>
          {free.length === 0 && <p className={ui.muted}>None of your warbands is free yet: make a new one for the campaign.</p>}
          {free.length > 0 && (
            <fieldset className={styles.people}>
              <legend className="visually-hidden">Warband</legend>
              {free.map((w) => (
                <label key={w.id} className={styles.choice}>
                  <input type="radio" name="enter-warband" value={w.id} checked={chosen === w.id} onChange={() => setChosen(w.id)} />
                  <span>{w.name} <small>· {w.wbName}</small></span>
                </label>
              ))}
            </fieldset>
          )}
          {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
          <div className={ui.actions}>
            <button type="button" className={free.length > 0 ? ui.buttonQuiet : ui.button} onClick={() => close(() => void navigate(`/warbands/new?campaign=${id}`))}>New warband for this campaign</button>
            <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
            {free.length > 0 && <button type="submit" className={ui.button} disabled={busy || !chosen}>Enter a copy</button>}
          </div>
        </form>
      </dialog>
    </>
  );
}
