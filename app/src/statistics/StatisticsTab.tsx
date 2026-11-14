/* The Statistics tab of a campaign (plan P14): pick a number, see all warbands over the marks in one chart, a small line for each below, and the
   numbers behind it. Mechanics only, open to every member (ADR 0002). */
import { useMemo, useState } from 'react';
import { Sparkline } from '../ui/Sparkline.tsx';
import ui from '../ui/ui.module.css';
import { BattleStatistics } from './BattleStatistics.tsx';
import { LineChart } from './LineChart.tsx';
import { GROUPS, METRICS, fmt, metricOf, seriesOf } from './metrics.ts';
import styles from './Statistics.module.css';
import { useStatistics } from './useStatistics.ts';

export function StatisticsTab({ id }: { id: string }) {
  const { list, loaded } = useStatistics(id);
  const [key, setKey] = useState('rating');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const metric = metricOf(key);
  const series = useMemo(() => seriesOf(list, key), [list, key]);
  const toggle = (w: string) => setHidden((h) => { const n = new Set(h); if (n.has(w)) n.delete(w); else n.add(w); return n; });

  if (!loaded) return <p className={ui.muted}>Loading the numbers…</p>;
  if (list.length === 0) return <p className={ui.muted}>No warband has a mark yet. The numbers start with the first confirmed warband.</p>;
  return (
    <div className={styles.controls}>
      <label className={ui.field}>
        <span>Show</span>
        <select className={ui.input} value={key} onChange={(e) => setKey(e.target.value)}>
          {GROUPS.map((g) => <optgroup key={g} label={g}>{METRICS.filter((m) => m.group === g).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</optgroup>)}
        </select>
      </label>
      {series.length === 0
        ? <p className={ui.muted}>None of the marks carries this number yet.</p>
        : <LineChart metric={metric} series={series} hidden={hidden} onToggle={toggle} />}
      <div className={styles.multiples} aria-label="One line for each warband">
        {series.filter((s) => !hidden.has(s.warbandId) && s.points.length > 1).map((s) => (
          <Sparkline key={s.warbandId} title={s.name} unit={metric.unit} points={s.points.map((p) => ({ label: p.label, value: p.value }))} />
        ))}
      </div>
      <BattleStatistics id={id} />
      <p className={ui.muted}>Each number is as it stood at a mark: the start, after each battle, a round sat out. Latest: {series.map((s) => `${s.name} ${fmt(s.points.at(-1)!.value, metric.unit)}`).join(' · ')}.</p>
    </div>
  );
}
