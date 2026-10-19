/* Chapters as drafts (phase 4b5b; docs/mockups/chronicle.html): a leaders'
   section of the Chronicle tab. A chapter written elsewhere – by hand, from
   the AI pack – is brought in as text and waits here; only leaders with the
   authenticator see it. Before it goes out it is held against the hidden
   background (a warning the leader may knowingly override) and put in its
   place in the story; published, its language joins the chapter of the same
   ref and everybody reads it. Every change needs the connection. */
import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { errorText } from '../account/api.ts';
import { useOnline } from '../app/SyncState.tsx';
import type { CampaignView } from '../campaign/api.ts';
import { LANG_NAMES } from '../chronicle/download.ts';
import { newId } from '../db/ids.ts';
import type { ChapterSummary } from '../timeline/api.ts';
import { textOf } from '../timeline/ChapterParts.tsx';
import type { Segment } from '../timeline/build.ts';
import { chapterPlace, guessLang, readChapterFile, readText, splitFrontMatter, type ChapterKind, type Lang } from '../timeline/chapters.ts';
import { between } from '../timeline/order.ts';
import { Empty } from '../art/Pixels.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { cachedDrafts, discardDraft, getDrafts, MAX_DRAFT_TEXT, publishDraft, putDraft, staleDraft, type Draft, type DraftBody } from './api.ts';
import { checkDraft, checkText, loadMaterial, storySegments, type Checked, type Material } from './check.ts';
import styles from './Drafts.module.css';

const KIND_NAMES: Record<ChapterKind, string> = { battle: 'Battle', interlude: 'Interlude', prologue: 'Prologue', chapter: 'Other chapter' };
const REF = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** The key that links a draft to its chapter: `battle-3`, `interlude-3`, `prolog`, or one a leader names. */
const refOf = (kind: ChapterKind, round: string, free: string) => (kind === 'prologue' ? 'prolog' : kind === 'chapter' ? free.trim().toLowerCase() : `${kind}-${Number(round)}`);
const partsOf = (refKey: string, kind: ChapterKind): { kind: ChapterKind; round: string; free: string } => {
  const m = /^(battle|interlude)-(\d+)$/.exec(refKey);
  if (m && kind === m[1]) return { kind, round: m[2]!, free: '' };
  return kind === 'prologue' ? { kind, round: '', free: '' } : { kind: 'chapter', round: '', free: refKey };
};

interface Notice { text: string; error: boolean }

