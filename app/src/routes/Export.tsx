/* Exports (phase 3e): what a warband takes off this device, as in the
   Roster Builder – Tabletop Simulator cards to copy into each model, the
   readable text (it imports back), the tool file and the official roster
   sheet as a PDF. Every export names the house rules that are on. A card's
   own ⋯ menu leads straight to its Tabletop Simulator entry
   (`#tts-<uid>`). */
import * as core from '@mordheim/core';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { type StoredWarband } from '../db/db.ts';
import { useGameData } from '../game/useGameData.ts';
import { exportCtx, readableText, toolFile, ttsCards, type TtsCard } from '../roster/exports.ts';
import { officialSheet } from '../roster/pdf.ts';
import styles from '../roster/Export.module.css';
import trade from '../roster/Trade.module.css';
import { FLAVOUR } from '../flavour.ts';
import { encodeSave, getServer, importLink } from '../share/link.ts';
import { copyText, saveFile } from '../ui/files.ts';
import ui from '../ui/ui.module.css';
import { useWarbandRecord } from '../sync/local.ts';

/** A field to copy from: read-only, selected on focus, with its button. */
function CopyField({ label, value, rows, onCopied }: { label: string; value: string; rows: number; onCopied: (what: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div className={styles.field}>
      <div className={styles.fieldHead}>
        <span className={ui.muted}>{label}</span>
        <button type="button" className={ui.buttonQuiet}
          onClick={() => { void copyText(value).then((ok) => { if (ok) onCopied(label); else { ref.current?.focus(); ref.current?.select(); onCopied(''); } }); }}>
          Copy {label.toLowerCase()}
        </button>
      </div>
      <textarea ref={ref} className={`${ui.input} ${styles.mono}`} readOnly rows={rows} value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()} />
    </div>
  );
}

function Card({ c, open, onCopied }: { c: TtsCard; open: boolean; onCopied: (what: string) => void }) {
  return (
    <details id={c.id} className={styles.card} open={open}>
      <summary className={styles.summary}>
        <span>{c.label}</span>
        {c.group && <small className={ui.muted}>of {c.group}</small>}
      </summary>
      <CopyField label="Name" value={c.name} rows={1} onCopied={onCopied} />
      <CopyField label="Description" value={c.text} rows={8} onCopied={onCopied} />
    </details>
  );
}

