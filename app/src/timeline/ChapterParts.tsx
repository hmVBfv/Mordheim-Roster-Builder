/* The published chapters in the timeline (phase 4a5, part 2): a chapter's
   block, the sheet to read it in either language, and – for a leader – the
   import of the chronicle's own files with a place for each. The text is
   shown as plain pieces (chapters.ts readText); nothing of it becomes HTML. */
import { useEffect, useId, useState, type RefObject } from 'react';
import { errorText } from '../account/api.ts';
import type { BattleSummary } from '../battle/api.ts';
import { newId } from '../db/ids.ts';
import ui from '../ui/ui.module.css';
import { getChapter, putChapter, type Chapter, type ChapterSummary } from './api.ts';
import type { Segment } from './build.ts';
import { chapterPlace, groupChapters, readChapterFile, readText, type ChapterFile, type ChapterImport, type Lang } from './chapters.ts';
import { between } from './order.ts';
import styles from './Timeline.module.css';

const LANG_NAMES: Record<Lang, string> = { de: 'Deutsch', en: 'English' };
const langsOf = (c: { de: unknown; en: unknown }) => (['de', 'en'] as const).filter((l) => c[l]);
/** A chapter's title in its first language, the other beside it. */
export const chapterTitle = (c: { de: { title: string } | null; en: { title: string } | null }) => c.de?.title ?? c.en?.title ?? '';

/** What the timeline shows of a chapter: where it stands in the chronicle, its titles, and the way to read it. */
export function ChapterCard({ c, onRead }: { c: ChapterSummary; onRead: (lang: Lang) => void }) {
  const first = c.de ?? c.en!;
  return (
    <>
      <small className={styles.meta}>Chapter{first.label ? ` · ${first.label}` : ''}{first.icDate ? ` · ${first.icDate}` : ''}{first.place ? ` · ${first.place}` : ''}</small>
      <p className={styles.chapterTitle} lang={c.de ? 'de' : 'en'}>{first.title}</p>
      {c.de && c.en && <p className={ui.muted} lang="en">{c.en.title}</p>}
      <div className={styles.read}>
        {langsOf(c).map((l) => <button key={l} type="button" className={ui.buttonQuiet} onClick={() => onRead(l)} aria-label={`Read ${chapterTitle(c)} in ${LANG_NAMES[l]}`}>Read · {LANG_NAMES[l]}</button>)}
      </div>
    </>
  );
}

/** A chapter to read, in either of its languages: its text kept on the device once read. */
export function ChapterSheet({ dialogRef, close, cid, chapter, lang, canRemove, onRemove }: {
  dialogRef: RefObject<HTMLDialogElement | null>; close: (then?: () => void) => void; cid: string;
  chapter: ChapterSummary | null; lang: Lang; canRemove: boolean; onRemove: (c: ChapterSummary) => void;
}) {
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby="chapter-title">
      {chapter && <ChapterReader key={`${chapter.id}:${chapter.updatedAt}:${lang}`} close={close} cid={cid} c={chapter} first={lang} canRemove={canRemove} onRemove={onRemove} />}
    </dialog>
  );
}

function ChapterReader({ close, cid, c, first, canRemove, onRemove }: { close: (then?: () => void) => void; cid: string; c: ChapterSummary; first: Lang; canRemove: boolean; onRemove: (c: ChapterSummary) => void }) {
  const [lang, setLang] = useState<Lang>(first);
  const [full, setFull] = useState<Chapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    getChapter(cid, c).then((x) => { if (live) setFull(x); }).catch((e: unknown) => { if (live) setError(errorText(e)); });
    return () => { live = false; };
  }, [cid, c]);
  const shown = (full ?? c)[lang] ?? (full ?? c)[lang === 'de' ? 'en' : 'de'];
  const text = full?.[lang]?.text;
  return (
    <div className={ui.page} lang={lang}>
      <div>
        <small className={styles.meta}>{shown?.label}{shown?.icDate ? ` · ${shown.icDate}` : ''}{shown?.place ? ` · ${shown.place}` : ''}</small>
        <h2 id="chapter-title">{shown?.title}</h2>
      </div>
      {langsOf(c).length > 1 && (
        <div className={ui.row} role="group" aria-label="Language">
          {langsOf(c).map((l) => <button key={l} type="button" className={ui.buttonQuiet} aria-pressed={lang === l} onClick={() => setLang(l)}>{LANG_NAMES[l]}</button>)}
        </div>
      )}
      {shown?.victor && <p className={styles.victor}>{shown.victor}</p>}
      {error && !full && <p className={ui.message} role="alert">{error}</p>}
      {!full && !error && <p className={ui.muted}>Loading the chapter…</p>}
      {text !== undefined && (
        <div className={styles.chapterText}>
          {readText(text).map((p, i) => (p.kind === 'heading'
            ? <h3 key={i}>{p.text}</h3>
            : p.kind === 'rule' ? <hr key={i} />
              : <p key={i}>{p.pieces.map((x, j) => (x.strong ? <strong key={j}>{x.text}</strong> : <span key={j}>{x.text}</span>))}</p>))}
        </div>
      )}
      <div className={ui.row}>
        <button type="button" className={ui.button} onClick={() => close()}>Done</button>
        {canRemove && <button type="button" className={ui.buttonQuiet} onClick={() => close(() => onRemove(c))}>Take the chapter out</button>}
      </div>
    </div>
  );
}

