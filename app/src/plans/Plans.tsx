/* The leaders' plans (Background tab): for each coming battle, the red thread
   a leader wants it and its chapter to follow – the goal, the turning points,
   where the story should end up. Written by the battle's number, so before
   the battle is set up; the AI pack hands the plan of its battle to the
   writer as direction. Leaders with the authenticator only; writing needs the
   connection, reading works from what the device kept. */
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import { errorText } from '../account/api.ts';
import { useOnline } from '../app/SyncState.tsx';
import type { CampaignView } from '../campaign/api.ts';
import { readText } from '../timeline/chapters.ts';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { cachedPlans, getPlans, MAX_PLAN, putPlan, stalePlan, type Plan } from './api.ts';
import styles from './Plans.module.css';

/** The plans of a campaign: what the device kept first, then the server's. */
export function usePlans(cid: string) {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void cachedPlans(cid).then((c) => { if (live && c) setPlans((cur) => cur ?? c); });
    getPlans(cid).then((p) => { if (live) { setPlans(p); setError(null); } }).catch((e: unknown) => { if (live) setError(errorText(e)); });
    return () => { live = false; };
  }, [cid]);
  return { plans, setPlans, error };
}

export function PlanText({ text }: { text: string }) {
  return (
    <div className={styles.text}>
      {readText(text).map((p, i) => (p.kind === 'heading' ? <h4 key={i}>{p.text}</h4> : p.kind === 'rule' ? <hr key={i} />
        : <p key={i}>{p.pieces.map((x, j) => (x.strong ? <strong key={j}>{x.text}</strong> : <span key={j}>{x.text}</span>))}</p>))}
    </div>
  );
}

export function PlansSection({ id, view, notify }: { id: string; view: CampaignView; notify: (text: string) => void }) {
  const online = useOnline();
  const { plans, setPlans, error } = usePlans(id);
  const { ref, open, close } = useSheet();
  const [editing, setEditing] = useState<{ plan: Plan | null; key: number } | null>(null);
  const next = view.campaign.round + 1;
  const titleOf = (round: number) => {
    const b = (view.battles ?? []).find((x) => x.round === round && !x.takenOver);
    return `Battle ${round}${b?.title ? ` · ${b.title}` : ''}${b ? (b.status === 'closed' ? ' · played' : ' · being fought') : round === next ? ' · next' : ''}`;
  };
  const edit = (plan: Plan | null) => { setEditing((e) => ({ plan, key: (e?.key ?? 0) + 1 })); open(); };

  return (
    <section className={ui.page} aria-labelledby="plans-title">
      <h2 id="plans-title" className={styles.title}>Plans</h2>
      <p className={ui.muted}>The red thread for a coming battle: what should happen, the turning points, where the story should end up. Only leaders see it; the AI pack hands it to whoever writes the chapter.</p>
      {error && <p className={ui.message} role="status">{error}{plans ? ' Shown as last seen.' : ''}</p>}
      {!plans && !error && <p className={ui.muted}>Loading the plans…</p>}
      {plans && plans.length === 0 && <p className={ui.muted}>No plan yet.</p>}
      <ul className={styles.list} aria-label="Plans">
        {(plans ?? []).map((p) => (
          <li key={p.round} className={styles.plan}>
            <strong>{titleOf(p.round)}</strong>
            <PlanText text={p.text} />
            <small className={styles.meta}>{p.updatedBy ? `by ${p.updatedBy}` : ''}</small>
            <div className={ui.row}><button type="button" className={ui.buttonQuiet} aria-label={`Edit the plan for battle ${p.round}`} onClick={() => edit(p)}>Edit</button></div>
          </li>
        ))}
      </ul>
      <div className={ui.row}><button type="button" className={ui.button} onClick={() => edit(null)}>Plan a battle</button></div>
      <dialog ref={ref} className={ui.sheet} aria-labelledby="plan-form-title">
        {editing && (
          <PlanForm key={editing.key} cid={id} plan={editing.plan} plans={plans ?? []} next={next} online={online} close={close}
            onSaved={(p, round) => {
              setPlans((cur) => [...(cur ?? []).filter((x) => x.round !== round), ...(p.text ? [p] : [])].sort((a, b) => a.round - b.round));
              notify(p.text ? `Plan for battle ${round} saved. Only leaders see it.` : `Plan for battle ${round} taken out.`);
            }} />
        )}
      </dialog>
    </section>
  );
}

