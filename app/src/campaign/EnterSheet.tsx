/* Entering one of one's own warbands in a campaign (phase 4a1): a copy goes
   in, the warband stays free; or a new warband is started for the campaign. */
import * as core from '@mordheim/core';
import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router';
import { errorText } from '../account/api.ts';
import { useSession } from '../account/session.ts';
import { useGameData } from '../game/useGameData.ts';
import { useWarbands } from '../sync/local.ts';
import ui from '../ui/ui.module.css';
import { ruleLabel } from '../roster/house.ts';
import { useSheet } from '../ui/useSheet.ts';
import type { CampaignView } from './api.ts';
import styles from './Campaign.module.css';

const Latecomer = lazy(() => import('./Latecomer.tsx').then((m) => ({ default: m.Latecomer })));

/** Entering one of one's own warbands: a copy goes in, the warband stays free. */
export function EnterSheet({ id, rules, vanilla = false, onDone }: { id: string; rules?: unknown; /** The campaign plays Vanilla Mordheim: only the warbands of the rulebook enter (#167). */ vanilla?: boolean; onDone: (v: CampaignView) => void }) {
  const { ref, open, close } = useSheet();
  const navigate = useNavigate();
  const session = useSession();
  const me = session.status === 'in' ? session.user.id : undefined;
  const mine = (useWarbands() ?? []).filter((w) => w.ownerId === me && !w.campaignId && !w.conflict);
  const data = useGameData();
  const free = mine.filter((w) => !w.state.planner);
  // a campaign that plays Vanilla Mordheim takes only the warbands of the rulebook
  const fits = (w: { wb: string }) => !vanilla || !data || core.isVanillaWarband(data, w.wb);
  // a planner (#77) does not enter as it is: it joins late, measured against the others (Latecomer.tsx)
  const planners = mine.filter((w) => w.state.planner);
  const [chosen, setChosen] = useState('');
  const [own, setOwn] = useState<'campaign' | 'own' | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = free.find((w) => w.id === chosen);
  const late = planners.find((w) => w.id === chosen);
  // a warband with house rules of its own that the campaign's do not match: the player says what the copy does with them (#64)
  const ownRules = rec && rules !== undefined && core.houseDifferences(rules, rec.state.house).length > 0 ? core.houseDifferences(undefined, rec.state.house) : [];
  const submit = async () => {
    if (!rec) return;
    setBusy(true);
    setError(null);
    try {
      const [{ enterWarband }, { loadGameData }] = await Promise.all([import('./enter.ts'), import('../game/gameData.ts')]);
      const r = await enterWarband(await loadGameData(), id, rec, { keepOwnRules: ownRules.length > 0 && own === 'own' });
      onDone(r.campaign);
      close(() => void navigate(`/warbands/${r.id}`));
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <button type="button" className={ui.button} onClick={() => { setChosen(''); setOwn(''); setError(null); open(); }}>Enter a warband</button>
      <dialog ref={ref} className={ui.sheet} aria-labelledby="enter-title">
        <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <h2 id="enter-title">Enter a warband</h2>
          <p className={ui.muted}>A copy goes into the campaign, under the campaign’s house rules; the warband you pick stays as it is, for other games. A leader confirms the copy, and its start is marked.</p>
          {free.length === 0 && planners.length === 0 && <p className={ui.muted}>None of your warbands is free yet: make a new one for the campaign.</p>}
          {free.length > 0 && (
            <fieldset className={styles.people}>
              <legend className="visually-hidden">Warband</legend>
              {free.map((w) => (
                <label key={w.id} className={styles.choice}>
                  <input type="radio" name="enter-warband" value={w.id} checked={chosen === w.id} disabled={!fits(w)} onChange={() => { setChosen(w.id); setOwn(''); }} />
                  <span>{w.name} <small>· {w.wbName}{fits(w) ? '' : ' · not a warband of the rulebook: this campaign plays Vanilla Mordheim'}</small></span>
                </label>
              ))}
            </fieldset>
          )}
          {planners.length > 0 && (
            <fieldset className={styles.people}>
              <legend>Planners, to join late</legend>
              {planners.map((w) => (
                <label key={w.id} className={styles.choice}>
                  <input type="radio" name="enter-warband" value={w.id} checked={chosen === w.id} onChange={() => { setChosen(w.id); setOwn(''); }} />
                  <span>{w.name} <small>· {w.wbName} · planner</small></span>
                </label>
              ))}
            </fieldset>
          )}
          {late && (
            <Suspense fallback={<p className={ui.muted}>Loading the rules…</p>}>
              <Latecomer key={late.id} id={id} rec={late} onClose={() => close()}
                onDone={(v, wid) => { onDone(v); close(() => void navigate(`/warbands/${wid}`)); }} />
            </Suspense>
          )}
          {ownRules.length > 0 && (
            <fieldset className={styles.people}>
              <legend>Its own house rules</legend>
              <p className={ui.muted}>This warband has house rules of its own ({[...new Set(ownRules.map((k) => ruleLabel(k === 'rangedCap' ? 'rangedCapOn' : k)))].join(', ')}) that differ from the campaign’s. What should the copy do?</p>
              <label className={styles.choice}>
                <input type="radio" name="enter-own" checked={own === 'campaign'} onChange={() => setOwn('campaign')} />
                <span>Take the campaign’s rules <small>· its own are left behind in the copy</small></span>
              </label>
              <label className={styles.choice}>
                <input type="radio" name="enter-own" checked={own === 'own'} onChange={() => setOwn('own')} />
                <span>Keep its own rules <small>· the leaders see that they differ</small></span>
              </label>
            </fieldset>
          )}
          {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
          <div className={ui.actions}>
            <button type="button" className={free.length > 0 ? ui.buttonQuiet : ui.button} onClick={() => close(() => void navigate(`/warbands/new?campaign=${id}`))}>New warband for this campaign</button>
            <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
            {free.length > 0 && !late && <button type="submit" className={ui.button} disabled={busy || !chosen || (ownRules.length > 0 && !own)}>Enter a copy</button>}
          </div>
        </form>
      </dialog>
    </>
  );
}
