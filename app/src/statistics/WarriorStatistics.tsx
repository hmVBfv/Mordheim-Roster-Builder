/* The warriors of one warband (plan P14, stage 4): the experience of each over the marks, one line a warrior, and the dead counted by unit. Mechanics
   only, open to every member (ADR 0002). */
import { useMemo, useState } from 'react';
import type { WarbandWarriors } from '../campaign/api.ts';
import ui from '../ui/ui.module.css';
import { LineChart } from './LineChart.tsx';
import { markLabel, type MetricDef, type Series } from './metrics.ts';
import styles from './Statistics.module.css';
import { useWarriors } from './useWarriors.ts';

const EXP: MetricDef = { key: 'warriorExp', label: 'Experience of each warrior', group: 'Experience', unit: '', about: 'Heroes by name; a group of henchmen earns its experience together, so it is one line.' };

/** One line for each roster entry that was ever at a mark of the warband; a mark it was not on is left out. */
export function warriorSeries(w: WarbandWarriors): Series[] {
  const marks = [...w.points].sort((a, b) => a.round - b.round || a.at.localeCompare(b.at));
  const by = new Map<number, Series>();
  for (const m of marks) {
    for (const x of m.warriors) {
      const s = by.get(x.uid) ?? { warbandId: String(x.uid), name: x.label, active: true, points: [] };
      s.points.push({ round: m.round, label: markLabel(m.kind, m.round), value: x.exp });
      by.set(x.uid, s);
    }
  }
  return [...by.values()];
}

export function WarriorStatistics({ id }: { id: string }) {
  const { list, loaded } = useWarriors(id);
  const [wid, setWid] = useState('');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const w = list.find((x) => x.warbandId === wid) ?? list[0];
  const series = useMemo(() => (w ? warriorSeries(w) : []), [w]);
  if (!loaded || !w) return null;
  const fallen = [...w.points].sort((a, b) => a.round - b.round || a.at.localeCompare(b.at)).at(-1)?.fallen ?? [];
  const toggle = (u: string) => setHidden((h) => { const n = new Set(h); if (n.has(u)) n.delete(u); else n.add(u); return n; });
  return (
    <section className={styles.compare} aria-labelledby="st-warriors">
      <h2 id="st-warriors">Warriors</h2>
      <label className={ui.field}>
        <span>Warband</span>
        <select className={ui.input} value={w.warbandId} onChange={(e) => { setWid(e.target.value); setHidden(new Set()); }}>
          {list.map((x) => <option key={x.warbandId} value={x.warbandId}>{x.name}</option>)}
        </select>
      </label>
      {series.length === 0 ? <p className={ui.muted}>No warrior with experience to show yet.</p> : <LineChart metric={EXP} series={series} hidden={hidden} onToggle={toggle} />}
      <h3>Fallen by unit</h3>
      {fallen.length === 0
        ? <p className={ui.muted}>Nobody of {w.name} has fallen so far.</p>
        : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>Fallen of {w.name}, by unit</caption>
              <thead><tr><th scope="col">Unit</th><th scope="col">Fallen</th></tr></thead>
              <tbody>{fallen.map((f) => <tr key={f.unit}><th scope="row">{f.unit}</th><td>{f.count}</td></tr>)}</tbody>
            </table>
          </div>
        )}
    </section>
  );
}