function PlanForm({ cid, plan, plans, next, online, close, onSaved }: {
  cid: string; plan: Plan | null; plans: Plan[]; next: number; online: boolean; close: (then?: () => void) => void; onSaved: (p: Plan, round: number) => void;
}) {
  const ids = useId();
  const [round, setRound] = useState(String(plan?.round ?? next));
  const [text, setText] = useState(plan?.text ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = Number(round);
  const valid = Number.isInteger(n) && n >= 1 && n <= 999;
  // writing a number that already has a plan edits that one, from its stand
  const there = plans.find((p) => p.round === n) ?? null;
  const [base, setBase] = useState<Record<number, number>>({});
  const baseSeq = base[n] ?? there?.seq ?? 0;

  const save = async (value: string) => {
    if (!valid) { setError('Give the battle’s number (1, 2, 3 …).'); return; }
    setBusy(true);
    setError(null);
    try {
      const p = await putPlan(cid, n, value, baseSeq);
      close(() => onSaved(p, n));
    } catch (e) {
      const cur = stalePlan(e);
      if (cur) {
        setBase((b) => ({ ...b, [n]: cur.seq }));
        setError(`${cur.updatedBy ?? 'Another leader'} changed this plan while you were writing. Theirs: “${cur.text.slice(0, 200)}${cur.text.length > 200 ? '…' : ''}” – save again to replace it with yours.`);
      } else setError(errorText(e));
    } finally { setBusy(false); }
  };

  return (
    <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void save(text); }} noValidate>
      <h2 id="plan-form-title">{plan ? `The plan for battle ${plan.round}` : 'Plan a battle'}</h2>
      <p className={ui.muted}>⚑ Only leaders see this.</p>
      <label className={ui.field}>
        <span>Battle number</span>
        <input className={ui.input} type="number" inputMode="numeric" min={1} max={999} step={1} value={round} disabled={!!plan} onChange={(e) => setRound(e.target.value)} />
        {!plan && there && <small className={ui.muted}>Battle {n} has a plan already: saving replaces it.</small>}
      </label>
      <div className={ui.field}>
        <label htmlFor={`${ids}-text`}>The red thread</label>
        <textarea id={`${ids}-text`} className={`${ui.textarea} ${ui.writing}`} rows={8} value={text} maxLength={MAX_PLAN}
          placeholder="The ferrymen turn on the Caravan halfway across. The Countess stays unseen – only her coin is found." onChange={(e) => setText(e.target.value)} />
        <small className={ui.muted}>{text.length.toLocaleString('en')} of {MAX_PLAN.toLocaleString('en')} characters</small>
      </div>
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {!online && <p className={ui.message} role="status">Saving a plan needs the connection.</p>}
      <div className={ui.row}>
        <button type="submit" className={ui.button} disabled={busy || !online || !text.trim() || !valid}>Save the plan</button>
        {plan && <button type="button" className={ui.buttonQuiet} disabled={busy || !online} onClick={() => void save('')}>Take the plan out</button>}
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </form>
  );
}

/** A battle's own plan, for a leader at the battle: folded, so the table does not see it by accident. */
export function OwnPlan({ cid, round }: { cid: string; round: number }) {
  const { plans } = usePlans(cid);
  if (!plans) return null;
  const plan = plans.find((p) => p.round === round);
  return (
    <section aria-label="Your plan" className={styles.own}>
      {plan
        ? (
          <details className={styles.plan}>
            <summary>Your plan for this battle ⚑</summary>
            <PlanText text={plan.text} />
          </details>
        )
        : <p className={ui.muted}>No plan for this battle. <Link to={`/campaign/${cid}/background`}>Write one under Background ⚑ → Plans</Link>.</p>}
    </section>
  );
}
