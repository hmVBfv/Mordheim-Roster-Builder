/* All warbands over the marks in one chart (plan P14): one line for each, colours from a validated categorical palette in a fixed order (a warband
   keeps its colour whether the others are shown or not), a legend that switches lines on and off, the first four directly labelled, a crosshair
   with a tooltip (pointer or keyboard), and the numbers in a table for whoever does not read a picture. Drawn as SVG without a library (ADR 0021). */
import { useId, useMemo, useState } from 'react';
import ui from '../ui/ui.module.css';
import styles from './Statistics.module.css';
import { fmt, niceScale, type MetricDef, type Series } from './metrics.ts';

const W = 480, H = 300, L = 40, R = 92, T = 14, B = 30;
export const MAX_COLOURS = 8;

export function LineChart({ metric, series, hidden, onToggle }: { metric: MetricDef; series: Series[]; hidden: Set<string>; onToggle: (id: string) => void }) {
  const id = useId();
  const [at, setAt] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  // colour by the warband's place in the whole list, never by what is shown: switching a line off does not repaint the others
  const colour = (i: number) => (i < MAX_COLOURS ? `var(--series-${i + 1})` : 'var(--text-muted)');
  const shown = series.filter((s) => !hidden.has(s.warbandId));
  const rounds = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.round)))].sort((a, b) => a - b), [series]);
  const scale = useMemo(() => niceScale(shown.flatMap((s) => s.points.map((p) => p.value))), [shown]);
  const x = (round: number) => (rounds.length <= 1 ? (L + W - R) / 2 : L + (rounds.indexOf(round) * (W - L - R)) / (rounds.length - 1));
  const y = (v: number) => T + ((scale.max - v) * (H - T - B)) / (scale.max - scale.min || 1);
  const roundAt = at == null ? null : rounds[Math.max(0, Math.min(rounds.length - 1, at))];
  const move = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * W;
    let best = 0;
    rounds.forEach((rd, i) => { if (Math.abs(x(rd) - px) < Math.abs(x(rounds[best]!) - px)) best = i; });
    setAt(best);
  };
  const label = (rd: number) => (rd === 0 ? 'Start' : `R${rd}`);
  const summary = `${metric.label} of ${shown.length} warband${shown.length === 1 ? '' : 's'} over the marks. ${shown.map((s) => `${s.name}: ${s.points.map((p) => `${p.label} ${fmt(p.value, metric.unit)}`).join(', ')}`).join('. ')}.`;
  // the first four lines carry their name at their last point, nudged apart where they end close together
  const ends = shown.slice(0, 4).map((s) => ({ s, y: y(s.points.at(-1)!.value) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i]!.y - ends[i - 1]!.y < 16) ends[i]!.y = ends[i - 1]!.y + 16;

  return (
    <figure className={styles.chart} aria-labelledby={`${id}-t`}>
      <figcaption id={`${id}-t`} className={styles.title}>{metric.label}{metric.unit ? <span className={styles.muted}> ({metric.unit})</span> : null}</figcaption>
      <p className={styles.muted}>{metric.about}</p>
      <ul className={styles.legend} aria-label="Warbands">
        {series.map((s, i) => (
          <li key={s.warbandId}>
            <button type="button" className={styles.legendButton} aria-pressed={!hidden.has(s.warbandId)} onClick={() => onToggle(s.warbandId)}>
              <span className={styles.swatch} style={{ background: colour(i), opacity: hidden.has(s.warbandId) ? 0.3 : 1 }} aria-hidden="true" />
              <span className={hidden.has(s.warbandId) ? styles.off : undefined}>{s.name}{s.active ? '' : ' (left)'}</span>
            </button>
          </li>
        ))}
      </ul>
      {series.length > MAX_COLOURS && <p className={styles.muted}>Eight lines have their own colour; the others are grey. Switch some off to compare the rest.</p>}
      {shown.length === 0 ? <p className={ui.muted}>All lines are switched off.</p> : (
        <div className={styles.plot}>
          <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={summary} tabIndex={0}
            onPointerMove={(e) => move(e.clientX, e.currentTarget)} onPointerLeave={() => setAt(null)} onBlur={() => setAt(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') { e.preventDefault(); setAt((a) => Math.min(rounds.length - 1, (a ?? -1) + 1)); }
              else if (e.key === 'ArrowLeft') { e.preventDefault(); setAt((a) => Math.max(0, (a ?? rounds.length) - 1)); }
              else if (e.key === 'Escape') setAt(null);
            }}>
            {scale.ticks.map((v) => (
              <g key={v}>
                <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={v === 0 ? styles.base : styles.grid} />
                <text x={L - 6} y={y(v) + 4} textAnchor="end" className={styles.tick}>{v}</text>
              </g>
            ))}
            {rounds.map((rd) => <text key={rd} x={x(rd)} y={H - 8} textAnchor="middle" className={styles.tick}>{label(rd)}</text>)}
            {shown.map((s) => {
              const i = series.indexOf(s);
              return (
                <g key={s.warbandId}>
                  <polyline points={s.points.map((p) => `${x(p.round)},${y(p.value)}`).join(' ')} fill="none" stroke={colour(i)} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                  {s.points.map((p) => <circle key={p.round + p.label} cx={x(p.round)} cy={y(p.value)} r={4} fill={colour(i)} className={styles.ring} />)}
                </g>
              );
            })}
            {ends.map(({ s, y: ly }) => <text key={s.warbandId} x={W - R + 8} y={ly + 4} className={styles.direct}>{s.name.length > 12 ? `${s.name.slice(0, 11)}…` : s.name}</text>)}
            {roundAt != null && <line x1={x(roundAt)} x2={x(roundAt)} y1={T} y2={H - B} className={styles.cross} />}
            {roundAt != null && shown.map((s) => { const p = s.points.find((q) => q.round === roundAt); return p ? <circle key={s.warbandId} cx={x(roundAt)} cy={y(p.value)} r={6} fill="none" stroke={colour(series.indexOf(s))} strokeWidth={2} /> : null; })}
          </svg>
          {roundAt != null && (
            <div className={styles.tip} role="status" style={{ left: `${Math.min(70, (x(roundAt) / W) * 100)}%` }}>
              <strong>{roundAt === 0 ? 'Start' : `Round ${roundAt}`}</strong>
              {shown.map((s) => { const p = s.points.find((q) => q.round === roundAt); return p ? <div key={s.warbandId}><span className={styles.swatch} style={{ background: colour(series.indexOf(s)) }} aria-hidden="true" /> {s.name}: {fmt(p.value, metric.unit)}</div> : null; })}
            </div>
          )}
        </div>
      )}
      <div className={ui.row}>
        <button type="button" className={ui.buttonQuiet} aria-expanded={table} onClick={() => setTable((v) => !v)}>{table ? 'Hide the numbers' : 'The numbers'}</button>
      </div>
      {table && (
        <div className={styles.scroll} tabIndex={0} role="region" aria-label={`${metric.label}: the numbers`}>
          <table className={styles.table}>
            <thead><tr><th scope="col">Warband</th>{rounds.map((rd) => <th key={rd} scope="col">{label(rd)}</th>)}</tr></thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.warbandId}>
                  <th scope="row">{s.name}</th>
                  {rounds.map((rd) => { const p = s.points.find((q) => q.round === rd); return <td key={rd}>{p ? fmt(p.value, '') : '–'}</td>; })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
