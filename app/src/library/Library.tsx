/* The Library (ADR 0023): what a person writes without a campaign, kept with the account – ideas first, later
   factions, NPCs, groups and scenarios. Private: only its owner reads it. Reading works from what the device
   kept; writing needs the connection. */
import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, useParams } from 'react-router';
import { errorText } from '../account/api.ts';
import accountStyles from '../account/Account.module.css';
import { useSession } from '../account/session.ts';
import { stamp } from '../account/time.ts';
import { useOnline } from '../app/SyncState.tsx';
import { newId } from '../db/ids.ts';
import { useNotice } from '../ui/Notice.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { cachedLibrary, getLibrary, MAX_IDEA, MAX_NAME, putIdea, removeItem, staleItem, TOPIC_NAMES, TOPICS, type Idea, type LibraryItem, type Topic } from './api.ts';
import styles from './Library.module.css';
import { LIBRARY_TABS } from './tabs.ts';

/** The entries of the account: what the device kept first, then the server's. */
function useLibrary() {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void cachedLibrary().then((c) => { if (live && c) setItems((cur) => cur ?? c); });
    getLibrary().then((l) => { if (live) { setItems(l); setError(null); } }).catch((e: unknown) => { if (live) setError(errorText(e)); });
    return () => { live = false; };
  }, []);
  return { items, setItems, error };
}

