/* The campaign's Background tab (phase 4b1; concept.md 4.8, docs/mockups/
   background.html): the leaders' side of the story – threads with the truth
   behind them and how much of it the story may show, people, places,
   planned scenarios, notes for the game master. Only a leader with the
   authenticator gets here, and the server sends nothing of it to anyone
   else (ADR 0011). Revealing is a deliberate step: the words written there
   become a public note in the timeline; the truth stays where it is. */
import { lazy, Suspense, useId, useMemo, useState } from 'react';
import { errorText } from '../account/api.ts';
import { battleTitle } from '../battle/api.ts';
import type { CampaignView } from '../campaign/api.ts';
import { newId } from '../db/ids.ts';
import { buildTimeline } from '../timeline/build.ts';
import { useNotice } from '../ui/Notice.tsx';
import { Empty } from '../art/Pixels.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import {
  endOfSegment, getEntry, KIND_NAMES, KIND_ONE, KINDS, LEVEL_NAMES, LEVEL_TEXT, putEntry, removeEntry, revealEntry, staleEntry,
  type Detail, type Entry, type EntryBody, type Kind, type Level, type Ref, type Status,
} from './api.ts';
import { PlansSection } from '../plans/Plans.tsx';

const OpponentsSection = lazy(() => import('../opponents/Opponents.tsx').then((m) => ({ default: m.OpponentsSection })));
import styles from './Background.module.css';
import { useBackground } from './useBackground.ts';

const STATUS_NAMES: Record<Status, string> = { planned: 'planned', active: 'active', resolved: 'resolved' };
const DOTS: Record<Level, number> = { hidden: 0, hint: 1, revealed: 3 };

function Dots({ level }: { level: Level }) {
  return <span className={styles.dots} aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} className={i < DOTS[level] ? styles.on : undefined} />)}</span>;
}

const stamp = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** The places a revealed note may stand: the timeline's own anchors for this campaign's battles. A battle's own anchors belong to it; an interlude to the last battle of its round – the one it follows. */
export function placesOf(view: CampaignView): { key: string; title: string; battleId: string | null }[] {
  const battles = view.battles ?? [];
  const lastOf = (round: number) => [...battles].filter((b) => b.round === round).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1)?.id ?? null;
  return buildTimeline(battles, [], [], { positions: [], entries: [], outcomes: [], marks: [] })
    .map((s) => ({ key: s.key, title: s.title, battleId: /^b([0-9a-f-]{36}):/.exec(s.key)?.[1] ?? (/^i(\d+)$/.test(s.key) ? lastOf(Number(s.key.slice(1))) : null) }));
}

function EntryCard({ e, battles, onReveal, onEdit, onHistory }: { e: Entry; battles: CampaignView['battles']; onReveal: () => void; onEdit: () => void; onHistory: () => void }) {
  const from = e.revealFromBattle ? (battles ?? []).find((b) => b.id === e.revealFromBattle) : undefined;
  const about = e.battleId ? (battles ?? []).find((b) => b.id === e.battleId) : undefined;
  return (
    <li className={styles.card}>
      <div className={styles.head}><h3>{e.title}</h3><span className={styles.status}>{STATUS_NAMES[e.status]}</span></div>
      <div className={styles.level}>
        <Dots level={e.reveal} />
        <span><b>{LEVEL_NAMES[e.reveal]}</b></span>
        <small>
          {e.reveal === 'hint' ? (e.hintLimits ? `Limit: “${e.hintLimits}”` : 'No limit written down yet.') : e.reveal === 'hidden' ? 'Nothing may be hinted yet.' : from ? `Public since ${battleTitle(from)}.` : 'Public.'}
        </small>
      </div>
      {about && <small className={ui.muted}>For {battleTitle(about)}</small>}
      <div className={styles.part}>
        <small>Truth <span className={styles.warn}>⚑</span></small>
        <p className={styles.truth}>{e.truth || <span className={ui.muted}>Not written yet.</span>}</p>
      </div>
      <div className={styles.part}>
        <small>What the players know</small>
        <p>{e.playersKnow || <span className={ui.muted}>Nothing yet.</span>}</p>
      </div>
      {e.refs.length > 0 && <ul className={styles.refs} aria-label="Refers to">{e.refs.map((r, i) => <li key={`${r.kind}:${r.id}:${i}`}>{r.label}</li>)}</ul>}
      {e.lastReveal && <p className={styles.log}>Last: {e.lastReveal.by} {e.lastReveal.level === 'revealed' ? 'revealed' : 'hinted'} · {stamp(e.lastReveal.at)}</p>}
      <div className={styles.acts}>
        {e.reveal !== 'revealed' && <button type="button" className={ui.button} onClick={onReveal}>Reveal…</button>}
        <button type="button" className={ui.buttonQuiet} onClick={onEdit}>Edit</button>
        <button type="button" className={ui.buttonQuiet} onClick={onHistory}>Earlier wordings</button>
      </div>
    </li>
  );
}

