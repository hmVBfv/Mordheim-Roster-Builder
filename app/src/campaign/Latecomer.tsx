/* A planner that joins a running campaign late (wish #77, Rob, 25.10.2026): the plan of the catch-up. The campaign says what
   its warbands have by now (the median of those that have fought); the planner may have that much, in gold and in
   experience. The experience goes out evenly (core/campaign/catchup.ts): every group and Hero gets as much as battles were
   fought, the leader more, the rest shared among the Heroes – the player may move it between Heroes within bounds. What
   exceeds the plan is said; a leader can still confirm such an entry. Entered, it is an ordinary warband. */
import * as core from '@mordheim/core';
import { useEffect, useMemo, useState } from 'react';
import { errorText } from '../account/api.ts';
import type { StoredWarband } from '../db/db.ts';
import { useGameData } from '../game/useGameData.ts';
import { editableState } from '../roster/view.ts';
import ui from '../ui/ui.module.css';
import { getCatchUp, type CampaignView } from './api.ts';
import styles from './Campaign.module.css';
import { enterWarband } from './enter.ts';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function Latecomer({ id, rec, onDone, onClose }: {
  id: string; rec: StoredWarband; onDone: (v: CampaignView, warbandId: string) => void; onClose: () => void;
}) {
  const data = useGameData();
  const ctx = useMemo(() => core.ctxOf(data, editableState(data, rec.state)), [data, rec.state]);
  const [seen, setSeen] = useState<{ peers: core.PeerFigures[]; round: number } | null>(null);
  const [choice, setChoice] = useState<core.CatchUpChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    getCatchUp(id).then((r) => { if (live) setSeen(r); }).catch((e: unknown) => { if (live) setError(errorText(e)); });
    return () => { live = false; };
  }, [id]);
  const targets = useMemo(() => (seen ? core.catchUpTargets(seen.peers) : null), [seen]);
  const plan = useMemo(() => core.catchUpPlan(ctx, targets), [ctx, targets]);
  const chosen = choice ?? Object.fromEntries(plan.grants.map((g) => [g.uid, g.exp]));
  const problems = useMemo(() => core.catchUpProblems(ctx, plan, chosen), [ctx, plan, chosen]);
  const heroes = plan.grants.filter((g) => g.hero);
  const pool = heroes.reduce((n, g) => n + g.exp, 0) - heroes.reduce((n, g) => n + (chosen[g.uid] ?? g.exp), 0);
  const move = (uid: number, by: number) => setChoice({ ...chosen, [uid]: (chosen[uid] ?? 0) + by });

  const enter = async () => {
    if (!seen) return;
    setBusy(true);
    setError(null);
    try {
      const state = core.applyCatchUp(ctx, plan, chosen, seen.round, problems);
      const r = await enterWarband(data, id, rec, { state });
      onDone(r.campaign, r.id);
    } catch (e) { setError(errorText(e)); setBusy(false); }
  };

  if (!seen && !error) return <p className={ui.muted}>Looking at what the others have …</p>;
  return (
    <div className={ui.page}>
      {targets
        ? <p>Measured by the median of {targets.peers} {plural(targets.peers, 'warband that has', 'warbands that have')} fought: rating {targets.rating}, value {targets.value} gc, {targets.battles} {plural(targets.battles, 'battle', 'battles')}.</p>
        : <p>No warband in this campaign has fought yet, so you join with what a new warband starts with.</p>}
      <p className={ui.muted}>You may own up to {plan.allowedValue} gc{plan.gap > 0 ? ` and share ${plan.gap} rating points of experience${plan.shrunk ? ' (less than the battles fought would give, so everybody gets less)' : ''}` : ''}. It comes in as an ordinary warband; the gold you do not spend is in hand.</p>
      <ul className={styles.grants} aria-label="Experience from the catch-up">
        {plan.grants.map((g) => {
          const m = ctx.s.models.find((x) => x.uid === g.uid);
          const need = m ? core.expNeeded(ctx, m) - (core.advanceStatus(ctx, m)?.start ?? 0) : 0;
          const exp = chosen[g.uid] ?? g.exp;
          return (
            <li key={g.uid} className={styles.grant}>
              <span>{g.name}{g.count > 1 ? ` ×${g.count}` : ''}{g.leader ? ' · leader' : ''}{need > 0 ? <small> · its advances need +{need}</small> : null}</span>
              {g.hero ? (
                <span className={styles.grantStep}>
                  <button type="button" className={ui.buttonQuiet} aria-label={`One experience less for ${g.name}`} disabled={exp <= g.min} onClick={() => move(g.uid, -1)}>−</button>
                  <b aria-live="polite">+{exp}</b>
                  <button type="button" className={ui.buttonQuiet} aria-label={`One experience more for ${g.name}`} disabled={exp >= g.max || pool <= 0} onClick={() => move(g.uid, 1)}>+</button>
                </span>
              ) : <b>+{exp}{g.count > 1 ? ' each' : ''}</b>}
            </li>
          );
        })}
      </ul>
      {pool > 0 && <p className={ui.muted}>{pool} experience of the Heroes not placed yet.</p>}
      {problems.length > 0 && (
        <div className={`${ui.message} ${ui.error}`} role="alert">
          <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          <p>A leader can still confirm an entry that exceeds the plan.</p>
        </div>
      )}
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      <div className={ui.actions}>
        <button type="button" className={ui.buttonQuiet} onClick={onClose}>Cancel</button>
        <button type="button" className={ui.button} disabled={busy || !seen} onClick={() => void enter()}>{problems.length > 0 ? 'Enter anyway' : 'Enter as a latecomer'}</button>
      </div>
    </div>
  );
}
