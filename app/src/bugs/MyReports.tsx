/* "Your reports", a tab of Account: what the reporter sent and where it stands,
   as a table. The reporter reads their words and the status – never the
   severity or the technical details. Needs the connection; offline it says so. */
import { useEffect, useState } from 'react';
import { errorText } from '../account/api.ts';
import { AccountTabs } from '../account/AccountTabs.tsx';
import { useSession } from '../account/session.ts';
import { Link } from 'react-router';
import accountStyles from '../account/Account.module.css';
import { accountLabel } from '../app/nav.ts';
import { stamp } from '../account/time.ts';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { shownVersion } from '../version.ts';
import { KIND_NAMES, myReports, onReportSent, type MyBug } from './api.ts';
import styles from './Bugs.module.css';
import { Words } from './Words.tsx';

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

/** The reporter's own reports; a report sent from the sheet appears here at once. */
function useMyReports(me: string | null): { bugs: MyBug[] | null; error: string | null } {
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
    const off = onReportSent(load);
    return () => { live = false; off(); };
  }, [me]);
  return { bugs, error };
}

export function MyReports() {
  const session = useSession();
  const me = session.status === 'in' ? session.user.id : null;
  const { bugs, error } = useMyReports(me);
  const { ref, open, close } = useSheet('my-report');
  const [chosen, setChosen] = useState<MyBug | null>(null);
  const show = (b: MyBug) => { setChosen(b); open(); };
  return (
    <section className={ui.page}>
      <h1>{accountLabel()}</h1>
      {me && <AccountTabs />}
      {!me && session.status !== 'loading' && <p>Sign in to see your reports. <Link to="/sign-in">Sign in</Link></p>}
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {me && bugs && bugs.length === 0 && !error && <p className={ui.muted}>You have not sent a report yet. The Bug button at the top of every screen opens the form.</p>}
      {me && bugs && bugs.length > 0 && (
        <div className={accountStyles.tableWrap}>
          <table className={accountStyles.table} aria-label="Your reports">
            <thead>
              <tr><th scope="col">#</th><th scope="col">Report</th><th scope="col">Kind</th><th scope="col">Status</th><th scope="col">Sent</th><th scope="col">Last change</th><th scope="col"><span className="visually-hidden">Open</span></th></tr>
            </thead>
            <tbody>
              {bugs.map((b) => (
                <tr key={b.id}>
                  <td data-label="#">{b.number}</td>
                  <td data-label="Report"><strong>{b.headline || b.title}</strong></td>
                  <td data-label="Kind">{KIND_NAMES[b.kind]}</td>
                  <td data-label="Status"><span className={b.status === 'fixed' ? styles.good : undefined}>{statusWords(b)}</span></td>
                  <td data-label="Sent"><time dateTime={b.createdAt}>{stamp(b.createdAt)}</time></td>
                  <td data-label="Last change"><time dateTime={b.updatedAt}>{stamp(b.updatedAt)}</time></td>
                  <td data-label=""><button type="button" className={ui.buttonQuiet} onClick={() => show(b)} aria-label={`Open: ${b.headline || b.title}`}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <dialog ref={ref} className={ui.sheet} aria-labelledby="my-report-title">
        {chosen && (
          <div className={ui.page}>
            <h2 id="my-report-title">{chosen.headline || chosen.title}</h2>
            <div className={styles.flags}>
              <span className={styles.flag}>{KIND_NAMES[chosen.kind]}</span>
              <span className={`${styles.flag} ${chosen.status === 'fixed' ? styles.good : ''}`}>{statusWords(chosen)}</span>
            </div>
            <Words text={chosen.text} fold={false} />
            {/^https:\/\//i.test(chosen.sourceRef) && <p><a href={chosen.sourceRef} target="_blank" rel="noopener noreferrer">{chosen.sourceRef}</a></p>}
            <small className={ui.muted}>#{chosen.number} · sent <time dateTime={chosen.createdAt}>{stamp(chosen.createdAt)}</time> · last change <time dateTime={chosen.updatedAt}>{stamp(chosen.updatedAt)}</time></small>
            <div className={ui.actions}><button type="button" className={ui.buttonQuiet} onClick={() => close()}>Close</button></div>
          </div>
        )}
      </dialog>
    </section>
  );
}
