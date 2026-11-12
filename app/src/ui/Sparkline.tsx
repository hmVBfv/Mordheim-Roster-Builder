/* A small line over a few points, drawn as SVG without a library (budget: ADR 0021). One series, so no legend: the title names it, the last value
   is labelled directly, every point has its tooltip, and the numbers are in a table behind "The numbers" for anybody who does not read a picture.
   Marks as docs/ui.md asks: a 2 px line, points of 8 px with a ring in the surface colour, a recessive baseline, text in text colours. */
import { useId } from 'react';
import styles from './Sparkline.module.css';
import ui from './ui.module.css';

export interface SparkPoint { /** what the point stands for ("After battle 2") */ label: string; value: number }

const W = 320, H = 96, PAD_X = 16, PAD_TOP = 14, PAD_BOTTOM = 14;

/** The pixel place of each point: spread evenly from left to right, the lowest value at the bottom and the highest at the top (all equal: in the middle). */
export function sparkGeometry(values: number[]): { x: number; y: number }[] {
  if (!values.length) return [];
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo;
  return values.map((v, i) => ({
    x: values.length === 1 ? W / 2 : PAD_X + (i * (W - 2 * PAD_X)) / (values.length - 1),
    y: span === 0 ? H / 2 : PAD_TOP + ((hi - v) * (H - PAD_TOP - PAD_BOTTOM)) / span,
  }));
}

export function Sparkline({ title, unit, points }: { title: string; unit: string; points: SparkPoint[] }) {
  const id = useId();
  if (points.length < 2) return null;
  const g = sparkGeometry(points.map((p) => p.value));
  const last = points.at(-1)!;
  const first = points[0]!;
  const change = last.value - first.value;
  const summary = `${title}: ${points.map((p) => `${p.label} ${p.value}`).join(', ')}.`;
  return (
    <figure className={styles.figure} aria-labelledby={`${id}-t`}>
      <figcaption id={`${id}-t`} className={styles.title}>
        {title} <span className={styles.muted}>{first.value} → {last.value} {unit}{change === 0 ? '' : ` (${change > 0 ? '+' : '−'}${Math.abs(change)})`}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={summary}>
        <line x1={PAD_X} x2={W - PAD_X} y1={H - PAD_BOTTOM + 6} y2={H - PAD_BOTTOM + 6} className={styles.base} />
        <polyline points={g.map((p) => `${p.x},${p.y}`).join(' ')} className={styles.line} />
        {g.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} className={styles.dot}><title>{`${points[i]!.label}: ${points[i]!.value} ${unit}`}</title></circle>
        ))}
        <text x={Math.min(W - 2, g.at(-1)!.x)} y={Math.max(10, g.at(-1)!.y - 9)} textAnchor="end" className={styles.value}>{last.value}</text>
      </svg>
      <details className={styles.table}>
        <summary className={ui.fold}>The numbers</summary>
        <table>
          <thead><tr><th scope="col">When</th><th scope="col" className={styles.num}>{unit}</th></tr></thead>
          <tbody>{points.map((p, i) => <tr key={i}><th scope="row">{p.label}</th><td className={styles.num}>{p.value}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}