const blank = (kind: Kind): EntryBody => ({ kind, title: '', truth: '', playersKnow: '', status: 'planned', reveal: 'hidden', hintLimits: '', revealFromBattle: null, refs: [], battleId: null });

function EntryForm({ close, battles, entry, kind, onSave, onRemove, problem }: {
  close: (then?: () => void) => void; battles: NonNullable<CampaignView['battles']>; entry: Entry | null; kind: Kind;
  onSave: (b: EntryBody) => void; onRemove: (() => void) | null; problem: string | null;
}) {
  const ids = { kind: useId(), title: useId(), truth: useId(), know: useId(), status: useId(), level: useId(), limit: useId(), battle: useId(), from: useId(), ref: useId() };
  const [b, setB] = useState<EntryBody>(entry ? { kind: entry.kind, title: entry.title, truth: entry.truth, playersKnow: entry.playersKnow, status: entry.status, reveal: entry.reveal, hintLimits: entry.hintLimits, revealFromBattle: entry.revealFromBattle, refs: entry.refs, battleId: entry.battleId } : blank(kind));
  const [sure, setSure] = useState(false);
  const [text, setText] = useState('');
  const set = <K extends keyof EntryBody>(k: K, v: EntryBody[K]) => setB((x) => ({ ...x, [k]: v }));
  const addRef = (r: Ref) => { if (!b.refs.some((x) => x.kind === r.kind && x.id === r.id && x.label === r.label) && b.refs.length < 30) set('refs', [...b.refs, r]); };
  const wantsBattle = b.kind === 'gm_note' || b.kind === 'scenario';
  return (
    <form className={ui.page} onSubmit={(e) => { e.preventDefault(); onSave({ ...b, title: b.title.trim(), revealFromBattle: b.reveal === 'revealed' ? b.revealFromBattle : null }); }}>
      <h2 id="background-title">{entry ? `Edit the ${KIND_ONE[b.kind].toLowerCase()}` : `New ${KIND_ONE[b.kind].toLowerCase()}`}</h2>
      <p className={styles.secret}>⚑ Leaders only. This is never sent to players, never in an export, never in a repository.</p>
      {!entry && (
        <label className={ui.field} htmlFor={ids.kind}>
          <span>Kind</span>
          <select id={ids.kind} className={ui.select} value={b.kind} onChange={(e) => set('kind', e.target.value as Kind)}>
            {KINDS.map((k) => <option key={k} value={k}>{KIND_ONE[k]}</option>)}
          </select>
        </label>
      )}
      <label className={ui.field} htmlFor={ids.title}>
        <span>Title</span>
        <input id={ids.title} className={ui.select} value={b.title} maxLength={200} required onChange={(e) => set('title', e.target.value)} />
      </label>
      <label className={ui.field} htmlFor={ids.truth}>
        <span>Truth ⚑</span>
        <textarea id={ids.truth} className={`${ui.textarea} ${ui.writing}`} rows={4} maxLength={20000} value={b.truth} onChange={(e) => set('truth', e.target.value)} />
      </label>
      <label className={ui.field} htmlFor={ids.know}>
        <span>What the players know</span>
        <textarea id={ids.know} className={`${ui.textarea} ${ui.writing}`} rows={3} maxLength={20000} value={b.playersKnow} onChange={(e) => set('playersKnow', e.target.value)} />
      </label>
      <label className={ui.field} htmlFor={ids.status}>
        <span>Status</span>
        <select id={ids.status} className={ui.select} value={b.status} onChange={(e) => set('status', e.target.value as Status)}>
          {(Object.keys(STATUS_NAMES) as Status[]).map((s) => <option key={s} value={s}>{STATUS_NAMES[s]}</option>)}
        </select>
      </label>
      <label className={ui.field} htmlFor={ids.level}>
        <span>How much may the story show?</span>
        <select id={ids.level} className={ui.select} value={b.reveal} onChange={(e) => set('reveal', e.target.value as Level)}>
          {(Object.keys(LEVEL_NAMES) as Level[]).map((l) => <option key={l} value={l}>{LEVEL_NAMES[l]} – {LEVEL_TEXT[l]}</option>)}
        </select>
      </label>
      {b.reveal === 'hint' && (
        <label className={ui.field} htmlFor={ids.limit}>
          <span>Limit for hints</span>
          <input id={ids.limit} className={ui.select} value={b.hintLimits} maxLength={1000} placeholder="Traces yes – the name never." onChange={(e) => set('hintLimits', e.target.value)} />
        </label>
      )}
      {b.reveal === 'revealed' && (
        <label className={ui.field} htmlFor={ids.from}>
          <span>Public from</span>
          <select id={ids.from} className={ui.select} value={b.revealFromBattle ?? ''} onChange={(e) => set('revealFromBattle', e.target.value || null)}>
            <option value="">No battle in particular</option>
            {battles.map((x) => <option key={x.id} value={x.id}>{battleTitle(x)}</option>)}
          </select>
        </label>
      )}
      {wantsBattle && (
        <label className={ui.field} htmlFor={ids.battle}>
          <span>For which battle?</span>
          <select id={ids.battle} className={ui.select} value={b.battleId ?? ''} onChange={(e) => set('battleId', e.target.value || null)}>
            <option value="">None yet</option>
            {battles.map((x) => <option key={x.id} value={x.id}>{battleTitle(x)}</option>)}
          </select>
        </label>
      )}
      <div className={ui.field}>
        <label htmlFor={ids.ref}>Refers to (optional)</label>
        {b.refs.length > 0 && (
          <ul className={styles.refs} aria-label="Refers to">
            {b.refs.map((r, i) => <li key={`${r.kind}:${r.id}:${i}`}>{r.label} <button type="button" className={ui.buttonQuiet} aria-label={`Take “${r.label}” out`} onClick={() => set('refs', b.refs.filter((_, j) => j !== i))}>✕</button></li>)}
          </ul>
        )}
        <select id={ids.ref} className={ui.select} value="" onChange={(e) => { const x = battles.find((y) => y.id === e.target.value); if (x) addRef({ kind: 'battle', id: x.id, label: battleTitle(x) }); }}>
          <option value="">A battle…</option>
          {battles.map((x) => <option key={x.id} value={x.id}>{battleTitle(x)}</option>)}
        </select>
        <div className={ui.row}>
          <input className={ui.select} value={text} maxLength={120} placeholder="A person, a place, a note…" aria-label="Another reference" onChange={(e) => setText(e.target.value)} />
          <button type="button" className={ui.buttonQuiet} disabled={!text.trim()} onClick={() => { addRef({ kind: 'text', id: '', label: text.trim() }); setText(''); }}>Add</button>
        </div>
      </div>
      {problem && <p className={`${ui.message} ${ui.error}`} role="alert">{problem}</p>}
      <div className={ui.row}>
        <button type="submit" className={ui.button} disabled={!b.title.trim()}>Save</button>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
        {onRemove && !sure && <button type="button" className={ui.buttonQuiet} onClick={() => setSure(true)}>Take out…</button>}
      </div>
      {onRemove && sure && (
        <div className={ui.card} role="group" aria-label="Take it out">
          <p>Take “{entry?.title}” out? Its earlier wordings stay on the server.</p>
          <div className={ui.row}>
            <button type="button" className={ui.button} onClick={onRemove}>Take it out</button>
            <button type="button" className={ui.buttonQuiet} onClick={() => setSure(false)}>Keep it</button>
          </div>
        </div>
      )}
    </form>
  );
}