export function DraftsSection({ id, view, chapters, onPublished }: { id: string; view: CampaignView; chapters: ChapterSummary[]; onPublished: () => void }) {
  const online = useOnline();
  const [list, setList] = useState<Draft[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const { ref: formRef, open: openForm, close: closeForm } = useSheet();
  const { ref: reviewRef, open: openReview, close: closeReview } = useSheet();
  const [editing, setEditing] = useState<{ draft: Draft | null; key: number } | null>(null);
  const [reviewing, setReviewing] = useState<{ draft: Draft; key: number } | null>(null);
  const keys = useRef(0);

  useEffect(() => {
    let live = true;
    void cachedDrafts(id).then((c) => { if (live && c) setList((cur) => cur ?? c.drafts); });
    getDrafts(id).then((r) => { if (live) { setList(r.drafts); setError(null); } }).catch((e: unknown) => { if (live) setError(errorText(e)); });
    return () => { live = false; };
  }, [id]);

  const put = useCallback((d: Draft) => setList((cur) => [d, ...(cur ?? []).filter((x) => x.id !== d.id)]), []);
  const drop = useCallback((d: Draft) => setList((cur) => (cur ?? []).filter((x) => x.id !== d.id)), []);
  const edit = (draft: Draft | null) => { setEditing({ draft, key: ++keys.current }); openForm(); };
  const review = (draft: Draft) => { setReviewing({ draft, key: ++keys.current }); openReview(); };

  return (
    <section className={styles.drafts} aria-labelledby="drafts-title">
      <h2 id="drafts-title">Drafts <span className={styles.hidden}>⚑ Leaders only</span></h2>
      <p className={ui.muted}>
        A chapter brought in as text waits here; nobody but the leaders sees it. Publishing it puts it in the chronicle for everyone.
      </p>
      {error && <p className={ui.message} role="status">{error}{list ? ' Shown as last seen.' : ''}</p>}
      {notice && <p className={`${ui.message} ${notice.error ? ui.error : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
      {list && list.length === 0 && !error && <Empty scene="scribe" title="No draft yet." />}
      {!list && !error && <p className={ui.muted}>Loading the drafts…</p>}
      <ul className={styles.list} aria-label="Drafts">
        {(list ?? []).map((d) => (
          <li key={d.id} className={styles.draft}>
            <small className={styles.meta}>{KIND_NAMES[d.kind]} · {d.refKey} · {LANG_NAMES[d.lang]} · {d.text.length.toLocaleString('en')} characters · {d.createdBy}</small>
            <strong lang={d.lang}>{d.title}</strong>
            <div className={ui.row}>
              <button type="button" className={ui.button} aria-label={`Review ${d.title}`} onClick={() => review(d)}>Review</button>
              <button type="button" className={ui.buttonQuiet} aria-label={`Edit ${d.title}`} onClick={() => edit(d)}>Edit</button>
            </div>
          </li>
        ))}
      </ul>
      <div className={ui.row}>
        <button type="button" className={ui.button} onClick={() => edit(null)}>Bring in a chapter</button>
      </div>

      <dialog ref={formRef} className={ui.sheet} aria-labelledby="draft-form-title">
        {editing && (
          <DraftForm key={editing.key} close={closeForm} cid={id} view={view} draft={editing.draft} online={online}
            onSaved={(d) => { put(d); setNotice({ text: `Draft “${d.title}” saved. Only leaders can see it.`, error: false }); }} />
        )}
      </dialog>
      <dialog ref={reviewRef} className={ui.sheet} aria-labelledby="draft-review-title">
        {reviewing && (
          <ReviewForm key={reviewing.key} close={closeReview} cid={id} view={view} draft={reviewing.draft} chapters={chapters} online={online}
            onEdit={() => closeReview(() => edit(reviewing.draft))}
            onPublished={(d) => {
              drop(d);
              setNotice({ text: `“${d.title}” is published in ${LANG_NAMES[d.lang]}. Everyone in the campaign can read it now.`, error: false });
              onPublished();
            }}
            onDiscarded={(d) => { drop(d); setNotice({ text: `Draft “${d.title}” thrown away.`, error: false }); }} />
        )}
      </dialog>
    </section>
  );
}

/* ---- bringing a chapter in, or changing a draft ---- */

function DraftForm({ close, cid, view, draft, online, onSaved }: {
  close: (then?: () => void) => void; cid: string; view: CampaignView; draft: Draft | null; online: boolean; onSaved: (d: Draft) => void;
}) {
  const ids = useId();
  const battles = view.battles ?? [];
  const was = draft ? partsOf(draft.refKey, draft.kind) : null;
  const latest = String(Math.max(1, ...battles.map((b) => b.round)));
  const [title, setTitle] = useState(draft?.title ?? '');
  const [kind, setKind] = useState<ChapterKind>(was?.kind ?? 'battle');
  const [round, setRound] = useState(was?.round || latest);
  const [free, setFree] = useState(was?.free ?? '');
  const [lang, setLang] = useState<Lang>(draft?.lang ?? 'de');
  const [label, setLabel] = useState(draft?.label ?? '');
  const [icDate, setIcDate] = useState(draft?.icDate ?? '');
  const [place, setPlace] = useState(draft?.place ?? '');
  const [victor, setVictor] = useState(draft?.victor ?? '');
  const [text, setText] = useState(draft?.text ?? '');
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // the device's id for this draft, kept over retries; and the stand it edits from
  const draftId = useRef(draft?.id ?? newId());
  const baseSeq = useRef(draft?.seq ?? 0);

  const refKey = refOf(kind, round, free);

  // the background and the known names are read once; the text is held against them as it is typed
  const [material, setMaterial] = useState<Material | null>(null);
  const [materialError, setMaterialError] = useState(false);
  useEffect(() => {
    let live = true;
    loadMaterial(cid, view).then((m) => { if (live) setMaterial(m); }).catch(() => { if (live) setMaterialError(true); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening of the form
  }, [cid]);
  const typed = useDeferredValue(text);
  const live = useMemo(() => (material && typed.trim() ? checkText(material, view, { refKey, kind, title, label, icDate, place, victor, text: typed }) : null),
    [material, view, refKey, kind, title, label, icDate, place, victor, typed]);
  const words = typed.trim() ? typed.trim().split(/\s+/).length : 0;
  const paragraphs = typed.trim() ? typed.trim().split(/\n\s*\n/).length : 0;

  const problem = !title.trim() ? 'Give the chapter a title.'
    : !text.trim() ? 'The chapter has no text.'
      : text.length > MAX_DRAFT_TEXT ? `The text is longer than ${MAX_DRAFT_TEXT.toLocaleString('en')} characters.`
        : (kind === 'battle' || kind === 'interlude') && !(Number(round) >= 1 && Number.isInteger(Number(round))) ? 'Name the round of the battle (1, 2, 3 …).'
          : !REF.test(refKey) ? 'The key of the chapter may use a–z, 0–9 and “-” only (battle-3, interlude-3, my-chapter).' : null;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const source = await textOf(file);
    const r = readChapterFile(file.name, source);
    if (!('problem' in r)) {
      const p = partsOf(r.refKey, r.kind);
      setTitle(r.fields.title); setKind(p.kind); setRound(p.round || round); setFree(p.free); setLang(r.lang);
      setLabel(r.fields.label); setIcDate(r.fields.icDate); setPlace(r.fields.place); setVictor(r.fields.victor); setText(r.fields.text);
      setFileNote(`Read ${file.name}: title, chapter and language come from its front matter.`);
      return;
    }
    // no usable front matter: the file is the text, a title from its first heading or its name
    const fm = splitFrontMatter(source);
    const body = (fm?.body ?? source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')).trim();
    const heading = /^#{1,2}\s+(.+)$/m.exec(body)?.[1]?.trim();
    if (!title.trim()) setTitle(fm?.front.title ?? heading ?? file.name.replace(/\.[^.]+$/, ''));
    setText(body);
    setLang(guessLang(body.slice(0, 4000)));
    setFileNote(`Read ${file.name}: ${r.problem}. The whole file is the text; check the chapter and the language.`);
  };

  const save = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError(null);
    const body: DraftBody = { refKey, kind, lang, title: title.trim(), label: label.trim(), icDate: icDate.trim(), place: place.trim(), victor: victor.trim(), text };
    try {
      const saved = await putDraft(cid, draftId.current, body, baseSeq.current);
      close(() => onSaved(saved));
    } catch (err) {
      const cur = staleDraft(err);
      if (cur) {
        baseSeq.current = cur.seq;
        setError(`${cur.createdBy} changed this draft while you were editing it. Save again to replace their version with yours.`);
      } else setError(errorText(err));
    } finally { setBusy(false); }
  };

  return (
    <form className={ui.page} onSubmit={(e) => void save(e)} noValidate>
      <h2 id="draft-form-title">{draft ? 'Edit the draft' : 'Bring in a chapter'}</h2>
      <p className={ui.muted}>Paste the text or read it from a .md or .txt file. It stays a draft – only leaders see it – until you publish it.</p>
      <label className={ui.field}>
        <span>From a file (optional)</span>
        <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={(e) => void pick(e.target.files?.[0])} />
      </label>
      {fileNote && <p className={ui.muted} role="status">{fileNote}</p>}
      <div className={ui.field}>
        <label htmlFor={`${ids}-title`}>Title</label>
        <input id={`${ids}-title`} className={ui.input} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className={ui.field}>
        <label htmlFor={`${ids}-kind`}>What it tells</label>
        <select id={`${ids}-kind`} className={ui.select} value={kind} onChange={(e) => setKind(e.target.value as ChapterKind)}>
          {(Object.keys(KIND_NAMES) as ChapterKind[]).map((k) => <option key={k} value={k}>{KIND_NAMES[k]}</option>)}
        </select>
      </div>
      {(kind === 'battle' || kind === 'interlude') && (
        <div className={ui.field}>
          <label htmlFor={`${ids}-round`}>{kind === 'battle' ? 'Round of the battle' : 'Interlude after the battle of round'}</label>
          <input id={`${ids}-round`} className={ui.input} type="number" inputMode="numeric" min={1} step={1} value={round} onChange={(e) => setRound(e.target.value)} />
        </div>
      )}
      {kind === 'chapter' && (
        <div className={ui.field}>
          <label htmlFor={`${ids}-ref`}>Key of the chapter</label>
          <input id={`${ids}-ref`} className={ui.input} value={free} maxLength={64} autoCapitalize="none" placeholder="a-night-at-the-ferry" onChange={(e) => setFree(e.target.value)} />
        </div>
      )}
      <div className={ui.field}>
        <label htmlFor={`${ids}-lang`}>Language</label>
        <select id={`${ids}-lang`} className={ui.select} value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
          {(['de', 'en'] as const).map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
        </select>
      </div>
      <div className={ui.field}>
        <label htmlFor={`${ids}-text`}>Text</label>
        <textarea id={`${ids}-text`} className={`${ui.textarea} ${ui.writing}`} rows={10} value={text} lang={lang} onChange={(e) => setText(e.target.value)} />
        <small className={ui.muted}>{words.toLocaleString('en')} words · {paragraphs} paragraph{paragraphs === 1 ? '' : 's'} · {text.length.toLocaleString('en')} of {MAX_DRAFT_TEXT.toLocaleString('en')} characters</small>
      </div>
      <div className={styles.live} aria-live="polite">
        <h3 className={styles.sub}>Check before it is published</h3>
        {live ? <Findings checked={live} quiet />
          : materialError ? <p className={ui.muted}>The background could not be read, so the text is not checked yet. It is checked again when you review the draft.</p>
            : <p className={ui.muted}>{typed.trim() ? 'Reading the background…' : 'Paste or write the text, and it is held against the hidden background as you go.'}</p>}
      </div>
      <details>
        <summary>More about the chapter (optional)</summary>
        <div className={styles.more}>
          {([['Chapter label', label, setLabel, 'Chapter 3'], ['Date in the story', icDate, setIcDate, 'Sigmarzeit 2302'], ['Place', place, setPlace, 'The ferry at the Stir']] as const).map(([name, value, set, hint]) => (
            <div key={name} className={ui.field}>
              <label htmlFor={`${ids}-${name}`}>{name}</label>
              <input id={`${ids}-${name}`} className={ui.input} value={value} maxLength={200} placeholder={hint} onChange={(e) => set(e.target.value)} />
            </div>
          ))}
          <div className={ui.field}>
            <label htmlFor={`${ids}-victor`}>Who won, in a line</label>
            <input id={`${ids}-victor`} className={ui.input} value={victor} maxLength={4000} onChange={(e) => setVictor(e.target.value)} />
          </div>
        </div>
      </details>
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {!online && <p className={ui.message} role="status">Saving a draft needs the connection.</p>}
      <div className={ui.row}>
        <button type="submit" className={ui.button} disabled={busy || !online}>Save the draft</button>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </form>
  );
}

/* ---- reviewing, publishing, throwing away ---- */

function Findings({ checked, quiet = false }: { checked: Checked; quiet?: boolean }) {
  const { check, held } = checked;
  if (check.findings.length === 0) {
    return <p className={ui.message} role={quiet ? undefined : 'status'}>No word of the {held} hidden or hinted piece{held === 1 ? '' : 's'} of the background was found. The check finds words, not meaning: read the text yourself.</p>;
  }
  return (
    <div className={styles.findings}>
      <p className={`${ui.message} ${ui.error}`} role={quiet ? undefined : 'alert'}>
        The text uses words of the background the players may not know yet. The check finds words, not meaning – read the places below, then decide.
      </p>
      <ul aria-label="Words of the hidden background">
        {check.findings.map((f) => (
          <li key={f.title} className={styles.finding}>
            <strong>{f.title}</strong> <small className={styles.meta}>{f.rule === 'hidden' ? '· must not appear yet' : '· may only be hinted at'}</small>
            {f.rule === 'hint' && f.allowed && <p className={styles.allowed}>Allowed: {f.allowed}</p>}
            <ul>
              {f.terms.map((t) => <li key={t.term}>“{t.term}” × {t.hits} <span className={styles.excerpt}>{t.excerpt}</span></li>)}
            </ul>
          </li>
        ))}
      </ul>
      {check.more > 0 && <p className={ui.muted}>{check.more} more piece{check.more === 1 ? '' : 's'} with findings are not listed.</p>}
    </div>
  );
}

function ReviewForm({ close, cid, view, draft, chapters, online, onEdit, onPublished, onDiscarded }: {
  close: (then?: () => void) => void; cid: string; view: CampaignView; draft: Draft; chapters: ChapterSummary[]; online: boolean;
  onEdit: () => void; onPublished: (d: Draft) => void; onDiscarded: (d: Draft) => void;
}) {
  const ids = useId();
  const [checked, setChecked] = useState<Checked | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [segs, setSegs] = useState<Segment[] | null>(null);
  const [place, setPlace] = useState('');
  const [ack, setAck] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const there = chapters.find((c) => c.refKey === draft.refKey);
  const replaces = !!there?.[draft.lang];
  // the check and the place are made once for this draft; a campaign view arriving meanwhile does not redo them
  const [viewAtOpen] = useState(view);

  useEffect(() => {
    let live = true;
    checkDraft(cid, viewAtOpen, draft).then((c) => { if (live) setChecked(c); }).catch((e: unknown) => { if (live) setCheckError(errorText(e)); });
    storySegments(cid, viewAtOpen).then((s) => {
      if (!live) return;
      setSegs(s);
      setPlace(chapterPlace({ refKey: draft.refKey, kind: draft.kind, publishedOn: null }, [], viewAtOpen.battles ?? [], s.map((x) => x.key)));
    }).catch(() => { if (live) setSegs([]); });
    return () => { live = false; };
  }, [cid, draft, viewAtOpen]);

  const warned = !!checked && checked.check.findings.length > 0;
  const unchecked = !checked; // still running, or failed
  const needsAck = warned || !!checkError;
  const placed = !!there || (segs !== null && segs.some((s) => s.key === place));
  const ready = online && !busy && !!(checked || checkError) && placed && (!needsAck || ack);

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      const head = segs?.find((s) => s.key === place)?.blocks[0]?.key ?? null;
      await publishDraft(cid, draft.id, there ? null : { segment: place, pos: between(null, head) }, null);
      close(() => onPublished(draft));
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const discard = async () => {
    setBusy(true);
    setError(null);
    try {
      await discardDraft(cid, draft.id);
      close(() => onDiscarded(draft));
    } catch (e) { setError(errorText(e)); setAsking(false); } finally { setBusy(false); }
  };

  return (
    <div className={ui.page}>
      <div>
        <small className={styles.meta}>{KIND_NAMES[draft.kind]} · {draft.refKey} · {LANG_NAMES[draft.lang]} · <span className={styles.hidden}>⚑ Leaders only</span></small>
        <h2 id="draft-review-title" lang={draft.lang}>{draft.title}</h2>
      </div>
      <details>
        <summary>Read the text</summary>
        <div className={styles.text} lang={draft.lang}>
          {readText(draft.text).map((p, i) => (p.kind === 'heading'
            ? <h3 key={i}>{p.text}</h3>
            : p.kind === 'rule' ? <hr key={i} />
              : <p key={i}>{p.pieces.map((x, j) => (x.strong ? <strong key={j}>{x.text}</strong> : <span key={j}>{x.text}</span>))}</p>))}
        </div>
      </details>

      <h3 className={styles.sub}>Against the hidden background</h3>
      {unchecked && !checkError && <p className={ui.muted}>Checking the text…</p>}
      {checkError && <p className={`${ui.message} ${ui.error}`} role="alert">The check could not run: {checkError} Read the text yourself before you publish.</p>}
      {checked && <Findings checked={checked} />}

      <h3 className={styles.sub}>Where it goes</h3>
      {there ? (
        <p className={ui.message}>
          {replaces
            ? `This replaces the ${LANG_NAMES[draft.lang]} text of “${(there[draft.lang] ?? there.de ?? there.en)!.title}”. `
            : `This adds the ${LANG_NAMES[draft.lang]} text to “${(there.de ?? there.en)!.title}”. `}
          The chapter keeps its place{replaces ? ' and its other language' : ''}.
        </p>
      ) : (
        <div className={ui.field}>
          <label htmlFor={`${ids}-place`}>A new chapter, at the head of</label>
          <select id={`${ids}-place`} className={ui.select} value={place} disabled={!segs} onChange={(e) => setPlace(e.target.value)}>
            {(segs ?? []).map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
          </select>
        </div>
      )}

      {needsAck && (
        <label className={styles.ack}>
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>{checkError ? 'I have read the text myself' : 'I have read the places above and publish anyway'}</span>
        </label>
      )}
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {!online && <p className={ui.message} role="status">Publishing needs the connection.</p>}
      {asking ? (
        <div className={ui.row} role="group" aria-label="Throw away the draft?">
          <button type="button" className={ui.button} disabled={busy || !online} onClick={() => void discard()}>Yes, throw it away</button>
          <button type="button" className={ui.buttonQuiet} onClick={() => setAsking(false)}>Keep it</button>
        </div>
      ) : (
        <div className={ui.row}>
          <button type="button" className={ui.button} disabled={!ready} onClick={() => void publish()}>{warned ? 'Publish anyway' : 'Publish'}</button>
          <button type="button" className={ui.buttonQuiet} onClick={onEdit}>Edit</button>
          <button type="button" className={ui.buttonQuiet} onClick={() => setAsking(true)}>Throw away</button>
          <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Close</button>
        </div>
      )}
    </div>
  );
}

