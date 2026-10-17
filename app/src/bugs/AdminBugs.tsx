/* The admin's reports (phase 4c1): every report with its status, opened for
   all of it – the words, what came with it, the copy of the warband if the
   reporter attached one – and sorted: status, severity, area, kind, and the
   version it is fixed in. "Copy for Claude" hands a report on by hand, the
   same way as the AI pack for the chronicle (ADR 0018). Only the admin with
   an authenticator gets here; the server checks every request again. */
import { useCallback, useEffect, useState } from 'react';
import { errorText } from '../account/api.ts';
import { ago } from '../account/time.ts';
import { fileSlug, copyText, saveFile } from '../ui/files.ts';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { shownVersion } from '../version.ts';
import { KIND_NAMES, oneReport, reportList, sortReport, STATUS_NAMES, STATUS_ORDER, type BugDetail, type BugKind, type BugStatus, type BugSummary, type ListFilter, type Severity } from './api.ts';
import styles from './Bugs.module.css';
import { reportText, type ReportDoc } from './text.ts';

const FILTERS: { key: ListFilter; label: string }[] = [{ key: 'open', label: 'Open' }, { key: 'fixed', label: 'Fixed' }, { key: 'all', label: 'All' }];
const SEVERITIES: Severity[] = ['S1', 'S2', 'S3', 'S4'];

/** A report as the text to hand on. */
export function docOf(b: BugDetail): ReportDoc {
  return {
    id: b.id, kind: b.kind, title: b.title, text: b.text, sourceRef: b.sourceRef, appVersion: b.appVersion, device: b.device, view: b.view, createdAt: b.createdAt,
    reporter: b.reporterName, status: STATUS_NAMES[b.status].toLowerCase(), severity: b.severity, area: b.area, fixedIn: b.fixedIn ? shownVersion(b.fixedIn) : '',
    context: b.context, jsErrors: b.jsErrors, consent: b.consent,
    attached: b.attachment ? { warbandId: b.warbandId ?? '', rev: b.rev, bytes: JSON.stringify(b.attachment).length } : null,
  };
}

const fileBase = (b: BugDetail) => `report-${b.id.slice(0, 8)}-${fileSlug(b.title).slice(0, 40)}`;

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

function Sorter({ bug, onSaved, onNotice, close }: { bug: BugDetail; onSaved: (b: BugDetail) => void; onNotice: (t: string) => void; close: () => void }) {
  const [status, setStatus] = useState<BugStatus>(bug.status);
  const [severity, setSeverity] = useState<Severity | ''>(bug.severity ?? '');
  const [area, setArea] = useState(bug.area);
  const [kind, setKind] = useState<BugKind>(bug.kind);
  const [fixedIn, setFixedIn] = useState(bug.fixedIn || shownVersion(__APP_VERSION__));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    sortReport(bug.id, { status, severity: severity || null, area: area.trim(), kind, ...(status === 'fixed' ? { fixedIn: fixedIn.trim() } : {}) })
      .then((b) => { onSaved(b); onNotice('Saved.'); close(); })
      .catch((err: unknown) => setError(errorText(err)))
      .finally(() => setBusy(false));
  };
  return (
    <form className={ui.page} onSubmit={save}>
      <div className={styles.sorting}>
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
  const [filter, setFilter] = useState<ListFilter>('open');
  const [bugs, setBugs] = useState<BugSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<BugDetail | null>(null);
  const load = useCallback((f: ListFilter) => {
    reportList(f).then((r) => { setBugs(r); setError(null); }).catch((e: unknown) => setError(errorText(e)));
  }, []);
  useEffect(() => { load(filter); }, [filter, load]);

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
      <div className={styles.filter} role="group" aria-label="Show">
        {FILTERS.map((f) => <button key={f.key} type="button" className={ui.buttonQuiet} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}</button>)}
      </div>
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {bugs && bugs.length === 0 && !error && <p className={ui.muted}>{filter === 'open' ? 'Nothing open.' : 'Nothing here.'}</p>}
      {bugs && bugs.length > 0 && (
        <ul className={styles.list} aria-label="Reports">
          {bugs.map((b) => (
            <li key={b.id} className={styles.item}>
              <div className={styles.itemHead}>
                <strong>{b.title}</strong>
                <button type="button" className={ui.buttonQuiet} onClick={() => show(b.id)} aria-label={`Open: ${b.title}`}>Open</button>
              </div>
              <Flags b={b} />
              <small className={ui.muted}>{b.reporterName} · {ago(b.createdAt)} · app {shownVersion(b.appVersion) || 'unknown'}</small>
            </li>
          ))}
        </ul>
      )}
      <dialog ref={ref} className={ui.sheet} aria-labelledby="report-detail-title">
        {chosen && (
          <div className={ui.page}>
            <h2 id="report-detail-title">{chosen.title}</h2>
            <Flags b={chosen} />
            <p className={styles.words}>{chosen.text}</p>
            {/^https:\/\//i.test(chosen.sourceRef) && <p><a href={chosen.sourceRef} target="_blank" rel="noopener noreferrer">{chosen.sourceRef}</a></p>}
            <small className={ui.muted}>{chosen.reporterName} · {ago(chosen.createdAt)} · {chosen.device || 'no device given'}</small>
            <Sorter key={chosen.id + chosen.updatedAt} bug={chosen} onSaved={(b) => { setChosen(b); load(filter); }} onNotice={onNotice} close={() => close()} />
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
