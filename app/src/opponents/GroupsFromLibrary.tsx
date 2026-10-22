/* "Groups from the Library…" among the opponents (ADR 0023): a leader sets one of their own groups against the
   warbands as a copy – every profile with an id of its own, and no link to a skill of another campaign. A group of
   the same name is not offered again. */
import { useState } from 'react';
import { errorText } from '../account/api.ts';
import type { LibraryGroup } from '../library/api.ts';
import { groupsOf, useLibrary } from '../library/useLibrary.ts';
import ui from '../ui/ui.module.css';

export function GroupsFromLibrary({ close, here, onAdd }: { close: () => void; here: string[]; onAdd: (g: LibraryGroup) => Promise<void> }) {
  const { items, error } = useLibrary();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const groups = groupsOf(items);
  const there = new Set(here.map((n) => n.trim().toLowerCase()));
  const add = async (g: LibraryGroup) => {
    setBusy(g.id);
    setProblem(null);
    try {
      await onAdd(g);
      close();
    } catch (e) {
      setProblem(errorText(e));
      setBusy(null);
    }
  };
  return (
    <div className={ui.page}>
      <h2 id="opp-library-title">Add groups from your Library</h2>
      <p className={ui.muted}>⚑ A copy of the group comes in, with all its profiles. A change in your Library does not change the campaign.</p>
      {error && <p className={ui.message} role="status">{error}</p>}
      {!items && !error && <p className={ui.muted}>Loading your Library…</p>}
      {items && groups.length === 0 && <p className={ui.muted}>No groups in your Library yet. Write them under Library → Groups.</p>}
      {groups.length > 0 && (
        <ul className={ui.list} aria-label="Your groups">
          {groups.map((g) => {
            const have = there.has(g.name.trim().toLowerCase());
            return (
              <li key={g.id}>
                <span><strong>{g.name}</strong><small className={ui.muted}> · {g.body.profiles.length} {g.body.profiles.length === 1 ? 'profile' : 'profiles'}</small></span>
                <button type="button" className={ui.buttonQuiet} aria-label={`Add ${g.name}`} disabled={have || busy !== null} onClick={() => void add(g)}>{have ? 'Already here' : 'Add'}</button>
              </li>
            );
          })}
        </ul>
      )}
      {problem && <p className={`${ui.message} ${ui.error}`} role="alert">{problem}</p>}
      <div className={ui.actions}><button type="button" className={ui.buttonQuiet} onClick={close}>Close</button></div>
    </div>
  );
}
