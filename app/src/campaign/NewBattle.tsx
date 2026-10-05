/* Setting up a battle (phase 4a2), by a leader: who fights – the warbands
   confirmed in the campaign – where on the map, and a title. It is battle
   N of the campaign, N the round after the current one. Then the game
   night opens. */
import { Suspense, useState } from 'react';
import { useNavigate } from 'react-router';
import { errorText } from '../account/api.ts';
import { createBattle } from '../battle/api.ts';
import { newId } from '../db/ids.ts';
import { useGameData } from '../game/useGameData.ts';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import type { CampaignView } from './api.ts';
import styles from './Campaign.module.css';

function Districts({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const data = useGameData();
  return (
    <select className={ui.select} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Not on the map</option>
      {data.DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
    </select>
  );
}

export function NewBattleSheet({ id, view }: { id: string; view: CampaignView }) {
  const { ref, open, close } = useSheet();
  const navigate = useNavigate();
  const ready = view.enrolments.filter((e) => e.status === 'active');
  const [title, setTitle] = useState('');
  const [district, setDistrict] = useState('');
  const [fighting, setFighting] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const round = view.campaign.round + 1;
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const v = await createBattle(id, { id: newId(), title: title.trim(), district, warbandIds: fighting });
      close(() => void navigate(`/campaign/${id}/battles/${v.battle.id}`));
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <button type="button" className={ui.button} onClick={() => { setTitle(''); setDistrict(''); setFighting(ready.map((e) => e.warbandId)); setError(null); open(); }}>New battle</button>
      <dialog ref={ref} className={ui.sheet} aria-labelledby="nb-title">
        <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <h2 id="nb-title">Battle {round}</h2>
          {ready.length === 0 && <p className={ui.muted}>No warband is confirmed yet: confirm them under Manage first.</p>}
          {ready.length > 0 && (
            <fieldset className={styles.people}>
              <legend>Who fights</legend>
              {ready.map((e) => (
                <label key={e.warbandId} className={styles.choice}>
                  <input type="checkbox" checked={fighting.includes(e.warbandId)}
                    onChange={(x) => setFighting((f) => (x.target.checked ? [...f, e.warbandId] : f.filter((w) => w !== e.warbandId)))} />
                  <span>{e.name || e.wbName} <small>· {e.player}</small></span>
                </label>
              ))}
            </fieldset>
          )}
          <label className={ui.field}>
            <span>Title (optional)</span>
            <input className={ui.input} value={title} maxLength={120} placeholder="Hel Fenn ferry" onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className={ui.field}>
            <span>District</span>
            <Suspense fallback={<select className={ui.select} disabled><option>Loading the map…</option></select>}>
              <Districts value={district} onChange={setDistrict} />
            </Suspense>
          </label>
          {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
          <div className={ui.row}>
            <button type="submit" className={ui.button} disabled={busy || fighting.length === 0}>Start the game night</button>
            <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
