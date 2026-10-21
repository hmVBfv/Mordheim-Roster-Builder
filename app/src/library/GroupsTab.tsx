/* The Groups tab of the Library (ADR 0023): groups of opponents – the men and beasts a leader sets against the
   warbands – written outside any campaign and kept with the account. A leader sets one against a campaign's warbands
   as a copy (opponents/GroupsFromLibrary.tsx). The profiles are the campaign's own editor, without a campaign: no own
   skills, no warriors to copy from. */
import * as core from '@mordheim/core';
import type { OpponentProfile } from '@mordheim/core';
import { Suspense, useId, useState } from 'react';
import { errorText } from '../account/api.ts';
import { stamp } from '../account/time.ts';
import { useOnline } from '../app/SyncState.tsx';
import { newId } from '../db/ids.ts';
import { MAX_PROFILES } from '../opponents/api.ts';
import opp from '../opponents/Opponents.module.css';
import { ProfileEditor, TemplatePicker, statline } from '../opponents/ProfileTools.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { MAX_NAME, putGroup, removeItem, staleItem, type GroupBody, type LibraryGroup } from './api.ts';
import styles from './Library.module.css';
import { groupsOf, useLibrary } from './useLibrary.ts';

function GroupForm({ group, online, close, onSaved, onRemoved }: {
  group: LibraryGroup | null; online: boolean; close: (then?: () => void) => void; onSaved: (g: LibraryGroup) => void; onRemoved: (g: LibraryGroup) => void;
}) {
  const ids = useId();
  const [name, setName] = useState(group?.name ?? '');
  const [note, setNote] = useState(group?.body.note ?? '');
  const [profiles, setProfiles] = useState<OpponentProfile[]>(group?.body.profiles ?? []);
  const [fresh, setFresh] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [base, setBase] = useState<number | undefined>(group?.seq);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [id] = useState(() => group?.id ?? newId());
  const full = profiles.length >= MAX_PROFILES;
  const add = (p: OpponentProfile) => { setProfiles((cur) => [...cur, p]); setFresh(p.id); };

  const save = async () => {
    if (!name.trim()) { setError('Give the group a name.'); return; }
    setBusy(true);
    setError(null);
    try {
      const saved = await putGroup(id, name.trim(), { note, profiles }, base);
      close(() => onSaved(saved));
    } catch (e) {
      const cur = staleItem<GroupBody>(e);
      if (cur) {
        setBase(cur.seq);
        setError(`This group was changed on another device while you were writing. Save again to replace it with yours, or cancel to see theirs.`);
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
      close(() => onRemoved(group!));
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
      <h2 id="group-form-title">{group ? `Edit ${group.name}` : 'A new group'}</h2>
      {!online && <p className={`${ui.message} ${ui.error}`}>Saving needs the connection.</p>}
      <div className={ui.field}><label htmlFor={`${ids}-n`}>Group name</label><input id={`${ids}-n`} className={ui.input} value={name} maxLength={MAX_NAME} autoComplete="off" placeholder="The ferrymen of the Stir" onChange={(e) => setName(e.target.value)} /></div>
      <div className={ui.field}><label htmlFor={`${ids}-no`}>Note</label><textarea id={`${ids}-no`} className={ui.textarea} rows={2} value={note} maxLength={4000} onChange={(e) => setNote(e.target.value)} /></div>
      <h3 className={opp.sub}>Profiles</h3>
      {profiles.length === 0 && <p className={ui.muted}>No profile yet: copy one from the game, or write your own.</p>}
      <div className={opp.editors}>
        {profiles.map((p, i) => (
          <ProfileEditor key={p.id} cid={null} p={p} own={[]} open={fresh === p.id} onOwn={() => undefined}
            onChange={(x) => setProfiles((cur) => cur.map((y, j) => (j === i ? x : y)))}
            onRemove={() => setProfiles((cur) => cur.filter((_, j) => j !== i))} />
        ))}
      </div>
      {full && <p className={ui.muted}>A group holds at most {MAX_PROFILES} profiles.</p>}
      {picking && !full && <Suspense fallback={<p className={ui.muted}>Loading the rules…</p>}><TemplatePicker cid={null} warbands={[]} onClose={() => setPicking(false)} onPick={(t) => add(core.profileFrom(newId(), t))} /></Suspense>}
      {!picking && (
        <div className={ui.row}>
          <button type="button" className={ui.buttonQuiet} disabled={full} onClick={() => setPicking(true)}>Copy a model from the game…</button>
          <button type="button" className={ui.buttonQuiet} disabled={full} onClick={() => add(core.profileFrom(newId(), null))}>Write your own</button>
        </div>
      )}
      <p className={ui.muted}>Only you see the Library. In a campaign a leader sets the group against the warbands from here, as a copy.</p>
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {asking ? (
        <div className={ui.page}>
          <p>Remove it for good? It is gone on every device. Campaigns that already have a copy keep it.</p>
          <div className={ui.row}>
            <button type="button" className={ui.button} disabled={busy || !online} onClick={() => void remove()}>Yes, remove it</button>
            <button type="button" className={ui.buttonQuiet} onClick={() => setAsking(false)}>Keep it</button>
          </div>
        </div>
      ) : (
        <div className={ui.row}>
          <button type="submit" className={ui.button} disabled={busy || !online}>Save the group</button>
          <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
          {group && <button type="button" className={ui.buttonQuiet} disabled={busy} onClick={() => setAsking(true)}>Remove this group</button>}
        </div>
      )}
    </form>
  );
}

export function GroupsTab({ notify }: { notify: (t: string) => void }) {
  const online = useOnline();
  const { items, setItems, error } = useLibrary();
  const { ref, open, close } = useSheet('group-form');
  const [editing, setEditing] = useState<{ group: LibraryGroup | null; key: number } | null>(null);
  const groups = groupsOf(items);
  const edit = (group: LibraryGroup | null) => { setEditing((e) => ({ group, key: (e?.key ?? 0) + 1 })); open(); };
  const reachable = online && !error;

  return (
    <section className={ui.page} aria-labelledby="groups-title">
      <h2 id="groups-title" className={styles.title}>Groups</h2>
      <p className={ui.muted}>Groups of opponents – the men and beasts you set against the warbands – written once and used in any campaign: a leader adds one from here. Only you see this.</p>
      {error && <p className={ui.message} role="status">{error}{items ? ' Shown as last seen.' : ''}</p>}
      {!items && !error && <p className={ui.muted}>Loading the groups…</p>}
      {items && groups.length === 0 && <p className={ui.muted}>No groups yet. Write the first one down.</p>}
      {groups.length > 0 && (
        <ul className={styles.list} aria-label="Groups">
          {groups.map((g) => (
            <li key={g.id} className={styles.idea}>
              <div className={styles.head}><strong>{g.name}</strong></div>
              {g.body.note && <p className={styles.excerpt}>{g.body.note}</p>}
              <ul className={opp.profiles} aria-label={`Profiles of ${g.name}`}>
                {g.body.profiles.map((p) => (
                  <li key={p.id}>
                    <strong>{p.name || 'Unnamed'}{p.count > 1 ? ` ×${p.count}` : ''}</strong> <small className={opp.meta}>{p.type}</small>
                    <code className={opp.line}>{statline(p)}</code>
                  </li>
                ))}
                {g.body.profiles.length === 0 && <li className={ui.muted}>No profile yet.</li>}
              </ul>
              <small className={styles.meta}>Changed <time dateTime={g.updatedAt}>{stamp(g.updatedAt)}</time></small>
              <div className={ui.row}><button type="button" className={ui.buttonQuiet} aria-label={`Edit ${g.name}`} onClick={() => edit(g)}>Edit</button></div>
            </li>
          ))}
        </ul>
      )}
      <div className={ui.row}><button type="button" className={ui.button} onClick={() => edit(null)}>New group</button></div>
      <dialog ref={ref} className={ui.sheet} aria-labelledby="group-form-title">
        {editing && (
          <GroupForm key={editing.key} group={editing.group} online={reachable} close={close}
            onSaved={(g) => { setItems((cur) => [g, ...(cur ?? []).filter((x) => x.id !== g.id)]); notify('Group saved. Only you see it.'); }}
            onRemoved={(g) => { setItems((cur) => (cur ?? []).filter((x) => x.id !== g.id)); notify('Group removed.'); }} />
        )}
      </dialog>
    </section>
  );
}