function RevealForm({ close, entry, places, onReveal, problem }: {
  close: (then?: () => void) => void; entry: Entry; places: ReturnType<typeof placesOf>;
  onReveal: (v: { text: string; lang: '' | 'de' | 'en'; place: string; level: 'hint' | 'revealed' }) => void; problem: string | null;
}) {
  const ids = { text: useId(), place: useId(), level: useId(), lang: useId() };
  const [text, setText] = useState('');
  const [lang, setLang] = useState<'' | 'de' | 'en'>('');
  const [place, setPlace] = useState(places.at(-1)?.key ?? 'pre');
  const [level, setLevel] = useState<'hint' | 'revealed'>('hint');
  return (
    <form className={ui.page} onSubmit={(e) => { e.preventDefault(); onReveal({ text: text.trim(), lang, place, level }); }}>
      <h2 id="reveal-title">Reveal to everyone</h2>
      <p className={ui.muted}>From “{entry.title}”. Only what you write here becomes public – the truth stays hidden.</p>
      <label className={ui.field} htmlFor={ids.text}>
        <span>Public note</span>
        <textarea id={ids.text} className={`${ui.textarea} ${ui.writing}`} rows={4} maxLength={20000} required value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <label className={ui.field} htmlFor={ids.place}>
        <span>Place in the timeline</span>
        <select id={ids.place} className={ui.select} value={place} onChange={(e) => setPlace(e.target.value)}>
          {places.map((p) => <option key={p.key} value={p.key}>{p.title}</option>)}
        </select>
      </label>
      <label className={ui.field} htmlFor={ids.lang}>
        <span>Language of the note</span>
        <select id={ids.lang} className={ui.select} value={lang} onChange={(e) => setLang(e.target.value as '' | 'de' | 'en')}>
          <option value="">Not said</option>
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </select>
      </label>
      <label className={ui.field} htmlFor={ids.level}>
        <span>Level afterwards</span>
        <select id={ids.level} className={ui.select} value={level} onChange={(e) => setLevel(e.target.value as 'hint' | 'revealed')}>
          <option value="hint">Hint – keep the limit</option>
          <option value="revealed">Revealed from that battle on</option>
        </select>
      </label>
      <p className={`${styles.warn} ${ui.muted}`}>⚑ This is logged. It can be corrected, not taken back from those who read it.</p>
      {problem && <p className={`${ui.message} ${ui.error}`} role="alert">{problem}</p>}
      <div className={ui.row}>
        <button type="submit" className={ui.button} disabled={!text.trim()}>Reveal to everyone</button>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </form>
  );
}

