/* "Your reports" under More: what the reporter sent and where it stands. The
   reporter reads their words and the status – never the severity or the
   technical details. Needs the connection; offline it says so. */
import { useEffect, useState } from 'react';
import { errorText } from '../account/api.ts';
import { useSession } from '../account/session.ts';
import { ago } from '../account/time.ts';
import ui from '../ui/ui.module.css';
import { shownVersion } from '../version.ts';
import { KIND_NAMES, myReports, onReportSent, type MyBug } from './api.ts';
import styles from './Bugs.module.css';

/** The status in the reporter's words. */
export function statusWords(b: Pick<MyBug, 'status' | 'fixedIn'>): string {
  switch (b.status) {
    case 'new': return 'Received';
    case 'confirmed': return 'Confirmed';
    case 'in_progress': return 'Being worked on';
    case 'fixed': return `Fixed in ${shownVersion(b.fixedIn)}`;
    case 'closed': return 'Closed';
    case 'duplicate': return 'Same as another report';
  }
}

export function MyReports() {
  const session = useSession();
  const me = session.status === 'in' ? session.user.id : null;
  const [bugs, setBugs] = useState<MyBug[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!me) return;
    let live = true;
    const load = () => {
      myReports()
        .then((r) => { if (live) { setBugs(r); setError(null); } })
        .catch((e: unknown) => { if (live) setError(errorText(e)); });
    };
    load();
    // a report sent from the sheet appears here at once
    const off = onReportSent(load);
    return () => { live = false; off(); };
  }, [me]);
  if (!me) return null;
  if (error) return <section className={ui.card} aria-labelledby="reports-h"><h2 id="reports-h">Your reports</h2><p className={ui.muted}>{error}</p></section>;
  if (!bugs || bugs.length === 0) return null;
  return (
    <section className={ui.card} aria-labelledby="reports-h">
      <h2 id="reports-h">Your reports</h2>
      <ul className={styles.list}>
        {bugs.map((b) => (
          <li key={b.id} className={styles.item}>
            <strong>{b.title}</strong>
            <div className={styles.flags}>
              <span className={styles.flag}>{KIND_NAMES[b.kind]}</span>
              <span className={`${styles.flag} ${b.status === 'fixed' ? styles.good : ''}`}>{statusWords(b)}</span>
            </div>
            <small className={ui.muted}>Sent {ago(b.createdAt)}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
