/* The form of a problem report (concept.md 4.12): a kind and a sentence – that
   is all that is asked. What goes along without being written (the screen,
   the last steps, the settings, the house rules, the last errors) is shown
   in full before sending and can be left out; a copy of the warband in view
   goes along only with a tick. Without a server (Quick Build), signed out or
   offline the report can still be copied and handed on. */
import { useState } from 'react';
import { ApiError, errorText } from '../account/api.ts';
import { useSession } from '../account/session.ts';
import { useOnline } from '../app/SyncState.tsx';
import { newId } from '../db/ids.ts';
import { FLAVOUR } from '../flavour.ts';
import { copyText } from '../ui/files.ts';
import ui from '../ui/ui.module.css';
import { shownVersion } from '../version.ts';
import { KIND_HINTS, KIND_NAMES, sendReport, type BugKind, type ReportBody } from './api.ts';
import { queueReport } from './queue.ts';
import styles from './Bugs.module.css';
import { warbandCopy, type Snapshot } from './snapshot.ts';
import { reportText, titleOf, type ReportDoc } from './text.ts';

const KINDS: BugKind[] = ['bug', 'wish', 'rules'];
const MAX_TEXT = 4000;

export function ReportForm({ snap, close, onSent }: { snap: Snapshot; close: () => void; onSent: () => void }) {
  const session = useSession();
  const online = useOnline();
  const [kind, setKind] = useState<BugKind>('bug');
  const [text, setText] = useState('');
  const [sourceRef, setSourceRef] = useState('');
  const [details, setDetails] = useState(true);
  const [attach, setAttach] = useState(false);
  // one id for this report: sending it again after a failure is still one report
  const [id] = useState(newId);
  const [phase, setPhase] = useState<'writing' | 'sending' | 'sent' | 'saved'>('writing');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const signedIn = FLAVOUR === 'campaign' && session.status === 'in';
  // known on this device, the server out of reach: the report is written now and kept until it can go (wish #177)
  const known = FLAVOUR === 'campaign' ? (session.status === 'in' ? session.user.id : session.status === 'unreachable' ? session.user?.id ?? null : null) : null;
  const wb = FLAVOUR === 'campaign' && known ? snap.warband : null;
  const written = text.trim().length > 0;

  const doc: ReportDoc = {
    id, kind, title: titleOf(text) || '(nothing written yet)', text: text.trim() || '(nothing written yet)', sourceRef: kind === 'rules' ? sourceRef.trim() : '',
    appVersion: __APP_VERSION__, device: details ? snap.device : '', view: details ? snap.context.screen : '', createdAt: null,
    context: details ? snap.context : null, jsErrors: details ? snap.errors : [],
    attached: attach && wb ? { warbandId: wb.id, rev: wb.rev, bytes: wb.kb * 1024 } : null,
  };

  const why = FLAVOUR === 'quickbuild' ? 'The Quick Build has no campaign server. Copy the report and send it to Rob.'
    : !known ? 'Sign in to send it – or copy the report and pass it on.'
      : !online || session.status !== 'in' ? 'You are offline. Save the report: it goes out by itself when you are back. Or copy it now.' : null;
  // without a connection the report is kept on the device; with one it is sent
  const later = FLAVOUR === 'campaign' && !!known && (!online || session.status !== 'in');
  const canSend = (why === null || later) && written && phase === 'writing';

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setPhase('sending');
    setError(null);
    void (async () => {
      try {
        const copy = attach && wb ? (wb.save ? { warbandId: wb.id, rev: wb.rev, save: wb.save } : await warbandCopy(wb.id)) : null;
        if (attach && wb && !copy) throw new Error('gone');
        const body: ReportBody = {
          id, kind, title: doc.title, text: doc.text, sourceRef: doc.sourceRef, appVersion: __APP_VERSION__, device: doc.device, view: doc.view, context: doc.context, jsErrors: doc.jsErrors,
          attach: copy,
        };
        if (later && known) { await queueReport(known, body); setPhase('saved'); return; }
        try {
          await sendReport(body);
        } catch (e) {
          // the server does not answer though the device says it is online: the report waits like any other
          if (e instanceof ApiError && e.unreachable && known) { await queueReport(known, body); setPhase('saved'); return; }
          throw e;
        }
        setPhase('sent');
        onSent();
      } catch (err) {
        setPhase('writing');
        setError(err instanceof Error && err.message === 'gone' ? 'That warband is not on this device any more – untick it, or send without it.' : errorText(err));
      }
    })();
  };

  const copy = () => {
    void copyText(reportText(doc)).then((ok) => {
      setCopied(ok ? 'Copied – paste it into a message to Rob.' : 'Your browser did not allow copying. Open “What goes along” below and copy the text from there.');
      if (!ok) setOpen(true);
    });
  };

  if (phase === 'saved') {
    return (
      <div className={ui.page}>
        <h2 id="report-title" data-handle className={styles.handle}>Saved</h2>
        <p className={ui.message} role="status">Saved on this device. It goes out by itself as soon as the campaign server answers; you can see that it waits under Account → Your reports.</p>
        <div className={ui.row}><button type="button" className={ui.button} onClick={close}>Done</button></div>
      </div>
    );
  }

  if (phase === 'sent') {
    return (
      <div className={ui.page}>
        <h2 id="report-title" data-handle className={styles.handle}>Sent</h2>
        <p className={ui.message} role="status">Thank you – Rob will look at it. You can follow it under Account → Your reports.</p>
        <div className={ui.row}><button type="button" className={ui.button} onClick={close}>Done</button></div>
      </div>
    );
  }

  return (
    <form className={ui.page} onSubmit={send}>
      <h2 id="report-title" data-handle className={styles.handle}>Report a problem</h2>
      <fieldset className={styles.kinds}>
        <legend>What is it?</legend>
        {KINDS.map((k) => (
          <label key={k} className={styles.kind}>
            <input type="radio" name="report-kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
            <span>{KIND_NAMES[k]}</span>
            <small>{KIND_HINTS[k]}</small>
          </label>
        ))}
      </fieldset>
      <label className={ui.field}>
        <span>{kind === 'wish' ? 'What would you like?' : 'What did you want to do, and what happened instead?'}</span>
        <textarea className={`${ui.textarea} ${ui.writing}`} rows={5} maxLength={MAX_TEXT} value={text} onChange={(e) => setText(e.target.value)} placeholder="One sentence is enough." />
      </label>
      {kind === 'rules' && (
        <label className={ui.field}>
          <span>Where does the rule stand? <span className={ui.muted}>(a Mordheimer link or an FAQ page, if you have one)</span></span>
          <input className={ui.input} maxLength={300} value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
        </label>
      )}
      <label className={styles.check}>
        <input type="checkbox" checked={details} onChange={(e) => setDetails(e.target.checked)} />
        <span>Send the technical details<small>The screen, the last steps, your settings, house rules and the last errors – nothing you typed. Recommended: it is what lets us find the problem.</small></span>
      </label>
      {wb && (
        <label className={styles.check}>
          <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} />
          <span>Attach “{wb.name}” as {wb.save ? 'the campaign shows it to you' : 'it is on this device'}<small>About {wb.kb} KB, with its names and story. Only Rob and Claude read it, and it is dropped when the report is closed.</small></span>
        </label>
      )}
      <details className={styles.details} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary>What goes along</summary>
        <pre className={styles.preview} tabIndex={0}>{reportText(doc)}</pre>
      </details>
      {why && <p className={ui.muted}>{why}</p>}
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {copied && <p className={ui.message} role="status">{copied}</p>}
      <div className={ui.actions}>
        <button type="button" className={FLAVOUR === 'campaign' ? ui.buttonQuiet : ui.button} disabled={!written} onClick={copy}>Copy the report</button>
        <button type="button" className={ui.buttonQuiet} onClick={close}>Cancel</button>
        {FLAVOUR === 'campaign' && <button type="submit" className={ui.button} disabled={!canSend}>{phase === 'sending' ? 'Sending…' : later ? 'Save to send later' : 'Send'}</button>}
      </div>
      <p className={ui.muted}>App version {shownVersion(__APP_VERSION__)}.</p>
    </form>
  );
}
