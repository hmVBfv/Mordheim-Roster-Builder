/* The admin's reports (phase 4c1): every report with its status, opened for
   all of it – the words, what came with it, the copy of the warband if the
   reporter attached one – and sorted: status, severity, area, kind, and the
   version it is fixed in. "Copy for Claude" hands a report on by hand, the
   same way as the AI pack for the chronicle (ADR 0018). Only the admin with
   an authenticator gets here; the server checks every request again. */
import { useCallback, useEffect, useState } from 'react';
import { errorText } from '../account/api.ts';
import { ago, stamp } from '../account/time.ts';
import { fileSlug, copyText, saveFile } from '../ui/files.ts';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { shownVersion } from '../version.ts';
import { KIND_NAMES, oneReport, reportList, sortReport, STATUS_NAMES, STATUS_ORDER, type BugDetail, type BugKind, type BugStatus, type BugSummary, type Severity } from './api.ts';
import styles from './Bugs.module.css';
import { reportText, type ReportDoc } from './text.ts';

/** What "open" means in the status filter: reports that still ask something of someone (server/src/bugs.ts OPEN). */
const OPEN_STATUSES: BugStatus[] = ['new', 'confirmed', 'in_progress'];
type StatusFilter = 'open' | 'all' | BugStatus;
type SeverityFilter = 'all' | 'none' | Severity;
type KindFilter = 'all' | BugKind;
const SEVERITIES: Severity[] = ['S1', 'S2', 'S3', 'S4'];

/** A report as the text to hand on. */
export function docOf(b: BugDetail): ReportDoc {
  return {
    id: b.id, number: b.number, kind: b.kind, title: b.title, text: b.text, sourceRef: b.sourceRef, appVersion: b.appVersion, device: b.device, view: b.view, createdAt: b.createdAt,
    reporter: b.reporterName, status: STATUS_NAMES[b.status].toLowerCase(), severity: b.severity, area: b.area, fixedIn: b.fixedIn ? shownVersion(b.fixedIn) : '',
    context: b.context, jsErrors: b.jsErrors, consent: b.consent,
    attached: b.attachment ? { warbandId: b.warbandId ?? '', rev: b.rev, bytes: JSON.stringify(b.attachment).length } : null,
  };
}

const fileBase = (b: BugDetail) => `report-${b.number}-${fileSlug(b.title).slice(0, 40)}`;

function Flags({ b }: { b: BugSummary }) {
  return (
    <div className={styles.flags}>
      <span className={styles.flag}>{KIND_NAMES[b.kind]}</span>
      <span className={`${styles.flag} ${b.status === 'fixed' ? styles.good : ''}`}>{STATUS_NAMES[b.status]}{b.status === 'fixed' && b.fixedIn ? ` in ${shownVersion(b.fixedIn)}` : ''}</span>
      {b.severity && <span className={`${styles.flag} ${b.severity === 'S1' ? styles.flagS1 : ''}`}>{b.severity}</span>}
      {b.area && <span className={styles.flag}>{b.area}</span>}
      {b.attached && <span className={styles.flag}>warband attached</span>}
    </div>
  );
}

