/* The upkeep of Hired Swords and Dramatis Personae, after the wyrdstone is sold (N10): who is owed what, pay or send away, gold in hand after.
   Not a lock: the sequence may go on with an upkeep unpaid; the page only says so. */
import * as core from '@mordheim/core';
import { useState } from 'react';
import { RulesTable } from '../ui/RulesTable.tsx';
import ui from '../ui/ui.module.css';
import styles from './Aftermath.module.css';
import type { AftermathView } from './view.ts';

export interface UpkeepActs {
  ctx: core.Ctx;
  edit: (action: (ctx: core.Ctx) => core.WarbandState, text?: string, opts?: { gold?: 'settle' | 'keep' }) => void;
}

export function UpkeepSection({ a, acts }: { a: AftermathView; acts: UpkeepActs }) {
  const [free, setFree] = useState<string[]>([]);
  const due = core.upkeepDue(acts.ctx, a.round);
  if (due.length === 0) return null;
  const open = due.filter((l) => !l.paid);
  const favour = (acts.ctx.s.campaign?.perks ?? []).some((p) => p.id === 'favour' && !p.used);
  const total = open.reduce((n, l) => n + (free.includes(l.uid) ? 0 : l.gc), 0);
  const gold = core.goldCurrent(acts.ctx);
  const problem = open.length ? core.upkeepProblem(acts.ctx, a.round, open.map((l) => l.uid), { free }) : null;
  const pay = (uids: string[]) => acts.edit((c) => core.payUpkeep(c, a.round, uids, { free: free.filter((f) => uids.includes(f)) }), 'Upkeep paid.', { gold: 'keep' });
  const anyPaid = due.some((l) => l.paid);

  return (
    <section className={styles.scenario} aria-labelledby="am-upkeep">
      <h4 id="am-upkeep">Upkeep of Hired Swords and Dramatis Personae</h4>
      <p className={ui.muted}>After each battle he fights, the first included, his upkeep is paid if he is to stay. One you no longer need costs nothing.</p>
      <RulesTable caption="Upkeep due" head={['Name', 'Upkeep', 'Now']} rowHeads={false}
        rows={due.map((l) => [l.name, `${l.gc} gc${l.note ? ` – ${l.note}` : ''}`, l.paid ? '✓ paid' : 'due'])} />
      {open.map((l) => (
        <div key={l.uid} className={styles.allowance}>
          <span>{l.name}: {free.includes(l.uid) ? 0 : l.gc} gc</span>
          <span className={ui.row}>
            {favour && <label><input type="checkbox" checked={free.includes(l.uid)} onChange={(e) => setFree((f) => (e.target.checked ? [...f, l.uid] : f.filter((x) => x !== l.uid)))} /> Free (Returning a Favour)</label>}
            <button type="button" className={ui.buttonQuiet} onClick={() => pay([l.uid])}>Pay {l.name}</button>
            <button type="button" className={ui.buttonQuiet} onClick={() => acts.edit((c) => core.dismissUpkeep(c, a.round, l.uid), `${l.name} sent away.`, { gold: 'keep' })}>Dismiss {l.name}</button>
          </span>
        </div>
      ))}
      {open.length > 0 && (
        <>
          <p>To pay: <strong>{total} gc</strong> · gold in hand {gold} gc → {gold - total} gc.</p>
          {problem && <p className={styles.warn}>{problem}</p>}
          {open.length > 1 && <div className={ui.row}><button type="button" className={ui.button} onClick={() => pay(open.map((l) => l.uid))}>Pay all</button></div>}
        </>
      )}
      {anyPaid && <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => acts.edit((c) => core.undoUpkeep(c, a.round), 'Upkeep taken back.', { gold: 'keep' })}>Take the payments back</button></div>}
    </section>
  );
}
