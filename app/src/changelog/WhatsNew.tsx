/* "What's new" where it is seen (wish #155): a button in the header beside "Bug", a card on Home, and the one under More –
   each opens the same sheet with the changes of every update. */
import type { ReactNode } from 'react';
import { SparkIcon } from '../ui/icons.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { ChangelogSheet } from './ChangelogSheet.tsx';
import { ENTRIES } from './entries.ts';
import styles from './Changelog.module.css';

/** The newest day's changes: what the card on Home shows. */
export function newestChanges(max = 3) {
  const day = ENTRIES[0]?.date;
  return ENTRIES.filter((e) => e.date === day).flatMap((e) => e.changes).slice(0, max);
}

function WithSheet({ children }: { children: (open: () => void) => ReactNode }) {
  const { ref, open, close } = useSheet('changelog');
  return (
    <>
      {children(open)}
      <ChangelogSheet dialogRef={ref} close={close} title="What's new" entries={ENTRIES} />
    </>
  );
}

/** In the header, beside the report button. */
export function WhatsNewHeaderButton() {
  return (
    <WithSheet>
      {(open) => <button type="button" className={styles.headerButton} onClick={open} aria-label="What's new" title="What's new"><SparkIcon /><span aria-hidden="true">New</span></button>}
    </WithSheet>
  );
}

/** A card on Home: the newest changes, and the way to all of them. */
export function WhatsNewCard() {
  const changes = newestChanges();
  if (!changes.length) return null;
  return (
    <WithSheet>
      {(open) => (
        <section className={ui.card} aria-labelledby="whats-new-card">
          <h2 id="whats-new-card">What's new</h2>
          <ul className={styles.cardList}>
            {changes.map((c, i) => <li key={i}><b className={styles[c.kind.toLowerCase()]}>{c.kind}:</b> {c.text}</li>)}
          </ul>
          <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={open}>All changes</button></div>
        </section>
      )}
    </WithSheet>
  );
}

/** Under More. */
export function WhatsNewButton() {
  return <WithSheet>{(open) => <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={open}>What's new</button></div>}</WithSheet>;
}
