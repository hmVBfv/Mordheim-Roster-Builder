/* The warband's own functions as a visible list (docs/ui.md §3): each a row
   with what it holds underneath, not a menu to open first. */
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import styles from './Board.module.css';

export function Panel({ children, foot }: { children: ReactNode; foot?: ReactNode }) {
  return (
    <section className={styles.panel} aria-labelledby="warband-panel">
      <h2 id="warband-panel">Warband</h2>
      <div className={styles.panelCols}>{children}</div>
      {foot && <div className={styles.panelFoot}>{foot}</div>}
    </section>
  );
}

/** A way to another screen (`to`) or a thing to do (`run`), with a line saying what it holds. */
export function PanelLink({ title, note, to, run }: { title: string; note?: string; to?: string; run?: () => void }) {
  const noteId = useId();
  // the name is the title; what it holds is its description
  const body = (
    <>
      <span>{title}{note && <small id={noteId}>{note}</small>}</span>
      <span aria-hidden="true">›</span>
    </>
  );
  const named = { 'aria-label': title, 'aria-describedby': note ? noteId : undefined, className: styles.rowLink };
  return to
    ? <Link to={to} {...named}>{body}</Link>
    : <button type="button" onClick={run} {...named}>{body}</button>;
}
