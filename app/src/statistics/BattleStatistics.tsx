/* The battles by warband (plan P14, stage 3): how each ended – a stacked bar with its numbers –, casualties dealt and taken, and who dealt the
   most. Only what the protocol and the outcomes say; open to every member (ADR 0002). */
import { useEffect, useState } from 'react';
import { readBattleStats, type BattleStats, type Killer } from '../campaign/api.ts';
import { useOnCampaign } from '../live/live.ts';
import ui from '../ui/ui.module.css';
import styles from './Statistics.module.css';

const OUTCOMES = [['victory', 'Victories', 'var(--series-1)'], ['draw', 'Draws', 'var(--text-muted)'], ['defeat', 'Defeats', 'var(--series-2)'], ['routed', 'Routed', 'var(--series-7)']] as const;

function useBattleStats(id: string): { warbands: BattleStats[]; killers: Killer[] } | null {
  const [got, setGot] = useState<{ id: string; warbands: BattleStats[]; killers: Killer[] } | null>(null);
  const load = () => { readBattleStats(id).then((r) => setGot({ id, ...r })).catch(() => undefined); };
  useEffect(load, [id]);
  useOnCampaign(id, load);
  return got && got.id === id ? got : null;
}

export function BattleStatistics({ id }: { id: string }) {
  const stats = useBattleStats(id);
  if (!stats || stats.warbands.length === 0) return stats ? <p className={ui.muted}>No battle is closed yet: the battles’ numbers come with the first.</p> : null;
  const most = Math.max(1, ...stats.warbands.map((w) => w.battles));
  const casualties = Math.max(1, ...stats.warbands.flatMap((w) => [w.inflicted, w.suffered]));
  return (
    <section className={`${styles.chart} ${styles.battles}`} aria-labelledby="stat-battles">
      <h2 id="stat-battles">Battles</h2>
      <ul className={styles.legend} aria-label="Outcomes">
        {OUTCOMES.map(([, label, colour]) => <li key={label} className={styles.legendItem}><span className={styles.swatch} style={{ background: colour }} aria-hidden="true" /> {label}</li>)}
      </ul>
      <ul className={styles.bars} aria-label="How the battles ended">
        {stats.warbands.map((w) => (
          <li key={w.warbandId}>
            <span className={styles.barName}>{w.name}{w.active ? '' : ' (left)'}</span>
            <span className={styles.bar} style={{ width: `${(w.battles / most) * 100}%` }} role="img"
              aria-label={`${w.name}: ${OUTCOMES.map(([k, label]) => `${w[k]} ${label.toLowerCase()}`).join(', ')} in ${w.battles} battle${w.battles === 1 ? '' : 's'}`}>
              {OUTCOMES.map(([k, , colour]) => (w[k] > 0 ? <span key={k} className={styles.seg} style={{ flex: w[k], background: colour }}>{w[k]}</span> : null))}
            </span>
          </li>
        ))}
      </ul>
      <h3>Casualties dealt and taken</h3>
      <ul className={styles.bars} aria-label="Casualties">
        {stats.warbands.map((w) => (
          <li key={w.warbandId}>
            <span className={styles.barName}>{w.name}</span>
            <span className={styles.pair}>
              <span className={styles.line} style={{ width: `${(w.inflicted / casualties) * 100}%`, background: 'var(--series-1)' }}>{w.inflicted}</span>
              <span className={styles.line} style={{ width: `${(w.suffered / casualties) * 100}%`, background: 'var(--series-2)' }}>{w.suffered}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className={styles.muted}><span className={styles.swatch} style={{ background: 'var(--series-1)' }} aria-hidden="true" /> dealt · <span className={styles.swatch} style={{ background: 'var(--series-2)' }} aria-hidden="true" /> taken</p>
      <div className={styles.scroll} tabIndex={0} role="region" aria-label="Battles: the numbers">
        <table className={styles.table}>
          <thead><tr><th scope="col">Warband</th><th scope="col">Battles</th><th scope="col">Won</th><th scope="col">Drawn</th><th scope="col">Lost</th><th scope="col">Routed</th><th scope="col">Dealt</th><th scope="col">Taken</th></tr></thead>
          <tbody>{stats.warbands.map((w) => <tr key={w.warbandId}><th scope="row">{w.name}</th><td>{w.battles}</td><td>{w.victory}</td><td>{w.draw}</td><td>{w.defeat}</td><td>{w.routed}</td><td>{w.inflicted}</td><td>{w.suffered}</td></tr>)}</tbody>
        </table>
      </div>
      {stats.killers.length > 0 && (
        <>
          <h3>Most casualties dealt</h3>
          <div className={styles.scroll} tabIndex={0} role="region" aria-label="Most casualties dealt">
            <table className={styles.table}>
              <thead><tr><th scope="col">Warrior</th><th scope="col">Warband</th><th scope="col">Put out of action</th></tr></thead>
              <tbody>{stats.killers.map((k) => <tr key={`${k.warbandId}:${k.name}`}><th scope="row">{k.name || '—'}</th><td>{k.warband}</td><td>{k.count}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