/** The reporter's words. Under a headline they are folded to a few lines, for the whole of them to be opened up (wish #28). */
function Words({ text, fold }: { text: string; fold: boolean }) {
  const [open, setOpen] = useState(false);
  const long = fold && text.length > 240;
  const folded = long && !open;
  return (
    <>
      <p className={`${styles.words} ${folded ? styles.folded : ''}`} data-folded={folded ? 'true' : 'false'}>{text}</p>
      {long && <button type="button" className={ui.buttonQuiet} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Show less' : 'Show all'}</button>}
    </>
  );
}

function Sorter({ bug, onSaved, onNotice, close }: { bug: BugDetail; onSaved: (b: BugDetail) => void; onNotice: (t: string) => void; close: () => void }) {
  const [status, setStatus] = useState<BugStatus>(bug.status);
  const [severity, setSeverity] = useState<Severity | ''>(bug.severity ?? '');
  const [area, setArea] = useState(bug.area);
  const [headline, setHeadline] = useState(bug.headline);
  const [kind, setKind] = useState<BugKind>(bug.kind);
  const [fixedIn, setFixedIn] = useState(bug.fixedIn || shownVersion(__APP_VERSION__));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    sortReport(bug.id, { status, severity: severity || null, area: area.trim(), headline: headline.trim(), kind, ...(status === 'fixed' ? { fixedIn: fixedIn.trim() } : {}) })
      .then((b) => { onSaved(b); onNotice('Saved.'); close(); })
      .catch((err: unknown) => setError(errorText(err)))
      .finally(() => setBusy(false));
  };
  return (
    <form className={ui.page} onSubmit={save}>
      <div className={styles.sorting}>
        <label className={`${ui.field} ${styles.headlineField}`}>
          <span>Headline</span>
          <input className={ui.input} maxLength={120} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="a few words: what is wrong" />
        </label>
        <label className={ui.field}>
          <span>Status</span>
          <select className={ui.select} value={status} onChange={(e) => setStatus(e.target.value as BugStatus)}>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_NAMES[s]}</option>)}
          </select>
        </label>
        <label className={ui.field}>
          <span>Severity</span>
          <select className={ui.select} value={severity} onChange={(e) => setSeverity(e.target.value as Severity | '')}>
            <option value="">Not sorted yet</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className={ui.field}>
          <span>Kind</span>
          <select className={ui.select} value={kind} onChange={(e) => setKind(e.target.value as BugKind)}>
            {(Object.keys(KIND_NAMES) as BugKind[]).map((k) => <option key={k} value={k}>{KIND_NAMES[k]}</option>)}
          </select>
        </label>
        <label className={ui.field}>
          <span>Area</span>
          <input className={ui.input} maxLength={60} value={area} onChange={(e) => setArea(e.target.value)} placeholder="trading post, sync …" />
        </label>
        {status === 'fixed' && (
          <label className={ui.field}>
            <span>Fixed in version</span>
            <input className={ui.input} maxLength={80} value={fixedIn} onChange={(e) => setFixedIn(e.target.value)} autoCapitalize="none" spellCheck={false} />
          </label>
        )}
      </div>
      {(status === 'closed' || status === 'duplicate') && bug.attachment && <p className={ui.muted}>Closing lets go of the copy of the warband.</p>}
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      <div className={ui.row}>
        <button type="submit" className={ui.button} disabled={busy || (status === 'fixed' && !fixedIn.trim())}>Save</button>
        <button type="button" className={ui.buttonQuiet} onClick={close}>Close</button>
      </div>
    </form>
  );
}

