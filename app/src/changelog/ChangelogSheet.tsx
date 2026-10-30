/* The changes of the updates as a sheet (wish #154): under More for what this version holds, and from the update notice for
   what the next one brings. */
import { useId } from 'react';
import ui from '../ui/ui.module.css';
import type { useSheet } from '../ui/useSheet.ts';
import styles from './Changelog.module.css';
import type { Entry } from './parse.ts';

type Sheet = ReturnType<typeof useSheet>;

/** One heading for each day, however many files it has (entries come newest first). */
function days(entries: Entry[]): { date: string; changes: Entry['changes'] }[] {
  const out: { date: string; changes: Entry['changes'] }[] = [];
  for (const e of entries) {
    const last = out[out.length - 1];
    if (last?.date === e.date) last.changes.push(...e.changes); else out.push({ date: e.date, changes: [...e.changes] });
  }
  return out;
}

export function ChangelogSheet({ dialogRef, close, title, entries }: { dialogRef: Sheet['ref']; close: Sheet['close']; title: string; entries: Entry[] }) {
  const id = useId();
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby={id}>
      <div className={ui.page}>
        <h2 id={id}>{title}</h2>
        {entries.length === 0 && <p className={ui.muted}>Nothing listed yet.</p>}
        {days(entries).map((d) => (
          <section key={d.date} className={styles.entry}>
            <h3><time dateTime={d.date}>{new Date(`${d.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</time></h3>
            <ul>
              {d.changes.map((c, i) => <li key={i}><b className={styles[c.kind.toLowerCase()]}>{c.kind}:</b> {c.text}</li>)}
            </ul>
          </section>
        ))}
        <div className={ui.actions}><button type="button" className={ui.buttonQuiet} onClick={() => close()}>Close</button></div>
      </div>
    </dialog>
  );
}
