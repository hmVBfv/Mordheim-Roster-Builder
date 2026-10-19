/* The backstory (concept.md 4.10): what happened before the campaign came
   into the app, in sections – a block of the Chronicle tab. Everyone in the
   campaign reads it where it stands, from what the device kept; a leader
   with the authenticator brings it in as text, pasted or read from a .md or
   .txt file of the group's old chronicle, cut into sections at its headings.
   Because everyone reads it, the text is held against the hidden background
   before it is saved (a warning the leader may knowingly override), and it
   replaces what was there. Saving needs the connection. */
import { useDeferredValue, useEffect, useId, useMemo, useState } from 'react';
import { errorText } from '../account/api.ts';
import { useOnline } from '../app/SyncState.tsx';
import type { CampaignView } from '../campaign/api.ts';
import { Findings } from '../drafts/Drafts.tsx';
import { checkText, loadMaterial, type Checked, type Material } from '../drafts/check.ts';
import { textOf } from '../timeline/ChapterParts.tsx';
import { readText } from '../timeline/chapters.ts';
import timeline from '../timeline/Timeline.module.css';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { cachedBackstory, getBackstory, NONE, putBackstory, staleBackstory, type Backstory } from './api.ts';
import styles from './Backstory.module.css';
import { problemWith, splitBackstory, type BackstorySection } from './split.ts';

const where = (s: BackstorySection) => (s.battleNo === null ? 'before the first battle' : `Battle ${s.battleNo}`);

function SectionText({ text }: { text: string }) {
  return (
    <div className={`${styles.text} ${timeline.chapterText}`}>
      {readText(text).map((p, i) => (p.kind === 'heading'
        ? <h3 key={i}>{p.text}</h3>
        : p.kind === 'rule' ? <hr key={i} />
          : <p key={i}>{p.pieces.map((x, j) => (x.strong ? <strong key={j}>{x.text}</strong> : <span key={j}>{x.text}</span>))}</p>))}
    </div>
  );
}

export function BackstorySection({ id, view, lead }: { id: string; view: CampaignView; lead: boolean }) {
  const online = useOnline();
  const [saved, setSaved] = useState<Backstory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { ref, open, close } = useSheet();
  const [keyed, setKeyed] = useState(0);

  useEffect(() => {
    let live = true;
    void cachedBackstory(id).then((c) => { if (live && c) setSaved((cur) => cur ?? c); });
    getBackstory(id).then((b) => { if (live) { setSaved(b); setError(null); } }).catch((e: unknown) => { if (live) setError(errorText(e)); });
    return () => { live = false; };
  }, [id]);

  const sections = saved?.sections ?? [];
  return (
    <section className={styles.backstory} aria-labelledby="bs-title">
      <h2 id="bs-title">Backstory</h2>
      <p className={ui.muted}>
        What happened before the campaign came into the app, as the group wrote it down. Everyone in the campaign reads it.
        {saved?.updatedBy ? ` Brought in by ${saved.updatedBy}.` : ''}
      </p>
      {error && <p className={ui.message} role="status">{error}{saved ? ' Shown as last seen.' : ''}</p>}
      {notice && <p className={ui.message} role="status">{notice}</p>}
      {!saved && !error && <p className={ui.muted}>Loading the backstory…</p>}
      {saved && sections.length === 0 && <p className={ui.muted}>No backstory yet.{lead ? ' Bring it in as text below.' : ''}</p>}
      {sections.length > 0 && (
        <ul className={styles.list} aria-label="Backstory sections">
          {sections.map((s, i) => (
            <li key={`${i}:${s.heading}`}>
              <details className={styles.section}>
                <summary>{s.heading} <small>{where(s)}</small></summary>
                <SectionText text={s.text} />
              </details>
            </li>
          ))}
        </ul>
      )}
      {lead && (
        <div className={ui.row}>
          <button type="button" className={ui.button} onClick={() => { setKeyed((k) => k + 1); open(); }}>{sections.length ? 'Replace the backstory…' : 'Bring in the backstory…'}</button>
        </div>
      )}
      <dialog ref={ref} className={ui.sheet} aria-labelledby="bs-form-title">
        {keyed > 0 && (
          <ImportForm key={keyed} close={close} cid={id} view={view} saved={saved ?? NONE} online={online}
            onSaved={(b) => { setSaved(b); setNotice(`Backstory saved: ${b.sections.length} section${b.sections.length === 1 ? '' : 's'}. Everyone in the campaign can read it.`); }}
            onStale={(b) => setSaved(b)} />
        )}
      </dialog>
    </section>
  );
}

