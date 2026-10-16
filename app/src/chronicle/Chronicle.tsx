/* The Chronicle tab (phase 4b5a; docs/mockups/chronicle.html): the whole
   story as written, chapter by chapter, for everyone in the campaign. The
   chapters are the published ones the Timeline already holds, in the order
   of the story; each is read where it stands, in Deutsch or English, and
   the whole can be downloaded as one .md file. Reading works from what the
   device kept; the text of a chapter is fetched when it is opened. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorText } from '../account/api.ts';
import type { CampaignView } from '../campaign/api.ts';
import { cachedTimeline, getChapter, getTimeline, type Chapter, type ChapterSummary, type TimelineData } from '../timeline/api.ts';
import { buildTimeline } from '../timeline/build.ts';
import { readText, type Lang } from '../timeline/chapters.ts';
import timeline from '../timeline/Timeline.module.css';
import { fileSlug, saveFile } from '../ui/files.ts';
import ui from '../ui/ui.module.css';
import styles from './Chronicle.module.css';
import { chronicleMarkdown, LANG_NAMES, told } from './download.ts';

const KIND: Record<string, string> = { prologue: 'Prologue', battle: 'Battle', interlude: 'Interlude', chapter: 'Chapter' };

/** The text of a chapter, fetched when it is opened. */
function ChapterText({ cid, c, lang }: { cid: string; c: ChapterSummary; lang: Lang }) {
  const [full, setFull] = useState<Chapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    getChapter(cid, c).then((x) => { if (live) setFull(x); }).catch((e: unknown) => { if (live) setError(errorText(e)); });
    return () => { live = false; };
  }, [cid, c]);
  const t = full ? told(full, lang) : null;
  if (error && !full) return <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>;
  if (!t) return <p className={ui.muted}>Loading the chapter…</p>;
  return (
    <div className={timeline.chapterText} lang={t.lang}>
      {readText(t.fields.text).map((p, i) => (p.kind === 'heading'
        ? <h3 key={i}>{p.text}</h3>
        : p.kind === 'rule' ? <hr key={i} />
          : <p key={i}>{p.pieces.map((x, j) => (x.strong ? <strong key={j}>{x.text}</strong> : <span key={j}>{x.text}</span>))}</p>))}
    </div>
  );
}

export function ChronicleTab({ id, view }: { id: string; view: CampaignView }) {
  const [data, setData] = useState<TimelineData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('de');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    void cachedTimeline(id).then((d) => { if (live && d) setData((cur) => cur ?? d); });
    getTimeline(id).then((d) => { if (live) { setData(d); setError(null); } }).catch((e: unknown) => { if (live) setError(errorText(e)); });
    return () => { live = false; };
  }, [id]);

  // the chapters in the order of the story, each with the part of the story it stands in
  const chapters = useMemo(() => (data
    ? buildTimeline(view.battles ?? [], [], [], data).flatMap((s) => s.blocks.flatMap((b) => (b.type === 'chapter' ? [{ segment: s.title, chapter: b.chapter }] : [])))
    : []), [data, view.battles]);

  const toggle = (cid: string) => setOpen((cur) => { const n = new Set(cur); if (n.has(cid)) n.delete(cid); else n.add(cid); return n; });

  const download = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      const full = await Promise.all(chapters.map(async (x) => ({ segment: x.segment, chapter: await getChapter(id, x.chapter) })));
      const { md, fallbacks } = chronicleMarkdown(view.campaign.name, lang, full);
      saveFile(`${fileSlug(view.campaign.name)}-chronicle-${lang}.md`, md, 'text/markdown');
      setStatus({ text: `Saved ${full.length} chapter${full.length === 1 ? '' : 's'} as a .md file${fallbacks ? ` – ${fallbacks} only in the other language, marked as such` : ''}.`, error: false });
    } catch (e) {
      setStatus({ text: `Not everything could be fetched: ${errorText(e)}`, error: true });
    } finally { setBusy(false); }
  }, [chapters, id, lang, view.campaign.name]);

  return (
    <div className={ui.page}>
      <p className={ui.muted}>The whole story as written, chapter by chapter, for everyone in the campaign. A leader brings chapters in on the Timeline.</p>
      <div className={styles.bar}>
        <div className={styles.langs} role="group" aria-label="Language">
          {(['de', 'en'] as const).map((l) => (
            <button key={l} type="button" className={ui.buttonQuiet} aria-pressed={lang === l} onClick={() => setLang(l)}>{LANG_NAMES[l]}</button>
          ))}
        </div>
        <button type="button" className={ui.button} disabled={busy || chapters.length === 0} onClick={() => void download()}>Download all (.md)</button>
      </div>
      {status && <p className={`${ui.message} ${status.error ? ui.error : ''}`} role={status.error ? 'alert' : 'status'}>{status.text}</p>}
      {error && <p className={ui.message} role="status">{error}{data ? ' Shown as last seen.' : ''}</p>}
      {!data && !error && <p className={ui.muted}>Loading the chronicle…</p>}
      {data && chapters.length === 0 && <p className={ui.muted}>No chapter has been published yet.</p>}
      <ol className={styles.list} aria-label="Chapters">
        {chapters.map(({ segment, chapter: c }) => {
          const t = told(c, lang)!;
          const f = t.fields;
          const there = (['de', 'en'] as const).filter((l) => c[l]).map((l) => LANG_NAMES[l]).join(' · ');
          const title = f.title;
          const kind = KIND[c.kind] ?? 'Chapter';
          return (
            <li key={c.id} className={styles.chapter} aria-label={title}>
              <small className={styles.meta}>{[kind === f.label ? '' : kind, f.label, f.icDate, f.place].filter(Boolean).join(' · ')}</small>
              <h2 lang={t.lang}>{title}</h2>
              <small className={styles.meta}>{segment} · {there}{t.fallback ? ` – shown in ${LANG_NAMES[t.lang]}` : ''}</small>
              {f.victor && <p className={timeline.victor} lang={t.lang}>{f.victor}</p>}
              {open.has(c.id) && <ChapterText cid={id} c={c} lang={lang} />}
              <div className={timeline.read}>
                <button type="button" className={ui.buttonQuiet} aria-expanded={open.has(c.id)} aria-label={`${open.has(c.id) ? 'Hide' : 'Read'} ${title}`} onClick={() => toggle(c.id)}>
                  {open.has(c.id) ? 'Hide' : 'Read'}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