/* ---- importing (a leader) ---- */

const textOf = (f: File) => (typeof f.text === 'function' ? f.text() : new Promise<string>((ok, no) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result));
  r.onerror = () => no(r.error);
  r.readAsText(f);
}));

interface ImportProps { cid: string; segs: Segment[]; battles: BattleSummary[]; chapters: ChapterSummary[]; onDone: (n: number) => void }

export function ImportChaptersSheet({ dialogRef, close, formKey, ...rest }: { dialogRef: RefObject<HTMLDialogElement | null>; close: (then?: () => void) => void; formKey: number } & ImportProps) {
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby="import-chapters-title">
      <ImportForm key={formKey} close={close} {...rest} />
    </dialog>
  );
}

function ImportForm({ close, cid, segs, battles, chapters, onDone }: ImportProps & { close: (then?: () => void) => void }) {
  const fileId = useId();
  const [found, setFound] = useState<ChapterImport[]>([]);
  const [problems, setProblems] = useState<{ file: string; problem: string }[]>([]);
  const [places, setPlaces] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keys = segs.map((s) => s.key);
  const there = (ref: string) => chapters.find((c) => c.refKey === ref);
  const placeNow = (id: string) => segs.find((s) => s.blocks.some((b) => b.id === id))?.key;

  const pick = async (list: FileList | null) => {
    setError(null);
    const read = await Promise.all([...(list ?? [])].map(async (f) => readChapterFile(f.name, await textOf(f))));
    const ok = read.filter((r): r is ChapterFile => !('problem' in r));
    const all = groupChapters(ok);
    setFound(all);
    setProblems(read.filter((r): r is { file: string; problem: string } => 'problem' in r));
    setPlaces(Object.fromEntries(all.map((c) => {
      const old = there(c.refKey);
      return [c.refKey, (old && placeNow(old.id)) ?? chapterPlace(c, [...all, ...chapters.filter((x) => !all.some((y) => y.refKey === x.refKey))], battles, keys)];
    })));
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      // the chapters going to one place stand at its head, in the order they were published
      const sent: Record<string, { segment: string; pos: string } | undefined> = {};
      for (const key of new Set(Object.values(places))) {
        const going = found.filter((c) => places[c.refKey] === key && (!there(c.refKey) || placeNow(there(c.refKey)!.id) !== key));
        const ids = new Set(going.map((c) => there(c.refKey)?.id));
        let hi = segs.find((s) => s.key === key)?.blocks.find((b) => !ids.has(b.id))?.key ?? null;
        for (const c of [...going].reverse()) {
          const pos = between(null, hi);
          sent[c.refKey] = { segment: key, pos };
          hi = pos;
        }
      }
      for (const c of found) {
        const place = sent[c.refKey];
        await putChapter(cid, there(c.refKey)?.id ?? newId(), { refKey: c.refKey, kind: c.kind, publishedOn: c.publishedOn, de: c.de, en: c.en, ...(place ? { place } : {}) });
      }
      close(() => onDone(found.length));
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  return (
    <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <h2 id="import-chapters-title">Import chapters</h2>
      <p className={ui.muted}>
        The chronicle’s own files (Markdown with its front matter): German and English files of the same chapter become one.
        Each stands at the head of the part of the story it tells; a chapter imported again keeps its place.
      </p>
      <label className={ui.field} htmlFor={fileId}>
        <span>Chapter files</span>
        <input id={fileId} className={ui.input} type="file" multiple accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={(e) => void pick(e.target.files)} />
      </label>
      {problems.length > 0 && (
        <ul className={`${ui.message} ${ui.error}`} aria-label="Files not read">
          {problems.map((p) => <li key={p.file}>{p.file}: {p.problem}</li>)}
        </ul>
      )}
      {found.length > 0 && (
        <ul className={styles.importList} aria-label="Chapters to import">
          {found.map((c) => (
            <li key={c.refKey}>
              <label className={ui.field}>
                <span>
                  {(c.de ?? c.en)!.label || c.refKey} · {chapterTitle(c)}
                  <small> · {langsOf(c).map((l) => LANG_NAMES[l]).join(', ')}{there(c.refKey) ? ' · imported again' : ''}</small>
                </span>
                <select className={ui.select} value={places[c.refKey] ?? 'pre'} onChange={(e) => setPlaces((p) => ({ ...p, [c.refKey]: e.target.value }))}>
                  {segs.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      <div className={ui.row}>
        <button type="submit" className={ui.button} disabled={busy || found.length === 0}>{found.length ? `Import ${found.length} chapter${found.length === 1 ? '' : 's'}` : 'Import'}</button>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </form>
  );
}