function ImportForm({ close, cid, view, saved, online, onSaved, onStale }: {
  close: (then?: () => void) => void; cid: string; view: CampaignView; saved: Backstory; online: boolean; onSaved: (b: Backstory) => void; onStale: (b: Backstory) => void;
}) {
  const ids = useId();
  const [text, setText] = useState('');
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const [base, setBase] = useState(saved.seq);

  const typed = useDeferredValue(text);
  const sections = useMemo(() => splitBackstory(typed), [typed]);
  const problem = typed.trim() ? problemWith(sections) : null;

  // the hidden background and the names the players know are read once; each section is held against them at its own battle
  const [material, setMaterial] = useState<Material | null>(null);
  const [materialError, setMaterialError] = useState(false);
  useEffect(() => {
    let live = true;
    loadMaterial(cid, view).then((m) => { if (live) setMaterial(m); }).catch(() => { if (live) setMaterialError(true); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening of the form
  }, [cid]);
  const checks = useMemo(() => (material
    ? sections.map((s) => ({
      section: s,
      checked: checkText(material, view, s.battleNo === null
        ? { refKey: 'prolog', kind: 'prologue', title: s.heading, label: '', icDate: '', place: '', victor: '', text: s.text }
        : { refKey: `battle-${s.battleNo}`, kind: 'battle', title: s.heading, label: '', icDate: '', place: '', victor: '', text: s.text }) as Checked,
    })).filter((x) => x.checked.check.findings.length > 0)
    : null), [material, view, sections]);
  const held = checks?.length ?? 0;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setText(await textOf(file));
    setFileNote(`Read ${file.name}.`);
  };

  const save = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const p = problemWith(sections);
    if (p) { setError(p); return; }
    if (held > 0 && !ack) { setError('Read the places the check found, then tick that you want everyone to read this.'); return; }
    setBusy(true);
    setError(null);
    try {
      const b = await putBackstory(cid, sections, base);
      close(() => onSaved(b));
    } catch (err) {
      const cur = staleBackstory(err);
      if (cur) {
        setBase(cur.seq);
        onStale(cur);
        setError(`${cur.updatedBy ?? 'Another leader'} replaced the backstory while you were editing. Save again to replace theirs with yours.`);
      } else setError(errorText(err));
    } finally { setBusy(false); }
  };

  return (
    <form className={ui.page} onSubmit={(e) => void save(e)} noValidate>
      <h2 id="bs-form-title">{saved.sections.length ? 'Replace the backstory' : 'Bring in the backstory'}</h2>
      <p className={ui.muted}>
        Paste the text, or read it from a .md or .txt file. It is cut into sections at its headings – “Battle 3 …”, “Schlacht 3 …”, or any Markdown heading;
        the number says which battle a section tells of. <strong>Everyone in the campaign will read it.</strong> What must stay hidden belongs in the background.
      </p>
      {saved.sections.length > 0 && <p className={ui.message} role="status">This replaces the {saved.sections.length} {saved.sections.length === 1 ? 'section that is' : 'sections that are'} there now.</p>}
      <label className={ui.field}>
        <span>From a file (optional)</span>
        <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={(e) => void pick(e.target.files?.[0])} />
      </label>
      {fileNote && <p className={ui.muted} role="status">{fileNote}</p>}
      <div className={ui.field}>
        <label htmlFor={`${ids}-text`}>Text</label>
        <textarea id={`${ids}-text`} className={`${ui.textarea} ${ui.writing}`} rows={10} value={text} onChange={(e) => { setText(e.target.value); setAck(false); }} />
        <small className={ui.muted}>{text.length.toLocaleString('en')} characters</small>
      </div>
      <div aria-live="polite" className={styles.checks}>
        <h3>Sections</h3>
        {sections.length === 0 && <p className={ui.muted}>Paste or read the text, and its sections show here.</p>}
        {sections.length > 0 && (
          <ul className={styles.preview} aria-label="Sections found">
            {sections.map((s, i) => (
              <li key={`${i}:${s.heading}`}><strong>{s.heading}</strong><small>{where(s)} · {s.text.split(/\s+/).length.toLocaleString('en')} words</small></li>
            ))}
          </ul>
        )}
        {problem && <p className={`${ui.message} ${ui.error}`} role="alert">{problem}</p>}
        {sections.length > 0 && (
          <>
            <h3>Check before it is saved</h3>
            {materialError && <p className={ui.muted}>The background could not be read, so the text is not checked.</p>}
            {!materialError && !checks && <p className={ui.muted}>Reading the background…</p>}
            {checks && checks.length === 0 && <p className={ui.message}>No word of the hidden or hinted background was found. The check finds words, not meaning: read the text yourself.</p>}
            {checks?.map(({ section, checked }) => (
              <div key={section.heading}>
                <h4>In “{section.heading}”</h4>
                <Findings checked={checked} quiet />
              </div>
            ))}
          </>
        )}
      </div>
      {held > 0 && (
        <label className={styles.ack}>
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>I have read the places above; everyone in the campaign may read this.</span>
        </label>
      )}
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {!online && <p className={ui.message} role="status">Saving the backstory needs the connection.</p>}
      <div className={ui.row}>
        <button type="submit" className={ui.button} disabled={busy || !online || sections.length === 0}>Save the backstory</button>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </form>
  );
}
