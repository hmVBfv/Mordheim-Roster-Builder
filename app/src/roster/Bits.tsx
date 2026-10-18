/* The small pieces the list and the detail share: the experience bar (one
   segment per step of the track), the profile strip and the chips. */
import type { CSSProperties } from 'react';
import type { Chip, StatCell, XpView } from './view.ts';
import styles from './Board.module.css';

/** How far he is on the way from the step he last reached to the next one, in percent. */
export function progress(xp: XpView): number {
  if (xp.next == null) return 100;
  const last = xp.steps.reduce((m, s) => (s.at <= xp.value && s.at > m ? s.at : m), 0);
  return Math.max(0, Math.min(100, Math.round((100 * (xp.value - last)) / (xp.next - last))));
}

/** Where the experience stands, in words: the next step and what waits to be taken. */
export function xpNote(xp: XpView): string {
  const next = xp.next != null ? `next advance at ${xp.next}` : 'all steps reached';
  return `${next}${xp.owed > 0 ? `, ${xp.owed} advance${xp.owed > 1 ? 's' : ''} waiting` : ''}`;
}

/** For a screen reader, on the bar. */
export const xpWords = (xp: XpView): string => `Experience ${xp.value}, ${xpNote(xp)}`;

/* One segment per step: below the starting experience dashed, reached filled
   (the ones whose advance is still to be taken in gold), the next one filling
   as the experience grows. */
export function XpBar({ xp }: { xp: XpView }) {
  const reached = xp.steps.filter((s) => s.state === 'on').length;
  let seen = 0;
  const p = progress(xp);
  return (
    <span className={styles.xpBar} style={{ '--steps': xp.steps.length } as CSSProperties} role="img" aria-label={xpWords(xp)}>
      {xp.steps.map((s) => {
        if (s.state === 'on') seen++;
        const due = s.state === 'on' && seen > reached - xp.owed;
        const cls = s.state === 'next' ? styles.next : due ? styles.due : s.state === 'on' ? styles.on : s.state === 'base' ? styles.base : undefined;
        return <i key={s.at} className={cls} style={s.state === 'next' ? { '--p': `${p}%` } as CSSProperties : undefined} />;
      })}
    </span>
  );
}

/** Experience in words beside the bar: "Exp 26 / 28", or that an advance waits. */
export function XpLabel({ xp, ready }: { xp: XpView; ready: boolean }) {
  if (ready) return <span className={styles.ready}>◆ Advance ready</span>;
  return <span>Exp <b>{xp.value}</b>{xp.next != null ? ` / ${xp.next}` : ''}</span>;
}

/** All nine values of the profile (and the save) in one line. */
export function Strip({ cells, save }: { cells: StatCell[]; save: string | null }) {
  const all = save != null ? [...cells, { key: 'Sv', value: save, changed: false }] : cells;
  return (
    <span className={styles.strip} style={{ '--n': all.length } as CSSProperties} role="img" aria-label={all.map((c) => `${c.key} ${c.value}`).join(', ')}>
      {all.map((c) => (
        <span key={c.key} aria-hidden="true" className={c.changed ? styles.changed : undefined}>{c.value}<small>{c.key}</small></span>
      ))}
    </span>
  );
}

export function ChipView({ chip }: { chip: Chip }) {
  return <span className={`${styles.chip} ${chip.tone === 'gold' ? styles.gold : chip.tone === 'danger' ? styles.danger : ''}`}>{chip.label}</span>;
}

