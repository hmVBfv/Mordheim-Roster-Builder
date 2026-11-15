/* Two warbands side by side (plan P14): the latest value of every number, and the difference. */
import { useState } from 'react';
import type { WarbandStatistics } from '../campaign/api.ts';
import ui from '../ui/ui.module.css';
import { GROUPS, METRICS, fmt, latestOf } from './metrics.ts';
import styles from './Statistics.module.css';

export function Compare({ list }: { list: WarbandStatistics[] }) {
  const [a, setA] = useState(list[0]?.warbandId ?? '');
  const [b, setB] = useState(list[1]?.warbandId ?? list[0]?.warbandId ?? '');
  if (list.length < 2) return null;
  const pick = (value: string, set: (v: string) => void, label: string) => (
    <label className={ui.field}>
      <span>{label}</span>
      <select className={ui.input} value={value} onChange={(e) => set(e.target.value)}>
        {list.map((w) => <option key={w.warbandId} value={w.warbandId}>{w.name}</option>)}
      </select>
    </label>
  );
  const nameOf = (id: string) => list.find((w) => w.warbandId === id)?.name ?? '';
  return (
    <section className={styles.compare} aria-labelledby="st-compare">
      <h2 id="st-compare">Compare two warbands</h2>
      <div className={styles.pair}>{pick(a, setA, 'First')}{pick(b, setB, 'Second')}</div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption>Latest numbers of {nameOf(a)} and {nameOf(b)}</caption>
          <thead><tr><th scope="col">Number</th><th scope="col">First</th><th scope="col">Second</th><th scope="col">Diff.</th></tr></thead>
          <tbody>
            {GROUPS.flatMap((g) => METRICS.filter((m) => m.group === g).map((m) => {
              const latest = latestOf(list, m.key);
              const x = latest.get(a), y = latest.get(b);
              if (x === undefined && y === undefined) return null;
              const d = x !== undefined && y !== undefined ? x - y : undefined;
              return (
                <tr key={m.key}>
                  <th scope="row">{m.label}</th>
                  <td>{x === undefined ? '–' : fmt(x, m.unit)}</td>
                  <td>{y === undefined ? '–' : fmt(y, m.unit)}</td>
                  <td>{d === undefined ? '–' : `${d > 0 ? '+' : ''}${fmt(d, m.unit)}`}</td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