function IdeaForm({ idea, online, close, onSaved, onRemoved }: {
  idea: Idea | null; online: boolean; close: (then?: () => void) => void; onSaved: (i: Idea) => void; onRemoved: (i: Idea) => void;
}) {
  const [name, setName] = useState(idea?.name ?? '');
  const [topic, setTopic] = useState<Topic>(idea?.body.topic ?? 'other');
  const [text, setText] = useState(idea?.body.text ?? '');
  const [base, setBase] = useState<number | undefined>(idea?.seq);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [id] = useState(() => idea?.id ?? newId());

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await putIdea(id, name.trim(), { text, topic }, base);
      close(() => onSaved(saved));
    } catch (e) {
      const cur = staleItem(e);
      if (cur) {
        setBase(cur.seq);
        setError(`This idea was changed on another device while you were writing. Theirs: “${cur.body.text.slice(0, 200)}${cur.body.text.length > 200 ? '…' : ''}” – save again to replace it with yours.`);
      } else setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await removeItem(id);
      close(() => onRemoved(idea!));
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <h2 id="idea-form-title">{idea ? 'Edit idea' : 'A new idea'}</h2>
      {!online && <p className={`${ui.message} ${ui.error}`}>Saving needs the connection.</p>}
      <label className={ui.field}>
        <span>Title</span>
        <input className={ui.input} value={name} maxLength={MAX_NAME} autoComplete="off" onChange={(e) => setName(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>About</span>
        <select className={ui.select} value={topic} onChange={(e) => setTopic(e.target.value as Topic)}>
          {TOPICS.map((t) => <option key={t} value={t}>{TOPIC_NAMES[t]}</option>)}
        </select>
      </label>
      <label className={ui.field}>
        <span>The idea</span>
        <textarea className={ui.textarea} rows={8} value={text} maxLength={MAX_IDEA} onChange={(e) => setText(e.target.value)} />
      </label>
      <p className={ui.muted}>Only you see it. Later an idea can become a faction, a campaign or a warband.</p>
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {asking ? (
        <div className={ui.page}>
          <p>Remove it for good? It is gone on every device.</p>
          <div className={ui.row}>
            <button type="button" className={ui.button} disabled={busy || !online} onClick={() => void remove()}>Yes, remove it</button>
            <button type="button" className={ui.buttonQuiet} onClick={() => setAsking(false)}>Keep it</button>
          </div>
        </div>
      ) : (
        <div className={ui.row}>
          <button type="submit" className={ui.button} disabled={busy || !online || !name.trim()}>Save</button>
          <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
          {idea && <button type="button" className={ui.buttonQuiet} disabled={busy} onClick={() => setAsking(true)}>Remove this idea</button>}
        </div>
      )}
    </form>
  );
}

function IdeasTab({ notify }: { notify: (t: string) => void }) {
  const online = useOnline();
  const { items, setItems, error } = useLibrary();
  const { ref, open, close } = useSheet('idea-form');
  const [editing, setEditing] = useState<{ idea: Idea | null; key: number } | null>(null);
  const ideas = (items ?? []).filter((i): i is Idea => i.kind === 'idea');
  const edit = (idea: Idea | null) => { setEditing((e) => ({ idea, key: (e?.key ?? 0) + 1 })); open(); };
  // while the server does not answer, the sheet says that saving needs it
  const reachable = online && !error;

  return (
    <section className={ui.page} aria-labelledby="ideas-title">
      <h2 id="ideas-title" className={styles.title}>Ideas</h2>
      <p className={ui.muted}>Memory aids for campaigns, factions and warbands you may build one day. Only you see them, on every device you sign in on.</p>
      {error && <p className={ui.message} role="status">{error}{items ? ' Shown as last seen.' : ''}</p>}
      {!items && !error && <p className={ui.muted}>Loading the ideas…</p>}
      {items && ideas.length === 0 && <p className={ui.muted}>No ideas yet. Write the first one down.</p>}
      {ideas.length > 0 && (
        <ul className={styles.list} aria-label="Ideas">
          {ideas.map((i) => (
            <li key={i.id} className={styles.idea}>
              <div className={styles.head}>
                <strong>{i.name}</strong>
                <span className={styles.chip}>{TOPIC_NAMES[i.body.topic]}</span>
              </div>
              {i.body.text && <p className={styles.excerpt}>{i.body.text.length > 240 ? `${i.body.text.slice(0, 240)}…` : i.body.text}</p>}
              <small className={styles.meta}>Changed <time dateTime={i.updatedAt}>{stamp(i.updatedAt)}</time></small>
              <div className={ui.row}><button type="button" className={ui.buttonQuiet} aria-label={`Edit ${i.name}`} onClick={() => edit(i)}>Edit</button></div>
            </li>
          ))}
        </ul>
      )}
      <div className={ui.row}><button type="button" className={ui.button} onClick={() => edit(null)}>New idea</button></div>
      <dialog ref={ref} className={ui.sheet} aria-labelledby="idea-form-title">
        {editing && (
          <IdeaForm key={editing.key} idea={editing.idea} online={reachable} close={close}
            onSaved={(i) => { setItems((cur) => [i, ...(cur ?? []).filter((x) => x.id !== i.id)]); notify('Idea saved. Only you see it.'); }}
            onRemoved={(i) => { setItems((cur) => (cur ?? []).filter((x) => x.id !== i.id)); notify('Idea removed.'); }} />
        )}
      </dialog>
    </section>
  );
}

export function Library() {
  const { tab = 'ideas' } = useParams();
  const session = useSession();
  const [notice, notify] = useNotice();
  const user = session.status === 'in' ? session.user : null;
  if (session.status === 'loading') return <section className={ui.page}><h1>Library</h1></section>;
  if (!user) {
    return (
      <section className={ui.page}>
        <h1>Library</h1>
        <p>{session.status === 'unreachable' ? 'The campaign server does not answer right now.' : 'The Library is kept with your account: sign in to write in it.'}</p>
        {session.status !== 'unreachable' && <p><Link to="/sign-in" className={ui.button}>Sign in</Link></p>}
      </section>
    );
  }
  if (!LIBRARY_TABS.some((t) => t.key === tab)) return <Navigate to="/library/ideas" replace />;
  return (
    <section className={ui.page}>
      <h1>Library</h1>
      <nav className={`${accountStyles.tabs} ${accountStyles.sideTabs}`} aria-label="Library">
        {LIBRARY_TABS.map((t) => <NavLink key={t.key} to={`/library/${t.key}`}>{t.label}</NavLink>)}
      </nav>
      {tab === 'ideas' && <IdeasTab notify={notify} />}
      {notice}
    </section>
  );
}
