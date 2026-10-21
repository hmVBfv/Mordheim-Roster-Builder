/* The Library (ADR 0023): what a person writes without a campaign, kept with the account – ideas first, later
   factions, NPCs, groups and scenarios. Private: only its owner reads it. Reading works from what the device
   kept; writing needs the connection. */
import { lazy, Suspense, useState } from 'react';
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
import { MAX_IDEA, MAX_NAME, MAX_STATUS, putFaction, putIdea, removeItem, staleItem, TOPIC_NAMES, TOPICS, type Faction, type FactionBody, type Idea, type IdeaBody, type Topic } from './api.ts';
import styles from './Library.module.css';
import { LoreTab } from './LoreTab.tsx';
import { NpcsTab } from './NpcsTab.tsx';

import { LIBRARY_TABS } from './tabs.ts';
import { factionsOf, useLibrary } from './useLibrary.ts';

const GroupsTab = lazy(() => import('./GroupsTab.tsx').then((m) => ({ default: m.GroupsTab })));

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
      const cur = staleItem<IdeaBody>(e);
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

function FactionForm({ faction, online, close, onSaved, onRemoved }: {
  faction: Faction | null; online: boolean; close: (then?: () => void) => void; onSaved: (f: Faction) => void; onRemoved: (f: Faction) => void;
}) {
  const [name, setName] = useState(faction?.name ?? '');
  const [de, setDe] = useState(faction?.body.de ?? '');
  const [status, setStatus] = useState(faction?.body.status ?? '');
  const [lore, setLore] = useState(faction?.body.lore ?? '');
  const [base, setBase] = useState<number | undefined>(faction?.seq);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [id] = useState(() => faction?.id ?? newId());

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await putFaction(id, name.trim(), { de: de.trim(), status: status.trim(), lore }, base);
      close(() => onSaved(saved));
    } catch (e) {
      const cur = staleItem<FactionBody>(e);
      if (cur) {
        setBase(cur.seq);
        setError(`This faction was changed on another device while you were writing. Theirs: “${cur.name}${cur.body.status ? ` – ${cur.body.status}` : ''}” – save again to replace it with yours.`);
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
      close(() => onRemoved(faction!));
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <h2 id="faction-form-title">{faction ? 'Edit faction' : 'A new faction'}</h2>
      {!online && <p className={`${ui.message} ${ui.error}`}>Saving needs the connection.</p>}
      <label className={ui.field}>
        <span>Name (English)</span>
        <input className={ui.input} value={name} maxLength={MAX_NAME} autoComplete="off" onChange={(e) => setName(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>Name (German)</span>
        <input className={ui.input} value={de} maxLength={MAX_NAME} autoComplete="off" placeholder="as the German chronicle spells it, if it differs" onChange={(e) => setDe(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>What the players may read</span>
        <input className={ui.input} value={status} maxLength={MAX_STATUS} autoComplete="off" placeholder="Known in the drowned quarter" onChange={(e) => setStatus(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>The lore</span>
        <textarea className={ui.textarea} rows={8} value={lore} maxLength={MAX_IDEA} onChange={(e) => setLore(e.target.value)} />
      </label>
      <p className={ui.muted}>Only you see the Library. In a campaign’s World a leader adds the faction from here: the names and what the players may read go along as a copy; the lore stays with you.</p>
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {asking ? (
        <div className={ui.page}>
          <p>Remove it for good? It is gone on every device. Campaigns that already have a copy keep it; a warrior who belongs to it keeps its name.</p>
          <div className={ui.row}>
            <button type="button" className={ui.button} disabled={busy || !online} onClick={() => void remove()}>Yes, remove it</button>
            <button type="button" className={ui.buttonQuiet} onClick={() => setAsking(false)}>Keep it</button>
          </div>
        </div>
      ) : (
        <div className={ui.row}>
          <button type="submit" className={ui.button} disabled={busy || !online || !name.trim()}>Save</button>
          <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
          {faction && <button type="button" className={ui.buttonQuiet} disabled={busy} onClick={() => setAsking(true)}>Remove this faction</button>}
        </div>
      )}
    </form>
  );
}

function FactionsTab({ notify }: { notify: (t: string) => void }) {
  const online = useOnline();
  const { items, setItems, error } = useLibrary();
  const { ref, open, close } = useSheet('faction-form');
  const [editing, setEditing] = useState<{ faction: Faction | null; key: number } | null>(null);
  const factions = factionsOf(items);
  const edit = (faction: Faction | null) => { setEditing((e) => ({ faction, key: (e?.key ?? 0) + 1 })); open(); };
  const reachable = online && !error;

  return (
    <section className={ui.page} aria-labelledby="factions-title">
      <h2 id="factions-title" className={styles.title}>Factions</h2>
      <p className={ui.muted}>Groups, houses, cults and powers of your own world, written once. A warrior of any of your warbands can belong to one, and a leader adds one to a campaign’s World from here. Only you see this.</p>
      {error && <p className={ui.message} role="status">{error}{items ? ' Shown as last seen.' : ''}</p>}
      {!items && !error && <p className={ui.muted}>Loading the factions…</p>}
      {items && factions.length === 0 && <p className={ui.muted}>No factions yet. Write the first one down.</p>}
      {factions.length > 0 && (
        <ul className={styles.list} aria-label="Factions">
          {factions.map((f) => (
            <li key={f.id} className={styles.idea}>
              <div className={styles.head}>
                <strong>{f.name}</strong>
                {f.body.de && f.body.de !== f.name && <span className={styles.chip}>{f.body.de}</span>}
              </div>
              {f.body.status && <p className={styles.excerpt}>{f.body.status}</p>}
              {f.body.lore && <p className={styles.excerpt}>{f.body.lore.length > 200 ? `${f.body.lore.slice(0, 200)}…` : f.body.lore}</p>}
              <small className={styles.meta}>Changed <time dateTime={f.updatedAt}>{stamp(f.updatedAt)}</time></small>
              <div className={ui.row}><button type="button" className={ui.buttonQuiet} aria-label={`Edit ${f.name}`} onClick={() => edit(f)}>Edit</button></div>
            </li>
          ))}
        </ul>
      )}
      <div className={ui.row}><button type="button" className={ui.button} onClick={() => edit(null)}>New faction</button></div>
      <dialog ref={ref} className={ui.sheet} aria-labelledby="faction-form-title">
        {editing && (
          <FactionForm key={editing.key} faction={editing.faction} online={reachable} close={close}
            onSaved={(f) => { setItems((cur) => [f, ...(cur ?? []).filter((x) => x.id !== f.id)]); notify('Faction saved. Only you see it.'); }}
            onRemoved={(f) => { setItems((cur) => (cur ?? []).filter((x) => x.id !== f.id)); notify('Faction removed.'); }} />
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
      {tab === 'factions' && <FactionsTab notify={notify} />}
      {tab === 'npcs' && <NpcsTab notify={notify} />}
      {tab === 'groups' && <Suspense fallback={<p className={ui.muted}>Loading…</p>}><GroupsTab notify={notify} /></Suspense>}
      {tab === 'lore' && <LoreTab notify={notify} />}
      {notice}
    </section>
  );
}