/** Quick Build → campaign server (concept.md 4.11): a link that carries the warband in its fragment. */
function SendToServer({ ctx, onCopied }: { ctx: core.Ctx; onCopied: (what: string) => void }) {
  const server = getServer();
  const [link, setLink] = useState<string | null>(null);
  useEffect(() => {
    if (!server) return;
    let live = true;
    void encodeSave(core.writeSave(ctx, __APP_VERSION__)).then((f) => { if (live) setLink(importLink(server, f)); });
    return () => { live = false; };
  }, [server, ctx]);
  return (
    <section className={styles.group} aria-labelledby="ex-server">
      <h2 id="ex-server">Campaign server</h2>
      {server ? (
        <>
          <p className={ui.muted}>Opens the campaign app at {server.replace(/^https?:\/\//, '')} with this warband: there you add it as a new warband or as the next version of one of yours. The warband travels in the link itself, not through any server.</p>
          <div className={ui.row}>
            <a className={ui.button} href={link ?? undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!link}>Send to campaign server</a>
            <button type="button" className={ui.buttonQuiet} disabled={!link} onClick={() => { if (link) void copyText(link).then((ok) => onCopied(ok ? 'Link' : '')); }}>Copy the link</button>
          </div>
        </>
      ) : (
        <p className={ui.muted}>To send warbands to your group’s campaign server, enter its address under More → Campaign server.</p>
      )}
    </section>
  );
}

function Body({ rec }: { rec: StoredWarband }) {
  const data = useGameData();
  const ctx = useMemo(() => exportCtx(data, rec.state), [data, rec.state]);
  const cards = useMemo(() => ttsCards(ctx), [ctx]);
  const { hash } = useLocation();
  const navigate = useNavigate();
  const [note, setNote] = useState('');
  const [text, setText] = useState<string | null>(null);
  const [pdf, setPdf] = useState<'idle' | 'making' | string>('idle');
  const name = ctx.s.name || data.WARBANDS[ctx.s.wb as string]?.name || 'Warband';
  const rules = core.houseDeviations(ctx).length;

  // a card's ⋯ menu lands here on its entry
  useEffect(() => {
    if (hash.startsWith('#tts-')) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(''), 2500);
    return () => clearTimeout(t);
  }, [note]);
  const copied = (what: string) => setNote(what ? `${what} copied.` : 'Selected – copy it with your device’s own command.');

  const makePdf = async () => {
    setPdf('making');
    try {
      const { bytes, filename } = await officialSheet(ctx);
      saveFile(filename, bytes as BlobPart, 'application/pdf');
      setPdf('idle');
    } catch (e) {
      setPdf(`The sheet could not be made: ${e instanceof Error ? e.message : String(e)}.`);
    }
  };

  return (
    <section className={ui.page}>
      <div>
        <Link to={`/warbands/${rec.id}`} className={trade.back}>‹ {name}</Link>
        <h1>Export</h1>
      </div>
      <p className={ui.muted}>
        Everything below is made from the warband as it is now.
        {rules > 0 ? ` Every export names its ${rules} house rule${rules > 1 ? 's' : ''}.` : ' No house rules: the rules as written.'}
      </p>

      <section className={styles.group} aria-labelledby="ex-tts">
        <h2 id="ex-tts">Tabletop Simulator</h2>
        <p className={ui.muted}>Two fields for each model, each copied on its own into the model’s Name and Description. Colour codes like [7AD1A4] show as colours there. A henchman group gives one card for each man, with his own name.</p>
        <div className={styles.cards}>
          {cards.map((c) => <Card key={c.id} c={c} open={hash === `#${c.id}`} onCopied={copied} />)}
          {cards.length === 0 && <p className={ui.muted}>No warriors yet.</p>}
        </div>
      </section>

      <section className={styles.group} aria-labelledby="ex-text">
        <h2 id="ex-text">Readable text</h2>
        <p className={ui.muted}>For reading and sharing. It ends in the warband’s data, so pasting it into Import brings the warband back.</p>
        <div className={ui.row}>
          <button type="button" className={ui.buttonQuiet} onClick={() => setText((t) => (t == null ? readableText(ctx, new Date()).text : null))}>{text == null ? 'Show the text' : 'Hide the text'}</button>
          <button type="button" className={ui.buttonQuiet} onClick={() => { void copyText(readableText(ctx, new Date()).text).then((ok) => copied(ok ? 'Text' : '')); }}>Copy the text</button>
          <button type="button" className={ui.buttonQuiet} onClick={() => { const r = readableText(ctx, new Date()); saveFile(r.filename, r.text, 'text/plain;charset=utf-8'); }}>Save as .txt</button>
        </div>
        {text != null && <textarea className={`${ui.input} ${styles.mono}`} readOnly rows={14} value={text} aria-label="Readable text" />}
      </section>

      <section className={styles.group} aria-labelledby="ex-file">
        <h2 id="ex-file">Tool file</h2>
        <p className={ui.muted}>The warband as data (.json): loads back into this app and into the Roster Builder through Import.</p>
        <div className={ui.row}>
          <button type="button" className={ui.buttonQuiet} onClick={() => { const f = toolFile(ctx, __APP_VERSION__); saveFile(f.filename, f.json, 'application/json'); }}>Save as .json</button>
        </div>
      </section>

      <section className={styles.group} aria-labelledby="ex-pdf">
        <h2 id="ex-pdf">Official roster sheet</h2>
        <p className={ui.muted}>The printed Mordheim roster sheet (PDF), filled in with the warband – to print or to keep.</p>
        <div className={ui.row}>
          <button type="button" className={ui.buttonQuiet} disabled={pdf === 'making'} onClick={() => { void makePdf(); }}>{pdf === 'making' ? 'Making the sheet…' : 'Save as PDF'}</button>
        </div>
        {pdf !== 'idle' && pdf !== 'making' && <p className={trade.no} role="alert">{pdf}</p>}
      </section>

      {FLAVOUR === 'quickbuild' && <SendToServer ctx={ctx} onCopied={copied} />}

      <section className={styles.group} aria-labelledby="ex-print">
        <h2 id="ex-print">Print</h2>
        <p className={ui.muted}>The roster as it is on the screen, without the buttons; or the official sheet above, as a PDF.</p>
        <div className={ui.row}>
          <button type="button" className={ui.buttonQuiet} onClick={() => { void navigate(`/warbands/${rec.id}`, { state: { print: true } }); }}>Print the roster</button>
        </div>
      </section>

      <p className={styles.note} role="status" aria-live="polite">{note}</p>
    </section>
  );
}

export function Export() {
  const { id = '' } = useParams();
  const rec = useWarbandRecord(id);
  if (rec === undefined) return null;
  if (rec === null) {
    return (
      <section className={ui.page}>
        <h1>Not on this device</h1>
        <p><Link to="/warbands" className={ui.buttonQuiet}>All warbands</Link></p>
      </section>
    );
  }
  return (
    <Suspense fallback={<p className={ui.muted}>Loading the rules…</p>}>
      <Body rec={rec} />
    </Suspense>
  );
}