function History({ close, detail, error }: { close: () => void; detail: Detail | null; error: string | null }) {
  return (
    <div className={ui.page}>
      <h2 id="history-title">Earlier wordings</h2>
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {!detail && !error && <p className={ui.muted}>Loading…</p>}
      {detail && (
        <>
          <p className={ui.muted}>“{detail.entry.title}” – {detail.revisions.length === 0 ? 'never changed.' : `${detail.revisions.length} earlier version${detail.revisions.length === 1 ? '' : 's'}.`}</p>
          <ul className={styles.history}>
            {detail.revisions.map((r) => (
              <li key={r.editedAt + r.editedBy}>
                <small>Replaced by {r.editedBy} · {stamp(r.editedAt)}</small>
                <details><summary>{r.snapshot.title ?? 'Untitled'}</summary>
                  <p>Truth: {r.snapshot.truth || '–'}</p><p>The players knew: {r.snapshot.playersKnow || '–'}</p>
                </details>
              </li>
            ))}
          </ul>
          {detail.reveals.length > 0 && (
            <>
              <h3>Revealed</h3>
              <ul className={styles.history}>{detail.reveals.map((r) => <li key={r.noteId}>{r.by} · {stamp(r.at)} · {r.level === 'revealed' ? 'revealed' : 'hinted'}</li>)}</ul>
            </>
          )}
        </>
      )}
      <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={close}>Close</button></div>
    </div>
  );
}