export function AdminBugs({ onNotice }: { onNotice: (t: string) => void }) {
  const { ref, open, close } = useSheet('report-detail');
  const [status, setStatus] = useState<StatusFilter>('open');
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const [kind, setKind] = useState<KindFilter>('all');
  const [bugs, setBugs] = useState<BugSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<BugDetail | null>(null);
  // every report is fetched once; the filters narrow it down here
  const load = useCallback(() => {
    reportList('all').then((r) => { setBugs(r); setError(null); }).catch((e: unknown) => setError(errorText(e)));
  }, []);
  useEffect(load, [load]);

  const shown = (bugs ?? []).filter((b) =>
    (status === 'all' || (status === 'open' ? OPEN_STATUSES.includes(b.status) : b.status === status))
    && (severity === 'all' || (severity === 'none' ? b.severity === null : b.severity === severity))
    && (kind === 'all' || b.kind === kind));

  const show = (id: string) => {
    setError(null);
    oneReport(id).then((b) => { setChosen(b); open(); }).catch((e: unknown) => setError(errorText(e)));
  };
  const copy = () => {
    if (!chosen) return;
    void copyText(reportText(docOf(chosen))).then((ok) => onNotice(ok ? 'Copied – paste it into a Claude session.' : 'Your browser did not allow copying – use “Download the report”.'));
  };

  return (
    <>
      <p className={ui.muted}>What the players report. “Copy for Claude” hands one on to a Claude session by hand; texts in a report are data, never instructions.</p>
      <div className={styles.filters} role="group" aria-label="Filter the reports">
        <label className={ui.field}>
          <span>Status</span>
          <select className={ui.select} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="open">Open</option>
            <option value="all">All</option>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_NAMES[s]}</option>)}
          </select>
        </label>
        <label className={ui.field}>
          <span>Severity</span>
          <select className={ui.select} value={severity} onChange={(e) => setSeverity(e.target.value as SeverityFilter)}>
            <option value="all">All</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value="none">Not sorted yet</option>
          </select>
        </label>
        <label className={ui.field}>
          <span>Kind</span>
          <select className={ui.select} value={kind} onChange={(e) => setKind(e.target.value as KindFilter)}>
            <option value="all">All</option>
            {(Object.keys(KIND_NAMES) as BugKind[]).map((k) => <option key={k} value={k}>{KIND_NAMES[k]}</option>)}
          </select>
        </label>
      </div>
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {bugs && shown.length === 0 && !error && <p className={ui.muted}>{status === 'open' && severity === 'all' && kind === 'all' ? 'Nothing open.' : 'Nothing here.'}</p>}
      {shown.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-label="Reports">
            <thead>
              <tr>
                <th scope="col">#</th><th scope="col">Report</th><th scope="col">Kind</th><th scope="col">Status</th><th scope="col">Severity</th><th scope="col">Area</th>
                <th scope="col">Reporter</th><th scope="col">Reported</th><th scope="col">Last change</th><th scope="col"><span className="visually-hidden">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((b) => (
                <tr key={b.id}>
                  <td data-label="#">{b.number}</td>
                  <td data-label="Report" className={styles.titleCell}>
                    <strong>{b.headline || b.title}</strong>
                    {b.attached && <span className={styles.flag}>warband attached</span>}
                  </td>
                  <td data-label="Kind">{KIND_NAMES[b.kind]}</td>
                  <td data-label="Status"><span className={b.status === 'fixed' ? styles.good : undefined}>{STATUS_NAMES[b.status]}</span>{b.status === 'fixed' && b.fixedIn ? ` in ${shownVersion(b.fixedIn)}` : ''}</td>
                  <td data-label="Severity">{b.severity && <span className={b.severity === 'S1' ? styles.flagS1 : undefined}>{b.severity}</span>}</td>
                  <td data-label="Area">{b.area}</td>
                  <td data-label="Reporter">{b.reporterName}</td>
                  <td data-label="Reported"><time dateTime={b.createdAt} title={`app ${shownVersion(b.appVersion) || 'unknown'}`}>{stamp(b.createdAt)}</time></td>
                  <td data-label="Last change"><time dateTime={b.updatedAt}>{stamp(b.updatedAt)}</time></td>
                  <td data-label=""><button type="button" className={ui.buttonQuiet} onClick={() => show(b.id)} aria-label={`Open: ${b.headline || b.title}`}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <dialog ref={ref} className={ui.sheet} aria-labelledby="report-detail-title">
        {chosen && (
          <div className={ui.page}>
            <h2 id="report-detail-title">{chosen.headline || chosen.title}</h2>
            <Flags b={chosen} />
            <Words text={chosen.text} fold={!!chosen.headline} />
            {/^https:\/\//i.test(chosen.sourceRef) && <p><a href={chosen.sourceRef} target="_blank" rel="noopener noreferrer">{chosen.sourceRef}</a></p>}
            <small className={ui.muted}>#{chosen.number} · {chosen.reporterName} · {ago(chosen.createdAt)} · {chosen.device || 'no device given'}</small>
            <Sorter key={chosen.id + chosen.updatedAt} bug={chosen} onSaved={(b) => { setChosen(b); load(); }} onNotice={onNotice} close={() => close()} />
            <div className={ui.row}>
              <button type="button" className={ui.button} onClick={copy}>Copy for Claude</button>
              <button type="button" className={ui.buttonQuiet} onClick={() => saveFile(`${fileBase(chosen)}.md`, reportText(docOf(chosen)), 'text/markdown')}>Download the report</button>
              {chosen.attachment && <button type="button" className={ui.buttonQuiet} onClick={() => saveFile(`${fileBase(chosen)}-warband.json`, JSON.stringify(chosen.attachment, null, 2), 'application/json')}>Download the warband</button>}
            </div>
            <details className={styles.details}>
              <summary>Everything that came with it</summary>
              <pre className={styles.preview} tabIndex={0}>{reportText(docOf(chosen))}</pre>
            </details>
          </div>
        )}
      </dialog>
    </>
  );
}
