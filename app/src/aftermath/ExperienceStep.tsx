/* Step 2, experience (N4): the battle's points for each warrior in one table – survived, leader, kills, the underdog bonus, the scenario's
   points – read before anything is granted; one button grants and writes them onto the roster. The underdog bonus is suggested from the
   ratings frozen for the battle and can be changed; the scenario's points are typed per warrior, with a reason. */
import * as core from '@mordheim/core';
import type { GameData } from '@mordheim/core';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { RulesTable } from '../ui/RulesTable.tsx';
import ui from '../ui/ui.module.css';
import styles from './Aftermath.module.css';
import { experienceTables } from './tables.ts';
import type { UnderdogView } from './underdog.ts';
import { grantBattleXp, type AftermathView } from './view.ts';

export interface ExperienceActs {
  ctx: core.Ctx;
  edit: (action: (ctx: core.Ctx) => core.WarbandState, text?: string, opts?: { gold?: 'settle' | 'keep' }) => void;
}

const num = (v: string): number => Math.max(0, Math.min(9, Math.floor(Number(v) || 0)));

export function ExperienceStep({ a, data, acts, underdog, rosterLink }: { a: AftermathView; data: GameData; acts: ExperienceActs; underdog: UnderdogView | null; rosterLink: string }) {
  const suggested = underdog?.bonus ?? 0;
  const [bonus, setBonus] = useState<string>(String(suggested));
  const [reason, setReason] = useState('');
  const [points, setPoints] = useState<Record<number, string>>({});
  const [all, setAll] = useState('1');
  const tables = useMemo(() => experienceTables(data), [data]);

  const scenario = Object.entries(points).map(([uid, v]) => ({ uid: Number(uid), amount: num(v), reason: reason.trim() })).filter((x) => x.amount > 0);
  const opts: core.BattleXpOptions = { underdog: num(bonus), scenario: reason.trim() ? scenario : [] };
  const plan = core.battleXpPlan(acts.ctx, a.local.id, opts);
  const missingReason = scenario.length > 0 && !reason.trim();
  const eligible = plan.filter((r) => !r.sitsOut && !r.dead);
  const grant = () => acts.edit((c) => {
    const s = grantBattleXp(data, c, a.local.id, opts);
    return core.applyBattleResults(core.ctxOf(data, s));
  }, 'The battle’s experience is written onto the roster.', { gold: 'keep' });

  return (
    <>
      <p>
        +1 to every Hero and Henchman group that survived, +1 to the leader of the winning warband, +1 to a Hero for every enemy he put out of action, and the underdog bonus to
        everyone who fought. A scenario may give more: enter its points below.
      </p>
      {a.xpAwarded
        ? (
          <>
            <p><strong>✓ Battle experience granted.</strong>{a.xpRecord && (a.xpRecord.underdog > 0 || a.xpRecord.scenario.length > 0) ? ` Underdog bonus +${a.xpRecord.underdog}${a.xpRecord.scenario.length ? `, ${a.xpRecord.scenario.length} scenario point${a.xpRecord.scenario.length === 1 ? '' : 's'}` : ''}.` : ''}</p>
            {a.pendingXp.length > 0 && (
              <ul className={styles.plain} aria-label="Experience held">
                {a.pendingXp.map((x) => <li key={x.id}>{x.name} +{x.amount} <small className={ui.muted}>{x.reason}</small></li>)}
              </ul>
            )}
            {(a.pendingXp.length > 0 || a.deathsToApply > 0) && (
              <div className={ui.row}>
                <button type="button" className={ui.button} onClick={() => acts.edit((c) => core.applyBattleResults(c), 'Written onto the roster.', { gold: 'keep' })}>Write it onto the roster</button>
              </div>
            )}
          </>
        )
        : (
          <>
            {underdog && (
              <div className={styles.underdog}>
                <label className={ui.field}>
                  <span>Underdog bonus (per fighter)</span>
                  <input type="number" inputMode="numeric" min={0} max={5} className={ui.input} value={bonus} onChange={(e) => setBonus(e.target.value)} />
                </label>
                {underdog.rows.length > 0 && (
                  <RulesTable caption="Compared with each opponent" head={['Opponent', 'Rating', 'Gap', 'Bonus']} rowHeads={false}
                    rows={underdog.rows.map((r) => [r.name, r.rating == null ? '–' : String(r.rating), r.gap == null ? '–' : (r.gap > 0 ? `+${r.gap}` : String(r.gap)), r.bonus ? `+${r.bonus}` : 'None'])}
                    row={underdog.decides} note={underdog.own == null ? 'Your rating before the battle was not frozen: type the bonus.' : `Your rating: ${underdog.own}. The largest gap to a higher-rated opponent counts.`} />
                )}
                {underdog.incomplete && <p className={styles.warn}>A rating is missing, so the bonus is not worked out. Check the table and type it.</p>}
              </div>
            )}
            <details className={styles.tables}>
              <summary className={ui.fold}>Underdog table</summary>
              <RulesTable caption={tables.underdog.title} head={tables.underdog.head} rows={tables.underdog.rows} rowHeads={false} note={tables.underdog.note} link={tables.underdog.link} />
            </details>
            <fieldset className={styles.scenario}>
              <legend>Scenario points</legend>
              <label className={ui.field}>
                <span>What for</span>
                <input type="text" className={ui.input} value={reason} maxLength={80} placeholder="e.g. carried the wyrdstone off" onChange={(e) => setReason(e.target.value)} />
              </label>
              <div className={styles.stepper}>
                <span>For all who fought</span>
                <input type="number" inputMode="numeric" min={0} max={9} className={ui.input} aria-label="Scenario points for everyone" value={all} onChange={(e) => setAll(e.target.value)} />
                <button type="button" className={ui.buttonQuiet} onClick={() => setPoints(Object.fromEntries(eligible.map((r) => [r.uid, String(num(all))])))}>Set for all</button>
              </div>
            </fieldset>
            <div className={styles.scroll} tabIndex={0} role="region" aria-label="Experience of the battle">
              <table className={styles.casualties}>
                <caption>Experience of the battle</caption>
                <thead>
                  <tr><th scope="col">Warrior</th><th scope="col" title="Survived">Surv.</th><th scope="col" title="Leader of the winner">Lead</th><th scope="col" title="Enemies put out of action">Kills</th><th scope="col">Under-dog</th><th scope="col">Scenario</th><th scope="col">Total</th><th scope="col">Exp</th></tr>
                </thead>
                <tbody>
                  {plan.map((r) => {
                    const m = acts.ctx.s.models.find((x) => x.uid === r.uid);
                    const exp = Number(m?.exp) || 0;
                    return (
                      <tr key={r.uid}>
                        <th scope="row">{r.name}{r.sitsOut ? <small>sits it out</small> : r.dead ? <small>slain</small> : null}</th>
                        <td>{r.survives}</td><td>{r.leader}</td><td>{r.kills}</td><td>{r.underdog}</td>
                        <td>
                          {r.sitsOut || r.dead ? '–' : <input type="number" inputMode="numeric" min={0} max={9} className={styles.cell} aria-label={`Scenario points for ${r.name}`} value={points[r.uid] ?? ''} placeholder="0" onChange={(e) => setPoints((p) => ({ ...p, [r.uid]: e.target.value }))} />}
                        </td>
                        <td><strong>{r.total}</strong></td>
                        <td>{exp} → {exp + r.total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {missingReason && <p className={styles.warn}>Say what the scenario points are for, or they are left out.</p>}
            <div className={ui.row}>
              <button type="button" className={ui.button} onClick={grant}>Grant and write onto the roster</button>
            </div>
          </>
        )}
      {a.advancesDue.length > 0 && (
        <>
          <p>Advance due: {a.advancesDue.join(', ')}.</p>
          <div className={ui.row}><Link to={rosterLink} className={ui.buttonQuiet}>Roll it on the roster</Link></div>
        </>
      )}
    </>
  );
}