export function BackgroundTab({ id, view }: { id: string; view: CampaignView }) {
  const { entries, error, refresh } = useBackground(id);
  const [kind, setKind] = useState<Kind | 'plans' | 'opponents'>('thread');
  const [editing, setEditing] = useState<Entry | null>(null);
  const [revealing, setRevealing] = useState<Entry | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [notice, notify] = useNotice();
  const { ref: editRef, open: openEditSheet, close: closeEdit } = useSheet();
  const { ref: revealRef, open: openReveal, close: closeReveal } = useSheet();
  const { ref: historyRef, open: openHistorySheet, close: closeHistory } = useSheet();
  const battles = useMemo(() => [...(view.battles ?? [])].sort((a, b) => b.round - a.round), [view.battles]);
  const places = useMemo(() => placesOf(view), [view]);
  const counts = useMemo(() => Object.fromEntries(KINDS.map((k) => [k, (entries ?? []).filter((e) => e.kind === k).length])) as Record<Kind, number>, [entries]);
  const shown = (entries ?? []).filter((e) => e.kind === kind);

  const openEdit = (e: Entry | null) => { setEditing(e); setProblem(null); setFormKey((k) => k + 1); openEditSheet(); };
  const save = (body: EntryBody) => {
    const eid = editing?.id ?? newId();
    putEntry(id, eid, body, editing?.seq ?? 0)
      .then(() => { setProblem(null); closeEdit(() => { void refresh(); notify(editing ? 'Saved.' : 'Entry saved. Only leaders see it.'); }); })
      .catch((e: unknown) => {
        const cur = staleEntry(e);
        if (cur) { setProblem(`${cur.updatedBy} changed this entry while you were editing it. Close this, look at it again and redo your change.`); void refresh(); } else setProblem(errorText(e));
      });
  };
  const remove = () => {
    if (!editing) return;
    removeEntry(id, editing.id).then(() => closeEdit(() => { void refresh(); notify('Taken out.'); })).catch((e: unknown) => setProblem(errorText(e)));
  };
  const doReveal = (v: { text: string; lang: '' | 'de' | 'en'; place: string; level: 'hint' | 'revealed' }) => {
    if (!revealing) return;
    const p = places.find((x) => x.key === v.place);
    revealEntry(id, revealing.id, { noteId: newId(), text: v.text, lang: v.lang, battleId: p?.battleId ?? null, place: { segment: v.place, pos: endOfSegment(Date.now()) }, level: v.level })
      .then(() => { setProblem(null); closeReveal(() => { void refresh(); notify(`Revealed as a public note in ${p?.title ?? 'the story'}.`); }); })
      .catch((e: unknown) => setProblem(errorText(e)));
  };
  const openHistory = (e: Entry) => {
    setDetail(null); setDetailError(null); openHistorySheet();
    getEntry(id, e.id).then(setDetail).catch((x: unknown) => setDetailError(errorText(x)));
  };

  return (
    <div className={ui.page}>
      <p className={styles.secret}>⚑ Only campaign leaders see this area. It is never sent to players, never in an export, never in a repository.</p>
      <div className={styles.kinds} role="group" aria-label="Show">
        {KINDS.map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{KIND_NAMES[k]} {counts[k]}</button>)}
        <button type="button" aria-pressed={kind === 'plans'} onClick={() => setKind('plans')}>Plans</button>
        <button type="button" aria-pressed={kind === 'opponents'} onClick={() => setKind('opponents')}>Opponents</button>
      </div>
      {kind === 'plans' && <PlansSection id={id} view={view} notify={notify} />}
      {kind === 'opponents' && <Suspense fallback={<p className={ui.muted}>Loading the opponents…</p>}><OpponentsSection id={id} view={view} notify={notify} /></Suspense>}
      {kind !== 'plans' && kind !== 'opponents' && (<>
      <details className={`${ui.card} ${styles.legend}`}>
        <summary>How much may the story show?</summary>
        {(Object.keys(LEVEL_NAMES) as Level[]).map((l) => <div key={l} className={styles.level}><Dots level={l} /><span><b>{LEVEL_NAMES[l]}</b> – {LEVEL_TEXT[l]}</span></div>)}
        <p className={ui.muted}>The AI pack carries these as hard rules; a check marks words from hidden truths in chapter drafts.</p>
      </details>
      <div className={ui.row}><button type="button" className={ui.button} onClick={() => { setEditing(null); setProblem(null); setFormKey((k) => k + 1); openEditSheet(); }}>New {KIND_ONE[kind].toLowerCase()}</button></div>
      {error && <p className={ui.message} role="status">{error}{entries ? ' Shown as last seen.' : ''}</p>}
      {entries && shown.length === 0 && <Empty scene="tome" title="Nothing here yet.">{kind === 'thread' ? 'A thread is a story the world is telling behind the players’ backs: the truth, what they know, how much may show.' : 'Write what only you know.'}</Empty>}
      <ul className={styles.list} aria-label={KIND_NAMES[kind]}>
        {shown.map((e) => <EntryCard key={e.id} e={e} battles={view.battles} onReveal={() => { setRevealing(e); setProblem(null); setFormKey((k) => k + 1); openReveal(); }} onEdit={() => openEdit(e)} onHistory={() => openHistory(e)} />)}
      </ul>
      </>)}
      <dialog ref={editRef} className={ui.sheet} aria-labelledby="background-title">
        <EntryForm key={`e${formKey}`} close={closeEdit} battles={battles} entry={editing} kind={kind === 'plans' || kind === 'opponents' ? 'thread' : kind} onSave={save} onRemove={editing ? remove : null} problem={problem} />
      </dialog>
      <dialog ref={revealRef} className={ui.sheet} aria-labelledby="reveal-title">
        {revealing && <RevealForm key={`r${formKey}`} close={closeReveal} entry={revealing} places={places} onReveal={doReveal} problem={problem} />}
      </dialog>
      <dialog ref={historyRef} className={ui.sheet} aria-labelledby="history-title">
        <History close={() => closeHistory()} detail={detail} error={detailError} />
      </dialog>
      {notice}
    </div>
  );
}
