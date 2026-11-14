/* The warband duties phase (Rob, 14.11.2026): rules that ask for a choice after each battle, with their consequences – the Troll's "Always
   Hungry". Each way out shows its price; one that would break the warband's maximum says why and offers the way: pay, or let someone go first.
   Nothing is chosen for the player. */
import * as core from '@mordheim/core';
import { useState } from 'react';
import ui from '../ui/ui.module.css';
import styles from './Aftermath.module.css';
import type { AftermathView } from './view.ts';

export interface DutyActs {
  ctx: core.Ctx;
  edit: (action: (ctx: core.Ctx) => core.WarbandState, text?: string, opts?: { gold?: 'settle' | 'keep' }) => void;
}

/** Who may be let go to make room: every warrior of the roster but the leader and the one the duty is about, a man of a group at a time. */
function goers(ctx: core.Ctx, exceptUid: number): { uid: number; i: number; label: string; group: boolean }[] {
  const lead = core.leaderUid(ctx);
  const out: { uid: number; i: number; label: string; group: boolean }[] = [];
  for (const m of ctx.s.models) {
    if (m.uid === exceptUid || m.uid === lead) continue;
    const n = core.memberCount(m);
    const name = core.modelLabel(ctx, m);
    if (n > 1) for (let i = 0; i < n; i++) out.push({ uid: m.uid, i, label: `${name} ${i + 1}`, group: true });
    else out.push({ uid: m.uid, i: 0, label: name, group: false });
  }
  return out;
}

function Duty({ d, ctx, acts, round }: { d: core.DutyLine; ctx: core.Ctx; acts: DutyActs; round: number }) {
  const [pick, setPick] = useState<string[]>([]);
  const [making, setMaking] = useState(false);
  const sac = d.options.find((o) => o.id === 'sacrifice');
  const cands = sac ? core.sacrificeCandidates(ctx, sac.units ?? []) : [];
  const choose = (o: core.DutyOption) => acts.edit((c) => core.resolveDuty(c, round, d.id, o.id), `${d.title}: ${o.label}.`, { gold: 'keep' });
  const sacrifice = () => acts.edit((c) => core.resolveDuty(c, round, d.id, 'sacrifice', { sacrifice: pick.map((k) => { const [u, i] = k.split(':'); return { uid: Number(u), i: Number(i) }; }) }), 'Two sacrificed.', { gold: 'keep' });
  const blocked = d.options.find((o) => !o.available && o.id === 'double');
  const problem = sac && pick.length === (sac.count ?? 2) ? core.dutyProblem(ctx, round, d.id, 'sacrifice', { sacrifice: pick.map((k) => { const [u, i] = k.split(':'); return { uid: Number(u), i: Number(i) }; }) }) : null;

  if (d.resolved) {
    const o = d.options.find((x) => x.id === d.resolved!.option);
    return (
      <div className={styles.recorded}>
        <p><strong>✓ {d.title}:</strong> {o?.label ?? d.resolved.option}{d.resolved.gc ? ` (${d.resolved.gc} gc)` : ''}.</p>
        {(d.resolved.option === 'pay' || d.resolved.option === 'double') && (
          <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => acts.edit((c) => core.undoDuty(c, round, d.id), 'Taken back.', { gold: 'keep' })}>Take it back</button></div>
        )}
      </div>
    );
  }
  return (
    <fieldset className={styles.scenario}>
      <legend>{d.title}</legend>
      <p>{d.text}</p>
      <ul className={styles.plain} aria-label={`${d.title}: the ways out`}>
        {d.options.map((o) => (
          <li key={o.id} className={styles.allowance}>
            <span>{o.label}{!o.available && o.why ? <small className={styles.warn}><br />{o.why}</small> : null}</span>
            {o.id === 'sacrifice'
              ? null
              : <button type="button" className={o.id === 'leave' ? ui.buttonQuiet : ui.button} disabled={!o.available} onClick={() => choose(o)}>{o.id === 'leave' ? 'Let him go' : o.gc ? `Choose – ${o.gc} gc` : 'Choose'}</button>}
          </li>
        ))}
      </ul>
      {sac && (
        <div className={styles.recorded}>
          <p><strong>{sac.label}</strong></p>
          {!sac.available ? <p className={styles.warn}>{sac.why}</p> : (
            <>
              <ul className={styles.plain} aria-label="To sacrifice">
                {cands.map((c) => {
                  const k = `${c.uid}:${c.i}`;
                  return <li key={k}><label><input type="checkbox" checked={pick.includes(k)} onChange={(e) => setPick((p) => (e.target.checked ? [...p, k] : p.filter((x) => x !== k)))} /> {c.label}</label></li>;
                })}
              </ul>
              {problem && <p className={styles.warn}>{problem}</p>}
              <div className={ui.row}><button type="button" className={ui.button} disabled={pick.length !== (sac.count ?? 2) || !!problem} onClick={sacrifice}>Sacrifice these two</button></div>
            </>
          )}
        </div>
      )}
      {blocked && (
        <div className={styles.recorded}>
          <p>To count as two members there must be room: let someone go first.</p>
          <div className={ui.row}><button type="button" className={ui.buttonQuiet} aria-expanded={making} onClick={() => setMaking((v) => !v)}>{making ? 'Hide the roster' : 'Let someone go…'}</button></div>
          {making && (
            <ul className={styles.plain} aria-label="Who may go">
              {goers(ctx, d.uid).map((g) => (
                <li key={`${g.uid}:${g.i}`} className={styles.allowance}>
                  <span>{g.label}</span>
                  <button type="button" className={ui.buttonQuiet} aria-label={`Let ${g.label} go`} onClick={() => acts.edit((c) => (g.group ? core.dismissMan(c, g.uid, g.i) : core.dismissWarrior(c, g.uid)), `${g.label} let go.`, { gold: 'keep' })}>Let go</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </fieldset>
  );
}

export function DutiesStep({ a, acts }: { a: AftermathView; acts: DutyActs }) {
  const due = core.dutiesDue(acts.ctx, a.round);
  return (
    <>
      <p>Some warbands have a rule that asks for a choice after each battle. Settle it here, before you hire or buy: what you choose has consequences – gold, the warband’s size, who stays.</p>
      {due.length === 0 && <p className={ui.muted}>This warband has no such duty.</p>}
      {due.map((d) => <Duty key={d.id} d={d} ctx={acts.ctx} acts={acts} round={a.round} />)}
      {due.some((d) => !d.resolved) && <p className={styles.warn}>{due.filter((d) => !d.resolved).length} still to settle.</p>}
    </>
  );
}
