/* Setting up a battle (phase 4a2), by a leader: who fights – the warbands
   confirmed in the campaign – where on the map, and a title. It is battle
   N of the campaign: the next one unless the leader says otherwise (a
   campaign that comes into the app at battle 4 starts with 4; battles of
   the history before the app are taken). Then the game night opens. */
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

export function Districts({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
  const next = view.campaign.round + 1;
  /** The first number still free: the history before the app takes its own. */
  const first = Math.max(1, ...(view.battles ?? []).filter((b) => b.takenOver).map((b) => b.round + 1));
  const [number, setNumber] = useState(String(next));
  const round = Number(number);
  const valid = Number.isInteger(round) && round >= first && round <= 999;
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const v = await createBattle(id, { id: newId(), round, title: title.trim(), district, warbandIds: fighting });
      close(() => void navigate(`/campaign/${id}/battles/${v.battle.id}`));
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <button type="button" className={ui.button} onClick={() => { setNumber(String(Math.max(next, first))); setTitle(''); setDistrict(''); setFighting(ready.map((e) => e.warbandId)); setError(null); open(); }}>New battle</button>
      <dialog ref={ref} className={ui.sheet} aria-labelledby="nb-title">
        <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <h2 id="nb-title">Battle {valid ? round : next}</h2>
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
            <span>Battle number</span>
            <input className={ui.input} type="number" inputMode="numeric" min={first} max={999} step={1} value={number} onChange={(e) => setNumber(e.target.value)} aria-invalid={!valid} />
            {!valid && <small className={ui.muted}>From {first}{first > 1 ? ' – battles before it were played before the app' : ''}.</small>}
            {valid && round > next && <small className={ui.muted}>The campaign comes to the round before it: battles {next}–{round - 1} are not played here.</small>}
          </label>
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
          <div className={ui.actions}>
            <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
            <button type="submit" className={ui.button} disabled={busy || fighting.length === 0 || !valid}>Start the game night</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
